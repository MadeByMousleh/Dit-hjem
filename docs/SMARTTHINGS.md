# SmartThings integration handoff

Last updated: 2026-10-15. The customer-facing SmartThings page and OAuth-In repairs are deployed and included in test APK 1.0.13. Real Samsung login and physical-device control remain unverified.

## Approved production/APK release, 2026-10-15

### CLI scope correction release

- Explicitly approved deployment `dpl_4NPAECmYNhaoWputwVZy87K467UV` is READY on both production domains. CLI mode requests the registered `r:locations:* r:devices:* x:devices:*` scopes; API Access mode retains `$` scopes. Fresh authorization is required. Read-only CLI verification confirmed those three registered scopes; no provider registration/credentials were changed.
- Source comparison confirms only server helper and backend test changed, 335 files unchanged; all twelve functions in fra1. Backend/UI synthetic tests and public protection/callback/Auth checks pass. Rollback: `dpl_Bv8nqEuuU8eEqnFPnCcG7kJKvqZ4`. Evidence: `.tmp/smartthings-diagnostics-evidence/release.json`.
- No APK, DB/auth/secret changes, commit or push. Actual device listing after reauthorization awaits the user's phone test.

### Connection diagnostics follow-up, 2026-10-15

- User reports successful Samsung login/location selection and return, followed by the generic reconnect error. Actual upstream rejection is not yet confirmed.
- Explicitly approved deployment `dpl_Bv8nqEuuU8eEqnFPnCcG7kJKvqZ4` is READY on both production domains. Only `src/services/smartthings-server.mjs` and its synthetic test changed; 335 source files unchanged. All twelve functions remain in fra1; web bundle unchanged. Rollback: `dpl_1jU4pBPiPfJinwiLBo7R9eFCKGNf`.
- Device-list 401 still requires reconnect; 403 now reports denied device permissions without marking the stored connection disconnected. Unreadable stored tokens have a separate message. No scope expansion or provider configuration change.
- Diagnostic event `smartthings_connection` contains only fixed `stage` (`stored_token`, `token_refresh`, `token_exchange`, `device_list`) and numeric HTTP `status` (0 for unreadable stored tokens). No raw errors, payloads, URLs, identities, tokens or device details are logged by this diagnostic.
- Backend/UI synthetic tests, TypeScript-only, source-hash comparison, public protected-route/callback checks and production Auth target checks pass. Evidence: `.tmp/smartthings-diagnostics-evidence/release.json`. No new APK required, DB/auth/secret changes, commit or push. Await a new user connection attempt to identify the actual rejection; this is diagnostic/error-handling repair, not confirmed provider-access repair.

