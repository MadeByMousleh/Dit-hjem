# Strømblik

En dansk elpris-app til iPhone, iPad, Android-telefoner og Android-tablets. Appen viser den aktuelle og kommende samlede elpris i kr/kWh for N1/DK1, inklusive moms, elafgift og transporttariffer. Timegrafen kan bladre gennem op til syv dage og markerer fremtidige modelpriser som prognoser.

Familieplanen finder det billigste sammenhængende tidsrum inden for 48 timer. Familien vælger apparatets energiklasse og en køretid fra 30 minutter til 4 timer; appen bruger et standardestimat for kombinationen. Hvert element kan tilpasses eller fjernes separat og gemmes lokalt på enheden. Elbiler bruger valgfri batterikapacitet, ladeeffekt og batteriniveau med 90% estimeret ladeeffektivitet.

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

Prisdata og tariffer hentes fra Strømlignings offentlige API, som kombinerer spotdata fra Nord Pool med aktuelle afgifter og netpriser. API'et er gratis til ikke-kommerciel brug; kommerciel udgivelse kræver en aftale med Strømligning.