# Terræn fra rå LiDAR — 2026-10-18

## Efterfølgende rettelse: synlig bevoksning

Efterfølgende brugerønske: bevoksning er nu FRA som standard både i UI og motor (kræver eksplicit `vegetationVisible: true` for synlig mesh). Tilvalg og skyggeestimat bevares. Standardændringen er med i APK 1.0.48 sammen med fotofarver; se `docs/HOUSE-PHOTO-COLORS.md`. APK'en er endnu ikke installeret, fordi telefonen ikke var synlig ved afsluttende kontrol. Version 1.0.47 nedenfor beskriver den tidligere installerede version med bevoksning til som standard.

Den første TIN-version viste kun vegetation som råpunkter, ikke som synlig modelgeometri. De grå flader var reservefladen ved manglende terrænreturer, ikke træer. Version 1.0.47 tilføjer et separat synligt bevoksningslag fra de 6.169 kildeklasse-3/4/5-punkter.

`scripts/lidar/build-vegetation.py` beregner en begrænset 3D alpha-overflade med SciPy Delaunay: højst 1,5 m kant og 0,8 m omskrevet radius. Hele tetraederets XY-projektion skal ligge på matriklen inklusive eventuelle huller. 28.724 accepterede tetraedre giver 6.764 ydre trekanter. Alle modelvertices er uændrede vegetationsreturer, ikke AI-forudsagte punkter. Ingen store mellemrum brobygges, ingen stammer opfindes, og terrænnettet ændres ikke. Træer/hække identificeres ikke individuelt; resultatet er en tilnærmet lokal bevoksningsindhylling. Udsnittet stopper ved matrikelskellet, så kroner kan se afskårne ud.

Bevoksning er synlig som standard i Model/Sammenlign og kan skjules. I LiDAR-punkter vises de oprindelige punkter i stedet. Skygger fra bevoksningslaget er fra som standard; separat tilvalg er tydeligt markeret som estimat, fordi en uigennemsigtig indhylling ikke må forveksles med faktisk lysgennemgang gennem løv eller sæsonvariation. Ingen art, stammediameter eller løvtæthed er målt.

Offline beregning i eksisterende container med 384 MiB hard RAM-grænse og to CPU'er. `scripts/test-parcel-lidar.mjs` kontrollerer, at alle vegetationsvertices findes blandt de originale vegetationspunkter, samt kantgrænsen. Faktisk Chrome/WebGL-kontrol bekræfter synlig mesh og til/fra/estimerede skygger, punktvisning og fallback uden browserfejl; screenshot `.tmp/lidar-parcel/terrain-without-contours.png`. Scoped TypeScript passerer. Ingen ekstern AI-tjeneste, serverdeployment, databaseændring, commit eller push.

APK `dist/Stromblik-1.0.47.apk`, versionCode 48, 79.787.751 bytes, SHA256 `FAF528100BA944009E52A07B0A503D958F852D43ED22DBCE9A59B911D346916F`. Gradle, aapt SDK 36, v2-signatur med samme debug/test-certifikat og 19 pakkede kildefiler verificeret. Isoleret klientstage, produktions-API uændret, ingen servercredentials i bundle.

Installeret via trådløs ADB med `install -r` Success og appdata bevaret. Installeret 1.0.47/versionCode 48 kontrolleret og MainActivity startet. Visuel bevoksningskontrol er udført i faktisk appmotor i Chrome/WebGL; fysisk visuel modelkontrol er ikke udført.

Referenceimplementering for samme adresse/matrikel som `HOUSE-LIDAR-PROTOTYPE.md`. Ingen ny ekstern AI-tjeneste, upload, databaseændring eller serverdeployment. Rå 21.757 matrikelpunkter ændres ikke. Alle øvrige adresser beholder eksisterende fallback.

## Beregning

`scripts/lidar/build-terrain.py` bruger alene kildeklassifikation 2. Af 10.829 terrænpunkter ligger 264 uden for det valgte terrændomæne (matrikel minus hus/garage). Identiske XY samles med median-Z; der er 10.562 unikke XY. En konservativ lokal plankontrol markerer kun isolerede afvigelser over mindst 30 cm med tilstrækkelig nabostøtte og uden støtte fra punkter på samme niveau. Ingen punkter opfylder disse kriterier i referenceudsnittet. Rigtige understøttede trin må ikke flades ud.

SciPy Delaunay i lokal XY giver 20.809 accepterede trekanter. Hver trekant skal ligge helt inden for matriklen, uden huller/bygninger, og have højst 1,5 m kantlængde. 525,82 m² af et 570,81 m² terrændomæne har sådan støtte. Dette er ikke hele ejendommens registrerede areal: bygningernes tagomrids er trukket fra. Uunderstøttede huller/områder under bygninger forbliver estimerede; der konstrueres ikke nye målte punkter.

Separat reserveflade klippes geometrisk til områder uden accepteret TIN. Den bruger tidligere gitter/DHM/bundhøjdefallback; den overlapper ikke den målte mesh. Klipning undgår z-fighting og forhindrer et groft gitter i at skjule den nye geometri. Eksisterende BBR/GeoDanmark/tagomrids-begrænsninger gælder stadig.

Runtime indlæser et indekseret net med originale XYZ. Ingen højdeforstærkning eller AI-opskalering. Spatialt trekantsindeks bruges til barycentrisk højdeopslag. Luftfoto er stadig muligt; standard er nu terrænfarver med lavere kameravinkel. Valgfrie 25 cm-højdekurver slås til separat. Det estimerede naboterræn/bygninger er ikke blevet nyopmålt.

