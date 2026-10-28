# Huslyg – fem næste juridiske forberedelsespunkter

Dato: 25. oktober 2026. Omfatter S03, S04, S05, B01 og B02 fra [tjeklisten](LEGAL-RELEASE-CHECKLIST.md).

Dette dokument afslutter registrering og beslutninger for disse fem punkter. Det godkender ikke offentlig release og erklærer ikke de fundne tekniske problemer løst. Ingen appkode, produktionskonfiguration eller database er ændret.

## S03 – udeladte funktioner og resterende behandling

Kilde: den isolerede Android-kilde `.tmp/property-model-apk-release/`, lokale serverfiler og eksisterende release-dokumentation. Kontrollen er statisk; den må ikke omtales som en optaget netværkssession fra en telefon eller som kontrol af alle live-serverprocesser.

| Funktion | Synlighed | Kontrolleret baggrundsadfærd / rester | Konklusion |
| --- | --- | --- | --- |
| Bil / Tesla | Bil er filtreret fra bundnavigation og Mit hjem; almindelig navigation til pauserede faner sendes til Mit hjem. | Dashboard monterer stadig `useTeslaConnection(activeTab)`. Ved `home`/`car` kalder hooken status og kan derefter hente biler, hvis der findes en forbindelse. Den normale genhentning har et 60-sekunders cachevindue; callback kan også starte genhentning. Kald til backend indeholder den aktuelle kontos Bearer-token. | **Ikke stoppet af skjult fane.** Bevar i datakortlægning, indtil kald er deaktiveret og kontrolleret, eller behandlingen er udtrykkeligt begrundet. |
| Elbilmodelkatalog | Ingen almindelig Bil-indgang. | `useEvModels()` monteres på dashboard. APK-kildens `fetchOpenEvModels` laver et kald til `http://localhost:8787/api/ev/models`, med fejl fanget af hooken. | Uønsket restkald til telefonens lokale loopback; det er ikke i sig selv dokumentation for overførsel af personoplysninger til en ekstern biludbyder. Bør fjernes fra den pauserede funktion før release. |
| Ladevindue-påmindelser | Bil/lader er skjult. | Dashboard monterer fortsat `useChargingWindowAlert`. Når gemt `enabled` er sand og prisdata kan bruges, kan lokale notifikationer planlægges. Når falsk, annulleres de relevante notifikationer. | Pauseret bilfunktion kan stadig påvirke telefonens notifikationer; skal afklares, før funktionen beskrives som helt deaktiveret. |
| Apparater / SmartThings | Filtreret fra navigation; `setActiveTab` omdirigerer almindelige forsøg på at åbne fanen. | Hooken monteres fortsat. Rutinemæssig refresh er betinget af aktiv SmartThings-fane. Native callback og webparameteren `smartthings=connected` kan dog kalde refresh direkte, selv når navigationen omdirigeres. | Ingen rutinemæssig polling fastslået på skjult fane, men callback kan stadig hente status/enheder. Backendforbindelser og tilladelser er ikke slettet ved at skjule indgangen. |
| Lader | Skjult via samme pausefilter. | Ladersiden ligger fortsat i den sekundære router, men renderes kun ved den relevante fane. Ingen normal synlig indgang; gennemgangen dokumenterer ikke, at alle gamle backendruter eller provider-tilladelser er fjernet. | Behold som udeladt brugerfunktion; påstå ikke fuldstændig afvikling af integrationen. |
| Hus / sol / 3D | Den forenklede boligside viser kun Overblik, Boligen, Tag, Matrikel og Plantegning. | Tagfanen bruger fortsat geometri/højdedata til sit aktive tagestimat. Backendens vault-router har fortsat operationer for gemt husmodel og facade-/åbningsanalyse. | Geometrikald til tag er en del af den aktive funktion. Skjult 3D betyder ikke, at serverens gamle funktioner/data er slettet. |
| Lokale AI-trænere | Ingen slutbrugerindgang i denne udgivelsesoversigt. | `side-projects/` er ekskluderet af `.vercelignore`; de gennemgåede farvetræner-servere binder til `127.0.0.1`. Lokal Vercel-konfiguration angiver kun spotprisarkivets to cronjobs. | Ikke dokumenteret som en automatisk træningsfunktion i appen. Eksklusion fra Vercel og loopback-binding beviser ikke, at en lokal trænerproces er stoppet. Lokale processer eller træningsdata er ikke ændret her. |

### Teknisk opfølgning før endelig release

Disse udeståender er knyttet til de stadig åbne D05, D07, C01, T02 og LANC03; S03 er dokumentations-/kontrolpunktet, ikke en gennemført reparation.

- Stop rutinemæssige Tesla-/modelkatalogkald for den pauserede bilfunktion, og kontroller callbacks særskilt.
- Afklar og håndter ladevindue-notifikationer fra tidligere gemte præferencer.
- Stop SmartThings-callbackens datahentning, mens funktionen er pauseret, uden ukritisk at slette eksisterende forbindelser eller brugerdata.
- Kortlæg tilbageværende providerdata, serverruter og eventuelle lokale AI-processer, før politikken hævder, at de ikke behandler data.

