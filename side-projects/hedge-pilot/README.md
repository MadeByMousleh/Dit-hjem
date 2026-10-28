# Hedge pilot

## One-click random EDC houses

The user explicitly authorized automatic future property selection, LiDAR/photo
retrieval and local model inference from the existing EDC collection. The local
`Vælg tilfældigt EDC-hus` button starts `/api/random-house` and polls progress.
It samples randomly from cached EDC listings with available geometry, respects
explicit excluded/skipped houses, deduplicates physical buildings, and excludes
already loaded and trained houses. It does not use the random-street pool.

The background job performs bounded Datafordeler tile retrieval (<=600 MiB),
network-disabled local Docker parcel cropping, KDS parcel-photo retrieval and
frozen-model inference. It dynamically registers completed houses without a server
restart. There are no paid AI calls, external image uploads, automatic labels or
automatic training. New proposals remain unapproved until the user's brush save.

Only one job runs at a time; duplicate starts return its status. Training is
blocked while a test house is being prepared so its model stays frozen. Status
persists in ignored `data/random-job.json`; failures show a retryable message.
Unsupported large/cross-tile parcels or unavailable providers can fail safely.
Open brush drafts must be saved or cleared before starting/navigation. Progress
is shown during download/crop/photos/inference and the finished house opens
automatically when no unsaved draft would be lost.

## Completed-garden labels

The user explicitly changed the policy: after finishing a garden, all vegetation
points outside their saved positive brush mask are non-hedge. `Afslut haven`
records this declaration via `/api/complete-garden`; it never approves AI points.
Ground/building returns are excluded. Before completion, unpainted points remain
unknown. An unsaved brush draft must be saved or cleared before finishing.

Completion stores an explicit `garden-completion` negative record, preserving
positive point indices exactly and saving the previous records in ignored
`data/point-history/`. Subsequent saves in a completed garden recompute its
complement so the completed mask stays exhaustive while positive approvals remain
manual. This applies per garden, not to unfinished gardens automatically.

Lærkevej 23 was completed at the user's request: 833 hedge and 543 non-hedge
points. Before fitting on it, the frozen previous model and a separate assessment
were saved under ignored `data/evaluations/`: 720 predicted points overlapped
positive labels, 167 were false positives, and 113 positive points were missed.
These are correlated point counts for one garden, not general model accuracy.
The latest fit includes five gardens and only user-approved/declared point labels.

## Second unseen garden: cached data only

Lærkevej 23, Nybøl (0a3f50b7-8291-32b8-e044-0003ba298018) was added using the
already downloaded tile and the color trainer's existing random-task imagery.
No external data requests were made. Local network-disabled crop: 13,202 points.
The cached 755×577 calibrated nadir photo covers all parcel ground vertices and
is shown first. Other cached photos are explicitly labeled as house crops that
do not cover the whole garden. `includeNadir:true` opts this dataset into the
vertical view without changing the prior gardens' photo indexing.

The frozen classifier produced 887 proposals among 1,346 supported vegetation
returns. The model and annotation file bytes were unchanged; the property is not
in the model's training house list. Approved hedge count remains zero until the
user explicitly saves positive brush points. Predictions are not accuracy proof.

## Current two-class point model

The user added explicit non-hedge brush points and requested retraining plus an
unseen house. With >=8 usable points in each class, `train.mjs` now fits a
regularized logistic point classifier (`brush-point-logistic-v1`) on both labels.
Weights balance class and garden so a large brush selection cannot dominate.
All features come from measured LiDAR neighborhoods; unmarked points are unknown.
The proposal threshold is fixed at 0.7; scores are uncalibrated and no independent
accuracy is claimed. Positive-only similarity remains a fallback when there are
no usable explicit negative examples.

Current fit: 3,596 positive and 6,248 negative supported points from three gardens.
Seven labeled points lacked feature support. The label file hash was unchanged
by fitting. Training garden IDs are recorded in the artifact, and proposals
record whether a garden was used for fitting. No labels from an unseen garden
enter training automatically.

Lærkevej 9, Nybøl (cached random task cf3cfa15-d431-45e3-a9a1-e4128bfaca35) is
now enabled after explicit user approval of Datafordeler/KDS retrieval. Its own
403,231,851-byte tile was downloaded and cropped locally to 17,610 parcel points;
two parcel-wide photos were retrieved (south/east; north/west unavailable).
No external address lookup was used. `predict-house.mjs
--house=0a3f50b7-8284-32b8-e044-0003ba298018` applies the frozen existing model
without fitting on this garden. It produced 223 suggestions among 6,905 eligible
vegetation returns. Model and label file bytes remained unchanged. No accuracy
is claimed until the user reviews the new garden. The UI labels it as unseen.
The script rejects houses used in fitting or houses with saved brush labels.

## Current learned point proposals

The user requested training from the final brush points and new visible proposals.
The three gardens currently contain only positive brush labels. `train.mjs` now
fits a positive-only local similarity model (`brush-point-similarity-v1`), not
the earlier logistic region classifier. It computes measured neighborhood height,
vertical span, horizontal linearity, density and vegetation-class mix per point.
Per-garden medians and robust scales are learned ONLY from resolved positive brush
points. Unpainted local context supplies measurements, never class labels.
Similarity threshold 0.65 is fixed and uncalibrated. There is no independent
evaluation or nationwide accuracy claim, and no automatic application release.

