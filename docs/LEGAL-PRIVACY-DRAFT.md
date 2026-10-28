# Privatliv i Huslyg – publiceringsudkast

> 27. oktober 2026 – aktiveret: Den godkendte Energinet-backend og webklient er nu i produktion. APK 1.0.126 bruger samme nye kilde, men er endnu ikke installeret; ældre APK-versioner kan fortsat kontakte Strømligning direkte. Ny trafik: app/web → Huslygs backend; backend → Energinet med serverens netværksoplysninger, uden private målinger eller adresser. Strømligning beholdes kun til sammenligning i den nye kildepakke. Nedenstående beskrivelser af direkte Strømligning-trafik er historik for den hidtidige version. Se [aktivering og evidens](ENERGINET-PRICE-MIGRATION.md).


Version 0.3 · Opdateret 27. oktober 2026. **Hele politikken er fortsat ikke publiceringsklar eller trådt i kraft.** Rettighedsteksten under P04 er færdiggjort som selvstændigt tekstmodul; det gør ikke de øvrige afsnit eller publiceringen færdige.

Før publicering skal grundlag, faktiske modtagere/overførsler, opbevaringsperioder og native SDK-adfærd nedenfor færdiggøres. Dokumentet må ikke præsenteres som en fuld gældende politik. Produktets privacy-URL er endnu ikke aktiveret af denne opgave.

## Hvem er ansvarlig?

Huslyg udgives af BluePeach, CVR 40876375, c/o Mohammed Mousleh, Krog-Meyers Vej 28, 6400 Sønderborg, Danmark. BluePeach er dataansvarlig for de behandlinger, vi foretager som udbyder af Huslyg. Du kan kontakte Huslyg-teamet på info@huslyg.dk.

## Hvilke oplysninger bruger vi?

- **Konto og hjem:** mail, navn, konto-ID, adresse, husstandsmedlemskab og dine indstillinger. Login og profil håndteres blandt andet gennem Supabase.
- **Elforbrug, når du tilslutter det:** autoriserede målepunkter, tidsstemplede målinger, kvalitets-/importstatus og relevante måler-/netselskabsoplysninger fra Eloverblik. Målinger er historiske og kan være forsinkede eller ufuldstændige.
- **Dine egne analyser:** grafer, grundforbrug og forbrugsmønstre beregnet ud fra tilgængelige målinger. Sammenhold med priser kræver relevante historiske prisdata. Analyser er estimater, ikke sikker viden om, hvilke apparater eller personer der var aktive.
- **Bolig og tilvalg:** relevante adresse-/registeroplysninger, tag-/grundestimater og affaldskalender fra de anvendte datakilder. Hvis du uploader en plantegning, gemmer vi filen og dens metadata. En tilvalgt varmeintegration behandler nødvendige kunde-/installationsoplysninger og adgangsoplysninger.
- **Familiedeling:** inviterendes navn, modtagerens mail, invitation, accept og medlemskab. En modtager kan få en invitation, selv om vedkommende endnu ikke har konto.
- **Drift og enhed:** sessioner, nødvendige indstillinger og cache samt relevante request-, Auth- og fejloplysninger. Ved brug af hjemmesiden kan hostingtjenesten modtage IP-adresse og tekniske requestoplysninger. Det endelige enheds-/SDK-afsnit afventer C01/C02.
- **Dokumentation af kontosletning:** en serverbeskyttet journal med hash af konto-ID, tidspunkt, faktisk slettede hjem og nødvendige ejerskiftevalg skal forhindre, at en gammel backup genopretter slettede konti. Dette er pseudonyme personoplysninger; journalen indeholder ikke en kopi af mail/navn, forbrug eller filer. Nødvendig restperiode skal afstemmes med backup-/dokumentationsbehov under L05/L06.
- **Direkte prisforespørgsler:** klientens aktuelle prisvisning bruger Strømligning og sender periode, netselskabs-/kundegruppe-ID, prisområde og forecastvalg. Udbyderen modtager netværksoplysninger såsom anmodningens IP. Navn/mail og private målinger sendes ikke i denne query. Det særskilte historiske arkiv henter Energi Data Service-data via backend; udbyderne har ikke automatisk samme log-/licensvilkår.

