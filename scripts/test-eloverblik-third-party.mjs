import assert from 'node:assert/strict';
import { test } from 'node:test';
import { __testing, activeAuthorizations, authorizationForCustomerKey, dataAccessToken, meteringPointsForAuthorization, meteringPointReadings, ThirdPartyError } from '../src/services/eloverblik-third-party.mjs';

const env = { ELOVERBLIK_THIRD_PARTY_API_TOKEN: 'third-party-refresh-token-fixture' };

test('sends consumption JSON with the required application/json content type', async () => {
  __testing.clearCache();
  const meter = '123456789012345678';
  let posted = false;
  const fetcher = async (url, options) => {
    if (url.endsWith('/token')) return Response.json({ result: 'synthetic-access' });
    if (url.includes('/meteringpoints/')) return Response.json({ result: [{ meteringPointId: meter }] });
    const request = new Request(url, options);
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('content-type'), 'application/json');
    assert.equal(request.headers.get('authorization'), 'Bearer synthetic-access');
    assert.deepEqual(await request.json(), { meteringPoints: { meteringPoint: [meter] } });
    assert.ok(url.endsWith('/meterdata/gettimeseries/2026-10-01/2026-10-02/Hour'));
    posted = true;
    return Response.json({ result: [] });
  };
  assert.deepEqual(await meteringPointReadings('synthetic-authorization', meter, '2026-10-01', '2026-10-02', 'Hour', env, { fetcher }), { result: [] });
  assert.equal(posted, true);
});

test('uses exact opaque provider IDs for meter lookup, including safe path encoding', async () => {
  __testing.clearCache();
  let path;
  const fetcher = async url => { path = url; return Response.json({ result: url.endsWith('/token') ? 'synthetic-access' : [{ meteringPointId: '123456789012345678' }] }); };
  for (const id of ['123456789', 'provider-authorization-abc', 'provider/id+suffix']) {
    assert.deepEqual(await meteringPointsForAuthorization(id, env, { fetcher }), ['123456789012345678']);
    assert.ok(path.endsWith('/authorizationId/' + encodeURIComponent(id)));
  }
  for (const id of ['', 'with space', 'with\nnewline', 'x'.repeat(201)]) await assert.rejects(meteringPointsForAuthorization(id, env, { fetcher }), error => error.status === 400);
});

test('exchanges the server-side refresh token once and returns active customer-key authorizations', async () => {
  __testing.clearCache();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/token')) return Response.json({ result: '24-hour-access-token' });
    return Response.json({ result: [
      { id: '11111111-1111-4111-8111-111111111111', customerKey: 'home_connection_123456', validFrom: '2026-10-08', validTo: '2027-10-08' },
      { id: '22222222-2222-4222-8222-222222222222', customerKey: null },
    ] });
  };
  const records = await activeAuthorizations(env, { fetcher, correlationId: 'test-correlation' });
  assert.deepEqual(records, [
    { authorizationId: '11111111-1111-4111-8111-111111111111', customerKey: 'home_connection_123456', from: '2026-10-08', to: '2027-10-08' },
    { authorizationId: '22222222-2222-4222-8222-222222222222', customerKey: null, from: null, to: null },
  ]);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /thirdpartyapi\/api\/token$/);
  assert.match(calls[1].url, /thirdpartyapi\/api\/authorization\/authorizations$/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer 24-hour-access-token');
  assert.equal(calls[1].options.headers['X-User-Correlation-ID'], 'test-correlation');
});

test('does not choose the first of multiple matching grants or guess from unkeyed grants', async () => {
  __testing.clearCache();
  const key = 'home_connection_123456';
  let grants = [{ id: 'unkeyed', customerKey: null }];
  const fetcher = async url => Response.json({ result: url.endsWith('/token') ? 'access' : grants });
  assert.equal(await authorizationForCustomerKey(key, env, { fetcher }), null);
  grants = [{ id: 'one', customerKey: key }, { id: 'two', customerKey: key }];
  await assert.rejects(authorizationForCustomerKey(key, env, { fetcher }), error => error.status === 409);
});

test('deduplicates concurrent token exchanges and does not leak network errors', async () => {
  __testing.clearCache();
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json({ result: 'access' }); };
  assert.deepEqual(await Promise.all([dataAccessToken(env, { fetcher }), dataAccessToken(env, { fetcher })]), ['access', 'access']);
  assert.equal(calls, 1);
  __testing.clearCache();
  await assert.rejects(dataAccessToken(env, { fetcher: async () => { throw new Error(env.ELOVERBLIK_THIRD_PARTY_API_TOKEN); } }), error => error.status === 502 && !error.message.includes(env.ELOVERBLIK_THIRD_PARTY_API_TOKEN));
  assert.equal(await dataAccessToken(env, { fetcher }), 'access');
});

test('does not accept a missing server token or an unsafe customer key', async () => {
  __testing.clearCache();
  await assert.rejects(dataAccessToken({}, { fetcher: async () => { throw new Error('must not call'); } }), error => error instanceof ThirdPartyError && error.status === 503);
  await assert.rejects(authorizationForCustomerKey('not safe!', env), error => error instanceof ThirdPartyError && error.status === 400);
});
