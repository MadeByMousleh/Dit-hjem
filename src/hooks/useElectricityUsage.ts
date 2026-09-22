import { useHouseholdSession } from "./useHouseholdSession";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundUsage, ElectricityUsage, UsageAggregation } from "../services/eloverblik";
import { usagePeriod, usageToday } from "../utils/usagePeriods";
import { useElectricityAgreements } from './useElectricityAgreements';
import { useEnergyVault } from '../components/EnergyVaultGate';
import { privateUsage, privateBackground } from '../services/private-electricity';

export function useElectricityUsage() {
  const auth = useHouseholdSession();
  const vault = useEnergyVault();
  const agreements = useElectricityAgreements(auth.householdId);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [usage, setUsage] = useState<ElectricityUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aggregation, setAggregation] = useState<UsageAggregation>("Day");
  const [anchor, setAnchor] = useState(usageToday);
  const [opened, setOpened] = useState(false);
  const requestId = useRef(0);
  const backgroundRequest = useRef(0);
  const [background, setBackground] = useState<BackgroundUsage | null>(null);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [backgroundError, setBackgroundError] = useState('');
  const loadBackground = useCallback(async () => {
    if (!auth.householdId) return;
    const id = ++backgroundRequest.current;
    setBackgroundLoading(true); setBackgroundError('');
    try {
      const result = await privateBackground(vault);
      if (id === backgroundRequest.current) setBackground(result);
    } catch (cause) {
      if (id === backgroundRequest.current) { setBackground(null); setBackgroundError(cause instanceof Error ? cause.message : 'Baggrundsforbrug kunne ikke beregnes.'); }
    } finally { if (id === backgroundRequest.current) setBackgroundLoading(false); }
  }, [auth.householdId, vault]);
  useEffect(() => {
    setBackground(null); setBackgroundError(''); setBackgroundLoading(false);
    void loadBackground();
    return () => { backgroundRequest.current++; };
  }, [loadBackground, auth.session?.user.id]);

  const load = useCallback(async (nextAggregation = aggregation, nextAnchor = anchor) => {
    const id = ++requestId.current;
    setAggregation(nextAggregation);
    setAnchor(nextAnchor);
    setOpened(true);
    setUsage(null);
    setLoading(true);
    setError("");
    try {
      const result = await privateUsage(vault, usagePeriod(nextAggregation, nextAnchor, availableYears));
      if (id === requestId.current) { setUsage(result); setAvailableYears(result.availableYears); }
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Elforbrug kunne ikke hentes");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [auth.householdId, aggregation, anchor, availableYears, vault]);

  const disconnect = useCallback(() => {
    requestId.current++;
    setOpened(false);
    setLoading(false);
    setAvailableYears([]);
    setUsage(null);
    setError("");
  }, []);

  useEffect(disconnect, [auth.householdId, auth.session?.user.id, disconnect]);

  return { auth, agreements, availableYears, usage, loading, error, load, disconnect, aggregation, anchor, opened, background, backgroundLoading, backgroundError, loadBackground };
}
