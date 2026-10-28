# Remote development handoff

28 October 2026. Work from the `dev` branch of `MadeByMousleh/Dit-hjem`.
Read `AGENTS.md` and `docs/ENVIRONMENTS.md` before environment, database or
deployment work. The Git branch does not select the database.

## Fresh checkout

```sh
npm ci
npm run typecheck
```

The repository includes the application source, native Android project,
generated renderer/catalogue assets, migrations, public landing page and
isolated side-project source. Production credentials, local training data,
installed dependencies, APKs and temporary exports are excluded. A fresh
checkout does not include a user's local annotations/models under the
side-project `data/` directories.

The public website is separate from the native app:

```sh
node scripts/build-public-site.mjs
node scripts/preview-public-site.mjs
```

The preview listens on port 8796. The build requires no private API keys. If the
local legacy APK artifact is absent, it downloads the existing public APK and
checks its pinned hash so older invitation links remain valid. The public
homepage advertises only the app stores, both currently marked **Kommer snart**.

`App.tsx` retains the native app; `App.web.tsx` opens the marketing site.
The app's native UI lives in `src/screens` and `src/components`. To run it
against development services, use the explicit environment launcher described
in `docs/ENVIRONMENTS.md`; never copy production credentials to make a preview
work. Do not run migration wrappers against the default linked project.

## Validation and browser dependencies

```sh
node scripts/test-public-site-downloads.mjs
node scripts/test-history-price-performance.mjs
node scripts/test-usage-selection-loading.mjs
node scripts/test-electricity-usage-records-hook.mjs
node scripts/test-bar-scrub.mjs
node scripts/test-heating-cost.mjs
node scripts/test-heating-persistence.mjs
node scripts/test-price-forecast.mjs
```

Browser scripts require Playwright and Chrome. Several older scripts use a
Windows-local Playwright path. The public-site browser scripts accept
`PLAYWRIGHT_MODULE` pointing at the installed Playwright module; their default
path is this workstation's cache and is not part of the repository. Browser
availability must be set up in the remote development environment before
claiming those tests pass there. The current browser evidence was captured
locally and against the deployed site, not in a fresh remote environment.

Two old test harnesses have known stale mocks:
`test-electricity-widgets.mjs` omits `validPriceLimits`, and
`test-heating-details.mjs` still expects the old direct-provider service.
See `docs/APP-PERFORMANCE-AUDIT.md` for scope and focused regressions.

## Live state and release boundaries

The latest verified landing release is `dpl_6ww4Jnq2khD25BQMFYZaVXyM5CjL`,
with rollback `dpl_GHxyiqqDGY5HbkARJWfAgZnmbem5`. See
`docs/HUSLYG-LANDING-PAGE.md` for the current illustration, website build,
source-hash checks, APIs and preserved legacy downloads.

The repository also contains local app/backend experiments that are broader
than that isolated production release. A Git push is a source handoff, not a
claim that every committed feature is running in production. Review the exact
scope before any production promotion; production migrations, Auth changes and
releases require the owner's authorization.

The `.tmp/` evidence, generated exports, local deployment manifests and local
CLI credentials are not source dependencies. Recreate an isolated release from
the active live source when needed; do not assume private workstation staging
directories are available in a fresh checkout.