## Tilbageholdte terrænpunkter

Deterministiske 0,5 m XY-blokke, ca. 20 procent, holdes ude før støjkontrol og triangulering. 8.211 træningspunkter, 2.354 tilbageholdte. TIN understøtter 2.297; gammelt gitter understøtter 2.354. Begge metoder sammenlignes på præcis de samme 2.297 understøttede punkter, uden at skjule forskellig dækning:

| Intern måling | TIN | Tidligere 0,5 m gitter |
| --- | --- | --- |
| RMSE | 0,02502 m | 0,02737 m |
| MAE | 0,01888 m | 0,01974 m |
| 95-percentil absolut fejl | 0,04910 m | 0,05563 m |

Forbedringen er beskeden, ikke en ny opmåling. Dette er spatial intern validering af samme flyvesurvey, ikke uafhængig landmåling eller dokumentation for centimeternøjagtighed i absolut koordinat/højde. Klassifikationsfejl og korrelerede surveyfejl kan være til stede i begge sæt. Begge metoder genberegnes på samme træningspunkter i terrændomænet; dette er en metodekontrol, ikke en sammenligning med gamle produktionsmålinger. Efter kontrol dannes release-modellen af alle accepterede kildeterrænpunkter. Kvalitetsrapport: `.tmp/lidar-parcel/terrain-quality.json`.

## Tagkontrol uden genbrug af træningspunkter

En separat LAS-testfil udelader kildeklasse-6-punkter i samme type 0,5 m blokke før Roofer-rekonstruktion. 839 tilbageholdte bygningspunkter tilhører husets omrids, 142 garagens. Testmodellen bruger ikke disse punkter. Distancer til dens rekonstruerede tagflader:

| Bygning | Median | 95-percentil | RMSE |
| --- | --- | --- | --- |
| Hovedhus | 0,0318 m | 1,1087 m | 0,5041 m |
| Garage/ekstra bygning | 0,0207 m | 0,0699 m | 0,1451 m |

Punkterne er klassificeret som bygning, ikke uafhængigt mærket som rene tagpunkter: vægge/kanter og andre bygningsreturer kan påvirke især halefejlen. Testmodellen finder fem tagplaner på hovedhuset mod fire i fulddata-modellen, hvilket også kræver kvalitetskontrol. Ingen certificeret tagpræcision kan udledes af disse tal. Den eksisterende fulddata-model bevares uændret; appen viser ekstra usikkerhedsnotits ved større afvigelser. `.tmp/lidar-parcel/roof-holdout-quality.json` indeholder rapporten.

## Værktøjer og kontrol

Python-container: pinned Python 3.12-base, laspy 2.6.1/lazrs 0.7.0, NumPy 2.2.6, SciPy 1.15.3, Shapely 2.1.1. Beregning offline, to CPU'er, 384 MiB hard RAM-grænse; tagtest offline i det allerede pinnede Roofer-image med 768 MiB. Ingen nøglefiler mounted. Hard limits er ikke målte spids-RAM-tal.

- `scripts/lidar/test-terrain.py`: plan interpolation, isoleret støjpunkt, bevarelse af et reelt trin, hulbegrænsning.
- `scripts/test-parcel-lidar.mjs`: råpunkter uændrede og inden for skel, bygningsmatch, TIN-kantgrænse, barycentriske højder, ingen TIN under huset og forkert adresse/skel afvist.
- Faktisk Chrome/WebGL-appmotor: to LiDAR-bygninger, 21.757 råpunkter, 20.809 terræntrekanter, højdekurver, punktvisning, soltid og fallback uden browserfejl.
- Scoped TypeScript-kontrol passerer.

Scripts: `build-terrain.py`, `prepare-roof-validation.py`, `scripts/report-roof-holdout.mjs`, `scripts/export-parcel-lidar.mjs`, `scripts/export-house-lidar-model.mjs`, `scripts/build-home-3d.mjs`. Den isolerede prøvefolder og råfiler er Git-ignorerede. Til nye huse kræves fortsat et separat modeljob; ingen landsdækkende automatik er indført.

Metodereferencer: [SciPy spatial](https://docs.scipy.org/doc/scipy/reference/spatial.html), [Shapely covers](https://shapely.readthedocs.io/en/2.1.0/reference/shapely.covers.html).

## APK

`dist/Stromblik-1.0.46.apk`, versionCode 47, 79.286.055 bytes, SHA256 `1A4F037C1B4AC41CA24A9F434391573477FF17AF170D612E16C0C3CC80D6CAA2`. Gradle assembleRelease, aapt target SDK 36, v2-signatur med det eksisterende debug/test-certifikat og sammenligning af 19 pakkede kildefiler passerer. Isoleret release-stage anvendt; API uændret `https://dit-hjem-five.vercel.app`, kontrol finder ingen servercredentials i klientbundle. Ingen commit, push eller serverdeployment.

Installeret over Wi-Fi på Samsung SM_A576B med `adb install -r` Success. VersionName 1.0.46/versionCode 47 bekræftet, MainActivity startet, data bevaret. Keyguard-status viste kort ulåst, men efterfølgende UI-dump viste låseskærmen. Den nye terrænvisning er derfor verificeret i faktisk appmotor i Chrome/WebGL, ikke visuelt på fysisk telefon. Ingen oplåsning eller brugeropsætning ændret.
