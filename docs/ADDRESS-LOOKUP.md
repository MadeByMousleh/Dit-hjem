# Address lookup

The old DAWA autocomplete endpoint returned HTTP 410 on 2026-10-03 after its retirement. Address search now uses KDS Adressevælger through `/api/address/search` in both Vercel and the local server.

- Search: `https://adressevaelger.dk/adresser/soeg`, `tekst` (maximum 73 characters), `maksimum=6`.
- Road-only results refine the input; they are not saved as selected household addresses.
- Address/house-number results are enriched through the corresponding ID endpoint for municipality, postcode and access-point geometry.
- KDS currently recommends the public `adressevaelger123` token; it is not a private credential. User management is expected later and will require another integration increment.
- Geometry must be EPSG:25832. Server-side `proj4` converts ETRS89 / UTM zone 32 to longitude/latitude for the existing grid-boundary lookup. The client has no direct fallback to retired DAWA.
- Provider requests time out after 8 seconds each; the client allows 18 seconds for search plus enrichment and cancels superseded input.

Verification: `node scripts/test-address-search.mjs`; TypeScript-only check; Expo web export. A live public Copenhagen City Hall lookup returned municipality `0101`, postcode `1550`, and resolved Radius Elnet. No private household address was tested.

Other waste adapters still reference retired DAWA endpoints (RenoSyd, Ikast and Aarhus in `server.mjs`); they require separate migration. SONFOR uses its own RenoWeb address lookup.

Official references:

- [DAWA retirement](https://www.klimadatastyrelsen.dk/om-klimadatastyrelsen/nyheder/nyhedsarkiv/2026/jul/dawa-lukker-d-1-oktober-2026)
- [Search](https://confluence.kds.dk/pages/viewpage.action?pageId=244318431)
- [ID lookup and coordinates](https://confluence.kds.dk/pages/viewpage.action?pageId=246743156)
- [Public token and future user management](https://confluence.kds.dk/display/ADV/Brugerstyring)
