import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { createSupabaseContext } from '@supabase/server';
import { createAdminClient } from '@supabase/server/core';

const authBase = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3';
const tokenUrl = `${authBase}/token`;
const apiBase = 'https://fleet-api.prd.eu.vn.cloud.tesla.com';
const nativeReturnUrl = 'stromblik://tesla/connected';

export class TeslaError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function config(env = process.env) {
  const clientId = String(env.TESLA_CLIENT_ID ?? '').trim();
  const clientSecret = String(env.TESLA_CLIENT_SECRET ?? '').trim();
  const domain = String(env.TESLA_APP_DOMAIN ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!clientId || !clientSecret || !domain) throw new TeslaError(503, 'Tesla-login er ikke konfigureret.');
  return { clientId, clientSecret, domain, redirectUri: env.TESLA_REDIRECT_URI ?? `https://${domain}/callback` };
}

function commandProxyConfig(env = process.env) {
  const sharedSecret = String(env.TESLA_COMMAND_PROXY_SHARED_SECRET ?? '').trim();
  const rawUrl = String(env.TESLA_COMMAND_PROXY_URL ?? '').trim();
  if (!rawUrl || !sharedSecret) throw new TeslaError(503, 'Tesla Command Proxy er ikke konfigureret.');
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error();
    return { baseUrl: url.toString().replace(/\/$/, ''), sharedSecret };
  } catch { throw new TeslaError(503, 'Tesla Command Proxy-adressen er ugyldig.'); }
}

function tokenKey(secret) { return createHash('sha256').update(secret).digest(); }

export function encryptTeslaTokens(tokens, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.');
}

