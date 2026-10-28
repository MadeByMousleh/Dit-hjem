# Ti næste punkter – kontrolrunde 27. oktober 2026

Udgangspunkt: 38 afsluttede / 70 åbne. Valgte punkter: **E06, E07, C05, X03, X05, T05, V06, R04, P02, P06**. Et gennemgået punkt er ikke automatisk afsluttet. Status og bevisgrænser nedenfor styrer afkrydsningen; ingen releasegodkendelse udledes af antallet.

## E06 – historiske målinger, estimater og prisforudsætninger

Afsluttet for den gennemgåede native kandidat 1.0.124. SHA256-kontrol viser identiske root-/stagekilder for de syv kontrollerede kort/grafer. Denne kandidat er bygget, men ikke installeret eller offentligt publiceret; endelig version skal genkontrolleres under LANC03.

| Visning | Konkrete oplysninger i koden |
| --- | --- |
| Grundforbrug | `Ca.`, kWh/døgn, antal hele dage og slutdato. Foreløbigt niveau markeres; solceller/batteri nævnes som påvirkning. |
| Tag | `Ca.` med afrunding af areal/hældning, gennemsnit for flader og eksplicit manglende beregningsgrundlag. |
| Forbrug/pris | Estimat er ikke en regning; forbrugsprisen oplyser moms, elafgift, nettarif og elaftale. Widgets viser faktisk dato/til-dato og markerer datamangler. |
| Spot-/totalpris | Prisgrafen skelner mellem spot uden moms/net/afgifter og total med moms/net/afgifter uden leverandørtillæg/abonnement; kommende prognosedage mærkes. |
| Strøm i billige timer | Andel kWh i komplette døgn, datadækning, cirka billigste fjerdedel og område. Metoden bruger spotpris uden tarif/afgifter/abonnement. |

`test-electricity-baseline.mjs`, `test-electricity-price-share.mjs` og de relevante tagberegninger i `test-home-simple.mjs` passerer. Det er kontrol af algoritmer/visningstekster med syntetiske data, ikke en garanti for alle leverandørværdier eller en nøjagtig fysisk opmåling. E01/E03/F05 og alle andre datakilde-/adgangskrav forbliver særskilte.

Evidens: `.tmp/legal-all/next-ten-source-audit.json` indeholder filnavne og begge hashes. Ingen appkode eller farve-/grafvalg er ændret i E06-kontrollen.

## E07 – grøn strøm, CO₂ og spareløfter

Afsluttet som betinget vurdering for samme scope: Der er ikke fundet en visning med en beregnet personlig grøn andel, CO₂-besparelse eller et garanteret sparebeløb i de gennemgåede aktive el-/boligkort. Prisandel og budgetprognose er ikke dokumentation for disse påstande. Et eksternt energimærke præsenteres som Energistyrelsens bygningsoplysning, ikke som Huslygs måling af brugerens strømoprindelse.

Før en sådan påstand tilføjes, genåbnes E07 med konkret kilde/version, tids- og geografisk opløsning, beregningsmetode, usikkerhed og en realistisk mængde flytbart forbrug. Grøn farve eller negativ spotpris må ikke forklares som dokumenteret CO₂-effekt. Ingen ny grøn-/sparefeature er aktiveret.

