# Skeleton loading

28 October 2026. Client-only local implementation; no APK or deployment.

`LoadingState` now draws neutral shapes matching a metric card, bar chart,
line/temperature chart or parcel map. Card/compact variants cover regular and
small widgets. Existing roof and floor-plan placeholders inherit the card
design. Electricity usage, month summary, usage patterns, price shares, home
electricity/property details, heating and dashboard widgets use the relevant
shape while their first data is pending.

Widget loading flags come from actual usage/price loading state. Unresolved
supplier lookup counts as pending prices; a completed failure does not. Empty,
disconnected and error states keep their explanatory content. Existing data
and the actual chart node stay visible during background refresh. Cached usage
can also remain visible while its connection status is being checked.

Each placeholder has a single native opacity animation, limited to three slow
pulses; its Animated.Value is created once. Reduced motion/background settings
disable the pulse. The wrapper announces a named busy progress indicator;
decorative shapes are excluded from accessibility and receive no touch events.
No synthetic delay or data-fetching dependency was added.

Validation: TypeScript, existing app/heat chart performance browser checks and
`node scripts/test-skeleton-loading-browser.mjs` pass. The new browser test uses
actual components with synthetic data, blocks external requests and checks
loading/ready/error transitions, one placeholder while connection status is
unknown, real chart preservation during refresh, widget loading flags,
320/390/768px layouts and reduced-motion rendering. Screenshots are under
`.tmp/skeleton-loading/`. Native appearance/animation remains unverified.
