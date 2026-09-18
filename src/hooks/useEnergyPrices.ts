import { useCallback, useEffect, useState } from "react";
import { createSamplePrices, fetchGridSuppliers, fetchPrices, GridSupplier, GRID_SUPPLIERS, PricePoint } from "../prices";

const DEFAULT_GRID_SUPPLIER: GridSupplier = { id: "n1_c", name: "N1", area: "DK1" };

export function useEnergyPrices() {
  const [gridSuppliers, setGridSuppliers] = useState<GridSupplier[]>(GRID_SUPPLIERS);
  const [selectedSupplierId, setSelectedSupplierId] = useState("n1_c");
  const [now, setNow] = useState(() => Date.now());
  const selectedSupplier = gridSuppliers.find((supplier) => supplier.id === selectedSupplierId) ?? DEFAULT_GRID_SUPPLIER;
  const [prices, setPrices] = useState<PricePoint[]>(() => createSamplePrices(selectedSupplier.area));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSample, setIsSample] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setPrices(await fetchPrices(selectedSupplier.area, selectedSupplier.id));
      setIsSample(false);
    } catch {
      setPrices(createSamplePrices("DK1"));
      setIsSample(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSupplier]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void load();
  }, [load, Math.floor(now / (15 * 60 * 1000))]);

  useEffect(() => {
    fetchGridSuppliers().then(setGridSuppliers).catch(() => undefined);
  }, []);

  return { gridSuppliers, selectedSupplier, selectedSupplierId, setSelectedSupplierId, now, prices, loading, refreshing, isSample, load };
}
