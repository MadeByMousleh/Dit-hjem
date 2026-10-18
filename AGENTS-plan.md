# AGENTS.md — Danish Smart Home / Property Intelligence Platform

> Project context for Codex in VS Code. Place this file at the root of the repository. This is a product vision and implementation roadmap, **not** a claim that every feature is already implemented. Inspect the existing codebase before changing anything.

## 1. Product vision

Build a Danish, address-centric home intelligence platform with two connected products:

1. **Consumer app**: daily utility (weather, wind, rain, electricity prices, consumption), personalized insights, home/property information, 3D digital twin, solar and renovation planning, maintenance and optional smart-home automation.
2. **Professional B2B platform**: lawful property analytics, roof/solar/renovation reports, quotation preparation, opt-in customer leads, subscriptions, APIs, and potential white-label offerings for tradespeople, estate agents, energy companies and property professionals.

The core advantage is one reusable property data model joining authoritative Danish building/geospatial data with *user-authorized* energy data, weather, calculations, and independently generated 3D geometry.

Primary market: Denmark. UI language: Danish. Engineering documentation and code can be English. Optimize for transparent estimates, provenance, user trust, privacy, and a useful mobile experience.

## 2. Existing project context (reported by product owner)

- Frontend: **React** mobile-oriented application. Determine actual framework, build tooling, routing, and state management from the repository; do not assume React Native.
- Already displays **electricity spot prices**.
- Already integrates **Eloverblik Third Party API** using customer authorization/fuldmagt to retrieve actual electricity consumption.
- Already displays **BBR property/building information**.
- Already offers **aerial imagery and cadastral/matrikel views**.
- Already displays **sun position**.
- Do not rewrite these integrations blindly. Audit and extend them.
- User has explored Danish raw LiDAR, Google 3D and phone-based photogrammetry. A Samsung Galaxy A57 should **not** be assumed to have LiDAR; design phone capture to work without it.

## 3. Product principles

1. **Daily value first**: a five-second dashboard with actionable weather/energy insights.
2. **One canonical property record**: address, building(s), footprint, parcel, geometry, data sources, timestamps, confidence.
3. **Distinguish measured / registered / derived / estimated** values visibly.
4. **Do not invent precision**: airborne LiDAR roof geometry is not a centimeter-perfect full house model; photos may be dated or incomplete.
5. **Consent-based data sharing**: Eloverblik authorization does not by itself permit resale or sharing with third parties.
6. **Professional reports are decision support**, not certified surveys, engineering designs, insurance underwriting or guaranteed prices.
7. **Build modularly**: each stage should be testable, deployable and useful on its own.
8. **Check actual source licenses, coverage, API pricing and terms** before commercial use or redistribution.

## 4. Prioritized implementation roadmap

### Phase 0 — Architecture and compliance foundation (before major new features)

- Inspect repository; document existing components, backend, APIs and environment variables.
- Define canonical property identity, address resolution, building IDs and geometry in a relational/geospatial database.
- Establish data provenance (`source`, `retrieved_at`, `valid_at`, `license`, `confidence`, `method`).
- Establish authentication, secure secret handling, API proxying, caching, error monitoring and observability.
- Implement consent and access controls for Eloverblik data, sharing, deletion, retention and audit logs.
- Verify data-source commercial permissions and third-party API terms.
- Create feature flags and automated tests for data ingestion/calculations.

### Phase 1 — Daily-use dashboard (highest user-facing priority)

1. Intelligent home screen: current all-in electricity price, weather, wind, rain, consumption, sun, next relevant action.
2. Address-level hourly/daily weather: temperature, feels-like, rain probability/amount, humidity, clouds, forecast.
3. Wind speed, gusts and direction; compass overlay relative to house orientation. Explain that localized wind shelter requires modeling.
4. Rain radar / severe weather and storm alerts when supported by source.
5. **Real electricity price**, not just spot: grid tariff, taxes, VAT and user's contract terms where available.
6. Cheapest electricity periods and user-configurable reminders.
7. Consumption analytics: daily/weekly/monthly, night/base load, seasonal comparison, weather normalization.
8. Solar sunrise/sunset, sun position, UV and frost warnings where suitable.

### Phase 2 — Energy intelligence and retention

