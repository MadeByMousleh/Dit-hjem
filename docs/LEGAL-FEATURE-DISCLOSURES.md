# Funktionstekster, datakilder og betingede krav

26. oktober 2026 · Arbejdsgrundlag for E01–E07, F01–F07 og C01–C06.

## Eloverblik (E01/E02)

Nuværende kode indeholder kundevendte/native forbindelsesforløb og serverruter; tilstedeværelsen af en ThirdParty-API-beskrivelse beviser ikke aftale eller produktionsgodkendelse til alle disse flows. E01 afventer det faktisk anvendte aftale-/fuldmagtsgrundlag. Gem ikke provideradgangskoder eller tokens som dokumentation.

E02 er efterfølgende implementeret og pakket i [test-APK 1.0.125](ELOVERBLIK-DATA-INFORMATION.md): historiske data, gemte målepunkter, vej til at fjerne egen fuldmagt hos Eloverblik og adskillelse fra arkivsletning. Ingen lokal frakobling foregives, når man alene åbner providerens side. UI og pakke er kontrolleret; faktisk fuldmagtsfjernelse, efterfølgende provideradfærd og fysisk enhed er særskilte og ikke testet på kundedata.

## Kilder og brugsret (E03/E04)

| Produkt | Kode-/datakilde | Skal dokumenteres før godkendelse |
| --- | --- | --- |
| Spot-/tarifarkiv | Energi Data Service-datasæt via `spot-price-archive.mjs`; faktisk valgt datasetversion | Konkrete vilkår, datakildeangivelse, pris-/tarifprodukt og kommerciel genbrug/cache. |
| Adresse og BBR | Datafordeleren og relevant adressekilde | Det konkrete register/produkt og licens, attribution, tilladte person-/adresseopslag og caching. |
| Matrikel/geometri | Datafordeleren / GEODKV og konkret matrikelprodukt | Rettighedshaver, licens, visning og viderebrug for hvert lag. |
| DHM/LiDAR | Datafordelerens DHM/WCS-/fildownloadprodukter | Produktversion, vilkår og kreditering; datalevering er ikke generel garanti for enhver analyse. |
| Orto-/skråfoto | Dataforsyningens foto-/thumbnail-/kortprodukter | Licens og korrekte krediteringer for original, beskæring, cache og afledninger. |
| Mæglerfotos/plantegninger | EDC eller den konkrete rettighedshaver/uploader | Ejeren har bekræftet dokumentation findes. Arkivér privat reference og kontroller om retten omfatter visning, kommerciel brug, ændringer og eventuel træning hver for sig. Ingen samlet træningslicens udledes af “ja”. |

E03/E04 er åbne for konkret kontrol. At data kan hentes med en nøgle er ikke i sig selv en brugsret. Skjulte forsøgsfunktioner eller eksisterende lokale filer må ikke automatisk blive marketingmateriale.

## Uploadvilkår og indsigelser (E05)

Tekst klar til uploadvisningen: “Upload kun en plantegning, du har ret til at gemme og dele med din husstand. Undgå unødvendige personoplysninger. Vi bruger filen til at opbevare og vise den i dit hjem i Huslyg – ikke til generel AI-træning. Spørgsmål eller indsigelser: info@huslyg.dk.”

Behandlingsretten skal være begrænset til nødvendig lagring, teknisk håndtering og valgt privat visning/deling. Brugeren giver ikke en ubegrænset overdragelse af ophavsret. Ved en begrundet indsigelse skal ejeren verificere relationen, vurdere berørt indhold og begrænse adgang/fjerne, hvor nødvendigt, med hensyn til berørte parter. Ingen automatisk massefjernelse foretages. E05 er efterfølgende implementeret i APK 1.0.123 med rettigheds-/persondata-/formålsinformation og indsigelseskontakt; endelige samlede vilkår er fortsat V01.

## Målinger, priser og påstande (E06/E07)

Baseline er et beregnet estimat ud fra målinger, ikke et målt apparatforbrug. Tagareal/-hældning er omtrentlige beregninger, ikke opmåling med garanti. Historisk forbrug skal ledsages af reel tilgængelig dato, enhed og datamangler. Spotpris og samlet brugerpris er forskellige: nettariffer, afgifter, moms og eventuelle leverandørbestanddele skal være tydelige; negativ spotpris betyder ikke nødvendigvis negativ samlet pris.

