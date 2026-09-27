# Encrypted energy data: implementation and release boundaries

## Implemented

- Login authorizes access to a household's ciphertext, not its decryption key.
- A client-generated 256-bit random key encrypts electricity agreements, meters, meter master data and readings with XChaCha20-Poly1305. Each save uses a fresh 192-bit random nonce. The authenticated context includes the format, household UUID and revision.
- The recovery key is this random secret, formatted as grouped hexadecimal. It is not derived from an email code or account password and is never uploaded. Users must re-enter their saved copy before enrollment.
- A new device logs into the same account and enters the recovery key. A native device may remember it using authenticated Expo SecureStore, restricted to that device. Web keys stay in memory. Backgrounding the app unmounts the unlocked session and clears the mutable key buffer; JS strings/garbage-collected objects cannot be guaranteed wiped.
- The server stores an encrypted snapshot and a monotonic revision. Household membership is enforced by RLS and the write RPC. Compare-and-swap rejects stale writes. The client fetches the latest snapshot before a change; failed/offline writes are not reported as saved.
- Local caching contains only ciphertext. Offline reads are possible when the session and encrypted cache are available; writes require the server. Cache failure does not negate a successful cloud save. This is not a general offline editing engine.
- The native electricity path contacts Eloverblik directly. Its long-lived refresh token is stored only in that phone's native SecureStore and is not in the backup, AsyncStorage or backend; a short-lived access token stays in memory. Removing the connection or changing phones requires connecting again. Web is a viewer for synced history; there is no plaintext proxy fallback.
- Supplier history and usage calculations run client-side. The new native Sønderborg Varme integration stores imported history in optional `heating` inside the encrypted vault; its credentials stay in native SecureStore. This local addition is not real-account/device verified; see [EFORSYNING.md](../docs/EFORSYNING.md). Profile/device preferences, Tesla and legacy eForsyning server routes remain outside this protection.

## Migration

`export_energy_for_encryption` returns a consistent legacy snapshot plus a digest. Enrollment is rejected if that snapshot changed before the ciphertext was saved. The client downloads/decrypts the saved snapshot to verify it. No operator generates the user's real key or enrolls the household on their behalf.

After enrollment, database triggers reject plaintext writes, old REST policies hide plaintext from authenticated users, and the new server handler refuses the server-side consumption path. Existing privileged database rows and historical provider backups remain until separately approved cleanup. Older deployed server code and existing Eloverblik credentials must also be retired.

The current format is a single snapshot, capped at 64 MiB of hexadecimal ciphertext; legacy export is capped at 30 MB of JSON. Large histories require a future chunked format. Never bypass these caps or delete old data after a rejected/partial migration.

## Required before claiming a completed zero-knowledge migration

### Security step 1a: ciphertext recovery history (not full write authorization)

Migration `202609230005_energy_vault_history.sql` adds client-immutable encrypted versions, atomically archived with each save, including the current snapshot at migration time. Members can read their household's history but cannot insert, alter or delete archive rows directly. Revisions already lost before migration cannot be recovered by this feature.

The unlock screen offers **Se tidligere versioner**. Enter the recovery key, select a version, and explicitly confirm replacement of the current view of the data. The app authenticates/decrypts the selected snapshot locally, then encrypts it with a fresh nonce under the NEXT revision. It never reuses ciphertext under a different revision/AAD. Wrong keys and corrupt selected snapshots are rejected before any write. A changed head since listing/confirmation is rejected rather than overwritten. Listings are paginated metadata; the selected ciphertext is fetched separately. Recovery also works when the current head is undecryptable. No key or plaintext is sent to the server.

This is only the damage-recovery part of finding 1. Migration 006 now revokes the login-only `save_energy_vault` path on dev; signed-write code and tests are described in [SIGNED-WRITES.md](SIGNED-WRITES.md). The new backend route is not deployed/end-to-end tested yet. Existing vaults without pinned signing keys remain readable but write-locked; a trusted upgrade ceremony is still required before production rollout. Administrators or a malicious server can still delete/withhold history; this table is not an independent disaster-recovery backup. Timestamps are server metadata, not authenticated creation times.

