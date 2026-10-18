# Plan: skarp, datadrevet husmodel

Dato: 2026-10-18. Plan, ikke en implementeret eller deployet LiDAR-pipeline.

## Beslutning

Afprøv rå DHM-punktsky + kontrollerede GeoDanmark-tagomrids med PDAL og Roofer. Byg en kompakt model af rigtige tagflader, facader og terræn. Brug kalibrerede skråfotos og kundens valgfrie facadefoto til udseende og understøttede detaljer. Genbrug Three.js-visningen og solberegningen. Første leverance er en dokumenteret sammenligning på referencehuset, ikke endnu en facadeeffekt uden kontrol mod data.

Skarp geometri, skarpe materialer og opmålingspræcision er tre forskellige egenskaber. Glatte tagflader skal komme fra en rekonstruktion, ikke blot udglatning af alle rasterpunkter. Teksturer må ikke forstørres og præsenteres som ny billedinformation. Høj præcision skal dokumenteres med datakvalitet og residualer, ikke antages ud fra modellens udseende.

## Nuværende begrænsninger, verificeret i koden

- `src/services/home-height-server.mjs` henter DHM/Terræn og DHM/Overflade som raster med cirka 0,4 m celler, højst 256 x 256. Den henter ikke rå LAS/LAZ-punkter.
- `src/web/home3d.ts` triangulerer et omrids og sætter højder efter lokale rastermedianer. Den finder ikke egentlige tagplaner, rygninger eller skæringslinjer. Flere trekanter alene løser ikke dette.
- `src/web/projected-photos.ts` har allerede kalibreret billedprojektion. Den skal forbedres og genbruges efter geometrien er korrekt; den kan ikke rette et forkert tag.
- Rå LiDAR-adgang, punktklassifikation, nyere punkttæthed og en færdig rekonstruktion på referencehuset er endnu ikke verificeret.

## 1. Verificér data på referencehuset

1. Slå adresse -> BBR-bygning -> GeoDanmark-ID og parcel op gennem de eksisterende adaptere. Bevar separate bygninger/tilbygninger.
2. Slå aktuelle punktsky-leverancer op med Datafordelerens dokumenterede katalogmetoder og den eksisterende servernøgle. Kontroller rettigheder ved et faktisk metadata- og fildownload; tilstedeværelsen af en nøgle er ikke adgangsbevis.
3. Vælg de nødvendige filer ved bbox og download via entydigt fil-ID. Følg paginering og kontroller dataleverancen; katalogets rækkefølge er ikke defineret. Cache større fælles fliser, men beskær til bygning og en begrænset buffer til beregningen. En bbox-forespørgsel er ikke nødvendigvis et lille punktskyudsnit på serveren.
4. Registrér optagelsesdato, faktisk punkttæthed, klassifikation, XY-reference og vertikalt datum. Sammenhold EPSG:25832/DVR90 med billedernes kalibrering. Generationstid må ikke forveksles med opmålingsdato.
5. Kontroller om GeoDanmark-polygonen beskriver tagkant eller væg/fodaftryk. Roofer forventer et tagomrids; udhæng må ikke blive til for brede vægge uden kontrol.
6. Undersøg kommunen for en eventuel tilgængelig LoD2/LoD3-model. Brug den kun, hvis adgang, licens, dækning, alder, datum og faktisk kvalitet er verificeret. Der antages ingen landsdækkende, fotorealistisk husmodel-API.

Leverance: lille datarapport og punktskyvisning for huset, inklusive mangler og kildeår. Stop eller vælg en tydelig fallback, hvis adgang/dækning ikke er tilstrækkelig.

## 2. Rekonstruér formen med eksisterende værktøjer

PDAL håndterer beskæring, klassifikation, støjfiltrering og højder over terræn. Bevar terræn- og bygningspunkter adskilt; klassifikationskoder kontrolleres mod den faktiske leverance. Punkter uden en brugbar bygningsklassifikation kræver rumlig/geometrisk filtrering, ikke blind sletning.

Roofer er første kandidat til automatisk LoD2.2-rekonstruktion fra punktsky og tagomrids. Benchmark først på huset og derefter på fladt tag, sadeltag, valmtag, L-form og sammenbyggede bygninger. Kontroller dets dataforudsætninger og GPLv3-licens før produktionsvalg. Det er en kandidat, ikke en verificeret løsning til vores danske input endnu.

Output skal indeholde sammenhængende tagplaner, rygninger, tagfod, vægge og kilde-/kvalitetsmetadata. Bevar nødvendige måleunderstøttede tagdetaljer. Tving ikke alle huse til en standardtagform. Træer, manglende punkter og ombygninger kan give utilstrækkeligt grundlag; det skal udløse en lavere detaljeringsgrad frem for opfundet geometri.

