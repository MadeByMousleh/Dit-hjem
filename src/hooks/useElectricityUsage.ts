import { useHouseholdSession } from "./useHouseholdSession";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from 'react-native';
import { ElectricityUsage, UsageSelection } from "../services/eloverblik";
import { usagePeriod, usageToday } from "../utils/usagePeriods";
import { useElectricityAgreements } from './useElectricityAgreements';
import { useEnergyVault } from '../components/EnergyVaultGate';
import { useDashboardViewState } from './useDashboardViewState';
import { cachedPrivateUsage, loadPrivateUsageBatch, privateImportStatus, privateUsage, privateUsageBatch, subscribePrivateElectricity } from '../services/private-electricity';
import { useMeterConnection } from './useMeterConnection';
import { nextElectricitySyncAt } from '../services/electricity-cache.mjs';

const monthStart = (offset: number) => {
  const date = new Date(`${usageToday().slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
};

export function useElectricityUsage(active = true, now = Date.now()) {
  const auth = useHouseholdSession();
  const localDay = usageToday(now);
  const vault = useEnergyVault();
  const { electricAggregation: aggregation, setElectricAggregation: setAggregation, electricAnchor: anchor, setElectricAnchor: setAnchor } = useDashboardViewState();
  const agreements = useElectricityAgreements(auth.householdId);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [usage, setUsage] = useState<ElectricityUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { connected, error: connectionError, refresh: connectionReady } = useMeterConnection(vault, active);
  const requestId = useRef(0);
  const summaryRequest = useRef(0);
  const [monthlyUsage, setMonthlyUsage] = useState<ElectricityUsage | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');
  const [currentMonthDays, setCurrentMonthDays] = useState<ElectricityUsage | null>(null);
  const [previousMonthDays, setPreviousMonthDays] = useState<ElectricityUsage | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { setSyncTick(value => value + 1); schedule(); }, Math.max(1000, nextElectricitySyncAt() - Date.now()));
    };
    schedule();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { setSyncTick(value => value + 1); schedule(); }
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [active]);
  const previousDaysRequest = useRef(0);
  const loadMonthly = useCallback(async () => {
    if (!auth.householdId) return;
    const id = ++summaryRequest.current;
    const selection = { from: monthStart(-1), to: monthStart(0), aggregation: 'Month' as const };
    const cached = cachedPrivateUsage(vault, selection);
    setMonthlyUsage(cached.points.some(point => point.kwh !== null) ? cached : null);
    setMonthlyLoading(true); setMonthlyError('');
    try {
      const result = await privateUsage(vault, selection);
      if (id === summaryRequest.current) setMonthlyUsage(result);
    } catch (cause) {
      if (id === summaryRequest.current) setMonthlyError(cause instanceof Error ? cause.message : 'Månedsforbruget kunne ikke hentes.');
    } finally { if (id === summaryRequest.current) setMonthlyLoading(false); }
  }, [auth.householdId, vault]);

  const load = useCallback(async (nextAggregation = aggregation, nextAnchor = anchor) => {
    // A changed selection is loaded by the batch effect below. Starting a
    // second request here races that effect and reads the same range twice.
    if (nextAggregation !== aggregation || nextAnchor !== anchor) {
      requestId.current++;
      setAggregation(nextAggregation);
      setAnchor(nextAnchor);
      return;
    }
    const id = ++requestId.current;
    setAggregation(nextAggregation);
    setAnchor(nextAnchor);
    const knownYears = cachedPrivateUsage(vault, usagePeriod('Month', nextAnchor)).availableYears;
    const selection = usagePeriod(nextAggregation, nextAnchor, knownYears);
    const cached = cachedPrivateUsage(vault, selection);
    setUsage(cached.points.some(point => point.kwh !== null) ? cached : null);
    const currentDayView = nextAggregation === 'Day' && nextAnchor.slice(0, 7) === usageToday().slice(0, 7);
    if (currentDayView) setCurrentMonthDays(cached);
    setAvailableYears(cached.availableYears);
    setLoading(true);
    setError("");
    try {
      const result = await privateUsage(vault, selection);
      if (id === requestId.current) { setUsage(result); setAvailableYears(result.availableYears); if (currentDayView) setCurrentMonthDays(result); }
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Elforbrug kunne ikke hentes");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [auth.householdId, aggregation, anchor, vault]);

  const disconnect = useCallback(() => {
    requestId.current++;
    setLoading(false);
    setAvailableYears([]);
    setUsage(null);
    setError("");
  }, []);

  useEffect(() => {
    if (!active || !auth.householdId) return;
    const summaryId = ++summaryRequest.current;
    const daysId = ++previousDaysRequest.current;
    const graphId = ++requestId.current;
    const selections: UsageSelection[] = [
      { from: monthStart(-1), to: monthStart(0), aggregation: 'Month' as const },
      { from: monthStart(-1), to: monthStart(0), aggregation: 'Day' as const },
      usagePeriod('Day', localDay),
    ];
    const knownYears = cachedPrivateUsage(vault, usagePeriod('Month', anchor)).availableYears;
    const graphSelection = usagePeriod(aggregation, anchor, knownYears);
    const graphIndex = selections.findIndex(selection => selection.from === graphSelection.from && selection.to === graphSelection.to && selection.aggregation === graphSelection.aggregation);
    if (graphIndex < 0) selections.push(graphSelection);
    const publish = (results: ElectricityUsage[]) => {
      const [month, previous, current] = results;
      if (!month || !previous || !current) return;
      if (summaryId === summaryRequest.current) setMonthlyUsage(month);
      if (daysId === previousDaysRequest.current) {
        setPreviousMonthDays(previous);
        setCurrentMonthDays(current);
      }
      if (graphId === requestId.current) {
        const graph = results[graphIndex < 0 ? 3 : graphIndex];
        if (graph) { setUsage(graph); setAvailableYears(graph.availableYears); }
      }
    };
    publish(selections.map(selection => cachedPrivateUsage(vault, selection)));
    const unsubscribe = subscribePrivateElectricity(vault, () => {
      try {
        const results = selections.map(selection => cachedPrivateUsage(vault, selection));
        publish(results);
        if (results.some(result => result.points.some(point => point.kwh !== null))) setLoading(false);
        if (results[0]?.points.some(point => point.kwh !== null)) setMonthlyLoading(false);
        const state = privateImportStatus(vault);
        if (state.error) { setError(state.error); setMonthlyError(state.error); }
      } catch { /* The vault may have locked while the importer completed. */ }
    });
    // Saved charts remain available while status is unknown or the network fails.
    if (connected !== true) {
      void loadPrivateUsageBatch(vault, selections).then(publish).catch(() => { /* Preserve legacy/local cached values. */ });
      return () => { unsubscribe(); summaryRequest.current++; previousDaysRequest.current++; requestId.current++; };
    }
    setLoading(true); setMonthlyLoading(true); setError(''); setMonthlyError('');
    // Let cached data render before starting network/import work.
    const timer = setTimeout(() => {
      void privateUsageBatch(vault, selections).then(publish).catch(cause => {
        // Retain successfully saved ranges even if a later provider request failed.
        try { publish(selections.map(selection => cachedPrivateUsage(vault, selection))); } catch { /* Vault may have locked. */ }
        const message = cause instanceof Error ? cause.message : 'Elforbrug kunne ikke hentes';
        if (graphId === requestId.current) setError(message);
        if (summaryId === summaryRequest.current) setMonthlyError(message);
      }).finally(() => {
        if (graphId === requestId.current) setLoading(false);
        if (summaryId === summaryRequest.current) setMonthlyLoading(false);
      });
    }, 0);
    return () => { unsubscribe(); clearTimeout(timer); summaryRequest.current++; previousDaysRequest.current++; requestId.current++; };
  // Run once when the home tab opens or the connection changes.
  }, [active, connected, auth.householdId, vault, localDay, syncTick, aggregation, anchor]);

  return { auth, agreements, meters: vault.data.meters, availableYears, usage, loading, error, connectionError, load, disconnect, aggregation, anchor, connected, connectionReady, monthlyUsage, monthlyLoading, monthlyError, loadMonthly, currentMonthDays, previousMonthDays };
}
