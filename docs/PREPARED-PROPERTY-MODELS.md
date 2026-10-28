# Prepared property models

Implementation increment: 2026-10-20. Local client/backend implementation and
development migration only. Production migration, backend release, APK and
physical-device verification are pending. No 5x phone speedup is claimed.

## Stored model versus live state

`property_models` is the durable source of the prepared model, scoped by household
and address. It stores a versioned gzip/base64 package containing geometry and
height sources, prepared floor/terrain/building/roof vertex buffers with normals
and UVs, exact model origin, aerial image data, sampled wall/roof colours with
their evidence, automatic facade models, committed manual facades, opening edits,
and the precomputed precipitation/wind collision ceiling. Weather, the clock,
camera and playback state are not written into this package.

The first opening reads the database before requesting any property providers.
Only a missing model starts preparation. Height/photo/surroundings inputs are
gathered together, then one scene is created. Photo extraction runs during this
initial preparation. Saving waits for the colour stage and opening lookup to
finish. Provider/analysis failures do not overwrite an existing model. A failed
database read does not silently launch reconstruction.

Subsequent openings read and decompress one database record. They load the saved
mesh buffers and materials, with no source photo decoding, colour sampling,
roof reconstruction, opening AI request, or photo-projection depth passes.
`Opdater husmodel` explicitly prepares a replacement and reads the latest revision
first. A rejected/stale save leaves the previous record intact. Photo-guide
previews are not committed; explicitly accepted manual facades are saved.

The viewer is retained across the property page's tabs. Hidden scenes suspend
animation and weather requests. Returning restores the existing WebView. Height
and surroundings inputs arrive before initial scene creation, eliminating the
previous chain of WebView recreations. Weather and camera messages change state
without changing its HTML.

## Selectable ground observer and planetarium sky (local, 2026-10-20)

The person icon replaces the Moon/sky-camera shortcut. It enters placement mode:
tap a clear spot inside a loaded property parcel, then look around from 1.7 m
above the actual rendered terrain at that point. Roofs, building footprints,
positions within 0.5 m of a footprint and positions outside the parcel are
rejected with a visible message. This is a viewpoint selector, not proof that
the chosen location is physically accessible or safe to stand on.

Dragging turns the observer without translating the eye. Looking down, wheel
events, weather/time changes and viewport resizing do not fly the observer away.
“Flyt ståsted” returns to the map to choose another point. The person button
returns to the previous orbit overview; camera reset restores the standard
overview. The former automatic drag-to-sky transition is removed. House,
neighbours and terrain remain visible and occlude the sky. Opening editing is
inactive while placing/looking. Camera and overlay choices are local viewing
state and never trigger prepared-model saves or a scene reconstruction.

Research references:

