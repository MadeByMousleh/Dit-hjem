# Server-rendered public price page

28 October 2026. Authorized continuation to make current numerical prices
available in initial HTML, without requiring visitors or crawlers to execute
JavaScript. Included in PR #2; no production publication has occurred.

## Runtime and route

`/elpriser.html` rewrites to the existing `/api/grid/lookup` function with
`operation=public-page`. The new branch calls `public-price-page.mjs`, which
reads the bundled `public/elpriser.html` template and uses the existing public
`getEnerginetPrices` service. It does not read account/session data, accept a
user ID or add a new Vercel function. Existing price JSON, forecasts and grid
lookup branches remain intact. The five crons, callback rewrite, database and
Auth settings are unchanged.

The static build explicitly removes `elpriser.html` from its output so a static
file cannot shadow the rewrite. The source template is explicitly included in
the existing grid function using `includeFiles`. This follows Vercel's documented
filesystem precedence: [routing configuration](https://vercel.com/docs/project-configuration/vercel-json).

GET and HEAD are accepted for the HTML operation. The only public view choices
are validated `priceArea`, supported `supplierId` and `day=today|tomorrow`.
Historical `from`/`to` query values are never forwarded to the price service.
The template, source service, supplier catalog and shared calculations are part
of the same deployment; no self-fetch to the production website is used by the
deployed handler.

## Initial HTML and enhancement

Successful responses include selected controls, a dated current-day/tomorrow
heading, retrieval time, current interval when relevant, daily mean, cheapest
continuous hour, positive/negative chart and every quarter-hour table row.
Sources, units and tax/tariff/retailer exclusions remain visible. All dynamic
text is HTML-escaped; no provider error details are reflected in the page.

The browser receives a complete usable page. GET form submissions allow region,
supplier and day changes without JavaScript. Choosing a supplier outside the
selected area produces a validation message rather than silently showing the
wrong tariff. JavaScript retains the server-selected supplier/day, then supports
the existing asynchronous controls and periodic visible-page refresh.

Successful HTML responses use `max-age=0, s-maxage=60, must-revalidate`, with no
configured stale-while-revalidate. The page distinguishes retrieval time from
source publication and discloses the one-minute server-cache window. A cache
window can straddle a quarter/day boundary; the visible date/time anchors the
snapshot. A missing unpublished tomorrow has no invented values. Invalid query
choices return 400/no-store; provider errors, gaps or invalid payloads return
503/no-store with Retry-After and the editorial guide, without old/sample values.

## Verification

Commands:

```sh
node scripts/build-public-site.mjs
node scripts/test-public-price-data.mjs
node scripts/test-public-price-page.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_PATH=/path/to/chromium node scripts/test-public-price-page-browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_PATH=/path/to/chromium node scripts/test-public-guides-browser.mjs
```

The source-data tests cover Copenhagen 23/24/25-hour days, negative and zero
prices, malformed/missing/duplicate values, current quarter and continuous-hour
minimum. SSR tests cover initial HTML, selected tomorrow/DK2 views, query bounds,
escaping, cache headers, incomplete/mismatched/upstream failure behavior,
unpublished tomorrow, template bundling configuration and no shadowing static
output. No-JavaScript Chromium checks exercise actual GET form navigation,
visible data, 503 states and 320/390/768/1440px layout. Enhanced-browser checks
retain selected supplier/day during hydration. The original five-page interaction
suite also passes. The public build script completes and retains the verified
86,167,075-byte legacy APK hash.

`test-public-price-live.mjs` additionally forwards actual public production API
responses to the local SSR handler, checks that numbers are in the raw response
and visible without JavaScript, and exercises enhanced-page area/day selection.
The local test forwarding is a verification dependency injection, not production
architecture and not deployment of this new HTML operation.

Production promotion still needs Vercel access and final runtime verification.
Confirm the deployed rewrite returns HTML with price rows (not the static
template), both price areas and errors behave correctly, and existing APIs,
callbacks, Auth guards, crons and public assets are retained. Keep the preceding
production deployment available for rollback. The isolated-public-source release
instructions in HUSLYG-LANDING-PAGE.md still apply; do not deploy unrelated dev
work. No ranking, indexing or AI-citation outcome is guaranteed.
