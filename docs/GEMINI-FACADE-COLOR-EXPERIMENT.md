# Gemini facade colour experiment

2026-10-18. Early experiments below were local only. See the geometry-masked integration
section for current implementation and release boundaries.

Run `node scripts/probe-house-facade-colors.mjs <model-photos.json> <output.json>`.
The script reads existing local server-only Gemini configuration without logging credentials.
It sends original oblique JPEGs together, requests explicit visible wall evidence, validates
the JSON structure and normalized coordinates, and stores results outside tracked source by default.
Coordinates being valid does not prove that a polygon actually encloses a wall.

The prompt requests one uniform colour per genuinely distinct wall material/physical region.
Shadows, lighting, mortar, windows and minor brick variations must not introduce extra regions.
There is no fixed limit of two colours. Neighbouring buildings and separate garages are excluded.

## First real-photo result

Four existing oblique views from 2025-05-12, original crops approximately 200–350 pixels across.
Gemini proposed one yellow-brick region, colour `#B89B6D`, across the main house.
It reported high confidence, but this is uncalibrated model self-confidence, not measured accuracy.
Visual comparison of the south-view evidence polygon reveals roof contamination. The result
therefore remains a candidate for review, not a validated facade colour or accepted model update.
The first unstructured attempt failed evidence validation; a structured response schema was added.

Next gate before app integration: cross-check model evidence against calibrated wall geometry,
reject roof/ground regions, and expose uncertain colour estimates rather than silently applying them.
Do not hardcode this property's colour into the general renderer or apply a main-house estimate to a garage.

Use original photographs for colour estimation. Generative upscaling can invent texture;
it must not become evidence for exact wall colour, brick details or surveyed geometry.

## Eight-view brick-only retry

`scripts/fetch-facade-reference-photos.mjs` fetches two recent, least-steep
calibrated source images per compass direction, using bounded original TIFF windows,
JPEG quality 95 and no artificial upscaling. This local reference-property experiment
uses the existing geometry file and conservative vertical crop bounds, not an automatic
nationwide production service.

The revised prompt explicitly excludes mortar/joint pixels and forbids choosing colours
from expectations about Danish houses. Eight original views were successfully fetched.
Gemini suggested `#B59A72`, but explicitly admitted it could not separate bricks from
mortar at this resolution. Its west-view evidence polygon also covers roof, not wall.
Thus neither its colour nor evidence is accepted for rendering. The output now caps
confidence at low when resolution/separation limitations are reported and always marks
the result as requiring geometry review. One earlier retry failed region validation.
No app colour update or production deployment occurred.

## Geometry-masked app integration

The 3D engine now renders an offscreen face-ID/depth pass with the calibrated source
camera, at original image resolution. Actual roofs, terrain, buildings and vegetation
occlude the wall masks. Wall edges are eroded by one original pixel and upper/lower
wall bands exclude eaves and plinth. No AI-generated contours select the source pixels.
Mask accuracy still depends on reconstructed geometry and camera calibration; this
does not eliminate unmodelled openings, roof overhangs or vegetation errors.

Up to two recent, less-steep photos per compass direction are requested for the model.
The gallery's source selection is unchanged. At most five directions are used by the
photo-projection shader to stay within mobile texture-unit limits; all available views
can contribute to analysis. At most 18 original-resolution wall patches enter Gemini.
Fugue/mortar, doors, windows and deep shadows within a wall remain semantic exclusions,
not claims of pixel-perfect brick segmentation.

The authenticated `wall-colors` operation reuses the existing energy API route. It
requires verified user JWT issuer/audience and household membership, bounded JPEGs,
dimension checks, per-user cooldown, and at least two distinct source views per colour
region. The Gemini key stays server-only; images/provider responses are never logged.
No database write or migration is introduced. Provider retention is governed by the
configured Gemini service, not this application's cache.

One uniform colour is used only when Gemini reports agreement across visible wall
planes. Distinct supported regions colour only their identified coplanar wall faces;
unknown faces retain neutral material. Same-face multicolour patterns are deliberately
not invented: they need finer localization. Self-reported resolution, shadow or mortar
limitations cap confidence at low. The old mixed-pixel facade averages are disabled.

The app invokes Gemini, passes the accepted result back into the actual renderer,
shows status and a retry action, and caches small palettes per user/household/address
for 30 days. A changed masked-image signature invalidates that cache; retry bypasses it.
Original photos are not copied into AsyncStorage. Photographic texture projection is
off by default so it cannot conceal the analysed uniform materials.

Actual Chrome/WebGL reference check: 18 wall patches across eight photos, approximately
3.4 seconds to prepare/decode/mask. Gemini returned one main-house region `#c4b6a9`
and a separate garage region `#b7aba1`; output was applied to the renderer and inspected.
This is evidence of functioning analysis/rendering, NOT ground-truth colour accuracy
or Android performance. Source wall crops were only 12–28 pixels high. No exact
brick/mortar separation, paint code, colour calibration or generated detail is claimed.

Synthetic server tests cover payload/image validation, missing/foreign evidence,
conflicting faces, multiple regions, confidence capping, auth, membership and cooldown.
TypeScript and existing selection/projection/photographic-colour tests pass.
Server release permission was requested separately; preparation alone is not deployment.