Oplysninger kan komme fra dig, en inviterende bruger, Eloverblik, offentlige ejendoms-/prisdatakilder, relevante varme-/affaldstjenester og teknisk drift. Bolig-/forbrugsdata kan også vedrøre medbeboere uden konto. Den endelige information til disse personer skal afstemmes med grundlaget for den konkrete behandling.

## Hvorfor og på hvilket grundlag?

Udkastet til grundlagsfordeling er aftaleopfyldelse for objektivt nødvendige dele af den tjeneste, du bestiller: konto, tilvalgt forbrugs-/boligvisning, privat filopbevaring og accepteret familiedeling. Funktionelle invitationer og nødvendig sikkerhedsdiagnose vurderes særskilt efter interesseafvejning. Opfyldelse af konkrete retlige pligter har sit eget grundlag. [Den detaljerede matrix](LEGAL-PROCESSING-BASES.md) skal afsluttes før dette afsnit kan godkendes som endelig information.

En fuldmagt til Eloverblik er et adgangskrav og er ikke et samtykke til enhver anvendelse. En notifikationstilladelse er heller ikke et reklamesamtykke. Første udgivelses kundedataformål omfatter egne appfunktioner, familiedeling og nødvendig drift/support; generel AI-træning, reklameprofilering og videresalg er fravalgt.

Du vælger tilvalgte integrationer, uploads og påmindelser. Uden nødvendige kontooplysninger kan vi ikke oprette en privat konto; uden forbrugsforbindelse kan vi ikke importere dit forbrug. Afslag på en tilvalgt funktion skal ikke fremstilles som en pligt til at afgive alle andre oplysninger.

## Hvem får adgang?

Accepterede familiemedlemmer får adgang til hjemmets fælles bolig-/forbrugsdata og fælles dokumenter efter adgangsmodellen. Dit eget navn og din mail bliver ikke erstattet af ejerens identitet; medlemmernes navne/mail vises dog i familiens medlemsoversigt. At identiteten er personlig betyder ikke, at den er skjult for alle andre medlemmer.

Vercel og Supabase leverer hosting, backend, Auth og database. Resend er aktiveret til familieinvitationer; ejeren har bekræftet modtagelsen af en særskilt kontrolmail. Det er ikke bevis for et gennemført familieacceptflow. Relevante dataleverandører behandler forespørgsler ved de funktioner, der faktisk bruges. [Leverandørregisteret](LEGAL-SUPPLIERS-AND-RETENTION.md) skal fortsat afstemmes med fulde aftale-/overførselsoplysninger før publicering. Leverandørers egne kontoforhold kan have selvstændige formål.

Kun ejeren er oplyst som intern administrator og supportansvarlig. Leverandørers autoriserede drifts-/supportadgang er et særskilt forhold. EU-funktionshosting er ikke dokumentation for, at alle logs, backups og supportadgange forbliver i EØS. **Modtagerlande, relevante overførselsgrundlag og adgang til garantier skal indsættes efter L03/L04; der gives ingen “alt bliver i EU”-garanti.**

## Sikkerhed og kryptering

Forbrugspayloads er krypterede, men metadata har anden beskyttelse. Det administrerede nøgleflow betyder, at backend teknisk kan håndtere nøgler og dekryptering. Plantegninger og tidligere husmodeller er ikke beskyttet af samme forbrugsvault. Komprimering og base64 er ikke kryptering. Varmecredentials har separat serverkryptering. Vi beskriver derfor ikke tjenesten som serverblind eller alle data som ende-til-ende-krypterede.

## Hvor længe gemmes oplysninger?

Det valgte private arkiv skal bevare alle tilgængelige importerede forbrugsdata til dine historiske dage/timer og sammenligning af år. Det er et konkret arkivformål; ikke lagring til ukendte fremtidige træningsformål. Afbrydelse af ny import er forskelligt fra sletning af arkivet.

