# Signed energy writes: security step 1b

Status (2026-09-22): implemented locally; migration `202609230006_signed_energy_writes.sql` applied and tested **only on dev**. The new HTTP endpoint has not been deployed or exercised end-to-end against hosted Auth/PostgREST. Production is unchanged. This is not an independent security audit.

## Trust boundaries

```text
Recovery key (device only)
  -> HKDF-SHA-256 (project + household + versioned signing purpose)
  -> Ed25519 signing seed (device only, temporary buffer)
  -> signed ciphertext request + user session
  -> POST /api/energy/vault
       verifies JWT issuer/audience, signature, account and membership
       -> server-only commit_signed_energy_vault
            locks household/membership; checks pinned public key + revision
            -> current ciphertext + immutable history, atomically
```

`src/services/vault-signing.mjs` uses pinned `@noble/curves` and `@noble/hashes` packages (2.4.0). It does not implement curve arithmetic or a custom KDF. The existing recovery key and ciphertext format are unchanged. A new device derives the same signing key from the recovery key, project URL and household ID. Sharing an account does not supply the signing key.

The request contains only public context, a public signing key, a signature and ciphertext. Neither the recovery key nor the derived signing seed is uploaded. `energy_vault_writers` stores the public key only.

The signature's fixed-order ASCII message binds:

1. Protocol label `stromblik-vault-write-v1`.
2. Supabase project URL (normalized without trailing slash).
3. Household UUID and authenticated user UUID.
4. Expected current revision (the new revision is expected + 1).
5. Initial legacy snapshot digest, or `-` for subsequent writes.
6. Public signing key, envelope format, nonce and SHA-256 of ciphertext bytes.

Every field has a restricted alphabet/format; unknown request or envelope fields are rejected. This avoids dependence on JSON object key ordering. New writes are strictly verified Ed25519 signatures (`zip215: false`). Replaying an accepted request fails the database's atomic expected-revision check. Reusing a signature for another user/project/household or modifying ciphertext/nonce invalidates it.

## Why verification is in the backend

The Node/Vercel route and local Node server share `vaultWriteResponse`, which uses the repository's Supabase server skill conventions: `auth: 'user'`, explicit issuer/audience and membership checking before privileged access. SQL repeats membership and pinned-key/revision checks under locks; the caller cannot swap keys between verification and commit.

The SQL function **does not verify Ed25519 itself**. Only `service_role` can execute it; the backend is trusted to verify signatures first. A stolen service secret or compromised backend/database remains outside the login-only protection and can corrupt data. Do not expose a generic admin-RPC proxy or add an unsigned server save path.

The old `save_energy_vault` is a revoked, rejecting tombstone. Clients have no execute permission on either commit path and cannot mutate the writer registry or current/archive rows. The server role also loses direct current-row mutation privileges; it uses the restricted commit function.

`pgsodium` was not enabled: Supabase [discourages new usage and lists pending deprecation](https://supabase.com/docs/guides/database/extensions/pgsodium). Signature verification therefore does not depend on that extension. Relevant primitive references: [noble-curves](https://github.com/paulmillr/noble-curves), [HKDF RFC 5869](https://www.rfc-editor.org/rfc/rfc5869).

## Enrollment and existing vaults

- New vault: signed initial enrollment pins the public key and inserts the ciphertext/archive in one transaction. A failed digest check, invalid envelope or archive failure does not leave a partial key registration.
- Existing vault with pinned key: writes must match that key and the current revision. There is no client key-replacement/reset operation.
- Existing vault WITHOUT a pinned key: **readable but write-locked**, including recovery writes. A login holder cannot register a key merely by submitting a valid signature from a newly invented key.
- No trusted upgrade/unlock ceremony for these legacy vaults is implemented yet. Before any production rollout, design and approve a separate authenticated-device/out-of-band transition. Never ask users for their recovery key or enable a temporary first-login-wins bypass. Do not deploy this migration to production until the impact is understood and approved.
- Initial enrollment is trust-on-first-enrollment for a household with no encrypted vault. This cannot prevent an attacker who already controls the account before the legitimate user enrolls from enrolling first. It must not be described as protection for a previously uninitialized trust anchor.

## Deployment and limits

- Deploy the matching backend route and client with the schema change; no unsigned fallback exists. The migrated dev DB refuses old clients' saves. The isolated dev backend/build environment remains a separate setup step.
- Required backend settings belong to the **same dev project**: `SUPABASE_URL`, publishable key, newly rotated server secret and valid JWKS configuration. Never reuse the API secret previously pasted in chat; rotation remains unconfirmed. No credentials were changed or copied during implementation.
- The client gets its signing project URL from `/api/auth/config`; the backend checks it against its configured `SUPABASE_URL`.
- HTTP writes have a conservative 4 MiB serialized-body cap, with 2048 bytes reserved above ciphertext hex. This is **smaller than the old database/read cap**. Existing larger backups remain readable, but signing/enrollment/recovery writes for them fail without deleting anything. Chunked transport/storage is required before supporting larger histories in production.
- Earlier archive limits (1000 versions / 256 MiB encrypted JSON) still apply. Valid key holders can exhaust them; account-only callers cannot add versions through the verified gateway.
- Signing does not fix session-token storage, screen privacy, key revocation/rotation, cache damage, legacy plaintext, malicious web delivery or native runtime behavior. It does not ensure that an authorized signer encrypted valid or complete data.

## Tests and verification

- `node scripts/test-vault-signing.mjs`: independent Node/OpenSSL verification and HKDF comparison; tampering, field binding, malformed and oversized messages.
- `node scripts/test-vault-write-server.mjs`: gateway behavior with mocked Auth/database boundaries; rejects missing/invalid sessions, bad signatures, nonmembers and cross-scope writes; exercises replay/key-replacement rejection.
- `node scripts/test-energy-vault-client.mjs`: actual TypeScript vault service -> actual signing helper -> actual gateway with mocked platform/Auth/database I/O; new-device unlock, concurrent writes, recovery, pagination and legacy write-lock handling. Corrupt-head recovery now models privileged corruption, not an allowed unsigned login write.
- `scripts/test-energy-vault.sql`: real dev DB ACLs, key pinning, unchanged legacy vaults, atomic initial enrollment/archive failure, history permissions and old-RPC denial. Its temporary SQL helper emulates the trusted gateway only within the rolled-back fixture transaction; it is not an application endpoint and must never be deployed.
- All three real SQL suites passed after migration 006. Assertions were on; zero fixture users/households/vaults/writers/versions remained; nine migrations were recorded.
- TypeScript-only check and Android/iOS/web bundle exports passed. Physical devices, the deployed signed endpoint and a production migration have **not** been verified. Existing dependency audit findings remain (16 total); no forced upgrades were performed.
