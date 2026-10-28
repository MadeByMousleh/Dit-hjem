# Electricity insights: one feature at a time

2026-10-23. Local implementation only. No backend release, production database migration, APK, commit or push. Follow-up: [full source imports and spot-price archive](ELECTRICITY-HISTORY-IMPORT.md) are now coded and tested but not deployed.

## First feature: hour-of-day and weekday profile

`ElectricityPatternsCard` appears under El. It reads up to one calendar year of already saved hourly household records and shows:

- Mean energy used during each local clock hour, normalized by the count of measured hour occurrences.
- Mean daily energy for each weekday, normalized by the number of complete observed days, not summed over a potentially unequal number of Mondays/Tuesdays/etc.
- Tied peaks without selecting an arbitrary winning hour/day; all-equal consumption is described as evenly distributed.
- Actual first/last included dates, complete-day counts, missing/incomplete days and a preliminary state.

Only full days of finite nonnegative hourly values with explicit complete flags are included. A null, malformed, estimated/incomplete or missing interval excludes its entire day from both profiles. Genuine zero energy remains valid. Europe/Copenhagen grouping retains 23/25-hour DST days and counts both repeated autumn hours separately. No raw energy rounding occurs in the calculation. A profile is called ready only after 28 complete days, at least three occurrences of each weekday, and 70% complete-day coverage of the requested period. This is a display gate, not statistical proof that future behavior will repeat.

The hook reads `state/import` and at most 31 day records per batch, uses the earliest known access bound to avoid requesting time before access began, supports cached data if reads fail, refreshes after import notifications and cancels stale component loads. No provider import or write is started by the card. It does not imply sleep, occupancy or appliance identity.

## What is actually persisted today

The existing `electricity_period_records` table holds independently encrypted `hour/YYYY-MM-DD` records, per-meter hourly vectors, household completeness flags and encrypted importer state. UTC interval bounds can be reconstructed from the Danish day and its hourly sequence, including DST. Source values retain numeric precision. Summary `day`, `month`, `year` records also exist, and previous encrypted record revisions are retained. The new profile calculates from these source records; it does not replace them with averages or send them to an external AI. New computations are not separately persisted, because they can be reproduced from the retained source records.

The released canonical importer requests Hour data. The new local follow-up requests Actual and retains original intervals/quality alongside compatible hours, with a one-time backfill of accessible original history. That change still needs backend/client rollout; old saved Hour-only data does not magically contain lost quarters. Never fabricate quarter-hour samples or promise minute-accurate charging detection.

Released spot prices use device caches in `src/prices.ts`. A durable shared database archive, correction history and two daily server jobs are now implemented locally; the migration/configuration/deployment are pending. User charging confirmations, equipment installation dates and historical grid generation mix are NOT yet captured. They must be implemented and persisted before claiming those future models have a training dataset.

## Remaining work, in order

### Adaptive baseline implementation (2026-10-24)

The Mit hjem overview also shows an El card with measured current-calendar-year kWh, complete-day coverage, the same baseline estimate and the saved selected grid supplier (only when its ID matches the profile for the displayed address). Year totals exclude other calendar years and incomplete days; missing days are not extrapolated into annual consumption. The card reads through the existing household vault and uses no new backend route or table.

The patterns card now includes an observed low-net-import estimate, not an appliance-level standby measurement. `electricity-baseline.mjs` examines the latest 30 calendar days, accepting only full finite, nonnegative, explicitly complete hourly days (including 23/25-hour DST days). Each daily estimate is the median of the three lowest overlapping three-hour mean loads; the displayed level is the median of valid daily estimates. It needs seven complete days, four in the last seven days, and a measurement within three days. Ready requires 21 complete days and six in the last seven. A persistent shift exceeding both 25% and 50 W, supported by six recent days against at least seven older days, selects the recent week's level. These are heuristic gates, not a statistical confidence interval or evidence of equipment identity. Recent rolling windows handle gradual/seasonal changes; no weather or explicit equipment-event model is implemented yet. Solar/battery net-import limitations are visible.