## 3. Gør modellen visuelt skarp

- Bevar hårde normaler ved tagkanter/rygninger og glatte normaler på sammenhængende plane overflader. Ingen global udglatning, der gør taget rundt.
- Vælg bedst belyste, ubeskyggede kildefotos ud fra kamera, synlighed, pixelopløsning og dato. Undgå at blande historiske ombygninger.
- Byg UV-atlas med synlighedskontrol og begræns sømme/farvespring. Kalibrer mod den nye geometri. Opløsningen bestemmes af native kildepixels, ikke af en lovet 4K-tekstur.
- Tilbyd både en fotografisk visning og en ren materialebaseret visning. Billedets indbagte skygger må ikke ligne den valgte simulations skygger.
- Kundens ene foto forbedrer kun den synlige del. Registrér det mod kendte facadeplaner, udtræk vindues-/dørkonturer og sprosser og kontroller billedoverlejring. Beskårne fotos må ikke strækkes over hele facaden. AI hjælper med semantik; den fastlægger ikke husets mål.

## 4. Sol og skygger på samme datagrundlag

Brug den rekonstruerede geometri til både visning og skyggemodel. En optimeret skyggemesh må bevare alle væsentlige kanter og volumener fra samme model. Medtag nærliggende bygninger og terræn; udvid området adaptivt til lave solhøjder uden at love ubegrænset horisontdækning. Vegetation kræver separat kvalitetsmærket behandling og årstidsantagelser.

Kontroller nordretning, lokale verdenskoordinater, absolutte højder, København/DST og solvektorens fortegn. Tilpas shadow-map-udsnit, opløsning og bias til huset, så tekniske skyggefejl ikke forveksles med geometrifejl. Korrekt solposition er ikke i sig selv bevis for korrekte skygger.

## 5. Drift uden kundens RAM

Kør rekonstruktionen som et køjob i en separat container/worker. Vercel starter jobbet og leverer status; telefonen modtager kun den færdige model. Start benchmark med én opgave ad gangen på en lille CPU-worker, eksempelvis 4 vCPU/8 GB RAM, og mål faktisk spidsforbrug og tid. Det er et forsøgsbudget, ikke et dokumenteret hardwarekrav eller en garanti. GPU er ikke et indledende designkrav for denne pipeline.

Gem kilde-/målemodellen som CityJSON eller tilsvarende og en lokalcentreret GLB til mobilen. Optimer mesh og komprimer teksturer uden at fjerne tagkanter. Cache offentlige bygningsmodeller efter bygnings-ID, dataleverance og pipelineversion; hold private facadefotos og forbedringer konto-/boligafgrænset. Genbrug downloaded fliser og kør ikke rekonstruktion hver gang siden åbnes. Job skal kunne genoptages og fejle uden at erstatte den sidste brugbare model.

## Godkendelseskriterier før bred udrulning

Mål geometrifejl mod tilbageholdte LiDAR-punkter pr. tagplan, og rapportér både median og høje percentiler. Kontroller dataalder, tagkanter og punkthuller særskilt; kildeopløsning begrænser acceptable mål. En pæn model alene er ikke et bestået resultat.

Sammenlign silhuet, tagfod, rygning og facadeplacering fra flere kalibrerede billeder. Kontrollér originale facadefotos mod detekterede konturer. Test sol/skygger på kendte primitive geometrier og med relevante nabobygninger. Mål filstørrelse, RAM, indlæsning og billedhastighed på den tilsluttede Samsung. Foreløbigt mobilmål: stabil interaktion omkring mindst 30 fps; mål og juster før det bliver et produktløfte.

Først når referencehuset og et varieret sæt andre huse består, integreres automatisk generering for alle kunder. Første implementeringstrin er dataadgang + et Roofer-forsøg med en neutral, skarp model; fototeksturer og facadedetaljer kommer efter verificeret form.

## Primære kilder kontrolleret 2026-10-18

- Datafordeleren, aktuelle punktsky-fildownload: https://confluence.kds.dk/display/DML/Punktskybaserede%2Bfildownload
- Datafordeleren, adgang/autentifikation: https://confluence.kds.dk/pages/viewpage.action?pageId=151999753
- Roofer, funktioner og licens: https://innovation.3dbag.nl/roofer/
- Roofer, inputkrav: https://innovation.3dbag.nl/roofer/data_requirements.html
- PDAL, filtrering: https://pdal.io/en/latest/stages/filters.html
- PDAL, højde over terræn: https://pdal.io/en/stable/stages/filters.hag_nn.html
