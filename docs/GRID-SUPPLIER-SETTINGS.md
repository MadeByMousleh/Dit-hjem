# Netselskab: session reuse and profile preference

## Dropdown design follow-up, 1.0.118

Both supplier and price display now use `SettingsDropdown`: the same white field and menu surface, 12 px corners, quiet border, shared typography, chevron and checked selection. Supplier search sits inside a bounded 216 px scrolling menu instead of expanding all companies into individual cards. Restore is a compact text action. The price options are `Med moms og afgifter` (including grid tariffs) and `Kun spotpris`. Profile saving and price calculation behavior are unchanged. Root/staged TypeScript and actual component browser selection/restore checks pass.

APK 1.0.118/code 119 installed on the existing Samsung with data retained; package version and launch verified. Artifact `dist/Stromblik-1.0.118.apk`, 86,146,875 bytes, SHA256 `A7E80FA9D3561D7744544862A8A840EF7A98B8269353E8D9A96B31D0C2BCF102`; existing test certificate, packaged source equality and production API verified. No backend deployment. Final native visual capture was black with NotificationShade focused; the new dropdown's physical appearance remains unverified. No blind gestures were sent after that capture.

24 October 2026.

- Automatic resolution is reused for the lifetime of the unlocked household vault. Tab changes, ordinary profile saves, foreground events and price refresh intervals no longer blank or re-resolve the company. Address changes invalidate the address-bound result. Failed resolutions remain retryable. Logout/new vault separates the cache.
- The spot-price settings load the provider's full active private-customer (C) catalogue, with searchable company/tariff names and DK1/DK2. The live catalogue currently contains 37 entries. This is provider coverage, not a claim that all possible national business/producer tariffs are included.
- A manual choice is stored separately as `gridSupplierOverrideId`, in the authenticated account's existing `home_profile` metadata and local user-scoped profile. It does not overwrite the original address/meter evidence. Save errors stay visible. The choice is applied by the shared price resolver, so price requests and historical-price cache keys use the chosen company and its price area; old-company series are withheld while the replacement loads. The chart marks a manual basis as `Selvvalgt`.
- `Gendan mit netselskab` clears the override remotely and locally and explicitly refreshes automatic resolution: connected Eloverblik meters first, otherwise the precise address. Existing meter/address validation remains. An unmatched connected meter does not silently become an unrelated address tariff.
- Supplier catalogue requests are deduplicated for the app session. Price refresh continues independently; removing company re-resolution does not freeze electricity prices.

Verification: root and isolated APK-stage TypeScript; actual resolver and settings browser fixture for navigation reuse, unrelated profile save, manual selection, cloud preference payload, restore payload, changed-address validation and rejection of another address's meter; no browser runtime errors. Live public catalogue and price responses for N1 344, TREFOR and Radius confirmed real tariff/area differences. No customer's profile was modified during synthetic checks. No database schema, cryptography or backend deployment changes.

API source: https://stromligning.dk/api/suppliers and https://stromligning.dk/api/prices (queried with company, C customer group, price area and date interval). Prices are fetched on selection rather than preloading all 37 time series.

APK: `dist/Stromblik-1.0.117.apk`, versionCode 118, 86,146,079 bytes, SHA256 `FBEDB32E49CB697BA5467B9CD6105BE382575AE0C8D21022FBB09E9B64304E63`. Release build, exact packaged changed-source/stage match, production API in Hermes bundle and existing test signature verified. No Git push or backend deployment.

Installed with data retained on the existing Samsung; package/version and launch verified. Native spot-price settings and company list opened successfully. A pale search placeholder found during the native review was corrected to the shared muted text color in the final packaged source. The customer's chosen company was left unchanged. Cloud saves and restore were exercised with synthetic accounts, not by changing the customer's actual profile.
