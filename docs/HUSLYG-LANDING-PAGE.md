# Huslyg public landing page

28 October 2026. Explicitly approved, published and live-verified on huslyg.dk
and dit-hjem-five.vercel.app. The owner confirmed the apps have not yet been
uploaded to the stores; both badges therefore remain **Kommer snart**.

## Visitor experience

The public website introduces Huslyg and directs visitors to Google Play or
the App Store. There is no account form, dashboard, consumption fetch or
personal application session on the page. The design takes its broad direction
from the reviewed Drivigo.dk reference: a spacious colored hero, an original
illustration, a phone presentation, concrete feature sections, getting-started
steps, FAQs and a final download section. The illustration and phone layout are
new Huslyg assets, not copied Drivigo artwork or screenshots.

Huslyg branding uses the existing blue house mark and locally hosted DM Sans
fonts, with the font license included. The phone is marked as an example with
illustrative values. Claims exclude paused car/smart-home controls, live meter
data, surveyed measurements and guaranteed savings. Existing contact,
publisher, account-deletion and open-source pages are linked. No analytics,
cookies, remote fonts or third-party scripts were added.

## Roof and car correction, published 28 October

Current deployment: `dpl_6ww4Jnq2khD25BQMFYZaVXyM5CjL`, READY in fra1.
Rollback: `dpl_GHxyiqqDGY5HbkARJWfAgZnmbem5`. Only `house.svg` changed; all
393 production source hashes match. The roof now has two coherent gable-roof
planes, a shared ridge, clipped tile grids and a clean front gable. The solar
array follows the visible roof plane and chimney flashing seats on that plane.
The car is redrawn in one axonometric coordinate system with aligned body,
roof/glass/hood, wheel arches and wheels, plus a front charging connection.

Local and live Chrome checks pass for the retained energy/motion behavior,
desktop/390/320px layouts, pause and reduced motion; screenshots were visually
inspected. Both domains, unchanged API guards/production Auth, existing public
pages/downloads and five active crons remain verified. Release evidence:
`.tmp/huslyg-roof-car-release/`; current local/live screenshots:
`.tmp/huslyg-motion/`. No native/DB/config/commit/push change.

## Energy illustration, published 28 October

Previous deployment: `dpl_GHxyiqqDGY5HbkARJWfAgZnmbem5`, READY in fra1.
Rollback: `dpl_9HDgQtWoQA9DZLrR8zgAhETWigNs`. Only `house.svg` and `site.css`
changed; all 393 deployed source hashes match. Existing backend, configuration,
Auth guards, public pages/downloads and five active crons remain verified.

The illustrative scene adds two rotating wind turbines, six rooftop solar
panels, an electric car attached to a wall charger, incoming overhead electrical
wires from outside the left edge and paired district-heating pipes from outside
the right edge into the foundation. Supply and return flow in opposite
directions; panel reflection and a charger light animate gently. Wind/cloud/tree
motion remains. These are illustrations, not claims of live generation, real
energy flows, EV integration or remote charger control in the app.

The shared pause, offscreen/hidden-page handling and reduced-motion behavior
also cover the new animations. Energy motion uses CSS SVG dash offsets and
transforms/opacity; no frame-driven JavaScript was introduced. The diagram adds
space below the ground so the incoming heating pipes remain visible.

Local 1440/768/390/320px landing checks and the expanded local/live motion test
pass. The test verifies actual turbine rotation and flow changes, reverse
return direction, all requested diagram elements, pause/offscreen behavior and
reduced motion. Live Chrome reports no errors or failed/external requests.
Evidence: `.tmp/huslyg-energy-release/` and current `.tmp/huslyg-motion/` images
and reports. No physical-device test, native release, DB/config change or
commit/push was performed.

## House and scroll motion, published 28 October

Previous deployment: `dpl_9HDgQtWoQA9DZLrR8zgAhETWigNs`, READY in fra1.
Rollback: `dpl_9XA2ttHRmWu158XhvpAjBEjsno6L`. Exactly five frontend files
changed: landing HTML, SVG, CSS, JavaScript and static build script. All 393
deployed source hashes match; API/service/configuration/download/cron source
remains unchanged. Both production domains and their existing Auth guards,
public pages, legacy download and five active crons pass verification.

The house scene now has a smiling/blinking sun, slow clouds, subtly swaying
trees anchored at their trunks, wind strokes and drifting leaves. The original
house SVG is inlined by the build so individual groups can animate and pause.
Cards float gently; headings, feature rows, steps, FAQ items and footer content
enter once through IntersectionObserver. Phone preview bars grow into place;
hover motion is limited to devices that support hover.

There are no scroll listeners, animation-frame JavaScript loops or animation
libraries. CSS transforms/opacity drive motion. The scene pauses out of view
or on document visibility changes. A visible pause/resume control stops motion
and reveals all pending content; reduced-motion preference disables movement.
Without JavaScript, the content remains visible and the scene stays static.

