# Photo-guided facade openings

The existing authenticated facade-photo analysis is reused. No new server endpoint,
deployment, secrets or database changes are required. The user chooses an existing
saved photograph or captures one photo per visible facade, reviews the original AI
contours, the rectified drawing and the 3D preview, and explicitly saves the result.
No hidden facades or openings are inferred from aerial LiDAR alone.

`buildFacade` now renders openings only: panel/glass, jambs, frames, observed mullions
and window sill. It does not replace/repaint the wall or modify the roof. These are
shallow visual models in front of the authoritative mesh, not true Boolean holes,
measured frame/recess dimensions, indoor geometry or guaranteed photogrammetry.
Garage door segmentation uses only reported bars; the previous invented seven rows
are removed. Legacy saved pane counts remain supported.

For LiDAR buildings, `lidarFacadeAnchor` finds reconstructed wall vertices near the
registered facade plane and uses the lower eaves rather than the ridge or BBR storey
guess. The guide and opening renderer share this vertical reference. Raster/BBR
fallback remains for buildings without a compatible reconstructed model.
All heights and image-derived dimensions remain estimates.

Optional normalized placement sets the pictured region's left/bottom/width/height
and mirror orientation on the selected physical wall. Partial-photo placement begins
as an estimated centred region, explicitly adjustable before saving. Individual
opening rectangles can be fine-tuned by 0.5% of the rectified image's dimensions or
deleted when detection is incorrect. Source-photo contours continue to show the
original analysis; the drawing and 3D preview show the user's corrected rectangles.
Re-selecting a physical facade and moving a saved model replaces the prior model
with the same photo ID, preventing duplicate openings on the old wall.

Placement is validated and saved with the existing per-user/household/address local
facade store; legacy records without placement still load. Existing saved analyses
can be edited without another Google call. The guide includes associated buildings
for garage doors, without including unrelated neighbours. Main-building face IDs
remain coordinate-derived and stable.

Tests: full/partial/mirrored mapping, invalid bounds, LiDAR eaves, no wall recolouring,
opening geometry/disposal, existing photo-storage/face-ID regressions, TypeScript,
and actual Chrome/WebGL render/reset/reapply/disposal. WebGL evidence is synthetic,
not validation of the user's actual photograph or physical-phone appearance.

APK 1.0.57/code 58 built and installed via wireless ADB with app data retained.
SHA256 `F677508CD684D2189DB96B3219BEBFC807DBAEF4904FD037BC0BF0778219F01F`.
Same existing test certificate. Gradle, APK metadata/v2 signature, 20 packaged source
matches, embedded production API and checked credential absence pass. Placement
storage round-trip/account isolation/legacy-load/invalid-write preservation also pass.
Final on-phone analysis of the user's saved photograph, corrected opening positions
and physical appearance remain unverified. No production deploy, database change,
Git commit or push for this increment.
# Automatic oblique-photo openings (1.0.58)

## Photo-aligned opening refinement (1.0.59)

Artifact: `dist/Stromblik-1.0.59.apk`, versionCode 60, SHA256 `4031F9E9354F0C858886A62668310D27E5BF62C37B20C9876166A982B8C96726`. Gradle release, signature continuity (existing debug/test certificate), packaged source/API and absence of server credentials verified. No Android device or wireless mDNS service was visible at final check: not installed or physically verified. No deployment, database changes, commit or push in this refinement.

Client-only refinement; the deployed `aerial-openings` operation and its contour cache remain compatible. Opening planes now use the actual first-hit wall mesh offset rather than the nearest registered outline alone. A shared source/render height anchor prevents vertical rescaling on non-LiDAR houses. Opposite contour edges are fitted and back-projected into the original camera; excessive pixel residuals are rejected. Duplicate detections select the larger, front-facing, lower-residual observation instead of the highest model confidence. Only visible openings on main/associated walls are eligible; this is not an exhaustive inventory of hidden openings.

Window-frame colour is sampled locally from narrow bands within source-image contours at native resolution, excluding the central glass. The AI-proposed frame hex is not used for automatic openings. Supported light neutral frames are harmonized per building; clearly chromatic frames are retained. Missing/unclear samples use a neutral placeholder, not guessed black. Glass is represented separately, with a consistent blue-grey appearance, not claimed measured glass colour. Door/garage panels use median original interior pixels (which may include glass or shadows), not AI-proposed hex. Manual photo-guide models are unchanged and retain precedence on their wall. Versioned automatic model IDs prevent previous misaligned adjustments from being silently applied to revised geometry; prior local edits remain stored.

Validation: synthetic exact calibrated rectangle with a 20 cm mesh/outline offset and distinct render height passes; original-pixel frame sampling/glass exclusion/shared neutral colours/distinct paint checks pass; reference-photo browser placement reports four geometrically eligible openings without JS errors. Existing reference roof and facade colour regression is unchanged. Physical interaction and real-house alignment still need visual confirmation.

