# D05 – tekniske data, logs, caches, sessioner og SDK'er

> 27. oktober 2026 – aktiveret: Den godkendte Energinet-backend og webklient er nu i produktion. APK 1.0.126 bruger samme nye kilde, men er endnu ikke installeret; ældre APK-versioner kan fortsat kontakte Strømligning direkte. Ny trafik: app/web → Huslygs backend; backend → Energinet med serverens netværksoplysninger, uden private målinger eller adresser. Strømligning beholdes kun til sammenligning i den nye kildepakke. Nedenstående beskrivelser af direkte Strømligning-trafik er historik for den hidtidige version. Se [aktivering og evidens](ENERGINET-PRICE-MIGRATION.md).


26. oktober 2026. **D05 afsluttet som teknisk kortlægning.** Opgaven dokumenterer hvad der findes, og hvad der stadig skal afklares/rettes i andre punkter. Den godkender ikke behandlingens grundlag, sikkerhed, nødvendighed eller opbevaring.

Efterfølgende opfølgning samme dato: De nedenfor beskrevne globale notifikationsnøgler er rettet i klientkoden med ejer-/husstandsafgrænset kø og logout-oprydning. [Implementering og kontrol](NOTIFICATION-ACCOUNT-ISOLATION.md). Inventarets oprindelige APK-grundlag er fortsat 1.0.121; native releasebevis for opfølgningen registreres særskilt.

## Grundlag

Aktuel opfølgning 27. oktober: [APK 1.0.123 og kontosletningsbackend](ACCOUNT-PRIVACY-IMPLEMENTATION.md) er leveret særskilt. Native Auth-sessioner har nu SecureStore-bundet kryptering; de fire overflødige tilladelser er fjernet og Firebase-auto-init/indsamlingsflag slået fra i APK. Nedenstående oprindelige 1.0.121-fund er historisk baseline, ikke en påstand om, at alle fejl fortsat findes i den nye APK. Web, andre enheder, iOS og øvrige sikkerheds-/retentionskontroller er fortsat særskilte.

Supplerende netværksfund: `src/prices.ts` bruger direkte Strømligning-kald med periode, netselskabs-/kundegruppe-ID, prisområde og forecastvalg. Modtageren kan dermed få enhedens netværks-IP og querymetadata. Dette er et andet flow end backendens Energi Data Service-arkiv; [kilder, vilkår og åbne metadatafrister](LEGAL-DATA-SOURCE-TERMS.md) og [leverandørregister](LEGAL-SUPPLIERS-AND-RETENTION.md) er opdateret. Der er ikke fundet navn/mail/forbrugspayload i denne prisquery, men “offentlig pris” er ikke ensbetydende med anonym forespørgsel.

- Lokal kildekode, direkte afhængigheder/lockfil, native manifest og ressourcer fra den faktiske APK `dist/Huslyg-1.0.121.apk` (code 122).
- Syv centrale filer er hash-sammenlignet med den isolerede APK-kilde og er identiske: Supabase-klient, cachepolitik, elnotifikationer, varmeintegration/-hook og affaldspåmindelser/-navigation. Evidence: `.tmp/legal-d05/source-comparison.json`.
- SDK-/logadfærd er sammenholdt med officielle leverandørkilder. Der er ikke læst produktionslogs, persondata, leverandørkonti eller hemmeligheder, og ingen trafik er opsnappet fra en brugertelefon.
- Ingen app-/serverkode, database, kontoindstillinger eller eksisterende data er ændret. Ingen ny APK eller testmail var nødvendig.

## 1. IP, anmodninger og driftslogs

| Lag | Data der kan forekomme | Aktører og kontrolgrænse |
| --- | --- | --- |
| Vercel hosting/API | Tidspunkt, request-ID, host, sti, metode, status, region, user-agent og netværksmetadata; funktionernes egne stdout/stderr. Query-parametre kan indeholde adresser, koordinater eller andre identifikatorer. | Vercels logfunktion beskriver blandt andet søgeparametre, request paths og IP/user-agent-baseret filtrering. Faktisk logprodukt, adgang, eksport og opbevaring i vores projekt er ikke inspiceret. Logs er ikke automatisk anonyme, blot fordi vi undgår persondata i `console.log`. |
| Supabase Auth | Login/oprettelse, bekræftelse, token-refresh og logout; audit-events kan indeholde bruger-ID, IP og user-agent. | Supabase dokumenterer audit-logs og valg af databaselagring. Vi har ikke verificeret projektets logindstillinger eller påstået, at `auth.audit_log_entries` nødvendigvis anvendes. |
| Provider-/tredjepartskald | Afsenderens IP og requestmetadata kan behandles af den faktisk kaldte tjeneste. Backendkald har normalt serveren som netværksafsender; direkte klientkald har enheden/browseren som afsender. | Kontrolleres pr. integration; må ikke samlet beskrives som alle brugerens data til alle udbydere. Eloverblik, varme, geodata/billeder, prisleverandører og eventuel mail er relevante modtagere i deres respektive flows. |
| Udvikling/build | Lokale Metro/Gradle-/browserfejl og Vercel-buildlogs kan indeholde kode-/miljømetadata og fejl. | Buildlogs er særskilt fra slutbrugerens runtime-logs. Ingen buildtelemetri er her klassificeret som en installeret analysefunktion i appen. |

