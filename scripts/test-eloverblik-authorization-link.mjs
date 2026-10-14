import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAuthorizationLink, createAuthorizationAttempt, verifyAuthorizationAttempt } from '../src/services/eloverblik-authorization-link.mjs';
import { __testing } from '../src/services/eloverblik-third-party.mjs';

const now = Date.parse('2026-10-08T12:00:00Z');
const identity = { userId: '11111111-1111-4111-8111-111111111111', householdId: '22222222-2222-4222-8222-222222222222' };
const template = 'https://eloverblik.dk/power-of-attorney?thirdPartyId=33333333-3333-4333-8333-333333333333&fromDate=2021-01-01&toDate=2029-10-08';
const env = { EL_OVERBLIK_AUTH_LINK: template, ELOVERBLIK_RETURN_URL: 'https://example.com/?eloverblik=return', ELOVERBLIK_THIRD_PARTY_API_TOKEN: 'synthetic-refresh-token-only' };

test('uses the actual portal link format with independent per-attempt keys and no credentials or identity', () => {
  const a = createAuthorizationAttempt(identity, env, now), b = createAuthorizationAttempt(identity, env, now);
  const link = new URL(a.authorizationUrl);
  assert.equal(link.origin + link.pathname, 'https://eloverblik.dk/power-of-attorney');
  assert.equal(link.searchParams.get('customerKey'), a.attempt.customerKey);
  assert.match(a.attempt.customerKey, /^[a-f0-9]{64}$/);
  assert.notEqual(a.attempt.customerKey, b.attempt.customerKey);
  assert.equal(link.searchParams.get('returnUrl'), 'https://example.com/eloverblik/return.html');
  assert.equal(link.searchParams.get('fromDate'), '2021-01-01');
  assert.equal(a.attempt.expiresAt - a.attempt.createdAt, 30 * 60_000);
  for (const privateValue of [...Object.values(identity), env.ELOVERBLIK_THIRD_PARTY_API_TOKEN]) assert.ok(!a.authorizationUrl.includes(privateValue));
});

test('replaces a fixed template key and return URL, and supports the observed legacy path', () => {
  const key = 'a'.repeat(64);
  const link = new URL(buildAuthorizationLink(template.replace('/power-of-attorney', '/Authorization/authorization') + '&customerKey=old&returnUrl=https://untrusted.example', key, undefined, now));
  assert.equal(link.searchParams.get('customerKey'), key);
  assert.equal(link.searchParams.has('returnUrl'), false);
});

test('rejects unsafe templates, duplicate parameters, expired dates and unsafe returns', () => {
  const key = 'a'.repeat(64);
  for (const invalid of [undefined, template.replace('eloverblik.dk', 'eloverblik.dk.evil.example'), template.replace('https:', 'http:'), template + '&customerKey=a&customerKey=b', template.replace('2029-10-08', '2020-01-01'), template.replace('2021-01-01', '2021-02-30')]) {
    assert.throws(() => buildAuthorizationLink(invalid, key, undefined, now));
  }
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com', 'https://example.com/#token']) assert.throws(() => buildAuthorizationLink(template, key, url, now));
});

test('uses the trusted HTTPS return page and marks native app navigation without passing identity', () => {
  const defaults = { EL_OVERBLIK_AUTH_LINK: template };
  const native = new URL(createAuthorizationAttempt({ ...identity, platform: 'android' }, defaults, now).authorizationUrl);
  assert.equal(native.searchParams.get('returnUrl'), 'https://huslyg.dk/eloverblik/return.html?app=1');
  const browser = new URL(createAuthorizationAttempt({ ...identity, platform: 'web' }, defaults, now).authorizationUrl);
  assert.equal(browser.searchParams.get('returnUrl'), 'https://huslyg.dk/eloverblik/return.html');
  const configured = { EL_OVERBLIK_AUTH_LINK: template + '&returnUrl=' + encodeURIComponent('https://registered.example/eloverblik/return.html') };
  const ios = new URL(createAuthorizationAttempt({ ...identity, platform: 'ios' }, configured, now).authorizationUrl);
  assert.equal(ios.searchParams.get('returnUrl'), 'https://registered.example/eloverblik/return.html?app=1');
  const oldConfig = new URL(createAuthorizationAttempt({ ...identity, platform: 'android' }, { ...defaults, ELOVERBLIK_RETURN_URL: 'https://registered.example/?eloverblik=return' }, now).authorizationUrl);
  assert.equal(oldConfig.searchParams.get('returnUrl'), 'https://registered.example/eloverblik/return.html?app=1');
  for (const privateValue of Object.values(identity)) assert.ok(!ios.searchParams.get('returnUrl').includes(privateValue));
});

test('verifies only the owner of a nonexpired attempt against an exact provider key', async () => {
  __testing.clearCache();
  const { attempt } = createAuthorizationAttempt(identity, env, now);
  let calls = 0;
  let grants = [{ id: 'other-id', customerKey: 'other-key' }];
  const dependencies = { now, fetcher: async url => { calls++; return Response.json({ result: url.endsWith('/token') ? 'access' : grants }); } };
  await assert.rejects(verifyAuthorizationAttempt(attempt, { ...identity, userId: 'wrong' }, env, dependencies), e => e.status === 403);
  await assert.rejects(verifyAuthorizationAttempt(attempt, { ...identity, householdId: 'wrong' }, env, dependencies), e => e.status === 403);
  await assert.rejects(verifyAuthorizationAttempt(attempt, identity, env, { ...dependencies, now: attempt.expiresAt }), e => e.status === 410);
  assert.equal(calls, 0);
  assert.deepEqual(await verifyAuthorizationAttempt(attempt, identity, env, dependencies), { status: 'pending' });
  grants.push({ id: '33333333-3333-4333-8333-333333333333', customerKey: attempt.customerKey });
  assert.deepEqual(await verifyAuthorizationAttempt(attempt, identity, env, dependencies), { status: 'verified', authorizationId: '33333333-3333-4333-8333-333333333333' });
});
