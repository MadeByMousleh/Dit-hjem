# Sønderborg Varme: first native integration

## Production network diagnostics (2026-10-13)

User-reported connection failure was confirmed as HTTP 502 on production.
The public supplier portal and synthetic-customer challenge endpoint answered
from the local machine; this does not prove connectivity from Vercel.
With explicit approval, deployed `dpl_7xMxHU4SUENdmoR8H9FD823uTKo8`, ready
on both production domains. Compared all 354 source hashes with the previous
production deployment: only `src/services/heating-connection-server.mjs`
changed. `heating_upstream_failed` records a fixed stage label, HTTP status,
elapsed time and allowlisted transport codes. URLs, credentials, identifiers,
raw messages, response bodies and error objects are never logged. Synthetic
stage/redaction tests, existing persistence/encryption tests and TypeScript-only
check pass. No auth, database, credential-key or APK changes. Root cause and
successful real supplier login remain unverified pending another phone attempt.

Fresh phone attempt at `2026-10-13T21:03:37Z` identified
`UND_ERR_CONNECT_TIMEOUT` at `challenge`, before any HTTP response, after
10,483 ms. Request logs reported `fra1` on Node.js 24, but later deployment/project
inspection confirmed the function actually runs in `iad1`; request-log region
must not be used as proof of function placement. Supplier's public
configuration still selects `https://apiapp.dff-edb.dk/sdbg/`. Local DNS resolves
one IPv4 address and no IPv6 records; the synthetic challenge probe works locally.
This confirms a production-to-provider connection failure, not credential
rejection. It does not establish whether supplier filtering or another network
path issue causes it. No routing, region or credential-storage changes applied.

Approved isolated region tests: separate Vercel project
`stromblik-heat-probe-20261013` (`prj_HtHUHn6kVnEodCoxafhMfFOar6Mn`), no
configured environment variables or database/provider credentials. Fixed GET
probe requests challenge for synthetic consumer `0`, exposing only status,
timing, DNS and whether the response has a Token field, never the token itself.
Verified actual runtime region in responses: Frankfurt deployment
`dpl_AUW7ggstFB6g5ZC5cct7uyLiwAMg` returned HTTP 200 on 3/3 probes
(150/60/61 ms); Stockholm `dpl_8qiimMRM2qZ5MHxPmdkgy8tXc9Fs` returned
HTTP 200 on 3/3 probes (140/57/56 ms). Earlier default-region probes actually
ran in `iad1`, not the intended regions, and timed out; they do not establish
Frankfurt/Stockholm behavior. These tests do not prove authenticated supplier
login or connectivity from the existing production function instance. Do not
claim a region switch fixes the user's error. Production remains
`dpl_7xMxHU4SUENdmoR8H9FD823uTKo8`; no production settings changed.
Probe deployments remain in the isolated test project. CLI-generated temporary
OIDC `.env.local` was removed immediately without displaying its contents.

Follow-up production attempt at `2026-10-13T21:15:42Z` again timed out at the
challenge step after 10,491 ms. Read-only deployment metadata confirms production
`regions: ["iad1"]`; project `serverlessFunctionRegion` and
`resourceConfig.functionDefaultRegions` also select `iad1`. Thus production
matches the failing US-region probes, not the successful Frankfurt probes.
Proposed next increment is an explicitly approved production deployment selecting
`fra1`, followed by authenticated phone verification. No production placement
change has been applied yet. Root network filtering policy remains unknown.

Subsequent explicitly approved production repair: changed the existing project's
`resourceConfig.functionDefaultRegions` from iad1 to fra1 and deployed
`dpl_GcVAHrTNnzRy1GJxP4MBx1HAMRLS`. Both production domains now alias this
ready deployment. Compiled-function inspection confirms api/energy/vault and
other backend APIs execute in fra1. Source comparison across all 354 files
confirms only vercel.json changed, adding regions fra1; existing duration limits
are retained. No application source, database, provider credentials or APK was
changed. Successful authenticated supplier login remains pending phone testing;
synthetic regional connectivity alone does not prove it. Previous deployment
`dpl_7xMxHU4SUENdmoR8H9FD823uTKo8` provides code rollback but is in the
known-failing iad1 region. Future region changes still require approval.