9. Anomaly detector: unusual load or changed consumption patterns; avoid definitive appliance identification without device-level data.
10. Electricity bill forecast with assumptions and confidence range.
11. Load shifting / savings calculator based on user-selected flexible consumption.
12. Personal AI assistant answering questions based on authorized and traceable data.
13. Push notifications for meaningful price, consumption and weather events; avoid notification spam.
14. Weekly home report and optional energy-saving goals.
15. Contract comparison, when pricing and terms can be modeled fairly.

### Phase 3 — Property, garden, climate and surroundings

16. Sun/shadow map for roof, garden and patio; accuracy depends on 3D scene quality.
17. Storm, heavy rain, flood/terrain susceptibility using authoritative maps and DHM; display uncertainty.
18. Soil/geology/groundwater data, as available.
19. Garden assistant for sun exposure, greenhouse/plant placement and weather-aware recommendations.
20. Air quality, pollen, UV, frost, noise and radon *area-level* information with correct caveats and licensing.
21. Nearby public plans / major developments when supported by current official data.

### Phase 4 — Independent automated 3D house model

22. Resolve property and select **correct GeoDanmark building footprint** (may be multiple buildings per parcel).
23. Download **DHM raw LiDAR point clouds (LAS/LAZ)** for the building area; check actual acquisition date, density, classification and coverage.
24. Spatially clip point cloud to footprint + margin; distinguish building/ground/vegetation and outliers.
25. Estimate ground elevation, roof planes, ridge, slope, orientation, roof area and geometric confidence using robust fitting.
26. Generate walls/roof/terrain meshes and export **GLB/glTF**; include coordinate transformation and metric units.
27. Display in React via **Three.js / React Three Fiber** with measurements and camera controls.
28. Use public orthophotos and **Danish oblique imagery/skråfotos** where license and coverage allow, to improve recognizable appearance and estimate facade details.
29. Separate actual observations from guessed windows, doors, roof material and facade texture.
30. Let user correct geometry/materials and supply their own photos.
31. Optional phone photogrammetry workflow (20–50 overlapping photos, guidance, upload, processing) with COLMAP/OpenMVG or other suitable pipeline; **no phone LiDAR requirement**.
32. Optional Google **Photorealistic 3D Tiles** for visual context only where coverage exists. **Do not extract, analyze, export, measure, or train on Google mesh** contrary to Google terms. Independently derive measurements from authorized sources.
33. Evaluate Google Solar API only after verifying Danish coverage, licensing and economics.

### Phase 5 — 3D-based home planning

34. Solar PV layout and annual/monthly generation simulation; PVGIS and independent roof geometry.
35. Shadow simulation with nearby structures/trees if data quality allows.
36. Roof surface area / roofing material estimates for contractor pre-quotes, not final survey.
37. Patio, greenhouse, carport, extension and garden visualization; no implied planning permission.
38. Roof rainwater collection estimate.
39. PV + battery + EV + heat pump scenario simulation and payback calculations.
40. Outdoor lighting visualization.

### Phase 6 — Home finances, renovation and maintenance

41. Total household operating-cost dashboard: electricity, heating, water, taxes, insurance and maintenance when supplied.
42. AI renovation prioritization with cost ranges, expected savings, uncertainty and payback.
43. Heat pump suitability / scenario comparison; final sizing requires qualified assessment.
44. Renovation and energy grants with verified current eligibility.
45. Comparisons with genuinely comparable, privacy-preserving housing cohorts.
46. Digital home service book: installations, invoices, warranties, inspections, renovations.
47. AI document extraction with explicit user permission.
48. Maintenance reminders, long-term budgets and optional property report for a home sale.
49. Buyer-facing property overview based on permitted data and caveats.

### Phase 7 — Connected devices and advanced automation

50. Home Assistant / compatible sensor integrations.
51. EV charging schedule and compatible charger control.
52. Heat pump, battery and PV optimization where devices and permissions allow.
53. Indoor temperature, humidity, CO2 and leak sensor monitoring.
54. Permissioned AI home agent proposing actions and requesting confirmation for consequential operations.
55. Family/shared-household access with roles and revocation.

## 5. B2B products — commercial priority order

### B2B-1. Automated roof reports

Target: roofers, contractors, solar installers.

