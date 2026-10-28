# Leverandører, overførsler og opbevaring

> 27. oktober 2026 – aktiveret: Den godkendte Energinet-backend og webklient er nu i produktion. APK 1.0.126 bruger samme nye kilde, men er endnu ikke installeret; ældre APK-versioner kan fortsat kontakte Strømligning direkte. Ny trafik: app/web → Huslygs backend; backend → Energinet med serverens netværksoplysninger, uden private målinger eller adresser. Strømligning beholdes kun til sammenligning i den nye kildepakke. Nedenstående beskrivelser af direkte Strømligning-trafik er historik for den hidtidige version. Se [aktivering og evidens](ENERGINET-PRICE-MIGRATION.md).


26. oktober 2026 · Arbejdsregister for L01–L07. Ansvarlig: BluePeachs ejer.

## Leverandørregister (L01)

Registeret samler modtagere fra dokumenteret kode-/releasegrundlag. Status “tilvalgt” eller “uafklaret” er ikke bevis for en konkret kundetransmission. Aktuel opsætning, aftaler og underleverandører skal afstemmes før publicering af privatlivspolitik.

| Leverandør/kilde | Funktion og mulige personoplysninger | Rolle/status og evidens |
| --- | --- | --- |
| Vercel | Hosting, API, request-/runtimeoplysninger; backend kan håndtere kundepayloads og nøgler | Aktiv hosting. Databehandler for relevante kundedata; visse egne konto-/tjenestedata kan have anden rolle efter aftalen. Ejeren har bekræftet accepteret DPA; konkret version/dækning ikke auditeret. |
| Supabase | Auth, profiler, medlemskab, invitationer, forbrug, nøglerelationer, dokumenter og driftslogs | Aktiv Auth/database. Ejeren har bekræftet accepteret DPA. Backendens nøglemulighed og ikke-vault-krypterede kategorier er kortlagt i datakortet. |
| Resend | Tiltænkt familieinvitation: modtagermail, afsender, inviterendes navn og link; leveringsmetadata | Valgt leverandør; aktivering og leverings-/accepttest er ikke dokumenteret færdig. DPA-accept er ikke omfattet af ejerens spørgsmål om Vercel/Supabase. |
| Energinet / Eloverblik | Autoriserede målepunkter, forbrug og måler-/netselskabsrelationer | Datakilde efter tilslutning; kundevendt/native og serverruter skal vurderes hver for sig. Ikke automatisk BluePeachs databehandler. Aftalegrundlag under E01. |
| Energi Data Service | Offentlige spot-/tarifdatasæt; forespørgselsmetadata hos tjenesten | Aktiv prisdatakilde, bl.a. `spot-price-archive.mjs`. Offentlige markedsværdier er ikke alene kundedata; requestlogs/kobling kan være det. |
| Strømligning | Direkte klientkald til `stromligning.dk/api/prices` og `/api/suppliers`; netværks-IP samt dato-/periode-, prisområde-, leverandør-/kundegruppe- og forecastparametre | Aktiv kilde til den aktuelle pris-/leverandørvisning i `src/prices.ts`, særskilt fra Energi Data Service-arkivet. Koden sender ikke navn/mail eller forbrugspayload i disse queries. Rolle, licens, eventuelle log-/metadatafrister og viderebrug skal afklares under L02–L05/E03; offentligt API er ikke automatisk licens eller anonym trafik. |
| Datafordeleren / Dataforsyningen / relevante registerejere | Adresse, BBR, matrikel/geometri, DHM/LiDAR, ortofoto/skråfoto efter relevant funktion; forespørgselsmetadata | Datakilder med selvstændige vilkår. Den præcise kilde og licens pr. produkt følger E03, ikke en generel antagelse om fri brug. |
| Affaldsleverandør / kommune | Adressebaseret affaldskalender og forespørgsler | Afhænger af kommune og integration. Ingen samlet kontrakt-/licensgodkendelse ved kilderegistrering. |
| DFF-EDB / Sønderborg Varme | Tilvalgt varmeintegration, kunde-/installationsrelation og nødvendige credentials | Serverkilde `heating-connection-server.mjs`; selvstændig aftale-/rolleafklaring nødvendig. Credentials er særskilt serverkrypterede. |
| Expo / Apple / Google / enhedens OS | Native biblioteker, distribution, valgte lokale notifikationer og eventuelle build-/installationsmetadata | Et bibliotek alene er ikke bevis for en ekstern modtager. Faktisk Expo-tjenestebrug og native Firebase-adfærd afventer C01/I04. Lokale notifikationer dokumenterer ikke brug af Expo Push Service. |
| Google Gemini / DeepSeek, Tesla og SmartThings | Eksperimentelle/pauserede integrationer; kode og eventuelle tidligere forbindelser findes | Ikke godkendt til generel kundetræning eller skjulte restkald. S03/T02/X02 skal håndtere faktisk resterende behandling. Ingen nye kundedata sendes i denne opgave. |
| Andre ejendomskilder, fx energimærke-/miljøtjenester | Kun hvis den konkrete funktion/rute aktiveres | Kodefund er registreret; præcist launch-scope og faktisk modtagerstatus skal afstemmes. Ikke automatisk aktive modtagere af alle kunders data. |

