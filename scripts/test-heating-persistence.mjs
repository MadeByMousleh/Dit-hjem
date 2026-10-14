import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { heatingConnectionResponse, decryptHeatingCredentials } from '../src/services/heating-connection-server.mjs';

const householdId = '11111111-1111-4111-8111-111111111111', userId = '22222222-2222-4222-8222-222222222222';
const credentials = { username: '12345', password: 'synthetic-only' };
const env = { EFORSYNING_CREDENTIALS_KEK: randomBytes(32).toString('base64url') };
process.env.SUPABASE_URL = 'https://synthetic.supabase.co';
const request = new Request('https://test.invalid/heat', { headers: { authorization: 'Bearer synthetic' } });
let row = null, dailyFailure = true, rejectPassword = false, member = true, failSave = false, upstreamCalls = 0;
const from = table => {
  const filters = [];
  const query = {
    select() { return query; }, eq(field, value) { filters.push(item => item[field] === value); return query; },
    maybeSingle: async () => ({ data: (table === 'household_members' ? member ? { household_id: householdId, user_id: userId } : null : row), error: null }),
    upsert: async value => { if (failSave) return { error: {} }; row = value; return { error: null }; },
    update() { return query; }, then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
  };
  return query;
};
const line = { FraDatoStr: '01-10-2026', TilDatoStr: '01-10-2026', TForbrugsTaellevaerk: [{ IndexNavn: 'ENG1', Enhed_Txt: 'GJ', Forbrug: '0,36' }] };
const dependencies = { env, contextFactory: async () => ({ data: { userClaims: { id: userId }, supabase: { from }, supabaseAdmin: { from } } }), fetcher: async url => {
  upstreamCalls++;
  if (url.includes('getsecuritytoken')) return Response.json({ Token: 'synthetic-challenge' });
  if (url.includes('system/login')) return Response.json({ Result: rejectPassword ? 0 : 1 });
  if (url.includes('getebrugerinfo')) return Response.json({ id: 1 });
  if (url.includes('FindInstallationer')) return Response.json({ Installationer: [{ AktivNr: 1, InstallationNr: 2 }] });
  if (url.includes('getaktuelaarsmaerke')) return Response.json({ aarsmaerke: '2026' });
  if (url.includes('getforbrug')) {
    assert.ok(row, 'Connection is stored before consumption retrieval starts');
    if (dailyFailure) return new Response('', { status: 503 });
    return Response.json({ ForbrugsLinjer: { TForbrugsLinje: [line] } });
  }
  throw new Error('Unexpected supplier path');
} };
const call = body => heatingConnectionResponse(request, { householdId, ...body }, dependencies);
const connected = await call({ action: 'connect', ...credentials });
assert.equal(connected.status, 200); assert.equal(connected.body.connected, true); assert.ok(connected.body.warning);
assert.ok(!JSON.stringify(row).includes(credentials.password));
assert.deepEqual(decryptHeatingCredentials(row.credentials_envelope, householdId, userId, env), credentials);
assert.equal((await call({ action: 'status' })).body.connected, true);
dailyFailure = false;
const synced = await call({ action: 'sync' });
assert.equal(synced.status, 200); assert.equal(synced.body.history.readings[0].kwh, 100);
assert.ok(!JSON.stringify(synced.body).includes(credentials.password), 'No credentials in app response');
rejectPassword = true;
const rejected = await call({ action: 'sync' });
assert.equal(rejected.body.code, 'HEATING_CREDENTIALS_REJECTED'); assert.ok(row, 'Supplier rejection does not delete the encrypted connection');
row = null;
assert.equal((await call({ action: 'connect', ...credentials })).status, 401); assert.equal(row, null);
rejectPassword = false; failSave = true;
assert.equal((await call({ action: 'connect', ...credentials })).status, 503); assert.equal(row, null);
assert.equal((await call({ action: 'sync' })).body.code, 'HEATING_CONNECTION_MISSING');
member = false; const before = upstreamCalls;
assert.equal((await call({ action: 'connect', ...credentials })).status, 403); assert.equal(upstreamCalls, before);

