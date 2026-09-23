# Isolated hosted database tests (no Docker)

Development project: `dit-hjem-test`, reference `wsdomkzhnksyjrpxqfvn`.
These commands use the existing Supabase CLI account login, not an app secret key.
The explicit project reference overrides the normal linked target; do not omit it.
Do not replace production `.ENV` values or run `db:link` to switch environments.
If needed, authenticate locally with `npm run db:login`; never commit or paste access tokens.

Preview migrations first:

```powershell
node node_modules/supabase/dist/supabase.js db push --linked --project-ref wsdomkzhnksyjrpxqfvn --skip-vault --dry-run
```

Apply only after checking the target and preview:

```powershell
node node_modules/supabase/dist/supabase.js db push --linked --project-ref wsdomkzhnksyjrpxqfvn --skip-vault
```

Run synthetic, rollback-only database tests:

```powershell
node node_modules/supabase/dist/supabase.js db query --linked --project-ref wsdomkzhnksyjrpxqfvn --file scripts/test-energy-vault.sql
node node_modules/supabase/dist/supabase.js db query --linked --project-ref wsdomkzhnksyjrpxqfvn --file scripts/test-electricity-agreements.sql
node node_modules/supabase/dist/supabase.js db query --linked --project-ref wsdomkzhnksyjrpxqfvn --file scripts/test-household-onboarding.sql
```

All three passed on 2026-09-22 after the ninth migration, `202609230006_signed_energy_writes.sql`. SQL assertions were on; no fixture users, households, vaults, writers or versions remained. Signed-write implementation, tests and deployment limitations are documented in [SIGNED-WRITES.md](SIGNED-WRITES.md). The new backend route is not deployed yet; old clients can no longer save to the migrated dev database.

This is database-test configuration, not a switch of the running app to dev. App API keys and deployment settings remain a separate step. Rotate the development API secret previously shared in chat before using it, and keep the replacement only in ignored local configuration or a deployment secret store. No API secret is stored in this document.
