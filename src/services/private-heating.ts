import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { EnergyVault } from './energy-vault';

// Public configuration from eforsyning.dk/sonderborg-varme/, verified 2026-09-26.
// Protocol reference: kpoppel/homeassistant-eforsyning (pyeforsyning).
const API = 'https://apiapp.dff-edb.dk/sdbg/';
export const HEAT_SUPPLIER = 'Sønderborg Varme';
export type HeatReading = { from: string; to: string; kwh: number | null; expectedKwh?: number | null; heatingWaterM3: number | null; coolingC: number | null; flowC?: number | null; returnC?: number | null };
export type HeatSummary = { from: string | null; to: string | null; actualKwh: number | null; expectedYearKwh: number | null };
export type HeatCustomer = { customerNumber: string; consumerNumber: string | null; installationNumber: string | null; meterNumber: string | null; address: string | null; postalCode: string | null; city: string | null };
export type HeatHistory = { supplier: 'sonderborg-varme'; installation: string; year: string; fetchedAt: string; readings: HeatReading[]; customer?: HeatCustomer | null; summary?: HeatSummary | null; annualRequestAttempted?: boolean };
type Credentials = { username: string; password: string };
const key = (vault: EnergyVault) => `stromblik.heating.${vault.userId}.${vault.householdId}`;
const queues = new WeakMap<EnergyVault, Promise<void>>();

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).replace(/\s/g, '');
  const number = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
  return Number.isFinite(number) ? number : null;
}
function energyFactor(unit: unknown) {
  const text = String(unit ?? '').trim().toLowerCase();
  return text === 'kwh' ? 1 : text === 'mwh' ? 1000 : text === 'gj' ? 1 / 0.0036 : null;
}
function temperature(value: unknown) {
  const result = numeric(value);
  return result !== null && result > 0 && result <= 150 ? result : null;
}
function date(value: unknown) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value));
  if (!match) throw new Error('Varmeværket returnerede et ukendt datoformat.');
  const result = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(result + 'T12:00:00Z');
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== result) throw new Error('Ugyldig dato i varmedata.');
  return result;
}
function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = String(value).trim();
  return result && result.length <= maxLength ? result : null;
}
export function parseHeatCustomer(customerNumber: string, installation: any): HeatCustomer {
  return {
    customerNumber,
    consumerNumber: text(installation?.ForbrugerNr, 40),
    installationNumber: text(installation?.InstallationNr, 40),
    meterNumber: text(installation?.MålerNr, 80),
    address: text(installation?.Adresse, 180),
    postalCode: text(installation?.PostNr, 20),
    city: text(installation?.By, 100),
  };
}
export function parseHeatReadings(payload: any): HeatReading[] {
  const lines = payload?.ForbrugsLinjer?.TForbrugsLinje;
  if (!Array.isArray(lines) || !lines.length || lines.length > 2000) throw new Error('Ingen daglige varmemålinger blev returneret.');
  const unique = new Map<string, HeatReading>();
  for (const line of lines) {
    if (!Array.isArray(line.TForbrugsTaellevaerk)) throw new Error('Ukendt format for varmemålinger.');
    const energy = line.TForbrugsTaellevaerk.find((item: any) => item.IndexNavn === 'ENG1');
    const factor = energyFactor(energy?.Enhed_Txt);
    if (energy && factor === null) throw new Error('Varmeværkets energienhed understøttes ikke endnu.');
    const value = numeric(energy?.Forbrug);
    // Period consumption, not the cumulative ForventetAflaesningENG1 meter reading.
    const expected = numeric(line.ForventetForbrugENG1);
    const water = numeric(line.TForbrugsTaellevaerk.find((item: any) => item.IndexNavn === 'M3')?.Forbrug);
    const cooling = numeric(line.Afkoling);
    const reading = { from: date(line.FraDatoStr), to: date(line.TilDatoStr), kwh: value !== null && value >= 0 && factor !== null ? value * factor : null, heatingWaterM3: water !== null && water >= 0 ? water : null, coolingC: cooling !== null && Math.abs(cooling) <= 150 ? cooling : null };
    const withExpected: HeatReading = { ...reading, expectedKwh: expected !== null && expected >= 0 && factor !== null ? expected * factor : null,
      flowC: temperature(line.Tempfrem), returnC: temperature(line.TempRetur) };
    if (reading.to < reading.from) throw new Error('Ugyldig måleperiode fra varmeværket.');
    const id = `${reading.from}/${reading.to}`;
    const previous = unique.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(withExpected)) throw new Error('Modstridende varmemålinger.');
    unique.set(id, withExpected);
  }
  const readings = [...unique.values()].sort((a,b) => a.from.localeCompare(b.from));
  if (!readings.some(row => row.kwh !== null)) throw new Error('Ingen varmeforbrug fundet på denne installation.');
  return readings;
}

