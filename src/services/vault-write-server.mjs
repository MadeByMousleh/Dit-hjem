import { createSupabaseContext } from '@supabase/server';
import { MAX_WRITE_BYTES, verifyVaultWrite } from './vault-signing.mjs';

export async function vaultWriteResponse(request, body, contextFactory = createSupabaseContext) {
  const fail = (status, error) => ({ status, body: { error } });
  try {
    if (request.method !== 'POST') return fail(405, 'Method not allowed');
    if (!request.headers.get('authorization')?.startsWith('Bearer ')) return fail(401, 'Log ind igen.');
    const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    if (!projectUrl) return fail(503, 'Signeret lagring er ikke konfigureret.');
    const { data: ctx, error } = await contextFactory(request, { auth: 'user', audience: 'authenticated', issuer: `${projectUrl}/auth/v1` });
    if (error || !ctx?.userClaims?.id) return fail(401, 'Log ind igen.');
    if (!body || Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_WRITE_BYTES) return fail(413, 'Backup er for stor til signeret synkronisering. Intet er ændret.');
    if (body.projectUrl !== projectUrl || body.userId !== ctx.userClaims.id || !verifyVaultWrite(body)) return fail(403, 'Skrivesignaturen kunne ikke bekræftes. Intet er ændret.');
    const member = await ctx.supabase.from('household_members').select('household_id').eq('household_id', body.householdId).eq('user_id', ctx.userClaims.id).maybeSingle();
    if (member.error) return fail(503, 'Adgang kunne ikke kontrolleres.');
    if (!member.data) return fail(403, 'Ingen adgang til husstanden.');
    // SQL rechecks membership, pinned key and expected revision under the same
    // household lock. Only this verified gateway may call the commit RPC.
    const result = await ctx.supabaseAdmin.rpc('commit_signed_energy_vault', {
      p_user: ctx.userClaims.id, p_household: body.householdId, p_expected: body.expectedRevision,
      p_envelope: body.envelope, p_public_key: body.publicKey, p_legacy_digest: body.legacyDigest,
    });
    if (result.error) {
      const messages = {
        legacy_write_locked: 'Denne eksisterende backup er skrivebeskyttet, indtil en sikker opgradering er godkendt. Data er bevaret.',
        writer_key_mismatch: 'Skrivenøglen passer ikke til husstanden. Intet er ændret.',
        vault_revision_conflict: 'En anden enhed har gemt ændringer. Synkroniser og prøv igen.',
        legacy_snapshot_changed: 'Historikken er ændret under overførslen. Prøv igen; intet er slettet.',
      };
      if (messages[result.error.message]) return fail(409, messages[result.error.message]);
      return fail(503, 'Backup kunne ikke gemmes. Tidligere versioner er bevaret; prøv at synkronisere.');
    }
    return { status: 200, body: { row: result.data?.[0] } };
  } catch { return fail(503, 'Signeret lagring er midlertidigt utilgængelig.'); }
}
