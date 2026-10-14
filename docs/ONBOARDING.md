# Account onboarding

Local implementation, 2026-10-13. Not deployed or included in a new APK yet.

## Flow

Three full-screen visual introductions explain electricity, warmth and the home
overview without forms or provider prompts. Then five setup pages collect
first/last name, precise address, Eloverblik, eForsyning, and a summary.
Skipping the introduction starts profile setup; electricity and heating can be
skipped individually using the top-right action. There is no bottom skip button.
Names and a
resolved address are required. Preview remains enabled for testing, but respects
the final “Vis ikke opsætningen igen” choice.

Address search distinguishes entrance/house-number suggestions from precise KDS
addresses. Apartment suggestions require unit selection. Coordinates, address ID,
municipality, postcode and grid selection are saved with the profile. Onboarding
saves account metadata and a user-scoped local cache; another device can restore
the metadata when its cache is empty. Existing profile preferences are retained.
These user-editable fields are not proof of identity or authorization.

Grid lookup failure is explained and can be retried; unsupported waste providers
and missing grid tariffs are not presented as working integrations. Heating
currently supports Sønderborg Varme, not every eForsyning supplier.

## Electricity safety

Both onboarding and the electricity connection card use `usePowerSetup`.
Existing user/household bindings are checked against active provider grants and
reused by verified household members. Approved, unexpired, user-scoped attempts
are recovered by status checks after returning from the provider. Browser focus,
native foreground and the Eloverblik app deep link trigger verification. A return
arriving during an in-flight request is queued; pending approval is retried briefly.
The HTTPS return page and matching backend/client changes remain local and need
deployment plus an updated APK; see [connection details](ELOVERBLIK-THIRD-PARTY.md).

An old general-link grant without a verified account binding cannot safely be
assigned by matching a name or address. The UI explains how to remove only this
company's old grant at Eloverblik and recreate it through the account-specific
app link. No grants are deleted automatically. Ambiguous matches fail closed.

## Visuals

Inspired by the pastel full-page composition of
[Travel App Onboarding Screens](https://dribbble.com/shots/15562753-Travel-App-Onboarding-Screens).
The user subsequently supplied the local MP4 reference. Nine frames across its
6.741 seconds were inspected: three pastel screens with large 3D objects and
subtle floating/tilting motion. Our colors use the app's blue, violet and neutral
palette. Original house artwork, Hugeicons, a subtly
floating/tilting hero and staggered illustration/text entry transitions are used.
Copy is limited to a short heading and one sentence per page, with detailed
authorization help collapsed. Illustrations have transparent backgrounds and sit
directly on each tinted surface without white halos or floating icon tiles.
The bottom-right white arrow button has two curved inset border details inspired
by the reference. Electricity, heating and address pages each use a
different illustration; see [asset prompts](ONBOARDING-ILLUSTRATIONS.md).
Reduced-motion preferences disable decorative movement. Reference contact sheet:
`.tmp/onboarding-review/reference-video-frames.png`.

Asset: `src/assets/onboarding-home.png`. Generated with built-in imagegen, not
copied from the reference. Final generation prompt:

> Use case: stylized-concept. Create one original premium 3D clay illustration for a Danish home-energy app onboarding hero. A charming miniature Scandinavian house, rounded pale ivory walls, periwinkle blue pitched roof, warm golden windows, small terracotta chimney, on a tiny soft sage green garden island. A rounded blue electricity bolt and a small warm coral radiator sit beside the house as playful physical objects. Isometric front three-quarter view, whole scene visible with generous padding, centered composition, polished matte toy materials, soft studio lighting, friendly sophisticated travel-app-onboarding aesthetic. No text, no letters, no branding, no UI, no frame. Genuinely transparent background, retain alpha. Square image.

## Verification

- TypeScript-only check and Expo web export passed.
- Address and Eloverblik reconnect contract tests passed using synthetic data.
- Browser test exercises actual onboarding components with synthetic providers:
  required names, precise address/grid persistence, provider return, heat setup,
  completion and opt-out, plus 320px mobile, landscape and desktop viewports.
- Motion-enabled checks confirm the hero transform changes over time and the
  next form remains accessible after animated entry; reduced-motion flow passes.
- Screenshots are under `.tmp/onboarding-review/`.
- Real MitID/eForsyning accounts, physical Android interaction and live database
  behavior remain unverified. No migration, release or configuration change was
  performed for this increment.
