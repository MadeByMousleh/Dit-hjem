# Første LiDAR-rekonstruktion

2026-10-18. Lokal prototype, ikke integreret i appen eller deployet.

## Verificeret datagrundlag

Referenceadresse-ID `0a3f50b7-b15d-32b8-e044-0003ba298018`, bygning `1072861659`. Eksisterende adresse/BBR/GeoDanmark-adapter leverer én L-formet hovedbygningspolygon. Omridsets præcise tagkant/vægkant-semantik og udhæng er stadig en kvalitetskontrol før produktion.

Datafordelerens faktiske punktskykatalog og fildownload virker med den eksisterende servernøgle. Ingen nøgle blev udskrevet eller ændret. Bbox returnerede fire historiske/aktuelle kandidater. Valgt nuværende datasæt `Punktsky`, levering 1, fil-ID `7c009514-13b5-4e88-8f44-833b0b9ec1ea`. Filen blev streamet til disk og dens størrelse kontrolleret: 397,601,990 bytes. Ikke indlæst som ét Node-bufferobjekt.

LAS 1.4, komprimeret punktformat 7, 21,292,185 punkter, 1 km-flise. WKT-VLR bekræfter ETRS89/UTM32 + DVR90, EPSG:7416 (horisontalt EPSG:25832, vertikalt EPSG:5799). Headerens filoprettelsesdato er dag 64 i 2024. Roofer angiver `rf_pc_year=2024`; egentlig flyve-/opmålingsdato er endnu ikke verificeret uafhængigt. Katalogets generationstid 2025 er ikke opmålingsåret.

## Beregning og model

Officielt image `3dgi/roofer:v1.0.0`, digest `sha256:dd2c415aaee337502bde0dc1426dfa9c9f88e648f9d2f6340110c49932c251d2`. Eksisterende Docker-motor brugt; intet nyt cloud-abonnement. Containeren har netværk deaktiveret, hard limit 768 MiB, ingen swap ud over hukommelsesgrænsen og højst to CPU'er. Kun forsøgsfolderen er mounted, ikke projektets miljøfiler. En første container stoppede med argumentfejl, før beregningen startede; PowerShell-argumentopbygningen blev rettet. Container `dit-hjem-lidar-trial-v2` afsluttede med exit 0, OOMKilled=false. Containergrænsen er dokumenteret, ikke en måling af spids-RAM.

21 millioner punkter blev gennemgået/beskåret til én bygningspolygon og buffer. Hele forløbet efter containerstart tog cirka 24 sekunder, selve rekonstruktionsattributten rapporterer 43 ms. Det lille LAS-udsnit er 100,626 bytes og indeholder 4,972 punkter: 2,868 klasse 6 og 2,104 klasse 2.

CityJSONSeq-output er 3,776 bytes med LoD2.2-geometri, fire tagflader og to rygninger. Modellen er cirka 15.25 x 13.00 m og 4.176 m fra den beregnede bund til højeste tagpunkt. Bundhøjden 7.32 m kommer fra Roofers bufferbaserede terrænstrategi, ikke en verificeret gulv/sokkelmåling. Kontrollér lokal terrænhældning og tagudhæng før disse mål bruges som præcise vægmål.

Roofer rapporterer tæthed 25.216 punkter/m², ingen rasteriserede datamangler og RMSE 0.4125 m. En separat beregning af afstand fra alle beskårne klasse-6-punkter til de rekonstruerede tagtrekanter gav median 0.0354 m, 95-percentil 0.2708 m og RMSE 0.4124 m; 91.70 % ligger inden for 20 cm. Dette er fit til de samme inputpunkter, ikke tilbageholdt validering eller garanti om opmålingspræcision. Facade-/andre bygningspunkter og udliggere kan påvirke tagafstanden. Halefejlen skal undersøges, ikke skjules med selektiv filtrering.

## Artefakter og gentagelse

- `.tmp/lidar-reference/preview.html`: selvstændig interaktiv Three.js-model med til/fra for model og røde målepunkter; ingen eksterne scripts eller fototeksturer.
- `.tmp/lidar-reference/model.png` og `model-with-points.png`: actual Chrome/WebGL-renderinger.
- `.tmp/lidar-reference/report.json`: maskinlæsbare mål og kvalitetsrapport.
- `.tmp/lidar-reference/output/552846_6086847.city.jsonl`: original rekonstruktion. SHA256 `dc9246d5f6bc4514d36a56d2c5ae1bf415ef8b44ce990439765816de4ebacb48`.
- Forsøgsdata er ignoreret i Git; den store fil skal ikke committes.

