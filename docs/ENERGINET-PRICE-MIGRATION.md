# Energinet-priser – klargjort skift, 27. oktober 2026

Status: **Godkendt og aktiveret i produktion 27. oktober 2026.** Migrationen og de 14 isolerede filer er udgivet. Begge domæner bruger Energinet i backend/web; APK 1.0.126 er nu installeret på Samsung SM_A576B med data bevaret; installeret version og appstart er verificeret. Ældre APK-versioner skifter ikke priskilde automatisk. Ingen private eldata, krypteringsnøgler eller Eloverblik-forbindelser er ændret.

## Beregningen

- Spot: Energinets `DayAheadPrices`, 15 minutter; historik før 1. oktober 2025 fra `Elspotprices`, timer.
- Net: `DatahubPricelist`, faste GLN-/tarifkode-par for 35 C-tarifområder. Gyldighedsdato og dansk lokal time afgør version og sats. Rabatter, negative beløb og reelle nulpriser bevares.
- Konstant inkluderer datogyldig tarifrabat; Ravdex inkluderer overordnet 60 kV-net. Historiske kodeplaner for Konstant og L-Net er medtaget.
- Energinets transmission, systemtarif og almindelige elafgift tilføjes. Standardmoms 25 % beregnes én gang. Leverandørtillæg, abonnement og særlige måler-/afgiftsforhold er ikke indeholdt i den offentlige C-pris; eksisterende elaftaleberegning fortsætter særskilt.
- Der vises kun offentliggjorte priser. Ingen konstrueret ugeprognose. Historiske huller eller ukendte tariffmatch giver utilgængelig pris frem for et gæt; kWh-historikken bevares.
- Appens offentlige cache får særskilte `energinet-v1`-nøgler. Historik, som stadig udvikler sig, genhentes efter 15 minutter; afsluttet historik efter syv dage.

## Lagring og opdatering

Appen henter fra egen `/api/grid/lookup?operation=prices` og `operation=suppliers`. Ingen telefon behøver kontakte Energinet direkte, og Strømligning indgår ikke i produktionskoden.

Migration: [202610270003_public_energy_source_cache.sql](../supabase/migrations/202610270003_public_energy_source_cache.sql). To servicebeskyttede tabeller gemmer offentlig kilde-cache og uforanderlige versioner af ændrede kildepakker. Opdateringslås gælder på tværs af backendinstanser; ingen anonym eller almindelig bruger kan læse/skrive tabellerne direkte. Fejl bevarer tidligere arkivdata og giver ikke kunstige nulpriser.

Tarifpakken genbruges med dagligt opdateringsskel kl. 09 dansk tid. Det eksisterende beskyttede daglige prisjob opdaterer også tarifarkivet. Spotpriser deles i månedspakker, med 15 minutters friskhed for indeværende/fremtidig måned og ugentlig kontrol af afsluttede måneder. Eksisterende historiske spotprisjob fortsætter.

