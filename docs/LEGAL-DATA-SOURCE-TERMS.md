# Datakilder – kontrollerede vilkår og rester

> 27. oktober 2026 – aktiveret: Den godkendte Energinet-backend og webklient er nu i produktion. APK 1.0.126 bruger samme nye kilde, men er endnu ikke installeret; ældre APK-versioner kan fortsat kontakte Strømligning direkte. Ny trafik: app/web → Huslygs backend; backend → Energinet med serverens netværksoplysninger, uden private målinger eller adresser. Strømligning beholdes kun til sammenligning i den nye kildepakke. Nedenstående beskrivelser af direkte Strømligning-trafik er historik for den hidtidige version. Se [aktivering og evidens](ENERGINET-PRICE-MIGRATION.md).


27. oktober 2026. Supplerer E01/E03/E04/L02–L05. Dette er en kildevis vurdering, ikke en samlet godkendelse af alle datakilder.

## Energi Data Service

Afgrænsning: den aktuelle klientprisgraf henter ikke nødvendigvis dette datasæt direkte. `src/prices.ts` kalder `https://stromligning.dk/api/prices` og `/api/suppliers` fra klienten. Energi Data Service anvendes særskilt af `spot-price-archive.mjs` til det historiske arkiv. Energinets vilkår/IP-frist må ikke automatisk genbruges som Strømlignings vilkår eller opbevaringsfrist.

De officielle [vilkår](https://www.energidataservice.dk/terms-and-conditions) angiver CC BY 4.0 for portalens data med mulighed for kommerciel kopiering, ændring og distribution. Kilden skal krediteres, ændringer angives, og visningen må ikke antyde Energinets godkendelse. Prisarkivets kode bruger `Elspotprices` og `DayAheadPrices`, gemmer kildefeltet og normaliserer intervaller. Det understøtter arkivering/egen afledning under de dokumenterede vilkår, men konkrete produkt-/attributionsforhold skal matches med det viste datasæt og endelig UI.

Kreditering klar til datakildelisten: **Kilde: Energinet / Energi Data Service · CC BY 4.0. Tidsintervaller og enheder er tilpasset visningen.** Link kilde og licens; tillægsberegninger som afgifter er Huslygs egne relevante beregninger, ikke markedsdatasættets rå pris.

Vilkårene angiver også **3 måneders IP-opbevaring efter API-kald** til brugsstatistik. Afklar, om et konkret kald kommer direkte fra enheden eller backend; det er ikke nødvendigvis slutbrugerens IP, der modtages ved et serverkald. Det er ikke en frist for Huslygs private forbrugsarkiv.

Koden er gennemgået for kildefelter og normalisering; der er ikke publiceret en ny kildevisning i denne dokumentationsopfølgning. E03 omfatter fortsat flere produkter og forbliver åben.

## Strømligning

Supplerende godkendt aktivering 27. oktober: En separat spotprognose fra Elpriser.dk er [aktiveret, licensafklaret som CC BY 4.0 og sammenlignet med Strømligning](PRICE-FORECAST-RELEASE.md). Kun offentlig prognose hentes via backend; ingen kundeadresser eller forbrug sendes til udbyderen. Kildeangivelse, ECMWF-attribution og modellens indkøringsstatus er med i APK 1.0.127. Ejeren har godkendt migrationen og den isolerede udgivelse; APK 1.0.127 er installeret. Dette ændrer ikke Eloverblik eller retten til at bruge andre datakilder.

Direkte query indeholder periode, netselskabs-/kundegruppe-ID, prisområde og forecastvalg. Udbyderen vil teknisk kunne modtage den anmodende enheds netværks-IP. Den kodevej sender ikke navn/mail eller personlige målinger i requestbody, men dette gør ikke IP/query-metadata anonyme. Kald til leverandørlisten er en anden kodevej fra selve prisperioden.

De konkrete aftale-/licens-/krediterings- og metadatafrister skal dokumenteres, herunder brug af beregnede totalpriser, tarif-/afgiftsbestanddele og forecasts. At prisarkivets rå Energinet-data har CC BY 4.0 betyder ikke automatisk, at alle Strømligning-afledninger har samme vilkår. Der er ikke ændret prisberegninger eller skiftet dataleverandør ved denne rettelse af dokumentationen.

**Konkret vilkår fundet 27. oktober:** [Strømlignings egen API-beskrivelse](https://stromligning.dk/artikler/elpris-api) angiver gratis adgang til ikke-kommercielle formål og kræver en aftale ved brug i et produkt, en tjeneste eller en intern virksomhedsløsning. Huslyg kan derfor ikke antage fri erhvervsmæssig brug alene ud fra et offentligt endpoint eller en gratis app. Ejeren er spurgt, om BluePeach allerede har aftalen; svaret er endnu ikke afklaret. Ingen aftale er indgået, leverandør kontaktet eller betaling foretaget. E03/L02 forbliver åbne for dette konkrete forhold. Strømlignings pris-/tarifvisning er separat fra Eloverbliks personlige måledata og Energi Data Service-arkivet.

## Eloverblik

Officielle [tredjepartsvilkår](https://energinet.dk/media/xqddgox1/vilk%C3%A5r-til-eloverblik-tredjepart.pdf) er fundet. Det dokumenterer tilstedeværelsen af vilkår, ikke BluePeachs egen tiltrædelse eller produktionsgodkendelse til enhver kodevej. De faktisk anvendte kundevendte/native og tredjepartsflows skal afstemmes med aftalen og fuldmagterne. Ingen ny ret til generel kundedata-træning udledes heraf. E01 forbliver åben.

## Geodata og billeder

Klimadatastyrelsens [skråfotoside](https://www.klimadatastyrelsen.dk/kortlaegning/skraafotos) beskriver tilgængelighed som frie data og praktiske anvendelser. Det er ikke alene en fuld licens-/attributionsvurdering af alle billedprodukter, serverthumbnail, ortofoto eller egne afledninger. Match hvert produkt med den konkrete licens/version og kreditering.

For BBR, matrikel/geometri og DHM/LiDAR resterer konkrete produktvilkår og korrekt attribution. Ejerens bekræftede dokumentation for EDC-/mæglerbilleder skal forbindes med præcise aktiver og tilladt visning/ændring/kommerciel brug/træning; ingen ny overførsel til AI er foretaget.

## Supabase og Vercel

Den officielle [Supabase-underdatabehandlerliste](https://supabase.com/legal/subprocessor-list/October-12-2026.pdf), dateret 12. oktober 2026, er gennemgået. Den angiver blandt andet selskaber i USA/Singapore til support samt infrastrukturtjenester. Listen er leverandørens mulige modtagere, ikke bevis for at alle modtager Huslygs husstandspayloads. Den viser, hvorfor en EU-databaseregion alene ikke dokumenterer fravær af tredjelandsoverførsel.

Vercels officielle underleverandørindgang leder til trust center. Den fulde anvendelige liste er ikke dokumenteret gennemgået her. Ejerens DPA-accept er registreret; konkret dækning, modtagere, placeringer og overførselsvurdering er stadig åbne under L02–L04. Der er ikke tilmeldt nyhedsbrev eller sendt data til en AI-funktion på leverandørsiderne.
