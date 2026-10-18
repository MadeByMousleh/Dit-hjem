import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useHouseholdSession } from './useHouseholdSession';
import { useDashboardViewState } from './useDashboardViewState';
import { commandSmartThingsProgram, startSmartThingsProgram, commandSmartThingsSwitch, getSmartThingsAuthorizationUrl, getSmartThingsDevices, getSmartThingsStatus, removeSmartThingsConnection, SmartThingsClientError, type SmartThingsDevice } from '../services/smartthings';

export function useSmartThingsConnection(active: boolean) {
  const { session } = useHouseholdSession(), user = session?.user.id ?? '';
  const { setActiveTab } = useDashboardViewState();
  const owner = useRef(user); owner.current = user;
  const sequence = useRef(0), busy = useRef(false);
  const initialHandled = useRef('');
  const [state, setState] = useState({ user, connected: null as boolean | null, devices: [] as SmartThingsDevice[], loading: false, connecting: false, pending: '', error: '', notice: '', truncated: false });
  useEffect(() => { sequence.current++; setState({ user, connected: null, devices: [], loading: false, connecting: false, pending: '', error: '', notice: '', truncated: false }); }, [user]);
  const refresh = useCallback(async () => {
    if (!user) return;
    const id = ++sequence.current;
    const publish = (changes: Partial<typeof state>) => { if (owner.current === user && id === sequence.current) setState(previous => ({ ...previous, ...changes })); };
    publish({ loading: true, error: '' });
    try {
      const status = await getSmartThingsStatus();
      if (typeof status.connected !== 'boolean') throw new Error('SmartThings sendte en ugyldig status.');
      if (!status.connected) { publish({ connected: false, devices: [], truncated: false }); return; }
      publish({ connected: true });
      const result = await getSmartThingsDevices();
      if (!Array.isArray(result.devices)) throw new Error('SmartThings sendte en ugyldig enhedsliste.');
      publish({ devices: result.devices, truncated: result.truncated });
    } catch (error) {
      publish({ error: error instanceof Error ? error.message : 'SmartThings kunne ikke opdateres.', ...(error instanceof SmartThingsClientError && error.status === 409 ? { connected: false, devices: [] } : {}) });
    } finally { publish({ loading: false }); }
  }, [user]);
  useEffect(() => { if (active) void refresh(); }, [active, refresh]);
  useEffect(() => {
    const onReturn = ({ url }: { url: string }) => {
      if (!/^stromblik:\/\/smartthings\/connected(?:[?#]|$)/.test(url)) return;
      setActiveTab('smartthings'); void refresh();
    };
    const link = Linking.addEventListener('url', onReturn);
    let live = true;
    void Linking.getInitialURL().then(url => {
      if (live && user && url && initialHandled.current !== `${user}:${url}`) { initialHandled.current = `${user}:${url}`; onReturn({ url }); }
    }).catch(() => {});
    const app = AppState.addEventListener('change', value => { if (active && value === 'active') void refresh(); });
    const focus = () => { if (active) void refresh(); };
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('focus', focus);
    return () => { live = false; link.remove(); app.remove(); if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('focus', focus); };
  }, [active, refresh, setActiveTab]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !user) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('smartthings') === 'connected') {
      url.searchParams.delete('smartthings'); window.history.replaceState(null, '', url.toString());
      setActiveTab('smartthings'); void refresh();
    }
  }, [user, refresh, setActiveTab]);
  useEffect(() => () => { sequence.current++; owner.current = ''; }, []);
  const connect = async () => {
    if (busy.current || !user) return;
    busy.current = true; setState(previous => ({ ...previous, connecting: true, error: '', notice: '' }));
    try {
      const url = await getSmartThingsAuthorizationUrl(Platform.OS !== 'web');
      if (owner.current !== user) return;
      if (Platform.OS === 'web') window.location.assign(url); else await Linking.openURL(url);
    } catch (error) { if (owner.current === user) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Login kunne ikke åbnes.' })); }
    finally { busy.current = false; if (owner.current === user) setState(previous => ({ ...previous, connecting: false })); }
  };
  const sendCommand = async (deviceId: string, component: string, action: () => Promise<unknown>) => {
    if (busy.current || owner.current !== user || !user) return;
    busy.current = true; setState(previous => ({ ...previous, pending: `${deviceId}:${component}`, error: '', notice: '' }));
    try {
      await action();
      if (owner.current !== user) return;
      setState(previous => ({ ...previous, notice: 'Kommandoen er sendt. Opdater status for at se, om enheden har udført den.' }));
      await refresh();
      return true;
    } catch (error) { if (owner.current === user) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Kommandoen mislykkedes.' })); return false; }
    finally { busy.current = false; if (owner.current === user) setState(previous => ({ ...previous, pending: '' })); }
  };
  const setSwitch = (deviceId: string, component: string, command: 'on' | 'off') => sendCommand(deviceId, component, () => commandSmartThingsSwitch(deviceId, component, command));
  const setProgram = (deviceId: string, component: string, capability: string, program: string) => sendCommand(deviceId, component, () => commandSmartThingsProgram(deviceId, component, capability, program));
  const startProgram = (deviceId: string, component: string, program: string) => sendCommand(deviceId, component, () => startSmartThingsProgram(deviceId, component, program));
  const disconnect = async () => {
    if (busy.current || !user) return;
    busy.current = true; sequence.current++;
    setState(previous => ({ ...previous, connecting: true, error: '' }));
    try {
      await removeSmartThingsConnection();
      if (owner.current === user) setState(previous => ({ ...previous, connected: false, devices: [], notice: 'Forbindelsen er fjernet fra Strømblik. Adgangen kan også tilbagekaldes i SmartThings under Linked services.' }));
    } catch (error) { if (owner.current === user) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Forbindelsen kunne ikke fjernes.' })); }
    finally { busy.current = false; if (owner.current === user) setState(previous => ({ ...previous, connecting: false, loading: false })); }
  };
  return { ...state, connected: state.user === user ? state.connected : null, devices: state.user === user ? state.devices : [], refresh, connect, setSwitch, setProgram, startProgram, disconnect };
}
