import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createSupabaseContext } from '@supabase/server';

const API = 'https://apiapp.dff-edb.dk/sdbg/';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const aad = (householdId, userId) => Buffer.from(`stromblik-heating-credentials-v1\n${householdId}\n${userId}\nsonderborg-varme`, 'utf8');

export class HeatingConnectionError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function credentialKey(env = process.env) {
  let key = Buffer.alloc(0);
  try { key = Buffer.from(String(env.EFORSYNING_CREDENTIALS_KEK ?? '').trim(), 'base64url'); } catch { /* validation below */ }
  if (key.length !== 32) throw new HeatingConnectionError(503, 'Sikker varmelagring er ikke konfigureret.');
  return key;
}

function validateCredentials(value) {
  const username = String(value?.username ?? '').trim();
  const password = typeof value?.password === 'string' ? value.password : '';
  if (!/^\d{1,30}$/.test(username) || !password || password.length > 512) throw new HeatingConnectionError(400, 'Indtast kundenummer og kode fra regningen.');
  return { username, password };
}

export function encryptHeatingCredentials(credentials, householdId, userId, env = process.env) {
  const plain = validateCredentials(credentials);
  if (!uuid(householdId) || !uuid(userId)) throw new HeatingConnectionError(400, 'Ugyldig varmeforbindelse.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', credentialKey(env), iv);
  cipher.setAAD(aad(householdId, userId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') };
}

export function decryptHeatingCredentials(envelope, householdId, userId, env = process.env) {
  try {
    if (!uuid(householdId) || !uuid(userId) || !envelope || envelope.version !== 1) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', credentialKey(env), Buffer.from(envelope.iv, 'base64url'));
    decipher.setAAD(aad(householdId, userId));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
    return validateCredentials(JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64url')), decipher.final()]).toString('utf8')));
  } catch (error) {
    if (error instanceof HeatingConnectionError) throw error;
    throw new HeatingConnectionError(503, 'Den gemte varmeforbindelse kunne ikke åbnes. Forbind varme igen.');
  }
}

async function contextFor(request, contextFactory = createSupabaseContext) {
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) throw new HeatingConnectionError(401, 'Log ind igen for at forbinde varme.');
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!projectUrl) throw new HeatingConnectionError(503, 'Varmeløsningen er ikke konfigureret.');
  const { data, error } = await contextFactory(request, { auth: 'user', audience: 'authenticated', issuer: `${projectUrl}/auth/v1` });
  if (error || !data?.userClaims?.id) throw new HeatingConnectionError(401, 'Din session er udløbet. Log ind igen.');
  return data;
}

async function requireMembership(ctx, householdId) {
  if (!uuid(householdId)) throw new HeatingConnectionError(400, 'Vælg en gyldig husstand.');
  const { data, error } = await ctx.supabase.from('household_members').select('household_id').eq('household_id', householdId).eq('user_id', ctx.userClaims.id).maybeSingle();
  if (error) throw new HeatingConnectionError(503, 'Adgang kunne ikke kontrolleres.');
  if (!data) throw new HeatingConnectionError(403, 'Du har ikke adgang til denne husstand.');
}

function numeric(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).replace(/\s/g, '');
  const number = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
  return Number.isFinite(number) ? number : null;
}
function factor(unit) { const text = String(unit ?? '').trim().toLowerCase(); return text === 'kwh' ? 1 : text === 'mwh' ? 1000 : text === 'gj' ? 1 / 0.0036 : null; }
function date(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value));
  if (!match) throw new HeatingConnectionError(502, 'Varmeværket returnerede et ukendt datoformat.');
  const result = `${match[3]}-${match[2]}-${match[1]}`;
  if (new Date(`${result}T12:00:00Z`).toISOString().slice(0, 10) !== result) throw new HeatingConnectionError(502, 'Varmeværket returnerede en ugyldig dato.');
  return result;
}
function text(value, maxLength) { if (typeof value !== 'string' && typeof value !== 'number') return null; const result = String(value).trim(); return result && result.length <= maxLength ? result : null; }
function readings(payload) {
  const lines = payload?.ForbrugsLinjer?.TForbrugsLinje;
  if (!Array.isArray(lines) || !lines.length || lines.length > 2000) throw new HeatingConnectionError(502, 'Ingen daglige varmemålinger blev returneret.');
  const unique = new Map();
  for (const line of lines) {
    if (!Array.isArray(line.TForbrugsTaellevaerk)) throw new HeatingConnectionError(502, 'Ukendt format for varmemålinger.');
    const energy = line.TForbrugsTaellevaerk.find(item => item.IndexNavn === 'ENG1');
    const unitFactor = factor(energy?.Enhed_Txt);
    if (energy && unitFactor === null) throw new HeatingConnectionError(502, 'Varmeværkets energienhed understøttes ikke endnu.');
    const value = numeric(energy?.Forbrug), expected = numeric(line.ForventetForbrugENG1), water = numeric(line.TForbrugsTaellevaerk.find(item => item.IndexNavn === 'M3')?.Forbrug), cooling = numeric(line.Afkoling);
    const from = date(line.FraDatoStr), to = date(line.TilDatoStr);
    if (to < from) throw new HeatingConnectionError(502, 'Ugyldig måleperiode fra varmeværket.');
    const temperature = value => { const number = numeric(value); return number !== null && number > 0 && number <= 150 ? number : null; };
    const row = { from, to, kwh: value !== null && value >= 0 && unitFactor !== null ? value * unitFactor : null, expectedKwh: expected !== null && expected >= 0 && unitFactor !== null ? expected * unitFactor : null, heatingWaterM3: water !== null && water >= 0 ? water : null, coolingC: cooling !== null && Math.abs(cooling) <= 150 ? cooling : null, flowC: temperature(line.Tempfrem), returnC: temperature(line.TempRetur) };
    const id = `${from}/${to}`, previous = unique.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new HeatingConnectionError(502, 'Modstridende varmemålinger.');
    unique.set(id, row);
  }
  const result = [...unique.values()].sort((a, b) => a.from.localeCompare(b.from));
  if (!result.some(row => row.kwh !== null)) throw new HeatingConnectionError(502, 'Ingen varmeforbrug fundet på denne installation.');
  return result;
}
function summary(payload) {
  const line = payload?.IaltLinje, energy = Array.isArray(line?.TForbrugsTaellevaerk) ? line.TForbrugsTaellevaerk.find(item => item?.IndexNavn === 'ENG1') : null;
  if (!line || !energy) return null;
  const unitFactor = factor(energy.Enhed_Txt), actual = numeric(energy.Forbrug), expected = numeric(line.ForventetForbrugENG1);
  const maybeDate = value => { try { return date(value); } catch { return null; } };
  return { from: maybeDate(line.FraDatoStr), to: maybeDate(line.TilDatoStr), actualKwh: unitFactor !== null && actual !== null && actual >= 0 ? actual * unitFactor : null, expectedYearKwh: unitFactor !== null && expected !== null && expected >= 0 ? expected * unitFactor : null };
}

