import { useCallback, useEffect, useRef, useState } from "react";
import { createSamplePrices, fetchGridSuppliers, fetchPrices, getCachedPrices, GridSupplier, GRID_SUPPLIERS, PricePoint } from "../prices";
import {useResolvedGridSupplier} from './useResolvedGridSupplier';


export function useEnergyPrices() {
  const [gridSuppliers, setGridSuppliers] = useState<GridSupplier[]>(GRID_SUPPLIERS);
  const [selectedSupplierId, setSelectedSupplierId] = useState("n1_c");
  const [now, setNow] = useState(() => Date.now());
  const resolved=useResolvedGridSupplier(gridSuppliers,selectedSupplierId);
  const selectedSupplier = resolved??{id:'',name:'Afklarer netselskab',area:'DK1' as const,resolutionIssue:'Afklarer netselskabet for din bolig…'};
  const [seriesKey,setSeriesKey]=useState('');
  const [prices, setPrices] = useState<PricePoint[]>(() => getCachedPrices(selectedSupplier.area, selectedSupplier.id) ?? createSamplePrices(selectedSupplier.area));
  const [loading, setLoading] = useState(() => !getCachedPrices(selectedSupplier.area, selectedSupplier.id));
  const [refreshing, setRefreshing] = useState(false);
  const [isSample, setIsSample] = useState(() => !getCachedPrices(selectedSupplier.area, selectedSupplier.id));
  const sequence = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const request = ++sequence.current;
    if(!selectedSupplier.id){setPrices([]);setIsSample(true);setLoading(false);setRefreshing(false);return;}
    const cached = getCachedPrices(selectedSupplier.area, selectedSupplier.id);
    setPrices(cached ?? createSamplePrices(selectedSupplier.area));
    setSeriesKey(selectedSupplier.id);
    setIsSample(!cached);
    setRefreshing(refresh);
    setLoading(!cached);
    try {
      const next = await fetchPrices(selectedSupplier.area, selectedSupplier.id, refresh);
      if (request !== sequence.current) return;
      setPrices(next);
      setIsSample(false);
    } catch {
      if (request !== sequence.current) return;
      setPrices(cached ?? createSamplePrices(selectedSupplier.area));
      setIsSample(!cached);
    } finally {
      if (request === sequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedSupplier.area, selectedSupplier.id]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void load();
    return () => { sequence.current++; };
  }, [load, Math.floor(now / (15 * 60 * 1000))]);

  useEffect(() => {
    fetchGridSuppliers().then(setGridSuppliers).catch(() => undefined);
  }, []);

  const ready=!!selectedSupplier.id&&seriesKey===selectedSupplier.id;
  return { gridSuppliers, selectedSupplier, selectedSupplierId, setSelectedSupplierId, now, prices:ready?prices:[], loading: loading || !resolved, refreshing, isSample:isSample||!ready, load };
}
