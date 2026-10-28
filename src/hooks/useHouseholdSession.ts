import {clearNotificationSession, getNotificationSession, setNotificationSession} from '../services/notification-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Linking} from 'react-native';
import {syncFamilyHome,invitedHome} from '../services/family';
import {subscribeProfileChanges,bindSharedHome} from '../services/storage';
import { createContext, createElement, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { getSupabase } from '../services/supabase';
import { authErrorMessage } from '../utils/authError';
type Household = { id: string; name: string;home_profile?:Record<string,unknown> };
function useSessionState() {
  const [session, setSession] = useState<Session | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdId, changeHouseholdId] = useState('');
  const [familyMember,setFamilyMember]=useState(false);
  const [pendingInvitations,setPendingInvitations]=useState<{householdId:string;name:string}[]>([]);
  const skippedInvitations=useRef(false);
  const pendingHome=useRef('');
  async function setHouseholdId(id:string){const client=await getSupabase();const role=await client.from('household_members').select('family_role').eq('household_id',id).eq('user_id',activeUser.current).maybeSingle();const member=role.data?.family_role==='member';setFamilyMember(member);const home=households.find(h=>h.id===id);if(activeUser.current){bindSharedHome(activeUser.current,member?(home?.home_profile??{}):null);await AsyncStorage.setItem('stromblik.active-home.'+activeUser.current,id);}changeHouseholdId(id);}
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [reload, setReload] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const activeUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (initializing) return;
    const owner = setNotificationSession(session?.user.id, householdId);
    return () => { if (owner && getNotificationSession() === owner) void clearNotificationSession(); };
  }, [initializing, session?.user.id, householdId]);
  useEffect(()=>{const accept=(url:string)=>{const id=invitedHome(url);if(!id||pendingHome.current===id)return;pendingHome.current=id;void AsyncStorage.setItem('stromblik.pending-family-home',id).then(()=>{if(activeUser.current)setReload(v=>v+1);});};const sub=Linking.addEventListener('url',e=>accept(e.url));void Linking.getInitialURL().then(url=>{if(url)accept(url);});if(Platform.OS==='web'&&typeof window!=='undefined')accept(window.location.href);return()=>sub.remove();},[]);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getSupabase().then(client => {
      if (!active) return;
      const acceptSession = (next: Session | null) => {
        if (!active) return;
        if (activeUser.current !== next?.user.id) { void clearNotificationSession(); setHouseholds([]); changeHouseholdId(''); setCode(''); setCodeSent(false);setPendingInvitations([]);skippedInvitations.current=false; }
        activeUser.current = next?.user.id;
        setSession(next);
      };
      const subscription = client.auth.onAuthStateChange((_event, next) => acceptSession(next));
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      return client.auth.getSession().then(({data, error}) => { if (error) throw error; if (active) { acceptSession(data.session); setAuthLoading(false); setInitializing(false); } });
    }).catch(() => { if (active) { setAuthError('Forbindelsen kunne ikke oprettes. Prøv igen.'); setAuthLoading(false); setInitializing(false); } });
    return () => { active = false; unsubscribe?.(); };
  }, [reload]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    const refresh = () => { void getSupabase().then(client => { if (active) { if (AppState.currentState === 'active') void client.auth.startAutoRefresh(); else void client.auth.stopAutoRefresh(); } }).catch(() => {}); };
    const listener = AppState.addEventListener('change', refresh);
    refresh();
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    let active = true;
    setHouseholds([]); setHouseholdId('');
    if (!session) return;
    setAuthLoading(true);
    (async () => {
      const client = await getSupabase();
      const invitations=await client.rpc('my_family_invitations');
      if(!invitations.error&&Array.isArray(invitations.data)&&invitations.data.length&&!skippedInvitations.current){if(active)setPendingInvitations(invitations.data);return;}
      const claimed = await client.rpc('ensure_my_household');
      if (claimed.error) throw new Error('Adgang til husstanden kunne ikke bekræftes.');
      let result = await client.from('households').select('id,name,home_profile').order('name');
      if(result.error)result=await client.from('households').select('id,name').order('name') as typeof result;
      if (result.error) throw new Error('Husstande kunne ikke hentes.');
      if (active) {
        const invited=await AsyncStorage.getItem('stromblik.pending-family-home'),remembered=await AsyncStorage.getItem('stromblik.active-home.'+session.user.id);
        const home=result.data.find(h=>h.id===invited)??result.data.find(h=>h.id===remembered)??result.data[0];
        const role=home?await client.from('household_members').select('family_role').eq('household_id',home.id).eq('user_id',session.user.id).maybeSingle():null;
        if(!active)return;
        const member=role?.data?.family_role==='member';setFamilyMember(member);bindSharedHome(session.user.id,member?(home?.home_profile??{}):null);
        setHouseholds(result.data);changeHouseholdId(home?.id??'');
        if(home)await AsyncStorage.setItem('stromblik.active-home.'+session.user.id,home.id);
        if(home?.id===invited)await AsyncStorage.removeItem('stromblik.pending-family-home');
      }
    })().catch(error => { if (active) setAuthError(error.message); }).finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, [session?.user.id, reload]);
  useEffect(()=>{if(!session||!householdId||familyMember)return;let timer:ReturnType<typeof setTimeout>|undefined;const off=subscribeProfileChanges(userId=>{if(userId&&userId!==session.user.id)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>{void syncFamilyHome(householdId,session.user.id).catch(()=>{});},500);});return()=>{off();if(timer)clearTimeout(timer);};},[session?.user.id,householdId,familyMember]);
  async function acceptInvitation(id:string){setAuthLoading(true);setAuthError('');try{const client=await getSupabase();const result=await client.rpc('accept_family_invitation',{p_home:id});if(result.error)throw Error('Invitationen er udløbet eller til en anden e-mail.');await AsyncStorage.setItem('stromblik.pending-family-home',id);setPendingInvitations([]);setReload(v=>v+1);}catch(e){setAuthError(e instanceof Error?e.message:'Invitationen kunne ikke accepteres.');}finally{setAuthLoading(false);}}
  function skipInvitations(){skippedInvitations.current=true;setPendingInvitations([]);setReload(v=>v+1);}
  async function authenticate(createAccount = false) {
    if (authLoading) return;
    if (!codeSent && Date.now() < retryAt) { setAuthError('Vent et minut mellem nye koder.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setAuthError('Indtast en gyldig e-mail.'); return; }
    setAuthLoading(true); setAuthError('');
    try {
      const client = await getSupabase();
      const result = codeSent
        ? await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
        : await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: createAccount, ...(createAccount ? { data: { onboarding_pending: true } } : {}), ...(typeof window !== 'undefined' && window.location?.origin ? { emailRedirectTo: window.location.origin } : {}) } });
      if (result.error) throw new Error(authErrorMessage(result.error, codeSent, createAccount));
      if (!codeSent) { setCodeSent(true); setRetryAt(Date.now() + 60000); }
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Login mislykkedes.'); }
    finally { setAuthLoading(false); }
  }
  async function signOut() {
    setAuthError('');
    try {
      await clearNotificationSession();
      const client = await getSupabase();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setSession(null); setHouseholds([]); setHouseholdId(''); setCode(''); setCodeSent(false);
    } catch { setAuthError('Kunne ikke logge ud. Prøv igen.'); }
  }
  return { session, households, householdId,familyMember,pendingInvitations,acceptInvitation,skipInvitations, setHouseholdId, authError, authLoading, initializing, retry: () => { setAuthError(''); setReload(value => value + 1); }, email, setEmail, code, setCode, codeSent, setCodeSent, authenticate, signOut };
}

const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(null);
export function HouseholdSessionProvider({ children }: { children: ReactNode }) {
  const state = useSessionState();
  return createElement(SessionContext.Provider, { value: state }, children);
}
export function useHouseholdSession() {
  const state = useContext(SessionContext);
  if (!state) throw new Error('HouseholdSessionProvider mangler.');
  return state;
}
