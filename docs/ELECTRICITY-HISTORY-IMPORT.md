# Full electricity source history and shared spot-price archive

2026-10-24 price archive activation: user explicitly authorized verification/activation. `202610230002_spot_price_archive.sql` is applied and journalled on explicit dev and production projects after rollback-only dev tests. A new server-only production cron secret was configured without changing existing provider/database keys. Deployment `dpl_6WdvRBZ57k2J4umTK32mVjUw5HHq` is READY; all 362 source hashes verified against the isolated manifest, five scoped file overrides, existing frontend/dependencies unchanged. Daily cron schedules are configured in the deployed `vercel.json`; both recent and history handlers were manually invoked successfully with authorization. Future automatic invocations have not yet been observed. Recent returned saved-with-gaps because unpublished next-day prices were absent; retry metadata is retained. Initial complete 2026-09-24 through 2026-10-23 prices were seeded (5,760 intervals); combined with today's available prices and January 2021, read-only verification counts 7,440 rows, 3,720 per area. Historical cursor advanced to 2021-02-01. This is not a continuous six-year archive yet. Both public domains reject unauthenticated jobs with 401. Authenticated market-price reads are permitted; anonymous reads and client writes are denied. Source-history Actual-provider rollout remains separate and is NOT activated by this price-only backend release.

2026-10-23: implemented locally, not released. The spot-price migration was validated in a rollback-only transaction on explicit dev project `wsdomkzhnksyjrpxqfvn`. No production migration, environment change, user-data import, deployment or APK was performed.

## Setup imports all accessible consumption history

The existing setup connection flow calls `finishThirdPartyMeterConnection`/`importConnection`, which starts the household's resumable importer. The new setup progress component makes that import visible. The same component is shown under El. Users may continue setup while importing. Closing the app can interrupt this client-side worker; it resumes after the app opens and the account's connection is checked. This is not an OS background-download guarantee.

The authorized provider bounds, consumer start and meter-access dates limit the import. The official Thirdparty API currently permits the previous five calendar years plus the current year. This is not a promise that every meter has six years of data. There is no one-year truncation in storage. The pattern card's one-year display range does not limit imports.

`nextImportBatch` walks actual calendar months, newest first, across every authorized consumption meter. New eligible days take priority over old backfill. The provider request is `Actual`, preserving its original supported resolution. An additive `sourceVersion:1` marker in the encrypted import state triggers a one-time source backfill for existing Hour-only imports, without deleting existing history.

Each independently encrypted `hour/YYYY-MM-DD` record now retains:

- Its existing per-meter hourly vector and household completeness flags for compatible charts.
- Per-meter `source` metadata: version, requested aggregation, day boundaries, checked timestamp and ordered column names.
- Compact original interval tuples: UTC start, UTC end, native resolution, usable kWh, original quality code, reported numeric kWh and original quantity representation.

Estimated/invalid energy remains null in the usable column while its reported quantity and quality remain available. Raw quarters are not replaced by hourly averages. Partial replies replace overlapping intervals only; other saved source intervals remain, and affected chart hours are rebuilt from the combined source. Coarser replies are retained but do not become invented hourly measurements. Empty first responses are explicitly marked checked, with empty source intervals and missing household data; an empty retry does not erase previously received measurements. Interval/meter validation rejects overlaps, conflicting duplicates and foreign or unidentified metering points.

Source data, chart hours, calendar summaries and the importer cursor commit together through the existing encrypted, signed, compare-and-swap batch gateway. The progress counter moves only after that commit. A failure preserves the previous cursor and saved batches. A restart skips already completed source-bearing days. Incomplete days remain in the retry ledger; 100% reviewed is not a claim that missing readings exist. No history is silently pruned when the existing storage limits are reached; the save fails visibly and previous records remain.

The current record store retains encrypted prior versions. Old Hour-only clients can still read the chart fields, but their writes do not know the new source metadata; use the upgraded client for importing after rollout. Source data in previous versions must not be discarded by cleanup. No encryption-key, signature-domain, RLS or write-permission changes were made to consumption storage.

## Shared spot-price archive

