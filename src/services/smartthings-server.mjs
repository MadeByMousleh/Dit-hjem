import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createSupabaseContext } from '@supabase/server';
import { createAdminClient } from '@supabase/server/core';

const apiBase = 'https://api.smartthings.com/v1';
const nativeReturnUrl = 'stromblik://smartthings/connected';

// Fixed stages and numeric status only: never log requests, payloads or identities.
function diagnostic(stage, status) {
  if (!['stored_token', 'token_refresh', 'token_exchange', 'device_list'].includes(stage)) return;
  console.warn(JSON.stringify({ event: 'smartthings_connection', stage, status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0 }));
}

export class SmartThingsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function config(env = process.env) {
  const clientId = String(env.SMARTTHINGS_CLIENT_ID ?? '').trim();
  const clientSecret = String(env.SMARTTHINGS_CLIENT_SECRET ?? '').trim();
  const redirectUri = String(env.SMARTTHINGS_REDIRECT_URI ?? '').trim();
  const mode = env.SMARTTHINGS_OAUTH_MODE ?? 'cli';
  if (!['cli', 'api-access'].includes(mode)) throw new SmartThingsError(503, 'SmartThings-appens type er ugyldig.');
  if (!clientId || !clientSecret || !redirectUri) throw new SmartThingsError(503, 'SmartThings er ikke konfigureret.');
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== 'https:') throw new Error();
  } catch { throw new SmartThingsError(503, 'SmartThings callback-adressen er ugyldig.'); }
  return { clientId, clientSecret, redirectUri, scopes: mode === 'cli' ? 'r:locations:* r:devices:* x:devices:*' : 'r:locations:* r:devices:$ x:devices:$', oauthBase: mode === 'cli' ? 'https://api.smartthings.com/oauth' : `${apiBase}/oauth` };
}

const failure = (error, fallback) => ({ status: error instanceof SmartThingsError ? error.status : 503, body: { error: error instanceof SmartThingsError ? error.message : fallback } });
const upstream = (fetcher, url, options = {}) => fetcher(url, { ...options, signal: options.signal ?? AbortSignal.timeout(12000) });

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
  if (!encoded || !signature || !/^[A-Za-z0-9_-]+$/.test(signature)) throw new SmartThingsError(400, 'SmartThings-login kunne ikke valideres.');
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!encoded || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new SmartThingsError(400, 'SmartThings-login kunne ikke valideres.');
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.userId || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now() || payload.expiresAt > Date.now() + 10 * 60 * 1000 || !payload.nonce || !['web', 'native'].includes(payload.returnTo)) throw new Error();
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
  if (!data) throw new SmartThingsError(409, 'Forbind din SmartThings-konto.');
  const tokens = decrypt(data.tokens_ciphertext, secret);
  if (!tokens?.accessToken) {
    diagnostic('stored_token', 0);
    throw new SmartThingsError(409, 'Den gemte SmartThings-adgang kunne ikke læses. Forbind SmartThings igen.');
  }
  return tokens;
}

