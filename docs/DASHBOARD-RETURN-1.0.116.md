# Dashboard return and chart contrast

24 October 2026. Chart colors now use a medium-strength mint, sand, rose and blue palette, with stronger selections. Negative-price gold is retained.

Dashboard navigation previously unmounted its widget tree. The dashboard now remains mounted offscreen with touch and accessibility disabled while another tab is visible. Native scroll position, measured card heights and chart state survive returns. The existing vault gate still unmounts protected content on locking; this introduces no disk cache. Dashboard widget demand no longer toggles usage loading solely because the selected tab changes.

Memoized widget cost, tariff and cheapest-window calculations. Agreement sorting occurs once per price transformation rather than once per point.

Focused actual-widget browser comparison over ten departures/returns: before, the card DOM node was replaced and cost calculation ran 40 extra times; after, the card node survived and cost calculation ran zero extra times. Root and isolated-stage Dashboard wiring checked. Root and staged TypeScript pass. These checks establish removal of repeated work, not a native FPS measurement.

APK `dist/Stromblik-1.0.116.apk`, versionCode 117, 86,141,147 bytes, SHA256 `CB750D2276ED5318B206E192962FE6065D3D1B439BBF5F1BE48EA2E93DAA2F4B`. Gradle release succeeded. Packaged changed source contents equal the isolated stage, production API appears in the Hermes bundle, existing test signing certificate verified. Installed with `install --no-streaming -r` on the existing Samsung, data retained; installed version and launch verified. Native screenshot after Profile -> Overblik confirms populated charts and new palette. Continuous native frame timing and subjective smoothness were not measured. No backend/database deployment, commit or push.
