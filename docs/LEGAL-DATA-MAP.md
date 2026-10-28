# Huslyg – teknisk datakortlægning

26. oktober 2026. Dokumenterer D02, D03, D04 og D06 i den juridiske tjekliste. D06 er suppleret med ejerens bekræftelse af administratoradgang. D01 (samlet behandlingsfortegnelse) er påbegyndt, men ikke afsluttet: behandlingsgrundlag, godkendte opbevaringsfrister, leverandøraftaler og overførsler skal fortsat afklares.

## Grundlag og afgrænsning

Read-only gennemgang af kode, migrationer og eksisterende release-dokumentation. Ingen persondata, hemmeligheder, fakturaer eller databaseindhold er hentet. Dette er en teknisk beskrivelse af behandlingen, ikke en ny RLS-test, penetrationstest eller juridisk godkendelse.

Android-kandidaten bygger fra `.tmp/property-model-apk-release/`, som adskiller sig fra noget nyere lokal kode. Forskellen i forbrugsimport nedenfor er kontrolleret direkte. Eksisterende web og backend har særskilte releasegrundlag; detaljer fra et nyere lokalt modul må ikke automatisk beskrives som offentligt udgivet.

## D02 – konto, profil og familie

| Data / formål | Kilde og teknisk lagring | Adgang / modtagere | Sletning og udeståender |
| --- | --- | --- | --- |
| Mail, bruger-ID, bekræftelse og login-session til adgang til appen | Supabase Auth; session persistéres gennem `resilientStorage(AsyncStorage)`, automatisk token-refresh. | Kontohaver, Auth-tjenesten og relevante autoriserede backend-/driftsroller. | Logout er ikke kontosletning. Komplet sletning og godkendt session-/logopbevaring afventer R03–R07/L05. |
| Navn, adresse, koordinater, adresse-ID, netselskab og personlige præferencer | `StoredProfile`, brugerafgrænset AsyncStorage og `user_metadata.home_profile`; ældre lokal profilnøgle findes fortsat med kontrol før adoption. | Kontoen; backend kan behandle ikke-vault-krypteret profilmetadata. | Ingen samlet automatisk slettefrist dokumenteret her. Ældre lokale felter og backfill skal med i sletteflowet. |
| Husstands-ID, navn, medlem og rolle | `households`, `household_members`; valgt hjem gemmes lokalt pr. bruger. | Medlemmer via autoriserede forespørgsler; service-only management på backend. | Medlemsfjernelse og husstandens livscyklus skal håndteres separat fra kontosletning. |
| Fælles boligprofil | `households.home_profile`; servicefilter tillader adresse, adresse-ID/koordinater, kommune/postnummer, netselskab og affaldskalenderlink. `bindSharedHome` lægger fælles felter over medlemmets personlige profil. | Husstandens medlemmer. Eget navn/mail bliver ikke erstattet af ejerens navn/mail via dette filter. | Fælles data er ikke private for en enkelt person i husstanden. Eksport/sletning skal respektere andre medlemmers rettigheder. |
| Invitationsmail, inviterende bruger, husstand, oprettelse/udløb, accept og leveringstilstand | `household_invitations`; normalisering af modtagermail, standardudløb 7 dage. Levering via backendens Resend-adapter, når afsender er konfigureret. | Inviterende/admin, tiltænkt verificeret modtager samt mailleverandør ved faktisk afsendelse. Mail indeholder inviterendes navn og husstandslink; det er persondata. | Udløb er en adgangsbetingelse, ikke dokumentation for fysisk sletning efter 7 dage. Oprydningsfrist og mailleverandørens retention mangler. |
| Notifikations-/widget-/prisvalg | Personlige profilfelter og lokale bruger-/husstandsafgrænsede indstillinger. | Bruger, enhed og relevant synkronisering. | D05 skal samle lokale notifikationsidentifikatorer, systemadgang og øvrige caches. Teknisk tilladelse er ikke samtykke til reklamer. |

Kilder: [supabase.ts](../src/services/supabase.ts), [storage.ts](../src/services/storage.ts), [sessionshook](../src/hooks/useHouseholdSession.ts), [familieservice](../src/services/family-server.mjs), [familiemigration](../supabase/migrations/202610240001_family_access.sql).

## D03 – eldata og afledte oplysninger