- Deployment `dpl_1jU4pBPiPfJinwiLBo7R9eFCKGNf` is READY on `https://huslyg.dk` and `https://dit-hjem-five.vercel.app`; both serve `AppEntry-a9846ebf34f6e4d2219cb02395bf4f59.js`. Production Auth remains selected. Five authenticated SmartThings endpoints reject unauthenticated requests with 401/no-store; callback without state is rejected with 400/no-store. Existing connection/public address/app-return checks pass.
- Release staged from active deployment `dpl_68hGsdQ7WRdBK6WTzkVGvCCV7sPG`, whose source matched the preceding widget release exactly. Source hashes verify 323 unchanged files and only the fourteen allowlisted SmartThings/version/test additions or modifications; every uploaded source hash matches the staged release. All twelve API functions remain in fra1. The unrelated local charger UI was excluded.
- Rollback checkpoint: `dpl_68hGsdQ7WRdBK6WTzkVGvCCV7sPG`. Redacted release evidence: `.tmp/smartthings-release-evidence/release.json`.
- APK: `dist/Stromblik-1.0.13.apk`, versionCode 14, 78,088,454 bytes, SHA256 `746E5D4A23C6CB344C0826AD7191CF43DD748514EF8DF608344B6F01874BF2F5`. Gradle release build, metadata, APK v2 signature and certificate continuity with 1.0.12 verified. Existing debug/test certificate SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` retained.
- Android bundle is built from the same isolated app sources as the web release using `.tmp/smartthings-production-release/index.native-release.js` and Gradle property `-Pstromblik.entryFile=C:/Users/mbm/source/Dit-hjem/.tmp/smartthings-production-release/index.native-release.js`. `EXPO_NO_DOTENV=1`, production `EXPO_PUBLIC_API_URL`, Java 17 and the existing Android SDK were explicitly selected. The packaged bundle equals the Gradle output; source maps confirm staged-only app sources and no ChargerPage. Production API, custom-scheme SmartThings return and widget markers are present; local SmartThings credential values are absent. The Android manifest retains the stromblik scheme and singleTask activity.
- No DB migration, auth/secret/config change, commit or push. No physical installation or Samsung consent/device-command test was performed; these are the user's next phone tests. Test at Mit hjem → Apparater → SmartThings → Forbind SmartThings.

## 2026-10-15 increment

- The user created an OAuth-In app using SmartThings CLI and saved credentials privately. Presence-only checks confirm the three required local variables, the expected production callback, and corresponding Vercel Production/Preview variable registrations. Values were not printed or copied. Preview registrations alone do not establish an isolated dev environment.
- CLI-created OAuth-In apps use `https://api.smartthings.com/oauth/authorize` and `/oauth/token`, per the current official [quickstart](https://developer.smartthings.com/docs/getting-started/quickstart). `SMARTTHINGS_OAUTH_MODE` defaults to `cli`; an actual newer API Access App can explicitly select `api-access` to retain the `/v1/oauth` endpoints. Device calls remain under `/v1` in both modes.
- Apparater → SmartThings provides connect/select devices, refresh, selected-device statuses, supported switch controls and local connection removal. Parent/header/Android back returns to Apparater. OAuth return is handled at the persistent Dashboard level for web and warm/cold native intents. Initial native links are not replayed whenever the tab changes.
- Daily use requires no raw tokens or networking setup. Devices are limited by the granted OAuth rights; see the CLI scope correction below. The backend follows bounded device pagination only on the SmartThings device-list origin/path; status is fetched separately for the legacy API, in groups of five with a 24-second aggregate budget and a 100-device cap. Missing device statuses are explicitly marked.
- Initial controls only support the standard `switch` capability (`on`/`off`, zero arguments). The backend checks device ownership and the requested component's capabilities before forwarding. Other capabilities are read-only/unsupported until implemented from the actual device model. Command acceptance never changes the displayed physical state optimistically.
- Tokens remain encrypted server-side. HMAC state validation uses timing-safe comparison and validates expiry; errors hide raw upstream/network/database detail. Refresh is deduplicated within a function instance. Cross-instance refresh rotation, server-persisted one-use authorization attempts, event subscriptions/signature verification and automatic uninstall cleanup remain follow-up work.
- Removal deletes this user's saved connection from Strømblik. It does not claim provider-side revocation; the UI explains that authorization can also be removed under SmartThings Linked services. All seven routes still share the existing single Vercel function. The local server now routes those same handlers.
- Read-only production schema verification confirms `smartthings_connections` exists, RLS is enabled, anon/authenticated cannot SELECT, and the backend service role can write. No migration or customer data access was performed. Public status endpoints return 401/no-store on both production domains.
- `node scripts/test-smartthings.mjs` and `node scripts/test-smartthings-ui.mjs` pass with synthetic provider/storage/platform adapters; existing widget/charger tests and TypeScript-only checks pass. Local Expo web export passes at `.tmp/smartthings-web` with dotenv disabled and explicit dev API selection. No real credentials are embedded in that build.
- The initial local preparation made no production/config/database changes; the subsequent approved deployment and APK are recorded above. Real OAuth and physical-device control must still be checked separately.

## Current status

### Local compact cards, fallback energy catalog and program controls

