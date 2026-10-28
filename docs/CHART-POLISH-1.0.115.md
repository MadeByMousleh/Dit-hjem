# Navigation, pastel charts and rolling values

24 October 2026. User correction to the broader design audit: charts should be pastel and values should roll vertically with direction, rather than only fade.

- Added a shared soft mint/blue/sand/rose chart palette. Dark text and selection outlines distinguish selected values; negative prices retain their separate gold treatment.
- `AnimatedMetric` now clips outgoing/incoming number rows. Increasing values enter from below and move up; decreasing values enter from above and move down. Exact selected values render immediately; arithmetic never uses interpolated values. Units remain stationary. Scrubbing retargets over 110 ms, deliberate updates over 170 ms, without queuing transitions. Reduced motion replaces values immediately.
- Removed the selected tab from grid-supplier resolution identity. Navigation now reuses verified supplier evidence. Successful profile saves notify the resolver; user, household, candidate, foreground and 15-minute refresh invalidation remain. A changed address still has to match the authorized meter before prices can be shown.
- Page changes use a short 110 ms fade without horizontal travel. Static-style buttons no longer update React press-state twice per gesture. Pattern analysis starts after the first frame and reuses successful results for up to 60 seconds within the same vault/date; importer notifications invalidate that cache.

Checks: root/staged TypeScript; actual rolling metric up/down and rapid retarget browser test; actual supplier hook navigation reuse and changed-address rejection; real widget component footer/layout/settings at 320/390/768. These do not establish a measured native frame-rate improvement.

APK: `dist/Stromblik-1.0.115.apk`, code 116, 86,140,311 bytes, SHA256 `0DA229A0D6E028620BE6DA026FE0E00AA185C8116D5FD16A0E5F4FF67E2CCBC2`. Packaged changed sources, production API and existing test signature verified. No backend/database change or deployment.

Installed with data retained on the existing Samsung; installed version/code and activity launch verified. Final screenshot was black because the phone was dozing with NotificationShade focused. Native appearance and subjective navigation smoothness are therefore not verified for this increment; the browser interaction/layout checks above are separate evidence.
