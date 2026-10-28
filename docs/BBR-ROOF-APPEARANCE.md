# BBR roof surfaces

Approved, deployed and installed on 2026-10-21.

The geometry service looks up BYG.033 separately for every building's BBR UUID,
including neighbors. The read-only BBR v3 schema confirms
`byg033Tagdaekningsmateriale` and `byg035SupplerendeTagdaekningsMateriale`.
Material families follow the official
[BBR roof-material code list](https://teknik.bbr.dk/kodelister/0/1/0/Tagdaekningsmateriale).
Up to 50 IDs are requested together, at most three batches concurrently. Only
one active record (status 6) for the exact ID is accepted. Inactive, ambiguous,
unregistered or failed lookups remain unknown; a neighbor never inherits the
main house's material. A partial BBR failure retains geometry and a warning.

`roofMaterialVersion: 1` and optional per-building `roofMaterial` enrich the
existing geometry response. Existing geometry, heights and roof silhouettes
are unchanged. BBR's predominant material selects an illustrative surface:
tile rows with shading relief for clay/concrete, panel/seam patterns for
fiber-cement/metal/plastic/glass, lapped felt seams, and thatch strands/bands.
Existing photographed/aerial roof color and imagery are retained. BBR does
not supply an exact profile, measured tile layout, color, or a map of which
plane uses supplementary material. No extra tile meshes are added, and no
claim of changed structural roof geometry is made.

Fresh roof meshes retain their building ID and material metadata in prepared
models. Old saved roofs are matched conservatively to unique footprint bounds
before rendering, including roofs outside aerial image bounds. Tagged roof
meshes remain separate so a later BBR lookup can update the correct building.
Saved models without metadata perform a lightweight geometry/BBR read and
update appearance without photo analysis, geometry rebuild or automatic save.
Normal subsequent model saves include the metadata. No database migration,
auth/config change, external AI provider, or new package is needed.

Validation:

- `scripts/test-bbr-roof-materials.mjs`: per-ID mapping, 50-ID batches, active
  records, failure/unknown behavior and code/supplementary mapping.
- Existing residential property: 105 BBR IDs, 91 registered roof materials;
  88 supported specific material families on 132 geometry roof meshes, seven
  distinct families. Geometry has five known home/associated roofs, no warnings.
- `scripts/test-roof-appearance-browser.mjs`: six surface families render with
  no shader errors; original color and geometry are preserved.
- `scripts/test-bbr-roofs-browser.mjs`: all 132 fresh and old anonymous roofs
  match the same individual building; 88 receive the correct family. Existing
  learned facade result remains 12 buildings (11 neighbors). Saved colors and
  evidence survive, and reopening does not analyze or save again. Height grids
  are decimated for Chrome software rendering; native appearance is unverified.
- Prepared-model app browser tests at 390/1280 px and compression/backend tests
  pass. Root and isolated-stage app TypeScript pass.

Release evidence is under `.tmp/roof-materials-release/` from live baseline
`dpl_H8sfyDWBUYU9TzEWfwrRii53m6Pu`. Exactly three backend files change:
`home-geometry-server.mjs`, `bbr-roof-materials-server.mjs` and
`roof-materials.mjs`. Existing BBR/address dependencies match live source hashes;
all other backend, frontend and dependency sources are preserved. After explicit
approval, deployed `dpl_9hgVGTM5WFb1fcA4udV8Z6dnXYVE` is READY in fra1;
rollback is `dpl_H8sfyDWBUYU9TzEWfwrRii53m6Pu`. All 359 deployed source hashes
match the approved manifest. Both `huslyg.dk` and `dit-hjem-five.vercel.app`
select that deployment and return roofMaterialVersion 1, five home/associated
buildings and 132 neighborhood buildings, 91 BBR roof records and 88 specific
surface families. Each material matches the verified per-building reference.
Geometry (apart from new material metadata), valid heights, neighbor image
planning/four calibrated neighbor photos and production Auth configuration pass.

Prepared APK: `dist/Stromblik-1.0.82.apk`, package `dk.dithjem.stromblik`, code
83, 89,749,715 bytes, SHA256
`e209c91ced4edf42aff6c0d6020f8dd5a736cf21225d1f5281b26523685054b7`.
Gradle, metadata, same APK v2 debug/test certificate, eighteen packaged native
sources, exact built/packaged bundle and renderer, production API target
`https://dit-hjem-five.vercel.app` and exclusion of 22 private local environment
values pass. Nine staged sources match the change; 192 unrelated source hashes
are unchanged. Wi-Fi `install -r` succeeded on the verified Samsung SM_A576B,
serial R5GL33DH30M, retaining app data. Installed versionName 1.0.82/versionCode
83, activity launch Status ok, and foreground app were confirmed. Physical roof
appearance remains unverified; no model rebuild, profile or auth actions were
triggered. No database/auth/config changes, Git commit or push.