Læsbare kilder: [Tesla-hook](../.tmp/property-model-apk-release/src/hooks/useTeslaConnection.ts), [EV-hook](../.tmp/property-model-apk-release/src/hooks/useEvModels.ts), [EV-endpoint](../.tmp/property-model-apk-release/src/evData.ts), [ladepåmindelse](../.tmp/property-model-apk-release/src/hooks/useChargingWindowAlert.ts), [SmartThings-hook](../src/hooks/useSmartThingsConnection.ts), [navigationspause](../src/utils/pausedHomeFeatures.ts), [serverrouter](../api/energy/vault.mjs) og [Vercel-konfiguration](../vercel.json).

## S04 – distributionsbeslutning

Ejeren har valgt **Android og iOS fra første udgivelse**. Google Play og Apple App Store indgår derfor begge i releaseforberedelsen. Den allerede dokumenterede offentlige Android-APK er en eksisterende distributionsvej; den erstatter ikke butiksgodkendelser.

Alle relevante G- og I-punkter i tjeklisten skal gennemføres. Dette valg er hverken bevis for en fungerende iOS-build eller tilladelse til at indsende, betale for udviklerkonti eller publicere en ny release. Web er ikke her valgt som en selvstændig fuld appudgivelse; den planlagte markedsføringsside behandles separat.

## S05 – målgruppe og finansiering

Ejeren har valgt **voksne på 18 år eller derover**, **gratis**, **uden reklamer eller køb** for første version.

Der planlægges derfor ingen abonnementer, køb af digitale funktioner, reklame-SDK'er eller reklamebaseret indtjening i dette scope. Eventuelle eksisterende SDK'er/kald skal stadig undersøges under C01; beslutningen beviser ikke deres fravær i en build. Butiksaldersmærkning skal udfyldes efter indholdet og er ikke automatisk identisk med den valgte målgruppe.

Betalingspunkter kan senere lukkes som ikke relevante med henvisning til denne beslutning og en kode-/konfigurationskontrol; de er ikke automatisk krydset af her. En senere ændring af betaling, reklamer eller aldersgruppe kræver ny vurdering.

## B01 – virksomhedens oplysninger

| Felt | Registreret oplysning | Grundlag |
| --- | --- | --- |
| Juridisk navn | BluePeach | Ejerens bekræftelse og virksomhedsopslag |
| CVR | 40876375 | Ejerens bekræftelse og virksomhedsopslag |
| Virksomhedsform | Personligt ejet mindre virksomhed | Ejeren bekræftede den konkrete oplysning |
| Adresse | c/o Mohammed Mousleh, Krog-Meyers Vej 28, 6400 Sønderborg, Danmark | Ejeren bekræftede den konkrete adresse |
| Appnavn / domæne | Huslyg / huslyg.dk | Ejerens valg |
| Offentlig kontaktbetegnelse | Huslyg-teamet | Ejerens valg |
| Kontaktmail | info@huslyg.dk | Ejerens valg |

Kilder kontrolleret: [Paqle](https://www.paqle.dk/p/bluepeach/2334974) og [DSY](https://dsy.dk/udbyder/273121/bluepeach). Det officielle [CVR-opslag](https://datacvr.virk.dk/enhed/virksomhed/40876375) kunne ikke hentes i webværktøjet. **B01 afsluttes som registrering af ejerbekræftede virksomhedsoplysninger**, ikke som en uafhængig officiel CVR-verifikation eller et varemærketjek. Virksomhedsform/adresse skal genbekræftes, hvis registreringen ændres før publicering. B05 og butikkernes udgiververifikation er fortsat åbne.

## B02 – kontaktmail og ansvar

Ejeren svarede **“det har jeg”** på spørgsmålet om oprettelse og bekræftet modtagelse/afsendelse for info@huslyg.dk samt hvem der har ansvaret for support-/privatlivshenvendelser. Det registreres som ejerens bekræftelse af mailens funktion og eget ansvar i Huslyg-teamet. Der er ikke sendt en testmail af Codex.

### Separat DNS-opfølgning

To read-only opslag den 25. oktober 2026, først med systemets resolver og dernæst eksplicit mod `1.1.1.1`, viste:

- MX-forespørgslen for `huslyg.dk` gav en SOA-post og ingen MX-post.
- `_dmarc.huslyg.dk` gav to særskilte TXT-poster: `v=DMARC1; p=none;` og en anden med `p=quarantine`, alignment og rapportadresse.

Dette modsiger ikke i sig selv en observeret succesfuld mailtest: fravær af MX alene er ikke en gennemført SMTP-leveringstest. Det er dog en leverings-/konfigurationsrisiko, der skal afklares. Ifølge [RFC 7489 §6.6.3](https://www.rfc-editor.org/rfc/rfc7489.html#section-6.6.3) afsluttes DMARC-policyopslag uden anvendelse af DMARC, når der findes flere relevante poster.

**Åben teknisk handling under T02/LANC03:** Kontroller mailudbyderens krævede modtagelsesopsætning, tilføj/ret de relevante MX-poster hvis nødvendigt, og saml DMARC i én korrekt politik. Kontroller SPF/DKIM hos den valgte afsender samt reel afsendelse/modtagelse med en ekstern mailbox, før konfigurationen erklæres teknisk verificeret. DNS er ikke ændret; ingen mail er sendt til andre.

B02 er afsluttet på ejerens driftsbekræftelse og ansvarsplacering. DNS-/leveringsopfølgningen er fortsat åben og må ikke forsvinde ved, at feltet krydses af. Dette aktiverer heller ikke Resend-invitationer; den opsætning behandles fortsat særskilt under F05.
