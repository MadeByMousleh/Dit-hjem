import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { beginTeslaAuthorization, decryptTeslaTokens, encryptTeslaTokens, finishTeslaAuthorization, teslaChargingCommand, teslaStatus, teslaVehicles } from '../src/services/tesla-server.mjs';

process.env.SUPABASE_URL = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
const env = {
  TESLA_CLIENT_ID: 'client',
  TESLA_CLIENT_SECRET: 'secret',
  TESLA_APP_DOMAIN: 'dev.example.test',
  TESLA_COMMAND_PROXY_URL: 'https://tesla-proxy.dev.example.test',
  TESLA_COMMAND_PROXY_SHARED_SECRET: 'proxy-fixture-secret',
};
const userId = randomUUID();
const request = new Request('https://dev.example.test/api/tesla/authorize', { headers: { authorization: 'Bearer fixture' } });
const contextFactory = async (_request, options) => {
  assert.deepEqual(options, { auth: 'user', audience: 'authenticated', issuer: `${process.env.SUPABASE_URL}/auth/v1` });
  return { error: null, data: { userClaims: { id: userId }, supabaseAdmin: database } };
};
let stored;
const commandLogs = [];
const database = {
  from(table) {
    if (table === 'tesla_command_logs') return { insert: async value => { commandLogs.push(value); return { error: null }; } };
    assert.equal(table, 'tesla_connections');
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: stored, error: null }) }) }),
      update: value => ({ eq: async () => { stored = { ...stored, ...value }; return { error: null }; } }),
    };
  },
};
const start = await beginTeslaAuthorization(request, { returnTo: 'stromblik://tesla/connected' }, { env, contextFactory });
assert.equal(start.status, 200);
const authorization = new URL(start.body.authorizationUrl);
const state = authorization.searchParams.get('state');
assert.ok(state);
assert.ok(authorization.searchParams.get('scope')?.includes('offline_access'));
const admin = { from: table => { assert.equal(table, 'tesla_connections'); return { upsert: async value => { stored = value; return { error: null }; } }; } };
const finished = await finishTeslaAuthorization(`https://dev.example.test/callback?code=one-time-code&state=${encodeURIComponent(state)}`, { env, admin, fetcher: async () => new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }), { status: 200 }) });
assert.equal(finished.redirect, 'stromblik://tesla/connected');
assert.equal(stored.user_id, userId);
assert.deepEqual(decryptTeslaTokens(stored.tokens_ciphertext, env.TESLA_CLIENT_SECRET), { accessToken: 'access', refreshToken: 'refresh', expiresAt: decryptTeslaTokens(stored.tokens_ciphertext, env.TESLA_CLIENT_SECRET).expiresAt });
stored = { tokens_ciphertext: encryptTeslaTokens({ accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 3600000 }, env.TESLA_CLIENT_SECRET), expires_at: new Date().toISOString() };
assert.deepEqual((await teslaStatus(request, { env, contextFactory })).body, { connected: true, virtualKeyPairingUrl: 'https://tesla.com/_ak/dev.example.test' });
const vehicleResult = await teslaVehicles(request, { env, contextFactory, fetcher: async url => {
  if (url.endsWith('/vehicles')) return new Response(JSON.stringify({ response: [{ id: 1, vin: 'VIN' }] }), { status: 200 });
  return new Response(JSON.stringify({ response: { charge_state: { battery_level: 54, charge_limit_soc: 80 }, vehicle_config: { car_type: 'model3' } } }), { status: 200 });
} });
assert.equal(vehicleResult.status, 200);
assert.equal(vehicleResult.body.vehicles[0].model, 'Model 3');
const commands = [];
const commandResult = await teslaChargingCommand(request, { vin: 'VIN', action: 'start' }, { env, contextFactory, fetcher: async (url, options = {}) => {
  if (url.endsWith('/vehicles')) return new Response(JSON.stringify({ response: [{ id: 1, vin: 'VIN' }] }), { status: 200 });
  commands.push({ url, method: options.method, headers: options.headers, body: options.body });
  return new Response(JSON.stringify({ response: { result: true } }), { status: 200 });
} });
assert.deepEqual(commandResult, { status: 200, body: { action: 'start', result: true } });
assert.deepEqual(commands, [{
  url: 'https://tesla-proxy.dev.example.test/api/1/vehicles/VIN/command/charge_start',
  method: 'POST',
  headers: { Accept: 'application/json', Authorization: 'Bearer access', 'Content-Type': 'application/json', 'X-Tesla-Proxy-Secret': 'proxy-fixture-secret' },
  body: '{}',
}]);
assert.deepEqual(commandLogs[0], { user_id: userId, vehicle_vin_suffix: 'VIN', action: 'start', outcome: 'accepted', tesla_status: 200, message: 'Tesla accepterede kommandoen.' });
const deniedCommand = await teslaChargingCommand(request, { vin: 'OTHER', action: 'stop' }, { env, contextFactory, fetcher: async () => new Response(JSON.stringify({ response: [{ id: 1, vin: 'VIN' }] }), { status: 200 }) });
assert.equal(deniedCommand.status, 404);
assert.equal(commandLogs[1].outcome, 'rejected');
console.log('PASS: native Tesla OAuth state is user-bound, encrypted server-side and returns through the app link.');
