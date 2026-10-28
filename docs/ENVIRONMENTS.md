# Development and production architecture

Last verified: 2026-09-22. This describes repository behavior and verified database setup, not a guarantee about current deployed services. Contains no credentials.

27 October 2026 follow-up: the architecture below is a historical baseline. Native Auth-session encryption, managed household-key preservation on account deletion, and the explicitly approved production account-deletion migration/backend are documented in [ACCOUNT-PRIVACY-IMPLEMENTATION.md](ACCOUNT-PRIVACY-IMPLEMENTATION.md). Native candidate 1.0.124 also prevents paused integrations from making client calls; it is built but not installed or published on the web. See [PAUSED-INTEGRATION-CONTROL.md](PAUSED-INTEGRATION-CONTROL.md). The separately approved erasure-journal migrations and mail activation are now active in production under [FAMILY-MAIL-AND-ERASURE-RELEASE.md](FAMILY-MAIL-AND-ERASURE-RELEASE.md); no account was deleted or restored by this release. These changes do not switch the CLI link or make Preview settings appropriate for Production.

27 October 2026 electricity-source release: the explicitly approved public Energinet cache migration and 14-file production release are active, with source hashes and production Auth verified on both domains. Native 1.0.126 is installed and its version/start verified on the known Samsung; older APKs retain their bundled provider. See [ENERGINET-PRICE-MIGRATION.md](ENERGINET-PRICE-MIGRATION.md). The separately approved forecast endpoint and additive cache-key migration are active, and native 1.0.127 is installed with data retained; source hashes, production Auth, both forecast areas and installed package/start are verified. Physical chart gestures remain unverified; see [PRICE-FORECAST-RELEASE.md](PRICE-FORECAST-RELEASE.md). No private electricity storage, Auth settings or secrets changed.

27 October 2026 cloud forecast audit: explicitly approved migration 005 and five-file release are active. Prospective raw DK1/DK2 forecast snapshots, actual-price comparison/training views and persistent job logs are server-protected; five Vercel cron definitions and production source hashes/Auth were verified. First snapshot was initialized through the database function; scheduled production execution is observed separately through the job log. No app/phone is required. See [FORECAST-ACCURACY-CLOUD.md](FORECAST-ACCURACY-CLOUD.md).

## Environment map

### Explicit Expo startup

Use `npm run start:dev` for the test database and `npm run start:prod` only for intentional production testing. Add `-- --localhost --port 8081` when using ADB reverse.
The launcher overrides inherited `EXPO_PUBLIC_API_URL`, clears Metro's cache and verifies `/api/auth/config` matches the selected Supabase project before starting Expo.

- Dev API alias: `https://dit-hjem-git-dev-mohammed-mouslehs-projects.vercel.app` (Vercel Preview).
- Production API: `https://dit-hjem-five.vercel.app` (Vercel Production).
- Dev Tesla redirect URI: `https://dit-hjem-git-dev-mohammed-mouslehs-projects.vercel.app/callback`. This must be registered in the Tesla developer application. Registration and authenticated device login have not been verified.

Both Vercel environments are currently under the `dit-hjem` project. Keep Preview and Production environment variables separate. A deployment-specific URL can retain obsolete API behavior even after production has been updated. Local `.env` files are excluded from Vercel uploads; server configuration comes from Vercel's selected environment.

| Concern | Development | Production |
| --- | --- | --- |
| Git branch convention | `dev` | `main` |
| Supabase project | `dit-hjem-test` | `mit-hjem` |
| Project reference | `wsdomkzhnksyjrpxqfvn` | `arkpfdsglgufnnukader` |
| Supabase URL | `https://wsdomkzhnksyjrpxqfvn.supabase.co` | `https://arkpfdsglgufnnukader.supabase.co` |
| Data policy | Synthetic fixtures; no copied production data | Treat all data and credentials as real |
| Database verification | Nine migrations applied; three SQL suites passed | Not changed or retested during dev setup |
| Local CLI default link | Not linked as the default | Last verified default link points here |
| Frontend/backend deployments | Separate dev deployment settings still need verification | Existing deployment settings must be preserved |

