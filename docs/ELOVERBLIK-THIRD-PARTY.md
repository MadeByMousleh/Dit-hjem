# Eloverblik third-party connection

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
