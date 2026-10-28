import { createHash } from 'node:crypto';
import { createSupabaseContext } from '@supabase/server';
import { createAuthorizationAttempt } from './eloverblik-authorization-link.mjs';
import { activeAuthorizations, meteringPointReadings, meteringPointAccessForAuthorization, meteringPointsForAuthorization, meteringPointGridDetails, ThirdPartyError } from './eloverblik-third-party.mjs';
import { danishDate } from './consumption-data.mjs';

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
  // Membership is verified before every caller reaches here. The connection is
  // household-owned; the user_id records who connected it, not the only reader.
  const row = await checked(ctx.supabaseAdmin.from('eloverblik_third_party_connections').select('authorization_id').eq('household_id', householdId).maybeSingle());
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
async function recoverAuthorization(ctx, householdId, dependencies) {
  const existing = await existingAuthorization(ctx, householdId, dependencies);
  if (existing) return { id: existing, pending: false };
  const attempts = await checked(ctx.supabaseAdmin.from('eloverblik_authorization_attempts').select('customer_key_hash').eq('user_id', ctx.userClaims.id).eq('household_id', householdId).gt('expires_at', new Date(dependencies.now ?? Date.now()).toISOString()));
  if (!attempts.length) return { id: null, pending: false };
  const wanted = new Set(attempts.map(row => row.customer_key_hash));
  const matches = (await activeAuthorizations(dependencies.env ?? process.env, dependencies)).filter(item => item.customerKey && wanted.has(keyHash(item.customerKey)));
  if (matches.length > 1) throw new EloverblikConnectionError(409, 'Flere fuldmagter matcher. Start forbindelsen igen.');
  if (!matches.length) return { id: null, pending: true };
  const match = matches[0];
  const result = await ctx.supabaseAdmin.rpc('consume_eloverblik_authorization', { p_user: ctx.userClaims.id, p_household: householdId, p_customer_key_hash: keyHash(match.customerKey), p_authorization: match.authorizationId });
  if (result.error) {
    // Diagnose provider-to-household binding failures without logging keys,
    // authorization IDs, account IDs or database error detail (which can contain them).
    console.error('eloverblik_binding_failed', { code: result.error.code ?? 'unknown', attemptMissing: result.error.message === 'authorization_attempt_missing' });
    // Two mounted clients can discover the same approved attempt together.
    if (result.error.message === 'authorization_attempt_missing' && await existingAuthorization(ctx, householdId, dependencies) === match.authorizationId) return { id: match.authorizationId, pending: false };
    throw new EloverblikConnectionError(result.error.message === 'authorization_attempt_missing' ? 410 : 503, result.error.message === 'authorization_attempt_missing' ? 'Forbindelsesforsøget er udløbet. Start igen.' : 'Forbindelsen kunne ikke gemmes.');
  }
  return { id: match.authorizationId, pending: false };
}
async function connectedResult(id, dependencies) {
  return { status: 200, body: { connected: true, pending: false, meters: await meteringPointsForAuthorization(id, dependencies.env ?? process.env, dependencies) } };
}
function errorResponse(error, fallback) { const expected = error instanceof EloverblikConnectionError || error instanceof ThirdPartyError; return { status: expected ? error.status : 503, body: { error: expected ? error.message : fallback } }; }

