import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { EnergyVault, type ElectricityMeterDetails } from './energy-vault';
import { advance, aggregateReadings, meterReadings, midnight } from './consumption-data.mjs';
import type { ElectricityUsage, UsageSelection, BackgroundUsage } from './eloverblik';
import { usageToday } from '../utils/usagePeriods';
import { backgroundWindow, estimateBackground } from './background-usage.mjs';

// The long-lived Eloverblik refresh token is kept only in the native secure
// key store. It is never included in the encrypted vault, AsyncStorage, or a
// backend request. The short-lived access token remains in memory.
const refreshTokens = new WeakMap<EnergyVault, string>();
const accessTokens = new WeakMap<EnergyVault, string>();
const base = 'https://api.eloverblik.dk/customerapi/api';
const tokenKey = (vault: EnergyVault) => `stromblik.eloverblik.${vault.userId}.${vault.householdId}`;

async function storedRefreshToken(vault: EnergyVault) {
  const remembered = refreshTokens.get(vault);
  if (remembered) return remembered;
  if (Platform.OS === 'web') return null;
  const token = await SecureStore.getItemAsync(tokenKey(vault));
  if (!token) return null;
  refreshTokens.set(vault, token);
  return token;
}

async function accessToken(vault: EnergyVault) {
  const remembered = accessTokens.get(vault);
  if (remembered) return remembered;
  const refreshToken = await storedRefreshToken(vault);
  if (!refreshToken) return null;
  const access = await request('/token', refreshToken);
  if (typeof access.result !== 'string') throw new Error('Eloverblik afviste den gemte forbindelse. Forbind igen med en ny token.');
  accessTokens.set(vault, access.result);
  return access.result;
}
async function request(path: string, token: string, body?: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'api-version': '1.0' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
    if (!response.ok) throw new Error('Eloverblik afviste forespørgslen. Kontrollér din token og prøv igen.');
    return await response.json();
  } finally { clearTimeout(timeout); }
}
function text(value: unknown, maxLength: number) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = String(value).trim();
  return result && result.length <= maxLength ? result : null;
}
function isoDate(value: unknown) {
  const result = text(value, 40);
  return result && /^\d{4}-\d{2}-\d{2}/.test(result) ? result.slice(0, 10) : null;
}
export function parseElectricityMeterDetails(value: any): ElectricityMeterDetails {
  const address = [text(value?.streetName, 100), text(value?.buildingNumber, 30), text(value?.floorId, 30), text(value?.roomId, 30)].filter(Boolean).join(' ');
  const city = [text(value?.postcode, 20), text(value?.cityName, 100)].filter(Boolean).join(' ');
  return {
    address: [address, city].filter(Boolean).join(', ') || null,
    meterNumber: text(value?.meterNumber, 80),
    gridOperatorName: text(value?.gridOperatorName, 140),
    gridArea: text(value?.meteringGridAreaIdentification, 40),
    balanceSupplierName: text(value?.balanceSupplierName, 140),
    balanceSupplierStartDate: isoDate(value?.balanceSupplierStartDate),
    consumerStartDate: isoDate(value?.consumerStartDate),
    settlementMethod: text(value?.settlementMethod, 40),
    meterReadingOccurrence: text(value?.meterReadingOccurrence, 40),
    taxReduction: text(value?.taxReduction, 40),
  };
}
async function syncMeterDetails(vault: EnergyVault, token: string) {
  const stale = vault.data.meters.some(meter => !meter.details_fetched_at || Date.now() - Date.parse(meter.details_fetched_at) > 7 * 86400000);
  if (!stale || !vault.data.meters.length) return;
  try {
    const ids = vault.data.meters.map(meter => meter.metering_point_id);
    const response = await request('/meteringpoints/meteringpoint/getdetails', token, { meteringPoints: { meteringPoint: ids } });
    const details = new Map<string, ElectricityMeterDetails>();
    for (const item of response?.result ?? []) {
      const id = typeof item?.id === 'string' ? item.id : item?.result?.meteringPointId;
      if (item?.success === true && typeof id === 'string' && ids.includes(id)) details.set(id, parseElectricityMeterDetails(item.result));
    }
    const fetchedAt = new Date().toISOString();
    await vault.mutate(data => {
      data.meters = data.meters.map(meter => ({ ...meter, details: details.get(meter.metering_point_id) ?? meter.details ?? null, details_fetched_at: fetchedAt }));
      return data;
    });
  } catch {
    // Master data makes the information card richer, but must never block use
    // of consumption data when the optional upstream endpoint is unavailable.
  }
}
export async function connectPrivateMeter(vault: EnergyVault, token: string) {
  if (Platform.OS === 'web') throw new Error('Direkte Eloverblik-forbindelse kræver mobilappen. Browseren bruger din krypterede historik.');
  if (token.trim().length < 20 || token.length > 10000) throw new Error('Indtast en gyldig Eloverblik-token.');
  const access = await request('/token', token.trim());
  if (typeof access.result !== 'string') throw new Error('Eloverblik afviste token.');
  const response = await request('/meteringpoints/meteringpoints', access.result);
  const allowed = new Set(['D07','D10','D12','D15','D17','E17']);
  const ids = [...new Set<string>((response.result ?? []).filter((p: any) => p.hasRelation && !p.isMovedOut && allowed.has(p.typeOfMP) && /^\d{18}$/.test(p.meteringPointId)).map((p: any) => p.meteringPointId))];
  if (!ids.length || ids.length > 10) throw new Error('Forventede 1–10 tilknyttede elmålere.');
  await vault.mutate(data => {
    for (const id of ids) if (!data.meters.some(meter => meter.metering_point_id === id)) data.meters.push({ id, metering_point_id: id });
    return data;
  });
  await SecureStore.setItemAsync(tokenKey(vault), token.trim(), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  refreshTokens.set(vault, token.trim());
  accessTokens.set(vault, access.result);
  await syncMeterDetails(vault, access.result);
}
export async function hasPrivateMeterConnection(vault: EnergyVault) { return !!(await storedRefreshToken(vault)); }
export async function disconnectPrivateMeter(vault: EnergyVault) {
  refreshTokens.delete(vault);
  accessTokens.delete(vault);
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(tokenKey(vault));
}
type Selection = { from: string; to: string; aggregation: string };
const syncQueues = new WeakMap<EnergyVault, Promise<void>>();
async function syncUsage(vault: EnergyVault, selections: Selection[]) {
  const today = usageToday();
  const hasConnection = Platform.OS !== 'web' && await hasPrivateMeterConnection(vault);
  if (!hasConnection && Platform.OS !== 'web' && !vault.data.readings.length) throw new Error('Forbind Eloverblik på denne telefon først, og prøv derefter igen.');
  if (hasConnection) {
    let token: string | null = null;
    const imported: typeof vault.data.readings = [];
    const fetched: NonNullable<typeof vault.data.synced_ranges> = [];
    try {
      const detailsToken = await accessToken(vault);
      if (detailsToken) await syncMeterDetails(vault, detailsToken);
      for (const selection of selections) {
        const resolution = selection.aggregation.toLowerCase();
        const end = selection.to < today ? selection.to : today;
        const meters = vault.data.meters;
        if (selection.from < end && meters.length) {
          const chunk = ['Hour','Quarter'].includes(selection.aggregation) ? 'day' : selection.aggregation === 'Day' ? 'month' : 'year';
          for (const meter of meters) for (let from = selection.from; from < end; from = advance(from, chunk)) {
            void vault.data; // Stop issuing more requests if the device locked mid-import.
            const to = [advance(from, chunk), end].sort()[0]!;
            const fromAt = midnight(from), toAt = midnight(to);
            const existing = vault.data.readings.filter(row => row.meter_id === meter.id && row.resolution === resolution && row.starts_at >= fromAt && row.starts_at < toAt);
            const complete = aggregateReadings(existing, [meter], from, to, resolution, today).every(point => point.kwh !== null && !point.incomplete);
            const recent = to >= new Date(Date.parse(`${today}T12:00:00Z`) - 2 * 86400000).toISOString().slice(0, 10);
            const ttl = recent ? 6 * 3600000 : 7 * 86400000;
            const checked = vault.data.synced_ranges?.find(range => range.meter_id === meter.id && range.resolution === resolution && range.from === from && range.to === to);
            if (complete || (checked && Date.now() - Date.parse(checked.fetched_at) < ttl)) continue;
            token ??= await accessToken(vault);
            if (!token) throw new Error('Forbind Eloverblik på denne telefon først, og prøv derefter igen.');
            const result = await request(`/meterdata/gettimeseries/${from}/${to}/${selection.aggregation}`, token, { meteringPoints: { meteringPoint: [meter.metering_point_id] } });
            for (const row of meterReadings(result, meter.metering_point_id, resolution)) {
              if (row.starts_at >= fromAt && row.starts_at < toAt) imported.push({ ...row, meter_id: meter.id, resolution });
            }
            fetched.push({ meter_id: meter.id, resolution, from, to, fetched_at: new Date().toISOString() });
          }
        }
      }
    } finally {
      if (fetched.length) await vault.mutate(data => {
        const rows = new Map(data.readings.map(row => [`${row.meter_id}:${row.resolution}:${row.starts_at}`,row]));
        for (const row of imported) {
          const key = `${row.meter_id}:${row.resolution}:${row.starts_at}`;
          if (row.kwh !== null || !rows.has(key)) rows.set(key, row);
        }
        data.readings = [...rows.values()];
        const ranges = new Map((data.synced_ranges ?? []).filter(range => Date.now() - Date.parse(range.fetched_at) < 7 * 86400000).map(range => [`${range.meter_id}:${range.resolution}:${range.from}:${range.to}`, range]));
        for (const range of fetched) ranges.set(`${range.meter_id}:${range.resolution}:${range.from}:${range.to}`, range);
        data.synced_ranges = [...ranges.values()];
        return data;
      });
    }
  }
}
function queueSync(vault: EnergyVault, selections: Selection[]) {
  const pending = (syncQueues.get(vault) ?? Promise.resolve()).catch(() => {}).then(() => syncUsage(vault, selections));
  syncQueues.set(vault, pending);
  const cleanup = () => { if (syncQueues.get(vault) === pending) syncQueues.delete(vault); };
  void pending.then(cleanup, cleanup);
  return pending;
}
export async function privateUsageBatch(vault: EnergyVault, selections: UsageSelection[]) {
  await queueSync(vault, selections);
  return selections.map(selection => cachedPrivateUsage(vault, selection));
}
async function usage(vault: EnergyVault, selection: Selection) {
  await queueSync(vault, [selection]);
  return cachedPrivateUsage(vault, selection);
}
export function cachedPrivateUsage(vault: EnergyVault, selection: { from: string; to: string; aggregation: string }): ElectricityUsage {
  const resolution = selection.aggregation.toLowerCase();
  const today = usageToday();
  const data = vault.data;
  const fromAt = midnight(selection.from), toAt = midnight(selection.to);
  const rows = data.readings.filter(row => row.resolution === resolution && row.starts_at >= fromAt && row.starts_at < toAt);
  const points = aggregateReadings(rows, data.meters, selection.from, selection.to, resolution, today);
  const firstYear = data.readings.reduce((year,row) => Math.min(year,Number(row.starts_at.slice(0,4))),Number(today.slice(0,4))-5);
  return { ...selection, points, totalKwh: points.reduce((sum: number,p: { kwh: number | null }) => sum + (p.kwh ?? 0),0), meterCount: data.meters.length, availableYears: Array.from({ length: Number(today.slice(0,4)) - firstYear + 1 },(_,i) => firstYear + i), incomplete: points.some((p: { incomplete: boolean }) => p.incomplete), syncFailed: false } as ElectricityUsage;
}
export async function privateUsage(vault: EnergyVault, selection: UsageSelection) { return await usage(vault, selection) as ElectricityUsage; }
export async function privateBackground(vault: EnergyVault) { return estimateBackground(await usage(vault, backgroundWindow())) as BackgroundUsage; }
