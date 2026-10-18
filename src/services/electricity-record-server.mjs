import { createSupabaseContext } from '@supabase/server';
import { MAX_WRITE_BYTES, verifyElectricityRecordsWrite } from './vault-signing.mjs';

export async function electricityRecordWriteResponse(request, body, contextFactory = createSupabaseContext) {
  const fail = (status, error, code) => ({ status, body: { error, ...(code ? { code } : {}) } });
  try {
    if (request.method !== 'POST') return fail(405, 'Method not allowed');
    if (!request.headers.get('authorization')?.startsWith('Bearer ')) return fail(401, 'Log ind igen.');
    const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    if (!projectUrl) return fail(503, 'Historiklagring er ikke konfigureret.');
    const { data: ctx, error } = await contextFactory(request, { auth: 'user', audience: 'authenticated', issuer: `${projectUrl}/auth/v1` });
    if (error || !ctx?.userClaims?.id) return fail(401, 'Log ind igen.');
    if (Buffer.byteLength(JSON.stringify(body ?? {})) > MAX_WRITE_BYTES) return fail(413, 'Historikpakken er for stor.');
    if (body?.projectUrl !== projectUrl || body.userId !== ctx.userClaims.id || !verifyElectricityRecordsWrite(body)) return fail(403, 'Historikkens skrivesignatur er ugyldig.');
    const member = await ctx.supabase.from('household_members').select('household_id').eq('household_id', body.householdId).eq('user_id', ctx.userClaims.id).maybeSingle();
    if (member.error) return fail(503, 'Adgang kunne ikke kontrolleres.');
    if (!member.data) return fail(403, 'Ingen adgang til husstanden.');
    const result = await ctx.supabaseAdmin.rpc('commit_electricity_period_records', { p_user: ctx.userClaims.id, p_household: body.householdId, p_public_key: body.publicKey, p_records: body.records });
    if (result.error) {
      if (result.error.message === 'electricity_revision_conflict') return fail(409, 'En anden enhed har gemt historik. Prøv igen.', 'ELECTRICITY_REVISION_CONFLICT');
      if (['legacy_write_locked', 'writer_key_mismatch'].includes(result.error.message)) return fail(409, 'Historikkens skrivenøgle kunne ikke bekræftes.');
      if (result.error.message === 'electricity_storage_limit') return fail(413, 'Historikkens lagergrænse er nået. Eksisterende data er bevaret.');
      return fail(503, 'Historikken kunne ikke gemmes. Kontroller serverens databaseopdatering.');
    }
    return { status: 200, body: { rows: result.data } };
  } catch { return fail(503, 'Historiklagring er midlertidigt utilgængelig.'); }
}