| Data / formål | Kilde og teknisk lagring | Adgang / modtagere | Begrænsninger |
| --- | --- | --- | --- |
| Tilknytning, autoriserede målepunkter og historisk forbrug | Eloverblik-tilslutning og import; husstandsafgrænsede vault-data og `electricity_period_records`. | Bruger/enhed, Eloverblik som datakilde, autoriseret backend og husstandsmedlemmer efter adgangsmodellen. | Fuldmagt/forbindelse og den valgte integration skal gennemgås kontraktuelt under E01/E02; dette dokument dokumenterer ikke ny rigtig tilslutning. |
| Timevektorer, datoer, fuldstændighed/kvalitet, målerrelation og importstatus | Krypteret payload i `hour/YYYY-MM-DD`, `state/import` samt periode-/summeringsrecords; krypterede lokale cachekopier. | Dekrypteres i oplåst klient. Backend og nøgleadgang beskrives under D06. | Den aktuelle APK-kildes import anmoder om **Hour**. Nyere lokal rod-kode anmoder om **Actual**, men den ændring er ikke medtaget i ikonopdateringen. Gemte timeværdier dokumenterer ikke oprindelige kvartersintervaller. |
| Års-/måneds-/dagsoversigter og priser | Gemte forbrugsrecords samt reproducerbare beregninger, elaftalehistorik og relevante pris-/tarifdata. | Klient/husstand og backendens lagring. | Ingen ubegrænset retention eller fuld historisk datadækning er fastlagt her. Gamle krypterede revisioner kan stadig findes. |
| Basisforbrug, time-/ugedagsmønstre og andel i billige timer | Afledt fra gemte målinger; prisandel kræver tilstrækkelige historiske spotpriser. | Vises som person-/husstandsrelaterede indsigter. | Adfærdsmønstre er også personoplysninger, selv når beregningen er lokal. Beregning af et mønster er ikke bevis for apparatidentitet eller tilstedeværelse. D07–D09 vurderer formål/grundlag, nødvendighed og risiko. |
| Spotprisarkiv og netselskabsgrundlag | Fælles markedsprisarkiv samt adresse-/målerbaseret netselskabsvalg og manuel overstyring. | Markedspriser er fælles data; koblingen til konto/måler/adresse er personhenførbar. | Prisområde og netselskab er forskellige forhold. Et manuelt valg beviser ikke målerens faktiske tariffer. |

Kilder: [APK-importer](../.tmp/property-model-apk-release/src/services/electricity-history.ts), [nyere lokale importer](../src/services/electricity-history.ts), [vault og recordlager](../src/services/energy-vault.ts), [import-/arkivdokumentation](ELECTRICITY-HISTORY-IMPORT.md), [mønstre](ELECTRICITY-INSIGHTS.md), [netselskab](GRID-SUPPLIER-SETTINGS.md).

## D04 – bolig, billeder, plantegninger og modeller

| Data / formål | Kilde og teknisk lagring | Adgang / modtagere | Begrænsninger |
| --- | --- | --- | --- |
| Adresse, register-/bygningsoplysninger, grund og tagestimat | Adresse-/BBR-/geodatakilder, geometri og højdedata; adressebundet hukommelse og optional AsyncStorage-cache. Overblik dokumenterer 24 timers friskhed, hvorefter gammel cache kan blive vist under refresh/fejl. | Klient, de kaldte dataudbydere og backend. | En cachefriskhedsperiode er ikke en slettefrist. Offentligt tilgængelig ejendomsinformation er ikke nødvendigvis anonym. |
| Skråfotos, billedmanifest, retning, optagetid og markører | Fotoendpoints; native `cacheDirectory/home-photos-v2/` med JPEG/JSON og hukommelsescache. Modulgrænser på 20 MiB/80 filer med oprydning efter kapacitet. | Enhed, billedleverandør og relevant backend. | Kapacitetsbaseret eviction er ikke en fast retentionfrist. Ret til visning, caching og modeltræning skal vurderes særskilt. |
| Uploadede plantegninger | `property_documents`: husstand, adresse, dokument-ID, revision, filnavn, MIME, base64-payload og tidspunkt. Private PDF/JPEG/PNG gennem autoriseret backend. | Medlemmer efter adgangskontrol; backend og relevante privilegerede administratorer kan læse payload. | **Ikke vault-/ende-til-ende-krypteret.** Sletning nulstiller filpayload; revisions-/tombstone-metadata kan blive tilbage. Intet automatisk AI-træningsflow fra denne upload er dokumenteret. |
| Allerede gemte husmodeller | `property_models`: husstand, adresse, revision, payload, digest/størrelse, opdaterende konto og tidspunkt. | Medlemmer og autoriseret backend; komprimering/base64 er ikke kryptering. | 3D-funktionen er pauseret i brugerfladen; gamle modeller/data er ikke dermed slettet. Providerbilleder og modeldata skal med i slette-/rettighedskontrollen. |
| Lokale træningsmaterialer | Adskilte `side-projects` med lokale tasks, labels og modeller. | Lokal udviklerproces og eventuelle konfigurerede AI-/billedudbydere. | Ikke kortlagt som automatisk kundetræning; dette dokument godkender ikke genbrug af kunders filer eller eksisterende tredjepartsbilleder. S03/D05/X01/X02 følger op på processer og udbydere. |

