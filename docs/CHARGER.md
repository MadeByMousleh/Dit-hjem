# Charger pilot

2026-10-14: local navigation/UI increment only. Bil has a Ladeboks entry that
opens a dedicated page, keeps Bil selected in bottom navigation, and returns to
Bil via the header or Android back. Entry does not require Tesla connection.
Matches shared Nunito, Hugeicons, flat blue/neutral palette and card styles.

The requested protocol is EEBUS. No transport, pairing, discovery or start/stop
command is implemented yet. Start opladning is disabled and the page states
Ikke forbundet. Never use a simulated connected/charging state as hardware proof.

Blocking input: exact home charger brand/model and existing control app. Verify
its firmware, EEBUS support and charging-control use cases, then choose a real
controller runtime. SHIP requires secure pairing; SPINE/use-case negotiation is
not interchangeable with an HTTP request to an arbitrary charger address.
Do not substitute a cloud API, Matter or OCPP without explaining the change.

References: https://www.eebus.org/ship/ and https://www.eebus.org/specifications/.
Real start testing must use a paired charger with granted permissions and show
actual resulting state, not just a command acknowledgement. Phone-local tests
must state that unattended background execution is not guaranteed.

No database/auth/config changes, production deploy or APK requested for this
increment. test-charger-navigation.mjs exercises actual JSX with synthetic
platform/hooks; it does not prove native layout, pairing or charger operation.
