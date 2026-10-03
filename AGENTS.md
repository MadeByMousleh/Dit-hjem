# Agent handoff: Dit-hjem / Strømblik

Read [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md) before environment, database, auth, or deployment work. Read [supabase/ENCRYPTED-ENERGY.md](supabase/ENCRYPTED-ENERGY.md) before changing electricity storage or cryptography.
Read [docs/SMARTTHINGS.md](docs/SMARTTHINGS.md) before changing the SmartThings integration.

## Environment safety

- Development database: `dit-hjem-test`, project ref `wsdomkzhnksyjrpxqfvn`.
- Production database: `mit-hjem`, project ref `arkpfdsglgufnnukader`.
- `dev` is the development branch; `main` is the production code line. **Switching Git branches does not switch databases or API settings.** Automated deployment connections have not been verified.
- The local Supabase CLI link was last verified pointing at **production**. Never assume `--linked` alone is safe. Use the explicit dev reference and commands in [supabase/DEV-TESTING.md](supabase/DEV-TESTING.md).
- Do not use `npm run db:migrate`, `db:plan`, `db:status`, or `db:link` as a dev shortcut: the wrappers rely on the default link/environment. Do not relink production to perform development work.
- Default to dev with synthetic data. Production migrations, auth changes, destructive cleanup and releases require explicit user approval. Never reset the production database.
- `.ENV` / `.env` and deployed settings may contain real credentials. Do not print, commit, or copy them into docs. Do not change them merely to run database tests. Only public client configuration belongs in `EXPO_PUBLIC_*`.
- A development API secret was shared in chat. Its rotation is **not confirmed**. Do not recover or reuse it from conversation history; ask the user to rotate privately if still outstanding. The CLI tests use the CLI account login, not that API secret.

## Current handoff (2026-09-28; verify before acting)

- Local SONFOR waste increment, 2026-10-03: added a Sønderborg (`0540`) RenoWeb adapter to `/api/waste/calendar`. It uses the provider's public app identifier server-side, resolves road → address → containers, deduplicates collections and returns dates/categories through the existing waste UI. `src/waste.ts` now uses the configured/same-origin API URL, so hosted web does not call localhost. Synthetic adapter and live public-provider lookup passed; no real household address was used. No deployment, database or environment changes.

- Browser provider release, 2026-10-03: deployed with explicit user approval to `https://huslyg.dk` and `https://dit-hjem-five.vercel.app`, deployment `dpl_6GkgLMXyfeGZu8guYfcjjcgdST2J`. Compared source hashes with the previous production deployment: only the four approved browser provider runtime files differed; other runtime/API files matched and no runtime files were added. Both homepages and new bundle return 200, include browser connection forms/session notice, and exclude old provider web blockers. Auth config still selects production Supabase; unauthenticated Tesla/SmartThings status returns 401. No database migration, auth/environment change or Git push. Real-account browser provider login/import remains unverified.

- Local browser provider increment, 2026-10-03: enabled electricity token entry and heat login/refresh on web using direct upstream requests and session-memory credentials. Heat uses browser-compatible MD5 for the provider challenge. Synthetic electricity/heat browser flows, vault/crypto/signing suites, TypeScript-only check and Expo web export pass. Provider GET/POST CORS preflights allow the production origin; real-account browser verification and production deployment remain outstanding. No environment, database or backend auth changes.

- Production code checkpoint, 2026-10-03: the current workspace web app/API was deployed with explicit user approval to `https://huslyg.dk` and `https://dit-hjem-five.vercel.app` (deployment `dpl_FLSjfKeLYbdm5qDcGfu1Kqw7PCoG`). Both homepages serve the new bundle; auth config returns the production Supabase project; unauthenticated Tesla/SmartThings status checks reject access. SmartThings endpoints now share `api/smartthings/[action].mjs` to keep the deployment within the 12-function Hobby limit. No database migration, secret/configuration change, or external Tesla proxy deployment was performed. TypeScript and ten local crypto/vault/provider/alert suites passed; `test-consumption.mjs` has one unresolved partial-first-year total failure (null versus 100 kWh). Native connection input changes still require an app rebuild and phone verification; Vercel web remains history-only for electricity/heat connections. SmartThings OAuth, authenticated signed writes and physical-device flows remain unverified.

- All ten repository migrations through `202609280001_tesla_connections.sql` were applied to dev. The first nine rollback-only SQL suites passed, assertions enabled, no fixture users/households/vaults/writers/versions remained. The Tesla migration has local mocked-flow coverage only; it has not been exercised through a deployed dev backend or a physical phone.
- Production was migrated through `202609280001_tesla_connections.sql` and the matching current worktree was deployed to `https://dit-hjem-five.vercel.app` on 2026-09-28. Safe endpoint checks passed: auth config 200, unauthenticated Tesla status 401, invalid Tesla callback 400. A real Tesla OAuth login, signed vault write and Android physical-device flow have not been verified; do not call those successful without evidence.
- Tesla OAuth is now designed for a per-user encrypted server-side connection and Android deep-link return (`stromblik://tesla/connected`). It requires an isolated HTTPS dev backend, matching dev Supabase settings, a Tesla-registered dev callback URL, and a rebuilt Android development app before physical-device verification. Do not deploy it to production or reuse production Tesla/Supabase settings for this test.
- Security step **1a** provides encrypted history/recovery. **1b** adds Ed25519-signed writes through a server-only gateway; the old login-only RPC is revoked on dev and production. Code/local tests and dev DB tests pass; matching code is deployed, but an end-to-end signed-write request is NOT yet verified. Existing unregistered vaults remain readable but write-locked; their trusted transition is NOT implemented. Read [supabase/SIGNED-WRITES.md](supabase/SIGNED-WRITES.md). Do not call the system production-ready.
- Further work includes key/device revocation, secure session storage, cache-corruption recovery, onboarding/background behavior, native phone tests, SMTP/code-login setup, dependency remediation, and approved cleanup of legacy plaintext/server credentials.
- Keep work step-by-step. Finish an agreed increment, report verification and remaining risks, and do not silently expand into production deployment.

## Working conventions

- Check `git status` and preserve existing user changes. Commit/push only when requested; do not automatically push later changes because an earlier push was requested.
- Root `AGENTS.md` is the short entry point; keep detailed architecture and commands in the linked guides. Update handoff status after verified milestones, distinguishing local code, dev database and production deployment.
- Load `.agents/skills/supabase-server/SKILL.md` before applicable backend auth/client changes. Do not rewrite crypto or auth protocols without reviewing their documented limitations and tests.
- Local checks: `node scripts/test-vault-crypto.mjs`, `node scripts/test-energy-vault-client.mjs`, `node scripts/test-private-electricity.mjs`, `node scripts/test-consumption.mjs`, `node scripts/test-background-usage.mjs`.
- Signed-write checks: `node scripts/test-vault-signing.mjs`, `node scripts/test-vault-write-server.mjs`. Next verification increment: isolated dev backend setup and deployed end-to-end signed-write test; requires private configuration with a rotated dev secret. Do not deploy to production.
- `npx tsc --noEmit --allowJs false` is the previously passing TypeScript-only check. It is not the same as a clean full `npm run typecheck`; the existing `update_page.js` helper has known parse issues. Do not silently delete or rewrite it.
- SQL tests, mock client tests, bundle exports and physical-device tests prove different things. Report which actually ran.
