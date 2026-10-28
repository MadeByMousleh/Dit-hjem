# Eksport, kontosletning og sessionsbeskyttelse

26.–27. oktober 2026. **Implementeret, dev-testet, installeret som test-APK 1.0.123 og særskilt godkendt/aktiveret i produktion.** Produktion er verificeret uden at slette en rigtig konto.

## Leveret

- Profil → Dine data: læsbar JSON-eksport af valgt husstands aktuelle energivault og alle aktuelle perioderecords. Der pagineres gennem hele historikken; en fejl giver ingen delvis fil. Konto-/låseskift afbryder. Nøgler/tokens eksporteres ikke.
- Eksporten er en **energikopi**, ikke et færdigt samlet indsigts-/portabilitetssvar med profil, filer, logs og øvrige kategorier. R02/R08/R09 står fortsat åbne for det samlede flow.
- Kontosletning starter i appen og kræver en frisk verificeret mail-login inden for ti minutter samt den indtastede bekræftelse `SLET MIN KONTO`. Backend bruger den verificerede aktør, ikke klientens bruger-ID.
- En enlig husstands data slettes med FK-cascades. I en delt husstand bevares fælles arkiv for tilbageværende medlemmer. Den eneste ejer skal vælge en faktisk tilbageværende administrator. Forkert efterfølger afvises.
- Auth-hard-delete udføres med den officielle Admin API. En DB-trigger udfører husstandsoprydning i samme transaktion som Auth-sletningen; fejl ruller begge dele tilbage. Udløbne/uforberedte slettevalg afvises. Forbindelser knyttet til den slettede bruger fjernes efter deres eksisterende FK'er; dette er ikke en garanti for, at enhver ekstern providerfuldmagt automatisk er ophævet.
- Auth-sletning kræver en nylig serverforberedt plan, også ved direkte administrator-sletning. Det beskytter delte arkiver mod utilsigtet ejerfjernelse, men ændrer operatørens sletteprocedure og skal indgå i produktionsgodkendelsen.
- Den oprindelige nøgleskabers ID kan nulstilles ved kontosletning uden at ødelægge det tilbageværende hjems nøgle. Krypterings-AAD og payload ændres ikke. Planens brugerrelation slettes med Auth-kontoen.
- På den aktive enhed ryddes kendte brugerafgrænsede vault-/profil-/affaldscaches og kendte legacy-vaultnøgler. Logout anvender den eksisterende notifikationsoprydning. Andre enheder, ukategoriserede legacyrester, logs og backups kræver stadig særskilt kontrol; R05/R07/R09 er ikke afsluttet.
- Native Auth-sessioner krypteres med XChaCha20-Poly1305 under en tilfældig SecureStore-nøgle, bundet til projektets lagernøgle. Eksisterende session migreres ved læsning. Fejlet nøgle-/diskadgang returnerer ikke sessionen som plaintext og bevarer originalen. Explicit nulstilling af gemt login kan udføres fra loginfejlvisningen; den nulstiller ikke bolig-/energidata. Websessioner følger fortsat den eksisterende model.
- Delingstekst før invitation/accept er præciseret. Upload har rettigheds-/persondata-/formålsinformation og kontakt for indsigelser. Licenser kan åbnes i Om Huslyg.

## Dev og fokuserede kontroller

Dev `wsdomkzhnksyjrpxqfvn`: manglende familiemigration `202610240001_family_access.sql` samt den nye `202610260001_account_deletion.sql` er anvendt efter særskilt dry-run. Det almindelige lokale link er ikke ændret. Produktion er ikke migreret i dette skridt.

Passerer:

- `test-auth-session-storage.mjs`: migration, friske nonces, kontekstbinding, tampering, nøgle-/diskfejl, manglende nøgle, logout og samtidighed.
- `test-account-privacy-server.mjs`: token/issuer/featuregate, live Auth-bruger, nyligt login, bekræftelse, fejlsvar, begrænset preview og aktørbinding.
- `test-account-deletion.sql` i dev med rollback: ingen uforberedt sletning, krævet gyldig efterfølger, afvist uvedkommende, fejlrulning tilbage, fjernet enlig husstand/Auth, bevaret delt husstand/nøgle og ingen legacy-autoaccept fra efterladt invitation.
- Eksisterende `test-family-access.sql` og `test-property-documents.sql` passerer i dev med rollback.
- `test-energy-vault-client.mjs`: faktisk vault-service, komplet læsbar eksport over to sider, forespørgselsfejl og afbrydelse ved kontoskift; øvrige eksisterende vault-regressioner passerer.
- Faktisk slettekomponent i lokal Chrome ved 390 px: bekræftelse og efterfølger kræves, backendfejl lukker ikke kontoen lokalt, succes lukker gammel vault, rydder kendte data og kalder logout. Native/backend-I/O simuleret; ingen rigtig konto slettet.
- Root og isoleret kandidats TypeScript passerer; Gradle og APK-kontrol passerer.

