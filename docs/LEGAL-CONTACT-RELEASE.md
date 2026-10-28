# B03 – udgiver og kontakt i app og på web

25. oktober 2026. **B03 afsluttet: appopdatering installeret, og webændringen er efter ejerens eksplicitte godkendelse udgivet og verificeret på huslyg.dk.** Previewforløbet nedenfor er historik; den afsluttende productionsektion er gældende status.

## Indhold

- Genanvendelig “Om Huslyg”-visning på login før konto og i Profil før notifikationsindstillingerne.
- Udfoldning viser BluePeach, CVR 40876375, adresse c/o Mohammed Mousleh, Krog-Meyers Vej 28, 6400 Sønderborg, Danmark; kontakt Huslyg-teamet og info@huslyg.dk.
- Mailknap med haptisk feedback på telefon og enkel fejlbesked, hvis mailapp ikke kan åbnes. Ingen mails er sendt ved kontrollen.
- Selvstændig dansk HTML-side `public/kontakt.html`, uden login eller egne scripts/tredjepartsfonte. Indeholder virksomhedsform, fysisk adresse, CVR og mail-link. Dette er ikke en færdig privatlivspolitik eller et sletningsflow.
- Ingen omdøbning af pakken, deep links eller øvrig branding i dette skridt; tidligere Strømblik-navne behandles før den endelige release.

## Kontrol

- Root og isoleret APK-kildes TypeScript passerede; efter den sidste tilgængelighedsrettelse blev root-kontrollen gentaget.
- Lokal faktisk React Native Web-komponent og statisk HTML kontrolleret ved 320, 390 og 1280 pixels: udfold/luk, virksomhedsoplysninger, mail-link, skærmlæserstatus og ingen vandret overflow. Fik rettet web-attributten for udfoldet tilstand. Fixture loader ikke appens fonte; screenshots er ikke dokumentation for native typografi.
- Evidence: `.tmp/legal-contact-release/browser-check.json`, `app-contact-390.png` og `web-contact-390.png`.
- Ingen ekstra regressionstest af el, AI eller integrationer; ingen databaseændring.

## Android

- APK: `dist/Stromblik-1.0.120.apk`; pakkenavn `dk.dithjem.stromblik`, versionCode 121.
- 86.170.099 bytes; SHA256 `278C18C887FB6966C0D84F0658CAB51CF48DA6E9D148E6257AB83033D9A0453F`.
- Isoleret `.tmp/property-model-apk-release` som hidtil, indlejret API `https://dit-hjem-five.vercel.app`. Kun kontaktkomponent, LoginScreen og ProfilePage er synkroniseret fra roden; versionerne er opdateret særskilt.
- Gradle release passerede. Ændrede pakkede sources matcher scenen og roden; APK'ens Hermes-bundle matcher buildoutput. API, mail og CVR er verificeret med hensyn til Hermes' strengkodning; servermoduler er udelukket i den fokuserede kontrol. Evidence: `.tmp/legal-contact-release/apk-verification.json`.
- APK-v2-signatur verificeret; samme eksisterende Android Debug/test-certifikat, SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Dette er fortsat en test-APK, ikke en produktionssigneret butikrelease.
- Installeret på den tilsluttede Samsung SM_A576B med `install --no-streaming -r`; appdata bevaret. Installeret version/code og aktivitetens start `Status: ok` verificeret. Den nye kontaktvisning og mailapp er ikke fysisk gennemklikket.
- Det eksisterende offentlige APK-download er ikke erstattet; denne nye APK er lokalt bygget og installeret på telefonen.

## Web – konkret klar ændring til godkendelse

- Preview: [Kontakt og udgiver](https://dit-hjem-7asgdxz5d-mohammed-mouslehs-projects.vercel.app/kontakt.html).
- Previewdeployment `dpl_GyTN8Hqsso1n2rTd1om1ZQ8pzVsK` er READY, target Preview.
- Baseline er den aktive `dpl_AsdnLPdcWUfQEMqanPg6Jfkwz1ZW`. Alle 367 sourcehashes matcher manifestet; 363 eksisterende filer er uændrede. Ændrer kun de eksisterende webversioner af LoginScreen/ProfilePage og tilføjer PublisherInformation samt kontakt.html. Gamle webfiler patches isoleret, ikke erstattet med hele det nyere lokale apptræ.
- Aktive produktionsafhængigheder indeholder allerede expo-haptics; ingen pakke-/backend-/auth-/miljøændring.
- Kontaktpreview svarer HTTP 200 og matcher HTML-kilden efter fjernelse af Vercels præcist identificerede preview-feedback-script. Scriptet er indsat af Vercel Preview, ikke i vores kilde. Production skal kontrolleres særskilt efter godkendt udgivelse.
- Produktion kontrolleret uændret efter Preview. Backend, invitationer, offentligt APK-download, cronjobs og callbacks er bevaret i sourcegrundlaget. Ingen ny productionudgivelse eller Git commit/push.
- Evidence: `.tmp/legal-contact-release/manifest.json`, `preview.json`, `preview-verification.json`.

## Godkendt productionudgivelse og afslutning af B03

- Ejeren godkendte offentliggørelse med “ja og så fortsæt efter det”. Den konkrete firefilers ændring er nu udgivet, og B03 er krydset af.
- Productiondeployment `dpl_5dh1fj6tD5rKePWhEXsZG1TjfYUf` er READY i fra1 på begge eksisterende produktionsdomæner. Baseline/rollback: `dpl_AsdnLPdcWUfQEMqanPg6Jfkwz1ZW`.
- Alle 367 sourcehashes matcher det godkendte manifest: 363 eksisterende filer bevares, kun LoginScreen/ProfilePage ændres, og PublisherInformation/kontakt.html tilføjes. Ingen API-, database-, auth-, pakke- eller miljøændring. De nyere, uafhængige lokale appændringer er ikke inkluderet i webudgivelsen.
- Begge domæner: kontakt.html og rod returnerer 200; den nye udgiverkomponent findes i det aktive webbundle; offentlig Auth-konfiguration vælger fortsat produktion. Invitationsside er byte-identisk med baseline, eksisterende APK-download svarer 200 med uændret størrelse, og manglende auth på familie-API afvises med 401/no-store.
- Kontakt.html matcher kildefilens hash på begge produktionsdomæner uden preview-toolbar-tilføjelse.
- Ren Chrome ved 390 px mod den faktiske huslyg.dk-side bekræfter udfoldning af Om Huslyg fra login uden konto, CVR/udgiver/mail, korrekt udfoldet-status og offentlig kontaktside uden vandret overflow. Ingen loginforsøg, kontoændringer eller mailafsendelse. Den autentificerede webprofil er ikke gennemklikket med en rigtig konto; dens isolerede source og bundle er kontrolleret.
- Evidence: `.tmp/legal-contact-release/production.json`, `production-verification.json`, `production-browser-check.json`, `production-login-390.png` og `production-contact-390.png`.
- APK 1.0.120 er allerede installeret fra den foregående opgave. Ingen gentaget bygning/installation og ingen erstatning af det eksisterende offentlige APK-download i denne webudgivelse. Ingen Git commit/push.

Mail-DNS-opfølgning fra B02 er stadig åben; denne visning ændrer ikke mailkonfiguration eller aktiverer familieinvitationers afsender.