export async function beginEloverblikAuthorization(request, body, dependencies = {}) {
  try {
    const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId);
    const recovered = await recoverAuthorization(ctx, body.householdId, dependencies);
    if (recovered.id) return await connectedResult(recovered.id, dependencies);
    const created = createAuthorizationAttempt({ userId: ctx.userClaims.id, householdId: body.householdId, platform: body.platform }, dependencies.env ?? process.env, dependencies.now ?? Date.now());
    const saved = await ctx.supabaseAdmin.from('eloverblik_authorization_attempts').upsert({ customer_key_hash: keyHash(created.attempt.customerKey), user_id: created.attempt.userId, household_id: created.attempt.householdId, expires_at: new Date(created.attempt.expiresAt).toISOString(), created_at: new Date(created.attempt.createdAt).toISOString() }, { onConflict: 'customer_key_hash' });
    if (saved.error) throw new EloverblikConnectionError(503, 'Forbindelsen kunne ikke klargøres.');
    return { status: 200, body: { authorizationUrl: created.authorizationUrl, expiresAt: created.attempt.expiresAt } };
  } catch (error) { return errorResponse(error, 'Fuldmagtslinket kunne ikke oprettes.'); }
}
export async function finishEloverblikAuthorization(request, body, dependencies = {}) {
  try {
    const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId);
    const recovered = await recoverAuthorization(ctx, body.householdId, dependencies);
    if (recovered.id) return await connectedResult(recovered.id, dependencies);
    if (!recovered.pending) throw new EloverblikConnectionError(410, 'Forbindelsesforsøget er udløbet. Start igen.');
    return { status: 200, body: { connected: false, pending: true } };
  } catch (error) { return errorResponse(error, 'Eloverblik-forbindelsen kunne ikke bekræftes.'); }
}
export async function thirdPartyMeters(request, body, dependencies = {}) { try { const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId); return { status: 200, body: { meters: await meteringPointsForAuthorization(await connection(ctx, body.householdId), dependencies.env ?? process.env, dependencies) } }; } catch (error) { return errorResponse(error, 'Målepunkterne kunne ikke hentes.'); } }
export async function thirdPartyStatus(request, body, dependencies = {}) {
  try {
    const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId);
    // Status must inspect provider approval, not merely report a pending DB row.
    // This also repairs a round-trip that completed while the app was closed.
    const recovered = await recoverAuthorization(ctx, body.householdId, dependencies);
    return { status: 200, body: { connected: !!recovered.id, pending: recovered.pending } };
  } catch (error) { return errorResponse(error, 'Eloverblik-status kunne ikke hentes.'); }
}
export async function thirdPartyTimeseries(request, body, dependencies = {}) { try { const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId); return { status: 200, body: await meteringPointReadings(await connection(ctx, body.householdId), body?.meteringPointId, body?.from, body?.to, body?.aggregation, dependencies.env ?? process.env, dependencies) }; } catch (error) { return errorResponse(error, 'Målerdata kunne ikke hentes.'); } }
export async function thirdPartyImportBounds(request, body, dependencies = {}) {
  try {
    const ctx = await contextFor(request, dependencies.contextFactory); await requireMembership(ctx, body?.householdId);
    const id = await connection(ctx, body.householdId);
    const grant = (await activeAuthorizations(dependencies.env ?? process.env, dependencies)).find(item => item.authorizationId === id);
    if (!grant) throw new EloverblikConnectionError(409, 'Fuldmagten er ikke længere aktiv.');
    const today = danishDate(new Date(dependencies.now ?? Date.now())), floor = `${Number(today.slice(0, 4)) - 5}-01-01`;
    const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
    const meters = (await meteringPointAccessForAuthorization(id, dependencies.env ?? process.env, dependencies)).filter(item => !item.typeOfMP || item.typeOfMP === 'E17').map(item => ({
      metering_point_id: item.meteringPointId,
      from: [floor, iso(grant.from), iso(item.accessFrom), iso(item.consumerStartDate)].filter(Boolean).sort().at(-1),
      to: [iso(grant.to), iso(item.accessTo)].filter(Boolean).sort()[0] ?? null,
    })).filter(item => !item.to || item.from < item.to);
    return { status: 200, body: { meters } };
  } catch (error) { return errorResponse(error, 'Historikkens tilgængelige periode kunne ikke hentes.'); }
}
export async function thirdPartyGrid(request,body,dependencies={}){
 try{const ctx=await contextFor(request,dependencies.contextFactory);await requireMembership(ctx,body?.householdId);
  const meters=await meteringPointGridDetails(await connection(ctx,body.householdId),dependencies.env??process.env,dependencies);
  return {status:200,body:{meters,checkedAt:new Date(dependencies.now??Date.now()).toISOString()}};
 }catch(error){return errorResponse(error,'Netselskabet kunne ikke bekræftes via Eloverblik.');}
}
export async function thirdPartyConnectionResponse(request, body, dependencies = {}) { const handler = { begin: beginEloverblikAuthorization, finish: finishEloverblikAuthorization, status: thirdPartyStatus, meters: thirdPartyMeters, timeseries: thirdPartyTimeseries, history: thirdPartyImportBounds, grid: thirdPartyGrid }[body?.action]; return handler ? await handler(request, body, dependencies) : { status: 400, body: { error: 'Ukendt Eloverblik-handling.' } }; }
