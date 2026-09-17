# Strømblik

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