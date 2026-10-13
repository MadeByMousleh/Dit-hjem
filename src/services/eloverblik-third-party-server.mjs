import { createHash } from 'node:crypto';
import { createSupabaseContext } from '@supabase/server';
import { createAuthorizationAttempt } from './eloverblik-authorization-link.mjs';
import { activeAuthorizations, meteringPointReadings, meteringPointsForAuthorization, ThirdPartyError } from './eloverblik-third-party.mjs';

export class EloverblikConnectionError extends Error { constructor(status, message) { super(message); this.status = status; } }
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const keyHash = value => createHash('sha256').update(value).digest('hex');
const checked = async query => { const { data, error } = await query; if (error) throw new EloverblikConnectionError(503, 'Databasen kunne ikke behandle Eloverblik-forbindelsen.'); return data; };

async function contextFor(request, contextFactory = createSupabaseContext) {
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) throw new EloverblikConnectionError(401, 'Log ind for at forbinde Eloverblik.');
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!projectUrl) throw new EloverblikConnectionError(503, 'Eloverblik er ikke konfigureret.');
  const { data, error } = await contextFactory(request, { auth: 'user', audience: 'authenticated', issuer: `${projectUrl}/auth/v1` });
  if (error || !data?.userClaims?.id) throw new EloverblikConnectionError(401, 'Din session er udløbet. Log ind igen.');
  return data;
}
async function requireMembership(ctx, householdId) {
  if (!uuid(householdId)) throw new EloverblikConnectionError(400, 'Vælg en gyldig husstand.');
  const member = await checked(ctx.supabase.from('household_members').select('household_id').eq('household_id', householdId).eq('user_id', ctx.userClaims.id).maybeSingle());
  if (!member) throw new EloverblikConnectionError(403, 'Du har ikke adgang til denne husstand.');
}
async function connection(ctx, householdId) {
  const row = await checked(ctx.supabaseAdmin.from('eloverblik_third_party_connections').select('authorization_id').eq('household_id', householdId).eq('user_id', ctx.userClaims.id).maybeSingle());
  if (!row?.authorization_id) throw new EloverblikConnectionError(409, 'Forbind Eloverblik først.');
  return row.authorization_id;
}
async function existingAuthorization(ctx, householdId, dependencies) {
  let id;
  try { id = await connection(ctx, householdId); }
  catch (error) { if (error.status === 409) return null; throw error; }
  const active = await activeAuthorizations(dependencies.env ?? process.env, dependencies);
  return active.some(item => item.authorizationId === id) ? id : null;
}
async function connectedResult(id, dependencies) {
  return { status: 200, body: { connected: true, pending: false, meters: await meteringPointsForAuthorization(id, dependencies.env ?? process.env, dependencies) } };
}
function errorResponse(error, fallback) { const expected = error instanceof EloverblikConnectionError || error instanceof ThirdPartyError; return { status: expected ? error.status : 503, body: { error: expected ? error.message : fallback } }; }

