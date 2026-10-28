# Release review: APK 1.0.104 (code 105)

Follow-up 2026-10-24: user requested document/price activation, negative bars and typecheck repair. Document/price migration and protected backend activation are now complete (see feature documents). Both features remain visible. Price chart now draws negative total prices downward in purple with minus markers and a short reduced-motion-aware growth animation. Past-only data renders an unavailable message rather than throwing. Mixed-sign browser rendering, widget settings and empty-price regression checks pass. The normal app TypeScript command now uses `allowJs:false`, excluding the unrelated JS helper and non-app staging/side-project folders; this does not claim to typecheck backend JavaScript. Onboarding preview, DST-hour identity and public-release signing remain outstanding; they were not part of the selected fixes. APK build/installation status is recorded separately.

Reviewed 2026-10-24. Scope: the isolated `.tmp/property-model-apk-release` client used for this APK, relevant root sources and Gradle signing. Read-only review of app code; no deployment, migration, account changes, installation or application fixes. Root contains unrelated unreleased work and is not an interchangeable release source.

## Confirmed defects and release blockers

1. **P1: price chart crashes with past-only prices.** `src/components/PriceChart.tsx:25-60,206` filters out previous dates, but still constructs and formats an invalid selected date when no days remain. An actual React Native Web widget reproduction with past-only price points raised `Invalid time value` and left the body empty. Repro script: `.tmp/audit-expired-price.mjs`. Add an explicit no-current-price state that also tolerates data changing from present to absent; retain consistent hook ordering. Check the standalone El card as well as widgets.

2. **P1: onboarding preview is enabled in the release source.** `src/screens/AppScreen.tsx:18,40-41` sets `FORCE_ONBOARDING_PREVIEW=true`. `AccountSetup` initializes the opt-out unchecked in preview mode. An existing user who completes setup without selecting it can be sent through setup again after restarting the app. Disable the preview override and verify both new accounts and completed accounts through the normal persisted onboarding-version flow.

3. **P1: autumn DST merges two different market hours.** `src/components/PriceChart.tsx:17` groups by Danish date plus device-local `getHours()`, without an absolute hour identity. For 25 October 2026, 100 quarter-hour points become 24 bars; the two 02:00 hours have eight quarter points in one group and one averaged price. Reproduced with the same grouping rule and Danish local hours. Group by absolute UTC hour, format in Copenhagen time, and distinguish repeated local-hour labels. Device timezone also must not determine market-hour grouping.

4. **P1 for a public release: APK release uses the debug/test certificate.** `android/app/build.gradle:115` selects `signingConfigs.debug`. Artifact 1.0.104 verification reports the known Android Debug certificate. Set up the intended release signing/distribution path and preserve an explicit update/migration plan for installed test builds; changing the certificate prevents an ordinary in-place update of those builds. No keystore/configuration change was made during this review.

## Features that require activation or a scope decision

5. **P1 if floor-plan upload is advertised: activation is still not evidenced.** The Plantegning tab is visible, but `docs/MIT-HJEM-SIMPLE.md:3,19` records pending production migration/backend activation. The client disables uploads when listing is unavailable. Activate and verify the approved household/address storage flow, or hide the unfinished tab for this release. Current authenticated production capability was not checked; this is an unresolved release gate, not a newly observed production failure.

6. **P1 if cheap-hour statistics are advertised: price archive activation is still not evidenced.** `useElectricityPriceShare` queries `spot_price_archive`, while `docs/ELECTRICITY-HISTORY-IMPORT.md` records pending migration/jobs/backend rollout. The waiting animation does not itself collect missing market prices or activate the archive. Verify actual historic rows and scheduled collection before promising availability after seven days, or make the feature unavailable for this release. No production changes or authenticated archive queries were performed.

## Other confirmed problems

7. **P2: negative prices have zero-height bars.** `src/components/PriceChart.tsx:262` clamps negative values to zero. Distinct negative prices therefore look identical even though the selected numeric value can be negative. Draw around a zero baseline or provide a clearly differentiated negative-price representation. This concerns the chart's total-price values; it does not assume every negative spot price yields a negative total price.

8. **P2: the normal typecheck command is broken.** `npm run typecheck` fails on syntax errors in the unrelated `update_page.js` helper, starting at line 151. `npx tsc --noEmit --allowJs false` passes. Repair or exclude the non-app helper so the documented check can act as a reliable release gate. A successful APK build is not equivalent to this check passing.

## Remaining verification boundaries

- No phone was attached during the review. Installation, cold start, completed onboarding, native keyboard/layout, real household baseline saves and new El overview values have not been verified for 1.0.104. The last successful installation in this conversation was 1.0.101.
- Baseline/annual calculations have synthetic tests from the implementation work. They are estimates based on complete saved intervals, not appliance identification or full household demand behind solar/batteries. Real household data and equipment-change behavior need a focused acceptance check.
- No store submission, account-deletion compliance assessment, penetration test or provider-contract review was performed. This document is not a claim of complete release certification.
- Backend activation findings are based on implementation documents; do not describe them as live production results without checking the deployed environment.

Recommended order: price-chart crash and DST handling; normal onboarding; release signing; decide/activate unfinished features; then a focused phone acceptance pass on the exact final artifact. Keep application fixes and deployment approvals separate.
