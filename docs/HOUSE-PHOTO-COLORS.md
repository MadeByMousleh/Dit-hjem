# Fotobaserede husfarver — 2026-10-18

Første klientversion udleder estimeret primær tag-/facadefarve fra de eksisterende kalibrerede skråfoto-billeder, som også er kilden til Overblik. Ingen ny billedtjeneste, AI-upload, API-nøgle, serverdeployment eller databaseændring. LiDAR-/terrængeometrien ændres ikke. Bevoksning er nu fra som standard, både i UI og motor.

## Metode

`src/web/photo-materials.ts` genbruger de allerede dekodede billeder i WebView/iframe. Geometriske prøver på tag/vægge projiceres med billedets kamerakalibrering. Prøver skal være frontvendte, væk fra billedkanter og skjulte flader afvises med raycasting mod bygnings- og bevoksningsgeometri. Terræn er ikke farvekilde til huset. Farver aflæses i originalbilledets native udsnit; der opfindes ikke nye billeddetaljer.

Indre trekantsprøver undgår kanterne. Facadeprøver begrænses til en nedre/midterste vægzone for at reducere tagudhæng/overliggende tag som fejlkilde. Færre end 40 prøver, meget mørke/udbrændte prøver og blandede farver uden dominerende gruppe giver ingen kandidat. Den dominerende gruppe skal støtte mindst 60 procent af alle prøver. Kandidater skal have tilstrækkelig kromatisk overensstemmelse fra mindst to brugbare billedvinkler; ellers beholdes en neutral basefarve. Dette er en konservativ heuristik, ikke en kalibreret sandsynlighed eller en semantisk vindues-/materialeklassifikation.

Estimerede sRGB-farver sættes på eksisterende MeshStandardMaterial gennem Three.js Color. Sollys/skygger beregnes fortsat i motoren. Der bages ikke et helt fotografi fast på facaden. Den eksisterende fulde Fotomodel kan stadig vælges separat; den har fortsat fotografiets indbyggede lys/skygger. Man kan slå Fotofarver fra og se neutrale materialer. Brugerens egne allerede accepterede facademodeller bevares som separate overlays og overskrives ikke af basefarven.

Farver er ikke fysisk målt albedo, præcise malingskoder, murstenssorter eller teksturer. Billedalder, lys, skygger, geometri-/kamerafejl, gentagne mønstre, vinduer og skjult facade kan stadig påvirke resultatet. Ingen automatisk påstand om mursten, tagmateriale, spejlingsgrad eller korrekt farve på alle etager. Ukendt facade/garage bliver neutral. Appen viser estimeret farve, billedvinkler og årgang.

Analysen kører asynkront i korte batches; nye billeder/afmontering annullerer gamle resultater. Forkert adresse-ID afvises, og fjernede billeder nulstiller farver. De eksisterende billedcaches genbruges; selve paletten genberegnes ved modelstart og gemmes ikke i en ny database.

## Faktisk referencekontrol

Eksisterende produktionsopslag `mode=model-photos` returnerede fem billeder fra 12. maj 2025. Native modeludsnit er 222×246 (syd), 200×260 (øst), 239×287 (nord), 233×352 (vest), 573×440 (lodret). Facader fylder kun en del af disse billeder; højere visningszoom skaber ikke flere originale detaljer.

Faktisk Chrome/WebGL-appmotor, med disse billeder og den eksisterende LiDAR-model:

- Hovedhus tag: `#999494`, 2.757 prøvepixels, fem vinkler.
- Hovedhus primær facade: `#c1b6a2`, 440 prøvepixels, fire vinkler.
- Garage/ekstra bygning tag: `#a19ea0`, 785 prøvepixels, fem vinkler.
- Garagefacade: kun én brugbar kandidatvinkel, derfor afvist og neutral.

Resultaterne er fotoestimater, ikke en uafhængig facitliste. En første prøveversion gav for meget tagfarve i facadeprøverne; kildebilleder med projicerede tag-/vægkonturer blev visuelt kontrolleret, og prøvebånd/kantrafstand blev skærpet før den nuværende version. Der foretages ingen påstand om, at geometri og billeder passer perfekt.

Browserforløb inklusive billeddekodning/fotoopsætning/colour analysis tog cirka 5–6 sekunder på udviklingsmaskinen, ikke en fysisk telefonmåling. Farver til/fra, adresseafvisning, nulstilling, LiDAR-fallback og browserfejl kontrolleres i `.tmp/check-photo-materials.mjs` og eksisterende motorkontrol. Syntetiske tests i `scripts/test-photo-materials.mjs` dækker få/mørke/klippede/blandede prøvepixels og dominerende farve. Scoped TypeScript passerer.

Diagnostiske filer er kun lokale i ignoreret `.tmp/lidar-parcel`: `material-photos.json`, `photo-material-report.json`, `photo-material-colors.png`, `neutral-material-colors.png`, `photo-projection-debug.png`. Ingen billeder eller servercredentials pakkes som nye statiske APK-ressourcer; billeder hentes gennem den eksisterende API og cache.

## APK og status

`dist/Stromblik-1.0.48.apk`, versionCode 49, 79.795.019 bytes, SHA256 `A4E360CF0C378CC7552319BD0B9A17C9B87CB976216114C7E40F0D2B39D4E4DF`. Gradle assembleRelease, aapt target SDK 36, v2-signatur med samme eksisterende debug/test-certifikat og sammenligning af 19 pakkede kildefiler passerer. Isoleret klientstage, API uændret `https://dit-hjem-five.vercel.app`, ingen servercredentials i klientbundle. Ingen commit, push, databaseændring eller server-/webdeployment.

Telefonen var kort synlig under arbejdet, men ikke ved afsluttende `adb devices`/mDNS-kontrol. APK er derfor bygget, ikke installeret. Ingen fysisk visuel kontrol af fotofarver. Sidst kendte installerede version er 1.0.47; den nye APK inkluderer også bevoksning fra som standard.

Efterfølgende installation på brugerens anmodning: genforbundet til den tidligere parrede telefon over Wi-Fi; `adb install -r` afsluttede med Success. Installeret versionName 1.0.48/versionCode 49 bekræftet, MainActivity startet. Appdata bevaret. Den nye fotofarvevisning er endnu ikke visuelt kontrolleret på fysisk telefon.
