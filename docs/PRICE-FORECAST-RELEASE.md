# Prisprognose – klargjort til godkendelse, 27. oktober 2026

Status: **Godkendt og aktiveret i produktion 27. oktober 2026.** Den særskilte prognose-backend er live, og APK 1.0.127 er installeret på den kendte Samsung med data bevaret. Prognosen vises i Android-appens eksisterende spotprisgraf; webvisningen er uændret og viser fortsat officielle priser.

## Hvad brugeren ser

- Syv dage inklusive i dag, når udbyderen har aktuelle prognoser. Timer med offentliggjorte priser erstatter altid en prognose for samme time.
- Prognosedage hedder **Prognose**. Tal mærkes **Ca.**, og den valgte time viser udbyderens prognoseinterval. Modellen mærkes **under indkøring**, når dens kvalitetsport ikke er bestået endnu.
- Prognosen er timeopløst. Vi opfinder ikke fire forskellige kvarterpriser ud fra én timeprognose.
- Kildeangivelse og oplysninger om usikkerhed, beregning, ECMWF og CC BY 4.0 kan åbnes under grafen.
- Ved utilgængelig/gammel prognose vises de offentliggjorte priser fortsat. Der indsættes ingen sæsonværdi som prognose.

Prognosen tilføjes kun til grafens visningspunkter. De eksisterende officielle prisserier bruges fortsat af forbrugspriser, prisalarmer, billigste-time-widget og ladeplaner. Dermed bliver en usikker fremtidspris ikke behandlet som en offentliggjort pris i automatiske funktioner.

## Kilde og beregning

