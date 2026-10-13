import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { beginEloverblikAuthorization, finishEloverblikAuthorization, thirdPartyStatus } from '../src/services/eloverblik-third-party-server.mjs';
import { __testing } from '../src/services/eloverblik-third-party.mjs';

const user = '11111111-1111-4111-8111-111111111111', household = '22222222-2222-4222-8222-222222222222', grant = '33333333-3333-4333-8333-333333333333';
const key = 'a'.repeat(64), hash = createHash('sha256').update(key).digest('hex');
const now = Date.parse('2026-10-13T12:00:00Z');
process.env.SUPABASE_URL = 'https://synthetic.supabase.co';
const env = { ELOVERBLIK_THIRD_PARTY_API_TOKEN: 'synthetic-third-party-token-only', EL_OVERBLIK_AUTH_LINK: `https://eloverblik.dk/power-of-attorney?thirdPartyId=${grant}&fromDate=2021-01-01&toDate=2029-10-08` };
const request = new Request('https://test.invalid/connect', { headers: { authorization: 'Bearer fixture' } });

function scenario({ bound = null, grants = [], attempts = [], member = true, failProvider = false } = {}) {
  __testing.clearCache();
  const state = { bound, grants, attempts, newAttempts: 0, consumed: 0 };
  const from = table => {
    const filters = [];
    const query = {
      select() { return query; }, eq(field, value) { filters.push(row => row[field] === value); return query; },
      gt(field, value) { filters.push(row => row[field] > value); return query; },
      maybeSingle() { return query.then(result => ({ ...result, data: result.data[0] ?? null })); },
      upsert(row) { state.attempts.push(row); state.newAttempts++; return Promise.resolve({ error: null }); },
      then(resolve) {
        const rows = table === 'household_members' ? (member ? [{ household_id: household, user_id: user }] : [])
          : table === 'eloverblik_third_party_connections' ? (state.bound ? [{ household_id: household, user_id: user, authorization_id: state.bound }] : []) : state.attempts;
        return Promise.resolve({ data: rows.filter(row => filters.every(f => f(row))), error: null }).then(resolve);
      },
    };
    return query;
  };
  return { state, dependencies: { now, env, contextFactory: async () => ({ data: { userClaims: { id: user }, supabase: { from }, supabaseAdmin: { from, rpc: async (_, args) => {
    assert.equal(args.p_user, user); assert.equal(args.p_household, household); assert.equal(args.p_customer_key_hash, hash);
    state.consumed++; state.bound = args.p_authorization; state.attempts = []; return { error: null };
  } } } }), fetcher: async url => {
    if (failProvider) return new Response('', { status: 503 });
    return Response.json({ result: url.endsWith('/token') ? 'synthetic-access' : url.includes('/meteringpoints/') ? [{ meteringPointId: '123456789012345678' }] : state.grants });
  } } };
}
const ownAttempt = { user_id: user, household_id: household, customer_key_hash: hash, expires_at: new Date(now + 60000).toISOString() };
for (const handler of [beginEloverblikAuthorization, finishEloverblikAuthorization]) {
  const { dependencies, state } = scenario({ bound: grant, grants: [{ id: grant }] });
  const result = await handler(request, { householdId: household }, dependencies);
  assert.equal(result.body.connected, true); assert.deepEqual(result.body.meters, ['123456789012345678']);
  assert.equal(state.newAttempts, 0); assert.equal(state.consumed, 0, 'Existing verified connection is idempotent even without attempts');
}
{
  const { dependencies, state } = scenario({ grants: [{ id: grant, customerKey: key }], attempts: [ownAttempt] });
  assert.equal((await thirdPartyStatus(request, { householdId: household }, dependencies)).body.pending, true);
  assert.equal((await beginEloverblikAuthorization(request, { householdId: household }, dependencies)).body.connected, true);
  assert.equal(state.consumed, 1); assert.equal(state.newAttempts, 0, 'Recover an approved browser round-trip before creating another attempt');
  assert.equal((await finishEloverblikAuthorization(request, { householdId: household }, dependencies)).body.connected, true);
}
for (const attempts of [[], [{ ...ownAttempt, user_id: grant }], [{ ...ownAttempt, household_id: grant }], [{ ...ownAttempt, expires_at: new Date(now - 1).toISOString() }]]) {
  const { dependencies, state } = scenario({ grants: [{ id: grant, customerKey: key }], attempts });
  assert.equal((await finishEloverblikAuthorization(request, { householdId: household }, dependencies)).status, 410);
  assert.equal(state.consumed, 0);
}
{
  const { dependencies, state } = scenario({ grants: [{ id: grant, customerKey: null }], attempts: [ownAttempt] });
  assert.equal((await finishEloverblikAuthorization(request, { householdId: household }, dependencies)).body.pending, true);
  assert.equal(state.consumed, 0, 'Never assign a general unkeyed grant to a user');
}
{
  const { dependencies } = scenario({ bound: grant, grants: [] });
  assert.equal((await thirdPartyStatus(request, { householdId: household }, dependencies)).body.connected, false, 'Revoked grant is not connected');
}
{
  const { dependencies, state } = scenario({ bound: grant, failProvider: true });
  assert.equal((await beginEloverblikAuthorization(request, { householdId: household }, dependencies)).status, 503);
  assert.equal(state.newAttempts, 0, 'Provider outage must not create a replacement grant');
}
{
  const { dependencies } = scenario({ member: false });
  assert.equal((await beginEloverblikAuthorization(request, { householdId: household }, dependencies)).status, 403);
}
console.log('PASS: idempotent reconnect, return recovery, ownership/expiry, unkeyed grants, revocation, provider outage and membership.');