async function loadTokens(ctx, cfg, fetcher = fetch) {
  const tokens = await connection(ctx, cfg.clientSecret);
  if (Number(tokens.expiresAt) > Date.now() + 60000) return tokens;
  if (!tokens.refreshToken) throw new SmartThingsError(409, 'SmartThings-login er udløbet. Forbind igen.');
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const response = await upstream(fetcher, `${cfg.oauthBase}/token`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: cfg.clientId }) });
  if (!response.ok) diagnostic('token_refresh', response.status);
  const payload = await response.json();
  if ([400, 401, 403].includes(response.status)) throw new SmartThingsError(409, 'SmartThings-login er udløbet. Forbind igen.');
  if (!response.ok || !payload.access_token) throw new SmartThingsError(502, 'SmartThings kunne ikke opdatere forbindelsen. Prøv igen.');
  const updated = { accessToken: payload.access_token, refreshToken: payload.refresh_token ?? tokens.refreshToken, expiresAt: Date.now() + Number(payload.expires_in ?? 86400) * 1000 };
  const saved = await ctx.supabaseAdmin.from('smartthings_connections').update({ tokens_ciphertext: encrypt(updated, cfg.clientSecret), expires_at: new Date(updated.expiresAt).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', ctx.userClaims.id);
  if (saved.error) throw new SmartThingsError(503, 'SmartThings-forbindelsen kunne ikke opdateres.');
  return updated;
}

const refreshingTokens = new Map();
function tokensFor(ctx, cfg, fetcher = fetch) {
  const id = `${ctx.userClaims.id}:${cfg.clientId}`;
  if (refreshingTokens.has(id)) return refreshingTokens.get(id);
  const pending = loadTokens(ctx, cfg, fetcher).finally(() => refreshingTokens.delete(id));
  refreshingTokens.set(id, pending);
  return pending;
}

function headers(tokens) { return { Accept: 'application/json', Authorization: `Bearer ${tokens.accessToken}` }; }
function cleanDevice(device) {
  const status = {};
  const allowed = { switch: ['switch'], temperatureMeasurement: ['temperature'], powerMeter: ['power'], energyMeter: ['energy'], battery: ['battery'], contactSensor: ['contact'], washerOperatingState: ['machineState', 'jobState'], dishwasherOperatingState: ['machineState', 'jobState'],
    'signalahead13665.applianceoperationstatesv2': ['operationState'],
    'signalahead13665.startstopprogramv2': ['startstop'],
    'signalahead13665.pauseresumev2': ['pauseState'],
    'signalahead13665.programdurationv2': ['duration'],
    'signalahead13665.dishwasherprogramsv2': ['program', 'availablePrograms'],
    'signalahead13665.ovenprogramsv2': ['program', 'availablePrograms'],
  };
  for (const [component, capabilities] of Object.entries(device.status?.components ?? {})) {
    status[component] = {};
    for (const [capability, attributes] of Object.entries(allowed)) {
      if (!capabilities[capability]) continue;
      status[component][capability] = {};
      for (const attribute of attributes) {
        const item = capabilities[capability][attribute];
        if (item && (['string', 'number', 'boolean'].includes(typeof item.value) || (attribute === 'availablePrograms' && Array.isArray(item.value) && item.value.length <= 100 && item.value.every(v => typeof v === 'string' && v.length <= 200)))) status[component][capability][attribute] = { value: item.value, unit: typeof item.unit === 'string' ? item.unit : null, timestamp: typeof item.timestamp === 'string' ? item.timestamp : null };
      }
    }
  }
  return { id: device.deviceId, label: device.label ?? device.name ?? 'SmartThings-enhed', manufacturer: device.viper?.manufacturerName ?? device.manufacturerName ?? null, model: device.deviceModel ?? device.viper?.modelName ?? device.ocf?.modelNumber ?? null, type: device.type ?? null, health: device.health?.state ?? null, statusError: device.statusError ?? false, components: (device.components ?? []).map(component => ({ id: component.id, label: component.label ?? component.id, capabilities: (component.capabilities ?? []).map(capability => capability.id) })), status };
}
function validName(value) { return typeof value === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(value); }

export async function beginSmartThingsAuthorization(request, body, dependencies = {}) {
  try {
    const ctx = await userContext(request, dependencies.contextFactory), cfg = config(dependencies.env);
    const returnTo = body?.returnTo === nativeReturnUrl ? 'native' : 'web';
    const state = sign({ userId: ctx.userClaims.id, returnTo, expiresAt: Date.now() + 10 * 60 * 1000, nonce: randomBytes(16).toString('base64url') }, cfg.clientSecret);
    const authorization = new URL(`${cfg.oauthBase}/authorize`);
    authorization.search = new URLSearchParams({ client_id: cfg.clientId, response_type: 'code', redirect_uri: cfg.redirectUri, scope: cfg.scopes, state }).toString();
    return { status: 200, body: { authorizationUrl: authorization.toString() } };
  } catch (error) { return failure(error, 'SmartThings-login kunne ikke startes.'); }
}

export async function finishSmartThingsAuthorization(url, dependencies = {}) {
  const cfg = config(dependencies.env), parsed = new URL(url), state = readState(parsed.searchParams.get('state'), cfg.clientSecret);
  const code = parsed.searchParams.get('code');
  if (!code || parsed.searchParams.get('error')) throw new SmartThingsError(400, 'SmartThings-adgang blev ikke godkendt.');
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const response = await upstream(dependencies.fetcher ?? fetch, `${cfg.oauthBase}/token`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: cfg.clientId, redirect_uri: cfg.redirectUri }) });
  if (!response.ok) diagnostic('token_exchange', response.status);
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new SmartThingsError(502, 'SmartThings-token kunne ikke hentes.');
  const tokens = { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Date.now() + Number(payload.expires_in ?? 86400) * 1000 };
  const admin = dependencies.admin ?? createAdminClient();
  const saved = await admin.from('smartthings_connections').upsert({ user_id: state.userId, tokens_ciphertext: encrypt(tokens, cfg.clientSecret), expires_at: new Date(tokens.expiresAt).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (saved.error) throw new SmartThingsError(503, 'SmartThings-forbindelsen kunne ikke gemmes.');
  return { redirect: state.returnTo === 'native' ? nativeReturnUrl : '/?smartthings=connected' };
}

export async function smartThingsStatus(request, dependencies = {}) {
  try { const ctx = await userContext(request, dependencies.contextFactory), cfg = config(dependencies.env); await tokensFor(ctx, cfg, dependencies.fetcher); return { status: 200, body: { connected: true } }; }
  catch (error) { if (error instanceof SmartThingsError && error.status === 409) return { status: 200, body: { connected: false } }; return failure(error, 'SmartThings-status kunne ikke hentes.'); }
}

export async function smartThingsDevices(request, dependencies = {}) {
  try {
    const deadline = Date.now() + 24000;
    const ctx = await userContext(request, dependencies.contextFactory), tokens = await tokensFor(ctx, config(dependencies.env), dependencies.fetcher);
    const fetcher = dependencies.fetcher ?? fetch;
    const items = [], visited = new Set();
    let next = `${apiBase}/devices`;
    while (next && items.length < 100) {
      if (Date.now() >= deadline - 1000) break;
      if (visited.has(next)) throw new SmartThingsError(502, 'SmartThings sendte en ugyldig enhedsliste.');
      visited.add(next);
      const response = await upstream(fetcher, next, { headers: headers(tokens), signal: AbortSignal.timeout(Math.max(1, Math.min(12000, deadline - Date.now()))) });
      if (!response.ok) diagnostic('device_list', response.status);
      if (response.status === 401) throw new SmartThingsError(409, 'SmartThings afviste loginadgangen. Forbind SmartThings igen.');
      if (response.status === 403) throw new SmartThingsError(403, 'SmartThings-login er gemt, men adgangen til enheder blev afvist. Appens SmartThings-rettigheder skal kontrolleres.');
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.items)) throw new SmartThingsError(502, 'SmartThings-enheder kunne ikke hentes.');
      items.push(...payload.items);
      next = payload._links?.next?.href ?? null;
      if (next) {
        const url = new URL(next, apiBase);
        if (url.origin !== 'https://api.smartthings.com' || url.pathname !== '/v1/devices') throw new SmartThingsError(502, 'SmartThings sendte en ugyldig enhedsliste.');
        next = url.toString();
      }
    }
    const devices = [];
    for (let i = 0; i < Math.min(100, items.length); i += 5) {
      devices.push(...await Promise.all(items.slice(i, Math.min(i + 5, 100)).map(async device => {
        if (!validName(device.deviceId)) throw new SmartThingsError(502, 'SmartThings sendte en ugyldig enhed.');
        if (Date.now() >= deadline - 1000) return cleanDevice({ ...device, statusError: true });
        try {
          const response = await upstream(fetcher, `${apiBase}/devices/${encodeURIComponent(device.deviceId)}/status`, { headers: headers(tokens), signal: AbortSignal.timeout(Math.max(1, Math.min(12000, deadline - Date.now()))) });
          if (!response.ok) throw new Error();
          return cleanDevice({ ...device, status: await response.json() });
        } catch { return cleanDevice({ ...device, statusError: true }); }
      })));
    }
    return { status: 200, body: { devices, truncated: !!next || items.length > 100 } };
  } catch (error) { return failure(error, 'SmartThings-enheder kunne ikke hentes.'); }
}

