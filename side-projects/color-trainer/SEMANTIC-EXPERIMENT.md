# Whole-house facade helper — local experiment, 2026-10-21

The existing supervised color learner remains in place. A second, frozen image
model proposes facade masks from entire saved oblique images. It is optional:
the first comparison did not improve color error. Existing approvals and active
color-model snapshots are not migrated or retrained.

## Workflow and method

**Find facade med AI** runs local CPU inference and displays blue proposals.
Previewing never changes training data. **Brug AI-områder** explicitly saves a
draft; reapprove its color to admit the samples to training. Drawing corrections
and restoring the original automatic evidence remain available. Evidence history
and model/revision/signature provenance persist with the task.

The image model sees each whole cropped house image, including roof/surroundings,
and compares prompts for exterior wall, roof, openings, vegetation and ground.
Scores are heuristic signals, not calibrated probabilities. Calibration and the
footprint/height locate a broad whole-building rectangle including the roof,
limiting neighbour contamination without requiring the narrow wall mask.
Geometry/height errors can still affect this region.

Walls require sigmoid score >=0.35, a 0.2 logit margin over other prompts, a
two-pixel edge margin and >=128 usable pixels. Masks covering >80% of the whole
image abstain. Existing crop checks run again before saving. A missed detection
is not counted as a successful fallback.

The color-training button trains the existing nearest-neighbour learner on
approved samples. It does **not** fine-tune the pretrained image model. Human
polygons are retained for a separate future segmentation adaptation.

## Models and measured results

First checkpoint:
[Marco333/segformer-b0-facade-cmp](https://huggingface.co/Marco333/segformer-b0-facade-cmp),
revision `f95d623ab89d1179d9f59b8d390cc7a2818d255a`, declared MIT.
Its card warns about perspective images. Local inference classified all pixels
in four oblique images as wall, including roofs. It was rejected and is not used.

Current experimental helper:
[CIDAS/clipseg-rd64-refined](https://huggingface.co/CIDAS/clipseg-rd64-refined),
revision `999e0328d9e10b484360c477313983f9afdd7050`, declared Apache-2.0.
Its local provenance file includes downloaded-file hashes. See the
[CLIPSeg documentation](https://huggingface.co/docs/transformers/model_doc/clipseg)
for text-conditioned segmentation. Weights load locally from safetensors without
remote model code or an inference provider.

A reproducible task-ID-hash selection of 30 approved tasks yielded 29 connected
building groups: 20 eligible training groups and 9 held-out groups. Both color
regressors used the same training groups. All 9 test groups had AI features.

| House-balanced RGB MAE, 0–255, lower is better | Result |
| --- | ---: |
| Current saved-sampling features | 49.85 |
| Whole-image CLIPSeg sampling features | 59.67 |

These are preliminary, newly fitted comparison regressors, not the metrics of
the saved active model. Features average channel quartiles per house; prediction
uses distance-weighted nearest neighbours. Tasks sharing any physical building
ID are connected before splitting, and a connected group contributes one
observation. Views/addresses of the same building cannot cross the split.

Only one human-drawn positive region occurred in this selection; AI covered 6.75%
of it. This is positive-region coverage, not precision/IoU: unmarked pixels are
not known negatives. Some inspected masks plausibly selected walls, but the
first smoke-test house produced no accepted pixels. Improved segmentation or
reliable roof rejection has not been established.

`data/semantic-evaluation/latest.json` retains task IDs/revisions, split and
features, keeping the comparison reviewable as the dataset changes.

## Setup, isolation and verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File side-projects/color-trainer/setup-semantic.ps1
node side-projects/color-trainer/setup-semantic-model.mjs --clipseg
node side-projects/color-trainer/evaluate-semantic.mjs --limit=30
```

Setup downloads public packages/model files only. Python 3.12.10, torch 2.8.0 CPU,
transformers 4.57.6, Pillow 12.0.0 and numpy 2.2.6 live under ignored
`data/semantic-runtime`. No system-wide Python or root npm dependencies change.
Inference forces Hugging Face offline mode and disables telemetry. Photos stay
local. One lazily started Python worker serializes requests; caches include model
and method revision, exact source images, camera keys and target regions. Results
go under `data/semantic-cache`. Browser requests cannot supply file paths.
No provider activation, photo upload or production change is involved.

Seventeen unit tests and isolated Chrome checks at 390/1280px cover grouping,
projection, draft-only adoption, exclusion before reapproval, provenance/reload,
restoration and unchanged preview data. Actual local inference and the 30-task
comparison also ran. Browser UI tests use controlled model responses and
temporary annotation stores; physical-phone interactions were not verified.