APK 1.0.50 (versionCode 51), `dist/Stromblik-1.0.50.apk`, 79,804,051 bytes.
SHA256 `7B46DC3169E88CB0CCEF6AA0F8B72FFEBC2C1E6F84FA02E9F35D73ACDE41A29C`.
Gradle release build, metadata, v2 signature and 20 packaged source comparisons pass;
production API is embedded and checked server-only credentials are absent.
Same existing debug/test certificate, not a store release. Neutral white lighting
avoids the former yellow/green material cast. Installation has been held pending
explicit server deployment permission; no production deploy, Git commit/push or
physical-device visual verification has occurred for this increment.

## Approved production release and installation

Following explicit approval, final deployment `dpl_2W2QuBrMjMW6E5Hn1Uzc6icRi8ge`
is READY on huslyg.dk and dit-hjem-five.vercel.app. Source-hash comparison confirms
the isolated four-file backend release. Both live wall-colour endpoints reject
unauthenticated requests with 401/no-store; public Auth configuration remains production.
Live reference model-photo request returned HTTP 200, five rendering photos plus four
extra `analysisPhotos`. Older clients therefore retain their five-photo shader contract;
new clients merge the extra references only for analysis. No database/config/secret change.
Original rollback checkpoint: `dpl_5zHKSeuvE9kZjwamZ4uBvjWqZdEg`.
An intermediate nine-photo response deployment was superseded by the compatibility fix.

Final APK `dist/Stromblik-1.0.51.apk`, versionCode 52, 79,804,159 bytes,
SHA256 `54D7A615AEAF59434C405E719564B42664E29C4D1AF7C512AE62D81775F886BF`.
Gradle, metadata, v2 test signature, 20 packaged source comparisons, production API
and checked credential absence pass. Installed successfully via wireless ADB on
Samsung SM_A576B with `install -r`, retaining app data; installed version confirmed
and MainActivity launch requested successfully. Window focus was NotificationShade,
so authenticated Gemini round-trip and final on-phone appearance were not verified.
No Git commit or push for this increment. APK 1.0.50 was not installed.

## Original-pixel sampling revision (local, pending release approval)

Gemini now returns normalized polygons identifying material interiors, not HEX colours.
`brick-pixel-color.mjs` decodes the source JPEG, insets selected polygons by 20%,
excludes near-black/clipped pixels, rejects mostly masked-out selections, and requires
at least six valid pixels per sample plus agreement from two independent views.
Per-view/channel medians and chromaticity consensus yield the actual photographic
colour. No white-balance inference, generated texture or upscale is introduced.
Distinct material regions keep separate face assignments. Semantic correctness of
Gemini's polygons is not guaranteed by these numeric validation checks.

The full original photo is now included as context for each source view, together
with the patch's exact source rectangle. This allows the model to reject a geometric
wall projection that actually includes a roof. Context photographs never supply
colour directly: selected patch pixels do. Authentication is unchanged per the
supabase-server skill; secrets remain server-only. Response method
`original-pixels-v2` and a new palette-cache namespace prevent silently using the old
HEX-inference method in the updated client.

Real reference check without context selected 198 main-house pixels, yielding
`#d1bba1`, but polygon inspection revealed excluded/roof contamination in some
selections, especially the garage. With full-photo context and stricter rejection,
Gemini returned no usable regions for either building, citing insufficient resolution.
This is a correct abstention, NOT proof of solved brick colour or individual brick
segmentation. Existing aerial wall crops are too small to promise mortar isolation.
The user's observation that photographic projection looks accurate does not establish
that individual brick faces are resolved; it remains useful for visual comparison.

Synthetic tests verify sampling brick-coloured pixels rather than adjacent grey mortar,
ignoring Gemini HEX values, independent-view requirements, tiny/invalid polygons,
evidence binding, region conflicts and existing authenticated endpoint protections.
TypeScript passes. No new deployment or phone installation for this revision yet.

APK 1.0.52/code 53 built and verified, `dist/Stromblik-1.0.52.apk`.
SHA256 `0B37EAA048FC27317CB6FB0F868D97F4689CBE3363CB1F3D071108B24229AF1A`.
Same test certificate; 20 packaged source comparisons, production API and checked
credential absence pass. Server deployment approval was requested; this APK has
not been installed while the compatible pixel-sampling server revision is pending.

Pixel-sampling release subsequently approved and deployed as
`dpl_GxyzdKJrBqZCDWioaXCGLtyWfLpj`, READY on both production domains. All source
hashes match the isolated manifest (new pixel helper and updated analysis server;
the route and two photo-server overrides are retained from the preceding release).
Live unauthenticated wall-colour requests return 401/no-store on both domains;
production Auth configuration is preserved. Rollback checkpoint:
`dpl_2W2QuBrMjMW6E5Hn1Uzc6icRi8ge`. No database/config/secret changes or Git push.
APK 1.0.52/code 53 installed successfully via wireless ADB on Samsung SM_A576B
with app data retained and installed version confirmed. The full authenticated
Gemini analysis and final facade appearance on the physical phone remain unverified;
installation alone does not demonstrate accurate brick selection or colour.