Grundlag: kodekontrol samt [Forbrugerombudsmandens krav om dokumenterbare miljøudsagn](https://forbrugerombudsmanden.dk/alle-emner/forbud-mod-vildledning/miljoemaessige-og-etiske-udsagn-i-markedsfoeringen). Dette godkender ikke fremtidige annoncer eller beregninger.

## C05 – Apples ATT

Afsluttet som vurdering af det valgte formål: Eget mail-login, privat energivisning og funktionelle leverandørkald etablerer ikke alene den reklamekobling på tværs af virksomheder eller datamæglerdeling, som [Apple beskriver som tracking](https://developer.apple.com/app-store/user-privacy-and-data-use/). Ingen direkte annonce-/attributions-SDK blev identificeret i appens dependencydeklaration; der tilføjes derfor ikke en formålsløs ATT-dialog.

**Det er ikke en undersøgelse af en færdig iOS-binær eller en garanti for tredjeparts-SDK-adfærd.** I04/C01/I03 skal fortsat verificere faktisk binær, netværksadfærd og butikserklæringer før iOS-release. Hvis et SDK genbruger data til annoncekobling, IDFA/admåling, datamæglere eller tilsvarende tracking, genåbnes C05, og aktiviteten må ikke begynde uden de nødvendige valg/kontroller. ATT erstatter ikke EU-regler om terminaladgang eller GDPR.

## X03 – AI-forordningens anvendelse

Afsluttet som scope-/rollevurdering, ikke en godkendelse af alle gamle AI-ruter:

| Tjenestedel | Vurdering og gate |
| --- | --- |
| Grundforbrug og prisandel | De gennemgåede funktioner er faste beregningsregler over målinger/priser, ikke træning af en generel model. Der er ikke identificeret et højrisikoformål som kredit, beskæftigelse eller biometrisk vurdering. |
| Eksterne prisprognoser | Visningen skal forblive mærket prognose. At vise leverandørdata er ikke bevis for, at Huslyg selv leverer den underliggende AI-model. Konkrete ændringer af rolle/anvendelse kræver ny vurdering. |
| Lokale farve-/hækforsøg og billedanalyse | Uden for den brugerrettede første udgivelse. Ved erhvervsmæssig brug af eksterne modeller skal anvenderrollen vurderes; ved egen model leveret under eget navn også udbyderrollen. En skjult fane stopper ikke i sig selv backendkald, så X02/T02 er fortsat åbne. |
| Fremtidig fotorealistisk 3D/AI | Klassificér før aktivering, og vurder transparens/mærkning konkret. Ingen automatisk antagelse om, at alt 3D er en deepfake eller at alt er fritaget. |

[Kommissionens aktuelle oversigt](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai), kontrolleret 27. oktober, angiver forbud/AI-færdigheder fra februar 2025, generel anvendelse/transparens fra august 2026 samt særskilte senere højrisikofrister. Der anvendes ingen generel udsættelse af alle krav til 2027. Risikofattigt formål er heller ikke i sig selv en GDPR-/leverandørfritagelse.

Intern regel: Ejeren skal forstå begrænsninger, fejlkilder, datagrundlag og menneskelig kontrol før erhvervsmæssig AI-brug. Dokumentér faktisk instruktion/kompetence og nødvendige tiltag før nye personer eller AI-funktioner tages i brug. Dette dokument beviser ikke et gennemført kursus eller alle artikel 4-foranstaltninger. Genåbn X03 ved nye modeller, egen distribution, ændret målgruppe eller brug til beslutninger med væsentlig virkning.

## X05 – tilgængelighed og mikrovirksomhed

Afsluttet på ejeroplyste forhold: Ejeren oplyste “bluepeahc har aldrig tjent noget indtil videre” og bekræftede derefter under ti ansatte, inklusive eventuelle tilknyttede virksomheder, i begge seneste afsluttede regnskabsår. Der er ikke indhentet regnskabsbilag eller gennemført en koncernrevision; afgrænsningen genåbnes, hvis andre tilknyttede virksomheders økonomi ændrer grundlaget.

På dette oplyste grundlag behandles BluePeach som mikrovirksomhed ved vurdering af **tjenesten**. [Myndighedsvejledningen](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester/vejledninger/tilgaengelighed-undtagelser-og-mikrovirksomheder) angiver under ti årsværk og enten omsætning eller balance højst 2 mio. euro samt regler om regnskabsår/statusændring. Mikrovirksomheders tjenesteundtagelse lægges til grund; der er ikke udledt en undtagelse for salg af regulerede produkter eller en afgørelse om enhver fremtidig tjeneste.

X06 består som selvstændigt releasekvalitetsmål for skærmlæser, tekstskalering, kontrast og betjening. Genkontroller størrelse og relevant tjenestekategori ved års-/ændringsgennemgangen, ansættelser, vækst, tilknyttede virksomheder, betaling eller produktsalg. Ingen særskilt byrdefritagelse hævdes.

## T05 – filupload

Kontrollen og rettelsen er udført og efter særskilt godkendelse aktiveret i produktion. T05 er afsluttet for den beskrevne private upload-/downloadfunktion med de resterende risici og genåbningskrav nedenfor. [Produktionskontrol](LEGAL-NEXT-TEN-RELEASE.md).

- PDF/JPEG/PNG tillades med binær signatur og kanonisk base64; højst 2 MiB rå fil. Filnavne har længde-/kontroltegn-/stirestriktioner.
- RPC begrænser til 20 aktive filer, 200 dokumentrækker og samlet 32 MiB base64payload pr. hjem. Revisioner/lås beskytter mod utilsigtet overskrivning. Slettet payload bliver tombstone, hvilket fortsat kræver retentionsafklaring under L05.
- Hjem/adresse/medlemskab afgrænser læsning; ingen offentlig permanent download-URL. PDF åbnes/hentes efter brugerhandling, billeder vises som typed image-data. Ingen ny serverbaseret dokumenteksekvering er tilføjet.
- Den fundne downloadnavnefejl er rettet for nye og gamle dokumenter uden at ændre gamle DB-rækker. Tests og live-diff er i [udgivelsesforslaget](LEGAL-NEXT-TEN-RELEASE.md).

Der er **ikke** tilføjet malware-scanning/CDR eller fuld PDF-parser. Magic bytes beviser ikke harmløst indhold. Den afgrænsede håndtering er privat upload mellem identificerede husstandsmedlemmer, små kvoter og eksplicit åbning i platformens fil-/PDF-værktøj; dokumentfiler må ikke behandles som betroet kode. Ved offentlig deling, anonym upload, automatisk indeksering/previewprocessor eller identificerede trusler genåbnes kontrollen og behovet for yderligere indholdsbehandling før aktivering. [OWASP's uploadvejledning](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) er brugt som kontrolliste, ikke som certificering.

## V06 – sandfærdig præsentation

Kandidatens invitation beskriver egen konto og accept og mærker download som **testversion**. Den indeholder ingen produktfoto-/bruger-screenshots, realkundeadresser eller måledata. Deep-link-scheme/downloadsti bevares; Huslyg-brandingen er rettet. Ændringerne er nu særskilt godkendt, publiceret og hashverificeret på begge domæner; V06 er afsluttet for den aktuelle offentlige indgang. Nye materialer og featureændringer kræver fornyet kontrol.

Godkendt begrænset beskrivelse til det valgte scope: “Overblik over dit hjem og historiske forbrug. Beregnede mønstre og priser er estimater.” Ingen annoncer eller nye screenshots er udgivet. Før en ny landingpage/butikstekst skal faktisk tilgængelighed afstemmes igen, især familieaccept, varmeleverandørdækning og offentlig APK-version. Pauseret AI/3D/bil må ikke markedsføres som færdig feature.

Kommende screenshots skal genereres med syntetiske navne, adresser og målinger; eksisterende kundebilleder eller blot slørede målere er ikke automatisk et anonymt markedsføringsgrundlag. Licens-/aktivkontrollen X08 er stadig separat. [Forbrugerombudsmandens dokumentationskrav](https://forbrugerombudsmanden.dk/alle-emner/forbud-mod-vildledning/miljoemaessige-og-etiske-udsagn-i-markedsfoeringen) underbygger, at konkrete påstande skal kunne forsvares, også når materialet fremstilles senere.

## R04 – offentlig sletteindgang

Den allerede lokalt kontrollerede HTML-side indgår i den præcist afgrænsede Preview-pakke. Anmodning kræver ikke konto eller installeret app; kun en faktisk sletning kræver identitetskontrol. **R04 er nu afsluttet efter godkendt publicering og livekontrol på begge domæner**; Play Console-registrering er fortsat G05.

## P02 – formål, grundlag, datatyper og kilder

Identitet, kategorier, kilder og de valgte egne appformål findes i privatlivsudkastet og datakortet. Der er nu konkret afstemt direkte Strømligning-kald, Resend-aktivering og modtagerbekræftet kontrolmail samt slettejournalens pseudonyme metadata. P02 kan dog ikke afsluttes ved blot at erstatte ordet “udkast”: D07's åbne interesseafvejninger for modtager uden konto, medbeboere og teknisk drift skal afsluttes med de relevante fakta. [Privatlivsudkast](LEGAL-PRIVACY-DRAFT.md), [grundlagsmatrix](LEGAL-PROCESSING-BASES.md).

## P06 – versionsstyring og ændringer

En konkret versions-/meddelelsesprocedure er etableret i [LEGAL-POLICY-VERSIONING.md](LEGAL-POLICY-VERSIONING.md). Det aktuelle privatlivsudkast får ikke en opdigtet ikrafttrædelsesdato. P06 står åbent for den faktiske gældende versions identitet/dato ved godkendt publicering. Samtykkebaserede formål må ikke aktiveres alene gennem et versionsskift.

## Resultatprincip

**8 af de 10 valgte punkter er afsluttet** med ovenstående afgrænsninger: E06/E07/C05/X03/X05/T05/V06/R04. P02/P06 er gennemarbejdet, men afhænger fortsat af endelig privatlivsinformation. Samlet checklistestatus er 46 afsluttede og 62 åbne af 108. Der sættes ikke ti flueben alene for at opfylde en kvote.
