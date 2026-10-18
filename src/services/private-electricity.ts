import { EnergyVault, type ElectricityMeterDetails } from './energy-vault';
import { Platform } from 'react-native';
import { API_URL, getSupabase } from './supabase';
import { cachedElectricityPoints, electricityIndex } from './electricity-cache.mjs';
import { electricityImportStatus, readElectricityPeriods, startElectricityHistory, storedElectricityPoints, subscribeElectricityHistory } from './electricity-history';
import type { ElectricityUsage, UsageSelection } from './eloverblik';
import { usageToday } from '../utils/usagePeriods';

async function thirdPartyRequest<T>(vault: EnergyVault, body: Record<string, unknown>): Promise<T> {
  const client = await getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Log ind igen for at forbinde Eloverblik.');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${API_URL}/api/eloverblik/usage`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ householdId: vault.householdId, ...body }), signal: controller.signal });
    const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
    if (!result) throw new Error('Eloverblik-serveren svarede ikke korrekt. Prøv igen.');
    if (!response.ok) throw Object.assign(new Error(result.error ?? 'Eloverblik kunne ikke gennemføre forbindelsen.'), { status: response.status });
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Kontrollen tog for lang tid. Prøv igen.');
    throw error;
  } finally { clearTimeout(timer); }
}

export type MeterConnectionResult = { connected?: boolean; pending?: boolean; authorizationUrl?: string; meters?: string[] };
async function importConnection(vault: EnergyVault, result: MeterConnectionResult) {
  if (result.connected && result.meters?.some(id => !vault.data.meters.some(meter => meter.metering_point_id === id))) await vault.mutate(data => {
    for (const meteringPointId of result.meters!) if (!data.meters.some(meter => meter.metering_point_id === meteringPointId)) data.meters.push({ id: meteringPointId, metering_point_id: meteringPointId });
    return data;
  });
  if (result.connected) startElectricityHistory(vault, body => thirdPartyRequest(vault, body));
  return result;
}
export async function beginThirdPartyMeterConnection(vault: EnergyVault) { statuses.delete(vault); return importConnection(vault, await thirdPartyRequest<MeterConnectionResult>(vault, { action: 'begin', platform: Platform.OS })); }
export async function finishThirdPartyMeterConnection(vault: EnergyVault) {
  statuses.delete(vault);
  const result = await thirdPartyRequest<{ connected: boolean; pending: boolean; meters?: string[] }>(vault, { action: 'finish' });
  return importConnection(vault, result);
}
const statuses = new WeakMap<EnergyVault, { until: number; promise: Promise<{ connected: boolean; pending?: boolean }> }>();
export async function privateMeterStatus(vault: EnergyVault) {
  const cached = statuses.get(vault);
  if (cached && cached.until > Date.now()) return cached.promise;
  const entry = { until: Infinity, promise: thirdPartyRequest<{ connected: boolean; pending?: boolean }>(vault, { action: 'status' }) };
  statuses.set(vault, entry);
  try { const result = await entry.promise; entry.until = result.connected ? Date.now() + 5 * 60000 : 0; return result; }
  catch (error) { if (statuses.get(vault) === entry) statuses.delete(vault); throw error; }
}
export async function hasPrivateMeterConnection(vault: EnergyVault) { return (await privateMeterStatus(vault)).connected; }
export async function disconnectPrivateMeter(_vault: EnergyVault) { throw new Error('Afbrydelse af tredjepartsfuldmagt håndteres i Eloverblik.'); }
export async function connectPrivateMeter(_vault: EnergyVault, _token: string) { throw new Error('Token-login er erstattet af Eloverblik-fuldmagt.'); }

function text(value: unknown, maxLength: number) { if (typeof value !== 'string' && typeof value !== 'number') return null; const result = String(value).trim(); return result && result.length <= maxLength ? result : null; }
function isoDate(value: unknown) { const result = text(value, 40); return result && /^\d{4}-\d{2}-\d{2}/.test(result) ? result.slice(0, 10) : null; }
export function parseElectricityMeterDetails(value: any): ElectricityMeterDetails {
  const address = [text(value?.streetName, 100), text(value?.buildingNumber, 30), text(value?.floorId, 30), text(value?.roomId, 30)].filter(Boolean).join(' ');
  const city = [text(value?.postcode, 20), text(value?.cityName, 100)].filter(Boolean).join(' ');
  return { address: [address, city].filter(Boolean).join(', ') || null, meterNumber: text(value?.meterNumber, 80), gridOperatorName: text(value?.gridOperatorName, 140), gridArea: text(value?.meteringGridAreaIdentification, 40), balanceSupplierName: text(value?.balanceSupplierName, 140), balanceSupplierStartDate: isoDate(value?.balanceSupplierStartDate), consumerStartDate: isoDate(value?.consumerStartDate), settlementMethod: text(value?.settlementMethod, 40), meterReadingOccurrence: text(value?.meterReadingOccurrence, 40), taxReduction: text(value?.taxReduction, 40) };
}

export async function loadPrivateUsageBatch(vault: EnergyVault, selections: UsageSelection[]) {
  await readElectricityPeriods(vault, selections);
  return selections.map(selection => cachedPrivateUsage(vault, selection));
}
export const subscribePrivateElectricity = subscribeElectricityHistory;
export const privateImportStatus = electricityImportStatus;
export async function privateUsageBatch(vault: EnergyVault, selections: UsageSelection[]) {
  await readElectricityPeriods(vault, selections);
  startElectricityHistory(vault, body => thirdPartyRequest(vault, body));
  return selections.map(selection => cachedPrivateUsage(vault, selection));
}
export async function privateUsage(vault: EnergyVault, selection: UsageSelection) {
  return (await privateUsageBatch(vault, [selection]))[0]!;
}
export function cachedPrivateUsage(vault: EnergyVault, selection: { from: string; to: string; aggregation: string }): ElectricityUsage {
  const resolution = selection.aggregation.toLowerCase(), today = usageToday(), data = vault.data;
  const points = storedElectricityPoints(vault, selection as UsageSelection, today) ?? cachedElectricityPoints(data, selection.from, selection.to, resolution, today);
  const state = vault.cachedElectricityRecord('state/import');
  const firstYear = state?.meters?.length ? Math.min(...state.meters.map((meter: any) => Number(meter.from.slice(0, 4)))) : electricityIndex(data).firstYear;
  return { ...selection, points, totalKwh: points.reduce((sum, point) => sum + (point.kwh ?? 0), 0), meterCount: state?.meters?.length ?? data.meters.length, availableYears: Array.from({ length: Number(today.slice(0, 4)) - firstYear + 1 }, (_, index) => firstYear + index), incomplete: points.some(point => point.incomplete), syncFailed: false } as ElectricityUsage;
}