Kilder: [datakort](LEGAL-DATA-MAP.md), [teknisk inventar](LEGAL-TECHNICAL-DATA-INVENTORY.md), [scope](LEGAL-RELEASE-SCOPE.md) og kildefiler refereret derfra. Registeret lukker L01 som registreringsopgave; det lukker ikke aftale-, regions-, SDK- eller overførselskontrollerne.

## Aftaler og underdatabehandlere (L02)

Ejeren svarede “ja” på det samlede spørgsmål om accepterede Vercel-/Supabase-DPA'er og dokumentation for EDC-/mæglerbilleder den 26. oktober. Det registreres som bekræftelse af begge forhold, uden at udlede en bestemt aftaleversion, dato for accept eller licens til enhver brug.

- [Vercel DPA](https://vercel.com/legal/dpa): gennemgået offentligt; indeholder roller, underdatabehandling og overførselsmekanismer. Match konto/BluePeach og accepteret aftaleversion med faktisk brug.
- [Supabase DPA](https://supabase.com/legal/customer-resources/data-processing-addendum): den offentlige version angiver 1. august 2026 og henviser til underdatabehandlerlisten. Det beviser ikke, hvilken version brugerens konto er omfattet af.
- [Resend DPA](https://www.resend.com/legal/dpa): offentlig aftale fundet; ejeren har efterfølgende bekræftet kontoens tilladte brug og vilkår/DPA ved den særskilte aktiveringsgodkendelse. Afsenderen er konfigureret, og én kontrolmail er API-accepteret. Præcis version/dækning, regioner og faktisk invitationslevering/accept er fortsat særskilte.
- Gem aftalereferencer, acceptgrundlag og relevante underleverandørversioner i et privat leverandørarkiv. Kopiér ikke betalingsoplysninger eller nøgler til Git.

L02 forbliver åben for komplet rolleafklaring, dokumentation og relevante øvrige leverandører. Der er ikke indgået nye aftaler på ejerens vegne.

27. oktober: Supabases officielle underdatabehandlerliste fra 12. oktober 2026 er gennemgået; se [kildekontrollen](LEGAL-DATA-SOURCE-TERMS.md). Vercels fulde anvendelige liste er endnu ikke dokumenteret læst. Ejeren har særskilt bekræftet Resend-brug/vilkår/DPA og godkendt aktivering samt én kontrolmail. `resend` er nu bevaret i Preview og tilføjet Production ved ren metadataopdatering; `EMAIL_FROM` findes i Production. Aliasrettelsen er publiceret og hashverificeret. Cloud-nøgleværdien er ikke hentet. Efter særskilt godkendelse af en ny kontrolmail ved aktiveret receiving har ejeren bekræftet dens modtagelse. Den anvendte lokale send-nøgle afviser fortsat statusopslag; der er ikke udledt providerstatus eller bevis for en faktisk invitation. [Præcis udgivelses- og prøveafgrænsning](FAMILY-MAIL-AND-ERASURE-RELEASE.md). Komplet leverandørkontrol og faktisk invitationsaccept er fortsat åbne.

## Regioner og overførsler (L03/L04)

For hver aktiv leverandør udfyldes særskilt: database, dokumentpayloads, runtime, request-/authlogs, backups, support-/administratoradgang, modtagerland og underleverandører. Den tidligere dokumenterede Vercel-funktionsregion fra1 er ikke bevis for, at alle disse datalag er i EØS. Supabase-projektnavn/-ref er heller ikke en regionskontrol.

Ved relevant tredjelandsoverførsel skal faktisk modtager, mekanisme og eventuelt behov for supplerende foranstaltninger vurderes. Offentlige DPA'er indeholder kontraktmekanismer, men tilstedeværelsen af SCC-tekst dokumenterer ikke automatisk en færdig vurdering af det konkrete flow. Ingen generel “alt bliver i EU”-påstand må publiceres. L03/L04 står åbne.

Et metadataforsøg på at hente de to Supabase-projekters region/status via CLI kunne ikke afsluttes inden timeout, også ved ét genforsøg. Der er derfor ikke tilføjet en antaget databaseregion. Produktionsmigrationens schema-/ACL-metadata er læst separat og bekræftet; det dokumenterer ikke regioner, backups eller supportlande.

## Livscyklus og frister (L05–L07)

Tabellen er en beslutnings-/implementeringsplan. Tal markeret “forslag” er interne forslag, ikke lovkrav, accepterede leverandørfrister eller igangsat sletning.

| Kategori | Nødvendigt formål / periodekriterium | Mangler |
| --- | --- | --- |
| Privat forbrugsarkiv og årsoversigter | Al tilgængelig historik til egne historiske dage/timer og årssammenligning under brugerens arkivtjeneste | Konto-/husstandsophør og løbende nødvendighed. Ingen 12-/24-månedersbeskæring. |
| Konto/profil og medlemskab | Aktiv konto/adgang; håndteres ved ophør og rettighedsanmodning | Endelig kontosletnings-/ejerskifteproces og dokumenterede undtagelser. |
| Invitationer | Gyldig invitation højst nuværende 7 dage; dette er ikke slettefrist | Forslag: fjern uaccepterede invitationsdata senest 30 dage efter udløb/revokering, med særskilt begrænset misbrugsbevis hvis nødvendigt. Ikke godkendt/implementeret. |
| Plantegninger | Brugerens valgte private husstandsarkiv til fjernelse/ophør | Tombstone-/revisionsmetadata, øvrige beboeres rettigheder og backupfrist. |
| Rettede målerecords/revisioner | Konkrete fejlrettelser og gendannelse | Nødvendig revisionsdybde og ophør særskilt fra det oprindelige arkiv. |
| Request-/auth-/fejllogs | Nødvendig sikkerhed og diagnose | Faktiske leverandørprodukter/-planer, feltminimum, begrundet frist og adgang. Ingen opfundet standard på 7/30/90 dage. |
| Support-/rettighedssager | Besvarelse og nødvendig dokumentation | Godkendt kortest nødvendig periode med eventuelle konkrete retlige undtagelser. |
| Nøgler og provideradgang | Kun nødvendig adgang og gendannelse under aktivt relevant flow | Afkobling, sessioner, revokering og afsluttede konti. Ikke alle tokens påvirkes af app-logout. |
| Backups | Gendannelse efter fejl/hændelse | Faktiske leverandørfrister, adgang, maksimal restopbevaring og kontrol af tidligere sletninger ved restore. |

L07 er nu afsluttet som [intern inaktivitets-/afviklingsprocedure](LEGAL-SERVICE-CLOSURE.md): ingen automatisk inaktivitetslukning, og mindst 60 kalenderdages praktisk eksportvarsel ved almindelig planlagt afvikling. Det tidligere forslag om 30 dage erstattes af denne interne driftsregel; ingen bruger er varslet. Fuld eksport og konkret, særskilt godkendt slette-/ophørsplan er stopkriterier før faktisk udførelse. Reglen er endnu ikke publiceret som aftalevilkår.

L05/L06 forbliver åbne for konkrete frister og samlet teknisk efterlevelse. L07's planlægningsopgave er afsluttet; den lukker ikke eksport-, slette- eller restorekontrollerne. Backup-/oprydningskode kræver fortsat konkret afgrænsning og relevant godkendelse med syntetisk kontrol. Ingen kundedata, profiler, fotos eller historik er slettet i denne dokumentationsopgave.

Kilder kontrolleret 26. oktober 2026: leverandørernes officielle DPA'er ovenfor og [Datatilsynet om sletning](https://www.datatilsynet.dk/regler-og-vejledning/behandlingssikkerhed/sletning).
