# BoligDNA facade color trainer

Start from the repository root:

```powershell
node side-projects/color-trainer/server.mjs
```

Open **http://127.0.0.1:8791** in Chrome or Edge. This is a separate local
tool; no Supabase database, deployment or production app changes are involved.
It reads the existing `.env` server-side for `DATAFORDELER_API_KEY` and
`DATAFORSYNINGEN_TOKEN` (or `DATAFORSYNING_API_KEY`). No credentials are sent
to the browser. The server only binds to loopback and rejects foreign origins.

## Workflow

Find a random house, inspect its original oblique photos, and choose one color
or enter its confirmed HEX value for the entire house. All main-house walls,
including hidden walls in the preview, receive this color; roof and neighbours
keep their existing appearance. No individual facade selection is required.
Quick color buttons apply a consistent whole-house HEX: Hvid `#f7f7f4`
(slightly warm off-white), Rød `#96533a`, Gul `#fbe9a2`, Grå `#98938f`
and Brun `#796456`. The selected button is highlighted; custom HEX and the color
picker remain available. A button selects the color; save or approve as usual.
The trainer displays main-house facade colors without simulated lighting or
shadows, so white stays white and the preview matches the chosen sRGB HEX.
This display setting does not change the original photos, extracted features,
saved labels, or the production app renderer.
“Kan ikke vurderes” skips the house.
“Godkend og næste hus” persists the review before requesting another house.
Facade surfaces with fewer than 20 usable sampled pixels across their views are
excluded individually, with a visible warning. Other valid surfaces remain
approvable; excluded surfaces never become training labels. If none remain,
approval stays disabled and the house must be skipped. Malformed images still
report an analysis error rather than being silently excluded.
Use “Gem kladde” before closing; unsaved edits trigger a browser warning.
The server expands the one house-level approval into labels for the observed
facade crops and records `annotationScope: whole-house`. Hidden walls receive
the display color but do not acquire invented photo crops. Older facade-level
annotations remain readable; a new house-level approval supersedes them with
the chosen common color while retaining the revision history.
Reopen any task from the history dropdown. Disk snapshots include original
predictions, calibrated photo crops, geometry, feature vectors and an append-only
review history. Revisions prevent stale browser tabs overwriting each other.
Back up the ignored `data/` directory; do not delete it when updating the tool.

## Sampling inspection (2026-10-21)

Original photos now show a toggleable sampling overlay: translucent green marks
accepted facade masks, brighter green marks the exact sampled pixels, and orange
marks excluded views with a reason. Toggle the overlay off when judging the
actual color. Each crop is linked to the exact source direction/date/camera crop;
its saved pixel coordinates are reused after reopening.

New analyses use trainer-only sampling version 2. The adapter excludes the upper
0.8 m and lower 0.45 m of wall geometry, avoids grazing views, and erodes mask
edges by another 2–5 pixels depending on projected size. Each view needs at least
128 interior pixels, an 8-pixel span in both dimensions, 15% mask occupancy and
32 usable color samples. Weak views cannot pool their pixels to pass. Exact
binary masks prevent black JPEG padding/edge artifacts from entering features.
These are conservative heuristic thresholds, not measured geometry uncertainty
or evidence of semantic roof/window/vegetation recognition.

Previously reviewed tasks keep their original labels, crops and predictions
unless you explicitly correct their sampling area.
Legacy analyses are marked clearly; only dashed crop bounds can be shown for
them because their exact binary masks were not saved. Unreviewed tasks with no
labels/history may upgrade automatically, retaining their previous analysis in
`previousAnalysis`. Newly created houses use the stricter checks. Existing model
snapshots are not retrained or replaced automatically.

Run the read-only calibrated-photo browser check with an installed Playwright
module path:

```powershell
node side-projects/color-trainer/inspection-check.mjs <path-to-playwright/index.mjs>
```

The check uses existing local source photos but writes analysis/reviews only to a
temporary dataset. It covers 390/1280px overlays, toggle, rejection, save/reload,
legacy evidence preservation and empty-analysis approval blocking. Fourteen unit
tests cover erosion, slivers, exact-mask features, per-view rejection and durable
analysis. No production renderer or training-label migration is involved.

### Draw a corrected sampling area

All polygon editors now fill the browser viewport and provide zoom buttons,
wheel zoom, two-finger pinch, pan mode, fit-to-image and an optional native
fullscreen button. Coordinates remain relative to original pixels after zoom,
pan and resizing. The facade editor uses the same workspace as building parts.

