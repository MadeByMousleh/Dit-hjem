# App loading and chart performance

28 October 2026. Local client changes, tested against synthetic data. No APK,
installation, deployment, database/Auth/cryptography change, commit or push.

## Findings and implemented solutions

| Problem | Evidence in the current client | Solution | Verification |
| --- | --- | --- | --- |
| Scrolling renders unrelated screens and charts | `rememberScroll` updated state in the shared dashboard provider on every accepted scroll event. The actual provider/consumer browser fixture rendered 20 times for 20 offset updates. | Keep restoration offsets in a provider-owned ref. They survive screen remounts without notifying React consumers. Offset validation and account-scoped provider lifetime remain. | Same 20 updates produce zero consumer renders and retain offset 200. |
| Moving the usage cursor formats every date again | `ElectricityUsageChart` rebuilt its points/labels inside JSX on every selection. | Memoize labels and chart input by readings, aggregation and formatter. | Ten selections on 30 readings: 310 label formats before, 10 after. |
| Cursor selection runs an unused price calculation | `estimateEnergyCost` was called for an estimate that was never rendered; creating `[selected]` also invalidated its memo each selection. | Remove that unused computation. The displayed `estimateUsageTotals` calculation remains. | Ten selection-time calls before, zero after. |
| Static curves/scales are regenerated while selecting | `InteractiveEnergyChart` recalculated axes and paths; its caller supplied a new point array each render. Heat and temperature paths were also rebuilt on each selection. | Memoize data-dependent geometry; skip line-path construction for bars. Stabilize point arrays and peak calculations in `ElectricityDailyCurve`; memoize heat and temperature paths. | Ten usage selections: ten geometry computations before, zero after. Ten dates selected in each actual heating chart produce zero additional path builds. Existing line drag and haptics test passes. |
| Every chart selection constructs another responder | `useRef(PanResponder.create(...))` evaluated the constructor on each render although React retained only the original responder. | Construct the responder in `useMemo`, retaining the same original/ref-based handler semantics. | Actual bar selection and existing curve drag browser tests pass. |
| Period changes launch competing usage loads | `load()` started `privateUsage`; updating aggregation/anchor also started the batch effect for that range. | Let the batch effect own changed selections. Same-selection explicit refresh retains its direct request. | Actual-hook synthetic lifecycle test: one batch per period change, no competing single request, late old results ignored, explicit refresh preserved. |
| Historical price months form a serial waterfall | A year view awaited each month before starting the next. | Fetch in waves of at most three shared requests, publishing successful months once per wave. Stop later waves after effect cleanup. | Actual-component browser test requests nine months with maximum concurrency three. A synthetic failed month does not stop later months; leaving the range stops subsequent waves. This reduces serial dependency depth, not a measured end-to-end latency claim. |
| Historical price data is decoded again on screen reopen | The existing history map retained only pending promises. A warm revisit still reread AsyncStorage, parsed JSON and recreated all Dates. | Keep decoded public history in an LRU cache: at most 12 ranges and 40,000 points. Preserve supplier/area/range keys and the existing 15-minute recent/seven-day old-history expiry policy. | Actual loader tests cover coalescing, zero extra warm disk reads, separate suppliers/areas, both expiry policies, entry/point eviction, disk restoration and retry. No household data is added to this cache. |
| Charts fetch prices without an agreement to price | Historical-price requests ran even when no agreement existed to calculate the displayed estimate. | Skip those requests while the agreement is absent or supplier unresolved; start them when an agreement becomes available. | Browser test verifies zero requests before adding a synthetic agreement and the correct bounded loading afterwards. |
| Repeated formatting allocates formatters | Usage values/currency constructed NumberFormat objects during renders; `formatPrice` called `toLocaleString` with options each time. Forecast status changes also invalidated the whole merged-price series. | Reuse number/currency formatters and key forecast merging on forecast points/key, rather than loading-state object identity. | TypeScript and actual chart browser checks pass. No separate native timing claim for these changes. |
| Heating rechecks a just-confirmed connection | Page initialization checked status, ran the cached/successful sync, then checked status again in `finally`. | Carry the freshly confirmed status through that run and use successful sync confirmation. Keep a fallback status check when the result is unknown; avoid follow-up status calls from obsolete generations. | Heating persistence/connection test asserts one initial status call and still verifies outage preservation and rejected-credential handling. |