async function fetchHeating(credentials, fetcher = fetch) {
  const session = randomUUID().slice(0, 8).toUpperCase();
  const request = async (path, body, method = body ? 'POST' : 'GET') => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(`${API}${path}`, { method, redirect: 'error', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Session-ID': session, 'X-Correlation-ID': randomUUID().slice(0, 8).toUpperCase() }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
      let result; try { result = await response.json(); } catch { result = null; }
      if (!response.ok) throw new HeatingConnectionError(response.status === 401 || response.status === 403 ? 401 : 502, 'Sønderborg Varme kunne ikke godkende forbindelsen. Kontrollér kundenummer og kode.');
      return result;
    } catch (error) {
      if (error instanceof HeatingConnectionError) throw error;
      throw new HeatingConnectionError(502, 'Sønderborg Varme kunne ikke kontaktes. Prøv igen senere.');
    } finally { clearTimeout(timer); }
  };
  const challenge = await request(`system/getsecuritytoken/project/app/consumer/${encodeURIComponent(credentials.username)}`);
  if (typeof challenge?.Token !== 'string' || !challenge.Token) throw new HeatingConnectionError(401, 'Kundenummeret blev ikke godkendt.');
  const digest = createHash('md5').update(credentials.password).digest('hex');
  const token = createHash('md5').update(`${digest}${challenge.Token}`).digest('hex');
  const login = await request(`system/login/project/app/consumer/${encodeURIComponent(credentials.username)}/installation/1/id/${token}`);
  if (login?.Result !== 1) throw new HeatingConnectionError(401, 'Kundenummer eller kode blev afvist.');
  const user = await request(`api/getebrugerinfo?id=${encodeURIComponent(token)}`);
  const installations = await request(`api/FindInstallationer?id=${encodeURIComponent(token)}`, { Soegetekst: '', Skip: '0', Take: '100', EBrugerId: String(user?.id ?? ''), Huskeliste: 'null', MedtagTilknyttede: 'true' });
  if (!Array.isArray(installations?.Installationer) || installations.Installationer.length !== 1) throw new HeatingConnectionError(409, 'Denne konto skal have præcis én varmeinstallation.');
  const installation = installations.Installationer[0], asset = String(installation.AktivNr), meter = String(installation.InstallationNr);
  if (!/^\d+$/.test(asset) || !/^\d+$/.test(meter)) throw new HeatingConnectionError(502, 'Ukendt varmeinstallation.');
  const year = await request(`api/getaktuelaarsmaerke?id=${encodeURIComponent(token)}`, undefined, 'POST');
  if (!/^\d{4}$/.test(String(year?.aarsmaerke))) throw new HeatingConnectionError(502, 'Afregningsåret kunne ikke hentes.');
  const common = { Ejendomnr: credentials.username, AktivNr: asset, I_Nr: meter, AarsMaerke: String(year.aarsmaerke), ForbrugsAfgraensning_FraDato: '0', ForbrugsAfgraensning_TilDato: '0', ForbrugsAfgraensning_FraAflaesning: '0', ForbrugsAfgraensning_TilAflaesning: '2', Optioner: 'foBestemtBeboer, foSkabDetaljer, foMedtagWebAflaes', AHoejDetail: 'false', AflaesningsFilterDag: 'ULTIMO', SletFiltreredeAflaesninger: 'true', MedForventetForbrug: 'true', OmregnForbrugTilAktuelleEnhed: 'true' };
  const path = `api/getforbrug?id=${encodeURIComponent(token)}&unr=${encodeURIComponent(credentials.username)}&anr=${encodeURIComponent(asset)}&inr=${encodeURIComponent(meter)}`;
  const daily = await request(path, { ...common, ForbrugsAfgraensning_MedtagMellemliggendeMellemaflas: 'true', Aflaesningsfilter: 'afDagsvis', AflaesningsUdjaevning: 'true' });
  let annual = null;
  try { annual = await request(path, { ...common, ForbrugsAfgraensning_MedtagMellemliggendeMellemaflas: 'false', Aflaesningsfilter: 'afMaanedsvis', AflaesningsUdjaevning: 'false' }); } catch { /* Daily readings are still valid. */ }
  return { supplier: 'sonderborg-varme', installation: `${credentials.username}/${asset}/${meter}`, year: String(year.aarsmaerke), fetchedAt: new Date().toISOString(), readings: readings(daily), customer: { customerNumber: credentials.username, consumerNumber: text(installation.ForbrugerNr, 40), installationNumber: text(installation.InstallationNr, 40), meterNumber: text(installation.MålerNr, 80), address: text(installation.Adresse, 180), postalCode: text(installation.PostNr, 20), city: text(installation.By, 100) }, summary: summary(annual) ?? summary(daily), annualRequestAttempted: true };
}