Kør `node scripts/probe-house-lidar.mjs --download`, derefter `./scripts/reconstruct-house-lidar.ps1 -ContainerName <nyt-forsøgsnavn>`, `node scripts/report-house-lidar.mjs` og `node scripts/build-house-lidar-preview.mjs`. De to sidste giver rapport og HTML; bundling kræver esbuild. Adapteren i `src/services/home-lidar-server.mjs` er ikke forbundet til en offentlig route. Den nuværende download-probe er til én referenceadresse og én flise; multi-flisevalg og driftssikring skal implementeres før landsdækkende brug.

## Appintegration, 2026-10-18

### Hele matriklen og garage, efterfølgende udvidelse

Senere forbedring: referencehusets terræn bruger nu et faktisk TIN med spatial holdout-kontrol og separate reserveområder; se `docs/TERRAIN-TIN.md` for beregning, tagkontrollens begrænsninger og APK 1.0.46. Beskrivelsen af 0,5 m gitter nedenfor er den tidligere version; det bevares kun som reserveflade.

Ny APK: `dist/Stromblik-1.0.45.apk`, versionCode 46, 77.990.187 bytes, SHA256 `8EAA1DB399A6F01DCC3A45CB0496DE5F742FD35A4663BF32EB0B485CE6E6B37F`. Gradle, aapt SDK 36, v2-signatur med samme eksisterende debug/test-certifikat og sammenligning af 19 pakkede kildefiler passerer. Produktions-API uændret; ingen servercredentials i klientbundle. Isoleret release-stage opdateret med kun dette increments klientfiler. Ingen serverdeployment, databaseændringer, commit eller push.

Installation på Samsung SM_A576B over Wi-Fi: `adb install -r` Success, installeret versionName 1.0.45/versionCode 46 bekræftet, MainActivity startet. Data bevares. Første UI-dump viste appens sikre opstart; næste viste låseskærmen, så den endelige 3D-visning er ikke fysisk kontrolleret. Ingen oplåsning eller brugeropsætning blev ændret.

Referenceforløbet inkluderer nu begge tilknyttede bygninger: `1072861659` (hovedhus) og `1072862383` (ekstra bygning/garage). Begge rekonstrueret med Roofer, offline, 768 MiB RAM-grænse, exit 0, OOMKilled=false. 31 tagtrekanter og 60 vægtrekanter i alt. Den oprindelige referencefolder er bevaret; det nye forløb ligger i ignoreret `.tmp/lidar-parcel`. `scripts/prepare-parcel-lidar.mjs` bruger den allerede downloadede flise via hardlink og afviser matrikler, der kræver yderligere fliser. Det er fortsat en referenceintegration, ikke en automatisk service for alle adresser.

Matriklens faktiske polygon, inklusive eventuelle huller, bruges til råpunktbeskæring. Offline laspy-container med 100.000 punkter pr. batch, 384 MiB hard RAM-grænse og to CPU'er, exit 0, OOMKilled=false. Et første forsøg fejlede ved bibliotekets skalar-feltkonvertering; rettet til NumPy-arrays før det vellykkede forsøg. Alle 21.757 gyldige returpunkter inden for matriklen er bevaret, ingen udtynding: klasse 2 terræn 10.829, klasse 6 bygning 4.599, klasse 3/4/5 vegetation 528/2.752/2.889 og øvrig klasse 8 160. Ingen withheld-punkter i udsnittet. Farver i appen er klassifikationsfarver, ikke fotografiske farver eller nye verificerede objektidentiteter.

Terræn dannes fra klasse 2 alene på et 0,5 m gitter med median pr. celle (2.306 besatte af 3.388 celler). Lokalt afstandsvægtet interpolation højst 1,5 m; i huller/uden for skellet bruges eksisterende DHM-raster, eller den eksisterende bundhøjdefallback når raster mangler. Gitterafstanden er ikke et præcisionsløfte. Hus og garage bruger egne rekonstruerede bundhøjder; sokkel/gulv er ikke opmålt.

Husets fire rekonstruerede tagflader har ca. 14,0 / 11,1 / 15,0 / 9,5 graders hældning og samlet 156,2 m² skråt modelareal. Ekstra bygning har to flader på ca. 14,5 / 15,7 grader, samlet 29,4 m². Areal er trekantsareal; hældning/retning bruger hele polygonens Newell-normal, ikke de første tre muligvis næsten kollineære punkter. Fladeafvigelse fra normalplanet registreres og vises som usikkerhed ved >15 cm. Fit-RMSE til egne input er 0,413 m / 0,193 m, ikke ekstern opmålingsnøjagtighed.