Successful complete loads save deterministic, dated/versioned snapshots (including the daily estimates) in `state/import.baselineHistory`, retaining the latest 90 snapshots. This uses the existing household encrypted record writes and revision conflict handling, preserves importer fields and does not add a table or server endpoint. Failed/partial reads never persist an estimate; save errors are shown. Original interval records remain unchanged and retained separately. Real account persistence and physical-device appearance remain unverified. Focused synthetic baseline/DST/change/missing/zero tests and TypeScript pass.

1. **Permanent price history (implemented locally, activation pending):** server-fetched actual prices keyed by DK1/DK2 and UTC start/end, original intervals, source records and corrections. The new migration passed rollback-only dev tests. Deploy/configure before claiming live archiving; backfill is gradual. Never interpolate hourly consumption into measured quarter-hours or confuse spot with a complete bill price.
2. **Share consumed in cheap intervals (implemented locally, activation pending):** El now has a read-only card for the last 30 eligible days, with cheap/other/expensive kWh and energy-weighted percentages. Requires the saved netsupplier to match the selected supplier; displays the current selected DK1/DK2 area, not a claim about historical moves. Uses only whole days with complete usage and archived spot prices. Quarter prices become duration-weighted hourly prices; hourly usage is never divided into fabricated quarters. Cheapest/dearest approximately 25% of each day's real hours (ceil, including 23/25-hour DST days); equal boundary prices stay together, and shared central boundaries stay other. Flat-price days have no invented cheaper hours. Shows matched days, missing usage/prices and no percentage for zero usage. Spot only, excluding tariffs/tax/subscription; not a savings estimate. Source records remain unchanged, no new personal plaintext storage. The shared archive migration/jobs still need activation; missing archive is displayed as unavailable. Focused calculation tests and TypeScript pass; app/device checks deferred at user request.
3. **Adaptive low-load baseline:** distinguish observed current low-load level from technical standby, model stable periods/seasonality and changes, and record user-confirmed equipment changes such as a heat pump installation. Solar/battery net import alone cannot establish total household demand. Persist analysis version, effective dates, data bounds and supported quality indicators using the established household security model.
4. **Charging suggestions and confirmations:** detect candidate sessions and ask the user. Persist household, meter, UTC interval bounds, yes/no/corrected response, estimated charging kWh vs verified charger kWh and source resolution. A user's yes confirms the activity, not that all measured household kWh during those hours belonged to the car. Where available, use separately authorized charger/vehicle measurements. Train only from these distinctions; predictions never become confirmations automatically.
5. **Savings scenarios:** shift only realistically flexible loads and account for duration, power and deadlines. Compare appropriate spot/total variable costs at historical dates. A simulation is not a guaranteed saving or the claim that every household load can move.
6. **Green-energy estimate:** verify a time/area-specific grid-mix source and archive it. Report a consumption-weighted grid-mix estimate and coverage, not proof of the physical origin of a household's electricity or purchased certificates. Storage and electricity imports need a documented method.

All personal data and confirmations remain scoped to the authorized household. Centralized AI training or changes to encryption/data access require an explicit design and authorization, not an incidental plaintext copy for analytics. Current managed-key access limitations are described in `supabase/ENCRYPTED-ENERGY.md`; do not call the system server-blind.

## Validation

- `node scripts/test-electricity-patterns.mjs`: unequal weekday occurrence counts, hour/day normalization, DST, zero/missing/malformed readings, tied peaks, bounded reads, offline cache fallback, household-store isolation and cancellation.
- `node scripts/test-electricity-patterns-browser.mjs <playwright index.mjs>`: actual React Native Web card and hook at 320/390 px using a synthetic saved-record store; correct peaks, accessible 24-hour chart, no horizontal overflow, previous-household state removed on remount.
- `npx tsc --noEmit --allowJs false`: TypeScript-only verification. The default all-JS check is already blocked by unrelated root `update_page.js` syntax errors.

No real household history was downloaded/decrypted during this work. Existing database import persistence was inspected in source and documentation; authenticated import and physical-device rendering were not newly verified. Synthetic test screenshots: `.tmp/electricity-patterns/profile-320.png` and `profile-390.png`.