export async function smartThingsCommand(request, body, dependencies = {}) {
  try {
    const deviceId = String(body?.deviceId ?? ''), component = String(body?.component ?? 'main'), capability = String(body?.capability ?? ''), command = String(body?.command ?? ''), args = body?.arguments ?? [];
    if (![deviceId, component, capability, command].every(validName) || !Array.isArray(args)) throw new SmartThingsError(400, 'Ugyldig SmartThings-kommando.');
    const ctx = await userContext(request, dependencies.contextFactory), tokens = await tokensFor(ctx, config(dependencies.env), dependencies.fetcher);
    const known = await upstream(dependencies.fetcher ?? fetch, `${apiBase}/devices/${encodeURIComponent(deviceId)}`, { headers: headers(tokens) });
    if (!known.ok) throw new SmartThingsError(404, 'Enheden findes ikke blandt dine godkendte SmartThings-enheder.');
    const device = await known.json();
    const capabilities = device.components?.find(item => item.id === component)?.capabilities?.map(item => item.id) ?? [];
    if (!capabilities.includes(capability)) throw new SmartThingsError(400, 'Denne styring understøttes ikke af enheden.');
    const programs = ['signalahead13665.dishwasherprogramsv2', 'signalahead13665.ovenprogramsv2'];
    const switchCommand = capability === 'switch' && ['on', 'off'].includes(command) && args.length === 0;
    const programCommand = programs.includes(capability) && command === 'setProgram' && args.length === 1 && typeof args[0] === 'string';
    const startCommand = capability === 'signalahead13665.startstopprogramv2' && command === 'setStartstop' && args.length === 1 && args[0] === 'play';
    if (!switchCommand && !programCommand && !startCommand) throw new SmartThingsError(400, 'Denne styring understøttes ikke af enheden.');
    if (programCommand || startCommand) {
      const statusResponse = await upstream(dependencies.fetcher ?? fetch, `${apiBase}/devices/${encodeURIComponent(deviceId)}/status`, { headers: headers(tokens) });
      if (!statusResponse.ok) throw new SmartThingsError(502, 'Programstatus kunne ikke kontrolleres. Prøv igen.');
      const current = (await statusResponse.json()).components?.[component] ?? {};
      const operation = current['signalahead13665.applianceoperationstatesv2']?.operationState?.value;
      if (['Run', 'Pause', 'Error', 'Offline', 'Aborting', 'ActionRequired', 'DelayedStart'].includes(operation)) throw new SmartThingsError(409, 'Enheden er ikke klar til et nyt program. Opdater status.');
      if (programCommand) {
        const available = current[capability]?.availablePrograms?.value;
        if (!Array.isArray(available) || !available.includes(args[0]) || ['None', 'UnknownProgram'].includes(args[0])) throw new SmartThingsError(400, 'Programmet findes ikke på denne enhed.');
      } else {
        const programCapability = programs.find(id => capabilities.includes(id));
        const selected = programCapability && current[programCapability]?.program?.value;
        if (current.switch?.switch?.value !== 'on' || !selected || selected !== body?.expectedProgram || !['Ready', 'Inactive', 'Finished'].includes(operation)) throw new SmartThingsError(409, 'Tænd enheden og bekræft det valgte program før start.');
      }
    }
    const response = await upstream(dependencies.fetcher ?? fetch, `${apiBase}/devices/${encodeURIComponent(deviceId)}/commands`, { method: 'POST', headers: { ...headers(tokens), 'Content-Type': 'application/json;charset=utf-8' }, body: JSON.stringify({ commands: [{ component, capability, command, arguments: args }] }) });
    const payload = await response.json();
    if (!response.ok || !payload.results?.length || payload.results.some(result => result.status !== 'ACCEPTED')) throw new SmartThingsError(502, 'SmartThings kunne ikke acceptere kommandoen.');
    return { status: 200, body: { accepted: true, results: payload.results ?? [] } };
  } catch (error) { return failure(error, 'SmartThings-kommandoen mislykkedes.'); }
}

export async function disconnectSmartThings(request, dependencies = {}) {
  try {
    const ctx = await userContext(request, dependencies.contextFactory);
    const result = await ctx.supabaseAdmin.from('smartthings_connections').delete().eq('user_id', ctx.userClaims.id);
    if (result.error) throw new SmartThingsError(503, 'Forbindelsen kunne ikke fjernes.');
    return { status: 200, body: { connected: false } };
  } catch (error) { return failure(error, 'Forbindelsen kunne ikke fjernes.'); }
}

export { nativeReturnUrl };