Kilder: [Vercel Runtime Logs](https://vercel.com/docs/logs/runtime), [Supabase Auth Audit Logs](https://supabase.com/docs/guides/auth/audit-logs), [Supabase Platform Audit Logs](https://supabase.com/docs/guides/security/platform-audit-logs). Opbevaring afhænger af konkret produkt/plan/konfiguration; ingen universel eller projektverificeret slettefrist fastlægges her.

## 2. Appens egne diagnostiske udskrifter

| Modul | Fundne felter / begrænsning |
| --- | --- |
| `addresses.ts` | Development-only diagnose med endpoint uden query, HTTP-status og content-type. Ikke rå adresseforespørgsel i denne udskrift. |
| `tesla.ts` | Development-only diagnose med API-base, status, content-type og indikator for HTML-respons. Det er ikke en optagelse af alle providerresponser. |
| `eloverblik-third-party-server.mjs` | Fast fejl-event ved bindingsfejl med fejlkode og boolsk indikator; kommentarer og implementering undlader kunde-/autorisationsnøgler, konto-ID'er og rå databasefejl. |
| `heating-connection-server.mjs` | Fast stage, HTTP-status, varighed og allowlistede transportfejlkoder; ikke credentials, rå svar eller hele fejlobjektet i den gennemgåede log. |
| `smartthings-server.mjs` | Fast event/stage og afgrænset numerisk status. Pauseret navigation deaktiverer ikke automatisk callback- eller serverbehandling; se S03. |
| `facade-analysis-server.mjs` | Providerstatus/kode, afgrænset årsag/stage og varighed. Ligger i den tilbageværende model-/analysebackend; er ikke bevis for, at brugernes plantegninger trænes automatisk. |
| Lokal server/3D-renderer | Lokal server skriver blandt andet lytteadresse; den pauserede renderer har også diagnostik. Lokale forsøgs-/serverprocesser og alle historiske logs er ikke gennemgået som produktionsdatabehandling. |

Dette er en kildekortlægning, ikke en garanti mod enhver utilsigtet logning. Hostingens requestlogs og allerede gemte historiske logs kræver deres egen adgangs-/retentionsafklaring under L05/T04.

## 3. Lokalt lager og sessioner

| Område | Data og placering | Teknisk levetid / opfølgning |
| --- | --- | --- |
| Auth-session | Supabase-klientens `persistSession: true` og `autoRefreshToken: true`, lagret via AsyncStorage-wrapper. På native er det ikke samme beskyttelse som SecureStore; på web er AsyncStorage browserbaseret. | Ingen generel tidsbaseret lokal oprydning dokumenteret. Skal vurderes under T02; undgå at love, at alle tokens ligger i hardwarebeskyttet lager. |
| Personlig profil og ældre nøgler | Brugerafgrænset profil og præferencer; legacy-nøgler findes også. Adresse, koordinater og husstands-/bruger-ID'er er personhenførbare, også når de findes i cachekeys. | Konto-/husstandssletning skal håndtere gamle og nye nøgler. Logout er ikke dokumenteret som fuld sletning af alle lokale felter. |
| Krypteret vault og elrecords | Krypterede snapshots/perioderecords i AsyncStorage samt dekrypteret state i oplåst proceshukommelse. Nøgler/datoer/revisioner er metadata. | Perioders optional cachebudget er 12 MiB. Når budgettet er nået, kan nye optional skriverier afvises; dette er ikke en slettefrist for cloudhistorik eller eksisterende revisionspins. |
| Nøglehuskning | Native husstandsnøgle kan huskes i SecureStore med brugerautentifikation og this-device-only-adgang; browserens legacy/husk-flow bruger `localStorage`. Administrerede nøgler fås via autoriseret serverflow. | Weblager og native SecureStore er forskellige modeller. D06/T04 skal omfatte faktisk adminadgang; R03–R07 skal omfatte nøgle-/sessionshåndtering ved sletning/fjernelse. |
| Offentlige pris-/historikcaches | AsyncStorage under `stromblik.public-prices.v1.*` og `stromblik.public-history.v1.*`; samlet optional budget 2 MiB. Prisfriskhed bl.a. 15 minutter. | Kun allowlistede optional data kan evikteres. Friskheds-TTL er ikke nødvendigvis fysisk sletning. Ingen `AsyncStorage.clear()` bruges som denne cachepolitiks oprydning. |
| Boligoverblik/-detaljer | Hukommelse og optional AsyncStorage; 24 timers friskhed for relevante detaljer. Overblikskey indeholder bruger/husstand/adresse. | Ordet `public-history` i et keynavn gør ikke koblingen anonym. Dette skal med i eksport/sletning. |
| Billed-/modelcache | Native cachemapper med manifests og billeddata; kendte grænser er beskrevet under D04. Model-photo-cache har også adressebundet friskhed og kapacitetsgrænser. | Hverken kapacitetsgrænser, cachemappe eller 24-timers friskhed beviser en godkendt slettepolitik. |
| Server-/providerhukommelse | Genbrug af offentlige svar, providerresultater og sessionsafgrænsede valg kan ske i proceshukommelsen. | Proceslevetid er ikke en bindende retentionfrist. Godkendte frister og backup/log-håndtering afventer L05/L06. |

Kilder: [Supabase-klient](../src/services/supabase.ts), [cachepolitik](../src/services/local-storage-cache.mjs), [priser](../src/prices.ts), [vault](../src/services/energy-vault.ts), [boligcache](../src/services/home-overview-cache.ts), [fotocache](../src/services/home-photo-cache.ts), [model-photo-cache](../src/services/home-model-photo-cache.ts).

## 4. Varme: credentials og tekniske data

Den aktuelle klient sender relevante varmehandlinger og eventuelle indtastede credentials over HTTPS til det autentificerede `operation: heating`-endpoint. Backend lagrer credentials som et AES-256-GCM-envelope i `heating_connections`, afgrænset til konto/husstand og beskyttet med separat serverkonfiguration. Backend kan dekryptere credentials til provideropslag. Det må derfor ikke beskrives som et rent enhedslokalt SecureStore-flow.

Varmehistorik, kunde-/installations-/måleroplysninger og temperaturer gemmes i den eksisterende krypterede vault. Hookens indtastede password ryddes efter forsøget; det betyder ikke, at serverforbindelsen er slettet. Hooken kan tjekke forbindelse/opdatere på mount, app-foreground og browserfokus, når varmesiden anvendes. Frisk gemt historik kan begrænse gentagelser; det er ikke garanti for fravær af netværkskald.

Kilder: [private-heating.ts](../src/services/private-heating.ts), [varmehook](../src/hooks/useEforsyning.ts), [credential-/providerservice](../src/services/heating-connection-server.mjs). Providerkontrakt, sletning, faktisk adminadgang og opbevaring af credentials er stadig separate åbne punkter.

## 5. Notifikationer og enhedsmetadata

| Funktion | Data og fund |
| --- | --- |
| Affaldspåmindelse | Lokal præference under `stromblik.waste-reminder.v2.<user>.<home>` med legacy-fallback. Telefonen får titel, affaldstype/dato og payload med `kind`, bruger-ID, husstands-ID og destinationsfane. Ved tryk kontrolleres aktuel konto/husstand. Planlægning erstatter tidligere affaldsnotifikationer på enheden. |
| Elpris-/ladevinduebeskeder | Lokalt planlagte notifikationer, kind/day/identifier og destinationsfane. `scheduleKey(kind)` er baseret på global prefix + kind, ikke bruger/husstand. En pauseret Bil-fane stopper ikke nødvendigvis ladevindueplanlægning; se S03. |
| Budgetbesked | Beskedteksten kan vise forventet månedsforbrug og grænse i kWh/kr. Dedupekey er måned/enhed/grænse/niveau uden konto/husstand. Den er ikke en serverbaseret leveringskvittering. |
| Månedlig oversigt | Profilen indeholder opt-in/tidspunkt. En synlig indstilling er ikke dokumentation for, at månedlig levering er implementeret eller afprøvet. |
| Skærmlås / system | En planlagt notifikation ligger i operativsystemets beskedlager og kan vises på låseskærmen efter brugerens OS-indstillinger. Detaljer om forbrug kan dermed ses af andre ved telefonen. |
| Push-token | Ingen appkald til `getExpoPushTokenAsync` eller `getDevicePushTokenAsync` blev fundet i den gennemgåede kilde. Det er ikke en garanti mod native SDK-initialisering; se næste afsnit. |

Kilder: [affaldshook](../src/hooks/useWasteReminder.ts), [elnotifikationer](../src/services/low-price-alert.ts), [notifikationsnavigation](../src/hooks/useNotificationNavigation.ts). **Konkret opfølgning:** kontoadskil globale schedule-/dedupekeys og afklar annullering efter logout/familiemedlemsfjernelse under T02/R07/F06. Ingen sådan rettelse er udført i denne dokumentationsopgave.

## 6. SDK'er, tilladelser og analyse

- Der blev ikke fundet direkte Sentry-, Google Analytics-, PostHog-, Amplitude-, Mixpanel- eller annonce-SDK-afhængigheder/init i de gennemgåede manifest-/package-/kildeområder. Dette er et afgrænset kildefund, ikke et løfte om nul telemetri hos alle afhængigheder/udbydere.
- Tesla-feltet `sentryMode` er en bilfunktion, ikke bevis for Sentry-fejlrapportering. `com.facebook.react` og Fresco er framework/billedkomponenter, ikke i sig selv Facebook-marketingintegration.
- Den færdige APK **indeholder FirebaseInitProvider og FirebaseMessagingService**, herunder Expo-notifications-service. Der er ingen eksplicitte FCM-auto-init-/Analytics-collection-flags i det gennemgåede manifest, og **ingen `google_app_id`-ressource blev fundet**. Bibliotekets tilstedeværelse må derfor hverken kaldes en verificeret aktiv upload af installations-ID'er eller ignoreres som beviseligt inaktivt.
- Googles dokumentation angiver, at FCM ved aktiv auto-init kan oprette/vedligeholde registreringer og kontakte Firebase, og at Firebase-installations-ID'er anvendes af FCM. Faktisk initialisering og konfiguration skal afklares under C01/C02 før butikssvar eller påstande om nul sporing.
- APK'en deklarerer bl.a. netværk, kamera, ekstern lagring, vibration, notifikationer, boot, wake-lock, biometrisk adgang, `SYSTEM_ALERT_WINDOW`, FCM-modtagelse, install-referrer og badge-tilladelser. Der blev ikke fundet en deklareret Advertising ID-tilladelse i den viste tilladelsesliste. Deklaration er ikke bevis for faktisk brug eller OS-bevilling.
- `SYSTEM_ALERT_WINDOW` og gamle brede lagerrettigheder er konkrete kandidater til nødvendighedskontrol/fjernelse under C06. FCM-/referrer-/badge-rettigheder skal vurderes ud fra deres faktiske native dependency og adfærd; de er ikke automatisk annoncer eller cookies.
- Den statiske production-kontaktside har ingen egne scripts/tracking. Den tidligere Vercel **Preview** havde et indsat feedback-script; det blev verificeret særskilt og var ikke i production-kontaktsidens kilde/respons. Det er ikke en audit af hele den fremtidige marketingforside.

Officielle SDK-kilder: [FCM-auto-init](https://firebase.google.com/docs/reference/android/com/google/firebase/messaging/FirebaseMessaging), [Firebase-installationer](https://firebase.google.com/docs/projects/manage-installations). Faktisk konsol-/retentionskonfiguration og en eventuel kontrolleret native trafikgennemgang er ikke udført her.

## 7. Åbne handlinger efter kortlægningen

| Punkt | Nødvendig opfølgning |
| --- | --- |
| T02 | Sessioners beskyttelse, kontospecifikke notifikationskeys, pauserede integrationers restkald og tidligere dokumenteret mail-DNS. |
| C01/C02/C06 | Transitiv/native SDK-adfærd og behov for sporingstilladelser; unødvendige manifestrettigheder. Ingen tom samtykkebanner indføres som erstatning for vurderingen. |
| D06/T04 | Faktiske administrator-/supportroller og adgang til logs, credentials og dekrypteringskonfiguration. |
| L05/L06 | Konkrete slettefrister for logs, sessions-/cachemetadata, invitationsrester og leverandørsystemer; adskil friskhed/eviction fra slettepolitik. |
| R03–R09/F06 | Samlet sletning, eksport og annullering; låseskærmstekst og servicebeskeder versus markedsføring. |
| D01/D07/P01/G04/I03 | Brug denne faktiske inventarliste i behandlingsfortegnelse, privatlivspolitik og butikssvar efter de resterende afklaringer. |

Kortlægningen er færdig. De åbne handlinger er ikke udført eller godkendt ved afkrydsning af D05.