Release: isolated production deployment `dpl_bq6H6YJfid9Qh9NaEmLax368B5V3` READY on both domains; complete source comparison confirms only `api/energy/vault.mjs` and `src/services/aerial-openings-server.mjs` changed. Rollback: `dpl_GxyzdKJrBqZCDWioaXCGLtyWfLpj`. No database changes. APK `dist/Stromblik-1.0.58.apk`, versionCode 59, SHA256 `E45B0609CA97C01EB8505D714DBD0869D3D37793CAA96F49B1C6241AA0AF588A`, existing debug/test signing certificate. Packaged 22 client sources/API/absence of server secrets checked. Installed with `adb install -r` on Samsung SM_A576B; version and launch verified, phone Dozing. Physical long-press/resize and authenticated production analysis remain unverified. Local real-photo Gemini call and calibrated browser placement passed; synthetic analysis boundary, auth/membership/quota and facade geometry/disposal checks passed. No commit/push.

The authenticated `aerial-openings` operation uses existing original oblique JPEGs with Gemini. The existing energy endpoint, user JWT issuer/audience pin, household membership check, bounded JPEG decoder and burst limit are reused. No database schema changes or client-side provider keys.

Image contours are ray-projected using calibrated source cameras. Only the first wall hit on the registered main/associated property is eligible; roof hits and unrelated neighbours are rejected. Contours are mapped onto registered exterior faces and overlapping observations deduplicated. Hidden openings are not reconstructed. The reference-photo check produced 14 image detections, of which four passed geometric placement. This is not an exhaustive or surveyed window inventory.

Long-press an opening in the simplified model, release, then drag to move. Select Størrelse to drag width/height; Slet removes a false positive and Færdig exits. Manual facade-photo models override automatic detections on the same wall. User/household/address-scoped local storage retains adjustments; original normalized contours are part of each edit key. Photo-analysis caching is additionally tied to original image content. No cloud edit sync is implemented.

The visible plinth is a separate thin material band, initially **an explicit 30 cm visual estimate**, adjustable 0–120 cm and neutral colour presets. LiDAR provides the building ground anchor, not a measured plinth upper edge. It does not modify roof geometry or existing brick-colour estimation. Ground slope/hidden foundations are not surveyed by this band.

# Multi-year multi-view openings (1.0.60)

No user photographs. Why the earlier method misplaced openings: the reference crops are about 200 px wide (7-11 cm/px, a wall is ~13 px tall), so a model tracing quads in 0-1 coordinates cannot place a 1 m window to better than a few pixels, and the real wall lies behind the footprint (the footprint is the roof edge) so every ray-cast shifts openings along the viewing ray. Camera registration is not the problem: the footprint at eaves/ground height overlays the roofs and plinth within roughly 1-3 px in all four directions.

New operation `aerial-openings-multiview` (same energy endpoint, same auth/membership; no schema, secret or function-count change):
- `home-photo-history.mjs` lists every calibrated oblique photograph of the address, all survey years since 2014 (reference house: 65 photos, five flights 2017-2025, 35-66 degrees elevation). Native-resolution windows are read per photograph.
- `facade-multiview.mjs` rectifies each footprint wall from the best views, masks self-occlusion, normalizes exposure (shaded flights are otherwise unreadable), registers views only where there is clear evidence and fuses them by per-pixel median into one front-on image per wall.
- `facade-multiview-server.mjs` splits the views alternately into two independent groups, asks Gemini for native `box_2d` boxes on each fused image and keeps an opening only if both groups agree (overlap/min area >= 0.5, same kind); one-group evidence needs confidence >= 0.9 and an empty other group. Sizes are validated per kind. Results are returned in world coordinates (EPSG:25832 + DVR90) with no image data and cached per address for six hours; the client caches for 30 days.
- Client: `aerial-facades.ts` maps wall openings to the matching physical face by geometry and orientation; an old server (or empty result) falls back to the previous per-photo method.

Limits: the wall plane is assumed 0.4 m inside the footprint. A plane sweep that finds it from photo parallax is implemented and recovers it exactly in synthetic tests with perfect cameras, but real imagery (calibration error of 10-20 cm, wall only a few pixels tall) gives no decisive peak, so it is only used when it is decisive (peak >= 0.45 and margin >= 0.2); otherwise a vertical error of up to ~0.15-0.3 m remains for a wall whose real overhang differs. Walls hidden by vegetation or shaded in all flights yield nothing, and detections remain visual estimates, not surveyed dimensions. Frame/panel colours are neutral (original-pixel sampling is not available for historical photos).

Verification: synthetic scene (exact cameras: 3-5 cm; 10-20 cm calibration error: <= 15 cm), server/endpoint tests, client placement test, and real reference-address run (live photos, DHM, Gemini) rendered in the actual engine in Chrome/WebGL: the west wall received two windows and two doors on which both groups agreed. Not verified: accuracy against surveyed windows, authenticated production path, physical phone. Reference runs: `.tmp/mv-live.mjs` (needs local keys).
