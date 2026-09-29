import AsyncStorage from '@react-native-async-storage/async-storage';

export type PriceArea = "DK1" | "DK2";

export type GridSupplier = {
  id: string;
  name: string;
  companyName?: string;
  area: PriceArea;
};

export const GRID_SUPPLIERS: GridSupplier[] = [
  { id: "n1_c", name: "N1", area: "DK1" },
  { id: "n1_344", name: "N1 344", area: "DK1" },
  { id: "trefor_el-net_c", name: "TREFOR", area: "DK1" },
  { id: "radius_c", name: "Radius", area: "DK2" },
  { id: "cerius_c", name: "Cerius", area: "DK2" },
  { id: "trefor_el-net_oest_c", name: "TREFOR Øst", area: "DK2" },
];

type SupplierResponse = {
  id: string;
  name: string;
  companyName?: string;
  priceArea: PriceArea;
  customerGroups?: { id: string; default?: boolean }[];
};

export type PricePoint = {
  startsAt: Date;
  priceDkkMwh: number;
  totalOrePerKwh: number;
  gridAndTaxOrePerKwh: number;
};

type PriceComponent = {
  total: number;
};

type CompletePrice = {
  date: string;
  price: PriceComponent;
  details: {
    electricity: PriceComponent;
  };
};

type CompletePriceResponse = {
  prices?: CompletePrice[];
};

const API_URL = "https://stromligning.dk/api/prices";
const SUPPLIERS_API_URL = "https://stromligning.dk/api/suppliers";
const PRICE_TTL = 15 * 60 * 1000;
const priceCache = new Map<string, { points: PricePoint[]; fetchedAt: number }>();
const pendingPrices = new Map<string, Promise<PricePoint[]>>();
const historicPrices = new Map<string, Promise<PricePoint[]>>();

export function fetchHistoricalPrices(area: PriceArea, supplierId: string, from: string, to: string): Promise<PricePoint[]> {
  const key = `${area}:${supplierId}:${from}:${to}`;
  const pending = historicPrices.get(key);
  if (pending) return pending;
  const request = (async () => {
    const storageKey = `stromblik.public-history.v1.${key}`;
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const cached = raw ? JSON.parse(raw) : null;
      if (cached && Date.now() - cached.fetchedAt < 7 * 86400000 && Array.isArray(cached.points)) {
        return cached.points.map((point: PricePoint) => ({ ...point, startsAt: new Date(point.startsAt) }));
      }
    } catch { /* Fetch fresh public prices. */ }
    const points = await requestPrices(area, supplierId, from, to, false);
    void AsyncStorage.setItem(storageKey, JSON.stringify({ fetchedAt: Date.now(), points })).catch(() => {});
    return points;
  })().finally(() => historicPrices.delete(key));
  historicPrices.set(key, request);
  return request;
}

export function getCachedPrices(area: PriceArea, supplierId: string): PricePoint[] | undefined {
  const cached = priceCache.get(`${area}:${supplierId}`);
  return cached && Date.now() - cached.fetchedAt < PRICE_TTL ? cached.points : undefined;
}

export async function fetchGridSuppliers(): Promise<GridSupplier[]> {
  const response = await fetch(SUPPLIERS_API_URL);
  if (!response.ok) throw new Error(`Netselskaberne svarede med ${response.status}`);
  const suppliers = (await response.json()) as SupplierResponse[];
  const unique = new Map<string, GridSupplier>();
  suppliers
    .filter((supplier) => supplier.customerGroups?.some((group) => group.id === "c"))
    .filter((supplier) => !supplier.name.toLowerCase().includes("udgået"))
    .forEach((supplier) => unique.set(supplier.id, { id: supplier.id, name: supplier.name, companyName: supplier.companyName, area: supplier.priceArea }));
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name, "da"));
}