First point-model fit: 3,708 ground-supported positive points from three gardens;
four painted points lacked feature support. Orange proposals are stored separately
in ignored `data/proposals.json`, bound to property/source and training snapshot.
The API excludes all currently painted positive AND negative points from the
proposals. Saving brush labels never copies model proposals into ground truth.
The local viewer shows proposals in orange, saved positives in bright green and
the open brush draft in yellow. A separate toggle hides learned proposals.
Retraining refreshes the local proposals immediately. Prior model artifacts are
archived on method changes; original labels are untouched.

## Current annotation rule: brush only

Only explicitly saved brush points define hedge / non-hedge labels. Unmarked
points are unknown. The latest explicit brush save wins where selections overlap.
Persisted hedge points appear bright green on reopening; the open draft is yellow.
Original candidate boxes remain visual suggestions only. Dimension editors and
box-approval controls have been removed, and the legacy `/api/review` returns 410.
Old box reviews are preserved on disk but never enter training on any garden.
The earlier box-trained model is archived when refreshing the training summary.
All new summaries/artifacts identify the policy as `brush-only-v1`.

## Point brush and first learned candidate

Use `Se ovenfra`, then `Mal punkter`, drag over vegetation, and explicitly save
as hedge or non-hedge. Brush radius, erase, undo, clear/new and reopening a saved
selection are supported. Navigation is suspended only while in painting mode.
Screen projection and a coarse front-depth filter reduce painting through other
objects; this is not exact surface visibility. Rotate in navigation mode to add
other sides. Only measured vegetation returns may be labeled; unselected points
remain unknown, never automatic negative labels. Minimum selection is 8 points.

Point indices persist in ignored `data/point-selections.json`, scoped to the exact
house/source hash and stable selection UUID. Raw points and prior reviews remain
unchanged. First browser check selected 332 points; save/restore was intercepted
so no synthetic labels were persisted.

`node side-projects/hedge-pilot/train.mjs` or the training button fits a small
regularized logistic classifier over measured vegetation-region features. It is
not a point segmenter or a full-garden hedge detector. Only resolved point-brush
labels are used, without any fallback to reviewed boxes. Ground-unsupported
regions are excluded. Features come from point geometry, not the human class.

One garden is held out using a fixed hash of its address ID, independent of labels.
Feature normalization and fitting use only the other gardens. The threshold is
fixed at 0.5; there is no holdout tuning. Artifact and summary are ignored
`data/candidate-model.json` and `data/training.json`. There is no automatic
activation, app change or external AI call. First run: 14 training examples
(11 hedge, 3 non-hedge) from two gardens; two held-out examples from a third
garden were classified correctly. This two-example result cannot establish
general accuracy. Existing manual geometry remains the source of annotations.

Start from the repository root: `node side-projects/hedge-pilot/server.mjs`.
Open http://127.0.0.1:8794. Local only; no app, database or deployment changes.

## Additional houses

The house selector is served by `/api/houses`. A house is enabled only after
matching `geometry.json`, `parcel-points.json`, `photos.json` and `meta.json`
exist under ignored `data/houses/<addressId>/`. Photo URLs and review requests
carry the selected house ID; reviews additionally validate the source/method hash.
Existing first-garden reviews retain their previous hash and remain intact.

Two previous randomly selected public examples have local geometry staged:
Skovvej 28 and Skovvej 3, 6400 Sønderborg. The user explicitly approved LiDAR
and photo retrieval for both properties after automatic approval review initially
blocked the requests. Their shared 531,710,480-byte tile is cached once; local
network-disabled cropping produced 30,979 and 25,046 parcel returns respectively.
Three and four parcel-wide photographs were retrieved respectively. Existing
first-garden data and reviews remain unchanged.
No external address search is needed; geometry is already cached.

After approval: run `prepare-houses.mjs`, crop each downloaded tile with the
existing local `dit-hjem-lidar-crop:1` Docker image, network disabled and that
house folder mounted at `/data`, then run `fetch-photos.mjs --house=<addressId>`.
Restart the pilot to enable completed houses. Never use another property's point
cloud or photos as fallback for an incomplete house.

Reuses the address/parcel-bound `.tmp/lidar-parcel/parcel-points.json` and
geometry. The first trial contains 21,757 measured ground/vegetation/building
points. Three-dimensional colors describe LAS classes, not AI classifications.

`detect.mjs` searches vegetation within 1.6 m of parcel ring edges, with measured
ground within 2 m, relative heights 0.5–4 m, at least two returns per occupied
half-metre interval, length >=3 m and occupancy >=65%. Gaps >1 m split runs.
These assumptions generate candidates, not proof of hedges. Trees, shrubs and
neighbor vegetation can be included; curved/interior hedges can be missed.
Length is the straight supported interval; height is the 90th percentile of
included returns, width the 10–90 percentile lateral span. Truncated tall
vegetation and slope can bias these estimates. No commercial accuracy claim.

The display keeps measured points and tentative outlines separate. Thin matching
photo projections use calibrated camera coordinates but do not solve occlusion.
All candidates start unknown. Reviews require an explicit action, bind to a
hash of the point source and method version, and persist in ignored `data/`.
The initial geometry-only pilot did not train a model. The optional local
classification experiment is now described above; it never activates itself.

`node side-projects/hedge-pilot/fetch-photos.mjs` downloads native-resolution
parcel-wide oblique crops through the existing local KDS credentials. Credentials
remain server-side. Four views are cached in ignored data; no image is uploaded
to an AI provider. Restart the server after replacing photo data or viewer code.
Imagery: Skråfoto © KDS / Dataforsyningen, CC BY 4.0. Photo dates and LiDAR dates
may differ; confirm present-day conditions separately.