## Saved connection repair (2026-10-13)

Released with user approval in `dpl_CLuUj8tXLTfEev2FoskxV6e5NpG8` on both
production domains and packaged in `dist/Stromblik-1.0.9.apk` (versionCode 10).
Public live release checks and APK version/signature/bundle checks passed.
Read-only production schema checks confirm the existing heating connection table
and columns. No migration or credential-key change was needed. Real supplier
login and physical-phone behavior still require verification.

The current app uses an authenticated server connection. The historical
SecureStore and browser-session descriptions below no longer describe the
current credential storage. Existing AES-256-GCM envelopes remain unchanged in
`heating_connections`, scoped to the verified user and household; only the
server can decrypt them. No credentials are returned to the app or placed in
the encrypted history snapshot.

This repair persists credentials after provider login and single-installation
validation, before consumption retrieval. A failed readings request then returns
`connected: true` with a warning, allowing later refresh with the saved login.
Credential/save failures still fail the connection. Supplier requests have a
45-second aggregate budget; the existing energy endpoint has a 60-second Vercel
limit to accommodate multiple upstream requests. Explicit onboarding login is
queued after an existing background sync rather than discarded by deduplication.

The heat hook checks saved status before auto-refresh, refreshes on foreground,
and preserves the last confirmed connection during transient status failures.
Only explicit missing/unreadable connections or rejected supplier credentials
require login again. Successful connection with failed vault import reports a
warning rather than claiming readings were saved. The card offers `Opdater` to
reuse saved credentials and `Skift login` for an intentional replacement; the
old browser-session-only notice is removed. Onboarding recognizes stored
connections and displays status/retrieval failures separately.

Verification: `test-heating-connection.mjs` checks encryption;
`test-heating-persistence.mjs` exercises the actual backend, client queue and
hook with synthetic provider/database/platform dependencies. It covers saved
credentials before readings fail, later reuse without resubmitting a password,
rejected login, failed persistence, membership denial, no secrets in responses,
background-sync/login ordering and status outage handling. TypeScript and the
existing vault/crypto/signed-write tests pass. The public supplier portal returns
200; real supplier credentials and physical devices have not been tested.

Production release, 2026-10-03: browser connection changes deployed with user approval in `dpl_6GkgLMXyfeGZu8guYfcjjcgdST2J` to huslyg.dk and dit-hjem-five.vercel.app. Both sites serve the new browser form bundle; real-account login/import is still unverified.

Browser increment, 2026-10-03: the heat connection form and refresh now also work on web through direct provider requests. Browser credentials are held only in the unlocked vault session's memory; reload, logout or a new vault session requires reconnecting. Native SecureStore behavior is preserved. The provider's required MD5 challenge uses `@noble/hashes` on web because WebCrypto does not support MD5. Synthetic browser login/import/refresh and credential isolation tests pass; real-account browser verification and deployment remain outstanding. Earlier native-only statements below describe the original implementation.

Local implementation, 2026-09-26. Not deployed or verified against a real account or physical phone.

