import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useEnergyVault } from '../components/EnergyVaultGate';
import { hasPrivateHeatingConnection, heatingNeedsReconnect, syncHeating } from '../services/private-heating';

export function useEforsyning() {
  const vault = useEnergyVault();
  const [histories, setHistories] = useState(vault.data.heating ?? []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const generation = useRef(0);
  const running = useRef<number | null>(null);
  async function run(connect: boolean, force = false, connectionKnown = false) {
    const id = generation.current;
    if (running.current === id) return false;
    running.current = id;
    let rejected = false;
    setLoading(true); setError('');
    try {
      const result = await syncHeating(vault, connect ? { username, password } : undefined, force);
      if (result?.connected) connectionKnown = true;
      if (id === generation.current) { setHistories(vault.data.heating ?? []); if (result?.connected) setConnected(true); setError(result?.warning ?? ''); }
      return true;
    } catch (cause) {
      if (id === generation.current) {
        try { setHistories(vault.data.heating ?? []); } catch { /* Locked session. */ }
        setError(cause instanceof Error ? cause.message : 'Varmeforbruget kunne ikke hentes.');
        if (heatingNeedsReconnect(cause)) { rejected = true; setConnected(false); }
      }
      return false;
    } finally {
      if (id === generation.current && !rejected && !connectionKnown) try {
        const connection = await hasPrivateHeatingConnection(vault);
        if (id === generation.current && !rejected) setConnected(connection);
      } catch { /* A failed status check does not mean saved credentials are gone. */ }
      if (id === generation.current) { setLoading(false); setPassword(''); }
      if (running.current === id) running.current = null;
    }
  }
  const checkConnection = useCallback(async () => {
    const id = generation.current;
    try {
      const value = await hasPrivateHeatingConnection(vault);
      if (id === generation.current) { setConnected(value); if (value && running.current !== id) void run(false, false, true); }
    } catch { if (id === generation.current) setError('Varmeforbindelsen kunne ikke kontrolleres. Prøv igen.'); }
  }, [vault]);
  useEffect(() => {
    setConnected(null);
    setHistories(vault.data.heating ?? []);
    void checkConnection();
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void checkConnection(); });
    const browser = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    const resume = () => { void checkConnection(); };
    browser?.addEventListener('focus', resume);
    return () => { generation.current++; subscription.remove(); browser?.removeEventListener('focus', resume); };
  }, [vault, checkConnection]);
  return { histories, connected, username, setUsername, password, setPassword, loading, error, login: () => run(true), refresh: () => run(false, true) };
}