Physical inspection of APK 1.0.52 subsequently showed a native client error
`undefined is not a function`: React Native lacks `AbortSignal.timeout`.
Replaced it with AbortController + a cleared setTimeout in the colour client.
The synthetic native-style client regression removes AbortSignal.timeout and
confirms requests still complete; it also checks rejection of the old server method.
TypeScript passes. APK 1.0.53/code 54 built, signature/metadata/20 source matches/API
and checked credential absence verified; SHA256
`F383B4B43E98131AA092E5CE7A4DEAA9AFE627E9731CCE5BCD0FB114D4003084`.
Installed successfully with data retained and installed version confirmed, then
MainActivity launched. Screen became unavailable/asleep before final visual
verification, so the complete authenticated phone round-trip remains outstanding.
Server deployment remains `dpl_GxyzdKJrBqZCDWioaXCGLtyWfLpj`; no further server change
was needed for the native timeout fix. No new Git commit or push.

## Direct photographic facade appearance

The default 3D facade path now uses `facade-photo-colors.ts` locally, with NO
`wall-color-request`/Gemini invocation. GPU-visible wall patches identify eligible
source pixels, but colour values are read from their original context JPEG coordinates
at native dimensions. No resampling, AI upscale, sharpening or inferred HEX is used.
The lower/middle band avoids some roof/plinth contamination; brightness limits and
dominant RGB clusters reduce dark shadows and bright frames. Independent views must
agree per physical face. Tighter chromaticity clusters prefer a supported coloured
material over neutral mortar/roof contamination; a genuine high-chroma different
face can retain its own colour. This remains a photographic heuristic, not semantic
brick/mortar segmentation, proof of material identity or calibrated albedo. Dark or
low-chroma material differences may be ambiguous. No target yellow colour is hardcoded.

Original-photo reference WebGL check produced main-house base `#d1bba2`, uniform,
with no Gemini requests or browser errors, approximately 2.8 seconds. The garage
remains less certain. The brown/beige wall fallback `#b9b2a6` is replaced with neutral
grey `#c2c6ca`, with an explicit unconfirmed-facade notice when no estimate exists.
The UI no longer invokes/caches a Gemini wall palette; the separate server analysis
remains available for older clients. Roof estimation is unchanged.
Synthetic tests cover two-view agreement, brighter original observation, strong
distinct material regions and conflicting views. No new server/database change.

APK 1.0.54/code 55 built and installed via wireless ADB, retaining app data.
SHA256 `23C47FA59235698A19BE7D12C17D9FA73EC1E89CFF1A74FBF1B8EA49B154275D`.
Same test certificate; metadata/signature/production API/checked secret absence
and 19 packaged source matches pass. Verification also confirms the obsolete
Gemini wall-colour runtime client is absent from the package (the previous verifier
expected that now-removed module and was updated accordingly). Actual on-phone
facade appearance has not been verified for this build. No deploy, DB change or push.

## Garage photographic colour repair

Photographic projection now includes `building.associated` as well as the main
building, in both reconstructed-LiDAR and fallback geometry paths. It does not
include unrelated neighbours. Each associated building retains its own surface ID
and independent palette. Associated-building facade selection prefers the brighter
supported physical wall rather than letting repeated dark roof/shadow crops dominate.
The garage roof preferentially samples the parcel's nadir image when usable, with
single-view confidence explicitly low; otherwise the existing multi-view fallback
remains. Main-house colour selection is unchanged.

Actual reference WebGL check with eight oblique views plus nadir: house facade
`#d1bba2`, garage facade `#b6aa9c`, garage roof `#9a999e` (170 samples, one view,
low confidence). These are photographic estimates, not verified real-material colours.
Independent garage selection regression and TypeScript pass. No server/database change.

APK 1.0.55/code 56 built, signature/metadata/19 source matches/production API and
checked credential absence verified. SHA256
`35423FAAF19CA95D9062A6F94A18EA10D54B3D268AB438E81FF7A290A687C1D5`.
Installed successfully via wireless ADB with app data retained; final garage colour
accuracy on the physical phone remains unverified. No Git commit/push or deployment.

User correction: garage must share the main-house facade, not an independent colour.
Associated-building facade material now inherits the main-house base colour explicitly;
if that base is unknown, neutral grey is retained rather than a separate garage guess.
The garage-only nadir roof preference from 1.0.55 is reverted to the previous multi-view
roof calculation. Geometry, roof mesh and main-house roof calculation are unchanged.
Reference WebGL output: both facades `#d1bba2`; main roof `#999494`, garage roof
`#a6a2a1` from nine views. These remain photographic estimates, not ground truth.

APK 1.0.56/code 57 built and installed with app data retained. Metadata, signature,
19 packaged source matches, embedded production API and checked secret absence pass.
SHA256 `8512E61A5EF738A1FB77A55B147841257BBA11FDB9A0139272652E07FE6793A3`.
Actual WebGL assertions confirm identical main/garage facade and multi-view garage roof;
final on-phone visual comparison remains outstanding. No server deploy, DB or Git push.
