import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createSupabaseContext } from '@supabase/server';
import { vaultWriterPublicKey } from './vault-signing.mjs';

const keyFormat = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const aad = householdId => Buffer.from(`stromblik-managed-vault-key-v1\n${householdId}`, 'utf8');

export class ManagedVaultKeyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function masterKey(env = process.env) {
  const raw = String(env.ENERGY_VAULT_KEK ?? '').trim();
  let key;
  try { key = Buffer.from(raw, 'base64url'); } catch { key = Buffer.alloc(0); }
  if (key.length !== 32) throw new ManagedVaultKeyError(503, 'Automatisk sikker lagring er ikke konfigureret.');
  return key;
}

export function wrapManagedVaultKey(keyHex, householdId, env = process.env) {
  if (!keyFormat.test(keyHex) || !uuid.test(householdId)) throw new ManagedVaultKeyError(400, 'Ugyldig nøgleanmodning.');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', masterKey(env), iv);
  cipher.setAAD(aad(householdId));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(keyHex, 'hex')), cipher.final()]);
  return { version: 1, iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') };
}

export function unwrapManagedVaultKey(envelope, householdId, env = process.env) {
  try {
    if (!uuid.test(householdId) || !envelope || envelope.version !== 1 || typeof envelope.iv !== 'string' || typeof envelope.tag !== 'string' || typeof envelope.ciphertext !== 'string') throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', masterKey(env), Buffer.from(envelope.iv, 'base64url'));
    decipher.setAAD(aad(householdId));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
    const key = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64url')), decipher.final()]);
    if (key.length !== 32) throw new Error();
    return key.toString('hex');
  } catch (error) {
    if (error instanceof ManagedVaultKeyError) throw error;
    throw new ManagedVaultKeyError(503, 'Den sikre nøgle kunne ikke åbnes. Dine data er ikke ændret.');
  }
}

async function contextFor(request, contextFactory = createSupabaseContext) {
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) throw new ManagedVaultKeyError(401, 'Log ind igen.');
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!projectUrl) throw new ManagedVaultKeyError(503, 'Automatisk sikker lagring er ikke konfigureret.');
  const { data, error } = await contextFactory(request, { auth: 'user', audience: 'authenticated', issuer: `${projectUrl}/auth/v1` });
  if (error || !data?.userClaims?.id) throw new ManagedVaultKeyError(401, 'Log ind igen.');
  return { ctx: data, projectUrl };
}

async function requireMembership(ctx, householdId) {
  if (!uuid.test(householdId)) throw new ManagedVaultKeyError(400, 'Vælg en gyldig husstand.');
  const result = await ctx.supabase.from('household_members').select('household_id').eq('household_id', householdId).eq('user_id', ctx.userClaims.id).maybeSingle();
  if (result.error) throw new ManagedVaultKeyError(503, 'Adgang kunne ikke kontrolleres.');
  if (!result.data) throw new ManagedVaultKeyError(403, 'Ingen adgang til husstanden.');
}

export async function managedVaultKeyResponse(request, body, dependencies = {}) {
  try {
    const operation = body?.operation;
    if (!['get', 'register'].includes(operation)) throw new ManagedVaultKeyError(400, 'Ugyldig nøgleanmodning.');
    const { ctx, projectUrl } = await contextFor(request, dependencies.contextFactory);
    const householdId = body?.householdId;
    await requireMembership(ctx, householdId);
    const existing = await ctx.supabaseAdmin.from('energy_vault_managed_keys').select('household_id,envelope').eq('household_id', householdId).maybeSingle();
    if (existing.error) throw new ManagedVaultKeyError(503, 'Den sikre nøgle kunne ikke hentes.');
    if (operation === 'get') return { status: 200, body: { key: existing.data ? unwrapManagedVaultKey(existing.data.envelope, householdId, dependencies.env ?? process.env) : null } };

    const key = String(body?.key ?? '');
    if (!keyFormat.test(key)) throw new ManagedVaultKeyError(400, 'Ugyldig nøgleanmodning.');
    if (existing.data) {
      const current = unwrapManagedVaultKey(existing.data.envelope, householdId, dependencies.env ?? process.env);
      if (current !== key) throw new ManagedVaultKeyError(409, 'Denne husstand har allerede en anden sikker nøgle. Dine data er ikke ændret.');
      return { status: 200, body: { registered: true } };
    }
    // An existing signed vault may only be linked to its already-pinned writer.
    // This avoids an account holder replacing the key for someone else's history.
    const vault = await ctx.supabaseAdmin.from('energy_vaults').select('household_id').eq('household_id', householdId).maybeSingle();
    if (vault.error) throw new ManagedVaultKeyError(503, 'Backupstatus kunne ikke kontrolleres.');
    if (vault.data) {
      const writer = await ctx.supabaseAdmin.from('energy_vault_writers').select('public_key').eq('household_id', householdId).maybeSingle();
      if (writer.error) throw new ManagedVaultKeyError(503, 'Backupstatus kunne ikke kontrolleres.');
      if (!writer.data || writer.data.public_key !== vaultWriterPublicKey(new Uint8Array(Buffer.from(key, 'hex')), projectUrl, householdId)) {
        throw new ManagedVaultKeyError(409, 'Denne ældre backup skal åbnes med dens eksisterende nøgle én sidste gang.');
      }
    }
    const inserted = await ctx.supabaseAdmin.from('energy_vault_managed_keys').insert({ household_id: householdId, envelope: wrapManagedVaultKey(key, householdId, dependencies.env ?? process.env), created_by: ctx.userClaims.id });
    if (inserted.error?.code === '23505') {
      const winner = await ctx.supabaseAdmin.from('energy_vault_managed_keys').select('envelope').eq('household_id', householdId).maybeSingle();
      if (winner.error || !winner.data) throw new ManagedVaultKeyError(503, 'Den sikre nøgle kunne ikke hentes. Prøv igen.');
      if (unwrapManagedVaultKey(winner.data.envelope, householdId, dependencies.env ?? process.env) !== key) {
        throw new ManagedVaultKeyError(409, 'Husstanden blev gjort klar på en anden enhed. Prøv igen.');
      }
    } else if (inserted.error) throw new ManagedVaultKeyError(503, 'Den sikre nøgle kunne ikke gemmes. Dine data er ikke ændret.');
    return { status: 200, body: { registered: true } };
  } catch (error) {
    const status = error instanceof ManagedVaultKeyError ? error.status : 503;
    const message = error instanceof ManagedVaultKeyError ? error.message : 'Automatisk sikker lagring er midlertidigt utilgængelig.';
    return { status, body: { error: message } };
  }
}
