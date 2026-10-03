import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { createSupabaseContext } from '@supabase/server';
import { createAdminClient } from '@supabase/server/core';

const apiBase = 'https://api.smartthings.com/v1';
const scopes = 'r:locations:* r:devices:$ x:devices:$';
const nativeReturnUrl = 'stromblik://smartthings/connected';

export class SmartThingsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function config(env = process.env) {
  const clientId = String(env.SMARTTHINGS_CLIENT_ID ?? '').trim();
  const clientSecret = String(env.SMARTTHINGS_CLIENT_SECRET ?? '').trim();
  const redirectUri = String(env.SMARTTHINGS_REDIRECT_URI ?? '').trim();
  if (!clientId || !clientSecret || !redirectUri) throw new SmartThingsError(503, 'SmartThings er ikke konfigureret.');
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== 'https:') throw new Error();
  } catch { throw new SmartThingsError(503, 'SmartThings callback-adressen er ugyldig.'); }
  return { clientId, clientSecret, redirectUri };
}

function key(secret) { return createHash('sha256').update(secret).digest(); }

function encrypt(tokens, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.');
}

function decrypt(value, secret) {
  try {
    const [iv, tag, encrypted] = String(value ?? '').split('.').map(part => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !encrypted) return undefined;
    const decipher = createDecipheriv('aes-256-gcm', key(secret), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
  } catch { return undefined; }
}

function sign(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`;
}

function readState(value, secret) {
  const [encoded, signature] = String(value ?? '').split('.');
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!encoded || !signature || signature.length !== expected.length || !Buffer.from(signature).equals(Buffer.from(expected))) throw new SmartThingsError(400, 'SmartThings-login kunne ikke valideres.');
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.userId || Number(payload.expiresAt) <= Date.now() || !['web', 'native'].includes(payload.returnTo)) throw new Error();
    return payload;
  } catch { throw new SmartThingsError(400, 'SmartThings-login kunne ikke valideres.'); }
}

async function userContext(request, contextFactory = createSupabaseContext) {
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) throw new SmartThingsError(401, 'Log ind for at forbinde SmartThings.');
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!projectUrl) throw new SmartThingsError(503, 'SmartThings er ikke konfigureret.');
  const { data, error } = await contextFactory(request, { auth: 'user', audience: 'authenticated', issuer: `${projectUrl}/auth/v1` });
  if (error || !data?.userClaims?.id) throw new SmartThingsError(401, 'Din session er udløbet. Log ind igen.');
  return data;
}

async function connection(ctx, secret) {
  const { data, error } = await ctx.supabaseAdmin.from('smartthings_connections').select('tokens_ciphertext,expires_at').eq('user_id', ctx.userClaims.id).maybeSingle();
  if (error) throw new SmartThingsError(503, 'SmartThings-forbindelsen kunne ikke læses.');
  const tokens = decrypt(data?.tokens_ciphertext, secret);
  if (!tokens?.accessToken) throw new SmartThingsError(401, 'SmartThings-login kræves.');
  return tokens;
}

async function tokensFor(ctx, cfg, fetcher = fetch) {
  const tokens = await connection(ctx, cfg.clientSecret);
  if (Number(tokens.expiresAt) > Date.now() + 60000) return tokens;
  if (!tokens.refreshToken) throw new SmartThingsError(401, 'SmartThings-login er udløbet. Forbind igen.');
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const response = await fetcher(`${apiBase}/oauth/token`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: cfg.clientId }) });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new SmartThingsError(401, 'SmartThings-login er udløbet. Forbind igen.');
  const updated = { accessToken: payload.access_token, refreshToken: payload.refresh_token ?? tokens.refreshToken, expiresAt: Date.now() + Number(payload.expires_in ?? 86400) * 1000 };
  const saved = await ctx.supabaseAdmin.from('smartthings_connections').update({ tokens_ciphertext: encrypt(updated, cfg.clientSecret), expires_at: new Date(updated.expiresAt).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', ctx.userClaims.id);
  if (saved.error) throw new SmartThingsError(503, 'SmartThings-forbindelsen kunne ikke opdateres.');
  return updated;
}

function headers(tokens) { return { Accept: 'application/json', Authorization: `Bearer ${tokens.accessToken}` }; }
function cleanDevice(device) {
  return { id: device.deviceId, label: device.label ?? device.name ?? 'SmartThings-enhed', type: device.type ?? null, health: device.health?.state ?? null, components: (device.components ?? []).map(component => ({ id: component.id, label: component.label ?? component.id, capabilities: (component.capabilities ?? []).map(capability => capability.id) })), status: device.status?.components ?? null };
}
function validName(value) { return typeof value === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(value); }

export async function beginSmartThingsAuthorization(request, body, dependencies = {}) {
  try {
    const ctx = await userContext(request, dependencies.contextFactory), cfg = config(dependencies.env);
    const returnTo = body?.returnTo === nativeReturnUrl ? 'native' : 'web';
    const state = sign({ userId: ctx.userClaims.id, returnTo, expiresAt: Date.now() + 10 * 60 * 1000, nonce: randomBytes(16).toString('base64url') }, cfg.clientSecret);
    const authorization = new URL(`${apiBase}/oauth/authorize`);
    authorization.search = new URLSearchParams({ client_id: cfg.clientId, response_type: 'code', redirect_uri: cfg.redirectUri, scope: scopes, state }).toString();
    return { status: 200, body: { authorizationUrl: authorization.toString() } };
  } catch (error) { return { status: error instanceof SmartThingsError ? error.status : 503, body: { error: error instanceof Error ? error.message : 'SmartThings-login kunne ikke startes.' } }; }
}

export async function finishSmartThingsAuthorization(url, dependencies = {}) {
  const cfg = config(dependencies.env), parsed = new URL(url), state = readState(parsed.searchParams.get('state'), cfg.clientSecret);
  const code = parsed.searchParams.get('code');
  if (!code || parsed.searchParams.get('error')) throw new SmartThingsError(400, 'SmartThings-adgang blev ikke godkendt.');
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const response = await (dependencies.fetcher ?? fetch)(`${apiBase}/oauth/token`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: cfg.clientId, redirect_uri: cfg.redirectUri }) });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new SmartThingsError(502, 'SmartThings-token kunne ikke hentes.');
  const tokens = { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Date.now() + Number(payload.expires_in ?? 86400) * 1000 };
  const admin = dependencies.admin ?? createAdminClient();
  const saved = await admin.from('smartthings_connections').upsert({ user_id: state.userId, tokens_ciphertext: encrypt(tokens, cfg.clientSecret), expires_at: new Date(tokens.expiresAt).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (saved.error) throw new SmartThingsError(503, 'SmartThings-forbindelsen kunne ikke gemmes.');
  return { redirect: state.returnTo === 'native' ? nativeReturnUrl : '/?smartthings=connected' };
}

export async function smartThingsStatus(request, dependencies = {}) {
  try { const ctx = await userContext(request, dependencies.contextFactory), cfg = config(dependencies.env); await connection(ctx, cfg.clientSecret); return { status: 200, body: { connected: true } }; }
  catch (error) { return { status: error instanceof SmartThingsError ? error.status : 503, body: { connected: false, error: error instanceof Error ? error.message : 'SmartThings-status kunne ikke hentes.' } }; }
}

export async function smartThingsDevices(request, dependencies = {}) {
  try {
    const ctx = await userContext(request, dependencies.contextFactory), tokens = await tokensFor(ctx, config(dependencies.env), dependencies.fetcher);
    const response = await (dependencies.fetcher ?? fetch)(`${apiBase}/devices?includeStatus=true&includeHealth=true`, { headers: headers(tokens) });
    const payload = await response.json();
    if (!response.ok) throw new SmartThingsError(502, `SmartThings-enheder svarede med ${response.status}.`);
    return { status: 200, body: { devices: (payload.items ?? []).map(cleanDevice) } };
  } catch (error) { return { status: error instanceof SmartThingsError ? error.status : 503, body: { error: error instanceof Error ? error.message : 'SmartThings-enheder kunne ikke hentes.' } }; }
}

export async function smartThingsCommand(request, body, dependencies = {}) {
  try {
    const deviceId = String(body?.deviceId ?? ''), component = String(body?.component ?? 'main'), capability = String(body?.capability ?? ''), command = String(body?.command ?? ''), args = body?.arguments ?? [];
    if (![deviceId, component, capability, command].every(validName) || !Array.isArray(args)) throw new SmartThingsError(400, 'Ugyldig SmartThings-kommando.');
    const ctx = await userContext(request, dependencies.contextFactory), tokens = await tokensFor(ctx, config(dependencies.env), dependencies.fetcher);
    const known = await (dependencies.fetcher ?? fetch)(`${apiBase}/devices/${encodeURIComponent(deviceId)}`, { headers: headers(tokens) });
    if (!known.ok) throw new SmartThingsError(404, 'Enheden findes ikke blandt dine godkendte SmartThings-enheder.');
    const response = await (dependencies.fetcher ?? fetch)(`${apiBase}/devices/${encodeURIComponent(deviceId)}/commands`, { method: 'POST', headers: { ...headers(tokens), 'Content-Type': 'application/json;charset=utf-8' }, body: JSON.stringify({ commands: [{ component, capability, command, arguments: args }] }) });
    const payload = await response.json();
    if (!response.ok || payload.results?.some(result => result.status !== 'ACCEPTED')) throw new SmartThingsError(502, 'SmartThings kunne ikke acceptere kommandoen.');
    return { status: 200, body: { accepted: true, results: payload.results ?? [] } };
  } catch (error) { return { status: error instanceof SmartThingsError ? error.status : 503, body: { error: error instanceof Error ? error.message : 'SmartThings-kommandoen mislykkedes.' } }; }
}

export { nativeReturnUrl };
