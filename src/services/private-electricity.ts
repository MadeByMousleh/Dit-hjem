import { EnergyVault, type ElectricityMeterDetails } from './energy-vault';
import { API_URL, getSupabase } from './supabase';
import { advance, aggregateReadings, meterReadings, midnight } from './consumption-data.mjs';
import type { ElectricityUsage, UsageSelection } from './eloverblik';
import { usageToday } from '../utils/usagePeriods';

type Selection = { from: string; to: string; aggregation: string };

async function thirdPartyRequest<T>(vault: EnergyVault, body: Record<string, unknown>): Promise<T> {
  const client = await getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Log ind igen for at forbinde Eloverblik.');
  const response = await fetch(`${API_URL}/api/eloverblik/usage`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ householdId: vault.householdId, ...body }) });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'Eloverblik kunne ikke gennemføre forbindelsen.');
  return result;
}

export type MeterConnectionResult = { connected?: boolean; pending?: boolean; authorizationUrl?: string; meters?: string[] };
async function importConnection(vault: EnergyVault, result: MeterConnectionResult) {
  if (result.connected && result.meters?.some(id => !vault.data.meters.some(meter => meter.metering_point_id === id))) await vault.mutate(data => {
    for (const meteringPointId of result.meters!) if (!data.meters.some(meter => meter.metering_point_id === meteringPointId)) data.meters.push({ id: meteringPointId, metering_point_id: meteringPointId });
    return data;
  });
  return result;
}
export async function beginThirdPartyMeterConnection(vault: EnergyVault) { return importConnection(vault, await thirdPartyRequest<MeterConnectionResult>(vault, { action: 'begin' })); }
export async function finishThirdPartyMeterConnection(vault: EnergyVault) {
  const result = await thirdPartyRequest<{ connected: boolean; pending: boolean; meters?: string[] }>(vault, { action: 'finish' });
  return importConnection(vault, result);
}
export async function privateMeterStatus(vault: EnergyVault) { return thirdPartyRequest<{ connected: boolean; pending?: boolean }>(vault, { action: 'status' }); }
export async function hasPrivateMeterConnection(vault: EnergyVault) { return (await thirdPartyRequest<{ connected: boolean }>(vault, { action: 'status' })).connected; }
export async function disconnectPrivateMeter(_vault: EnergyVault) { throw new Error('Afbrydelse af tredjepartsfuldmagt håndteres i Eloverblik.'); }
export async function connectPrivateMeter(_vault: EnergyVault, _token: string) { throw new Error('Token-login er erstattet af Eloverblik-fuldmagt.'); }

function text(value: unknown, maxLength: number) { if (typeof value !== 'string' && typeof value !== 'number') return null; const result = String(value).trim(); return result && result.length <= maxLength ? result : null; }
function isoDate(value: unknown) { const result = text(value, 40); return result && /^\d{4}-\d{2}-\d{2}/.test(result) ? result.slice(0, 10) : null; }
export function parseElectricityMeterDetails(value: any): ElectricityMeterDetails {
  const address = [text(value?.streetName, 100), text(value?.buildingNumber, 30), text(value?.floorId, 30), text(value?.roomId, 30)].filter(Boolean).join(' ');
  const city = [text(value?.postcode, 20), text(value?.cityName, 100)].filter(Boolean).join(' ');
  return { address: [address, city].filter(Boolean).join(', ') || null, meterNumber: text(value?.meterNumber, 80), gridOperatorName: text(value?.gridOperatorName, 140), gridArea: text(value?.meteringGridAreaIdentification, 40), balanceSupplierName: text(value?.balanceSupplierName, 140), balanceSupplierStartDate: isoDate(value?.balanceSupplierStartDate), consumerStartDate: isoDate(value?.consumerStartDate), settlementMethod: text(value?.settlementMethod, 40), meterReadingOccurrence: text(value?.meterReadingOccurrence, 40), taxReduction: text(value?.taxReduction, 40) };
}