`electricity-price-share.mjs` sammenholder komplette forbrugsdage med komplette timepriser for DK1/DK2. Kvarterpriser vægtes til timer; billige/dyre timer kategoriseres ud fra dagens prisfordeling, med særskilt håndtering af ens priser. Målet er andel **kWh**, ikke andel tid eller garanteret sparebeløb. Algoritmen hedder `daily-hourly-spot-quartiles-v1`; den er ikke brugerens manuelle prisgrænser i spotwidgetten.

Besparelsespåstande kræver en realistisk flytbar mængde, valgt alternativperiode og korrekte prisbestanddele. Regn ikke hele husholdningens forbrug som frit flytbart. En prisgraf dokumenterer hverken oprindelsen af en bestemt kundes strøm, en faktisk grøn andel eller en personlig CO₂-besparelse. E07 afventer konkret datakilde/metode før sådanne påstande; ingen procentsats opfindes.

Fokuserede lokale kontroller 26. oktober: `test-electricity-baseline.mjs` og `test-electricity-price-share.mjs` passerer. Det er beregningskontrol med syntetiske data, ikke fysisk/live verifikation af alle viste priser eller E06-godkendelse.

## Familie og påmindelser (F01–F07)

F01-tekst klar til inviterende og modtager: “I deler hjemmets boligoplysninger, forbrug og fælles plantegninger. Hver person beholder sin egen konto og identitet. Navn og mail vises i familiens medlemsoversigt. Fjernelse stopper adgang til hjemmet; kopier, som allerede er hentet eller delt uden for appen, kan ikke trækkes tilbage.” Aktuel UI siger kun “fælles data” og skal præciseres; F01 er åben.

F02-kildekontrol: invitation har 7 dages gyldighed; verificeret tiltænkt mail, eksplicit accept og leveringsstatus kontrolleres i SQL; service-only management, rollekrav, resendgrænse og husstandsgrænse findes. Node-testen `test-family-server.mjs` passerer for aktørbinding, rollefejl og håndtering af mailfejl. SQL-testfilen findes, men er ikke kørt mod en database i denne opgave. F02 forbliver åben for samlet verificeret kontrol af endelig release.

Opfølgning 27. oktober: F01 er implementeret i begge klientvisninger i APK 1.0.123, og F02 er afsluttet for de afgrænsede server-/dev-SQL-kontroller; se [implementeringsrapport](ACCOUNT-PRIVACY-IMPLEMENTATION.md). Det tidligere udsagn ovenfor om ikke-kørt SQL beskriver den oprindelige 26. oktober-kontrol.

F03: servermedlemskab fjernes, men det dokumenterer ikke fjernelse af alle lokale kopier, nøgler eller offlineadgang. F03 er åben. F04: invitationen er funktionel uden belønning/reklame, men komplet non-user information, spamvurdering, uønskede gentagelser og retention mangler; grundlagsudkast findes under D07. Den efterfølgende godkendte mailudgivelse bruger Huslyg-branding.

F05: Resend er efter særskilt ejerbekræftelse/godkendelse aktiveret i Production, og mailrettelsen er udgivet. Én mærket kontrolmail til info@huslyg.dk er API-accepteret, uden oprettelse af invitation/adgang. Send-nøglen kan ikke hente leveringsstatus. Efter aktivering af receiving godkendte ejeren endnu én kontrolmail og bekræftede modtagelsen 27. oktober 2026. Den direkte kontrolmail benyttede eksisterende lokal nøgle og Production-afsender, ikke en aflæst cloud-nøgle. F05 er fortsat åben for endelig domæne-/leveringskontrol og faktisk produktionsinvitation/accept. [Udgivelse og bevisgrænser](FAMILY-MAIL-AND-ERASURE-RELEASE.md).