- Entry point: **Vand og varme → Forbind varme**.
- Uses customer number and bill password, entered only in the native app.
- Public supplier configuration verified from https://eforsyning.dk/sonderborg-varme/: supplier ID `0DA4BF5F-2857-44FA-9CA3-F90A3C04B01F`, fixed upstream `https://apiapp.dff-edb.dk/sdbg/`. No user-supplied server URL or credential forwarding to discovered hosts.
- Protocol reference: https://github.com/kpoppel/homeassistant-eforsyning/blob/main/custom_components/eforsyning/pyeforsyning/eforsyning.py. The upstream requires an MD5 challenge response over HTTPS; this is not the vault encryption/password-storage scheme. Do not log upstream URLs because they contain session credentials.
- Supports exactly one installation and daily readings for the current supplier billing year. Multiple installations fail explicitly instead of selecting an arbitrary address. Earlier imported billing years remain in the encrypted snapshot and are navigable, but navigation does not fetch older years from the supplier.
- Normalizes explicitly identified kWh, MWh and GJ units internally to kWh, displaying GJ. Optional `expectedKwh` comes from each period's `ForventetForbrugENG1` using the ENG1 unit, not the cumulative expected meter reading. Existing snapshots remain readable; manual refresh imports the new field. Missing values remain null, never invented zeroes or estimates.
- Year/month/day controls navigate calendar periods: monthly bars for a year, daily bars for a month, one daily total for a day (no hourly data). Actual bars and orange expected line share the same GJ axis. Missing expectations break the curve. Monthly/overall comparisons sum expected consumption only for the same measured days and withhold the comparison if any expectation is missing. No monetary estimates or full-year forecast extrapolation.
- Daily intervals are assigned to their start date; intervals longer than one day are explicitly excluded with a UI warning rather than allocated artificially. Ambiguous duplicate days are marked missing. Daily interpolation remains enabled upstream. Verify actual date-boundary conventions and expected values against the supplier app before claiming billing-grade equivalence.
- Heat-loop water is stored as `heatingWaterM3`, never displayed as household drinking-water consumption.
- The separate heating overview reads the provider's `IaltLinje` ENG1 actual total and annual expected consumption from a second, monthly-filtered billing-year request. The daily request alone may omit `IaltLinje`. Both totals use the ENG1 unit; expected consumption for measured days remains distinct. If the yearly request fails or omits totals, daily data is retained and missing totals stay blank.
- Daily `Tempfrem` and `TempRetur` are optional fields in encrypted heat readings. The independent temperature chart shows daily observations or an unweighted mean of complete daily forward/return pairs per month. Missing values break the lines rather than becoming zero, and intervals longer than one day are excluded from the daily temperature chart. A provider response and physical-device rendering check are still needed before claiming the displayed temperatures match the supplier app exactly.
- Optional `VaultData.heating` is encrypted using the existing vault pipeline. One save per import; six-hour automatic refresh limit after the separate annual request has been attempted. Old snapshots lacking that request marker (including those with a null summary) get one automatic backfill attempt when native credentials are available. Explicit refresh remains available. Existing vault size/version limits still apply. Failed signed saves are not reported as successful imports.
- Credentials are saved only after history is saved, in native SecureStore keyed by app user and household with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Credentials are not in vault backups, AsyncStorage or backend requests. Reconnect on another phone. Web only reads encrypted imported history.
- The old frontend proxy login has been removed. Legacy server `/api/eforsyning/*` routes remain unchanged and outside this new flow; their global credential state and any deployment require a separate retirement/security review before release. Do not use those routes for this integration.

Verification: TypeScript-only check and existing vault-client suite passed. In-memory synthetic check passed for direct login/import sequence, billing-year POST, MWh/GJ conversion, single save, credentials excluded from vault data, and fresh-cache reuse. No new test files; no real credentials used.

Details increment: `scripts/test-heating-details.mjs` tests distinct daily/year requests, automatic backfill of an old snapshot, the six-hour limit after enrichment, annual GJ totals, and daily/monthly temperature values. No real supplier response or physical phone was available for verification.

Chart increment: TypeScript and existing vault-client checks passed again. Inline synthetic checks exercised the actual parser and aggregation for expected/actual GJ and MWh, leap day, month boundaries, missing versus zero, old snapshots, multi-day exclusion and ambiguous duplicate days. User reports successful login; no agent-verified real-account comparison or physical-device rendering check, deployment or database change was performed.

Before real use: verify isolated dev backend/environment and deployed signed-write gateway (see ENVIRONMENTS.md), then verify native HTTPS/MD5 support, provider response units and date boundaries, SecureStore, background locking, failed/retried saves and cross-device history. Do not send credentials in chat or copy production data into dev. Production releases/migrations still require explicit approval.
