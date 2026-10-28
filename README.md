# Huslyg

For the current development setup and remote-work handoff, start with
[AGENTS.md](AGENTS.md), [Remote development](docs/REMOTE-DEVELOPMENT.md) and
[Environments](docs/ENVIRONMENTS.md). The older notes below describe earlier
Strømblik behavior; the current public website is a static app landing page.

En dansk elpris-app til iPhone, iPad, Android-telefoner og Android-tablets. Appen viser den aktuelle og kommende samlede elpris i kr/kWh for N1/DK1, inklusive moms, elafgift og transporttariffer. Timegrafen kan bladre gennem op til syv dage og markerer fremtidige modelpriser som prognoser.

Familieplanen finder det billigste sammenhængende tidsrum inden for 48 timer. Familien vælger apparatets energiklasse på den nye EU-skala A–G og en køretid fra 30 minutter til 4 timer; appen bruger et standardestimat for kombinationen. Hvert element kan tilpasses eller fjernes separat og gemmes lokalt på enheden. Elbiler bruger valgfri batterikapacitet, ladeeffekt og batteriniveau med 90% estimeret ladeeffektivitet.

## Kom i gang

```sh
npm install
npm start
```

Scan QR-koden med Expo Go, eller tryk `a` for Android. iOS-simulator kræver macOS; på Windows kan appen testes på en fysisk iPhone med Expo Go.

## Kontrol

```sh
npm run typecheck
```

## Faktisk elforbrug fra Eloverblik

Appen hostes på Vercel og gemmer målerdata i Supabase PostgreSQL. Under **Mit hjem** logger brugeren ind med et Supabase-login-link. Kun eksplicit inviterede, e-mailbekræftede brugere kan læse husstandens data. Nye konti får ingen husstandsadgang automatisk.

Backend kræver `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `EL_OVERBLIK_TOKEN` og `EL_OVERBLIK_HOUSEHOLD_ID`. De konfigureres både lokalt i `.env` og som Vercel production environment variables. Hemmelige nøgler må aldrig have `EXPO_PUBLIC_`-præfiks. Appen henter kun Supabase URL og publishable key fra `/api/auth/config`. Både Vercel og den lokale forbrugsrute kræver et gyldigt bruger-JWT og kontrollerer medlemskab før privilegeret databaseadgang. Token-overrides fra klienten accepteres ikke.

En administrator kan knytte serverens token til en husstand og invitere en bestemt e-mail:

```sh
node --env-file=.env scripts/provision-household.mjs bruger@example.com
```

Kommandoen registrerer tilknyttede forbrugsmålere og gemmer husstands-ID i lokal `.env`. Den sender ingen mail. Kør kun med en udtrykkeligt autoriseret e-mail. Ved senere invitationer bruges samme husstands-ID. For at fjerne adgang skal administratoren slette både invitationen og medlemskabet. Andre husstande kan have egne data, men serverens Eloverblik-token bruges udelukkende til den konfigurerede husstand.

Målinger gemmes pr. måler, UTC-tidspunkt og opløsning. Import erstatter en periode atomisk, håndterer rettelser og fjerner udgåede målinger. Kun én opløsning indgår i en vist sum. Seneste 30 dage genkontrolleres efter en time, ældre ufuldstændige perioder efter seks timer og komplet historik efter syv dage. **Opdater** bruger denne cachepolitik; det gennemtvinger ikke et nyt upstream-kald. Ved upstream-fejl beholdes eksisterende data og vises som ikke opdateret. Manglende data er ikke nul. Dansk kalender og UTC-intervaller bevarer begge gentagne timer ved vintertid.

Årsoversigten viser de fem foregående år og indeværende år, samt ældre år hvis de allerede er arkiveret. Hver upstream-forespårgsel er højst ét år. Klik på periodetitlen for at vælge år, måned eller en kalenderdato til timevisningen.

Start lokal server med `npm run server`. På en fysisk telefon skal `EXPO_PUBLIC_API_URL` pege på serverens HTTPS-adresse eller computerens lokale IP. Production bør bruge samme origin og ikke en localhost-URL. Hosted Auth-redirects styres af den afgrænsede konfiguration i `supabase/hosted/supabase/config.toml`:

```sh
node --env-file=.env scripts/supabase-auth-config.mjs diff
node --env-file=.env scripts/supabase-auth-config.mjs push
```

Standardmailen bruger et login-link. Kodefeltet kan bruges hvis en senere konfigureret mailtemplate indeholder en OTP-kode. Supabases standard-mailudbyder har leveringsbegrænsninger; brugerens mailmodtagelse skal verificeres separat. Ingen GDPR-compliance er fastslået af denne opsætning.

## Database og test

Schema- og RLS-ændringer skal ligge i nye versionerede migrationer. Rediger ikke allerede anvendte migrationer. CLI-migrationsadgang kræver CLI-login/link og er adskilt fra API-nøgler.

```sh
npm run db:status
npm run db:new -- change_name
npm run db:plan
npm run db:migrate
node --test --test-isolation=none scripts/test-eloverblik.mjs scripts/test-consumption.mjs
node --env-file=.env scripts/test-consumption-live.mjs
```

Den sidste test opretter midlertidige testbrugere/husstande i den konfigurerede database og sletter kun disse efter testen. Den tester invitationer, JWT, RLS, adgang på tværs af husstande, cache, rettelser og idempotent import. Den sender ingen mail. Den eksisterende `update_page.js` har syntaksfejl, som blokerer projektets fulde typecheck.

## Varme og vand fra eForsyning

Appen kan hente varme- og vandforbrug gennem den lokale proxy i `server.mjs`. Kopier `.env.example` til `.env` og udfyld brugernavn, adgangskode fra regningen samt forsynings-ID'et fra eForsyning.

Øverst i appen kan du også indtaste en adresse. Adresseforslagene kommer fra den gratis DAWA-tjeneste, og netselskabet findes via Green Power Denmarks offentlige Find netselskab-data. Når selskabsnavnet kan matches entydigt med prislisten, vælges det automatisk; ellers kan det vælges manuelt i netselskabslisten.

Start proxyen i en separat terminal:

```sh
npm run server
```

Start derefter Expo som normalt. På web bruger appen `http://localhost:8787`. På en fysisk telefon skal `EFORSYNING_API_URL` i `App.tsx` ændres til computerens lokale IP-adresse, for eksempel `http://192.168.1.25:8787`.

Proxyen henter data højst, når appen åbnes, og gemmer ikke login-oplysninger i Expo-appen. eForsyning-data kan være forsinket, fordi forsyningen typisk opdaterer målerdata én gang i døgnet.

På elbilkortet kan du vælge en bilmodel fra OpenEV Data, et gratis åbent datasæt. Det udfylder batterikapacitet og AC-ladeeffekt, når data findes. Ukendte modeller kan stadig indstilles manuelt. Datasættet er licenseret under CDLA-Permissive-2.0.

Affaldskalenderen bruger adressens kommune automatisk og vælger en affaldsoperatør. Operatørernes iCal-feeds konfigureres i `WASTE_PROVIDER_FEEDS_JSON`, eksempelvis `{"kredslob":"https://operator.example/affald.ics","affaldplus":"https://operator.example/affald.ics"}`. Feedets arrangementer normaliseres til plast/papir, madaffald og farligt affald og vises på Overblik.

Prisdata og tariffer hentes fra Strømlignings offentlige API, som kombinerer spotdata fra Nord Pool med aktuelle afgifter og netpriser. API'et er gratis til ikke-kommerciel brug; kommerciel udgivelse kræver en aftale med Strømligning.