[Elpriser.dk's offentlige prognosefeed](https://elpriser.dk/data/) udgives under CC BY 4.0 med kildeangivelse. [Beregningsmetoden](https://elpriser.dk/beregningsmetode/#prognose) beskriver vejr-/markedsmodellen og kvalitetsportene. Feedets egen metadata viser, at modellen stadig er under indkøring; denne integration dokumenterer ikke en kvalitet på niveau med Strømligning.

Vi bruger kun spotprognosen for DK1/DK2. Brugerens eget netselskabs tarif, Energinets transmission/system, elafgift og moms beregnes med den eksisterende datogyldige Energinet-motor. Feedets repræsentative samlede N1-/Radius-pris kopieres ikke til andre netselskaber. Usikkerhedsbåndets afstand fra midtpunktet flyttes med samme tarifdifference. Spotvisning omregner båndet til ekskl. moms/net; totalvisning inkluderer de kendte komponenter.

Kun `kind=forecast` accepteres. `known` erstattes af vores officielle Energinet-priser, og `typical` udelades. Alle timer i en dansk dato skal findes, inklusive 23-/25-timersdage. Tidsstempler, enheder, intervalrækkefølge og udgivelsesdato valideres. JSON-pakke må højst være seks timer gammel, og den enkelte prognoseudgave højst 48 timer gammel. En dag uden korrekte tariffer udelades frem for at låne en anden dags satser.

## Sammenligning med Strømligning

Strømligning bruges alene i sammenligningsværktøjet med `forecast=true`. To modeller sammenlignes på samme 120 timeintervaller pr. område, 29. oktober–2. november 2026. Beløb nedenfor er totalpris inklusive moms og afgifter uden leverandørtillæg/abonnement.

| Prisområde | Timer | Elpriser + egne tariffer, middel | Strømligning, middel | Gennemsnitlig absolut forskel | Største absolutte forskel |
| --- | ---: | ---: | ---: | ---: | ---: |
| DK1 / N1 område 131 | 120 | 250,59 øre/kWh | 243,44 øre/kWh | 20,55 øre/kWh | 83,70 øre/kWh |
| DK2 / Radius | 120 | 263,54 øre/kWh | 261,30 øre/kWh | 21,34 øre/kWh | 100,27 øre/kWh |

**Dette måler modeluenighed, ikke prognosepræcision.** De faktiske markedspriser for timerne er endnu ikke kendt. Udbyderne kan opdatere på forskellige tidspunkter, og Strømlignings svar oplyser ikke en sammenlignelig modeludgivelse. Vi kan først måle faktisk fejl, når priserne offentliggøres; intet lighedskrav eller præcisionsløfte er udledt.

Resultat og timepar: `.tmp/price-forecast/comparison.json`. Sammenligningsværktøj: [compare-price-forecasts.mjs](../scripts/compare-price-forecasts.mjs). Tidligere kontrol af offentliggjorte priser er dokumenteret i [Energinet-skiftet](ENERGINET-PRICE-MIGRATION.md).

## Lagring og privatliv

Appen henter fra egen `/api/grid/lookup?operation=forecast`. Backend henter én fælles offentlig pakke for begge områder, højst én gang i timen ved aktiv brug, og genbruger den på tværs af netselskaber. Ingen adresse, navn, e-mail eller private forbrugsmålinger sendes til prognoseudbyderen; udbyderen modtager backendens netværksoplysninger. Ingen nøgle, betaling eller ny bruger-/providerkonto er nødvendig.

Migration [202610270004_energy_forecast_cache.sql](../supabase/migrations/202610270004_energy_forecast_cache.sql) tillader alene den ekstra nøgle `elpriser-v1:forecast` i den eksisterende serverbeskyttede offentlige kildecache. Originalpakke, modeludgave, udgivelsesdato og kildeangivelser arkiveres som særskilte versioner via de eksisterende låse-/gemmefunktioner. Officielle spotprispakker overskrives ikke af prognoser. RLS og RPC-rettigheder bevares; ingen private tabeller eller kryptering ændres.

## Kontrol og konkret aktivering

- Udviklingsmigration anvendt alene på `wsdomkzhnksyjrpxqfvn`. Rollback-kontrol af særskilt prognosenøgle, arkivering, afvisning af ukendte nøgler og bevarede adgangsrettigheder passerer.
- Fokuserede tests af egne tariffer/moms, bånd, negative værdier, gamle/ufuldstændige/dublerede data, sæsonværdier og prioritering af offentliggjorte timer passerer.
- Den faktiske graf er kontrolleret i Chrome ved 390 pixels: syv dage, offentliggjort i morgen, prognosemærkning, interval, valg af kl. 12 og åbning af kildeinfo. Syntetiske offentliggjorte priser/offentlig prognosefixture; ingen kundedata og ingen fysisk telefonkontrol.
- Preview `dpl_AZshmXc72pWo5ieeVbt7ZrZXmGpS`: READY, alle 378 kildehashes stemmer, dev-Auth verificeret, uændrede officielle DK1-/DK2-priser returnerer 192 punkter hver, nye prognoseopslag returnerer 120 timepunkter med bånd i hvert område.
- Produktionspakke i `.tmp/forecast-release/manifest.json`: kun `api/grid/lookup.mjs` samt de nye `src/services/price-forecast-core.mjs` og `src/services/price-forecast-server.mjs`. Baseline: `dpl_3zCw9iFtXkmi11sxMqnLR4SYmU8d`. Ingen anden lokal ændring medtages.
- TypeScript i rodprojekt og isoleret native-stage passerer. Produktionsplanen uden skrivning viser kun `202610270004_energy_forecast_cache.sql`.
- APK `dist/Huslyg-1.0.127.apk`: versionCode 128, 85.986.967 bytes, SHA-256 `a5edb54c3e71a602c7c72581533e690912624dbee4fc3e26aaf20e5aad9cc0d4`. 34 kildehashes/30 pakkede kodekilder, præcis bundlet kode, prognosemarkører, produktions-API og samme testcertifikat som 1.0.126 er verificeret. Ikke installeret; telefonen blev ikke fundet ved den seneste ADB-kontrol. Ingen commit eller push.

Efter særskilt produktionsgodkendelse anvendes kun migration 004 på `arkpfdsglgufnnukader`, og de tre filer udgives med Production-indstillinger. Preview må ikke promoveres med dev-indstillinger. Officielle priser, begge prognoseområder, produktions-Auth, adgangsafvisninger og kildehashes kontrolleres live. Derefter installeres den kontrollerede APK 1.0.127 med `install -r`, hvis den kendte telefon er tilsluttet. Ingen konto slettes, Auth-/nøgleindstillinger ændres eller mail sendes.

## Verificeret aktivering

- Production `dpl_2NgYSvjLN9ms8wVx52T8yR2HJp6R` er READY i fra1. Alle 378 kildehashes stemmer med den godkendte tre-filers pakke. Rollback-kilde: `dpl_3zCw9iFtXkmi11sxMqnLR4SYmU8d`.
- Begge produktionsdomæner returnerer officielle priser og særskilte DK1-/DK2-prognoser med timeopløsning og interval. Production-Auth er bevaret; forkert område afvises, og eksisterende konto-/sletteruter afviser manglende/ugyldigt token.
- Kun migration `202610270004_energy_forecast_cache.sql` anvendt på `arkpfdsglgufnnukader`. RLS og servicebegrænsede rettigheder er kontrolleret uden testskrivninger. Ingen private eldata eller Auth-/nøgleindstillinger ændret.
- APK 1.0.127, versionCode 128, installeret med `adb install -r` på den kendte Samsung SM-A576B. Installeret version og appstart verificeret; data bevaret. Fysisk grafinteraktion er ikke kontrolleret i denne installation.
- Dokumentation: `.tmp/forecast-release/production-verification.json`, `production-db-verification.json`, `installation.json` og `apk-verification.json`. Ingen commit eller push.

## Prognosens udseende – APK 1.0.128

Prognosesøjler vises nu som transparente konturer med små prikker. Den valgte søjle har en tynd lodret usikkerhedsmarkering med endestreger; skalaen inkluderer prognosebåndene, så markeringen ikke afskæres. Teksten med det numeriske fra/til-interval under prisen er fjernet. Prognosemærkning, indkøringsstatus, skærmlæserens intervaloplysning og negative prisers guldfarve bevares. Markørens betydning forklares under Om. SVG-komponenten er memoiseret, så øvrige søjler ikke skal gentegnes ved hvert valg.

Faktisk graf kontrolleret ved 390 og 320 pixels i Chrome: 24 prikkede søjler, én markør på den valgte time, ingen synlig intervaltekst og bevaret valg af time. Syntetiske offentliggjorte priser/offentlig prognosefixture. Root/staged TypeScript, Gradle og APK-pakkekontrol passerer. APK `dist/Huslyg-1.0.128.apk`, code 129, 85.988.711 bytes, SHA-256 `dbd334fba355cc775e5fac808219308307075884a42070810f743ca7f759c01c`; 35 kildehashes/31 pakkede kodekilder og samme testcertifikat som 1.0.127 verificeret. Installeret med data bevaret på den kendte Samsung; version og appstart verificeret, fysisk grafudseende ikke særskilt kontrolleret. Backend, cloudcron og database er ikke ændret. Ingen commit eller push. Beviser: `.tmp/forecast-design-release/`.

## Tydeligt prisspænd – APK 1.0.129

Prognosen vises nu som et lyst, prikket felt fra nedre til øvre prisbud med en tydelig vandret streg ved udbyderens median. Den kompakte forklaring viser “Muligt prisspænd” og “Bedste bud”; medianen betegnes ikke som et aritmetisk gennemsnit. Grøn, orange og rød følger fortsat brugerens eksisterende prisgrænser; negative priser bevarer guld. Offentliggjorte priser er uændrede. Denne visning erstatter prognosesøjlernes udseende fra 1.0.128.

Faktisk graf kontrolleret ved 320/390 pixels med offentlige prognosedata og syntetiske officielle priser: 24 intervaller, centrale markører, alle tre tærskelfarver, kompakt forklaring og valg af time. TypeScript og APK-kilde-/bundle-/signaturkontrol passerer. APK dist/Huslyg-1.0.129.apk, code 130, 85989447 bytes, SHA256 bd367d2814a4c68fc7a9d7d0d3ce2cf73921658d6d9f9ab4091beafd0636eda5. Samme testcertifikat som 1.0.128. Installeret med data bevaret på kendt Samsung; version og appstart verificeret. Fysisk grafudseende og bevægelser ikke særskilt verificeret. Ingen backend-, database- eller cronændring, commit eller push. Beviser: .tmp/forecast-range-release/.

## Enkel stribet prognose – APK 1.0.130

Efter brugerens ønske vises nu kun den centrale prognosepris som en normal søjle fra nul, med diagonale streger frem for prikker. Prisspænd, central markør og forklarende legend er fjernet; aksen skalerer kun efter de viste priser. Prognose/Ca.-mærkning, kilder/licens, grøn/orange/rød efter eksisterende prisgrænser samt negative guldsøjler bevares. Den underliggende prognosemedian er uændret; den omdøbes ikke til et aritmetisk gennemsnit. Officielle priser og cloudarkiv er uændrede.

Browserkontrol ved 320/390px, staged TypeScript, Gradle, 35 kildehashes/31 pakkede kodekilder, bundle og samme testsignatur passerer. APK dist/Huslyg-1.0.130.apk, code 131, 85988515 bytes, SHA256 42d133bdf755c1e31d55be6ad5666209b288384cd57c6ca902f4ed082ec89124. Installeret med data bevaret på den kendte Samsung; version og appstart verificeret. Fysisk grafudseende ikke særskilt verificeret. Ingen backend-/database-/cronændring, commit eller push. Beviser: .tmp/forecast-stripe-release/.

## Faster chart scrubbing - APK 1.0.131

PriceChart bar hold reduced from 300ms to 100ms for faster horizontal scrubbing; drag cancellation, haptics and vertical scroll behavior unchanged. Focused bar-scrub test, staged TypeScript, Gradle, source/bundle/signature checks pass. Installed dist/Huslyg-1.0.131.apk (code 132, SHA256 c03af8222bf5cca9326f3e80143f30e727a4d7076d96cdb72c263124fb5d5112) with data retained on known Samsung; version/start verified. Physical gesture feel unverified. No backend/DB change, commit or push.

## Faster chart scrubbing - APK 1.0.132

PriceChart bar hold reduced from 100ms to 50ms for faster horizontal scrubbing; drag cancellation, haptics and vertical scroll behavior unchanged. Focused bar-scrub test, staged TypeScript, Gradle, source/bundle/signature checks pass. Installed dist/Huslyg-1.0.132.apk (code 133, SHA256 3a7ca79805da9d040f558bf57dcf58104b640dabd558db634bd9691fd87998aa) with data retained on known Samsung; version/start verified. Physical gesture feel unverified. No backend/DB change, commit or push.

## Usage graph selection - APK 1.0.133

InteractiveEnergyChart bars now use one chart-wide Pressable for single-tap selection and a configured 50ms hold before dragging; parent captures active scrubs across bars. Post-drag taps suppressed to prevent accidental selection, haptics retained. Curves retain existing gesture behavior. Targeted actual-component browser checks pass for tap, hold/drag, subsequent tap and existing curve drag; React Native Web adds its own 50ms press-in delay, so browser timing is not native latency proof. Staged TypeScript, Gradle, 36 source hashes/32 packaged code sources, bundle and same-certificate checks pass. Installed dist/Huslyg-1.0.133.apk (code 134, SHA256 1a04bb7abd37fc949132a451aae03f05132ec4864a7812a609c1a30ab4d7a8eb) with data retained on known Samsung; version/start verified. Physical gesture feel unverified. No backend/DB change, commit or push.

## Flow/return temperature selection - APK 1.0.134

HeatingTemperatureChart now reuses useBarScrub with a 50ms hold, single-tap date selection, cross-point drag, selection haptics and scroll-offset/edge handling. Post-drag tap suppression retained; selecting a date updates both flow/return readings. Targeted actual-component browser checks pass for tap, configured hold/drag and tap after drag with synthetic monthly readings; browser press-in adds its own delay. Staged TypeScript, Gradle, 37 source hashes/33 packaged sources and bundle/signature checks pass. Installed dist/Huslyg-1.0.134.apk (code 135, SHA256 3b386646e7815683f54bb1be6d17b60a8892cec9b5a418163afce95f66727e09) with data retained on known Samsung; version/start verified. Physical gestures unverified. No backend/DB change, commit or push.

## All chart hold delays 25ms - APK 1.0.135

All chart long-press delays set to 25ms: PriceChart, InteractiveEnergyChart bars, HeatingTemperatureChart and HeatingUsageCard (previously300ms). Charts with immediate gestures retain those. Widget reordering holds unchanged. Four staged values verified; staged TypeScript, Gradle, 38 source hashes/34 packaged sources and bundle/signature checks pass. Installed dist/Huslyg-1.0.135.apk (code136, SHA256 68380dae3e28af451466d622123549a60bc65d3aec1c0f156d046960a6576769) with data retained on known Samsung; version/start verified. Physical gesture feel unverified. No backend/DB change, commit or push.

## Heat charts always show whole period - APK 1.0.136

Removed larger-bars/larger-graph controls and zoom state from HeatingUsageCard and HeatingTemperatureChart. Both charts always size slots to the whole selected period; 25ms scrubbing and single taps retained. Staged TypeScript, Gradle, 38 source hashes/34 packaged sources and bundle/signature checks pass. Installed dist/Huslyg-1.0.136.apk (code137, SHA256 57063506fce7041478c25ec0b1f6c390e495dd96284012def605b4a8c0c4bf7e) with data retained on known Samsung; version/start verified. Physical chart appearance unverified. No backend/DB change, commit or push.