Use **Ret facadeområde** below an original photo. The larger dialog lets you click
or tap polygon corners, undo the last point, start over, or cancel. **Gem område**
stores the correction as a draft. Choose/confirm the house color and approve it
again before the new samples enter training. Avoid roofs, openings and plants;
include representative lighting rather than only the brightest patch.

One polygon is supported per photo, with up to 64 normalized points; multiple
photos can be selected. While any manual selections exist, only those regions
are used, replacing all automatic samples for that house. The server crops the
stored original JPEG itself and rasterizes the polygon at original resolution;
the browser does not submit replacement image pixels. Small/empty polygons,
crossing edges, foreign-photo references and stale revisions are rejected.

**Ret tegnet område** reopens saved corners. **Fjern dette område** removes the
current photo selection; **Gendan automatiske områder** restores the initial
automatic evidence for the whole task. Both actions save a draft requiring
reapproval. Exact polygons, masks, source-photo keys, sampled pixels and feature
vectors are persisted, and polygon provenance is included in dataset exports.
Original automatic evidence and previous evidence revisions remain in
`automaticAnalysis` / `analysisHistory`; existing review history is retained.
Other tasks and saved models are not changed. Rebuild the model manually after
approving corrections, as with other labels.

## Building-part annotations

**Marker bygningsdele i fuld skærm** opens a separate annotation workspace,
starting with the saved aerial image when available. Pick an existing part to
mark it in another photo, or **Ny del** for another object. The six labels are
main house, residential extension, garage/carport, outbuilding/cover, other
building/neighbour and unknown. **Med i ønsket husmodel** is independent of the
category; extensions default to excluded and may be included explicitly.

Draw only visible outlines. Unmarked pixels are **unknown**, unless you explicitly
check that all visible building parts in that photo have been marked. Settings
can be collapsed to enlarge the image, including on short/landscape screens.
Undo, contour deletion, whole-part deletion, draft save, review and cancellation
are available. Review requires a marked main house and a contour for every part.

These labels are stored separately in ignored `data/parts-<taskId>.json` files,
with their own revision checks, append-only annotation history, normalized
polygons, common object IDs across views, source-image SHA-256, dimensions and
camera references. Existing task/color labels, their revisions and trained color
models are not modified. Export reviewed annotations with the building-parts
export link; source images remain in the original task snapshots.

This is the data-collection step for a later building-part model. The existing
color training button and optional CLIPSeg helper do not train on these labels
or automatically apply them to property geometry. No new part detector has been
trained or accuracy-validated yet. Start with varied reviewed examples before
fitting/evaluating one on separate physical properties.

Eighteen unit tests and isolated 390/1280px Chrome checks cover separate storage,
revision rejection, linked views, export/review, fullscreen viewport/native
desktop fullscreen, mouse/touch pan, two-finger zoom without added points,
coordinate preservation and unchanged color annotations. Physical phone behavior
has not been verified.

## First learning model

An optional whole-image facade helper is available through **Find facade med AI**.
It runs locally and shows blue suggestions; **Brug AI-områder** saves a draft
requiring color reapproval. It remains experimental because its first 9-house
held-out color comparison was worse than the current sampling method. The normal
color-training button does not fine-tune this image model. See
[SEMANTIC-EXPERIMENT.md](SEMANTIC-EXPERIMENT.md) for exact model revisions, privacy,
setup, evaluation numbers and the rejected first checkpoint.

“Træn på godkendelser” fits a distance-weighted nearest-neighbor regression
model over robust RGB quartiles extracted from geometry-masked original
facade pixels. This is a small supervised model, not a neural network or a
claim of illumination-invariant paint identification. It needs no GPU.
Unknown labels are excluded. Training requires at least three distinct training
buildings. A stable building-ID hash reserves about 20% of buildings for test.
All facade views/revisions of a building remain together; only the latest approved
label for each face is used. Test RGB MAE and the unchanged median-pixel baseline
are reported, or explicitly unavailable when no test labels exist.
Model snapshots are retained. New tasks use the latest trained model; previous
tasks retain their original predictions. Evaluation should expand to geographical
holdouts and perceptual color error before any production release.

The dataset export includes features, labels, photo references, attribution and
masked crops. Full calibrated source images and geometry remain in local task
snapshots. A later image model can reuse these reviewed samples. Human-selected
sRGB HEX is visual ground truth, not measured wall reflectance or a paint code.

## Existing pipeline and limitations

