# Huslyg public search pages

Adds four public pages to the static landing site, using its existing local DM
Sans fonts, house mark, blue/cream palette, rounded cards and spacing:

- `/elpriser.html`: public DK1/DK2 prices with supported netselskab selection,
  today/tomorrow, current quarter, daily mean, cheapest continuous hour,
  positive/negative-price chart and accessible full table.
- `/app-elpriser-forbrug.html`: practical app-selection guide, actual Huslyg
  features, setup and honest store availability.
- `/elforbrug-eloverblik.html`: kWh versus price, approval, delayed historical
  readings, coverage and troubleshooting; links to official Eloverblik.
- `/varmeforbrug.html`: heating units, comparison limits and supplier differences;
  links to SparEnergi and Forsyningstilsynet without invented national prices or
  guaranteed savings.

The homepage links all four pages through a guide section before downloads.
Every page has a unique title, description, canonical, Danish language setting,
Open Graph metadata and WebPage JSON-LD. The sitemap lists the new canonical
URLs. The existing static build copies them through `public/`; no backend,
database, app, dependencies or deployment configuration changes are required.

## Public price behavior

`public/landing/prices.mjs` calls the existing same-origin public endpoint
`/api/grid/lookup?operation=suppliers` and `operation=prices`, with the selected
supplier ID and its area. No credentials, personal data, storage or authenticated
APIs are used. The selectors default to the visibly identified N1 area 131 in
DK1, or Radius in DK2; this is not a household/address identification.

The existing server returns `totalOrePerKwh`: spot plus relevant C tariffs,
electricity tax and VAT. The page converts to kr./kWh and explicitly excludes
the electricity retailer's individual surcharge, subscriptions and fixed fees.
Attribution identifies Energinet / Energi Data Service, CC BY 4.0 and Huslyg's
transformations. “Hentet” is the browser retrieval time, not upstream publication.

Only complete published quarter-hour days are accepted. Copenhagen local-day
boundaries support 23/24/25-hour days; repeated autumn times include UTC offsets.
Missing/duplicate/invalid intervals reject the day instead of filling with zero.
Missing tomorrow prices have a separate state, without a forecast. The cheapest
continuous hour is the minimum mean of four contiguous quarters across the
selected day; it may be in the past. Negative prices retain their sign and a
zero-baseline chart. Fetches time out, cancel on selection changes and reject
stale completions. Previous results are hidden on refresh/failure; retry is
available. Visible tabs refresh every five minutes.

The website is static. Price values load with JavaScript; the price explanation,
sources and related guides are in the initial HTML. No-JavaScript visitors get
an explicit price-availability message and source link. This is not server-rendered
or build-time indexed price data, and no ranking outcome is guaranteed.

## Verification

Run:

```sh
node scripts/test-public-price-data.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROMIUM_PATH=/path/to/chromium node scripts/test-public-guides-browser.mjs
```

Browser checks expect the built site in `web-build/huslyg-public`. Normal builds
use `node scripts/build-public-site.mjs` and preserve the historic APK hash.
Do not weaken or skip that download safeguard in a deployment build.

Verified locally: source syntax; pure price-data tests (negative/zero prices,
missing/duplicate/malformed intervals, current interval and continuous-hour
calculation); static site assembly; five pages at 1440/768/390/320px; no overflow,
working mobile menu, internal links, canonical/JSON-LD and sitemap; price selection,
tomorrow absence, retry, error/gap handling, table and no-JavaScript editorial
fallback. Screenshots are in `.tmp/huslyg-guides/` and were visually reviewed.
Browser price responses are synthetic, not live-provider verification.

Follow-up verification: network access succeeded with Node's configured proxy
enabled (`NODE_USE_ENV_PROXY=1`). The unchanged public-site build script ran to
completion in the isolated source assembly, retrieved the 86,167,075-byte legacy
APK and verified its expected SHA256. Source and used marketing assets came
through the GitHub connector; this is not a full native/backend repository build.

The actual production public API returned 200 for 35 suppliers and 192 price
points each for N1 area 131/DK1 and Radius/DK2. The local mobile price page was
then exercised against those actual responses, forwarded unchanged through the
local test harness: initial prices, region/supplier switch and tomorrow prices
passed with 96 displayed quarter-hour rows and no page errors. This verifies
the new local page against live price data, not deployment of the new page.
The reusable check is `scripts/test-public-price-live.mjs`; it accepts the same
PLAYWRIGHT_MODULE and CHROMIUM_PATH variables as the fixture browser suite.
No production deployment, Search Console submission or ranking measurement was
performed.

Before publication, rerun the build on the final isolated release source, verify
the deployed public pages, then submit the updated
sitemap in the owner's verified Search Console property. Deployment must follow
the isolated-source requirements in `docs/HUSLYG-LANDING-PAGE.md`; do not publish
unrelated dev work with these public files.
