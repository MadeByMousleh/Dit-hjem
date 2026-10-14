# Eloverblik third-party connection

## Production save and Android return repair (2026-10-13)

Physical-device checks confirmed a PostgreSQL `22P02` binding failure: the real
provider returned an opaque authorization ID despite Swagger documenting UUID.
IDs are now bounded, non-whitespace strings and are URL-encoded for provider
paths. With explicit approval, migration
`202610130001_eloverblik_opaque_authorization_ids.sql` was dry-run and applied
to production. The text column and replacement text-argument RPC preserve
uniqueness, membership, expiry, atomic attempt consumption, RLS and service-role
execution restrictions. The old UUID RPC was removed. A real signed grant was
recovered without signing again; the phone showed `Eloverblik er forbundet`.
Do not revert populated provider IDs to UUID.

Backend/static deployment `dpl_FnGW82YTQXnWMsb4DxfNADDaqbeG` serves both
production domains. Public HTTPS return pages and Android assetlinks return
200. APK 1.0.11/versionCode 12 was built and installed on the paired Samsung
phone without clearing data; both domains are Android-verified and HTTPS return
intents open MainActivity, including a cold launch. The final native build also
retains incoming intents and restores electricity onboarding after saved profile
loading. Custom-scheme matching avoids React Native URL getter limitations.
Return navigation still cannot establish authorization; server verification is
required. Check requests now time out with visible feedback rather than leaving
the onboarding action apparently silent.

Provider, reconnect and actual-hook return tests, TypeScript-only checking,
Gradle release and APK v2 signature verification passed. This APK retains the
existing debug/test certificate. The final cold-start screen could not be
visually inspected while the phone slept. A fresh MitID countdown-to-app
round-trip has not been rerun; the user's countdown report confirms the observed
provider completion UI, not a verified end-to-end redirect. No secret change,
commit or push was performed.

## Local reconnect and app return repair (2026-10-13)

Release update: these repairs were subsequently deployed with user approval in
`dpl_CLuUj8tXLTfEev2FoskxV6e5NpG8` and packaged in APK 1.0.9. Both production
domains now serve the app-return page with HTTP 200 and the repaired client
bundle. Production connection tables and the atomic binding function were
verified using read-only schema queries. MitID account/device round-trip and
registered-company return-domain acceptance remain unverified. The text below
records the local verification boundary before that release.

The application integration is implemented locally; the older sections below
record the original helper investigation. This increment has not been deployed
or included in a new APK.

- Begin, finish and status share provider-backed recovery. An already bound
  household grant is checked against active provider authorizations. A verified
  member can reuse the household connection even if another member created it.
- Status now consumes an approved, unexpired, account/household-scoped attempt
  instead of leaving it pending. Concurrent completion rereads the verified
  binding if another request consumed the same attempt first. Unknown/unkeyed
  general grants cannot be assigned by names, address, meter IDs or grant order.
