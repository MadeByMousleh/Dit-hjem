# Danish keyword focus for Huslyg

Research and implementation: 28 October 2026. The site is newly launched;
historical Search Console performance is not yet available. This is an initial
intent and competitor-content assessment, not a measured traffic forecast.
Search-result samples do not establish fixed Google rankings, search frequency,
keyword difficulty or likely conversion rates.

## Focus and page ownership

Keep one substantive canonical page per intent group. Related wording belongs
on that page; do not create one thin page for every word order, town or supplier.

| Priority hypothesis | Query candidates | Owning page | Purpose |
| --- | --- | --- | --- |
| First: direct product fit | app til elpriser; app til elpriser og forbrug; app til elforbrug; elpris app | /app-elpriser-forbrug.html | Explain actual features, connection requirements and honest availability |
| First: personal consumption | se mit elforbrug; se elforbrug time for time; Eloverblik app; historisk elforbrug | /elforbrug-eloverblik.html | Answer where to see data and how historical readings work |
| Supporting questions | hvorfor er mit elforbrug forsinket; Eloverblik manglende data; kWh og elpris | /elforbrug-eloverblik.html | Resolve data delays and interpretation without making unsupported promises |
| Tool-led discovery | elpriser i dag; elpriser i morgen; elpriser inkl afgifter; elpriser med nettarif; billigste strøm i dag; DK1 DK2 | /elpriser.html | Give usable public prices and transparent calculation limits |
| Supporting heating fit | varmeforbrug app; følg varmeforbrug; normalt varmeforbrug; MWh til kWh; fjernvarmeforbrug | /varmeforbrug.html | Explain units, comparison limits and supplier-dependent availability |
| Brand | Huslyg; Huslyg app | / | Introduce the product and link the guides and store availability |

These candidates are for validation. Monthly volume, SEO difficulty, Danish
rankings and traffic potential remain **unmeasured**. Priority reflects product
fit and observed competing content, not a claim that these have the most searches
or the least competition. Do not target “gratis” until pricing is confirmed.
Do not promise “live elforbrug” for historical Eloverblik measurements. Do not
target supplier-login intent with a page that imitates official self-service.

## Evidence behind the intent groups

Public pages sampled on the research date:

- [Elforbundet: app til elpriser og forbrug](https://www.elforbundet.dk/app-til-elpriser-time-for-time-og-forbrug)
  addresses app selection and connecting consumption. It is evidence of a
  competing content category, not independently measured demand.
- [Jysk Energi: ello](https://jyskenergi.dk/el/ello/) describes both prices and
  individual consumption as app use cases.
- [OK: where to see personal consumption](https://www.ok.dk/privat/hjaelp/ok-hjem-appen/hvor-kan-jeg-se-mit-elforbrug-i-ok-hjem)
  answers the direct “where can I see my usage?” task.
- [Watts FAQ](https://www.watts.dk/faq) addresses delayed consumption readings.
  Huslyg should state its own data limitations rather than copy another app's
  timing or savings claims.
- [Bolius: electricity prices](https://www.bolius.dk/elpriser) explains the
  components and methodology behind a price overview.
- [Vestforsyning: normal consumption](https://www.vestforsyning.dk/varme/er-mit-forbrug-normalt/)
  pairs heating comparison with a consumption app. Its local thresholds must
  not be generalized to every supplier.

## Implemented refinements

- Clear query-oriented titles, descriptions and H1s while retaining the landing
  slogan and design. Distinguish current prices from historical consumption.
- An initial static “Kort fortalt” answer, then detailed explanatory content.
- Four practical visible Q&As per guide, covering app availability, personal
  data, delays, billing components, tomorrow prices and heating units.
- In-page contents links and BreadcrumbList JSON-LD matching the visible
  homepage/page breadcrumb. No FAQ rich-result claim or keyword meta tags.
- Preserve canonical page ownership, source links, sitemap and internal links.

## How to replace hypotheses with measurements

Ahrefs was discovered as an eligible optional integration and suggested, but was
not confirmed connected during this increment. If connected, request Denmark
keyword metrics for the candidates above: estimated monthly volume, trend and
seasonality, organic difficulty, traffic potential and the actual ranking pages.
Record the database country and observation date. Ahrefs metrics are estimates,
not Google's actual query counts or a ranking guarantee. Compare query clusters
without summing close variants as if they were all independent audiences.

Google Keyword Planner is an alternative for geographically scoped demand
estimates. Its “competition” metric describes advertisers, not organic ranking
difficulty: [Google's metric definitions](https://support.google.com/google-ads/answer/3022575?hl=en).

Set up Search Console now to accumulate observations; a new site does not need
three months of data before setup. After the pages are deployed, verify canonical
and indexing status and submit the sitemap. Review non-brand queries and their
landing pages, country Denmark and device, using available 28-day and longer
windows. Prioritize relevant impressions with poor click-through, useful queries
near page one and product-fit topics with emerging visibility. Do not infer
failure from a few days or from average position alone. [Google's performance
guide](https://support.google.com/webmasters/answer/17010961?hl=en).

Before store publication, app-download conversion is constrained by the honest
coming-soon badges. Once store links exist, measure meaningful store-link clicks
with an explicitly selected privacy-appropriate measurement setup; none was
added by this task. Do not optimize simply for total visits or generate weak
content to chase broad queries unrelated to the product.

## Publication boundary

All improvements remain in PR #2. The public build script with its verified
legacy download and the local price page using actual public API responses now
pass; see HUSLYG-SEO-PAGES.md for the precise scope. Publish only the isolated
public-site files and verify the final deployed pages. No database, Auth, SEO
account, tracking script or production deployment has been changed.