## Test-APK og installation

`dist/Huslyg-1.0.123.apk` · versionCode 124 · 85.972.311 bytes · SHA256 `7E8E84A7AEE12B0CB4240F7C3EBF9C1A401DE52BD80E6DB132E4B9787F7C8A02`.

Samme eksisterende debug/test-certifikat: SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Installeret med `install -r` på den kendte Samsung SM_A576B; installeret version og aktivitetsstart Status ok verificeret. Appdata er bevaret. Faktisk native loginmigration, eksportdeling og sletning er ikke fysisk verificeret. Ingen rigtig konto skal slettes for at bevise installation.

16 ændrede klientfiler er hashkontrolleret mod isoleret stage; 14 kodekilder verificeret i sourcemap, JSON-noticer i bundlen. Bundlen matcher buildoutput og embeds `https://dit-hjem-five.vercel.app`. Servermoduler er ikke pakket i klienten. Target SDK 36. READ/WRITE_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW og RECORD_AUDIO er væk i faktisk APK; FCM-auto-init og Analytics/Ad-ID collection er eksplicit slået fra. Kamera-/andre native/iOS-forhold er stadig særskilte kontroller.

Evidens under `.tmp/legal-all/`: `sources.json`, `apk-verification.json`, `privacy-ui.json`, `license-inventory.json` og auditrapporter. Det er lokale artefakter, ikke offentlige kunderapporter.

## Godkendt produktionsudgivelse

Baseline `dpl_5dh1fj6tD5rKePWhEXsZG1TjfYUf` er læst fra live. Forslaget genbruger alle 367 eksisterende kildefilers hashes og ændrer kun:

1. `api/energy/vault.mjs`: ny import og isoleret `account-privacy`-gren; øvrig live route bevares.
2. Ny `src/services/account-privacy-server.mjs`.
3. Ny DB-migration `202610260001_account_deletion.sql` i produktion `arkpfdsglgufnnukader`.
4. Aktiveringsflag `ACCOUNT_DELETION_ENABLED=true` i det godkendte produktionsmiljø.

Ejeren har særskilt svaret “Ja, aktivér den gennemgåede kontosletning”. Produktions-dry-run indeholdt kun den nævnte migration; den er anvendt på `arkpfdsglgufnnukader`. Flaget er sat i Vercel Production. Deployment `dpl_Dbg1H7mnTn7iPcg9j7JFaT3fvCzV` er READY i fra1 på begge domæner.

Alle 368 kildehashes matcher payloaden; kun den eksisterende route og den nye handler er ændret/tilføjet. Produktions-Auth er bevaret. Manglende og ugyldige tokens giver 401/no-store på begge domæner; ugyldigt-tokenkontrollen verificerer også, at flaget er aktivt. Root, kontakt, familielanding og eksisterende offentlige APK svarer fortsat 200. Frontend og offentligt APK-download er ikke erstattet med den nye lokale klient i backendudgivelsen.

En efterfølgende ekstern redeployment under arbejdet er observeret som `dpl_9xDinfqTXQ2qtXigt7GbA1LtWn2n`. Alle 368 kildehashes er identiske med den ovenfor verificerede udgivelse; kildeændringer er ikke overskrevet. Dette er den nye observerede livebaseline for et senere separat mailforslag. Evidens: `.tmp/legal-all/live-drift.json`.

Efterfølgende, særskilt godkendt: produktionsdeployment `dpl_Fs3RD1eppPtDXu6Ntaqb1EBrGC5r` ændrer kun familiehandler/mailtekst og tre kompatible lockfilpakker oven på denne baseline. Kontosletningens kildefiler er bevaret og dens adgangsbeskyttelse genkontrolleret. Migrationerne `202610270001` og `202610270002` tilføjer den godkendte serverbeskyttede slettejournal. Se [fuld aktiveringsrapport](FAMILY-MAIL-AND-ERASURE-RELEASE.md). Ingen rigtig konto er slettet eller gendannet ved denne opfølgning.

Der er ikke deployet fra det beskidte rod-worktree. Payload, før-/efter-route, baselinehashes og livekontrol findes i `.tmp/legal-all/backend-release.json` og `production-verification.json`. Rigtig autentificeret sletning i produktion er ikke testet; ingen kundekonto er slettet af agenten.

Rollback skal deaktivere flaget og rulle de to serverfiler tilbage til baseline. En tidligere faktisk kontosletning kan ikke fortrydes ved rollback af kode. Migrationens trigger skal håndteres særskilt ved en rollback; drop ikke nøgle-/husstandstabeller og genaktivér ikke slettede konti.