- Link generation supplies an HTTPS return page on the configured return origin
  (or the trusted template's return origin), defaulting to
  `https://huslyg.dk/eloverblik/return.html`. Old home-page return paths are
  replaced by the implemented path. The server accepts only a platform selector
  from the client, never a client-controlled return destination.
- Native links mark the return with `app=1`; the static page opens the fixed
  `stromblik://eloverblik/connected` URL and retains an explicit open-app button
  if the browser blocks automatic app opening. Web returns to the same origin's
  root page. The landing page is navigation only and never establishes approval.
- The hook checks on foreground, warm deep link and cold-start URL, queues a
  return arriving during an in-flight request, and retries pending approval up
  to three times while foregrounded. Upstream errors stop this retry sequence.

Current public portal source was rechecked: the signed page in
`https://eloverblik.dk/chunk-Vg8fAUU9.js` validates the return URL using the third
party's registered website before redirecting. The older chunk URLs cited below
now return 404. The configured return origin must therefore match the company's
Eloverblik registration; this has not been verified with an authenticated account.
The actual MitID-to-browser transition remains controlled by Eloverblik and its
broker, not by this app's landing page.

Verification: reconnect tests, authorization-link/provider tests, actual-hook
and return-page script tests, TypeScript-only check, server syntax check and Expo
web export passed. Providers, membership and platform events in these tests are
synthetic. The export includes `eloverblik/return.html`. Production rejects
unauthenticated status requests with 401, and the new public return path still
returns 404 before deployment. No real MitID round-trip, device verification,
database migration, environment change, production deployment or APK build was
performed for this increment.

Verified public frontend behavior: 2026-10-08. Local helpers only; not deployed or connected to the application UI/database yet. No authenticated provider calls performed.

## Link creation: resolved

The current ElOverblik portal constructs the power-of-attorney URL locally. A special link-creation API is **not required**. Earlier handoff/chat statements claiming otherwise were incorrect.

The public `GenerateLinkDialog.generateLink` implementation constructs:

```text
https://eloverblik.dk/power-of-attorney?thirdPartyId=...&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&customerKey=...&returnUrl=...
```

`customerKey` and `returnUrl` are optional in the portal. Our automatic connection flow requires a unique random customerKey. The frontend forwards those parameters to its authenticated draft/signing flow; our backend must not imitate portal login or call its session APIs.

Evidence (public assets read without authentication):

- https://eloverblik.dk/chunk-BrZ-0Xgo.js — GenerateLinkDialog constructs the URL using encodeURIComponent for key/return URL.
- https://eloverblik.dk/chunk-CIrBqkE4.js — getAgreementDraft forwards thirdPartyId, returnUrl, customerKey, fromDate and toDate.
- https://eloverblik.dk/chunk-JNNr1wu8.js — signed page validates the return URL against the third party's registered website, then navigates to that URL. It does not itself attach a signed grant receipt.
- https://api.eloverblik.dk/thirdpartyapi/swagger/thirdpartyapi-v1.0/swagger.json — AuthorizationDto uses string `id` (documented UUID), `validFrom`, `validTo`, optional `customerKey`. The visible portal number must not be assumed to be the API id.

These assets establish current portal behavior, not a versioned integration guarantee. An authenticated end-to-end test remains required.

## Server configuration

- `ELOVERBLIK_THIRD_PARTY_API_TOKEN`: rotated Third Party API refresh token, server only. Never use the value exposed in conversation. No EXPO_PUBLIC prefix.
- `EL_OVERBLIK_AUTH_LINK`: paste the general company link generated in the portal once. The helper copies its company and dates, replaces any static customerKey, and drops unknown parameters. The previous name `ELOVERBLIK_AUTHORIZATION_URL` remains a fallback when `EL_OVERBLIK_AUTH_LINK` is unset.
- `ELOVERBLIK_RETURN_URL`: optional HTTPS return on the company's registered domain. Use an actually implemented page; no callback page is added by this increment. Without it, the customer can return to the app manually during testing.

The helper accepts the current portal path and the older `/Authorization/authorization` path, then emits the current path. Expired/invalid templates fail closed. Renewal/date expansion is not performed silently. Neither token nor firm ID is extracted from the token exposed in chat. Local config checks found token variable names but no configured authorization URL.

## Implemented locally

- `eloverblik-authorization-link.mjs`: 256-bit random customerKey per attempt, portal-compatible URL generation, user/household identifiers and 30-minute attempt expiry; provider verification of an exact key match.
- `eloverblik-third-party.mjs`: official DTO field parsing; unkeyed grants remain readable internally but cannot match automatic attempts. Duplicate key matches fail closed. Redirects are rejected on bearer-authenticated requests and raw network errors are not exposed.

## Remaining application integration

1. Authenticated start endpoint checks household membership, creates an attempt and persists it before returning the URL. Browser-provided user IDs, customerKeys or grant IDs must never establish ownership. Store server-side attempts; do not expose a company-wide grant list.
2. Browser/app opens the URL. The return page is navigation only, never proof of approval. Completion requires the initiating authenticated user/session and a server-loaded unexpired attempt.
3. Query active authorizations for the exact server-issued key. Missing grants remain pending; provider failures are not equivalent to missing grants. Atomically consume the attempt and bind the provider UUID to the household with a database uniqueness constraint. Reject replays, concurrent completion, ambiguous grants and attempts from another user/household. Subsequent requests use the stored binding and current membership.
4. Retrieve only this bound authorization's meters; check active authorization before data retrieval. An expired/deleted grant stops new retrieval. Do not substitute another grant by timestamp/name/address.
5. Add the connection UI, browser/app resume handling and encrypted-vault import, then test the full flow with two users and revocation in isolated dev.

Third-party retrieval means the backend can see provider data and connection metadata. Existing client-encrypted backups can remain encrypted, but the new retrieval path cannot be described as zero-knowledge. Do not bypass the existing plaintext-write protections or upload recovery keys to implement it.

## Verification

```text
node --test --test-isolation=none scripts/test-eloverblik-third-party.mjs scripts/test-eloverblik-authorization-link.mjs
```

Eight synthetic tests pass: portal URL construction, unique attempts, template replacement, destination/date validation, ownership/expiry rejection before upstream calls, exact/ambiguous/unkeyed grant behavior, concurrent token exchange reuse and network-error redaction. No real customer data or credentials are used. These helpers alone do not implement database authorization or prove a successful MitID round-trip.
