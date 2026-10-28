# Brick and mortar surface relief

The wall shader now uses a 6 mm illustrative height difference between brick
faces and recessed mortar, with 4 mm rounded shoulders. Surface-gradient bump
mapping lets directional lighting shade those edges. This changes surface
normals only, not surveyed wall geometry, silhouettes, saved meshes, source
pixels or colour-model training. The existing 2x display pattern, brick colours
and neutral mortar colour are retained. Detail fades at a distance to limit
aliasing. Shader cache key: `facade-brickwork-v3-relief-scale-2`.

The existing material hook is retained through photo-projection reset and saved
scene restoration. Existing saved brick walls receive the new shader on opening;
no house-model rebuild is needed solely for this appearance change.

Focused Chrome/WebGL checks pass for unchanged colour and joint widths,
wall/floor classification, rotated walls, photo reset, distance rendering,
reversed directional lighting and absence of shader errors. Screenshot:
`.tmp/brickwork/relief-lit-walls.png`. Staged TypeScript passes. These browser
checks are synthetic; physical-phone appearance has not yet been assessed.

APK 1.0.85 (code 86, package `dk.dithjem.stromblik`) was built and installed on
the verified Samsung SM_A576B via `adb install -r`, retaining data. Installed
version and activity launch `Status: ok` were verified. Artifact:
`dist/Stromblik-1.0.85.apk`, 89,875,199 bytes, SHA256
`f2e0dbe0d452198b593c60863f2bb467e59450728cd3082fa66e68fa6b5bd6e6`.
The isolated existing stage changed only `brickwork.ts` and the generated
renderer; 199 other staged sources, including the 338-house trained model, were
retained. Gradle, eighteen packaged native-source checks, exact tested renderer
and bundle equality, credential exclusion, metadata and APK v2 signature with
the existing debug/test certificate passed. The embedded API remains
`https://dit-hjem-five.vercel.app`. No backend/database deployment, commit or push.
On-phone house rendering was not inspected or navigated during installation.
