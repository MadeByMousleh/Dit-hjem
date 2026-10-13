import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { managedVaultKeyResponse, wrapManagedVaultKey, unwrapManagedVaultKey } from '../src/services/managed-vault-key-server.mjs';
import { vaultWriterPublicKey } from '../src/services/vault-signing.mjs';

const home = randomUUID(), user = randomUUID();
const key = randomBytes(32).toString('hex');
const env = { ENERGY_VAULT_KEK: randomBytes(32).toString('base64url') };
const project = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
process.env.SUPABASE_URL = project;
let member = true, vault = false, writer = null, stored = null, tableMissing = false, race = null;
const admin = { from(table) {
  const query = {
    select() { return query; }, eq() { return query; },
    async maybeSingle() {
      if (table === 'energy_vault_managed_keys') return { data: stored, error: tableMissing ? { code: '42P01' } : null };
      if (table === 'energy_vaults') return { data: vault ? { household_id: home } : null };
      if (table === 'energy_vault_writers') return { data: writer ? { public_key: writer } : null };
      throw Error(table);
    },
    async insert(row) {
      if (race) { stored = { envelope: wrapManagedVaultKey(race, home, env) }; return { error: { code: '23505' } }; }
      stored = row; return { error: null };
    },
  };
  return query;
} };
const db = { from(table) {
  assert.equal(table, 'household_members');
  const query = { select() { return query; }, eq() { return query; }, async maybeSingle() { return { data: member ? { household_id: home } : null }; } };
  return query;
} };
const contextFactory = async (_req, options) => {
  assert.equal(options.auth, 'user'); assert.equal(options.issuer, `${project}/auth/v1`);
  return { data: { userClaims: { id: user }, supabase: db, supabaseAdmin: admin } };
};
const request = new Request('https://example.invalid', { headers: { authorization: 'Bearer synthetic' } });
const call = (operation, supplied = key) => managedVaultKeyResponse(request, { operation, householdId: home, key: supplied }, { env, contextFactory });
assert.equal((await managedVaultKeyResponse(new Request('https://example.invalid'), { operation: 'get' })).status, 401);
member = false; assert.equal((await call('get')).status, 403); member = true;
tableMissing = true; assert.equal((await call('get')).status, 503); tableMissing = false;
assert.equal((await call('get')).body.key, null);
vault = true; assert.equal((await call('register')).status, 409);
writer = vaultWriterPublicKey(new Uint8Array(Buffer.from(key, 'hex')), project, home);
assert.equal((await call('register', 'ab'.repeat(32))).status, 409);
assert.equal((await call('register')).status, 200);
assert.ok(!JSON.stringify(stored).includes(key));
assert.equal((await call('get')).body.key, key);
assert.equal((await call('register', 'ab'.repeat(32))).status, 409);
assert.equal((await call('register')).status, 200);
assert.throws(() => unwrapManagedVaultKey(stored.envelope, randomUUID(), env));
const tampered = { ...stored.envelope, tag: randomBytes(16).toString('base64url') };
assert.throws(() => unwrapManagedVaultKey(tampered, home, env));
stored = null; vault = false; race = key;
assert.equal((await call('register')).status, 200);
stored = null; race = 'ab'.repeat(32);
assert.equal((await call('register')).status, 409);
assert.equal((await call('get')).body.key, race);
console.log('PASS: managed-key membership, missing schema, pinned writer migration, immutable key, envelope authentication and registration races.');