export async function beginEloverblikAuthorization(request, body, dependencies = {}) {
  try {
    const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId);
    const existing = await existingAuthorization(ctx, body.householdId, dependencies);
    if (existing) return await connectedResult(existing, dependencies);
    // A previous browser round-trip may have completed before the app closed.
    const resumed = await finishEloverblikAuthorization(request, body, dependencies);
    if (resumed.body.connected) return resumed;
    if (resumed.status !== 200 && resumed.status !== 410) return resumed;
    const created = createAuthorizationAttempt({ userId: ctx.userClaims.id, householdId: body.householdId }, dependencies.env ?? process.env, dependencies.now ?? Date.now());
    const saved = await ctx.supabaseAdmin.from('eloverblik_authorization_attempts').upsert({ customer_key_hash: keyHash(created.attempt.customerKey), user_id: created.attempt.userId, household_id: created.attempt.householdId, expires_at: new Date(created.attempt.expiresAt).toISOString(), created_at: new Date(created.attempt.createdAt).toISOString() }, { onConflict: 'customer_key_hash' });
    if (saved.error) throw new EloverblikConnectionError(503, 'Forbindelsen kunne ikke klargøres.');
    return { status: 200, body: { authorizationUrl: created.authorizationUrl, expiresAt: created.attempt.expiresAt } };
  } catch (error) { return errorResponse(error, 'Fuldmagtslinket kunne ikke oprettes.'); }
}
export async function finishEloverblikAuthorization(request, body, dependencies = {}) {
  try {
    const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId);
    const existing = await existingAuthorization(ctx, body.householdId, dependencies);
    if (existing) return await connectedResult(existing, dependencies);
    const attempts = await checked(ctx.supabaseAdmin.from('eloverblik_authorization_attempts').select('customer_key_hash').eq('user_id', ctx.userClaims.id).eq('household_id', body.householdId).gt('expires_at', new Date(dependencies.now ?? Date.now()).toISOString()));
    if (!attempts.length) throw new EloverblikConnectionError(410, 'Forbindelsesforsøget er udløbet. Start igen.');
    const wanted = new Set(attempts.map(row => row.customer_key_hash));
    const matches = (await activeAuthorizations(dependencies.env ?? process.env, dependencies)).filter(item => item.customerKey && wanted.has(keyHash(item.customerKey)));
    if (matches.length > 1) throw new EloverblikConnectionError(409, 'Flere fuldmagter matcher. Start forbindelsen igen.');
    if (!matches.length) return { status: 200, body: { connected: false, pending: true } };
    const result = await ctx.supabaseAdmin.rpc('consume_eloverblik_authorization', { p_user: ctx.userClaims.id, p_household: body.householdId, p_customer_key_hash: keyHash(matches[0].customerKey), p_authorization: matches[0].authorizationId });
    if (result.error) throw new EloverblikConnectionError(result.error.message === 'authorization_attempt_missing' ? 410 : 503, result.error.message === 'authorization_attempt_missing' ? 'Forbindelsesforsøget er udløbet. Start igen.' : 'Forbindelsen kunne ikke gemmes.');
    return await connectedResult(matches[0].authorizationId, dependencies);
  } catch (error) { return errorResponse(error, 'Eloverblik-forbindelsen kunne ikke bekræftes.'); }
}
export async function thirdPartyMeters(request, body, dependencies = {}) { try { const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId); return { status: 200, body: { meters: await meteringPointsForAuthorization(await connection(ctx, body.householdId), dependencies.env ?? process.env, dependencies) } }; } catch (error) { return errorResponse(error, 'Målepunkterne kunne ikke hentes.'); } }
export async function thirdPartyStatus(request, body, dependencies = {}) {
  try {
    const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId);
    if (await existingAuthorization(ctx, body.householdId, dependencies)) return { status: 200, body: { connected: true, pending: false } };
    const attempts = await checked(ctx.supabaseAdmin.from('eloverblik_authorization_attempts').select('customer_key_hash').eq('user_id', ctx.userClaims.id).eq('household_id', body.householdId).gt('expires_at', new Date(dependencies.now ?? Date.now()).toISOString()));
    return { status: 200, body: { connected: false, pending: attempts.length > 0 } };
  } catch (error) { return errorResponse(error, 'Eloverblik-status kunne ikke hentes.'); }
}
export async function thirdPartyTimeseries(request, body, dependencies = {}) { try { const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId); return { status: 200, body: await meteringPointReadings(await connection(ctx, body.householdId), body?.meteringPointId, body?.from, body?.to, body?.aggregation, dependencies.env ?? process.env, dependencies) }; } catch (error) { return errorResponse(error, 'Målerdata kunne ikke hentes.'); } }
export async function thirdPartyConnectionResponse(request, body, dependencies = {}) { const handler = { begin: beginEloverblikAuthorization, finish: finishEloverblikAuthorization, status: thirdPartyStatus, meters: thirdPartyMeters, timeseries: thirdPartyTimeseries }[body?.action]; return handler ? await handler(request, body, dependencies) : { status: 400, body: { error: 'Ukendt Eloverblik-handling.' } }; }