export function decryptTeslaTokens(ciphertext, secret) {
  try {
    const [iv, tag, encrypted] = String(ciphertext ?? '').split('.').map(value => Buffer.from(value, 'base64url'));
    if (!iv || !tag || !encrypted) return undefined;
    const decipher = createDecipheriv('aes-256-gcm', tokenKey(secret), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
  } catch { return undefined; }
}

function signedState(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`;
}

function readState(value, secret) {
  const [encoded, signature] = String(value ?? '').split('.');
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!encoded || !signature || signature.length !== expected.length || !Buffer.from(signature).equals(Buffer.from(expected))) throw new TeslaError(400, 'Tesla-login kunne ikke valideres.');
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.userId || !payload?.expiresAt || Number(payload.expiresAt) <= Date.now() || !['web', 'native'].includes(payload.returnTo)) throw new Error();
    return payload;
  } catch { throw new TeslaError(400, 'Tesla-login kunne ikke valideres.'); }
}

async function userContext(request, contextFactory = createSupabaseContext) {
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) throw new TeslaError(401, 'Log ind for at forbinde din Tesla.');
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!projectUrl) throw new TeslaError(503, 'Tesla-login er ikke konfigureret.');
  const { data, error } = await contextFactory(request, { auth: 'user', audience: 'authenticated', issuer: `${projectUrl}/auth/v1` });
  if (error || !data?.userClaims?.id) throw new TeslaError(401, 'Din session er udløbet. Log ind igen.');
  return data;
}

function toTeslaVehicle(vehicle, data) {
  const numberOrNull = value => Number.isFinite(value) ? Number(value) : null;
  const km = value => Number.isFinite(value) ? Number(value) * 1.609344 : null;
  const code = String(data.vehicle_config?.car_type ?? '').toLowerCase();
  const models = { model3: 'Model 3', model_3: 'Model 3', models: 'Model S', model_s: 'Model S', modelx: 'Model X', model_x: 'Model X', modely: 'Model Y', model_y: 'Model Y' };
  const charge = data.charge_state ?? {}, config = data.vehicle_config ?? {}, state = data.vehicle_state ?? {}, climate = data.climate_state ?? {}, drive = data.drive_state ?? {};
  return {
    id: String(vehicle.id ?? vehicle.vin), vin: vehicle.vin, name: vehicle.display_name ?? 'Tesla', model: models[code] ?? vehicle.display_name ?? 'Tesla', trim: config.trim_badging ?? null,
    exteriorColor: config.exterior_color ?? null, wheelType: config.wheel_type ?? null, spoilerType: config.spoiler_type ?? null, carVersion: state.car_version ?? null,
    batteryLevel: numberOrNull(charge.battery_level), batteryRangeKm: km(charge.battery_range), estimatedBatteryRangeKm: km(charge.est_battery_range), chargeLimitSoc: numberOrNull(charge.charge_limit_soc),
    chargingState: charge.charging_state ?? null, chargePortDoorOpen: typeof charge.charge_port_door_open === 'boolean' ? charge.charge_port_door_open : null, isPreconditioning: typeof climate.is_preconditioning === 'boolean' ? climate.is_preconditioning : null,
    chargerPowerKw: numberOrNull(charge.charger_power), chargerVoltage: numberOrNull(charge.charger_voltage), chargerActualCurrentA: numberOrNull(charge.charger_actual_current), timeToFullChargeHours: numberOrNull(charge.time_to_full_charge), chargeEnergyAddedKwh: numberOrNull(charge.charge_energy_added),
    odometerKm: km(state.odometer), locked: typeof state.locked === 'boolean' ? state.locked : null, sentryMode: typeof state.sentry_mode === 'boolean' ? state.sentry_mode : null,
    insideTempC: numberOrNull(climate.inside_temp), outsideTempC: numberOrNull(climate.outside_temp), latitude: numberOrNull(drive.latitude), longitude: numberOrNull(drive.longitude), speedKmh: km(drive.speed), shiftState: drive.shift_state ?? null, fetchedAt: new Date().toISOString(),
  };
}

async function connectionForUser(ctx, secret) {
  const { data, error } = await ctx.supabaseAdmin.from('tesla_connections').select('tokens_ciphertext,expires_at').eq('user_id', ctx.userClaims.id).maybeSingle();
  if (error) throw new TeslaError(503, 'Tesla-forbindelsen kunne ikke læses.');
  const tokens = decryptTeslaTokens(data?.tokens_ciphertext, secret);
  if (!tokens?.accessToken) throw new TeslaError(401, 'Tesla-login kræves.');
  return { data, tokens };
}

function teslaMessage(payload, fallback) {
  const value = [payload?.response?.reason, payload?.response?.error, payload?.error, payload?.message].find(item => typeof item === 'string' && item.trim());
  return String(value ?? fallback).replace(/[\r\n]+/g, ' ').slice(0, 500);
}

async function recordTeslaCommand(ctx, { vin, action, outcome, teslaStatus, message }) {
  if (!ctx?.supabaseAdmin || !vin || !['start', 'stop'].includes(action)) return;
  await ctx.supabaseAdmin.from('tesla_command_logs').insert({
    user_id: ctx.userClaims.id,
    vehicle_vin_suffix: vin.slice(-6),
    action,
    outcome,
    tesla_status: teslaStatus ?? null,
    message: String(message).replace(/[\r\n]+/g, ' ').slice(0, 500),
  });
}

async function freshTokens(ctx, connection, cfg, fetcher = fetch) {
  if (Number(connection.tokens.expiresAt) > Date.now() + 60000) return connection.tokens;
  if (!connection.tokens.refreshToken) throw new TeslaError(401, 'Tesla-login er udløbet. Forbind igen.');
  const response = await fetcher(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: connection.tokens.refreshToken, audience: apiBase }) });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new TeslaError(401, 'Tesla-login er udløbet. Forbind igen.');
  const tokens = { accessToken: payload.access_token, refreshToken: payload.refresh_token ?? connection.tokens.refreshToken, expiresAt: Date.now() + Number(payload.expires_in ?? 3600) * 1000 };
  const update = await ctx.supabaseAdmin.from('tesla_connections').update({ tokens_ciphertext: encryptTeslaTokens(tokens, cfg.clientSecret), expires_at: new Date(tokens.expiresAt).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', ctx.userClaims.id);
  if (update.error) throw new TeslaError(503, 'Tesla-forbindelsen kunne ikke opdateres.');
  return tokens;
}

export async function beginTeslaAuthorization(request, body, dependencies = {}) {
  try {
    const ctx = await userContext(request, dependencies.contextFactory);
    const cfg = config(dependencies.env);
    const returnTo = body?.returnTo === nativeReturnUrl ? 'native' : 'web';
    const state = signedState({ userId: ctx.userClaims.id, returnTo, expiresAt: Date.now() + 10 * 60 * 1000, nonce: randomBytes(16).toString('base64url') }, cfg.clientSecret);
    const authorization = new URL(`${authBase}/authorize`);
    authorization.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: 'code', scope: 'openid offline_access user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds', state }).toString();
    return { status: 200, body: { authorizationUrl: authorization.toString() } };
  } catch (error) { return { status: error instanceof TeslaError ? error.status : 503, body: { error: error instanceof Error ? error.message : 'Tesla-login kunne ikke startes.' } }; }
}

export async function finishTeslaAuthorization(url, dependencies = {}) {
  const cfg = config(dependencies.env);
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  const state = readState(parsed.searchParams.get('state'), cfg.clientSecret);
  if (!code) throw new TeslaError(400, 'Tesla-login kunne ikke valideres.');
  const response = await (dependencies.fetcher ?? fetch)(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: cfg.redirectUri, audience: apiBase }) });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new TeslaError(502, 'Tesla-token kunne ikke hentes.');
  const tokens = { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Date.now() + Number(payload.expires_in ?? 3600) * 1000 };
  const admin = dependencies.admin ?? createAdminClient();
  const saved = await admin.from('tesla_connections').upsert({ user_id: state.userId, tokens_ciphertext: encryptTeslaTokens(tokens, cfg.clientSecret), expires_at: new Date(tokens.expiresAt).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (saved.error) throw new TeslaError(503, 'Tesla-forbindelsen kunne ikke gemmes.');
  return { redirect: state.returnTo === 'native' ? nativeReturnUrl : '/?tesla=connected' };
}

export async function teslaStatus(request, dependencies = {}) {
  try {
    const ctx = await userContext(request, dependencies.contextFactory), cfg = config(dependencies.env);
    await connectionForUser(ctx, cfg.clientSecret);
    return { status: 200, body: { connected: true, virtualKeyPairingUrl: `https://tesla.com/_ak/${cfg.domain}` } };
  } catch (error) { return { status: error instanceof TeslaError ? error.status : 503, body: { connected: false, error: error instanceof Error ? error.message : 'Tesla-status kunne ikke hentes.' } }; }
}

