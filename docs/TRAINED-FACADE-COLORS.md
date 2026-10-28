# Trained facade color proposals in the app

## Brickwork appearance (2026-10-21)

Scale follow-up: the user requested twice the visual size. NF reference remains
228 x 108 x 54 mm (visible stretcher face 228 x 54 mm) and 12 mm joints; display
scale is explicitly 2. Thus displayed faces are 456 x 108 mm with 24 mm joints,
and row/cell pitches are 480 x 132 mm. This is a readability exaggeration rather
than a change to the building's physical scale. The browser test verifies five
brick cells over 2.4 m instead of ten, larger grey joint interiors, original
facade hues, angled walls and compatibility with photo-material resets.

Scale build: `dist/Stromblik-1.0.81.apk`, code 82, 89,743,591 bytes, SHA256
`a36b43cc612dd6819f6e2632cdb8400d7b477de239b0305463fc5f29e72fdc5c`.
Root/staged TypeScript, Gradle, metadata, existing test-certificate APK v2
signature and packaged bundle/renderer checks pass. Two staged sources updated;
196 unrelated source hashes unchanged. Same production API, no server deployment,
database/auth/config changes or Git commit/push. Physical doubled-pattern
appearance remains unverified.
Wi-Fi `install -r` succeeded on the same verified Samsung R5GL33DH30M with
app data retained.

Facades now display an illustrative running-bond brick pattern in the existing
estimated facade color, with neutral grey `#969696` joints. Nominal bricks are
228 x 54 mm with 12 mm joints. The pattern is evaluated in meters on each wall
plane, including angled walls, and filters joints at distance to reduce aliasing.
Brick tones vary slightly; no individual brick geometry or downloaded texture
is added. This is the requested temporary appearance, not a material or mortar
classification from imagery. Roofs, openings and training pixel masks retain
their existing rendering/analysis.

New prepared walls retain a small brickwork flag. Older saved walls work on
reopening: known facade surfaces are explicit; anonymous old neighbor geometry
is classified conservatively by vertical triangle area before batching. Brick
walls and plain roofs are batched separately. The pattern survives photo-material
resets and composes with photo projection. A model rebuild is unnecessary for
the pattern itself.

`test-brickwork-browser.mjs` verifies actual red-brick and grey-joint pixels,
angled yellow walls, wall-versus-floor classification, and material reset;
no shader errors. Actual residential photo inference still gives 12 learned
buildings (11 neighbors), retains saved colors/evidence, and reopens without
analysis. The prepared-model app browser test passes at 390/1280 px. Root and
isolated-stage app TypeScript pass. Screenshots are under `.tmp/brickwork/`.

Built and installed `dist/Stromblik-1.0.80.apk` (code 81) over paired Wi-Fi with
`install -r` on the same Samsung, preserving app data. Artifact is 89,743,247
bytes, SHA256 `123f1ebacd035804e7b26be53d1a2a791ded3204700116adf4b9ac759ce0cd75`.
Same APK v2 Android test/debug certificate as 1.0.79; production API remains
`https://dit-hjem-five.vercel.app`. Five changed stage files match exactly;
193 unrelated staged sources retain their hashes. Exact renderer/bundle,
18 native-source, metadata/signature and exclusion of 22 private environment
values checks pass. No backend deployment, database/auth/configuration change,
commit or push. Physical brick-pattern appearance remains unverified.

## Neighbor imagery repair (2026-10-21, released and installed)

APK 1.0.78 enabled neighbor inference but the existing model-photo endpoint still
cropped around the main house. Thus most neighbors had no usable facade pixels.
The repair adds an optional `neighbors=1` plan and allowlisted `tile` requests to
the same endpoint. Actual non-associated neighbor buildings are grouped into
70 m windows across the existing surroundings geometry, at most 64 windows.
Each window supplies up to four calibrated cardinal JPEGs, no more than 1024 px
on either axis. Terrain bounds come from the local window. Existing main-house
requests and roof inference are unchanged.

The app streams one window at a time, waits for a renderer acknowledgement,
then releases its photographs. GPU wall/depth masks retain existing occlusion
and interior-pixel checks; the same trained color snapshot predicts colors from
each neighbor's own facade evidence. Missing imagery remains neutral. Progress
and unavailable-area counts are shown; final colors, evidence, building identity
and completed/failed window counts are saved together. Existing saved models
are restored directly; use **Opdater husmodel** after installing the repair.

Tests: server plan/crop/failure bounds, client rejection of old server responses,
facade predictor and prepared-model regressions pass. Actual residential photos
from two windows increased learned-color buildings from 1 to 12, including
11 neighbors, with no browser errors. Saved wall identity/colors/evidence remain
present and reopening performs no new analysis. This test uses decimated height
grids and Chrome software rendering; physical-device appearance is unverified.
The app browser test at 390/1280 px also confirms one final save after the
neighbor acknowledgement, with no provider/AI calls on reopening.