Official source: [Energinet API guide](https://www.energidataservice.dk/guides/api-guides). Direct public API checks confirmed `DayAheadPrices` fields `TimeUTC`, `PriceArea`, `DayAheadPriceDKK` and legacy `Elspotprices` fields `HourUTC`, `SpotPriceDKK`. The dataset transition is Danish 2025-10-01. API date bounds refer to Danish local time; persisted instants use UTC. `end` is exclusive. A rate-limited response was observed during schema verification; code stops that job without advancing its checkpoint instead of repeatedly polling the provider.

Migration `202610230002_spot_price_archive.sql` adds:

- `spot_price_archive`: DK1/DK2, UTC start/end, actual 15/60-minute interval, exact received DKK/MWh numeric price, source dataset, raw record, revision and first/last observation timestamps. Negative prices are valid. These are spot-only prices, excluding VAT, network charges and supplier markup.
- `spot_price_versions`: previous values when the source corrects a price or its metadata; identical fetches do not create spurious revisions.
- `spot_price_archive_ranges`: checked periods, expected/received interval counts, completeness and retry dates. Missing intervals are not created as zero prices.
- `spot_price_archive_state`: an atomic historical checkpoint, initially January 1 of five years before migration application.

Only the service role can write via `archive_spot_price_batch`. Authenticated users can read public market prices; anonymous reads and access to private job state are denied. Updates and checkpoint changes occur in one transaction. This archive contains no household consumption or credentials.

The existing `/api/energy/vault` function handles two new GET jobs without adding another Vercel function:

| Query | Schedule (UTC) | Work |
| --- | --- | --- |
| `job=spot-history&mode=recent` | Daily 15:00 | Last seven days through published tomorrow, for both areas |
| `job=spot-history&mode=history` | Daily 03:00 | One older calendar month, then retry incomplete historic ranges |

Jobs require `Authorization: Bearer <CRON_SECRET>` with a server-only secret of at least 16 characters. Invalid credentials are rejected before constructing an admin client. `vercel.json` defines both daily jobs, separated to avoid backfill and current-price traffic competing. They run independently of an open phone after production deployment. Vercel may delay a Hobby daily job within its scheduled hour and does not automatically retry failed invocations; the next run uses the saved checkpoint. The rolling recent window and later closed-month import repair missed days.

Historical prices are filled gradually, one month per historical run; a six-year initial backfill is not immediate. Each range is fetched once per source dataset and checks the response's total count to reject truncation. A sparse valid response can be saved as incomplete with a durable retry entry, so one source gap does not block all older history. Unexpected schema/rate-limit/transport failures leave the cursor unchanged. No speculative quarter-hour household use is synthesized to match quarter-hour prices.

## Release sequence

1. Review/apply only the spot-price migration to the explicit development project, then production only with explicit approval. Do not push all pending root migrations; the floor-plan migration is a separate scope.
2. Configure a new server-only `CRON_SECRET` privately for the intended deployment environment. Do not expose it in Expo configuration or logs. Existing backend Supabase secret-key configuration is reused.
3. Deploy the backend's additive `Actual` support and protected price-job routing before releasing the client. Previous Hour requests remain valid.
4. Build/release the matching app with setup import progress and original-interval retention. Verify a real consent/import, DB save/reopen and restart before claiming authenticated household coverage. Do not bundle unrelated renderer experiments incidentally.
5. Verify deployed cron executions, archive rows and historical cursor progress. Declaring jobs in source is not proof that they have run.

Public prices are not yet wired into the later cheap-hour/savings feature. Household charging confirmations, equipment-change labels and historical grid mix are also separate next steps. No AI training or external AI upload is performed here.

## Verification

- `node scripts/test-electricity-source-import.mjs`: original values/quality/precision, estimated readings, empty/coarse replies, DST and every day in 70 calendar months spanning 2021-01 through 2026-10.
- `node scripts/test-electricity-records.mjs`: actual client encryption/signatures with synthetic cloud/phone I/O, original quarter save/reopen, monthly backfill, interruption/resume, atomic cursor, lease, CAS and daily-only updates.
- Existing consumption and Thirdparty API tests pass.
- Actual setup browser test with synthetic providers passes, including connection, import progress rendering and completion.
- `node scripts/test-spot-price-archive.mjs`: source schemas, units, negative prices, UTC/DST, truncation/duplicate handling, guarded cron and checkpoint preservation.
- `scripts/test-spot-price-archive.sql` executed with its new migration inside one rolled-back dev transaction: correction audit, idempotence, sparse-range reporting, stale cursor and ACLs passed. No table or fixtures persisted.
- TypeScript-only check passes. Default all-JS check has unrelated pre-existing `update_page.js` syntax errors.

Primary provider references checked: [Thirdparty Swagger](https://api.eloverblik.dk/thirdpartyapi/swagger/v1/swagger.json), [Energinet API guide](https://www.energidataservice.dk/guides/api-guides), [Vercel cron security/error behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