export async function teslaVehicles(request, dependencies = {}) {
  try {
    const ctx = await userContext(request, dependencies.contextFactory), cfg = config(dependencies.env);
    const tokens = await freshTokens(ctx, await connectionForUser(ctx, cfg.clientSecret), cfg, dependencies.fetcher);
    const headers = { Accept: 'application/json', Authorization: `Bearer ${tokens.accessToken}` };
    const vehiclesResponse = await (dependencies.fetcher ?? fetch)(`${apiBase}/api/1/vehicles`, { headers });
    const vehiclesPayload = await vehiclesResponse.json();
    if (!vehiclesResponse.ok) throw new TeslaError(502, `Tesla-køretøjer svarede med ${vehiclesResponse.status}.`);
    const vehicle = vehiclesPayload.response?.[0];
    if (!vehicle?.vin) return { status: 200, body: { vehicles: [] } };
    const dataResponse = await (dependencies.fetcher ?? fetch)(`${apiBase}/api/1/vehicles/${encodeURIComponent(vehicle.vin)}/vehicle_data`, { headers });
    const dataPayload = await dataResponse.json();
    if (!dataResponse.ok) throw new TeslaError(502, `Tesla-status svarede med ${dataResponse.status}.`);
    return { status: 200, body: { vehicles: [toTeslaVehicle(vehicle, dataPayload.response ?? dataPayload)] } };
  } catch (error) { return { status: error instanceof TeslaError ? error.status : 503, body: { error: error instanceof Error ? error.message : 'Tesla-data kunne ikke hentes.' } }; }
}

export async function teslaChargingCommand(request, body, dependencies = {}) {
  let ctx;
  let action;
  let vin;
  let teslaStatus;
  try {
    action = body?.action;
    vin = String(body?.vin ?? '').trim();
    if (!['start', 'stop'].includes(action) || !vin) throw new TeslaError(400, 'Ugyldig ladekommando.');
    ctx = await userContext(request, dependencies.contextFactory);
    const cfg = config(dependencies.env);
    const tokens = await freshTokens(ctx, await connectionForUser(ctx, cfg.clientSecret), cfg, dependencies.fetcher);
    const headers = { Accept: 'application/json', Authorization: `Bearer ${tokens.accessToken}` };
    const vehiclesResponse = await (dependencies.fetcher ?? fetch)(`${apiBase}/api/1/vehicles`, { headers });
    const vehiclesPayload = await vehiclesResponse.json();
    teslaStatus = vehiclesResponse.status;
    if (!vehiclesResponse.ok) throw new TeslaError(502, `Tesla-køretøjer svarede med ${vehiclesResponse.status}.`);
    if (!vehiclesPayload.response?.some(vehicle => vehicle.vin === vin)) throw new TeslaError(404, 'Bilen findes ikke på din Tesla-konto.');
    const command = action === 'start' ? 'charge_start' : 'charge_stop';
    const proxy = commandProxyConfig(dependencies.env);
    const commandResponse = await (dependencies.fetcher ?? fetch)(`${proxy.baseUrl}/api/1/vehicles/${encodeURIComponent(vin)}/command/${command}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'X-Tesla-Proxy-Secret': proxy.sharedSecret },
      body: '{}',
    });
    let commandPayload = {};
    try { commandPayload = await commandResponse.json(); } catch { /* preserve the proxy HTTP status below */ }
    teslaStatus = commandResponse.status;
    if (!commandResponse.ok || commandPayload.response?.result === false) throw new TeslaError(502, teslaMessage(commandPayload, `Tesla kunne ikke ${action === 'start' ? 'starte' : 'stoppe'} opladningen.`));
    await recordTeslaCommand(ctx, { vin, action, outcome: 'accepted', teslaStatus, message: 'Tesla accepterede kommandoen.' });
    return { status: 200, body: { action, result: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tesla-kommandoen mislykkedes.';
    await recordTeslaCommand(ctx, { vin, action, outcome: 'rejected', teslaStatus, message }).catch(() => {});
    return { status: error instanceof TeslaError ? error.status : 503, body: { error: message } };
  }
}

export { nativeReturnUrl };
