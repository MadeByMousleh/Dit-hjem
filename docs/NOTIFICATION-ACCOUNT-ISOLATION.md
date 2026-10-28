# Konto- og husstandsadskillelse af telefonpåmindelser

26. oktober 2026. Konkret rettelse under T02/R07/F06 og risikoregisteret i D09. **Dette afslutter ikke hele T02 eller DPIA'en.**

## Problem og ændring

Elpris-/ladepåmindelsernes dagsmarkører og budgetbeskedernes dubletnøgler var enhedsglobale. Planlagte beskeder kunne mangle ejermetadata, og en gammel asynkron operation kunne afslutte efter et kontoskift. Det kunne både undertrykke en anden brugers besked og efterlade privat indhold på forkert login.

Nu etableres en notifikationssession for en bestemt bruger/husstand. Hooks får et uforanderligt sessionstoken via Reacts external-store-mekanisme og arbejder kun med det token. Alle lokale notifikationsoperationer er samlet i én kø, også affald, så oprydning ikke løber uafhængigt af en gammel planlægning.

- Alle nye el-/budget-/affaldspayloads indeholder bruger-ID og husstands-ID.
- Elpris-/ladeplanlægningens og budgettets v2-nøgler er afgrænset til bruger/husstand. Ældre globale dubletnøgler adopteres ikke som en ny brugers historik.
- Login-/husstandsskift, auth-udløb og logout invaliderer gamle sessionstokens. En gammel operation bliver ikke gyldig igen, selv hvis brugeren skifter A → B → A.
- Gamle planlagte og allerede viste kendte private beskeder fra andre ejere eller uden ejermetadata ryddes. Uvedkommende notifikationstyper røres ikke.
- Før nye private skriverier genforsøges oprydning. Fejler den fortsat, skrives der ikke nye private beskeder gennem den kø. Eksplicit logout afventer oprydning før Auth-signout og viser fejl, hvis den mislykkes.
- Efter et in-flight native schedule-kald kontrolleres sessionen igen; et forældet identifier annulleres/dismisses, også ved A → B → A.
- Banner/lyd i foreground og kliknavigation kontrollerer kendt privat payload mod aktuel ejer. Legacy eller fremmede ejerdata bruges ikke til navigation.
- En fremtidig besked, som blev annulleret ved logout, kan planlægges igen ved samme ejers tilbagekomst. En faktisk leveret dagsbesked dubleres ikke blot ved refresh.

## Migration og data

Første opstart foretager oprydning af legacy-/fremmede kendte beskeder. Aktuelle tilvalg kan derefter planlægge på ny. Der slettes ingen profil, kontosession, forbrugshistorik, plantegning eller krypteringsnøgle af denne migration. Gamle lokale dubletnøgler ignoreres; endelig oprydning af overflødige metadata behandles fortsat under retention/sletning.

Dette er lokal lifecycle-håndtering. Det er ikke en serverpush-mekanisme, der kan tilbagekalde en besked øjeblikkeligt på en slukket/offline telefon efter fjernelse af et familiemedlem. Allerede sete beskeder kan ikke gøres usete. Remote revocation, endelig sletning og låseskærmsindhold skal stadig med i den samlede vurdering.

## Kontrol

- `node scripts/test-low-price-alert.mjs`: eksisterende pris-/budgetberegninger samt samtidige planlægninger, ejer-/husstandsafgrænset budgetdedupe, legacy-oprydning, logout, forældede async-kald, A → B → A, oprydningsfejl/genforsøg og bevaring af andre notifikationstyper passerer.
- `.tmp/test-owned-notification-hooks.mjs`: de faktiske Auth-/notifikationshooks kører i React med syntetisk backend/storage og simulerede native API'er. Konto-/husstandsskift, affaldsplanlægning, fjernelse af private viste/planlagte beskeder og oprydning før Auth-signout passerer uden browserfejl. Evidence: `.tmp/legal-d05/notification-hook-check.json`.
- Root og isoleret APK-kildes TypeScript passerer. Ingen bred ekstra regressionstest af AI/bolig/providerfunktioner.
- Ingen rigtig konto er logget ud, ingen faktisk telefonbesked er sendt, og ingen produktionslogs/databaser er læst eller ændret ved disse checks.

## APK / releasegrænse

Appændringen er bygget og verificeret som [test-APK 1.0.122](../dist/Huslyg-1.0.122.apk), code 123, fra `.tmp/property-model-apk-release`. Ti klientfiler er synkroniseret isoleret; den tidligere Huslyg-branding bevares. Kildehashes før/efter er registreret i `.tmp/notification-scope-release/sources.json`.

- Gradle passerede. Alle ti ændrede pakkede sources matcher stage/rod; APK'ens bundle matcher buildoutput og indeholder fortsat `https://dit-hjem-five.vercel.app`. Servermoduler er udelukket i den fokuserede pakkekontrol.
- 85.866.511 bytes; SHA256 `CCCA2D25349EC81F9398176F10550017C76F8F7B402EEA8CCAEC52DC85F0E967`.
- Pakke `dk.dithjem.stromblik`, synlig label Huslyg, versionName 1.0.122/versionCode 123. APK-v2-signatur verificeret med det eksisterende Android Debug/test-certifikat, SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Telefonen var ikke synlig i ADB/mDNS. Ejeren bad derefter udtrykkeligt om at springe installationen over og fortsætte tjeklisten. **Ingen installation af denne APK i denne opgave; spørg ikke igen om tilslutning til 1.0.122 uden ny anmodning.** Den senest bekræftede installerede version er 1.0.121.
- Evidence: `.tmp/notification-scope-release/apk-verification.json`. Ingen Git commit/push eller publicering af et nyt APK-download.

Ingen web-/backendudgivelse eller Auth-/databasekonfiguration ændres her. Den allerede offentlige webapp og det offentlige APK-download får ikke denne rettelse ved en lokal bygning. Fysisk konto-/husstandsskift og faktisk OS-levering afventer native verifikation; syntetiske tests er ikke bevis for fysisk adfærd.
