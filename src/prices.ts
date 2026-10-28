import AsyncStorage from '@react-native-async-storage/async-storage';
import { writeOptionalCache } from './services/local-storage-cache.mjs';
import {API_URL as BACKEND_URL} from './services/supabase';
import {ENERGINET_GRID_SUPPLIERS} from './services/energinet-tariff-catalog.mjs';

export type PriceArea = "DK1" | "DK2";

export type GridSupplier = {
  id: string;
  name: string;
  companyName?: string;
  area: PriceArea;
  gln?:string;
  meterVerified?:boolean;
  evidenceSource?:string;
  resolutionIssue?:string;
};

export const GRID_SUPPLIERS:GridSupplier[]=ENERGINET_GRID_SUPPLIERS.map(({id,name,companyName,area,gln})=>({id,name,companyName,area:area as PriceArea,gln}));

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
  intervalMinutes?:15|60;
  forecast?:boolean;
  forecastLowerOrePerKwh?:number;
  forecastUpperOrePerKwh?:number;
  forecastIssuedAt?:string;
  forecastProvisional?:boolean;
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

const API_URL = BACKEND_URL+'/api/grid/lookup';
const SUPPLIERS_API_URL = API_URL+'?operation=suppliers';
const PRICE_TTL = 15 * 60 * 1000;
const priceCache = new Map<string, { points: PricePoint[]; fetchedAt: number }>();
const pendingPrices = new Map<string, Promise<PricePoint[]>>();
const historicPrices = new Map<string, Promise<PricePoint[]>>();
// Keep decoded public history across screen remounts. The disk cache remains
// the source after eviction/restart; no household readings enter this cache.
const historicCache = new Map<string, {points: PricePoint[]; fetchedAt: number}>();
const historyTtl = (to: string) => Date.parse(to) > Date.now() - 2 * 86400000 ? PRICE_TTL : 7 * 86400000;
function rememberHistory(key: string, entry: {points: PricePoint[]; fetchedAt: number}) {
  historicCache.delete(key);
  historicCache.set(key, entry);
  let pointCount = [...historicCache.values()].reduce((sum, item) => sum + item.points.length, 0);
  while (historicCache.size > 12 || pointCount > 40000) {
    const oldest = historicCache.keys().next().value!;
    pointCount -= historicCache.get(oldest)!.points.length;
    historicCache.delete(oldest);
  }
  return entry.points;
}

export function fetchHistoricalPrices(area: PriceArea, supplierId: string, from: string, to: string): Promise<PricePoint[]> {
  if(!supplierId)return Promise.resolve([]);
  const key = `${area}:${supplierId}:${from}:${to}`;
  const memory = historicCache.get(key);
  if (memory && memory.fetchedAt <= Date.now() && Date.now() - memory.fetchedAt < historyTtl(to)) {
    return Promise.resolve(rememberHistory(key, memory));
  }
  historicCache.delete(key);
  const pending = historicPrices.get(key);
  if (pending) return pending;
  const request = (async () => {
    const storageKey = `stromblik.public-history.energinet-v1.${key}`;
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const cached = raw ? JSON.parse(raw) : null;
      const ttl=historyTtl(to);
      if (cached && Number.isFinite(cached.fetchedAt)&&cached.fetchedAt<=Date.now()&&Date.now() - cached.fetchedAt < ttl && Array.isArray(cached.points)) {
        return rememberHistory(key, {fetchedAt: cached.fetchedAt, points: cached.points.map((point: PricePoint) => ({ ...point, startsAt: new Date(point.startsAt) }))});
      }
    } catch { /* Fetch fresh public prices. */ }
    const points = await requestPrices(area, supplierId, from, to, false);
    void writeOptionalCache(AsyncStorage, storageKey, JSON.stringify({ fetchedAt: Date.now(), points }));
    return rememberHistory(key, {points, fetchedAt: Date.now()});
  })().finally(() => historicPrices.delete(key));
  historicPrices.set(key, request);
  return request;
}

export function getCachedPrices(area: PriceArea, supplierId: string): PricePoint[] | undefined {
  const cached = priceCache.get(`${area}:${supplierId}`);
  return cached && Date.now() - cached.fetchedAt < PRICE_TTL ? cached.points : undefined;
}

let supplierRequest:Promise<GridSupplier[]>|undefined;
export function fetchGridSuppliers():Promise<GridSupplier[]> {
 return supplierRequest??(supplierRequest=requestGridSuppliers().catch(error=>{supplierRequest=undefined;throw error;}));
}
async function requestGridSuppliers(): Promise<GridSupplier[]> {
  const response = await fetch(SUPPLIERS_API_URL);
  if (!response.ok) throw new Error(`Netselskaberne svarede med ${response.status}`);
  const payload=await response.json();
  if(payload.source?.id!=='energinet-v1'||!Array.isArray(payload.suppliers))throw Error('Ugyldig netselskabsliste');
  const suppliers=payload.suppliers as GridSupplier[];
  const unique = new Map<string, GridSupplier>();
  suppliers
    .filter(supplier=>['DK1','DK2'].includes(supplier.area)&&typeof supplier.id==='string'&&typeof supplier.name==='string')
    .forEach((supplier) => unique.set(supplier.id, supplier));
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
    const storageKey = `stromblik.public-prices.energinet-v1.${key}`;
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
    void writeOptionalCache(AsyncStorage, storageKey, JSON.stringify(entry));
    return points;
  })().finally(() => pendingPrices.delete(key));
  pendingPrices.set(key, request);
  return request;
}

async function requestPrices(area: PriceArea, supplierId: string, from?: string, to?: string, _forecast = false): Promise<PricePoint[]> {
  const query = new URLSearchParams({
    operation:'prices',
    ...(from?{from}:{}),...(to?{to}:{}),
    supplierId,
    priceArea: area,
  });
  const url = `${API_URL}?${query.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
  const response = await fetch(url, { signal: controller.signal });

  if (!response.ok) {
    throw new Error(`Prisserveren svarede med ${response.status}`);
  }

  const payload=await response.json();
  if(payload.source?.id!=='energinet-v1'||!Array.isArray(payload.points))throw Error('Ugyldig priskilde');
  const prices:PricePoint[]=payload.points.map((record:PricePoint)=>({...record,startsAt:new Date(record.startsAt)}))
    .sort((left:PricePoint, right:PricePoint) => left.startsAt.getTime() - right.startsAt.getTime());

  if (!prices.length) {
    throw new Error("Ingen priser blev fundet for området");
  }
  if(prices.some(p=>!Number.isFinite(p.startsAt.getTime())||![p.priceDkkMwh,p.totalOrePerKwh,p.gridAndTaxOrePerKwh].every(Number.isFinite)))throw Error('Ugyldige prisdata');

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