The projects are in separate organizations. Organization separation does not prevent an agent from targeting the wrong project with an account authorized for both.

**Three independent selections matter:** Git branch, backend/app environment, and CLI database target. None automatically switches the others. A preview built from `dev` can still connect to production if it inherits production environment variables. Git integration and automatic migration/deployment behavior have not been verified; do not assume they are configured.

## Application and data flow

```text
Expo app (React Native iOS/Android; Expo web)
  |
  +-- EXPO_PUBLIC_API_URL -> /api/auth/config
  |                           returns Supabase URL + publishable key only
  |
  +-- Supabase Auth -> session -> household_members -> authorized household
  |
  +-- EnergyVaultGate -> recovery key / native SecureStore -> unlocked vault
         |
         +-- Native only: user-held token -> Eloverblik -> plaintext in memory
         |                                                   |
         +-- Agreements and readings -> local encryption -----+
                                                             |
                                              Supabase energy_vaults
                                                       + version archive
```

- Frontend: Expo SDK 54, React Native and TypeScript. Entry gating lives in `src/screens/AppScreen.tsx`; login and energy unlock are separate gates.
- Backend: local `server.mjs` (default localhost port 8787) and hosted handlers under `api/`. `src/services/supabase.ts` gets public configuration from `/api/auth/config` rather than selecting a database from the Git branch.
- `EXPO_PUBLIC_API_URL` chooses that backend. On hosted web, the code can use same-origin requests when the variable is absent; localhost/native fallback is `http://localhost:8787`. Native deployed builds require an appropriate reachable backend URL.
- The backend's `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` determine the client Auth/database project. Privileged backend operations use server-only configuration. Check that each environment's URL, keys and JWT issuer/JWKS configuration belong to the same project.
- Server helpers use `@supabase/server`. Consult the repository skill and installed package documentation before changing authentication.
- Auth email stays in Supabase Auth. `household_members` maps account IDs to household IDs. This is pseudonymization, not anonymization; privileged operators can resolve the mapping.
- Native electricity fetching contacts Eloverblik directly. Web reads synced encrypted history and has no plaintext proxy fallback for enrolled vaults. Eloverblik tokens stay in unlocked-session memory, not in the encrypted backup.
- The vault encrypts locally with XChaCha20-Poly1305. The random recovery key is not sent to the server. Authenticated context includes household and revision; saves use fresh nonces and compare-and-swap revisions.
- The version archive is populated transactionally by a database trigger. Clients can read authorized ciphertext versions, but cannot directly insert/update/delete archive rows. Recovery decrypts an old version locally and creates a freshly encrypted new revision. A privileged operator is not constrained like a client.
- There is no complete encrypted local SQLite database: local vault persistence is an encrypted snapshot cache in AsyncStorage. The unlocked data is in memory; native remembered keys use SecureStore. Auth session tokens currently use AsyncStorage, a known remaining security issue.
- Profiles/device preferences, Tesla and legacy eForsyning server routes are outside the energy-vault E2EE scope. The new native Sønderborg Varme flow stores imported heat history in the existing encrypted snapshot and credentials only in native SecureStore; it is local, not deployed or real-account verified. See [EFORSYNING.md](EFORSYNING.md). Legacy plaintext database rows and old provider credentials require separate approved cleanup.

See [ENCRYPTED-ENERGY.md](../supabase/ENCRYPTED-ENERGY.md) for exact guarantees, limits and remaining work.

## Credentials and configuration

- Do not read or print `.ENV` to learn the environment. Prefer explicit project references, non-secret CLI link metadata, and redacted/targeted checks.
- `.ENV` and `.env` refer to the same file on typical Windows setups. Do not create a second case-variant and assume it is a separate environment.
- Never put a Supabase secret key, SMTP password, Eloverblik token, CLI access token, or recovery key in `EXPO_PUBLIC_*`, a committed file, a test fixture, a log, or chat.
- The publishable key is client-facing; the secret key is privileged and server-only. The previously shared dev secret must be rotated privately; completion has not been verified.
- Hosted dev database tests use the already authenticated Supabase CLI account. They do not require loading `.ENV`, using an application secret key, or installing Docker.
- Configuring the actual dev app is separate work: choose isolated backend/build settings, point `/api/auth/config` at dev, then verify the returned public project URL. Do not switch the existing local app or a production deployment without authorization.