F06-kildekontrol: `useWasteReminder` har standard fravalgt; OS-tilladelse efter brugerens aktivering og ikke ved almindelig indlæsning. Indstillinger har fravalg og angiver beregning fra kl. 07 på tømningsdagen samt varierende faktisk afhentningstid. DashboardScreen anmoder ligeledes først om pris-/budgettilladelse ved brugerens aktivering; ProfilePage har til-/fravalg. Planlægnings-/DST-tests passerer. Disse fire kildefiler matcher den isolerede APK-kandidat ved SHA256-kontrol. **F06 afsluttes for kontekst, fravalg og antaget tidspunkt.** Fysisk levering og samlet notifikationssikkerhed er særskilt under N01/T02/DPIA og ikke verificeret her. Endelig release skal fortsat bevare denne adfærd under LANC03.

F07: markedsføring via mail/push er fravalgt i første udgivelse, jf. ejerens bekræftede scope. **Ikke relevant for dette scope; afslut som betinget vurdering.** En senere reklamefunktion skal genåbne F07 og kræver selvstændig vurdering/gyldigt samtykke før brug. OS-tilladelse og accept af privatlivstekst må ikke genbruges som markedsføringssamtykke.

## Enhedslagring og tracking (C01–C06)

| Teknologi | Kendt formål | Konklusion / rest |
| --- | --- | --- |
| Login-session i AsyncStorage | Vedvarende adgang til privat konto | Funktionelt formål; sessionsbeskyttelse under T02 er fortsat åben. Nødvendigt formål er ikke det samme som tilstrækkelig sikkerhed. |
| Lokale profil-/widgetvalg og krypteret cache | Brugerens indstillinger og historisk visning | Afgræns nødvendighed og varighed pr. konkret nøgle. Budget på cache er ikke opbevaringsperiode. |
| SecureStore-nøgler | Brugerens valgte oplåsning/gendannelse | Skal beskrives efter faktisk platform/flow; ikke en garanti for alle kategoriers kryptering. |
| Lokale påmindelser | Udtrykkeligt valgt servicefunktion | Telefonens tilladelse er særskilt fra cookie-/GDPR-/reklamegrundlag. |
| Firebase/FCM/referrer og øvrige native SDK'er | Manifestkomponenter fundet; ikke bevis for aktiv analyse-/reklameupload | Faktisk Android-/iOS-adfærd skal afklares. Ingen “vi sporer aldrig”-påstand eller N/A-afkrydsning før kontrol. |

C01/C02 er åbne for samlet enheds-/netværkskontrol og konkret nødvendighedsklassifikation. C03/C04 kan først afsluttes som ikke relevante, hvis der dokumenteres fravær af samtykkekrævende teknologier; ellers kræves blokering og valg før aktivitet. Der tilføjes ikke et tomt banner for at skjule uafklaret adfærd.

C05: [formåls-/dependencyvurdering afsluttet 27. oktober](LEGAL-NEXT-TEN.md): ingen valgt annoncekobling/datamæglerdeling eller direkte annonce-SDK identificeret. Faktisk iOS-binær og SDK-adfærd er fortsat separate åbne I04/C01/I03-kontroller. Nye trackingforhold genåbner C05 før aktivering. Apples definition er ikke identisk med dansk/EU-sporingsregulering.

C06: plantegninger bruger systemfilvælger med MIME-/størrelsesgrænser. Fotoguide/kamera er et andet flow og må ikke begrunde alle tilladelser i en udgivelse, hvor funktionen er pauseret. APK-inventaret har bl.a. ældre lager-/overlay-/kameraerklæringer. Fjernelse kræver faktisk manifest-/buildkontrol og iOS-sammenligning; konfigurationen ændres ikke blindt i denne dokumentationsrunde.

Kilder kontrolleret 26. oktober 2026: [Digitaliseringsstyrelsen – apps](https://digst.dk/tilsyn/sporingsteknologiomraadet/vejledninger-til-tjenesteudbydere/huskeregler-for-app-udbydere/), [Apple – tracking og ATT](https://developer.apple.com/app-store/user-privacy-and-data-use/), [Forbrugerombudsmanden – spam](https://forbrugerombudsmanden.dk/alle-emner/uanmodede-henvendelser/uanmodede-elektroniske-henvendelser-spam). Juridisk anvendelse på Huslyg er projektets vurdering; ingen generel tilladelse til enhver invitationsmail udledes af kilderne.