The tool imports the repository's address, GeoDanmark/BBR geometry, elevation
and calibrated oblique-photo providers. It bundles the actual `src/web/home3d.ts`
renderer with a local adapter to emit facade masks, select surfaces and preview
colors. The production renderer is not edited. Geometry is reconstructed from
existing building/height data; photos provide calibrated surface evidence.
This is not a newly reconstructed photogrammetric mesh.

Random discovery samples street names, house numbers and 32 postcodes across
Denmark (and checks the returned postcode), then filters by
available photos, main-building match and height. It is not a uniform national
sample, nor guaranteed to identify detached residential houses. It avoids previously
reviewed building IDs. No candidate after 24 attempts gives an explicit retry.
Provider/geometry errors can make a round fail. A task without visible wall masks
must be skipped. Geometry masks may include openings or vegetation; the reviewer
must reject contaminated examples. Distinct material zones on one flat wall are
not yet supported.

## Sources

Oblique imagery: © Klimadatastyrelsen, acquisition date retained per image;
CC BY 4.0 chosen under the official terms:
https://dataforsyningen.dk/asset/PDF/rettigheder_vilkaar/Vilk%C3%A5r%20for%20frie%20geografiske%20data%20og%20CC%20BY%204_0%20licens.pdf

The published terms explicitly cover oblique imagery and elevation data; they
allow commercial/non-commercial reuse and offer CC BY 4.0 except GeoDanmark.
GeoDanmark geometry retains the provider's free-geodata terms, not an assumed
CC BY licence. Photos are cropped and masked, with attribution and processing
recorded. Do not add arbitrary third-party photo sources without checking rights.

## Separate training pages

- `/facade`: existing whole-house HEX review, facade sampling and color-model training.
- `/hus`: original-main-house outlines, separate queues, revisions, skips and export.
  Choose a photo, approve the proposed outline directly, or edit in the full-window
  drawing workspace. Reopen any house to review saved labels. Unmarked pixels stay
  unknown; accepting a proposal never marks a whole photo complete automatically.

House proposals are a geometric baseline (`registered-main-outline-v1`), not a
trained building-part detector. The largest registered main building is projected
using the original camera calibration. Aerial views retain the roof-ring concavity;
oblique views show an approximate convex silhouette. Heights can be approximate,
and occlusions are not detected. Registered outlines can include extensions and
carports and cannot establish a building's historical original form. Courtyard
outlines without safe representation require manual annotation. Check every view
before approval. Corrections and direct accepts retain proposal method/signature
in immutable review history. No parts model is trained by the color-training button.

The two workflows share original photos and task IDs, but house annotations only
write `parts-*.json`. Viewing a proposal writes nothing. Existing color approvals,
sampling and models remain independent. Start at `/` to redirect to `/facade`.

## Ready-to-use local house AI

The house page now includes **Find hus og bygningsdele med AI**. Select a photo,
run the local analysis, then approve or correct the proposed outlines fullscreen.
The frozen models are Grounding DINO Tiny (text-guided object boxes) and SAM 2.1
Hiera Tiny (pixel segmentation). Exact repository revisions and file hashes live
in ignored `data/house-dino/provenance.json` and `data/house-sam2/provenance.json`.
Both model cards declare Apache-2.0. No API key, account or photo upload is used.

Setup, if moving this project to another machine:

```powershell
powershell -ExecutionPolicy Bypass -File side-projects/color-trainer/setup-house-ai.ps1
```

Uses the existing isolated Python CPU runtime, pinned Torchvision/OpenCV and
about 850 MB of pretrained weights. Does not alter application dependencies.
Inference is offline with local safetensors and no remote Python code. The AI
button processes one selected photo at a time; results are cached by original
photo/camera and model revisions. Analysis writes only ignored AI cache entries.
Explicit draft/review saves write the separate parts dataset, retaining source
hashes and proposal provenance. Existing saved regions in other views survive.

The detector searches for house, garage, carport, shed, terrace and patio. Main
house selection uses overlap with calibrated building geometry. If text detection
misses the house, SAM receives a geometry-guided box; this is recorded in source
evidence. Low-quality masks and polygons with significant holes are omitted.
Other-part labels and object identity need review; detection/mask scores are not
measured classification accuracy. No historical original-versus-extension claim.
The new pretrained models run independently of the custom color learner and do
not train on user annotations automatically.