export function fetchPrices(area: PriceArea, supplierId: string, refresh = false): Promise<PricePoint[]> {
  const key = `${area}:${supplierId}`;
  const pending = pendingPrices.get(key);
  if (pending) return pending;
  const cached = getCachedPrices(area, supplierId);
  if (!refresh && cached) return Promise.resolve(cached);
  const request = (async () => {
    // Public tariff data only. Never store household readings or credentials here.
    const storageKey = `stromblik.public-prices.v1.${key}`;
    if (!refresh) {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored && Number.isFinite(stored.fetchedAt) && stored.fetchedAt <= Date.now() && Date.now() - stored.fetchedAt < PRICE_TTL && Array.isArray(stored.points) && stored.points.length) {
          const points: PricePoint[] = stored.points.map((point: PricePoint) => ({ ...point, startsAt: new Date(point.startsAt) }));
          if (points.every(point => Number.isFinite(point.startsAt.getTime()) && Number.isFinite(point.priceDkkMwh) && Number.isFinite(point.totalOrePerKwh) && Number.isFinite(point.gridAndTaxOrePerKwh))) {
            priceCache.set(key, { points, fetchedAt: stored.fetchedAt });
            return points;
          }
        }
      } catch { /* Ignore invalid or unavailable public cache. */ }
    }
    const points = await requestPrices(area, supplierId);
    const entry = { points, fetchedAt: Date.now() };
    priceCache.set(key, entry);
    void AsyncStorage.setItem(storageKey, JSON.stringify(entry)).catch(() => {});
    return points;
  })().finally(() => pendingPrices.delete(key));
  pendingPrices.set(key, request);
  return request;
}

async function requestPrices(area: PriceArea, supplierId: string, from?: string, to?: string, forecast = true): Promise<PricePoint[]> {
  const windowStart = Math.floor(Date.now() / PRICE_TTL) * PRICE_TTL;
  const query = new URLSearchParams({
    from: from ?? new Date(windowStart - 72 * 60 * 60 * 1000).toISOString(),
    to: to ?? new Date(windowStart + 7 * 24 * 60 * 60 * 1000).toISOString(),
    supplierId,
    customerGroupId: "c",
    priceArea: area,
    forecast: String(forecast),
  });
  const url = `${API_URL}?${query.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
  const response = await fetch(url, { signal: controller.signal });

  if (!response.ok) {
    throw new Error(`Prisserveren svarede med ${response.status}`);
  }

  const payload = (await response.json()) as CompletePriceResponse;
  const prices = (payload.prices ?? [])
    .filter((record) => Number.isFinite(record.price.total))
    .map((record) => ({
      startsAt: new Date(record.date),
      priceDkkMwh: record.details.electricity.total * 800,
      totalOrePerKwh: record.price.total * 100,
      gridAndTaxOrePerKwh: (record.price.total - record.details.electricity.total) * 100,
    }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  if (!prices.length) {
    throw new Error("Ingen priser blev fundet for området");
  }

  return prices;
  } finally { clearTimeout(timeout); }
}

export function createSamplePrices(area: PriceArea): PricePoint[] {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  const offset = area === "DK1" ? 0 : 70;

  return Array.from({ length: 680 }, (_, index) => {
    const startsAt = new Date(now.getTime() + (index - 8) * 15 * 60 * 1000);
    const hour = startsAt.getHours() + startsAt.getMinutes() / 60;
    const morningPeak = 620 * Math.exp(-Math.pow((hour - 8) / 2.2, 2));
    const eveningPeak = 980 * Math.exp(-Math.pow((hour - 19) / 2.7, 2));
    const middayDip = -260 * Math.exp(-Math.pow((hour - 13) / 3.2, 2));
    const variation = Math.sin(index * 0.72) * 85;

    const priceDkkMwh = Math.max(-120, 380 + morningPeak + eveningPeak + middayDip + variation + offset);
    const localGrid = hour < 6 ? 11 : hour < 17 || hour >= 21 ? 16 : 43;
    const gridAndTaxOrePerKwh = localGrid + 15.375;

    return {
      startsAt,
      priceDkkMwh,
      totalOrePerKwh: toOrePerKwh(priceDkkMwh) + gridAndTaxOrePerKwh,
      gridAndTaxOrePerKwh,
    };
  });
}

export function toOrePerKwh(priceDkkMwh: number): number {
  return priceDkkMwh / 8;
}
