# Roof-intelligence pilot

## Current chimney-only collection

The UI now shows only chimney candidates, with 1px colored outlines. Reviews
are scoped to house, source view and object; existing unique legacy reviews are
retained. Only manual chimney confirmations enter the training set. No chimney
detector has been trained yet; the old crop classifier cannot train a detector.

To add one bounded batch of cached oblique photos, without requiring EDC or
solar/skylight labels:

```powershell
node side-projects/roof-intelligence/expand.mjs
& side-projects/color-trainer/data/semantic-runtime/python.exe -u side-projects/roof-intelligence/worker.py --incremental
```

Each batch adds up to 15 train and 5 test buildings, two distinct calibrated
visible oblique photos each. Existing building splits, observations and reviews
are preserved. No remote provider calls. Test buildings must remain excluded
from fitting and threshold tuning. Missing detections are unknown, not negatives;
rejected candidate boxes are not fully annotated empty images. These annotations
are not yet a complete detector dataset. The historical pilot notes below describe
the earlier multi-category experiment, not the current collection policy.

Local side project for solar panels, skylights and chimney candidates. It reuses
existing EDC/calibrated oblique photos and the existing offline Grounding DINO
and CLIPSeg model files/runtime. No provider calls, downloads, production changes
or colour-review edits are performed. The main app is unchanged.

Run from the repository root:

The complete bounded analysis/training attempt can be started with
`node side-projects/roof-intelligence/run.mjs`. It uses the same offline runtime.
Individual steps are also available:

```powershell
node side-projects/roof-intelligence/prepare.mjs
& side-projects/color-trainer/data/semantic-runtime/python.exe -u side-projects/roof-intelligence/worker.py
node side-projects/roof-intelligence/dataset.mjs
& side-projects/color-trainer/data/semantic-runtime/python.exe -u side-projects/roof-intelligence/worker.py --train
node side-projects/roof-intelligence/server.mjs
```

Open http://127.0.0.1:8793 or the Tagpilot link in the existing colour trainer.
Data, crops, reviews and candidate weights remain in ignored `data/`; preserve it.

## Evidence and automatic training

- Preparation respects explicit house exclusions/skips. It requires existing
  high-confidence present labels, matched main-building identity and at least
  two calibrated aerial images with a positive main-house visibility check.
  Colour acceptance is a separate decision, not material/object ground truth.
- Detection is pretrained Grounding DINO. Boxes must be at least 8 source pixels
  wide/high. Aerial detections must fall predominantly within projected main-house
  bounds. These are coarse building bounds, not validated roof-plane occlusion
  tests or triangulated 3D object positions. Neighbour confusion remains possible.
- Automatic examples need agreement with an existing roof-object teacher label
  plus a confident EDC detection and detections in two distinct aerial source
  photos. Duplicating a photo under two IDs does not establish agreement.
- Never turn missing detections into absent labels. The pilot cannot prove a
  roof is empty, usable for installation, structurally sound or currently unchanged.
- Chimneys are candidates for manual review; there is no existing chimney teacher
  target, so they cannot silently become automatic training examples.
- Manual object review can confirm/correct a class, or mark unknown/not-an-object.
  Decisions override pseudo-labels. Full source photos are available for context.

The optional specialized model is a learned linear crop-classification head over
frozen CLIP features, trained only on aerial examples. The pretrained detector
still proposes boxes; this is not a newly trained full-image object detector.
The existing physical-building split is retained, and class/building weighting
limits domination by many crops of one house. At least two classes with three
distinct training buildings each are required; otherwise training stops explicitly.
Pseudo-label test agreement and manually reviewed test results are reported
separately. Neither establishes business-grade accuracy from this small pilot.
There is no automatic promotion or APK export.

`candidate-model.json` contains only classifier weights, class names and summary
metadata. It remains a local candidate. No independent accuracy is claimed.
LiDAR is used indirectly through the existing geometry/height projection; new
LiDAR roof-plane reconstruction, shade analysis and PV layout are not implemented.

## Verification

`node --test side-projects/roof-intelligence/test.mjs` checks cross-view gating,
duplicate-image rejection, manual overrides, unsupported classes and unknown
handling. The pilot is intentionally limited to twelve houses. It does not
relabel or retrain the existing facade-colour model.

## First real pilot, 22 October 2026

Twelve eligible existing houses (five with solar-panel teacher targets) supplied
49 EDC/aerial images. The local detector produced 72 candidate boxes with no
per-view processing errors. None met the full automatic cross-view/score gates,
so the real training attempt correctly returned `insufficient-data`; no real
specialized candidate was trained or activated. These are candidate boxes, not
72 verified objects. Detection and class scores are not calibrated probabilities.

The review page runs on loopback port 8793 with full-source links. Mobile Chrome
smoke passed with review POSTs intercepted; no user reviews were fabricated.
Foreign origins return 403. Three evidence-policy tests pass. A separate synthetic
training check verifies that a learned head can be fitted and that changing
held-out labels does not change weights; it is not real-pilot accuracy evidence.

The immediate next step is a small independently reviewed control set and review
of the low-confidence/mismatched candidates. Do not reduce gates just to obtain
a trained artifact. A roof review neither accepts nor changes a facade colour.
No APK, production/backend/database deployment, model activation or Git push.