## Safe database workflow

Use the repository-installed CLI, not an unspecified global version. Every remote dev command must include **both** `--linked` and `--project-ref wsdomkzhnksyjrpxqfvn`. In this installed CLI, `--project-ref` requires `--linked` and overrides the default linked target.

1. Read `git status`, this guide and the relevant migrations/tests.
2. Verify CLI account access and the explicit target; `npm run db:login` is available if authentication is required. Never request tokens in chat.
3. Preview dev migrations using the command in [DEV-TESTING.md](../supabase/DEV-TESTING.md).
4. Inspect pending SQL before applying it to dev. Use `--skip-vault`; do not include production secrets, roles or seed data implicitly.
5. Run the three rollback-only SQL tests against dev. Their synthetic fixtures end in `ROLLBACK`; confirm no fixtures remain and `plpgsql.check_asserts` is on.
6. Report exactly what passed. Preserve the production link and existing environment files.

Do not use bare `--linked` commands from older documentation as dev commands. The npm wrappers `db:plan`, `db:migrate`, `db:status` and `db:link` are not environment-isolated. In particular, `db:link` changes future command targeting. Similarly, `scripts/supabase-auth-config.mjs` is not a dev-safe shortcut; inspect its target before any auth configuration push.

Never edit an already-applied migration to change a deployed schema. Add a new forward migration and test it in dev first. Do not run reset/cleanup operations as routine test setup.

## Verified checkpoint and next task

On 2026-09-22, all eight migrations through `202609230005_energy_vault_history.sql` were applied to the initially empty dev project. Tests passed:

- `scripts/test-energy-vault.sql`: membership/RLS, denied direct archive mutation, stale revisions, legacy-data protection, and rollback when the archive reaches its version-count limit.
- `scripts/test-electricity-agreements.sql`: agreement history, validation and household isolation.
- `scripts/test-household-onboarding.sql`: verified-account onboarding and isolation.

SQL assertions were enabled. Final counts were zero users, households, vaults and versions; eight migrations remained recorded. This does not cover populated backfill/concurrent backfill locking, the archive byte-limit boundary, physical phones, or production behavior.

Security step 1a is version-history damage recovery. Step 1b now adds locally derived Ed25519 signatures, verified by `POST /api/energy/vault` before the server-only database commit. Migration `202609230006_signed_energy_writes.sql` is applied on dev; nine migrations and all three SQL suites are verified with no fixture data remaining. The old unsigned RPC is revoked. See [SIGNED-WRITES.md](../supabase/SIGNED-WRITES.md) for the protocol, smaller HTTP size limit and tests. The application/data diagram above shows storage destinations; writes now go through the signed backend gateway, not a direct client save RPC.

**Next increment: configure an isolated dev backend and test the deployed signed-write flow end-to-end.** The backend code is not deployed yet. Existing-vault bootstrap is deliberately blocked, not solved by first-login-wins registration: old unregistered vaults can be read but not written. A trusted transition must be approved before production migration. Keep production unchanged.

Other outstanding items: key/device revocation, secure auth-token storage, corrupted-cache recovery, backgrounding during recovery-key onboarding, native hardware tests, email-code delivery, dependency remediation, legacy plaintext cleanup, account deletion/retention and independent security review. See [LOGIN.md](../supabase/LOGIN.md) and [ENCRYPTED-ENERGY.md](../supabase/ENCRYPTED-ENERGY.md).

## Production promotion

Do not promote automatically after dev tests. Obtain explicit approval, review the diff and pending migrations, verify the production target independently, prepare a recovery plan, and coordinate client/backend/schema compatibility. Validate deployment-specific environment variables and email settings separately. A Git push is not proof of deployment or database migration.

Never copy dev fixtures or dev credentials into production. Never remove old plaintext data/backups or revoke provider credentials as an incidental deployment step; use the separately approved migration/cleanup procedure.
