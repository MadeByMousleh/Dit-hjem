# Encrypted electricity period records

Released with explicit approval on 2026-10-14. Migration and rollback-only SQL tests
passed on dev `wsdomkzhnksyjrpxqfvn`; the same migration is now applied to production
`arkpfdsglgufnnukader`. Deployment `dpl_DEokBqtVMXHYygrbNPp66bmTo2KP` is READY on
both production domains. APK 1.0.12/versionCode 13 is built, signature/API-verified,
installed with data retained and launched on the paired Samsung SM_A576B.
Live public bundle/Auth/unauthenticated endpoint checks pass. A real authenticated
multi-year import and physical chart/cache behavior still need verification.
This supersedes the earlier single-snapshot cache increment.

## Storage

Supabase stores independently encrypted rows in `electricity_period_records`:

| Record key | Encrypted contents | Used by |
| --- | --- | --- |
| `hour/YYYY-MM-DD` | Per-meter compact hourly vectors and household hourly points | One day's hourly chart |
| `day/YYYY-MM` | Precomputed household daily totals | Days in one month |
| `month/YYYY` | Precomputed household monthly totals | Monthly overview |
| `year/YYYY` | Precomputed household annual total | Annual overview |
| `state/import` | Meter access bounds, cursors, missing-day retry times and import lease | Incremental import |

Consumption, meter identities, completeness and import state are encrypted.
Household IDs, record keys, revisions, timestamps and ciphertext sizes are visible
metadata. Each record has a separate revision and encrypted phone-cache entry.
Records are loaded on demand: memory, then phone cache, then the specific DB rows.
Reading a monthly chart does not load or aggregate all historical hours.

Hourly readings are canonical; day/month/year totals are computed once when hours
are imported, and committed atomically with those hours and the resumable cursor.
Missing values are not zero. Raw precision is retained until display rounding.
Danish calendar grouping preserves real 23/24/25-hour days and distinct UTC hours.

## Import policy

1. A verified connection starts a resumable import of all accessible consumption
   history. Authorized meter bounds, grant dates and the API's retention window
   constrain the import. The client fetches Hour data in batches of at most
   31 days, newest first. Charts can render while older batches finish.
2. After initial import, only newly eligible days are fetched. Today is never
   fetched: yesterday becomes eligible at 17:00 Europe/Copenhagen. This is app
   policy, not a guaranteed provider publication time.
3. Before provider calls, refresh the encrypted import cursor and targeted hour
   records from the DB. Complete saved days are excluded from provider spans.
   A signed, compare-and-swap two-minute lease prevents cooperating devices
   importing concurrently; another device waits and rechecks the DB.
4. Save each successful batch, including summaries and cursor, atomically.
   Restart resumes unfinished batches. Successful subspans survive a later
   provider failure. A crash after a provider response but before its DB commit
   may require refetching that unsaved span: this is not exactly-once delivery.
5. Empty/incomplete responses stay visibly incomplete. Recent missing days retry
   after six hours; older gaps after seven days. Provider transport failures
   back off exponentially from one minute to one hour while the app is open.
   Permanent authorization errors do not auto-retry.
6. Complete, cached periods do not call the provider or DB on navigation.
   Account unlock, connection checks and signed writes retain their security
   checks. Positive connection status is shared for five minutes; server meter
   metadata for one minute. Data requests still enforce active authorization.
7. Foreground/active usage checks resume import and check the daily boundary.
   No server cron was added: import is not guaranteed while the app is closed.

## Encryption, concurrency and limits

The existing household key, pinned Ed25519 writer and AEAD encryption are reused.
The domain-separated batch signature binds project, user, household, each record
key, expected revision, envelope and ciphertext hash. Decrypted payloads also
bind their record key, preventing ciphertext relocation. The server authenticates
the user and membership; only its service-role RPC can commit writes. RLS permits
member reads, not direct client writes. Batch CAS rejects stale/replayed writes;
the client reloads and recomputes on conflicts.

`electricity_period_versions` retains prior encrypted record versions. The
existing root-vault restore screen does not restore these new period records.
A recovery UI for period versions has not been implemented.

Limits: 40 records per batch, 256 KiB hex-encoded ciphertext per record (128 KiB
binary ciphertext), 4 MiB transport,
256 MiB stored current-plus-version ciphertext per household, 100,000 versions
and 50,000 records. Quota checks roll back the complete batch. No history is
silently pruned. Phone-cache capacity depends on the device; summaries are
prioritized and a failed local cache write does not undo the authoritative DB
commit. Physical-device cache quotas and rendering speed remain unverified.

## Existing users

Existing snapshot hours are copied once into period records without provider
refetch. Coarse-only legacy summaries remain readable until canonical hours
replace them. The old encrypted snapshot is retained intact, including historical
source readings. Newly imported electricity readings never grow that snapshot.
Old users may therefore still load their legacy root history at unlock; removing
it is a separate migration/backup decision, not part of this increment.

## Verification and rollout

- `test-electricity-records.mjs`: independent signature verification, context/
  ciphertext tampering, actual gateway and client with synthetic I/O, CAS
  conflict recovery, record relocation/rollback rejection, independent encrypted
  phone cache, all-history import, interrupted-import resume, targeted cold-cache
  reads, daily-only updates, simultaneous-device lease and offline reuse.
- `test-electricity-usage-records-hook.mjs`: cached charts while connection status
  is unknown, DB-only reads without starting provider import, subscription cleanup.
- `test-electricity-cache.mjs`: retained legacy summary compatibility, precision,
  DST, missing-versus-zero and partial calendar-year coverage.
- `test-electricity-period-records.sql`: real dev SQL with rollback fixtures;
  member/nonmember RLS, ACLs, pinned writer, replay/CAS, atomic batches, envelope/
  quota rejection and version retention.

The dev migration was isolated in `.tmp/electricity-records-db` to exclude earlier
unrelated root migrations; the normal CLI production link was not changed.
Do not run a full-root migration push as a shortcut. The migration
`202610140001_electricity_period_records.sql` is already applied to dev: SQL fixes
must use a new forward migration.

Production migration and matching backend/client/APK release are complete.
Authenticated provider import and physical chart/cache testing remain outstanding.
Rollback keeps the additive tables and new ciphertext, and requires the matching
previous backend/client; do not delete new records as an incidental rollback.

Final local verification: TypeScript-only check, Expo web export and the listed
synthetic suites pass, together with existing vault crypto/signing/client, provider
authorization/reconnect/return, consumption, background-usage and connection-state
regressions. These do not prove a real authenticated multi-year provider import
or physical-phone cache/rendering behavior.
