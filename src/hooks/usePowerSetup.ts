import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import type { EnergyVault } from '../services/energy-vault';
import { beginThirdPartyMeterConnection, finishThirdPartyMeterConnection, privateMeterStatus } from '../services/private-electricity';
import { isEloverblikReturnUrl } from '../services/eloverblik-return';

export function usePowerSetup(vault: EnergyVault, enabled = true) {
  const [state, setState] = useState<'loading' | 'ready' | 'pending' | 'done'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const running = useRef<number | null>(null), generation = useRef(0);
  const queuedCheck = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const perform = useCallback(async (start: boolean): Promise<void> => {
    if (!enabled) return;
    const id = generation.current;
    if (running.current === id) { if (!start) queuedCheck.current = true; return; }
    running.current = id;
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    setBusy(true); setError(''); setMessage('');
    try {
      // begin already checks existing grants. A status error must not prevent
      // an explicit connection attempt on an older backend.
      let result;
      if (start) result = await beginThirdPartyMeterConnection(vault);
      else {
        const status = await privateMeterStatus(vault);
        result = status.connected || status.pending ? await finishThirdPartyMeterConnection(vault) : status;
      }
      if (id !== generation.current) return;
      if (result.connected) { retries.current = 0; setState('done'); setMessage('Dit elforbrug er forbundet.'); }
      else if ('authorizationUrl' in result && result.authorizationUrl) {
        setState('pending');
        await Linking.openURL(result.authorizationUrl);
        if (id === generation.current) setMessage('Godkend hos Eloverblik, og vend tilbage hertil. Vi kontrollerer forbindelsen automatisk.');
      } else {
        setState(result.pending ? 'pending' : 'ready');
        if (result.pending) setMessage('Vi venter på godkendelsen. Du kan kontrollere igen eller åbne Eloverblik på ny.');
        // Provider approval can arrive just after the browser returns. Retry
        // briefly, only while foregrounded, and stop on an upstream error.
        if (result.pending && retries.current < 3 && (Platform.OS === 'web' || AppState.currentState === 'active')) {
          const delay = [2000, 5000, 10000][retries.current++]!;
          retryTimer.current = setTimeout(() => { void perform(false); }, delay);
        }
      }
    } catch (cause) {
      if (id === generation.current) {
        setState(current => current === 'loading' ? 'ready' : current);
        setError(cause instanceof Error ? cause.message : 'Forbindelsen kunne ikke kontrolleres.');
      }
    } finally {
      if (running.current === id) running.current = null;
      if (id === generation.current) {
        setBusy(false);
        if (queuedCheck.current) { queuedCheck.current = false; void perform(false); }
      }
    }
  }, [vault, enabled]);
  useEffect(() => {
    if (!enabled) return;
    queuedCheck.current = false; retries.current = 0;
    const generationId = generation.current;
    void perform(false);
    const resume = () => { retries.current = 0; void perform(false); };
    const native = AppState.addEventListener('change', value => {
      if (value === 'active') resume();
      else if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    });
    // A link only triggers authenticated verification; it never proves a grant.
    const onReturn = (url: string) => {
      if (generation.current !== generationId) return;
      if (isEloverblikReturnUrl(url)) resume();
    };
    const links = Linking.addEventListener('url', event => onReturn(event.url));
    if (Platform.OS !== 'web') void Linking.getInitialURL().then(url => { if (url) onReturn(url); }).catch(() => {});
    const browser = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    browser?.addEventListener('focus', resume);
    return () => {
      generation.current++; queuedCheck.current = false;
      if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
      native.remove(); links.remove(); browser?.removeEventListener('focus', resume);
    };
  }, [perform, enabled]);
  return { state, busy, error, message, connect: () => perform(true), check: () => perform(false) };
}