Local verification on 2026-10-21: four distinct existing source photos from two
houses returned main-house polygons, about 5.4–6.7 seconds/image on this CPU,
with no browser errors or review writes. Visual checks show an aerial proposal
excluding the driveway and adjacent covered area after geometry-guided prompting.
Other views can still include vegetation or attached structures: this small smoke
test is not a measured accuracy benchmark. Twenty unit tests and synthetic
390/1280px browser preview/discard/correction/save/reload checks pass. Existing
task, parts and model files were hash-verified unchanged.

## Learning from approved main-house outlines

The house page has its own **Træn husmodellen** action, independent of facade-color
training. It snapshots reviewed annotations, extracts frozen SAM 2.1 features and
fits a small residual segmentation network (36 input channels, 16 hidden channels,
bounded correction of base-mask logits). Grounding DINO and SAM weights remain
frozen; the separate learned head is real gradient-based learning from the user's
masks. It learns main-house versus excluded pixels, not historical construction
dates or a separate supervised classifier for each kind of outbuilding.

Whole visible main-house outlines must be explicitly confirmed. `mainCompletePhotos`
means exterior pixels are not-main-house; `completePhotos` retains its older
all-parts-marked meaning. Partial positives without explicit excluded regions are
not enough for this learner. Other unmarked pixels remain unknown and contribute
neither supervised loss nor scored errors. On 2026-10-21 the user explicitly
confirmed all then-reviewed main-house outlines were complete. Exact task/revision
pairs are pinned in ignored `data/house-learning/outline-confirmation.json`; editing
a revision does not silently inherit that confirmation. Original review files
were preserved. New approvals expose the completeness choice directly.

All task views and repeated instances of the same connected physical main building
share a deterministic train/validation/test split (60/20/20). Duplicate house/photos
are counted once. At least 3 train, 1 validation and 1 test house are required.
Twelve fixed epochs use only training labels for gradients; validation loss selects
the checkpoint. Test masks are evaluated after selection and never select epochs.
Metrics average within a house, then across houses. Full-outline test masks support
IoU, precision and recall; partial masks only score explicitly known pixels.
Metrics concern pixel masks before polygon approximation and abstention filters.
Fewer than five complete test houses is visibly marked preliminary. Repeatedly
tuning against the same test results would compromise their independence; retain
fresh untouched houses for later final evaluation.

The trained head is promoted only if validation IoU improves at least 0.5 percentage
points and validation precision drops no more than 2 points. A rejected candidate
and its test report remain available; the prior active model survives. Runs retain
the exact source snapshots, labels/revisions, split and safetensors weights under
`data/house-learning/runs/`. Atomic latest/active JSON pointers, SHA256 validation,
and versioned inference caches ensure new AI proposals actually use the active
learned weights. Old source-pinned previews remain approvable after a new version.
The training lock prevents concurrent runs; failed jobs do not replace weights.

First real run `709d4435-b80f-4b3b-9548-1039d087663a` used 8 training houses
(40 photos), 3 validation houses (13 photos), and 4 held-out test houses (20 photos).
House-balanced test pixel-mask IoU was 0.6732 before and 0.8527 after; precision
0.8885 → 0.9718; recall 0.7609 → 0.8771. Validation IoU improved 0.7718 → 0.9159,
so the learned head was promoted. These are preliminary results on four test
houses, not guaranteed national or historical-building accuracy. The persistent
weight SHA256 and active version were verified, and four actual browser AI calls
reported that same learned version. Original building-part files were hash-checked
unchanged. Concurrent color reviews in another open flow were detected separately.
Browser tests verify training progress/metrics and editing at 390/1280px; Python
tests exercise actual gradients, saved weights, continuation from active weights,
and ignored unknown pixels. Inference remains local.

## Verification

```powershell
node --test side-projects/color-trainer/test.mjs
```

Tests cover durable save/reload, stale-revision rejection, invalid labels,
unknown exclusion, training/test separation and learned predictions, plus partial
facade analysis, the exact 20-pixel threshold and rejection of empty approvals.
On 2026-10-20 the actual live provider returned one house, five calibrated photos
and eight masked facade surfaces. Chrome smoke test passed HEX edit, draft save
and reload without page errors. The automated draft color was reset afterwards;
no synthetic approval was added to the real training dataset. Automated training
and evaluation tests use synthetic samples. No trained real-data accuracy claim.

The partial-analysis repair was verified on 2026-10-20: the failing draft retained
12 usable surfaces and excluded one sparse surface. Six synthetic tests passed.
An actual-browser check enabled approval and reached the next-house request with
annotation writes intercepted; an empty-analysis fixture kept approval disabled.
The four existing approved task files were hash-verified unchanged. The repaired
draft has no approval labels; only its derived analysis was persisted.
