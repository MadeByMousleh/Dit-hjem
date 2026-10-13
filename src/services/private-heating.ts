import type { EnergyVault } from './energy-vault';
import { API_URL, getSupabase } from './supabase';

export const HEAT_SUPPLIER = 'Sønderborg Varme';
export type HeatReading = { from: string; to: string; kwh: number | null; expectedKwh?: number | null; heatingWaterM3: number | null; coolingC: number | null; flowC?: number | null; returnC?: number | null };
export type HeatSummary = { from: string | null; to: string | null; actualKwh: number | null; expectedYearKwh: number | null };
export type HeatCustomer = { customerNumber: string; consumerNumber: string | null; installationNumber: string | null; meterNumber: string | null; address: string | null; postalCode: string | null; city: string | null };
export type HeatHistory = { supplier: 'sonderborg-varme'; installation: string; year: string; fetchedAt: string; readings: HeatReading[]; customer?: HeatCustomer | null; summary?: HeatSummary | null; annualRequestAttempted?: boolean };
type Credentials = { username: string; password: string };
const queues = new WeakMap<EnergyVault, Promise<void>>();

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).replace(/\s/g, '');
  const number = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
  return Number.isFinite(number) ? number : null;
}
function energyFactor(unit: unknown) { const text = String(unit ?? '').trim().toLowerCase(); return text === 'kwh' ? 1 : text === 'mwh' ? 1000 : text === 'gj' ? 1 / 0.0036 : null; }
function temperature(value: unknown) { const result = numeric(value); return result !== null && result > 0 && result <= 150 ? result : null; }
function date(value: unknown) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value));
  if (!match) throw new Error('Varmeværket returnerede et ukendt datoformat.');
  const result = `${match[3]}-${match[2]}-${match[1]}`;
  if (new Date(`${result}T12:00:00Z`).toISOString().slice(0, 10) !== result) throw new Error('Ugyldig dato i varmedata.');
  return result;
}
function text(value: unknown, maxLength: number): string | null { if (typeof value !== 'string' && typeof value !== 'number') return null; const result = String(value).trim(); return result && result.length <= maxLength ? result : null; }
export function parseHeatCustomer(customerNumber: string, installation: any): HeatCustomer { return { customerNumber, consumerNumber: text(installation?.ForbrugerNr, 40), installationNumber: text(installation?.InstallationNr, 40), meterNumber: text(installation?.MålerNr, 80), address: text(installation?.Adresse, 180), postalCode: text(installation?.PostNr, 20), city: text(installation?.By, 100) }; }
export function parseHeatReadings(payload: any): HeatReading[] {
  const lines = payload?.ForbrugsLinjer?.TForbrugsLinje;
  if (!Array.isArray(lines) || !lines.length || lines.length > 2000) throw new Error('Ingen daglige varmemålinger blev returneret.');
  const unique = new Map<string, HeatReading>();
  for (const line of lines) {
    if (!Array.isArray(line.TForbrugsTaellevaerk)) throw new Error('Ukendt format for varmemålinger.');
    const energy = line.TForbrugsTaellevaerk.find((item: any) => item.IndexNavn === 'ENG1'), factor = energyFactor(energy?.Enhed_Txt);
    if (energy && factor === null) throw new Error('Varmeværkets energienhed understøttes ikke endnu.');
    const value = numeric(energy?.Forbrug), expected = numeric(line.ForventetForbrugENG1), water = numeric(line.TForbrugsTaellevaerk.find((item: any) => item.IndexNavn === 'M3')?.Forbrug), cooling = numeric(line.Afkoling);
    const from = date(line.FraDatoStr), to = date(line.TilDatoStr);
    if (to < from) throw new Error('Ugyldig måleperiode fra varmeværket.');
    const row: HeatReading = { from, to, kwh: value !== null && value >= 0 && factor !== null ? value * factor : null, expectedKwh: expected !== null && expected >= 0 && factor !== null ? expected * factor : null, heatingWaterM3: water !== null && water >= 0 ? water : null, coolingC: cooling !== null && Math.abs(cooling) <= 150 ? cooling : null, flowC: temperature(line.Tempfrem), returnC: temperature(line.TempRetur) };
    const id = `${from}/${to}`, previous = unique.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error('Modstridende varmemålinger.');
    unique.set(id, row);
  }
  const rows = [...unique.values()].sort((a, b) => a.from.localeCompare(b.from));
  if (!rows.some(row => row.kwh !== null)) throw new Error('Ingen varmeforbrug fundet på denne installation.');
  return rows;
}
export function parseHeatSummary(payload: any): HeatSummary | null {
  const line = payload?.IaltLinje;
  if (!line || typeof line !== 'object') return null;
  const energy = Array.isArray(line.TForbrugsTaellevaerk) ? line.TForbrugsTaellevaerk.find((item: any) => item?.IndexNavn === 'ENG1') : null;
  const factor = energyFactor(energy?.Enhed_Txt), actual = numeric(energy?.Forbrug), expected = numeric(line.ForventetForbrugENG1);
  const optionalDate = (value: unknown) => { try { return date(value); } catch { return null; } };
  return { from: optionalDate(line.FraDatoStr), to: optionalDate(line.TilDatoStr), actualKwh: factor !== null && actual !== null && actual >= 0 ? actual * factor : null, expectedYearKwh: factor !== null && expected !== null && expected >= 0 ? expected * factor : null };
}
export function needsHeatingEnrichment(history: HeatHistory | undefined): boolean { return !!history && history.annualRequestAttempted !== true; }

async function heatingRequest(vault: EnergyVault, body: Record<string, unknown>) {
  const client = await getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Log ind igen for at forbinde varme.');
  const response = await fetch(`${API_URL}/api/energy/vault`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ operation: 'heating', householdId: vault.householdId, ...body }) });
  const result = await response.json() as { error?: string; connected?: boolean; history?: HeatHistory };
  if (!response.ok) throw new Error(result.error ?? 'Varmeforbindelsen kunne ikke gennemføres.');
  return result;
}
async function saveHistory(vault: EnergyVault, history: HeatHistory) {
  await vault.mutate(data => {
    const histories = data.heating ?? [], existing = histories.find(item => item.installation === history.installation && item.year === history.year && item.supplier === history.supplier);
    const rows = new Map((existing?.readings ?? []).map(row => [`${row.from}/${row.to}`, row]));
    for (const row of history.readings) rows.set(`${row.from}/${row.to}`, row);
    history.readings = [...rows.values()].sort((a, b) => a.from.localeCompare(b.from));
    data.heating = [...histories.filter(item => item !== existing), history];
    return data;
  });
}
export async function hasPrivateHeatingConnection(vault: EnergyVault) { return Boolean((await heatingRequest(vault, { action: 'status' })).connected); }
export async function syncHeating(vault: EnergyVault, credentials?: Credentials, force = false) {
  const existing = queues.get(vault);
  if (existing) return existing;
  const pending = (async () => {
    if (!credentials) {
      const latest = vault.data.heating?.reduce<HeatHistory | undefined>((last, item) => !last || item.fetchedAt > last.fetchedAt ? item : last, undefined);
      if (!force && latest && !needsHeatingEnrichment(latest) && Date.now() - Date.parse(latest.fetchedAt) < 6 * 3600000) return;
    }
    const result = await heatingRequest(vault, credentials ? { action: 'connect', ...credentials } : { action: 'sync' });
    if (!result.history) throw new Error('Varmeforbindelsen returnerede ingen målinger.');
    await saveHistory(vault, result.history);
  })();
  queues.set(vault, pending);
  try { await pending; } finally { if (queues.get(vault) === pending) queues.delete(vault); }
}