Contents: footprint, roof planes, estimated slope, ridge/height, estimated area, material/age from registered sources if available, obstructions only if detectable, provenance, acquisition dates and confidence. Professional must verify on site before ordering or construction.

Revenue: per-report payment or professional subscription.

### B2B-2. Consent-based project leads

- Homeowner requests quotes for roof, windows, insulation, solar, heat pump, etc.
- Show exactly which information will be shared, with which firms, for what purpose.
- Share only user-approved project profile and contact details; allow withdrawal where applicable.
- Never silently turn Eloverblik access into resale of personal consumption data.
- Charge per qualified lead or via contractor subscription; avoid duplicate/low-quality leads.

### B2B-3. Solar and heat pump project dossiers

Combine independently calculated roof/solar geometry with homeowner-authorized energy information and scenario assumptions. Final heat-pump dimensioning requires more data and professional validation.

### B2B-4. Contractor Pro SaaS

- Address-based property and roof lookup.
- Map-based filters on lawfully usable public building attributes.
- Quote drafting, estimated material quantities, job pipeline and report export.
- Territory/market statistics in aggregated or appropriately anonymized form.
- Avoid individual household behavioral profiling.

### B2B-5. Estate-agent and buyer reports

Public property/building facts, energy rating when available, roof/solar estimates, climate exposure, renovation scenarios, owner-approved digital service history. Label sources, date and uncertainties.

### B2B-6. Professional property analytics API

Illustrative endpoints (adapt to actual app conventions):

```http
GET  /v1/properties/{propertyId}/roof-analysis
GET  /v1/properties/{propertyId}/solar-potential
GET  /v1/properties/{propertyId}/climate-risk
POST /v1/properties/{propertyId}/renovation-scenarios
POST /v1/reports
```

Protect with API keys/OAuth, quotas, licensing rules, billing, access logs, per-field entitlements and source-specific redistribution restrictions.

### B2B-7. White-label offering

For energy utilities, property managers, estate agent chains or housing services. Subscription + setup + usage-based pricing.

### B2B-8. Insurance / banking analytics (later, higher compliance burden)

Focus on explainable building-level environmental/renovation risk data, not private consumption profiles or inferred personal behavior. Obtain specialized legal review before any underwriting/credit use.

### Illustrative pricing hypotheses — NOT verified market prices

- Qualified contractor lead: DKK 100–500.
- Roof report: DKK 49–199.
- Solar project lead/dossier: DKK 150–600.
- Contractor Pro subscription: DKK 499–1,999/month.
- Estate-agent report: DKK 99–399.
- API/white-label: contract and usage based.

Validate through interviews and pilots before building a pricing model.

## 6. Data sources and technology shortlist

| Source / technology | Intended use | Important note |
|---|---|---|
| Eloverblik Third Party API | User-authorized electricity consumption | Sensitive; authorization is purpose-specific, not a resale license |
| Energi Data Service | Spot prices, tariffs and energy datasets | Check datasets, update frequency and methodology |
| BBR / Datafordeleren | Building attributes | Registered facts may be stale or incomplete |
| GeoDanmark | Building footprints | Match actual buildings to parcel/address |
| DHM Punktsky | Airborne raw LiDAR (LAS/LAZ) | Roof geometry; not detailed facades; density/date varies |
| DHM terrain / elevation models | Terrain and ground elevation | Check vertical reference and CRS |
| Danish orthophotos | Roof and context imagery | Verify use and display licenses |
| Danish skråfotos | Facade and roof visual cues | Coverage, geometry and licenses vary |
| DMI Frie Data | Weather, radar, forecasts/warnings | Verify exact product coverage and access |
| Open-Meteo | Optional weather source | Verify commercial-use terms |
| PVGIS | PV yield simulation | Assumptions, coverage, rate limits |
| GEUS | Geology/soil/groundwater | Not site-specific engineering verification |
| Public climate/flood maps | Exposure and planning context | Not deterministic property damage prediction |
| OpenStreetMap | Supplemental surrounding geography | ODbL attribution/share-alike considerations |
| Google Photorealistic 3D Tiles | Optional photorealistic display | Paid, geographic coverage varies, no unauthorized mesh extraction |
| Google Solar API | Optional solar/roof insights | Paid, verify Danish coverage and terms |
| React + existing stack | UI | Reuse actual repo setup |
| Three.js / React Three Fiber | 3D viewer | Prefer progressive loading and mobile performance |
| Python + FastAPI | Optional processing services | Use if existing backend is unsuitable |
| PostgreSQL + PostGIS | Property and geospatial persistence | Suggested, not mandated |
| PDAL, laspy, numpy | Point cloud ingest/processing | LAS/LAZ + CRS handling |
| Open3D, RANSAC, trimesh | Roof fitting and mesh export | Validate against real surveyed cases |
| COLMAP / OpenMVG | Phone-photo photogrammetry | Server compute and image privacy costs |
| scikit-learn / LightGBM | Forecasting/anomaly models | Baselines first, monitor accuracy |

