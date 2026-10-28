# House-color training audit — 2026-10-21

The local tool records usable supervised examples and persists its nearest-neighbor
model correctly. Its current held-out results do not establish reliable house-color
prediction. No existing task, label or model was modified or retrained in this audit.

## Actual local data checked

- 37 tasks: 35 approved, one skipped, one draft.
- 214 approved facade examples, spanning 26 training buildings and 10 test
  buildings. Task/house counts differ from building counts because a task can
  contain multiple main building IDs.
- All 37 tasks retain embedded original photos and geometry. All saved facade
  features reproduce exactly from the stored JPEG crops.
- No invalid known-color labels, inconsistent review histories, or duplicate
  approved building/face observations were found in this dataset.
- Three model JSON files: two retained snapshots and the current model pointer.
  The current model exactly matches its corresponding archived snapshot.
- SHA-256 comparison of all 40 task/model files before and after the audit found
  zero changes. No abandoned temporary writes were present.
- The running local server returned the same 35 approvals and 214 examples.

## What learning currently means

Approval saves one selected sRGB HEX value against every retained observed facade
crop. The features are nine RGB quartile values from the masked pixels. Training
stores the approved training examples; prediction averages the labels of up to
five nearest feature vectors, weighted by distance. Saving examples is the
training step for this kind of nearest-neighbor model; neural-network weight
updates are not required.

Training is manual through **Træn på godkendelser**. Approving a house saves the
dataset immediately, but does not rebuild the current model. New tasks use the
current saved model; existing tasks keep their original predictions.

The saved model was built at `2026-10-20T22:28:39.923Z`, using 21 training
buildings and 129 facade examples. It has no test-building samples in training.
The current dataset contains 21 training examples missing from that snapshot;
they are saved on disk and will be included at the next training run.

Its saved evaluation uses nine test buildings / 58 facades:

| Mean absolute RGB channel error, 0–255 | Saved result |
| --- | ---: |
| Learned nearest-neighbor model | 69.19 |
| Raw median-pixel baseline | 71.91 |

Lower is better. This is a modest improvement, not evidence of accurate paint
identification. An in-memory retraining check on the current dataset gave 65.00
versus 72.53 on ten test buildings / 64 facades. This candidate was not saved or
activated. The test set has grown, so its score is not a like-for-like comparison
with the older saved result.

## Correctness repair and verification

`Store.rows()` previously resolved duplicate building/face labels by task filename
order. UUID filenames have no chronological meaning, so an older approval could
win. It now selects the most recently approved observation by review timestamp.
The current real dataset has no such duplicates, so this repair does not change
its rows or labels. A running server needs a restart to load the code repair.

Eight tests pass, including a new regression where the newer approval has the
earlier filename, and a model/archive disk round-trip test that verifies identical
predictions and exclusion of both facades of the held-out building.

```powershell
node --test --test-isolation=none side-projects/color-trainer/test.mjs
```

## Limits and next improvements

- Whole-house labels assume the observed walls share one intended color. Mixed
  brick/plaster or different wall colors should be skipped under this workflow.
- Nine RGB statistics cannot describe wall texture, distinguish windows or
  vegetation, or uniquely resolve color under different lighting. Similar
  features can have very different approved labels. A larger, more diverse
  reviewed dataset and richer image features are needed before claiming accuracy.
- Geometric masks handle modeled occlusion; real vegetation and openings may
  still contaminate crops. Human review remains necessary.
- The stable building split prevents same-building train/test leakage. It does
  not ensure geographical independence or an unbiased national sample.
- Current metrics average facades, giving buildings with more facades more
  influence. Add building-balanced and perceptual color metrics before selecting
  a production method. Keep a separate final holdout if repeatedly tuning against
  these displayed test scores, and choose reference colors independently of model
  suggestions to reduce reviewer anchoring.
- Persistence uses serialized revisions and atomic temporary-file replacement.
  This verifies normal save/restart behavior, not power-loss durability or a
  tested backup restore. `data/` is local and Git-ignored; it needs a separate
  backup. Dataset export alone omits the full original task configuration.

Method references: [nearest-neighbor regression](https://scikit-learn.org/stable/modules/neighbors.html)
and [grouped evaluation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data).