export function parseHeatSummary(payload: any): HeatSummary | null {
  const line = payload?.IaltLinje;
  if (!line || typeof line !== 'object') return null;
  const energy = Array.isArray(line.TForbrugsTaellevaerk)
    ? line.TForbrugsTaellevaerk.find((item: any) => item?.IndexNavn === 'ENG1') : null;
  const factor = energyFactor(energy?.Enhed_Txt);
  const actual = numeric(energy?.Forbrug);
  const expected = numeric(line.ForventetForbrugENG1);
  const optionalDate = (value: unknown) => { try { return date(value); } catch { return null; } };
  return {
    from: optionalDate(line.FraDatoStr), to: optionalDate(line.TilDatoStr),
    actualKwh: factor !== null && actual !== null && actual >= 0 ? actual * factor : null,
    expectedYearKwh: factor !== null && expected !== null && expected >= 0 ? expected * factor : null,
  };
}

// Older encrypted snapshots did not make the separate yearly request. Its
// attempt marker prevents a retry loop when the provider has no annual total.
export function needsHeatingEnrichment(history: HeatHistory | undefined): boolean {
  return !!history && history.annualRequestAttempted !== true;
}

async function importHeating(vault: EnergyVault, credentials: Credentials) {
  if (Platform.OS === 'web') throw new Error('Forbind varme i mobilappen. Browseren viser gemt historik.');
  const username = credentials.username.trim();
  if (!/^\d{1,30}$/.test(username) || !credentials.password || credentials.password.length > 512) throw new Error('Indtast kundenummer og kode fra regningen.');
  const session = Crypto.randomUUID().slice(0,8).toUpperCase();
  async function request(path: string, body?: object, method = body ? 'POST' : 'GET') {
    void vault.data;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(API + path, { method, redirect: 'error', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Session-ID': session, 'X-Correlation-ID': Crypto.randomUUID().slice(0,8).toUpperCase() }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      void vault.data;
      return result;
    } catch { throw new Error('Sønderborg Varme kunne ikke kontaktes. Kontrollér forbindelsen og dine loginoplysninger.'); }
    finally { clearTimeout(timer); }
  }
  const challenge = await request(`system/getsecuritytoken/project/app/consumer/${username}`);
  if (typeof challenge.Token !== 'string' || !challenge.Token) throw new Error('Kundenummeret blev ikke godkendt.');
  // MD5 is mandated by this legacy upstream challenge protocol, not used for storage.
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, credentials.password);
  const token = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, digest + challenge.Token);
  const login = await request(`system/login/project/app/consumer/${username}/installation/1/id/${token}`);
  if (login.Result !== 1) throw new Error('Kundenummer eller kode blev afvist.');
  const user = await request(`api/getebrugerinfo?id=${token}`);
  if (user.id === undefined || user.id === null) throw new Error('Kontoen kunne ikke identificeres.');
  const result = await request(`api/FindInstallationer?id=${token}`, { Soegetekst: '', Skip: '0', Take: '100', EBrugerId: String(user.id), Huskeliste: 'null', MedtagTilknyttede: 'true' });
  if (!Array.isArray(result.Installationer) || result.Installationer.length !== 1) throw new Error('Denne første version kræver præcis én varmeinstallation på kontoen.');
  const installation = result.Installationer[0];
  const asset = String(installation.AktivNr), meter = String(installation.InstallationNr);
  if (!/^\d+$/.test(asset) || !/^\d+$/.test(meter)) throw new Error('Ukendt varmeinstallation.');
  const year = await request(`api/getaktuelaarsmaerke?id=${token}`, undefined, 'POST');
  if (!/^\d{4}$/.test(String(year.aarsmaerke))) throw new Error('Afregningsåret kunne ikke hentes.');
  const consumptionPath = `api/getforbrug?id=${token}&unr=${username}&anr=${asset}&inr=${meter}`;
  const commonBody = {
    Ejendomnr: username, AktivNr: asset, I_Nr: meter, AarsMaerke: String(year.aarsmaerke),
    ForbrugsAfgraensning_FraDato: '0', ForbrugsAfgraensning_TilDato: '0', ForbrugsAfgraensning_FraAflaesning: '0', ForbrugsAfgraensning_TilAflaesning: '2',
    Optioner: 'foBestemtBeboer, foSkabDetaljer, foMedtagWebAflaes', AHoejDetail: 'false',
    AflaesningsFilterDag: 'ULTIMO', SletFiltreredeAflaesninger: 'true', MedForventetForbrug: 'true', OmregnForbrugTilAktuelleEnhed: 'true',
  };
  const payload = await request(consumptionPath, {
    ...commonBody, ForbrugsAfgraensning_MedtagMellemliggendeMellemaflas: 'true',
    Aflaesningsfilter: 'afDagsvis', AflaesningsUdjaevning: 'true',
  });
  const readings = parseHeatReadings(payload);
  // eForsyning includes IaltLinje (billing-year actual and expected totals) in
  // the monthly/year request, not reliably in the daily request.
  let summary = parseHeatSummary(payload);
  try {
    const annual = await request(consumptionPath, {
      ...commonBody, ForbrugsAfgraensning_MedtagMellemliggendeMellemaflas: 'false',
      Aflaesningsfilter: 'afMaanedsvis', AflaesningsUdjaevning: 'false',
    });
    summary = parseHeatSummary(annual) ?? summary;
  } catch {
    // Keep valid daily readings even if the optional annual request fails.
    // The UI will leave provider totals blank and offer an explicit retry.
  }
  const history: HeatHistory = { supplier: 'sonderborg-varme', installation: `${username}/${asset}/${meter}`, year: String(year.aarsmaerke), fetchedAt: new Date().toISOString(), readings, customer: parseHeatCustomer(username, installation), summary, annualRequestAttempted: true };
  await vault.mutate(data => {
    const histories = data.heating ?? [];
    const existing = histories.find(item => item.installation === history.installation && item.year === history.year && item.supplier === history.supplier);
    const rows = new Map((existing?.readings ?? []).map(row => [`${row.from}/${row.to}`, row]));
    for (const row of history.readings) rows.set(`${row.from}/${row.to}`, row);
    history.readings = [...rows.values()].sort((a,b) => a.from.localeCompare(b.from));
    data.heating = [...histories.filter(item => item !== existing), history];
    return data;
  });
  void vault.data;
  try {
    await SecureStore.setItemAsync(key(vault), JSON.stringify({ username, password: credentials.password }), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch { throw new Error('Historikken er gemt, men login kunne ikke gemmes sikkert. Forbind igen ved næste opdatering.'); }
}
export async function syncHeating(vault: EnergyVault, credentials?: Credentials, force = false) {
  const existing = queues.get(vault);
  if (existing) return existing;
  const pending = (async () => {
    if (!credentials) {
      if (Platform.OS === 'web') return;
      const latestHistory = vault.data.heating?.reduce<HeatHistory | undefined>((last, item) => !last || item.fetchedAt > last.fetchedAt ? item : last, undefined);
      if (!force && latestHistory && !needsHeatingEnrichment(latestHistory) && Date.now() - Date.parse(latestHistory.fetchedAt) < 6 * 3600000) return;
      const stored = await SecureStore.getItemAsync(key(vault));
      void vault.data;
      if (!stored) {
        if (force) throw new Error('Forbind varme igen på denne telefon for at hente nye målinger.');
        return;
      }
      credentials = JSON.parse(stored) as Credentials;
    }
    await importHeating(vault, credentials);
  })();
  queues.set(vault, pending);
  try { await pending; } finally { if (queues.get(vault) === pending) queues.delete(vault); }
}