const syncQueues = new WeakMap<EnergyVault, Promise<void>>();
async function syncUsage(vault: EnergyVault, selections: Selection[]) {
  const today = usageToday();
  const connected = await hasPrivateMeterConnection(vault);
  if (!connected && !vault.data.readings.length) throw new Error('Forbind Eloverblik først, og prøv derefter igen.');
  if (!connected) return;
  const imported: typeof vault.data.readings = [];
  const fetched: NonNullable<typeof vault.data.synced_ranges> = [];
  try {
    for (const selection of selections) {
      const resolution = selection.aggregation.toLowerCase(), end = selection.to < today ? selection.to : today;
      if (selection.from >= end) continue;
      const chunk = ['Hour', 'Quarter'].includes(selection.aggregation) ? 'day' : selection.aggregation === 'Day' ? 'month' : 'year';
      for (const meter of vault.data.meters) for (let from = selection.from; from < end; from = advance(from, chunk)) {
        const to = [advance(from, chunk), end].sort()[0]!;
        const fromAt = midnight(from), toAt = midnight(to);
        const existing = vault.data.readings.filter(row => row.meter_id === meter.id && row.resolution === resolution && row.starts_at >= fromAt && row.starts_at < toAt);
        const complete = aggregateReadings(existing, [meter], from, to, resolution, today).every(point => point.kwh !== null && !point.incomplete);
        const recent = to >= new Date(Date.parse(`${today}T12:00:00Z`) - 2 * 86400000).toISOString().slice(0, 10);
        const checked = vault.data.synced_ranges?.find(range => range.meter_id === meter.id && range.resolution === resolution && range.from === from && range.to === to);
        if (complete || (checked && Date.now() - Date.parse(checked.fetched_at) < (recent ? 6 : 168) * 3600000)) continue;
        const result = await thirdPartyRequest<any>(vault, { action: 'timeseries', meteringPointId: meter.metering_point_id, from, to, aggregation: selection.aggregation });
        for (const row of meterReadings(result, meter.metering_point_id, resolution)) if (row.starts_at >= fromAt && row.starts_at < toAt) imported.push({ ...row, meter_id: meter.id, resolution });
        fetched.push({ meter_id: meter.id, resolution, from, to, fetched_at: new Date().toISOString() });
      }
    }
  } finally {
    if (fetched.length) await vault.mutate(data => {
      const rows = new Map(data.readings.map(row => [`${row.meter_id}:${row.resolution}:${row.starts_at}`, row]));
      for (const row of imported) { const key = `${row.meter_id}:${row.resolution}:${row.starts_at}`; if (row.kwh !== null || !rows.has(key)) rows.set(key, row); }
      data.readings = [...rows.values()];
      data.synced_ranges = [...new Map([...(data.synced_ranges ?? []), ...fetched].map(range => [`${range.meter_id}:${range.resolution}:${range.from}:${range.to}`, range])).values()];
      return data;
    });
  }
}
function queueSync(vault: EnergyVault, selections: Selection[]) { const pending = (syncQueues.get(vault) ?? Promise.resolve()).catch(() => {}).then(() => syncUsage(vault, selections)); syncQueues.set(vault, pending); void pending.finally(() => { if (syncQueues.get(vault) === pending) syncQueues.delete(vault); }); return pending; }
export async function privateUsageBatch(vault: EnergyVault, selections: UsageSelection[]) { await queueSync(vault, selections); return selections.map(selection => cachedPrivateUsage(vault, selection)); }
export async function privateUsage(vault: EnergyVault, selection: UsageSelection) { await queueSync(vault, [selection]); return cachedPrivateUsage(vault, selection); }
export function cachedPrivateUsage(vault: EnergyVault, selection: { from: string; to: string; aggregation: string }): ElectricityUsage {
  const resolution = selection.aggregation.toLowerCase(), today = usageToday(), data = vault.data, fromAt = midnight(selection.from), toAt = midnight(selection.to);
  const points = aggregateReadings(data.readings.filter(row => row.resolution === resolution && row.starts_at >= fromAt && row.starts_at < toAt), data.meters, selection.from, selection.to, resolution, today);
  const firstYear = data.readings.reduce((year, row) => Math.min(year, Number(row.starts_at.slice(0, 4))), Number(today.slice(0, 4)) - 5);
  return { ...selection, points, totalKwh: points.reduce((sum, point) => sum + (point.kwh ?? 0), 0), meterCount: data.meters.length, availableYears: Array.from({ length: Number(today.slice(0, 4)) - firstYear + 1 }, (_, index) => firstYear + index), incomplete: points.some(point => point.incomplete), syncFailed: false } as ElectricityUsage;
}
