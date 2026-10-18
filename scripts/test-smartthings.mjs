import assert from 'node:assert/strict';
import { beginSmartThingsAuthorization, finishSmartThingsAuthorization, smartThingsStatus, smartThingsDevices, smartThingsCommand, disconnectSmartThings } from '../src/services/smartthings-server.mjs';

process.env.SUPABASE_URL = 'https://synthetic-project.supabase.co';
const env = { SMARTTHINGS_CLIENT_ID: 'synthetic-client', SMARTTHINGS_CLIENT_SECRET: 'synthetic-secret', SMARTTHINGS_REDIRECT_URI: 'https://app.example/api/smartthings/callback' };
const rows = new Map();
let failDatabase = false;
const admin = { from(table) {
  assert.equal(table, 'smartthings_connections');
  const q = { operation: 'select', value: null, user: null,
    select() { return q; }, eq(_key, value) { q.user = value; return q; }, maybeSingle() { return q; },
    update(value) { q.operation = 'update'; q.value = value; return q; },
    upsert(value) { q.operation = 'upsert'; q.value = value; return q; },
    delete() { q.operation = 'delete'; return q; },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        if (failDatabase) return { error: { message: 'private database details' } };
        if (q.operation === 'upsert') rows.set(q.value.user_id, q.value);
        if (q.operation === 'update') rows.set(q.user, { ...rows.get(q.user), ...q.value });
        if (q.operation === 'delete') rows.delete(q.user);
        return { data: rows.get(q.user) ?? null, error: null };
      }).then(resolve, reject);
    },
  }; return q;
} };
const request = user => new Request('https://app.example', { headers: user ? { authorization: `Bearer ${user}` } : {} });
const contextFactory = async req => ({ data: { userClaims: { id: req.headers.get('authorization').slice(7) }, supabaseAdmin: admin } });
const deps = { env, admin, contextFactory };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const fixture = { deviceId: 'device-a', label: 'Lampe', deviceModel: 'SMD6ZC804E', viper: { manufacturerName: 'Bosch' }, components: [{ id: 'main', capabilities: [{ id: 'switch', version: 1 }] }] };
let tokenRequests = 0, commands = 0;
const fetcher = async (url, options) => {
  if (url.endsWith('/oauth/token')) {
    assert.equal(url, 'https://api.smartthings.com/oauth/token', 'CLI OAuth uses the documented non-v1 token URL');
    tokenRequests++;
    return json({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600 });
  }
  assert.equal(options.headers.Authorization, 'Bearer synthetic-access');
  if (url.endsWith('/devices')) return json({ items: [fixture] });
  if (url.endsWith('/device-a/status')) return json({ components: { main: { switch: { switch: { value: 'off' } }, secretCapability: { password: { value: 'must-not-be-returned' } } } } });
  if (url.endsWith('/device-a')) return json(fixture);
  if (url.endsWith('/commands')) { commands++; return json({ results: [{ status: 'ACCEPTED' }] }); }
  throw Error(`Unexpected synthetic request`);
};
deps.fetcher = fetcher;
assert.equal((await beginSmartThingsAuthorization(request(), {}, deps)).status, 401);
assert.equal((await smartThingsDevices(request(), deps)).status, 401);
assert.equal((await smartThingsStatus(request('alice'), deps)).body.connected, false);
const start = await beginSmartThingsAuthorization(request('alice'), { returnTo: 'stromblik://smartthings/connected' }, deps);
const authorization = new URL(start.body.authorizationUrl);
assert.equal(authorization.pathname, '/oauth/authorize');
assert.equal(authorization.searchParams.get('scope'), 'r:locations:* r:devices:* x:devices:*');
assert.equal(authorization.searchParams.get('redirect_uri'), env.SMARTTHINGS_REDIRECT_URI);
const callback = new URL(env.SMARTTHINGS_REDIRECT_URI);
callback.searchParams.set('state', authorization.searchParams.get('state')); callback.searchParams.set('code', 'synthetic-code');
const invalid = new URL(callback); invalid.searchParams.set('state', authorization.searchParams.get('state') + 'tamper');
await assert.rejects(finishSmartThingsAuthorization(invalid.toString(), deps), /valideres/);
await assert.rejects(finishSmartThingsAuthorization(env.SMARTTHINGS_REDIRECT_URI, deps), /valideres/);
const denied = new URL(callback); denied.searchParams.set('error', 'access_denied');
await assert.rejects(finishSmartThingsAuthorization(denied.toString(), deps), /godkendt/);
assert.equal(tokenRequests, 0);
const finished = await finishSmartThingsAuthorization(callback.toString(), deps);
assert.equal(finished.redirect, 'stromblik://smartthings/connected');
assert.ok(rows.has('alice')); assert.ok(!JSON.stringify(rows.get('alice')).includes('synthetic-access'));
assert.equal((await smartThingsStatus(request('alice'), deps)).body.connected, true);
assert.equal((await smartThingsStatus(request('bob'), deps)).body.connected, false);
const devices = await smartThingsDevices(request('alice'), deps);
assert.equal(devices.status, 200); assert.equal(devices.body.devices[0].status.main.switch.switch.value, 'off');
assert.equal(devices.body.devices[0].model, 'SMD6ZC804E');
assert.equal(devices.body.devices[0].manufacturer, 'Bosch');
assert.ok(!JSON.stringify(devices).includes('must-not-be-returned'));
// Provider denial must not be mistaken for a disconnected account. Logs contain
// only fixed stages/status, even when the provider returns non-JSON secrets.
const diagnostics = [];
const originalWarn = console.warn;
console.warn = value => diagnostics.push(JSON.parse(value));
try {
  for (const status of [401, 403, 502]) {
    const deniedDevices = await smartThingsDevices(request('alice'), { ...deps, fetcher: async () => new Response('private-provider-body-token', { status }) });
    assert.equal(deniedDevices.status, status === 401 ? 409 : status === 403 ? 403 : 503);
    assert.ok(!JSON.stringify(deniedDevices).includes('private-provider-body-token'));
  }
  assert.deepEqual(diagnostics, [401, 403, 502].map(status => ({ event: 'smartthings_connection', stage: 'device_list', status })));
  assert.equal((await smartThingsStatus(request('alice'), deps)).body.connected, true);
} finally { console.warn = originalWarn; }
assert.equal((await smartThingsCommand(request('alice'), { deviceId: 'device-a', component: 'main', capability: 'switch', command: 'on' }, deps)).body.accepted, true);
assert.equal(commands, 1);
assert.equal((await smartThingsCommand(request('alice'), { deviceId: 'device-a', component: 'wrong', capability: 'switch', command: 'on' }, deps)).status, 400);
assert.equal((await smartThingsCommand(request('alice'), { deviceId: 'device-a', capability: 'washerOperatingState', command: 'start' }, deps)).status, 400);
assert.equal((await smartThingsCommand(request('alice'), { deviceId: '../other', capability: 'switch', command: 'on' }, deps)).status, 400);
assert.equal(commands, 1, 'Unsupported commands never reach the provider');
const broken = await smartThingsDevices(request('alice'), { ...deps, fetcher: async () => { throw Error('secret-raw-error'); } });
assert.equal(broken.status, 503); assert.ok(!JSON.stringify(broken).includes('secret-raw-error'));
const invalidResults = await smartThingsCommand(request('alice'), { deviceId: 'device-a', capability: 'switch', command: 'on' }, { ...deps, fetcher: async (url, options) => url.endsWith('/commands') ? json({}) : fetcher(url, options) });
assert.equal(invalidResults.status, 502);
const badNext = await smartThingsDevices(request('alice'), { ...deps, fetcher: async () => json({ items: [fixture], _links: { next: { href: 'https://attacker.example/steal' } } }) });
assert.equal(badNext.status, 502);
const partial = await smartThingsDevices(request('alice'), { ...deps, fetcher: async (url, options) => url.endsWith('/status') ? json({}, 503) : fetcher(url, options) });
assert.equal(partial.body.devices[0].statusError, true);
// Program control is restricted to advertised capabilities and the provider's
// current program list, and start checks the independently reported selection.
const programCapability = 'signalahead13665.dishwasherprogramsv2';
const startCapability = 'signalahead13665.startstopprogramv2';
const eco = 'Dishcare_Dishwasher_Program_Eco50';
let operation = 'Ready', selectedProgram = eco, switchState = 'on', programCommands = 0;
const programFetcher = async (url, options) => {
  if (url.endsWith('/device-a')) return json({ ...fixture, components: [{ id: 'main', capabilities: [programCapability, startCapability, 'switch'].map(id => ({ id })) }] });
  if (url.endsWith('/status')) return json({ components: { main: { switch: { switch: { value: switchState } }, [programCapability]: { program: { value: selectedProgram }, availablePrograms: { value: [eco] } }, 'signalahead13665.applianceoperationstatesv2': { operationState: { value: operation } } } } });
  if (url.endsWith('/commands')) { programCommands++; return json({ results: [{ status: 'ACCEPTED' }] }); }
  return fetcher(url, options);
};
const programBody = { deviceId: 'device-a', component: 'main', capability: programCapability, command: 'setProgram', arguments: [eco] };
const startBody = { deviceId: 'device-a', component: 'main', capability: startCapability, command: 'setStartstop', arguments: ['play'], expectedProgram: eco };
const programDeps = { ...deps, fetcher: programFetcher };
assert.equal((await smartThingsCommand(request('alice'), programBody, programDeps)).status, 200);
assert.equal((await smartThingsCommand(request('alice'), { ...programBody, arguments: ['not-available'] }, programDeps)).status, 400);
assert.equal((await smartThingsCommand(request('alice'), { ...programBody, component: 'wrong' }, programDeps)).status, 400);
operation = 'Run'; assert.equal((await smartThingsCommand(request('alice'), programBody, programDeps)).status, 409);
assert.equal((await smartThingsCommand(request('alice'), startBody, programDeps)).status, 409);
operation = 'Ready'; switchState = 'off'; assert.equal((await smartThingsCommand(request('alice'), startBody, programDeps)).status, 409);
switchState = 'on'; selectedProgram = 'different'; assert.equal((await smartThingsCommand(request('alice'), startBody, programDeps)).status, 409);
selectedProgram = eco; assert.equal((await smartThingsCommand(request('alice'), startBody, programDeps)).status, 200);
assert.equal(programCommands, 2, 'Rejected programs/start attempts never reach command endpoint');
failDatabase = true; assert.equal((await smartThingsStatus(request('alice'), deps)).status, 503); failDatabase = false;
const apiAccess = new URL((await beginSmartThingsAuthorization(request('alice'), {}, { ...deps, env: { ...env, SMARTTHINGS_OAUTH_MODE: 'api-access' } })).body.authorizationUrl);
assert.equal(apiAccess.pathname, '/v1/oauth/authorize');
assert.equal(apiAccess.searchParams.get('scope'), 'r:locations:* r:devices:$ x:devices:$');
await disconnectSmartThings(request('bob'), deps); assert.ok(rows.has('alice'));
await disconnectSmartThings(request('alice'), deps); assert.ok(!rows.has('alice'));
assert.equal((await smartThingsStatus(request('alice'), deps)).body.connected, false);

// Concurrent expiry checks share one refresh within a function instance.
const expiredStart = await beginSmartThingsAuthorization(request('alice'), {}, deps);
const expiredCallback = new URL(callback); expiredCallback.searchParams.set('state', new URL(expiredStart.body.authorizationUrl).searchParams.get('state'));
await finishSmartThingsAuthorization(expiredCallback.toString(), { ...deps, fetcher: async () => json({ access_token: 'expired', refresh_token: 'synthetic-refresh', expires_in: -1 }) });
const before = tokenRequests;
await Promise.all([smartThingsStatus(request('alice'), deps), smartThingsStatus(request('alice'), deps)]);
assert.equal(tokenRequests - before, 1);
assert.equal((await smartThingsStatus(request('alice'), { ...deps, env: { ...env, SMARTTHINGS_CLIENT_SECRET: 'different-secret' } })).body.connected, false);
console.log('PASS: actual SmartThings backend with synthetic OAuth, state tampering/missing/denial, user isolation, encrypted tokens, refresh deduplication, CLI/API Access endpoints, device status/redaction, pagination origin checks, capability-constrained commands, failed acceptance, disconnection and outage handling. No real provider/account/device commands.');