Kilde og licens vises ved grafen: Energinet / Energi Data Service, CC BY 4.0. Omregning og tilføjede tariffer fremgår af API-kildemetadata. Se [Energinets API-vejledning](https://www.energidataservice.dk/guides/api-guides) og [vilkår](https://www.energidataservice.dk/terms-and-conditions).

## Gennemført kontrol

| Kontrol | Resultat |
| --- | --- |
| 100 forskellige offentlige adresse-id'er → netselskab → tarif | 100 matchet, 0 afvigelser; dækker 8 tarifområder, ikke et nationalt repræsentativt udsnit |
| Direkte sammenligning af alle 35 tarifområder | 35 matcher for 27. oktober 2026, 96 kvarterer pr. område, 3.360 intervalpar |
| Største forskel i totalpris | Under 0,00005 øre/kWh; reference afrunder beløb |
| Negativ totalpris, moms én gang, nulpriser, tarifskifte og gentaget dansk DST-time | Bestået |
| Adressepolygon med hul | Rettet: hullet regnes ikke som en del af området |
| Udviklingsdatabase, eksplicit `wsdomkzhnksyjrpxqfvn` | Migration anvendt; rollback-test af adgangsrettigheder, lås og versionsarkiv bestået |
| Isolerede serverfiler med uændrede live-hjælpefiler | Beregnings- og spotarkivtests bestået |
| Første fungerende Preview | Kildehashes stemmer; dev-Auth verificeret; DK1 og DK2 returnerer priser; forkert prisområde afvises |
| Endelig Preview `dpl_Fdr9NejnBbYhiZ6NyqLxAsXNn33w` | READY; samtlige 376 kildehashes stemmer; dev-Auth og begge prisområder verificeret |
| Historisk API-kontrol for Konstant og L-Net, 15. januar 2025 | Begge 24 timepriser matcher Strømligning; største afrundingsforskel under 0,000059 øre/kWh |
| TypeScript | Rodprojekt og isoleret native-stage passerer |
| APK 1.0.126, versionCode 127 | Build, 33 kildehashes/29 pakkede kodekilder, nøjagtigt bundlet kodeindhold, produktions-API, SDK 36 og signatur kontrolleret; servermoduler udelukket |
| Produktionsplan uden skrivning | Kun `202610270003_public_energy_source_cache.sql` afventer; intet anvendt |

APK: `dist/Huslyg-1.0.126.apk`, 85.982.103 bytes. SHA-256: `9e838863b4bc958eabcd3482ee9d5380c9ed68428126ce78e7267d04d48529cf`. Certifikat SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, samme testcertifikat som 1.0.125. Ikke installeret eller fysisk verificeret. Ingen commit eller push.

Strømligning beholdes **kun i sammenligningsværktøjerne**. `scripts/helpers/stromligning-reference.mjs` må ikke importeres i app/backend. Referencen er en kontrolkilde; netselskabets officielle tarifblad afgør uenigheder. Ved den første kontrol afslørede forskellene en manglende Konstant-rabat og Ravdex-overordnet tarif; begge er rettet.

Lokale kontrolresultater ligger i `.tmp/energinet-migration/provider-comparison.json` og `address-comparison.json`; ingen private forbrugsdata er anvendt. Udgivelsesmanifest, Preview-verifikation og APK-kildekontrol ligger i `.tmp/energinet-release/`.

## Afgrænsninger, der skal bevares ved udgivelsen

- De 35 områder er dem med eksplicit tarifkortlægning. Gamle Strømligning-id'er `nke-elnet`, `videbaek_elnet_c` og det udgåede `netselskabet_elvaerk_c` får ingen gættet efterfølger. Eksisterende ugyldigt manuelt valg kræver nyt valg eller sikkert måler-/adresseopslag.
- Ældre tarifhistorik er ikke fuldstændig for alle selskaber. Stikprøver fandt mangler i 2023 samt Tarm før oktober 2024. Disse perioder må ikke prissættes med dagens sats. Kontrollen beviser ikke alle historiske dage eller særlig varmepumpe-/solcelleafregning.
- APK bruger eksisterende testcertifikat og produktions-API-adresse. Et bestået build dokumenterer ikke fysisk telefonadfærd. Telefonen blev ikke fundet via ADB under klargøringen.
- E03 på den samlede juridiske checkliste forbliver åben for øvrige datakilder og endelig publicering.

## Konkret produktionsudgivelse

1. Kontrollér uændret live-baseline `dpl_7bQLKoeLwLbbcKhkQh7c2mpMYN8e` og den godkendte kildepakke.
2. Efter særskilt godkendelse: anvend kun `202610270003_public_energy_source_cache.sql` på `arkpfdsglgufnnukader`. Ingen sletning, Auth- eller nøgleændring.
3. Udgiv de 14 filer i `.tmp/energinet-release/manifest.json` fra den eksisterende live-kildepakke, med Production-indstillinger. Preview må ikke promoveres med sine dev-indstillinger.
4. Verificér kildehashes, produktions-Auth, begge domæners priser, forkert tarifområde og eksisterende beskyttede ruter. Først derefter installeres den kontrollerede APK, hvis telefonen er tilsluttet.
5. Ved rollback: bevar additive cache-/versionstabeller og eksisterende historik. Gendan den tidligere live-kildepakke; genoptagelse af Strømligning som produktionskilde kræver afklaret aftale og særskilt beslutning.

## Verificeret produktionsresultat

- Deployment: `dpl_3zCw9iFtXkmi11sxMqnLR4SYmU8d`, READY i fra1 på huslyg.dk og dit-hjem-five.vercel.app. Rollback-kilde: `dpl_7bQLKoeLwLbbcKhkQh7c2mpMYN8e`.
- Alle 376 kildehashes svarer til den godkendte pakke. Production-Auth peger fortsat på `arkpfdsglgufnnukader`; Preview er ikke promoveret med dev-indstillinger.
- Begge domæner returnerer 35 tarifområder samt endelige offentliggjorte DK1-/DK2-priser fra `energinet-v1`. Forkert område afvises med 400/no-store. Eksisterende konto-/sletteruter afviser manglende og ugyldigt token med 401/no-store; offentlige indgangssider er tilgængelige.
- Produktionsdatabase: kun `202610270003_public_energy_source_cache.sql` anvendt. Begge nye tabeller har RLS; anonyme/almindelige brugeres direkte læse-/RPC-adgang afvises. Service-backendens rettighed er bevaret.
- Telefon ikke fundet via USB eller mDNS; APK ikke installeret eller fysisk verificeret. Offentlig APK-download er ikke ændret af denne 14-filers udgivelse.
- Beviser: `.tmp/energinet-release/production-verification.json`, `production-db-verification.json`, `production-preflight.json` og `apk-verification.json`. Ingen commit eller push.

## Telefoninstallation – opfølgning 27. oktober 2026

APK 1.0.126 (versionCode 127) installeret på den kendte Samsung SM_A576B med `adb install -r`; appdata bevaret. Installeret pakkeversion er verificeret, og `am start -W` returnerede `Status: ok`. De tidligere noter om manglende telefon/installation er historiske og erstattes af denne opfølgning. Grafers udseende og brugerinteraktion er ikke fysisk kontrolleret i denne installation.
