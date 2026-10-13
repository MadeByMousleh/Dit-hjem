import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { EnergyVault } from '../services/energy-vault';
import { hasPrivateMeterConnection } from '../services/private-electricity';

export function useMeterConnection(vault: EnergyVault, active = true) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    setError('');
    try {
      const value = await hasPrivateMeterConnection(vault);
      if (id === sequence.current) setConnected(value);
    } catch {
      if (id === sequence.current) setError('Forbindelsen til Eloverblik kunne ikke kontrolleres. Prøv igen.');
    }
  }, [vault]);
  useEffect(() => {
    setConnected(null);
    return () => { sequence.current++; };
  }, [vault]);
  useEffect(() => {
    if (!active) return;
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const onFocus = () => { void refresh(); };
    const browserWindow = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    browserWindow?.addEventListener('focus', onFocus);
    return () => {
      subscription.remove();
      browserWindow?.removeEventListener('focus', onFocus);
      sequence.current++;
    };
  }, [active, refresh]);
  return { connected, error, refresh };
}
