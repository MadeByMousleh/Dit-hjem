import { createContext, createElement, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { getSupabase } from '../services/supabase';
import { authErrorMessage } from '../utils/authError';
type Household = { id: string; name: string };
function useSessionState() {
  const [session, setSession] = useState<Session | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdId, setHouseholdId] = useState('');
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
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getSupabase().then(client => {
      if (!active) return;
      const acceptSession = (next: Session | null) => {
        if (!active) return;
        if (activeUser.current !== next?.user.id) { setHouseholds([]); setHouseholdId(''); setCode(''); setCodeSent(false); }
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
      const claimed = await client.rpc('ensure_my_household');
      if (claimed.error) throw new Error('Adgang til husstanden kunne ikke bekræftes.');
      const result = await client.from('households').select('id,name').order('name');
      if (result.error) throw new Error('Husstande kunne ikke hentes.');
      if (active) { setHouseholds(result.data); setHouseholdId(result.data[0]?.id ?? ''); }
    })().catch(error => { if (active) setAuthError(error.message); }).finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, [session?.user.id, reload]);
  async function authenticate(createAccount = false) {
    if (authLoading) return;
    if (!codeSent && Date.now() < retryAt) { setAuthError('Vent et minut mellem nye koder.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setAuthError('Indtast en gyldig e-mail.'); return; }
    setAuthLoading(true); setAuthError('');
    try {
      const client = await getSupabase();
      const result = codeSent
        ? await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
        : await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: createAccount, ...(typeof window !== 'undefined' && window.location?.origin ? { emailRedirectTo: window.location.origin } : {}) } });
      if (result.error) throw new Error(authErrorMessage(result.error, codeSent, createAccount));
      if (!codeSent) { setCodeSent(true); setRetryAt(Date.now() + 60000); }
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Login mislykkedes.'); }
    finally { setAuthLoading(false); }
  }
  async function signOut() {
    setAuthError('');
    try {
      const client = await getSupabase();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setSession(null); setHouseholds([]); setHouseholdId(''); setCode(''); setCodeSent(false);
    } catch { setAuthError('Kunne ikke logge ud. Prøv igen.'); }
  }
  return { session, households, householdId, setHouseholdId, authError, authLoading, initializing, retry: () => { setAuthError(''); setReload(value => value + 1); }, email, setEmail, code, setCode, codeSent, setCodeSent, authenticate, signOut };
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