**Før publicering skal endelige periodekriterier ved konto-/husstandsophør samt frister for invitationer, revisioner, support-/rettighedssager, logs og backups fastlægges og indsættes.** Invitationsgyldighed på 7 dage er ikke en slettefrist, og cachebudget er ikke en opbevaringspolitik. Vi lover ingen faktisk automatisk oprydning, som ikke er implementeret.

## Dine rettigheder

Du kan bede om indsigt og en kopi af dine personoplysninger, rettelse af fejl, sletning eller begrænsning af behandling. Hvor betingelserne er opfyldt, kan du få oplysninger udleveret i et maskinlæsbart format og overført til en anden udbyder. Du kan gøre indsigelse mod behandling baseret på legitime interesser ud fra din situation.

Hvis en behandling bygger på samtykke, kan du trække det tilbage ved at skrive til os eller bruge funktionens fravalg. Tilbagetrækningen ændrer ikke lovligheden af tidligere behandling. Rettighedernes betingelser og hensyn til andre kan påvirke resultatet; vi forklarer konkrete begrænsninger.

Skriv til **info@huslyg.dk**. Vi kontrollerer din identitet forholdsmæssigt. Send ikke adgangskode, API-nøgle eller engangskode. Vi svarer normalt senest én kalendermåned efter modtagelsen; en mulig forlængelse begrundes inden da. Du kan klage til [Datatilsynet](https://www.datatilsynet.dk/borger/klage). Kontakt os gerne først, så vi kan forsøge at løse problemet.

En privat Huslyg-konto kræver en mailadresse. Uden tilsluttet forbrugsforbindelse kan vi ikke hente dit elforbrug. Du behøver ikke uploade en plantegning eller vælge påmindelser for at bruge de øvrige tilgængelige funktioner. Afbrydelse af ny import er ikke automatisk sletning af dit gemte arkiv.

Appen beregner mønstre og estimater for hjemmet. Der er ikke identificeret afgørelser baseret udelukkende på automatisk behandling med retsvirkning eller tilsvarende væsentlig betydning i det afgrænsede scope. Det betyder ikke, at adfærdsanalyser er anonyme eller uden personrisiko.

## Versioner og ændringer (P06 – etableret procedure, publicering afventer)

Ved godkendt publicering skal denne tekst have et faktisk ikrafttrædelsestidspunkt, versions-ID og arkiveret kopi. Væsentlige ændringer i formål, databrug eller rettigheder meddeles klart via relevant in-app-information og/eller registreret kontaktkanal, før ændringen sættes i kraft hvor påkrævet. Information om politikken er ikke en generel samtykkeboks. Nyt samtykkekrævende formål må først aktiveres efter gyldigt valg.

[Versionsregister og konkret meddelelses-/arkivprocedure](LEGAL-POLICY-VERSIONING.md) er nu etableret. Udkast 0.3 er ikke en gældende offentlig version; ikrafttrædelsesdatoen sættes først ved godkendt publicering.

Planlagte placeringer: før oprettelse/tilslutning, profil/indstillinger og webfooter. P01/P05/P06 er ikke afsluttet gennem dette udkast. P02/P03 skal kontrolleres mod det endeligt afklarede scope. P04 afsluttes 27. oktober som beskrivelsesopgave: rettigheder, kontakt, klage, samtykketilbagetrækning og konsekvens ved fravalg er nu beskrevet. Den færdige publicering skal bevare dette tekstmodul og kontrolleres under P01/P05/LANC03; de tekniske rettighedsprocesser er særskilte R02/R05/R08/R09.

P04-kilder genkontrolleret 27. oktober 2026: [Datatilsynet – rettigheder](https://www.datatilsynet.dk/borger/hvad-er-dine-rettigheder) og [klagevej](https://www.datatilsynet.dk/borger/klage). Rettighedsteksten beskriver betingede rettigheder; ingen ny generel samtykkebehandling indføres af teksten.
