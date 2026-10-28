# Mit hjem: simple property information

2026-10-24 cache/display follow-up: overview BBR/location/grid-name snapshots are cached per user, household and address in bounded optional local storage and memory. Fresh snapshots (24 hours) avoid another profile/BBR request; expired snapshots remain visible during refresh and on fetch failure. Metadata is public property information; energy readings and documents are not copied to this cache. Existing gallery manifest/image caching remains in use. Geometry and successful compact roof estimates now also have persistent 24-hour, address/query-bound caches; model-photo and height payloads are not added to SQLite. Netselskab appears in a tile and uses the address lookup's full company name where available, with “Adresseopslag · ikke målerbekræftet”; profile fallback is explicitly labelled. It does not prove the operator or tariff of a particular meter. The browser cache check confirms that reopening after a page reload makes no second BBR request; first retrieval and expired refresh still require providers.

2026-10-24 activation: user explicitly requested verification and activation, rather than hiding features. `202610230001_property_documents.sql` is now applied and journalled on explicit dev and production projects after rollback-only dev assertions. Backend `dpl_6WdvRBZ57k2J4umTK32mVjUw5HHq` is READY, preserving baseline `dpl_9hgVGTM5WFb1fcA4udV8Z6dnXYVE` sources except the documented document/price modules and routing/config additions. Both domains reject missing/invalid document authentication with 401/no-store. RLS enabled; anonymous reads and direct authenticated writes denied. Plantegning remains visible. Real authenticated upload/native picker verification is pending because no phone is connected. This supersedes the pending activation notes below.

Client update, 2026-10-23: packaged in APK 1.0.97 (code 98), installed over Wi-Fi with app data retained. Packaged page/dependencies, API target, version and existing test signature verified. No production migration, backend deployment, commit or push. Floor-plan cloud storage activation remains pending; upload stays disabled when listing is unavailable. Physical page/picker appearance is not newly verified.

The entry page is Overblik. Visible tabs: Overblik, Boligen, Tag, Matrikel and Plantegning. Register fields, coordinates, raw IDs, timeline, planning/area tools and the unfinished house/solar model are not rendered by this page. Existing source modules and user data remain intact.

## Roof area

`HomeRoofDetails` first uses the existing building/address/outline-bound LiDAR model when its fit RMSE is at most 0.3 m. It sums actual roof triangle areas. Otherwise it uses existing geometry and DHM surface/terrain endpoints. `roof-area.ts` estimates slope from interior surface cells, excludes edges, missing samples and obvious spikes, requires at least 20 interior cells and 70% support, and scales the mean retained slope factor over the mapped footprint. It rejects raster spacing above 1.5 m and mismatched address/bounds. Numbers round to 5 m² and describe the entire matched building, not an apartment's private roof.

This is an estimate, not surveyed roof area. Vegetation, survey age, curved/complex roofs, eaves and dormers affect the result. The quality gate cannot reliably detect every smooth tree crown. No independent survey accuracy has been measured. Missing/unsupported estimates display an unavailable state, never a BBR footprint masquerading as roof area. No LAZ tiles are downloaded by this UI.

## Floor plans

Users select PDF/JPEG/PNG files, maximum 2 MiB each, via Expo DocumentPicker. Images preview in the tab. PDF downloads in the browser and opens the system share/open sheet on native. Files persist through the authenticated `property-documents` operation of the existing vault route, independently of energy data. Files are private to household members and address-bound, but are NOT end-to-end encrypted: the backend and authorized administrators can read them. They are not used for AI training.

Migration `202610230001_property_documents.sql` adds an RLS-protected table and service-only save RPC. Gateway verifies the user JWT/issuer/audience, household membership, canonical base64/2 MiB bounds and supported magic bytes. Files are not publicly hosted. Save/delete use expected revision and a household transaction lock; deleted records retain a null-payload tombstone to prevent stale resurrection. Limits: 20 live files and 32 MiB encoded payload per household, 200 total document identities including tombstones. File signature checks are not malware scanning.

Apply/review the new migration and deploy the backend before exposing uploads to users. Missing table/backend shows an error and disables upload until a successful list retry. Native builds need the added SDK54-compatible `expo-document-picker` and `expo-sharing` packages; an existing APK will not acquire these modules automatically. Production migration and releases need explicit approval under AGENTS.md.

## Validation

- `node scripts/test-home-simple.mjs`: analytic slope/flat roof, missing/spiky data, wrong address; type/size/name validation, membership, scoped reads and stale API writes.
- `scripts/test-property-documents.sql`: database roles/RLS, ownership, revision conflict and deletion tombstone. Run with explicit dev reference. The new migration and tests were executed together in a rollback-only transaction on `wsdomkzhnksyjrpxqfvn`; nothing persisted.
- `node scripts/test-home-simple-browser.mjs <playwright index.mjs>`: real React Native Web page at 390px, five tabs, roof estimate, simplified parcel, image upload/preview/reload/delete with synthetic API, auth and file picker.
- `npx tsc --noEmit --allowJs false`: TypeScript-only check. The default command is blocked by pre-existing syntax errors in root `update_page.js`.

Physical Android/iOS file picker/PDF opening, authenticated live uploads and real-house roof accuracy remain unverified.