Kilder: [boligfunktioner](MIT-HJEM-SIMPLE.md), [overblikscache](../src/services/home-overview-cache.ts), [fotocache](../src/services/home-photo-cache.ts), [dokumentmigration](../supabase/migrations/202610230001_property_documents.sql), [modelmigration](../supabase/migrations/202610200001_property_models.sql), [pauserede funktioner](LEGAL-RELEASE-DECISIONS.md).

## D06 – hvem kan læse/dekryptere hvad?

Ejeren har 26. oktober 2026 svaret **“Kun mig”** på, hvem der har administratoradgang til Vercel og Supabase. Der er derfor én oplyst intern menneskelig administrator: BluePeachs ejer. Ingen særskilt supportmedarbejder eller ekstern administrator er oplyst. Oplysningen er ejerbekræftet; team-/IAM-medlemslister er ikke uafhængigt auditeret.

| Aktør / lag | Mulig adgang |
| --- | --- |
| Oplåst autoriseret app | Dekrypterede eldata findes i hukommelsen. Sessionen og enhedens adgang skal beskyttes. |
| Medlem af samme husstand | Serverens medlemskontrol giver adgang til samme husstands records/nøgleflow. Familiedeling er ikke en særskilt anonymiseret kopi. |
| Backend med adgang til krypteringskonfiguration og database | Administrerede husstandsnøgler ligger som AES-256-GCM-wrappede envelopes i `energy_vault_managed_keys`. Backendkonfigurationen kan unwrappe dem ved autoriseret nøgleudlevering. Derfor er modellen **ikke server-blind/zero-knowledge**. |
| Databaseadgang alene | Krypterede forbrugs-payloads og wrappede nøgler er ikke i sig selv læselige som forbrug uden de relevante nøgler. Recordnøgler, husstandsrelationer, revisioner og anden metadata kan stadig være synlige. Profil, invitationsdata, dokumenter og husmodeller er ikke dækket af samme vault-kryptering. |
| Intern administrator / support | Ejeren er eneste oplyste interne administrator og varetager support. Den tekniske adgang afhænger af konto-/serviceprivilegier, nøgler og backend; der er ingen oplyst særskilt supportrolle. Dette er ikke et krav om løbende at åbne kundedata. MFA på Vercel, Supabase og login-konto er efterfølgende ejerbekræftet 26. oktober 2026, jf. [T04](LEGAL-ADMIN-ACCESS.md). Faktiske roller, mindst mulige tjenesterettigheder og adgangslogning er ikke dermed kontrolleret. |
| Platform-/driftstjenester | Vercel/Supabase og relevante tjenestekonti kan behandle data som led i hosting, database, Auth og backend. Ejerens ene administratorrolle gør ikke driften leverandørfri og er ikke en påstand om, at ingen leverandørmedarbejder kan få autoriseret supportadgang. Den adgang skal afklares i leverandøraftaler og support-/overførselsvilkår under L01–L04. |
| Lokal enhed | Krypterede vault-/recordcachekopier i AsyncStorage; relevante husstandsnøgler kan huskes i native SecureStore. Auth-session/profil har en anden opbevaringsmodel. Browserens og legacy-flowets nøgleopbevaring skal vurderes for de faktiske klienter. |

Grundlag: [managed-key-implementering](../src/services/managed-vault-key-server.mjs), [klientens vault](../src/services/energy-vault.ts) og den nyere managed-key-sektion i [krypteringsdokumentationen](../supabase/ENCRYPTED-ENERGY.md). Ældre beskrivelser om brugerholdt nøgle alene må ikke bruges som beskrivelse af det nuværende administrerede flow.

## Åbne dele af behandlingsfortegnelsen

- **D01/D07:** Endeligt grundlag pr. formål, ansvarlige roller og eventuelle interesseafvejninger.
- **D05 er efterfølgende afsluttet:** Se [inventar af tekniske data](LEGAL-TECHNICAL-DATA-INVENTORY.md). Faktisk leverandørretention, native initialisering, kontoadskillelse og nødvendige rettelser er stadig åbne under C01/C06/T02/L05/R07.
- **L01–L06:** Leverandørroller/aftaler, reelle regioner og overførsler inklusive support/backups, godkendte slettefrister samt implementeret oprydning.
- **R03–R09:** Ende-til-ende konto-/husstandssletning og eksport, inklusive revisioner, tombstones, caches og allerede delte kopier.
- **T04:** Konkrete administrator-/supportrettigheder. Kryptografisk mulighed og organisatorisk tilladelse er forskellige ting.

D02/D03/D04/D06 afsluttes som kortlægning med ovenstående bevisgrænser. D06 kombinerer implementeret nøgleadgang med ejerens oplysning om én intern administrator. Det er ikke en godkendelse af nødvendighed, lovlighed, retention eller en udført IAM-/MFA-kontrol; T04 og leverandørpunkterne forbliver åbne.