- [Stellarium](https://stellarium.org/) emphasizes a location/time-dependent
  naked-eye sky, a ground horizon, realistic atmosphere and Milky Way, planets,
  and optional constellation lines/names.
- [Stellarium Mobile](https://www.stellarium-labs.com/stellarium-mobile-plus/)
  presents these astronomy features through a minimal mobile interface.
- [d3-celestial data formats](https://github.com/ofrohn/d3-celestial/blob/master/data/readme.md)
  specify the J2000 sky coordinates, Milky Way contours, constellation lines
  and IAU label positions used here. Its
  [BSD-3-Clause licence](https://github.com/ofrohn/d3-celestial/blob/master/LICENSE)
  and attribution remain embedded in the bundled asset.

This is an original implementation using the existing Three.js/Astronomy Engine
stack, not a Stellarium embed or a copy of its code/artwork. It includes:

- 5,044 XHIP stars with graded magnitude/colour and restrained point halos.
- The existing NASA-textured Moon at its calculated size, phase and orientation.
- Calculated topocentric Mercury, Venus, Mars, Jupiter and Saturn as bright
  points, with apparent magnitudes and below-horizon clipping.
- A subtle Milky Way raster made from five J2000 contour levels, rotated with
  the star field; this is not a photographic panorama or a dust simulation.
- A default-off “Stjernebilleder og navne” switch in ground view, showing
  constellation lines and standard Latin IAU names (89 entries, including the
  two parts of Serpens). Labels are not translated Danish constellation names.
- Dark translucent in-scene controls at night. Daylight and forecast cloud cover
  dim the sky; the previous artificial minimum star visibility through overcast
  skies is removed. “Sol” is an explicit clear-weather preview.

The compact catalogue is not Stellarium's deep telescope catalogue. No phone
compass/gyro tracking, walking, refraction model or local light-pollution
measurement is added. Positions use the property's coordinates and the existing
clock; visible brightness is a phone-display model, not calibrated photometry.

Verification: numerical Moon/Polaris tests plus independent NASA/JPL Horizons
Venus/Mars/Jupiter azimuth, altitude and magnitude comparisons pass. Ground
controller tests cover the exact eye height, drag/placement distinction,
rejection feedback, fixed-position look, zenith, cancellation, resize, wheel
and orbit restoration. Actual React Native Web/renderer browser tests pass at
390 px with Chrome touch events and 1280 px with mouse, including low/full Moon
disc pixels, placement restrictions, constellation toggle, day/cloud changes,
repositioning and return to covered terrain under a 512 KB JS stack. Saved
viewer tests confirm unchanged scene identity, no new provider calls or model
writes, and first-save/reopen behavior. TypeScript-only, weather/wind regressions
and the renderer build pass. Browser fixtures are synthetic. No APK, deployment,
database/auth changes or physical-device verification for this increment.

A pixel-level daytime check additionally reproduced missing lit house/terrain
after switching from night: the 30-second shadow refresh throttle could leave
a newly enabled light without its shadow texture. Sun/Moon shadow-source changes
now refresh immediately; normal moving-light updates retain the throttle.
The house-versus-hidden-house pixel regression fails before this repair and
passes after it, with no WebGL errors. Daytime ground-perspective screenshots
visibly retain the synthetic house and terrain.

Focused commands:

```powershell
node scripts/test-ground-camera.mjs
node scripts/test-night-sky.mjs
node scripts/test-home-weather.mjs
node scripts/test-home-weather-browser.mjs <installed-playwright-index.mjs> --terrain --night-sky --sky-smoke --low-moon --android-stack
node scripts/test-property-model-viewer.mjs <installed-playwright-index.mjs>
npx tsc --noEmit --allowJs false
node scripts/build-home-3d.mjs
```

## Draw cost

The saved path batches neighbours by compatible materials/attributes while
retaining the main/associated editable surfaces separately. Main-house geometry
is not simplified. Hidden raw point clouds and vegetation are not constructed in
the standard model view. The renderer caps pixel ratio at 1.25 and animation at
30 frames/second. Static shadows update on edits or every 30 seconds for the
moving sun (each frame during accelerated playback), instead of every cloud or
wind frame. The collision ceiling is computed once during preparation rather
than raycast against merged neighbour meshes at every opening.

## Weather

Wind follow-up in APK 1.0.73: leaf long-axis yaw now uses the downwind vector
(`atan2(-sin(bearing), cos(bearing))`) instead of the incoming bearing, which
mirrored diagonal leaf orientation even though translation was correct. Flutter
is bounded and leaf scale fades at the wrapping boundary to hide apparent upwind
teleports. Synthetic tests cover eight bearings, immediate direction reversal,
projection under four camera azimuths, and boundary fade. This follow-up is
packaged and installed on the Samsung; actual leaf motion remains visually
unverified on-device. It does not change provider data.
Wind unit tests, TypeScript, renderer build and terrain/low-Moon browser smoke at
390/1280 px pass. The broader non-sky browser run timed out waiting for the
surroundings-unavailable retry label; that scenario is not verified in this follow-up.

APK 1.0.73 (versionCode 74), installed on 2026-10-20 with `adb install -r`, retains
app data. Artifact `dist/Stromblik-1.0.73.apk`, 89,050,755 bytes, SHA256
`FA100BF2D57F9CA72C61E220DA011DD1FA30EEEC9381D1D52AE13E6025B2C91F`.
Same isolated release entry and test/debug certificate as 1.0.72. Wind tests,
staged TypeScript, Gradle, APK version/v2 signature, 18 packaged source matches,
exact bundle equality, production API and server-credential exclusion pass.
Installed version and successful activity launch confirmed on Samsung SM_A576B.
The foreground changed to another app before visual capture; no gestures were
sent and native wind direction was not verified. No backend/database release,
configuration change, commit or push in this installation increment.

The forecast refreshes every five minutes while visible/active. The renderer
selects the applicable timestamp on each animation tick using the current clock,
so rain/snow/wind transitions do not need another fetch or scene reload. It uses
15-minute precipitation/snow/wind samples when available and hourly cloud cover,
falling back to hourly rows if the regional quarter-hour fields are absent.
Expired current weather no longer stays frozen just because the view remains open.

Forecast boundaries are predictions, not observed minute-accurate household
weather. The provider has 15-minute resolution, so a predicted boundary two
minutes ahead can trigger two minutes later, but the app cannot invent a new
two-minute precipitation forecast. See the provider's
[15-minute variables and regional resolution](https://open-meteo.com/en/docs).

## Database and release

Migration: `supabase/migrations/202610200001_property_models.sql`. Applied to dev
`wsdomkzhnksyjrpxqfvn` and, with explicit approval on 2026-10-20, production
`arkpfdsglgufnnukader`, each after an isolated dry run listing exactly this migration.
Production read-only checks confirm RLS, no anonymous reads/direct client writes,
and service-only save RPC execution. The normal CLI link and environment files
were not changed.

RLS permits members to read their household's records. Direct client writes and
anonymous access are revoked. The existing authenticated energy HTTP gateway
validates project-pinned JWTs, membership, bounded gzip decoding and mesh data;
only its service client can call the atomic save RPC. The RPC rechecks the actor's
membership and expected revision under a household lock, enforces eight models
per household, and never accepts a stale replacement. The payload has a 3.9 MB
base64 transport limit and 32 MiB decoded limit. Oversized models fail visibly;
chunked/object-storage assets and model history are not implemented in this
increment. Household property data is not energy-vault data or end-to-end encrypted.

Production backend `dpl_A9aM1p1g4XDLmignhbD12wsYvNmu` is READY in fra1 on both
domains. All 355 uploaded source hashes match the isolated manifest; only
`api/energy/vault.mjs` and `src/services/property-model-server.mjs` differ from
baseline `dpl_9hCKW2n8NjQWLBoiUEgQm6KTuoYQ`. Existing web frontend and dependencies
are unchanged. Missing/invalid authentication returns 401/no-store on both domains;
the public auth configuration still selects production.
An old client can continue using its existing provider path.
Rollback retains the new model table and data while restoring matching previous
client/backend artifacts. Do not install the new client against an old backend.

APK `dist/Stromblik-1.0.72.apk` (versionCode 73), 89,050,619 bytes, SHA256
`172C52CE6349D74E80FCEDED3A9DD3864C575D52B701AD69078FA72CA3DEDEFE`, was built
from `.tmp/property-model-apk-release`, retaining the existing test/debug signing
certificate and excluding unrelated charger work. Staged TypeScript, Gradle,
APK-v2 signature, version, 18 packaged source comparisons, exact packaged/build
bundle equality, production API and server-credential exclusion checks pass.
Installed with `adb install -r` on the verified Samsung SM_A576B, retaining data;
installed version 1.0.72/73 and activity launch Status ok confirmed. The phone
remained locked, so no native model interaction or authenticated read/save was
verified. No commit, push, secret/auth/config change or web frontend release.

## Verification

### Oversize save repair (2026-10-20)

Read-only production metadata showed zero saved models. The physical Samsung UI
showed `Husmodellen er for stor til at gemme.`, confirming rejection by the
client's encoded-size guard, rather than a database authorization failure.
`encodePropertyModel` now shortens each Float32 geometry value to the shortest
decimal that restores the exact same Float32, and omits normals only after
checking they can be regenerated bit-for-bit. `decodePropertyModel` reconstructs
those marked normals; custom/smoothed normals that differ remain stored. Gzip
uses level 9. Neither images/colors, topology nor coordinate precision are
removed. Existing JSON payloads remain readable; the backend/schema/quotas are
unchanged. Clients older than this normal-restoration change should not be used
to read packages containing `normalDerived`.

Regression: a 600,000-value geometry exceeded the prior transport bound at
5,543,724 encoded bytes, but fits at 3,861,320 after decimal compaction, with
identical Float32 data and preserved colors. Actual bundled geometry/terrain
with synthetic bounds and without photo analysis fit at 3,468,080 encoded bytes
after normal elision; this measurement is not an authenticated real-property
save. Tests also check exact Three.js normal restoration and custom-normal
preservation. Viewer first-save/reopen and saved-mesh/color/weather suites pass.

APK `dist/Stromblik-1.0.75.apk`, versionCode 76, 89,053,019 bytes, SHA256
`11926C87A04E89B07A9D57277FABAFA3067A61AADAB2B008813FA7875E3742A9`, built
from the existing isolated stage and installed with data retained on the Samsung.
Root/staged TypeScript, Gradle, same test/debug certificate, version/signature,
18 packaged sources, exact bundle equality, production API and credential
exclusion pass. Installed version and successful activity launch confirmed.
1.0.74 was an intermediate decimal-only test, superseded by 1.0.75. No backend,
database/schema/auth/config release, commit or push in this repair increment.
Authenticated production save was verified on 2026-10-20: phone displayed
`Husmodel gemt`, and read-only database metadata confirmed one row, revision 1,
2,967,220 encoded bytes / 12,106,893 raw bytes, saved at 13:05:58 Copenhagen.
Cold restart and normal navigation back to the property retrieved the scene
but the native WebView stayed loading with the large literal HTML configuration.
Revision/timestamp remained unchanged. This exposed a separate native restore
problem; do not treat the successful save as proof of successful phone reopening.

The follow-up sends gzip/base64 configuration into the renderer, then restores it
with JSON.parse inside the WebView. This replaces the oversized executable mesh
literal without changing database data, source measurements or live weather.
Root/staged TypeScript, saved viewer/first-save/reopen browser tests and focused
390/1280px terrain/low-Moon smoke pass. APK `dist/Stromblik-1.0.76.apk`, code 77,
89,058,395 bytes, SHA256
`82EEAD08CBAF82786FFAF7F1221D6ACE4F8E6F18258A80A15EB967C1F26EAFE7`, same
isolated release and certificate; package/source/bundle/API/credential checks
pass. Native installation/restore verification is tracked in the handoff.
1.0.76 installed via USB `install -r`, retained data, installed code 77 and
activity launch Status ok confirmed. The app then displayed the existing forced
onboarding preview (`FORCE_ONBOARDING_PREVIEW = true` in AppScreen), not evidence
of lost authentication. The regular introductory skip was tapped, but no profile,
provider or Auth metadata save was performed. Asked the user to complete the
preview and open Hus & sol; the final physical restore remains pending that step.

Physical follow-up on 1.0.76: user completed the preview and opened Hus & sol.
Screenshot `.tmp/model-76-verify.png` shows the restored colored facades and roof.
Closed the property page via its back button and reopened it from Profile ->
Mit hjem. The page showed its load indicator, then the textured scene with saved
facade/roof colors (`.tmp/model-last-ready.png`). No rebuild button was pressed.
Read-only production metadata still shows exactly one model, revision 1 and the
same 13:05:58 save timestamp. Authenticated save and real native restoration are
therefore confirmed. A continuous first-frame recording and precise startup
timing were not captured; some loading time remains, and no 5x speed claim is made.

- `node scripts/test-property-model.mjs`: compression/base64 round trips, address
  binding, geometry bounds, decompression limits, authentication/membership,
  validated service-only save and HTTP conflict handling (synthetic service I/O).
- `scripts/test-property-model.sql`: real dev DB, rollback-only fixtures for
  member/non-member/anonymous reads, RPC grant boundaries, replacement and stale
  revision rejection. Existing energy-vault/agreement/onboarding SQL suites pass.
- `node scripts/test-property-model-browser.mjs <playwright/index.mjs>`: actual
  WebGL prepared-mesh/colour restoration, 162 building meshes reduced to five,
  timed rain then snow without scene replacement or static writes. A measured
  synthetic run was 293 ms preparation versus 145 ms restoration, excluding photo
  analysis/network and using desktop software rendering, not Samsung performance.
- `node scripts/test-property-model-viewer.mjs <playwright/index.mjs>`: actual
  React/web viewer at 390/1280 px, one model database read and zero property/photo/AI
  calls, same scene through visibility/weather/camera updates, no static writes.
  The first-preparation scenario also saves once and reopens the resulting package
  without another source-provider or analysis call (synthetic HTTP storage).
- `node scripts/check-home-weather-live.mjs`: public Copenhagen contract returned
  72 hourly and 100 quarter-hour samples and a current applicable row.
- Weather/cardinal motion, Moon, original facade colours and opening placement
  regressions, terrain-enabled sky browser checks, TypeScript-only and renderer
  bundle compilation pass.

Not yet verified: authenticated deployed model read/save, real-property initial
preparation end to end against the new backend, actual model package size and
speed on the Samsung, native touch and hidden-WebView restoration. The complete
app has not been measured at five times faster.
