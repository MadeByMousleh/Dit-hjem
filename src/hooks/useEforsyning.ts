import { useEffect, useRef, useState } from 'react';
import { useEnergyVault } from '../components/EnergyVaultGate';
import { syncHeating } from '../services/private-heating';

export function useEforsyning() {
  const vault = useEnergyVault();
  const [histories, setHistories] = useState(vault.data.heating ?? []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  async function run(connect: boolean, force = false) {
    const id = generation.current;
    setLoading(true); setError('');
    try {
      await syncHeating(vault, connect ? { username, password } : undefined, force);
      if (id === generation.current) setHistories(vault.data.heating ?? []);
      return true;
    } catch (cause) {
      if (id === generation.current) {
        try { setHistories(vault.data.heating ?? []); } catch { /* Locked session. */ }
        setError(cause instanceof Error ? cause.message : 'Varmeforbruget kunne ikke hentes.');
      }
      return false;
    } finally {
      if (id === generation.current) { setLoading(false); setPassword(''); }
    }
  }
  useEffect(() => {
    setHistories(vault.data.heating ?? []);
    void run(false);
    return () => { generation.current++; };
  }, [vault]);
  return { histories, username, setUsername, password, setPassword, loading, error, login: () => run(true), refresh: () => run(false, true) };
}