Subsequent approved release: production backend `dpl_42CT3yXX6u7dxUtxcYj2f677VBKe` READY on both domains, source comparison only server/test changed (335 unchanged), twelve functions in fra1, route/Auth/callback checks pass. Rollback `dpl_DBeQzeenj5mbNoHbHppYTRyx6j5F`. New UI is native-only; web bundle unchanged.

APK `dist/Stromblik-1.0.18.apk`, versionCode 19, 74,382,070 bytes, SHA256 `07F35B4832965E9FDA1791F692AEB50943AA4EAA2844A4B0AA968F9EE859752A`. Gradle/aapt/v2 signature, existing debug/test certificate continuity, packaged-bundle equality, six SmartThings/catalog source-map matches and ten widget source-map checks pass. Production API embedded, unrelated ChargerPage excluded. Installed with data retained over Wi-Fi on Samsung SM_A576B; launch, running process and installed version verified. Real program selection/start and visual phone behavior remain unverified. No real appliances were started by the agent, no DB/auth/secret changes or commit/push. User requests automatic new APK build/install after app changes whenever the phone is connected.

2026-10-15: Added compact appliance cards with reported power/operation/program and estimated kWh/period. Tap opens a scrollable modal with program selection, power controls, model, status time and estimate assumptions. Fourteen major appliance categories receive broad planning estimates when exact reviewed model/program data is missing; these are not measured averages. See [APPLIANCE-ENERGY.md](APPLIANCE-ENERGY.md) for ranges, assumptions and source boundaries.

Program setting is limited to the two discovered producer program capabilities and provider-reported available programs. Start uses the discovered start/stop capability, requires current power-on/ready operation and expected selected program, and confirms before sending. Server rechecks live state; rejected/missing/changed programs and active/error/offline states cannot start. Provider ACCEPTED remains distinct from physical completion. No automatic chained power/program/start commands or actual device-control test occurred.

Backend synthetic tests cover accepted program/start, unavailable program, missing component, running state, powered-off state and changed selection. Hook/JSX tests cover model-first/category fallback, fourteen categories, compact cards versus detail controls, disabled starts and account isolation. Local Chrome tests exercise actual JSX/modal/selection/estimates and switch/start sequencing at mobile widths using synthetic API only. TypeScript-only passes. No deployment, new APK, database/auth/secret changes, commit or push for this increment.

### Local appliance/energy UI, 2026-10-15

- Subsequent approved release: backend deployment `dpl_DBeQzeenj5mbNoHbHppYTRyx6j5F` READY on both domains; only backend/test changed (335 files unchanged), twelve functions in fra1, production Auth and public route protection verified. Rollback `dpl_4NPAECmYNhaoWputwVZy87K467UV`. Web UI remains the preceding release; the new UI is in the APK.
- APK `dist/Stromblik-1.0.17.apk`, versionCode 18, 74,370,178 bytes, SHA256 `C5373693FC8152BB095A72678396242B777971E840530E5066858CA98C7EEA96`. Gradle, aapt, v2 signature with existing debug/test certificate, packaged bundle equality, production API and SmartThings/widget staged source-map checks pass. Built from `.tmp/storage-repair-release` preserving widget/storage repairs and excluding unrelated ChargerPage.
- Installed with `adb install -r` over Wi-Fi on Samsung SM_A576B; launch and installed version verified. Data retained; authenticated UI/program estimates and visual phone behavior await user verification. No commit/push, database, auth or credential changes.