`test-public-site-motion-browser.mjs` passes locally and with `--live` on
huslyg.dk: actual tree/sun movement, pause/resume, offscreen pause, simulated
hidden-tab notification, real scroll reveals, 390/320px widths, reduced motion
and JavaScript-disabled fallback. The existing four-width landing browser test
also passes. No external requests, page errors or failed resources were found.
Screenshots/reports: `.tmp/huslyg-motion/`; release manifest and source/API
verification: `.tmp/huslyg-motion-release/`. Physical phone testing was not run.

## Store links

The owner selected **Google Play / App Store**, replacing the initial direct
APK design. `public/landing/downloads.json` currently contains two null fields.
The built page therefore shows honest, non-clickable **Kommer snart** states,
not generic storefront homepages or invented app IDs.

Fill `googlePlay` and `appStore` with the owner's actual app-page URLs, then
build again. `scripts/lib/public-site-downloads.mjs` validates HTTPS and the
specific store app paths and renders real links at build time. Availability is
independent per platform. A public search did not establish a matching Huslyg
listing; this does not prove the owner has no unlisted/test/store publication.

The historic Android APK is still preserved as a legacy download because the
already-public family page links to it. It is not advertised on the new landing
page and has not been upgraded by this task.

## Web entry and native app

- `vercel.json` builds `scripts/build-public-site.mjs` to
  `web-build/huslyg-public`, instead of exporting the Expo application.
- The output root is static landing HTML. No `_expo` application bundle is
  generated or copied. `/login`, `/dashboard`, `/profile`, `/app` and
  `/onboarding` redirect to the homepage. Unknown paths cannot mount the app.
- `App.web.tsx` directs local Expo web entry to the public `landing.html` page
  without importing `AppScreen`. Native `App.tsx` retains its original entry.
- Public assets and contact/deletion/family/native callback/Tesla-key files are
  copied. API source, callback rewrites, all five cron definitions and function
  settings are unchanged. A landing page does not disable native API access.

The build preserves the exact existing public APK 1.0.119/code 120:
86,167,075 bytes, SHA256
`c3e7008933e81456c4b8854c7d073c61879e728dfa6060225bb8764a33185f8a`.
It uses the local matching artifact or the public file if the artifact is absent;
a hash mismatch stops the build. Live HEAD requests to both public domains
returned 200 with the expected size during preparation. There is no implicit
publication of newer local test APKs.

## Build, preview and checks

```powershell
node scripts/build-public-site.mjs
node scripts/preview-public-site.mjs
```

Local preview: `http://127.0.0.1:8796`.

Passed:

- `npm run typecheck`
- `node scripts/test-public-site-downloads.mjs`
- `node scripts/test-public-site-browser.mjs`

The browser test covers 1440/768/390/320px widths, overflow, local font/assets,
mobile menu open/close/Escape, FAQ interaction, section anchors, store pending
states, absence of direct APK links and account forms, legacy entry redirects,
retained public files and no outgoing third-party requests or page errors.
Build verification checks the APK hash. The store-button test covers active
links with synthetic URLs, escaping and rejection of unsafe/generic URLs.
It does not claim the actual store URLs have been supplied or verified.

Screenshots and the test report are in `.tmp/huslyg-landing/`.

## Production publication

Deployment `dpl_9XA2ttHRmWu158XhvpAjBEjsno6L` is READY in fra1. Baseline/rollback:
`dpl_GQFK1ypCPyiNodwMijW1NrmCLQZb`. The isolated publication retains all 380
baseline source files, changes only the existing Vercel web-build/redirect
configuration and adds 13 landing/build assets. All 393 deployed source hashes
match the release manifest. Existing API/service files remain byte-identical.

Both domains return the landing page and redirect the five legacy app paths
to `/`. Assets, public contact/deletion/family/native callback/Tesla-key files
and the unchanged legacy APK return 200. Production Auth points to
`arkpfdsglgufnnukader`; missing/invalid bearer tokens retain 401/no-store on the
protected account route. Public supplier lookup and all five active cron
definitions are verified. No DNS, store publication, native build, database,
Auth configuration, commit or push change was made.

Live Chrome checks at desktop/mobile widths pass for the homepage, mobile menu,
FAQ and both coming-soon badges. No page errors, failed resources, application
bundle or Auth API requests occurred. Evidence and the exact source overlay
are in `.tmp/huslyg-landing-release/`, including `verification.json`,
`browser-verification.json` and live screenshots.

The workspace includes unrelated unpublished client/backend work. A release
must overlay only this page, its assets, the build script/download-renderer and
the intended Vercel build/redirect settings onto the then-current live source
manifest. Do not deploy the entire dirty workspace. Preserve live API source,
cron definitions, public legacy downloads and callback pages; verify the
production Auth target and endpoints independently after a release. The root
`App.web.tsx` is for source consistency/local Expo; the production output itself
is static and does not execute it.

The store URLs are intentionally pending. Production publication was explicitly
approved by the owner on 28 October 2026.
