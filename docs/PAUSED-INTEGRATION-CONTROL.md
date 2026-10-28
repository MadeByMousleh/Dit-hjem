# Pauserede integrationer – stop af klientkald

27. oktober 2026. Pauseringen bevarer kode og gemte forbindelser, men klienten skal ikke udføre deres behandling ved almindelig brug af første scope.

Ændringer:

- Dashboard giver Tesla-, SmartThings- og EV-modelhooks eksplicit aktivering fra den eksisterende `isPausedHomeTab`-afgrænsning.
- De pauserede hooks foretager ingen initielle status-/bil-/katalogkald. Tesla-/SmartThings-retur- og fokuslisteners registreres ikke ved pausering. Direkte kald til connect, refresh, kommandoer og frakobling stoppes også i hooks; ingen forbindelse eller præference slettes af pauseringen.
- Ladevinduebeskeder får `enabled: false`, mens Bil er pauseret. Det eksisterende ejerafgrænsede notifikationsflow håndterer annullering af tidligere lokale ladebeskeder.
- Standardadfærden for hooks uden den nye parameter er bevaret, så separat kode/fremtidig kontrolleret genaktivering ikke automatisk mister funktionalitet.

Faktiske hooks er browserafprøvet med syntetisk I/O: nul providerkald, nul retur-listeners og blokerede direkte handlinger ved pausering. En positiv aktiveret kontrol viser, at testharnessen kan observere de oprindelige providerkald. Root/staged TypeScript og Gradle passerer.

## APK 1.0.124

`dist/Huslyg-1.0.124.apk` · versionCode 125 · 85.972.743 bytes · SHA256 `A7EA7AB8CAAC65027C7DB3997DFA943506A9E2D904DB75205D02974C2BC4DBD8`.

Samme Android Debug/test-certifikat som 1.0.123. 20 klientfiler hashkontrolleret mod isoleret stage; 18 kodekilder verificeret i sourcemap og JSON-noticer i Hermes-bundle. API, bundlelighed, version, target SDK 36, fjernede tilladelser og Firebase-flags passerer. Telefonen var ikke længere tilsluttet ved installationskontrollen; **1.0.124 er ikke installeret**. Sidste verificerede installerede version er 1.0.123.

Evidens: `.tmp/legal-all/paused-integrations.json`, `.tmp/legal-paused-release/sources.json` og `apk-verification.json`.

## Bevisgrænser og releaseopfølgning

Dette er en **klientrettelse**. Den er ikke rullet ud til den eksisterende offentlige webklient eller det gamle offentlige APK-download. De tidligere backendintegrationer/callbacks er ikke slettet eller deaktiveret, og der er ikke udført ny brugerfrakobling eller datapruning. S03/T02/X02 skal fortsat afstemme faktisk server-/legacyadgang og frontend-release; skjulte AI-/integrationsruter godkendes ikke automatisk af denne fil.

Kontosletningsbackendens særskilte godkendte udgivelse er fortsat [dokumenteret separat](ACCOUNT-PRIVACY-IMPLEMENTATION.md). Ingen ny backend-, DB-, Auth-, nøgle- eller providerkonfiguration er ændret af pauseringsrettelsen.