- User confirms actual device discovery works following CLI scope correction. Read-only CLI discovery identified Bosch SMD6ZC804E and HBG9742B1S; commands were not executed.
- Local backend now returns allowlisted manufacturer/model metadata and six discovered producer capabilities (program lists, selected program, operation, duration, pause and start/stop) with timestamps. No arbitrary metadata/status objects or credentials are returned.
- Local UI identifies ovens/dishwashers/washers from capabilities, shows separate power/operation/program states, status timestamp and available programs. Status failures show unavailable rather than asserting on/off. Existing switch-only controls remain.
- `src/utils/applianceEnergy.ts` contains the first reviewed exact manufacturer/model/program catalog entries: Bosch SMD6ZC804E Eco50 0.645 kWh and MachineCare 1.35 kWh, sourced from https://media3.bosch-home.com/Documents/9001914980_B.pdf (reviewed 2026-10-15). UI labels estimates as laboratory standard-program values, links the source and notes load/options can change consumption. No invented accuracy interval or multipliers. Ambiguous Auto/Kurz mappings and oven energy-label test cycles are not treated as program estimates.
- This is an initial finite catalog, not automatic EPREL/manufacturer ingestion or broad model coverage. Unknown models/programs show unavailable. No price estimate, per-run measurement or personal calibration is implemented. Native clients require a rebuild; backend and web release have not been deployed for this increment.

The following files are present locally and uncommitted:

- `api/smartthings/[action].mjs` — single Vercel function routing all six endpoints within the Hobby function limit.
- `src/services/smartthings-server.mjs` — server-only OAuth, encrypted token storage, device discovery and command forwarding.
- `src/server/smartthings/authorize.mjs` — authenticated OAuth start endpoint.
- `src/server/smartthings/callback.mjs` — OAuth callback endpoint.
- `src/server/smartthings/status.mjs` — authenticated connection status endpoint.
- `src/server/smartthings/devices.mjs` — authenticated selected-device list/status endpoint.
- `src/server/smartthings/command.mjs` — authenticated command endpoint.
- `src/server/smartthings/webhook.mjs` — SmartThings Target URL confirmation endpoint.
- `supabase/migrations/202609300001_smartthings_connections.sql` — encrypted server-only connection table.
- `.env.example` — names of the required server-only environment variables.

On 2026-10-03, endpoint code was deployed with the current workspace to `https://huslyg.dk` and `https://dit-hjem-five.vercel.app`. All six URLs share one Vercel function, with handlers under `src/server/smartthings/`. Local routing checks passed for unauthenticated status/devices/authorize/command rejection, POST restrictions and unknown actions. Deployed status/devices returned 401 without credentials and webhook GET returned 405 on both production domains. These checks do not exercise OAuth or database storage.

The statements below describe the original 2026-10-03 baseline unless superseded by the 2026-10-15 increment above. Credentials/table presence are now confirmed, but no real account connection or device command has been verified.

The local checks completed so far are:

```powershell
node --check src/services/smartthings-server.mjs
node --check src/server/smartthings/authorize.mjs
node --check src/server/smartthings/callback.mjs
node --check src/server/smartthings/status.mjs
node --check src/server/smartthings/devices.mjs
node --check src/server/smartthings/command.mjs
node --check src/server/smartthings/webhook.mjs
npx tsc --noEmit --allowJs false
git diff --check
```

These are syntax/type checks only. No mocked SmartThings test, dev database migration, deployed endpoint test, OAuth approval, or physical appliance test has run yet.

## Security model

- Use OAuth 2.0 authorization-code flow with an official CLI-created **OAuth-In App**, or the newer **API Access App** when available. Do not use a Personal Access Token for a lasting integration.
- Tokens are AES-256-GCM encrypted before entering `smartthings_connections`. They are accessed only by the authenticated server through its Supabase admin client. The table has RLS enabled and no grants for `anon` or `authenticated`.
- Never place `SMARTTHINGS_CLIENT_SECRET`, access tokens, refresh tokens, or device responses containing credentials in `EXPO_PUBLIC_*`, source control, client logs, fixtures, or chat.
- OAuth scopes depend on the registered app type. On 2026-10-15 a read-only CLI check confirmed the user's API_ONLY app is registered with `r:locations:*`, `r:devices:*`, `x:devices:*`. The user explicitly approved matching those scopes after Samsung login succeeded but device listing returned 403. CLI mode requests:

  ```text
  r:locations:* r:devices:* x:devices:*
  ```

  This grants read/control access in the location approved by the customer. API Access mode retains device-selection scopes `r:locations:* r:devices:$ x:devices:$`. Existing tokens require a new authorization to obtain updated rights. Physical provider success remains pending the user's retry; the mismatch is verified but has not yet been proved the sole cause of the 403.