// Diagnostic output must never copy credentials, request URLs or raw errors.
member = true; failSave = false;
const originalError = console.error, diagnostics = [];
console.error = (...args) => diagnostics.push(args.join(' '));
try {
  for (const [path, stage, code] of [['getsecuritytoken', 'challenge', 'ENOTFOUND'], ['system/login', 'login', 'ECONNRESET'], ['FindInstallationer', 'installations', 'CERT_HAS_EXPIRED']]) {
    const result = await heatingConnectionResponse(request, { householdId, action: 'connect', ...credentials }, { ...dependencies, fetcher: async url => {
      if (url.includes(path)) throw new TypeError(`SECRET URL ${url} ${credentials.password}`, { cause: { code, message: 'SECRET TOKEN' } });
      return dependencies.fetcher(url);
    } });
    assert.equal(result.status, 502);
    const detail = JSON.parse(diagnostics.at(-1).slice('heating_upstream_failed '.length));
    assert.equal(detail.stage, stage); assert.deepEqual(detail.codes, [code]); assert.equal(detail.httpStatus, null);
  }
  await heatingConnectionResponse(request, { householdId, action: 'connect', ...credentials }, { ...dependencies, fetcher: async () => { throw Object.assign(new Error('SECRET'), { cause: { code: credentials.password } }); } });
  assert.deepEqual(JSON.parse(diagnostics.at(-1).slice('heating_upstream_failed '.length)).codes, ['UNKNOWN_NETWORK_ERROR']);
  const output = diagnostics.join('\n');
  for (const secret of [credentials.username, credentials.password, 'SECRET', 'https://', 'synthetic-challenge']) assert.ok(!output.includes(secret), `Diagnostics leaked ${secret}`);
} finally { console.error = originalError; }

// Execute the real app service: an in-flight background sync must not swallow
// credentials submitted from onboarding, and refresh requests carry no password.
const source = readFileSync(new URL('../src/services/private-heating.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${js}\n})`)(name => {
  if (name === './supabase') return { API_URL: 'https://synthetic.invalid', getSupabase: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-session' } } }) } }) };
  throw new Error(`Unexpected dependency: ${name}`);
}, module, module.exports);
const originalFetch = globalThis.fetch, calls = [];
let release;
globalThis.fetch = async (_, options) => {
  const body = JSON.parse(options.body); calls.push(body);
  if (body.action === 'sync') await new Promise(resolve => { release = resolve; });
  return Response.json({ connected: true, warning: 'Synthetic readings unavailable' });
};
try {
  const vault = { householdId, data: {}, mutate: async () => { throw new Error('No history to save'); } };
  const sync = module.exports.syncHeating(vault, undefined, true);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const connect = module.exports.syncHeating(vault, credentials, true);
  release(); await sync; const result = await connect;
  assert.equal(calls.length, 2); assert.equal(calls[0].action, 'sync'); assert.equal(calls[0].password, undefined);
  assert.equal(calls[1].action, 'connect'); assert.equal(calls[1].password, credentials.password);
  assert.equal(result.connected, true); assert.ok(result.warning);
  assert.equal(module.exports.heatingNeedsReconnect(new module.exports.HeatingRequestError('offline')), false);
  assert.equal(module.exports.heatingNeedsReconnect(new module.exports.HeatingRequestError('rejected', 'HEATING_CREDENTIALS_REJECTED')), true);
} finally { globalThis.fetch = originalFetch; }

const states = [], effects = [], listeners = {};
let stateIndex = 0, statusFails = false, syncRejects = false;
const hookModule = { exports: {} };
const hookJs = ts.transpileModule(readFileSync(new URL('../src/hooks/useEforsyning.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const hooks = {
  react: { useState(initial) { const i = stateIndex++; states[i] = initial; return [initial, value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useEffect: fn => effects.push(fn), useCallback: fn => fn, useRef: current => ({ current }) },
  'react-native': { Platform: { OS: 'android' }, AppState: { addEventListener: (_, fn) => { listeners.foreground = fn; return { remove() {} }; } } },
  '../components/EnergyVaultGate': { useEnergyVault: () => ({ data: { heating: [] } }) },
  '../services/private-heating': {
    hasPrivateHeatingConnection: async () => { if (statusFails) throw new Error('Network unavailable'); return true; },
    syncHeating: async () => { if (syncRejects) throw new module.exports.HeatingRequestError('Supplier rejected login', 'HEATING_CREDENTIALS_REJECTED'); },
    heatingNeedsReconnect: module.exports.heatingNeedsReconnect,
  },
};
vm.runInThisContext(`(function(require,module,exports){${hookJs}\n})`)(name => hooks[name], hookModule, hookModule.exports);
const hook = hookModule.exports.useEforsyning(); const cleanup = effects.map(fn => fn());
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
await flush(); assert.equal(states[5], true);
statusFails = true; listeners.foreground('active'); await flush();
assert.equal(states[5], true, 'Status outage preserves a saved connection');
statusFails = false; syncRejects = true; await hook.refresh();
assert.equal(states[5], false, 'Supplier rejection requires new credentials even though a stored row remains');
cleanup.forEach(fn => fn?.());
console.log('PASS: encrypted credential persistence before readings, later reuse, rejection/save/access failures, no secret responses, and onboarding login queued after background refresh. Synthetic provider/database only.');