Reproduce read-only fixtures with
`node --env-file-if-exists=.env scripts/prepare-neighborhood-color-fixture.mjs`,
then run `scripts/test-neighborhood-colors-browser.mjs` with the local Playwright
module path as its first argument. Fixtures and screenshots stay under ignored
`.tmp/neighborhood-color/`; training annotations are never modified.

Production release evidence is under `.tmp/neighborhood-color-release/`: only
the address route and two new helpers differ from the verified live baseline;
all four reused imagery/geometry dependencies match live hashes. This backend
change is deployed as `dpl_H8sfyDWBUYU9TzEWfwrRii53m6Pu`, READY in fra1,
with rollback `dpl_A9aM1p1g4XDLmignhbD12wsYvNmu`. All 357 source hashes
match the approved manifest. Both production domains return the new plan and
four calibrated neighbor photos; existing main-house photos and production
Auth configuration remain valid. All twelve residential windows returned four
photos each, covering 122 candidate buildings (image availability, not proof
that every candidate has usable facade evidence or a predicted color).

APK `dist/Stromblik-1.0.79.apk` (code 80, `dk.dithjem.stromblik`) targets
`https://dit-hjem-five.vercel.app`. Gradle, root/staged app TypeScript,
metadata and APK v2 signature checks pass with the same Android debug/test
certificate as 1.0.78. Nine staged sources match the repair exactly; 188 existing
unrelated staged sources retain their hashes. Eighteen original and two new
packaged native sources, exact renderer/bundle equality and exclusion of 22
private local environment values pass. Artifact: 89,740,667 bytes, SHA256
`859875d4ee83abbf7e16f2ee7532783dc5cb4f27cf08060c2354e8db54a32146`.
After explicit approval, Wi-Fi `adb install -r` succeeded on the verified
Samsung SM_A576B, serial R5GL33DH30M, retaining app data. Installed versionName
1.0.79/versionCode 80 and activity launch Status ok were confirmed. A screen
capture shows the existing introduction preview; no intro/auth/profile actions
were performed. Physical
neighbor-color appearance and full-neighborhood processing time remain
unverified; no saved-model rebuild was triggered. No database/auth/config
changes, Git commit or push.

The renderer includes an inference-only snapshot of the local facade color
trainer: `src/generated/facade-color-model.ts`. Initial version
`2026-10-21T13:54:14.800Z` contains 566 feature/HEX samples from 126 training
buildings. Its existing 36-building test reports RGB MAE 45.36/255, versus
77.34/255 for direct median color. These are trainer metrics, not measured paint
accuracy or a separate app/neighborhood accuracy benchmark.

No addresses, building IDs, source photos, Python runtime or server credentials
are included in the snapshot. Inference is browser/WebView JavaScript and needs
no external AI service. Heavy house-segmentation models remain in the isolated
trainer; this integration is the facade-color predictor, not those models.

## Image evidence and building identity

GPU camera/depth masks identify visible walls of each building, including
neighbors in the existing photos. Roof/ground/other buildings occlude them.
The 0.45 m bottom / 0.8 m roof exclusion, edge erosion, minimum area/width and
sample thresholds match the trainer's strict version-2 contract. Exact masked
JPEG-pixel RGB quartiles and distance-weighted kNN match trainer predictions.
At least two view IDs are required per building. An inference-distance threshold
is derived only from distinct-house training-neighbor distances; unsupported
features abstain. Existing photographic estimates remain the fallback.

One robust HEX proposal applies to the observed building's walls. Predictions
are never copied from the main house to a garage or a neighboring building.
Only neighbors whose facades appear in available calibrated photos can receive
learned colors. Aerial roof textures and remote buildings without usable facade
evidence are not recolored by the learned predictor. No extra provider downloads
or paid AI calls are introduced. Masks are geometric evidence, not proof of
correct facade segmentation; vegetation/openings can still contaminate them.

## Saving and model updates

Wall estimates retain `method`, `modelVersion`, view/face/year/pixel evidence,
and low confidence in the prepared scene's colors. Existing save/restore retains
them. Neighbor wall identity is kept for observed estimates; unsupported neighbor
walls can still be batched on the saved path. Explicit manual facade models
retain their existing rendering precedence.

The scene displays that these are approximate AI facade-color proposals.
Previously saved models preserve their recorded appearance. After installing a
new app/model version, use **Opdater husmodel** to recompute colors from the new
snapshot; merely opening a saved house does not silently rebuild or save it.

After training a better color model, refresh both snapshot and renderer with:

```powershell
node scripts/update-app-facade-model.mjs
```

