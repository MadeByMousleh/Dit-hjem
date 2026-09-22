import { Platform } from 'react-native';
import { EnergyVault } from './energy-vault';
import { advance, aggregateReadings, meterReadings, midnight } from './consumption-data.mjs';
import type { ElectricityUsage, UsageSelection, BackgroundUsage } from './eloverblik';
import { usageToday } from '../utils/usagePeriods';
import { backgroundWindow, estimateBackground } from './background-usage.mjs';

// Credentials stay in memory while unlocked, never in backend requests or backup.
const tokens = new WeakMap<EnergyVault, string>();
const base = 'https://api.eloverblik.dk/customerapi/api';
async function request(path: string, token: string, body?: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'api-version': '1.0' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
    if (!response.ok) throw new Error('Eloverblik afviste forespørgslen. Kontrollér din token og prøv igen.');
    return await response.json();
  } finally { clearTimeout(timeout); }
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
  tokens.set(vault, access.result);
}
async function usage(vault: EnergyVault, selection: { from: string; to: string; aggregation: string }) {
  const resolution = selection.aggregation.toLowerCase();
  const today = usageToday();
  const token = tokens.get(vault);
  if (token && Platform.OS !== 'web') {
    const end = selection.to < today ? selection.to : today;
    const meters = vault.data.meters;
    if (selection.from < end && meters.length) {
      const imported: typeof vault.data.readings = [];
      const chunk = ['Hour','Quarter'].includes(selection.aggregation) ? 'day' : selection.aggregation === 'Day' ? 'month' : 'year';
      for (const meter of meters) for (let from = selection.from; from < end; from = advance(from, chunk)) {
        void vault.data; // Stop issuing more requests if the device locked mid-import.
        const to = [advance(from, chunk), end].sort()[0]!;
        const result = await request(`/meterdata/gettimeseries/${from}/${to}/${selection.aggregation}`, token, { meteringPoints: { meteringPoint: [meter.metering_point_id] } });
        for (const row of meterReadings(result, meter.metering_point_id, resolution)) {
          if (row.starts_at >= midnight(from) && row.starts_at < midnight(to)) imported.push({ ...row, meter_id: meter.id, resolution });
        }
      }
      await vault.mutate(data => {
        const rows = new Map(data.readings.map(row => [`${row.meter_id}:${row.resolution}:${row.starts_at}`,row]));
        for (const row of imported) {
          const key = `${row.meter_id}:${resolution}:${row.starts_at}`;
          if (row.kwh !== null || !rows.has(key)) rows.set(key, row);
        }
        data.readings = [...rows.values()]; return data;
      });
    }
  }
  const data = vault.data;
  const rows = data.readings.filter(row => row.resolution === resolution && row.starts_at >= midnight(selection.from) && row.starts_at < midnight(selection.to));
  const points = aggregateReadings(rows, data.meters, selection.from, selection.to, resolution, today);
  const firstYear = data.readings.reduce((year,row) => Math.min(year,Number(row.starts_at.slice(0,4))),Number(today.slice(0,4))-5);
  return { ...selection, points, totalKwh: points.reduce((sum: number,p: { kwh: number | null }) => sum + (p.kwh ?? 0),0), meterCount: data.meters.length, availableYears: Array.from({ length: Number(today.slice(0,4)) - firstYear + 1 },(_,i) => firstYear + i), incomplete: points.some((p: { incomplete: boolean }) => p.incomplete), syncFailed: false };
}
export async function privateUsage(vault: EnergyVault, selection: UsageSelection) { return await usage(vault, selection) as ElectricityUsage; }
export async function privateBackground(vault: EnergyVault) { return estimateBackground(await usage(vault, backgroundWindow())) as BackgroundUsage; }