Appen tilbyder Model, LiDAR-punkter og Sammenlign. Alle råpunkter pakkes i `src/generated/lidar-parcels.ts`; visning kræver korrekt adresse-ID, matrikel-ID'er, CRS og uændrede skelpolygoner. Andre adresser får ikke disse punkter. `scripts/test-parcel-lidar.mjs` kontrollerer alle punkters skelplacering, eksport uden tab, begge bygningsmatch, ændret skel og forkert adresse. Scoped TypeScript og faktisk Chrome/WebGL-modelkontrol passerer uden browserfejl. Skærmbilleder i `.tmp/lidar-parcel/integrated-app-model.png`, `integrated-parcel-points.png`, `integrated-parcel-both.png`.

Gentagelse: `node scripts/prepare-parcel-lidar.mjs`, kopiér `scripts/lidar/crop-parcel.py` til prøvefolderen, byg `scripts/lidar/Dockerfile`, kør crop-container offline med kun prøvefolderen mounted, kør rekonstruktionsscript med ny ContainerName og TrialDirectory, derefter `node scripts/export-house-lidar-model.mjs --dir=.tmp/lidar-parcel`, `node scripts/export-parcel-lidar.mjs` og `node scripts/build-home-3d.mjs`. Laspy: [officiel chunked-reading-dokumentation](https://laspy.readthedocs.io/en/latest/basic.html). Ingen punktbehandling på telefonen eller serverdeployment er nødvendig for referencepakken.

Efterfølgende installation: telefonen blev synlig over trådløs ADB. `adb install -r` afsluttede med Success; installeret versionName 1.0.44/versionCode 45 kontrolleret, og MainActivity startet. Appdata bevaret ved opdatering. Den nye models visuelle udseende på telefonen er endnu ikke kontrolleret.

Efter prototypeforløbet er referencehusets faktiske LoD2.2-model integreret i Hus & sol. `scripts/export-house-lidar-model.mjs` eksporterer 23 tagtrekanter og 40 vægtrekanter fra det originale CityJSON til `src/generated/lidar-models.ts`; ingen rå punktsky eller servernøgle pakkes i appen. Match kræver samme adresse-ID, bygnings-ID, EPSG:7416 og uændret omrids (0.15 m tolerance). Andre adresser/bygningsomrids bruger den eksisterende fallback, ikke referencehusets model.

Appens eksisterende Three.js-motor bruger disse trekanter til synlig geometri og solskygger. For referencehuset vælges forenklede materialer som standard for at bevare skarp geometri; fotovisning kan stadig vælges. UI viser begrænsninger ved tagkanter og sokkelhøjde. Ingen automatisk landsdækkende modelservice er tilføjet.

Scoped TypeScript-kontrol passerer. Chrome/WebGL-kontrol af den faktiske appmotor bekræfter LiDAR-rendering, ændring af soltid, afvisning af anden adresse/bygnings-ID/ændret omrids og fallback uden browserfejl. Skærmbilleder: `.tmp/lidar-reference/integrated-app-model.png` og `integrated-app-late-sun.png`. Dette er ikke fysisk telefonkontrol eller uafhængig opmålingsvalidering.

APK `dist/Stromblik-1.0.44.apk`, versionCode 45, 76,470,423 bytes, SHA256 `118E30EB666C8237C2581B24EF4C2B64A885436BBD39D4CD77768945A03EB481`. Gradle assembleRelease, aapt target SDK 36, v2-signatur med samme eksisterende debug/test-certifikat og sammenligning af 18 pakkede kildefiler passerer. Bundlet API er `https://dit-hjem-five.vercel.app`; kontrol finder ingen servercredentials i klientbundle. APK blev bygget fra den isolerede release-stage med denne ændrings filer opdateret. Ingen ADB-enhed var tilsluttet ved afsluttende kontrol; installation og fysisk visuel kontrol er ikke udført. Ingen serverdeployment, databaseændring, commit eller push.

## Næste kvalitetskontrol

Sammenlign tagfod/rygninger og omridset mod de kalibrerede 2025-skråfotos. Undersøg 41 cm RMSE og lokale terræn-/vægkanter. Valider modellen på tilbageholdte punkter og flere tagtyper. Først derefter implementeres modeljob, cache, GLB/mesh-indlæsning i appen og fotografiske materialer. Ingen appændringer, APK, produktion, databaseændringer, commit eller push i denne prototype.