Useful starting documentation:

- Datafordeleren: https://datafordeler.dk/
- DHM Punktsky: https://datafordeler.dk/dataoversigt/danmarks-hoejdemodel-dhm/dhm-fildownload-punktsky/
- GeoDanmark: https://datafordeler.dk/dataoversigt/geodanmark-vektor/geodanmark-vektor-graphql/
- DMI: https://www.dmi.dk/frie-data
- Energi Data Service: https://www.energidataservice.dk/
- Eloverblik: https://eloverblik.dk/
- PVGIS: https://re.jrc.ec.europa.eu/pvg_tools/en/
- Google 3D Tiles: https://developers.google.com/maps/documentation/tile/3d-tiles-overview
- Google Solar API: https://developers.google.com/maps/documentation/solar/overview

Links are starting points; verify current docs, API schemas, data availability and licenses before implementation.

## 7. Suggested data model

Start with the repository's current model and evolve incrementally. Conceptual entities:

- `User`, `Household`, `HouseholdMembership`, `Property`, `Address`, `Parcel`, `Building`
- `DataSource`, `DataAcquisition`, `DataLicense`, `DataQuality`, `PropertyGeometry`
- `ElectricityAuthorization`, `MeteringPoint`, `ConsumptionInterval`, `PriceInterval`, `Tariff`, `ElectricityContract`
- `WeatherObservation`, `WeatherForecast`, `Alert`, `SunExposureEstimate`
- `PointCloudAsset`, `RoofPlane`, `MeshAsset`, `ModelCorrection`, `PhotoCaptureSession`
- `SolarScenario`, `HeatPumpScenario`, `RenovationScenario`, `FinancialEstimate`
- `Document`, `MaintenanceEvent`, `DeviceIntegration`
- `ConsentGrant`, `ShareRequest`, `SharedDataSnapshot`, `AuditEvent`
- `BusinessAccount`, `BusinessSubscription`, `Report`, `QuoteRequest`, `Lead`, `LeadDelivery`

Every computed result should carry input source/version, timestamp, assumptions, units, coordinate reference system if spatial, and confidence/limitations. Use EU/Danish privacy standards and retention rules.

## 8. Initial 3D reconstruction pipeline

```text
Danish address
  -> resolve property, parcel and building footprint(s)
  -> locate relevant DHM LiDAR tiles + acquisition metadata
  -> fetch/cache LAS/LAZ
  -> transform to a common metric CRS, crop to building footprint + buffer
  -> classify/select roof vs ground, clean noise
  -> fit roof planes and edges; infer wall heights carefully
  -> mesh roof/walls/terrain with confidence annotations
  -> export GLB/glTF + roof plane metadata
  -> display in React Three Fiber
  -> optional visual enhancement using licensed photos
  -> optional user corrections / photo photogrammetry
```

Validation: compare estimated heights/areas/slopes with trusted reference measurements on varied building types (gable, hip, flat, dormers, extensions, dense trees). Flag inadequate scans rather than fabricate geometry.

**Google restriction:** Google's photorealistic 3D data may be used only as permitted for display. Do not extract its geometry or use it as a source for independent measurements, datasets or AI training unless current contractual terms explicitly authorize it.

## 9. Privacy, legal and safety gates

