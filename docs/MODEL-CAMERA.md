# House-model camera movement

Orbit view now supports two-finger horizontal panning plus pinch zoom. One
finger still rotates. Desktop right-drag pans; the existing mouse rotation and
wheel zoom remain. The close-distance limit is 0.8 m instead of 35% of the parcel
span, so small facade details can be inspected. This is orbit navigation, not
a walking or building-collision simulator.

Panning moves the orbit target and camera together on a horizontal plane. The
target is constrained inside available map bounds. The zoom-out limit is based
on mapped area size, independently of panning. At map edges the camera and its
target translate together to retain ground coverage without changing zoom.
Existing ground-coverage and polar-angle limits
remain. There are no camera-triggered model saves or colour recalculations.
Reset restores the house framing. Ground-mode placement, fixed 1.7 m eye height,
look controls and return to orbit are retained.

Focused Chrome/CDP checks passed for actual two-finger drag, pinch zoom, mouse
right-drag, close inspection and bound clamping without changing the viewing
offset. Existing ground-controller tests and staged TypeScript also passed.
Physical-phone gesture behavior remains unverified.

Follow-up: each two-touch gesture is classified from midpoint motion versus
finger separation and locked to pan or pinch until release/cancellation. Both
pointer positions are considered before classifying, so a parallel drag's first
pointer update is not mistaken for a pinch. Pan disables dolly for that gesture;
pinch disables pan. The original enable flags are restored on release/cancel.
Regression checks include spacing jitter during pan, reverse pinch to zoom out,
and map-edge correction preserving camera distance and the zoom-out limit.

APK `dist/Stromblik-1.0.86.apk` (versionCode 87), 89,876,127 bytes, SHA256
`7299d4c8db11d14d4642632b574916e7a61844c1971c96ffe065f69c51a8e8e5`,
was built from the existing isolated stage. The three existing changed sources
and new orbit helper match the root files; 198 other staged sources retained
their hashes. The trained model and brick relief remain embedded. Gradle,
eighteen packaged native sources, exact renderer/bundle, credential exclusion,
metadata and signature with the existing debug/test certificate pass. The API
target remains `https://dit-hjem-five.vercel.app`.

USB `adb install -r` succeeded on the verified Samsung SM_A576B, retaining data.
Installed 1.0.86/code 87 and activity launch Status ok were confirmed. No native
gestures, property navigation or house-model save/rebuild were performed.
No backend/database/config deployment, Git commit or push. Evidence is under
`.tmp/free-camera/` and `.tmp/property-model-release-evidence/`.

The pan/pinch correction was built and installed as
`dist/Stromblik-1.0.87.apk`, versionCode 88, 89,877,615 bytes, SHA256
`21ede8b7bac85367b5d3ff6b9d254cba771d5a59000ce3f01f086350b09bb742`.
Only the orbit helper, home3d camera integration and generated renderer changed;
199 other staged sources, the trained model and brick relief are retained.
Gesture regressions, staged TypeScript, ground controller, Gradle, eighteen
packaged native sources, exact renderer/bundle, metadata, credential exclusion
and the existing APK v2 test certificate pass. USB `install -r` on the same
Samsung SM_A576B retained data; installed 1.0.87/code 88 and launch Status ok
were confirmed. Native gestures remain unverified. Backend target remains the
existing production API; no backend/database deployment, commit or push.
Evidence is under `.tmp/pan-zoom-fix/`.