- `smartThingsCommand` confirms that the requested device can be fetched using the user’s OAuth token before it submits a command. It accepts a structured component/capability/command request only; clients must not construct a URL.
- SmartThings command responses marked `ACCEPTED` mean queued, not completed. The current implementation has no event subscription/UI state-confirmation yet. Refresh status after a command and add signed webhook/event handling before claiming real-time confirmation.
- `src/server/smartthings/webhook.mjs` currently serves only registration confirmation. It permits an outgoing confirmation request solely to `https://api.smartthings.com/v1/apps/<app-id>/confirm-registration`. It returns `204` for other lifecycle events. Do not treat it as a finished webhook/event implementation.

## Required configuration

The following Vercel variables must be Production **server-only** secrets/configuration, never app-exposed values:

```text
SMARTTHINGS_CLIENT_ID=<from SmartThings Developer Center>
SMARTTHINGS_CLIENT_SECRET=<from SmartThings Developer Center; secret>
SMARTTHINGS_REDIRECT_URI=https://dit-hjem-five.vercel.app/api/smartthings/callback
```

For an isolated development backend, use the preview/dev hostname in `SMARTTHINGS_REDIRECT_URI`, register that exact URI separately with SmartThings, and set credentials only in Vercel Preview. Development must use the development Supabase project (`wsdomkzhnksyjrpxqfvn`), never production settings.

## SmartThings Developer Center setup

Do this only after the callback and webhook endpoints are deployed and reachable over HTTPS:

### Important: do not register a Schema App

The Developer Center page titled **"Register New Schema App"** is the wrong
product for Dit-hjem. A Schema App is for a device manufacturer that operates
its own device cloud and OAuth server. Its fields such as **Device Cloud
Credentials**, **OAuth URL**, **Token URL**, and app-to-app links describe the
manufacturer's infrastructure. Dit-hjem does not operate Samsung's dishwasher
cloud, so do **not** enter URLs, invent client credentials, or submit that form.

If that page is currently open, leave it without registering an app. Go back to
the Developer Center and look specifically for **Service Integrations** and
**API Access App** (sometimes shown as "Register New App" under Service
Integrations). This is the OAuth client type required to let a Dit-hjem user
grant access to their existing SmartThings devices.

### Console availability and the CLI route (updated 2026-10-15)

SmartThings' current API Access App documentation says that registration is
"coming soon and is not yet available." This explains why the Developer Center
does not show **Service Integrations** or **Register New App** for this
account. Do not substitute a Schema App: it is a different integration type.
The official quickstart separately documents `smartthings apps:create` →
`OAuth-In App` for obtaining OAuth credentials. The user has now completed
that CLI registration. Console availability is therefore not a blocker to
preparing this OAuth-In integration; real account approval remains unverified.

A Personal Access Token (PAT) is only a short-lived development/testing option,
not the customer connection flow. Keep OAuth for lasting connections.

1. Sign in to the SmartThings Developer Center with the Samsung developer account.
2. Create a **Service Integration / API Access App**.
3. Use a display name such as `Strømblik`.
4. Register the callback URL:

   ```text
   https://dit-hjem-five.vercel.app/api/smartthings/callback
   ```

5. Set the Target URL for verification/webhooks:

   ```text
   https://dit-hjem-five.vercel.app/api/smartthings/webhook
   ```

6. Request exactly:

   ```text
   r:locations:* r:devices:$ x:devices:$
   ```