- GDPR: identify controller/processor roles, legal basis, purpose limitation, minimization, transparency, deletion and data-subject rights.
- Distinguish **consent to access Eloverblik** from **consent to share a specific project dossier**; obtain appropriate permission for each purpose.
- Avoid broad household profiling, behavioral resale, covert lead generation, and unnecessary address-level exposure.
- Treat precise addresses, consumption, household documents and inferred occupancy as potentially personal data.
- Aggregate safely: small geographic cohorts may still reidentify individuals; anonymization must be robust.
- Check Datafordeleren/BBR/GeoDanmark/DHM/DMI/imagery/Google/PVGIS and third-party provider commercial-use, caching, redistribution, attribution and derivative-work terms individually.
- Provide warnings for flood/radon/structural assessments; do not imply certified engineering or insurance advice.
- Handle photo uploads securely; provide explicit consent, deletion and limited retention.
- Secure professional access with tenancy isolation, authorization checks and audit trails.

## 10. Practical delivery order / suggested milestones

These are illustrative targets, not guaranteed deadlines:

- **Milestone 0:** codebase audit, architecture, canonical property model, security and compliance review.
- **Month 1:** daily dashboard + weather/wind/rain + full electricity cost + better consumption UI.
- **Month 2:** consumption insights, bill forecasts, savings, notifications.
- **Month 3:** AI assistant + sun/shadow and property climate context (with uncertainty).
- **Months 4–5:** LiDAR ingest, roof-plane estimation, first 3D GLB viewer, validation.
- **Month 6:** solar/roof economics and first **paid roof report pilot**.
- **Months 7–9:** contractor portal, quote workflow, opt-in leads, renovation reports and digital home book.
- **Months 10–12:** professional API/white-label discovery, compatible smart-home integrations and automation.

**Business-first shortcut:** The first B2B roof report can be built from lawful public data before consumer 3D capture is fully mature. Pilot with 3–5 roofers/solar installers and revise based on actual workflows.

## 11. First actionable backlog for Codex

Do these in order; do not implement all at once:

1. Read project structure, package files, README, current data fetching and authentication.
2. Produce `docs/current-architecture.md` describing what exists versus what is planned.
3. Identify how Eloverblik, spot prices, BBR, map and sun position are currently implemented; preserve working features.
4. Propose minimal data model/schema changes for property, source provenance and consent.
5. Add address-specific weather and wind service using a legally suitable source, caching and tests.
6. Build dashboard UI cards for weather, wind, current full electricity cost, consumption and recommendations.
7. Add real-price calculation as a tested function with explicit tariff/contract assumptions.
8. Build a consumption insights service with clear baseline and anomaly definitions.
9. Prototype LiDAR pipeline for **one test property** using a manually supplied address, with reproducible scripts and accuracy notes.
10. Prototype a roof report and a B2B customer interview/demo flow.

When the product owner asks Codex to implement a feature:

- Inspect current files first and state assumptions.
- Break work into small verifiable steps.
- Prefer extending existing libraries and patterns.
- Keep keys/tokens server-side, never commit secrets.
- Add tests for computations, transformations and access control.
- Do not claim an API is free, nationwide, current or commercially reusable without verification.
- Show data source, timestamp, confidence and limitations in the UI.
- Ask before adding paid APIs, transmitting personal data, or making major architectural changes.

## 12. Product engagement and business logic

**Daily:** weather, wind, rain, electricity price, sun, personalized actions.

**Weekly:** consumption reports, savings, upcoming weather, maintenance.

**Occasional/high value:** 3D digital twin, solar panels, renovations, extensions, financing and house-sale documentation.

**B2B monetization:** roof reports -> opt-in qualified leads -> contractor SaaS -> property API -> white-label; insurance/bank use only after stronger legal/product maturity.

The app should be genuinely useful without selling personal data. The business should monetize *independent calculations, workflows and expressly requested introductions*.

---

## 13. Open decisions for the product owner

- Exact React environment (web/PWA/native wrapper) and current backend/database.
- Initial geographical scope (all Denmark or pilot municipality).
- Whether the first paying customer is a roofer, solar installer or estate agent.
- Which existing data source licenses and Eloverblik agreements permit each planned operation.
- Whether to prioritize a visually realistic 3D model or roof measurement accuracy first.
- Hosting budget and whether paid Google APIs should be used at all.

**Important:** This document summarizes the discussion and ideas, not implementation status. Codex should treat it as long-term project guidance and always inspect the real codebase.
