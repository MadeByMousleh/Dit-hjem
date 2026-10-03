# SmartThings integration handoff

Last updated: 2026-10-03. SmartThings endpoint code is deployed to Vercel production, but the API Access App integration is not configured or verified as working.

## Current status

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

No SmartThings credentials, account connection, database migration, Vercel environment change, or SmartThings command has been performed. Do not report the integration as connected or verified.

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

- Use an official SmartThings **API Access App** and OAuth 2.0 authorization-code flow. Do not use a Personal Access Token for a lasting integration; SmartThings documents PATs as short-lived testing credentials.
- Tokens are AES-256-GCM encrypted before entering `smartthings_connections`. They are accessed only by the authenticated server through its Supabase admin client. The table has RLS enabled and no grants for `anon` or `authenticated`.
- Never place `SMARTTHINGS_CLIENT_SECRET`, access tokens, refresh tokens, or device responses containing credentials in `EXPO_PUBLIC_*`, source control, client logs, fixtures, or chat.
- The OAuth request deliberately asks for device-selection scopes, not all-device scopes:

  ```text
  r:locations:* r:devices:$ x:devices:$
  ```

  SmartThings should prompt the user to select the devices it may read/control. The `$` scopes are important; do not silently broaden them to `*`.
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

### Current platform limitation (verified 2026-09-30)

SmartThings' current API Access App documentation says that registration is
"coming soon and is not yet available." This explains why the Developer Center
does not show **Service Integrations** or **Register New App** for this
account. Do not substitute a Schema App: it cannot provide the OAuth client
credentials Dit-hjem needs. The OAuth endpoints in this repository are kept as
the intended implementation, but cannot be completed or deployed as a working
user-linking integration until Samsung enables API Access App registration.

The only interim option is a manually created SmartThings Personal Access Token
(PAT) for short-lived development/testing. New PATs are valid for about 24
hours, so they are not suitable for a user-facing or production integration:
they would require each user to issue and enter a new secret every day. A PAT
must be stored only as a server-side secret, never in the app, source control,
logs, or chat. Do not implement a permanent "paste your PAT" product feature;
wait for API Access App OAuth registration instead.

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

## Repository and environment rules

- Read `AGENTS.md` and `docs/ENVIRONMENTS.md` before database/auth/deploy work.
- Load `.agents/skills/supabase-server/SKILL.md` before changing server auth/Supabase code.
- Production database: `arkpfdsglgufnnukader`; development database: `wsdomkzhnksyjrpxqfvn`. Git branches do not select a database.
- Do not print or use secrets from `.env` merely to run tests.
- Do not commit, push, migrate, deploy, or modify Vercel environment settings unless the user explicitly asks for that action.