There is no automatic pruning. The provisional limit is 1000 snapshots or 256 MiB of serialized encrypted-envelope JSON per household (not a total physical database-size guarantee). Reaching either limit rolls back the entire save, including recovery saves, leaving existing data intact. With migration 006 and the verified gateway, adding versions requires the pinned signing key as well as login. Retention, capacity handling and account deletion need a separate approved procedure before release. Full-snapshot history increases storage costs. Signed HTTP writes have a smaller 4 MiB transport limit; old larger snapshots remain readable but require future chunking for writes/recovery.

Deploy the history migration before the updated client. Old clients still save through the existing RPC and those saves are also archived. This migration does not delete plaintext originals or change recovery keys. On 2026-09-22 all eight migrations were successfully applied to the initially empty `dit-hjem-test` project (`wsdomkzhnksyjrpxqfvn`). The vault, agreement and onboarding SQL tests passed there with PostgreSQL assertions enabled. Checks include history read isolation, denied direct archive writes/deletes, stale-write rejection, and atomic rollback of the current snapshot when the 1000-version limit is reached. The fixtures were rolled back; users, households, vaults and versions were all empty afterward. Production was not migrated or relinked. This does not yet test a populated migration backfill, concurrent backfill locking, the byte-cap boundary, or physical-device behavior.

### Remaining release requirements

1. User enrolls with a privately stored recovery key and verifies their real agreements/history on a second device. Do not request that they send the key in chat or logs.
2. Test native login, secure storage, biometric interruption/background locking, memory use and direct Eloverblik on physical iOS and Android devices. Bundler exports and mock service tests do not prove these behaviors on hardware. Code-email delivery is still blocked by the hosted SMTP/plan configuration described in LOGIN.md.
3. Deploy the client and backend change together. Revoke the old server Eloverblik token at the provider, remove its copies from local/deployed secrets, and use a new client-held credential. Merely disabling a route does not invalidate an existing token.
4. After verified migration and explicit cleanup approval, remove legacy plaintext measurements, agreements, meter identifiers, sync ranges and relevant old backups/logs under an appropriate retention/deletion procedure. No deletion SQL is supplied automatically. The write-blocking triggers intentionally also protect old rows from accidental deletion during migration.
5. Independently review the full design and implementation. Review privileged access, metadata leakage, malicious client delivery (especially web), supply-chain risks, deletion and device/key revocation. Account/household metadata and ciphertext sizes/timing remain visible. A compromised unlocked device can expose data. A malicious server may deny service or replay history to a completely new device; existing caches pin the last observed revision. Key rotation/device revocation is not implemented in this version.

## Verification completed

- Mobile unlock UX: successful manual unlock, enrollment and recovery automatically attempt authenticated SecureStore persistence. Existing keys are tried once automatically when the locked session reaches the foreground; cancellation leaves manual retry/recovery available. Storage failure is reported and does not claim the phone was remembered. Background locking remains enabled. TypeScript and mocked vault-client checks pass; this automatic prompt lifecycle still needs physical-device verification.

- `node scripts/test-vault-crypto.mjs`: recovery, wrong key/context, tampered ciphertext/nonce, nonce uniqueness, realistic payload size.
- `node scripts/test-energy-vault-client.mjs`: actual service with mocked platform I/O, second-device recovery, native key-store options and account isolation, concurrent saves, encrypted-only persistence, offline reads, rejection of rollback to older cached versions, locking.
- `node scripts/test-private-electricity.mjs`: direct upstream only, separate meter requests, client aggregation, credentials excluded from backed-up data, browser cache-only behavior.
- `scripts/test-energy-vault.sql`: real database in rolled-back transactions, RLS, malformed envelopes, stale-write rejection, migration fingerprint mismatch, retained legacy originals, plaintext access blocked after enrollment.
- Existing consumption and background-usage unit suites pass; Android/iOS/web Expo exports pass. No physical-phone or independent security audit has been performed.

Dependency audit on 2026-09-22 reports 16 vulnerabilities (9 high, 7 moderate) in the existing Expo/build dependency tree, including image-size, postcss and uuid. No finding was reported for the newly added cipher package in that audit. Do not treat this as a clean production security review; a tested toolchain upgrade/remediation is release work, not an automatic `npm audit fix --force`.