## Measured before/after

Production React and React Native Web in local Chrome, 390px viewport, 30
synthetic daily readings and ten different point selections:

| Work | Before | After |
| --- | ---: | ---: |
| Consumer renders from 20 scroll updates | 20 | 0 |
| Date-label formats during ten selections | 310 | 10 |
| Unused price estimates during those selections | 10 | 0 |
| Static usage geometry builds during those selections | 10 | 0 |

Reports/screenshots are in `.tmp/app-performance/`. The before report was
captured before editing the implementation. `--baseline` records whichever
source is currently installed; it does not restore the old code.

These counts demonstrate removal of repeated work. They are not phone frame
rates, elapsed loading times, or a percentage speedup of the whole app.

## Scope of the loading investigation

The dashboard is already retained across tab changes. Secondary screens still
mount on visits. This audit reduces their shared rendering and repeated public
price loading costs; it does not claim to eliminate every screen mount.
Retaining every screen would also retain their effects, subscriptions and
potential background work, so that change was not made without measurement.

Startup still depends on fonts, session initialization and vault unlock.
Supplier resolution, initial electricity import, historical pattern analysis,
and property-provider requests can each contribute separate waits. Their real
durations have not been attributed by this synthetic audit. Missing readings
and provider failures remain visible; they are not replaced with invented data.

Next measurement on a connected release-build phone should record cold start,
first and repeated visits to El/Varme/Boligen/Profil, period changes, scrolling
and continuous scrubbing. Capture JS/UI frame timing and request/first-content
timing independently; distinguish cached, offline and uncached cases. Use
those traces to choose any further screen retention, deferred sections or
provider-specific timeout/cache changes. Do not infer a backend bottleneck
from a loading indicator alone.

ADB listed no connected device during this audit. The installed APK therefore
does not contain these changes and native responsiveness remains unverified.

## Checks

Passed:

- `npm run typecheck`
- `node scripts/test-app-performance-browser.mjs`
- `node scripts/test-heating-chart-performance-browser.mjs`
- `node scripts/test-interactive-energy-chart-browser.mjs`
- `node scripts/test-history-price-performance.mjs`
- `node scripts/test-usage-selection-loading.mjs`
- `node scripts/test-electricity-usage-records-hook.mjs`
- `node scripts/test-bar-scrub.mjs`
- `node scripts/test-heating-cost.mjs`
- `node scripts/test-heating-persistence.mjs`
- `node scripts/test-price-forecast.mjs`

Two older suites could not verify their intended behavior with the current
working tree: `test-electricity-widgets.mjs` fails in its mock loader because
`validPriceLimits` is missing, before the navigation assertions;
`test-heating-details.mjs` uses the old direct-provider contract and its mock
loader rejects `./supabase`. They were not counted as passing. The new
actual-component and targeted-hook tests cover the changes above.

The new browser scripts follow the repository's existing local Playwright
installation convention. They launch Chrome and block external requests.

## Research basis

The implementation decisions follow the official guidance on avoiding repeated
render work, preserving memo dependencies, and testing performance in release
mode:

- [React Native performance overview](https://reactnative.dev/docs/performance)
- [React useMemo reference and measurement guidance](https://react.dev/reference/react/useMemo)
- [React memo guidance and changing-prop caveats](https://react.dev/reference/react/memo)

The source findings and operation counts above are from this repository's
actual components/hooks, not inferred from those general recommendations.
