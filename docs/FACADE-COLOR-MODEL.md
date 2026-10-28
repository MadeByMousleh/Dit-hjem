# Facade colour model in the 3D renderer

The app snapshot now comes from the latest **completed** automatic/reviewed
trainer model, `side-projects/auto-color/data/review-model.json`, replacing the
earlier manual-only export. Ongoing Gemini requests do not change an already
bundled app. Refresh both the portable weights and generated renderer with:

```
node scripts/update-app-facade-model.mjs
```

An explicit model JSON path can be supplied to freeze a selected snapshot.
The exporter retains only feature vectors, HEX labels, aggregate evaluation
and model provenance. Photos, addresses, building IDs and credentials are not
included. The existing distance threshold calibration and prediction method
are retained.

`learnedFacadeColors` applies the same selected model independently to the main
house and neighbours from their own calibrated photo pixels. Multi-view/mask
checks and the existing photographic fallback remain. Manual facade edits and
roof materials are handled by their existing paths.

The 22 October 2026 snapshot has version `2026-10-22T07:19:45.504Z`, 285 training
buildings and 1,057 samples. The previous bundled snapshot had 126 training
buildings. Its input was frozen under `.tmp/facade-model-switch/`; verification
found no currently excluded review contributing samples to this snapshot.

Validation passed: trainer/browser pixel-feature parity, 50 predictions compared
against the selected trainer model, synthetic independent main/neighbor colours,
out-of-domain abstention, real-photo browser rendering with the new version,
saved colour/provenance restoration and TypeScript. Two missing declarations
for existing sampling/roof-material modules were added without runtime changes.

This increment changes local app code/generated assets only. No APK, installation,
deployment, database changes or push were performed. The phone needs a newly
built/installed APK. Existing saved scenes retain their recorded colours until
the user chooses **Opdater husmodel**; ordinary reopening does not silently
rebuild or overwrite them.
