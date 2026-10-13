import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import type { EnergyVault } from '../services/energy-vault';
import { beginThirdPartyMeterConnection, finishThirdPartyMeterConnection, privateMeterStatus } from '../services/private-electricity';

export function usePowerSetup(vault: EnergyVault, enabled = true) {
  const [state, setState] = useState<'loading' | 'ready' | 'pending' | 'done'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const running = useRef<number | null>(null), generation = useRef(0);
  const perform = useCallback(async (start: boolean) => {
    if (!enabled) return;
    const id = generation.current;
    if (running.current === id) return;
    running.current = id;
    setBusy(true); setError(''); setMessage('');
    try {
      const status = await privateMeterStatus(vault);
      const result = start
        ? await beginThirdPartyMeterConnection(vault)
        : status.connected || status.pending ? await finishThirdPartyMeterConnection(vault) : status;
      if (id !== generation.current) return;
      if (result.connected) { setState('done'); setMessage('Dit elforbrug er forbundet.'); }
      else if ('authorizationUrl' in result && result.authorizationUrl) {
        setState('pending');
        await Linking.openURL(result.authorizationUrl);
        if (id === generation.current) setMessage('Godkend hos Eloverblik, og vend tilbage hertil. Vi kontrollerer forbindelsen automatisk.');
      } else {
        setState(result.pending ? 'pending' : 'ready');
        if (result.pending) setMessage('Vi venter på godkendelsen. Du kan kontrollere igen eller åbne Eloverblik på ny.');
      }
    } catch (cause) {
      if (id === generation.current) {
        setState(current => current === 'loading' ? 'ready' : current);
        setError(cause instanceof Error ? cause.message : 'Forbindelsen kunne ikke kontrolleres.');
      }
    } finally { if (running.current === id) running.current = null; if (id === generation.current) setBusy(false); }
  }, [vault, enabled]);
  useEffect(() => {
    if (!enabled) return;
    void perform(false);
    const native = AppState.addEventListener('change', value => { if (value === 'active') void perform(false); });
    const browser = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    const resume = () => { void perform(false); };
    browser?.addEventListener('focus', resume);
    return () => { generation.current++; native.remove(); browser?.removeEventListener('focus', resume); };
  }, [perform, enabled]);
  return { state, busy, error, message, connect: () => perform(true), check: () => perform(false) };
}