Then build/release the app normally. This is a bundled model update, not a remote
hot update. Unknown model/feature formats fail explicitly during export. Original
ignored training data and archived models remain in the side project.

## Verification on 2026-10-21

- App and trainer predictions match on 50 actual model samples; feature extraction
  matches on 16 existing strict original-photo patches. Synthetic tests verify
  independent main/neighbor colors, multi-view requirements, abstention, unchanged
  roofs, source/version metadata and cancellation.
- The generated production renderer on real calibrated photos produced a learned
  main-house color with saved version/evidence and no annotation/backend writes.
  Reopening used saved meshes/colors without photo analysis or static saves.
- Existing facade-color checks, trainer annotation browser checks, saved-scene
  neighbor batching/weather checks and actual React viewer first-save/reopen at
  390/1280px pass. Focused app TypeScript passes. Root `tsc --noEmit` is blocked
  by pre-existing syntax errors in unrelated `update_page.js`.
- No production deployment, database/auth change, new APK, physical-device test,
  commit or push in this increment.

## APK 1.0.78 installed

On 2026-10-21 the user explicitly requested installation. Built APK 1.0.78
(versionCode 79, package `dk.dithjem.stromblik`) from the existing isolated
`.tmp/property-model-apk-release` native entry. Only the ten facade-integration
sources/assets were updated there; 185 unrelated staged source files retained
their hashes. Staged app TypeScript and Gradle `assembleRelease` pass.

Artifact: `dist/Stromblik-1.0.78.apk`, 89,733,155 bytes, SHA256
`c6b8dacc4f1f31a30451719753ecc083720362407d68967ba0d2744cf18c3ed5`.
APK v2 signature verifies with the same existing Android debug/test certificate
as 1.0.77 (certificate SHA256
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`).
Metadata, eighteen packaged native-source checks, exact built/packaged bundle,
exact tested renderer, color-model/UI markers, production API target
`https://dit-hjem-five.vercel.app`, and exclusion of 22 private local environment
values pass. Reports are under `.tmp/property-model-release-evidence/`.

USB `adb install -r` succeeded on verified Samsung SM_A576B, preserving app data.
Installed versionName 1.0.78/versionCode 79 and `am start -W` Status ok were
confirmed. NotificationShade covered the app during the final display check;
no gestures or model rebuild were performed. Physical facade-color appearance
and native recomputation remain unverified. The user must use **Opdater husmodel**
to recompute a previously saved scene. No backend deployment, database/auth/config
change, Git commit or push occurred.
## Trained-model APK 1.0.84 (22 October 2026)

The user requested bundling the newly trained model and deploying a new APK.
Frozen source: `.tmp/trained-model-apk/review-model.json`, version
`2026-10-22T13:28:17.291Z`, 338 training buildings and 1,231 samples.
All included reviews matched their current accepted revisions; results requiring
manual colour confirmation were checked against their confirmed fingerprints.
The portable model includes only inference features/HEX values and aggregate
provenance/evaluation, not training photos, addresses or building IDs.

The fixed human-confirmed holdout RGB MAE is 47.683 versus manual-baseline
45.359 (lower is better). This snapshot is newer, not a verified accuracy
improvement. Existing multi-view, pixel-mask and out-of-domain checks remain.

APK `dist/Stromblik-1.0.84.apk`, package `dk.dithjem.stromblik`, versionCode 85,
89,874,455 bytes. SHA256:
`cf28fea5ad759f53d6b9c0f539e89caa7c92b758d3e00f54451c51d0434df8dc`.
It uses the existing isolated `.tmp/property-model-apk-release` native entry.
Only the portable model and generated renderer changed among its 201 staged
source files; the other 199 retained their hashes. APK v2 signature and previous
certificate continuity pass with the existing Android debug/test certificate.
This is a test-signed artifact, not a production-store release.

Trainer/app prediction parity on 50 samples, feature parity on 16 real-photo
patches, conservative inference checks, staged TypeScript, Gradle release,
actual-photo renderer/save/reopen checks, 18 packaged native-source comparisons,
exact packaged renderer/bundle equality, model version/hash/counts, production
API target and credential exclusion all pass. Evidence is under
`.tmp/trained-model-apk/` and `.tmp/property-model-release-evidence/`.
The embedded API remains `https://dit-hjem-five.vercel.app`; its public auth
configuration was checked against the production Supabase project.

USB `adb install -r` succeeded on the verified Samsung SM_A576B with data retained.
Installed versionName 1.0.84/versionCode 85 and activity launch `Status: ok` were
confirmed. No property navigation, model rebuild or physical colour assessment
was performed. Use **Opdater husmodel** to apply the new snapshot to an existing
saved house; ordinary reopening preserves saved appearance. No backend deployment,
database/auth/config changes, Git commit or push.