7. Complete Target URL confirmation. SmartThings sends a `CONFIRMATION` payload to the webhook endpoint; the deployed handler follows only the documented SmartThings confirmation URL.
8. Add the generated client ID, client secret and exact redirect URI to Vercel through a secure environment-variable workflow. Do not paste credentials into chat or commit them to `.env.example`.

References: [SmartThings API Access App setup](https://developer.smartthings.com/docs/service-integrations/app-setup), [OAuth flow](https://developer.smartthings.com/docs/service-integrations/oauth), [device discovery](https://developer.smartthings.com/docs/service-integrations/query-and-list-devices), and [commands](https://developer.smartthings.com/docs/service-integrations/control-devices).

## Promotion sequence

Production changes require explicit user approval. Do not infer it from this document.

1. Inspect all uncommitted changes. The worktree also contains unrelated/current Tesla and proxy work; preserve it.
2. Add a focused mocked-flow test for `smartthings-server.mjs`, including state binding, token encryption/decryption, refresh, device filtering and rejected commands.
3. Review the new migration. Apply it to **development only** using an explicit target:

   ```powershell
   npx supabase db push --linked --project-ref wsdomkzhnksyjrpxqfvn
   ```

   First confirm the CLI target and follow `supabase/DEV-TESTING.md`. Do not use `npm run db:migrate`, `db:plan`, `db:status`, or bare `--linked`.
4. Deploy to an isolated Vercel Preview environment with only development SmartThings/Supabase configuration. Verify:
   - unauthenticated API requests are rejected;
   - callback rejects invalid/missing state;
   - Target URL confirmation succeeds;
   - a real OAuth login returns to `stromblik://smartthings/connected` on a rebuilt Android development app;
   - only selected devices are listed.
5. Add a dedicated mobile UI/hook before production: connect/disconnect, device list, capability-aware controls, pending/error states and a visible refresh. Do not expose raw token or capability payloads unnecessarily.
6. For a dishwasher, inspect its actual components/capabilities after OAuth. Do not assume a `switch` capability or invent commands. The current generic command endpoint accepts a capability/command supplied by the caller, so the UI must expose only commands obtained from the selected device's supported capabilities.
7. Add SmartThings event subscriptions and signature verification if the UI needs command completion/state updates without polling. Handle uninstall events by deleting the encrypted connection for that user.
8. Obtain separate explicit approval for production migration, Vercel secret changes and deployment. Then target production explicitly (`arkpfdsglgufnnukader`) and perform safe endpoint checks before OAuth/device testing.

## API contract implemented locally

All application-facing routes require the user's Supabase Bearer token except callback and webhook confirmation.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/smartthings/authorize` | `POST` | Returns the SmartThings authorization URL. Body may include `returnTo: "stromblik://smartthings/connected"`. |
| `/api/smartthings/callback` | `GET` | Exchanges a validated OAuth authorization code and redirects to the app/web. |
| `/api/smartthings/status` | `GET` | Returns `{ connected }`. |
| `/api/smartthings/devices` | `GET` | Returns selected devices, components, capabilities and SmartThings-provided status. |
| `/api/smartthings/command` | `POST` | Accepts `{ deviceId, component, capability, command, arguments }`; SmartThings must return `ACCEPTED`. |
| `/api/smartthings/webhook` | `POST` | Handles Target URL `CONFIRMATION` only; lifecycle/event handling is pending. |
| `/api/smartthings/disconnect` | `POST` | Removes the authenticated user's encrypted connection from Strømblik; does not claim provider-side revocation. |

## Repository and environment rules

- Read `AGENTS.md` and `docs/ENVIRONMENTS.md` before database/auth/deploy work.
- Load `.agents/skills/supabase-server/SKILL.md` before changing server auth/Supabase code.
- Production database: `arkpfdsglgufnnukader`; development database: `wsdomkzhnksyjrpxqfvn`. Git branches do not select a database.
- Do not print or use secrets from `.env` merely to run tests.
- Do not commit, push, migrate, deploy, or modify Vercel environment settings unless the user explicitly asks for that action.