async function savedCredentials(ctx, householdId, env) {
  const { data, error } = await ctx.supabaseAdmin.from('heating_connections').select('credentials_envelope').eq('household_id', householdId).eq('user_id', ctx.userClaims.id).maybeSingle();
  if (error) throw new HeatingConnectionError(503, 'Varmeforbindelsen kunne ikke læses.');
  if (!data) throw new HeatingConnectionError(409, 'Forbind varme først.');
  return decryptHeatingCredentials(data.credentials_envelope, householdId, ctx.userClaims.id, env);
}

function resultError(error, fallback) { return { status: error instanceof HeatingConnectionError ? error.status : 503, body: { error: error instanceof HeatingConnectionError ? error.message : fallback } }; }

export async function heatingConnectionResponse(request, body, dependencies = {}) {
  try {
    const ctx = await contextFor(request, dependencies.contextFactory), householdId = body?.householdId, env = dependencies.env ?? process.env;
    await requireMembership(ctx, householdId);
    if (body?.action === 'status') {
      const { data, error } = await ctx.supabaseAdmin.from('heating_connections').select('household_id').eq('household_id', householdId).eq('user_id', ctx.userClaims.id).maybeSingle();
      if (error) throw new HeatingConnectionError(503, 'Varmeforbindelsen kunne ikke læses.');
      return { status: 200, body: { connected: !!data } };
    }
    if (body?.action === 'disconnect') {
      const { error } = await ctx.supabaseAdmin.from('heating_connections').delete().eq('household_id', householdId).eq('user_id', ctx.userClaims.id);
      if (error) throw new HeatingConnectionError(503, 'Varmeforbindelsen kunne ikke fjernes.');
      return { status: 200, body: { connected: false } };
    }
    const credentials = body?.action === 'connect' ? validateCredentials(body) : await savedCredentials(ctx, householdId, env);
    const history = await fetchHeating(credentials, dependencies.fetcher);
    if (body?.action === 'connect') {
      const { error } = await ctx.supabaseAdmin.from('heating_connections').upsert({ household_id: householdId, user_id: ctx.userClaims.id, provider: 'sonderborg-varme', credentials_envelope: encryptHeatingCredentials(credentials, householdId, ctx.userClaims.id, env), last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'household_id,user_id' });
      if (error) throw new HeatingConnectionError(503, 'Varmeforbindelsen kunne ikke gemmes.');
    } else {
      const { error } = await ctx.supabaseAdmin.from('heating_connections').update({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('household_id', householdId).eq('user_id', ctx.userClaims.id);
      if (error) throw new HeatingConnectionError(503, 'Varmeforbindelsen kunne ikke opdateres.');
    }
    return { status: 200, body: { connected: true, history } };
  } catch (error) { return resultError(error, 'Varmeforbindelsen kunne ikke gennemføres.'); }
}
