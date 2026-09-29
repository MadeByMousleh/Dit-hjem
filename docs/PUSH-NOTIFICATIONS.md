# Push-notifikationer for Strømblik

Dette er en produkt-specifikation og prioriteret backlog. De første lokale notifikationer for billige og høje elpriser er implementeret; resten er forslag til senere arbejde. En notifikation må kun sendes, når den er konkret, rettidig og kan føre til en handling. Brugeren skal altid kunne slå hver kategori til eller fra.

## Fælles principper

- Send kun data, som er opdaterede og knyttet til brugerens egen husstand.
- Undgå tekniske detaljer og brug i stedet kroner, tidspunkter og en tydelig næste handling.
- Saml beslægtede hændelser i én notifikation. Send aldrig mere end én almindelig forbrugs- eller prisnotifikation pr. kategori pr. døgn.
- Brug stille leveringsperiode kl. 22.00–07.00. Sikkerhed og en mulig vandlækage kan være undtagelser.
- En push skal åbne den relevante fane og graf, ikke blot appens forside.
- Manglende eller forsinkede data må ikke fremstilles som et faktisk problem i hjemmet.

## Indstillinger

Brugeren vælger kategorierne **Elpriser**, **Elforbrug**, **Varme og vand**, **Opsummeringer**, **Forbindelser** og **Sikkerhed**. Prisgrænser, budgetter og stille periode er brugerens egne indstillinger. Alle kategorier er slået fra som udgangspunkt, bortset fra kritiske sikkerhedsmeddelelser efter tydeligt samtykke.

## Datagrundlag og nuværende status

Notifikationer skal beregnes på data, som er korrekte, tidsstemplede og dækket af brugerens samtykke. Følsomme forbrugs- og aftaledata hører hjemme i den krypterede energiboks; adgangstokens og adgangskoder må aldrig kopieres til en push-tjeneste eller en almindelig lokal cache. En push indeholder kun den nødvendige, korte besked — aldrig målernummer, kundenummer, fuld adresse eller detaljeret forbrug.

| Data | Bruges til | Status i appen |
| --- | --- | --- |
| Elmålinger: målepunkt, start/slut, kWh, opløsning og synkroniserede perioder | Forbrug, afvigelser, budgetter og datamangler | **Indsamles allerede** i den krypterede energiboks. |
| Elmålepunktets metadata: adresse, målernummer, netselskab/-område, balanceansvarlig, indflytningsdato og aflæsningsfrekvens | Korrekt kontekst, datakvalitet og aftalevisning | **Indsamles allerede**, når ElOverblik leverer dem; opdateres højst ugentligt. |
| El-aftale: leverandør, spot/fast pris, fast pris, påslag, abonnement og gyldighedsperiode | Prisberegning, budget og aftaleændringer | **Kan allerede gemmes** krypteret, men oplysningerne er brugerindtastede — ikke automatisk verificeret fra elselskabet. |
| Offentlige pris- og tarifpunkter: tidspunkt, spotpris, samlet øre/kWh og net/afgift | Lav/høj pris, opladningsvinduer og prisprognoser | **Hentes allerede** fra prisdatakilden og caches lokalt. Historik er ikke en varig, husstands-krypteret prisbog. |
| Varmeaflæsninger: periode, faktisk og forventet kWh, varmevand m³, afkøling samt frem-/returtemperatur | Varme over forventning, returtemperatur og varmeoversigt | **Indsamles allerede**, når Sønderborg Varme-forbindelsen opdateres, og gemmes i den krypterede energiboks. Reelle konti/enheder er endnu ikke verificeret. |
| Varme-kundeoplysninger: kunde-, forbruger-, installations- og målernummer samt adresse | Kunde- og målerkort; sammenknytning til den rette installation | **Indsamles allerede** fra varmeforbindelsen og gemmes krypteret. Må ikke vises i en push. |
| Profiladresse, postnummer og valgt netselskab | Prisområde, lokal kontekst og relevante integrationer | **Gemmes allerede lokalt pr. bruger**. Den er ikke en autoritativ bekræftelse på ejerskab af et målepunkt. |
| Kontoens e-mail og aktiv session | Konto- og sikkerhedsbeskeder | **Findes allerede** gennem login, men der er endnu ikke en implementeret enheds-/sessionshistorik til notifikationer. |

### Data der mangler før push kan implementeres korrekt

| Manglende data eller funktion | Hvorfor den er nødvendig | Berørte notifikationer |
| --- | --- | --- |
| Push-token pr. enhed, platform, tilladelsesstatus, sprog, tidszone og senest set | Gør det muligt at levere til den rigtige enhed og respektere samtykke | Alle fjern-pushnotifikationer |
| Notifikationspræferencer pr. kategori, prisgrænse, budget, stille periode og foretrukket opladningsperiode | Undgår generiske eller støjende alarmer | Pris, budget, opladning og opsummeringer. De lokale prisadvarsler gemmer til/fra samt brugerens grænser for billig og høj pris. |
| Leveringslog: type, datagrundlag, sendt/åbnet tidspunkt, status og afvisning | Frekvensgrænser, fejlfinding og dokumentation for, at samme alarm ikke gentages | Alle push-notifikationer |
| Baseline for normalt forbrug, med datadækning, sæson og beregningsversion | En afvigelse må ikke bygges på få eller mangelfulde målinger | Usædvanligt el- og vandforbrug |
| Et udtrykkeligt el- og vandbudget i kroner og/eller kWh/m³ | Et budget må komme fra brugeren, ikke gættes | Budgetnotifikationer |
| Detaljerede vandmålinger med tidsstempel | Dagsforbrug kan ikke afgøre, om der er en lækage om natten | Vandlækage og vandbudget |
| Verificeret leverandørregel for returtemperatur/afkøling og eventuelle økonomiske konsekvenser | Forhindrer, at appen hævder et gebyr eller en fejl uden belæg | Høj returtemperatur |
| Autoritativ, maskinlæsbar aftale- og tariffhistorik | Gør det muligt at skelne ændrede tariffer fra brugerindtastede aftaler og at forklare prisændringer korrekt | Tarif/aftale ændret, samlede prisprognoser |
| Autorisationens reelle udløbstidspunkt og synkroniseringsstatus | Gør varsling om udløb og manglende data pålidelig | Adgang udløber, målerdata mangler |
| Sikker enhedsidentitet og revisionsspor for login | Påkrævet før “ny enhed logget ind” kan sendes uden falske alarmer | Sikkerhedsnotifikationer |

### Anbefalet opbevaring

- **Krypteret energiboks:** Målerhistorik, måler- og kundedata, varmehistorik, brugerens el-aftale, budgetter og beregnede baselines. Dataene skal være tilgængelige på brugerens godkendte enheder, men aldrig i push-udbyderens payload.
- **Sikker enhedsopbevaring:** Leverandørers adgangstokens og varme-login, som allerede er enhedsbundne. Disse må ikke indgå i backup eller analytics.
- **Server med mindst mulige data:** Hash/ID for push-enhed, samtykkestatus, kategoriindstillinger, tidszone, stille periode, leveringslog og planlagte udsendelser. Indholdet af målinger og hemmeligheder skal ikke ligge her i klartekst.
- **Lokalt cachede, offentlige data:** Midlertidige pris- og tarifpunkter kan caches som i dag. Hvis de bruges til en historisk månedlig prisopgørelse, skal den beregnede pris og datakilde/version gemmes sammen med resultatet i den krypterede energiboks.

Før push bygges, skal vi vælge, om beregningen sker på brugerens enhed eller på en server. Serverberegning kræver et særskilt privatlivs- og sikkerhedsdesign, fordi den nuværende energiboks er ende-til-ende-krypteret og serveren ikke kan læse målingerne. Enhedsberegning beskytter data bedre, men kan ikke levere rettidige notifikationer, når appen ikke kører. Denne beslutning skal træffes og dokumenteres, før der indsamles push-tokens eller oprettes en push-backend.

### Første implementering: billig strøm på vej

Den første funktion er en **lokal, planlagt mobilnotifikation**. Den sendes ikke fra en server og bruger hverken push-token, målerdata, varmeoplysninger eller kontooplysninger.

- Brugeren slår selv funktionen til under **Profil → Elpriser** og godkender telefonens notifikationstilladelse.
- Appen bruger de hentede, offentlige pris- og tarifpunkter. Den finder det første sammenhængende prisvindue på mindst 90 minutter, som både er under brugerens grænse for billig strøm (standard 1,50 kr./kWh) og mindst 20 % under det kommende døgns gennemsnit.
- Én besked planlægges 15 minutter før vinduet. Ved hver opdatering erstattes den tidligere planlagte prisbesked, så brugeren ikke får dubletter eller forældede anbefalinger.
- Eksempel: “Billig strøm på vej. Fra kl. 01.00 til 03.00 er strømmen ned til 1,12 kr./kWh.”
- Eksempelpriser udløser aldrig en notifikation. I Expo Go kan brugeren gemme sit valg, men der planlægges ingen besked; en development build er nødvendig for at levere den.
- Den kræver en ny native app-build, fordi `expo-notifications` er tilføjet. Fjern-push, baggrundsopdatering og udsendelse til enheder er **ikke** implementeret.

### Anden implementering: elprisen stiger snart

Den anden funktion er også en **lokal, planlagt mobilnotifikation** og aktiveres separat under **Profil → Elpriser**.

- Appen sammenligner den aktuelle time med de næste 3 timer.
- En besked planlægges 30 minutter før den første time, der både er over brugerens grænse for høj pris (standard 2,50 kr./kWh) og mindst 30 % dyrere end den aktuelle time.
- Eksempel: “Elprisen stiger snart. Kl. 17.00 stiger strømmen til 2,85 kr./kWh. Brug strøm inden da, hvis det passer dig.”
- Kun den næste planlagte advarsel beholdes. Når priserne opdateres, erstattes en tidligere plan med den nyeste relevante advarsel.

## Elpriser

### Lav elpris nu

- **Eksempel:** “Strømmen er billig de næste 2 timer. Et godt tidspunkt til opladning eller tøjvask.”
- **Hvorfor det giver mening:** Brugeren kan flytte fleksibelt forbrug til billige timer og spare penge uden at skulle holde øje med grafen.
- **Hvornår den sendes:** Når den aktuelle eller næste time er under brugerens prisgrænse, og mindst 20 % lavere end døgnets forventede gennemsnit.
- **Timing og begrænsning:** Tidligst 15 minutter før vinduet starter, højst én gang pr. døgn. Kun hvis der er mindst 90 minutters sammenhængende lavprisvindue.
- **Kræver:** Opdaterede spotpriser og en valgt prisgrænse eller en fornuftig standardgrænse, som vises og kan ændres.
- **Åbner:** Elpriser med det markerede tidsrum.

### Høj elpris snart

- **Eksempel:** “Elprisen stiger kl. 17. Flyt tungt forbrug før da.”
- **Hvorfor det giver mening:** Giver brugeren tid til at starte opvaskemaskine, vaskemaskine eller opladning tidligere.
- **Hvornår den sendes:** Når en time inden for de næste 3 timer overstiger brugerens grænse og er mindst 30 % højere end den aktuelle pris.
- **Timing og begrænsning:** Sendes 30–60 minutter før stigningen. Højst én gang pr. døgn.
- **Kræver:** Opdaterede spotpriser og brugerens prisområde.
- **Åbner:** Elpriser med før- og efterprisen markeret.

### Bedste opladningsvindue

- **Eksempel:** “Dit billigste opladningsvindue i nat er 01–04.”
- **Hvorfor det giver mening:** Elbilens opladning er typisk hjemmets mest flytbare og største forbrug.
- **Hvornår den sendes:** Om aftenen, når der findes et sammenhængende vindue på mindst 2 timer inden for brugerens foretrukne opladningsperiode.
- **Timing og begrænsning:** Sendes højst én gang pr. aften og kun til brugere, som selv har slået opladningsnotifikationer til.
- **Kræver:** Næste døgns priser, valgt prisområde, brugerens ønskede færdigtidspunkt og en valgt ladetid fra 1 til 6 timer. Den kræver ikke en forbundet elbil eller ladestander.
- **Åbner:** Elpriser eller bilfanen med tidsrummet valgt.

## Elforbrug

### Usædvanligt højt elforbrug

- **Eksempel:** “Dit elforbrug er 35 % højere end normalt i dag. Se de timer, der skiller sig ud.”
- **Hvorfor det giver mening:** Kan hjælpe med at opdage standby-forbrug, ændrede vaner eller et apparat, som bruger mere end normalt.
- **Hvornår den sendes:** Når døgnforbruget overstiger brugerens sammenlignelige historiske gennemsnit med mindst 30 %, og afvigelsen er større end en praktisk minimumsgrænse i kWh.
- **Timing og begrænsning:** Tidligst når der er tilstrækkelige time- eller kvartersdata. Højst én gang hver 7. dag, medmindre brugeren selv beder om tættere overvågning.
- **Kræver:** Mindst 4 ugers pålidelige målerdata. Vis ikke alarmen, hvis der mangler data eller hjemmet for nylig er taget i brug.
- **Åbner:** Elforbrugsgrafen med de afvigende timer fremhævet.

### Elbudget nærmer sig

- **Eksempel:** “Du har brugt 80 % af dit elbudget denne måned.”
- **Hvorfor det giver mening:** Brugeren kan justere resten af månedens forbrug, før budgettet overskrides.
- **Hvornår den sendes:** Ved 80 % og 100 % af et aktivt brugerdefineret månedsbudget. Prognosen bør tage højde for antal dage tilbage i måneden.
- **Timing og begrænsning:** Maksimalt to notifikationer pr. måned for samme budgetniveau.
- **Kræver:** Et budget valgt af brugeren og opdaterede forbrugs- samt prisdata. Ved ukendt pris vises kun kWh, ikke kroner.
- **Åbner:** Elforbrug med budget og månedlig prognose.

Den lokale første version er implementeret som **Forbrugsgrænse** under Profil. Brugeren vælger selv et månedligt loft i enten kWh eller estimerede kroner. Appen beregner en prognose ud fra de komplette dage i indeværende måned og giver højst én advarsel ved 80 % og én ved 100 % for den samme måned, grænse og enhed. Kroner er et estimat baseret på de tilgængelige aktuelle elpriser; den er derfor tydeligt mærket som et estimat.

## Varme og vand

### Varmeforbrug over forventning

- **Eksempel:** “Varmeforbruget ligger 18 % over forventet denne måned.”
- **Hvorfor det giver mening:** Fjernvarme måles ofte i GJ og kan være vanskelig at følge uden sammenligning med forventet forbrug.
- **Hvornår den sendes:** Når akkumuleret forbrug for den valgte periode ligger mindst 15 % over forventet, og forskellen svarer til mindst 1 GJ.
- **Timing og begrænsning:** Højst én gang pr. uge. Sendes ikke, hvis den forventede kurve eller de faktiske data er ufuldstændige.
- **Kræver:** Forbrugsdata fra varmeselskabet og en pålidelig forventet forbrugskurve.
- **Åbner:** Vand og varme med faktisk og forventet varmeforbrug valgt.

### Høj returtemperatur

- **Eksempel:** “Din returtemperatur er højere end normalt. Se udviklingen i varmeoverblikket.”
- **Hvorfor det giver mening:** En vedvarende høj returtemperatur kan pege på, at varmeanlægget ikke afkøler fjernvarmevandet optimalt; nogle selskaber har også økonomiske incitamenter knyttet til afkøling.
- **Hvornår den sendes:** Kun når temperaturen har ligget over et af leverandøren eller brugeren angivet niveau i mindst 3 på hinanden følgende målinger eller dage.
- **Timing og begrænsning:** Højst én gang pr. måned. Notifikationen må ikke påstå fejl eller gebyr, medmindre dette er dokumenteret i brugerens aftaledata.
- **Kræver:** Reelle frem- og returtemperaturdata samt helst leverandørens relevante målgrænser.
- **Åbner:** Temperaturgrafen i Vand og varme.

### Mistanke om vandlækage eller usædvanligt vandforbrug

- **Eksempel:** “Vandforbruget har været usædvanligt højt i nat. Tjek for løbende toilet eller lækage.”
- **Hvorfor det giver mening:** Hurtig opdagelse kan begrænse vandspild og skader.
- **Hvornår den sendes:** Når måleren viser vedvarende forbrug i et normalt inaktivt tidsrum eller et kraftigt spring i forhold til husstandens normale niveau.
- **Timing og begrænsning:** Sendes straks, også i stille periode, hvis mønsteret er stærkt. Ellers sendes den om morgenen. Maksimalt én aktiv lækageadvarsel, indtil der foreligger nye normale data.
- **Kræver:** Højfrekvente vandmålerdata. Funktionen må ikke aktiveres for estimerede eller dagsaggregerede data.
- **Åbner:** Vandforbrug med det mistænkelige tidsrum markeret.

### Vandbudget nærmer sig

- **Eksempel:** “Du er tæt på månedens forventede vandforbrug.”
- **Hvorfor det giver mening:** Gør et stigende vandforbrug synligt i tide, uden at alarmere brugeren unødigt.
- **Hvornår den sendes:** Ved 80 % af brugerens eget mål eller den valgte forventningskurve.
- **Timing og begrænsning:** Højst én gang pr. måned.
- **Kræver:** Opdaterede vanddata og et tydeligt angivet budget eller forventning.
- **Åbner:** Vandforbrug for den aktuelle måned.

## Pris, aftale og dataforbindelser

### Tarif eller energipris ændret

- **Eksempel:** “Din nettarif er ændret. Se hvad det betyder for dit forventede forbrug.”
- **Hvorfor det giver mening:** Brugeren får besked om en ændring, der kan påvirke regningen, i stedet for at opdage den bagefter.
- **Hvornår den sendes:** Når appen har verificeret en ny aktiv pris, tarif eller aftaleoplysning fra en autoritativ datakilde.
- **Timing og begrænsning:** Sendes én gang pr. ændring og aldrig ud fra gæt eller ufuldstændige prisdata.
- **Kræver:** Verificerede aftale- eller tarifdata. Vis en forklaring på, om ændringen er spotpris, nettarif, afgift eller abonnement.
- **Åbner:** Elpris-/aftaledetaljer med ændringen fremhævet.

### Målerdata mangler

- **Eksempel:** “Vi har ikke modtaget nye eldata i 3 dage. Forbind ElOverblik igen.”
- **Hvorfor det giver mening:** Forklarer, hvorfor grafer og budgetter kan være ufuldstændige, og giver en konkret løsning.
- **Hvornår den sendes:** Når en ellers aktiv forbindelse ikke har leveret data efter dens kendte forsinkelse plus 72 timer.
- **Timing og begrænsning:** Én notifikation, derefter en påmindelse efter 14 dage, hvis problemet fortsætter.
- **Kræver:** Kendt tidspunkt for seneste succesfulde synkronisering. Sendes ikke ved planlagt vedligeholdelse hos datakilden.
- **Åbner:** Forbindelsesindstillinger med mulighed for at genoprette adgangen.

### Adgang udløber snart

- **Eksempel:** “Din forbindelse til ElOverblik udløber snart. Forny den for at beholde opdaterede data.”
- **Hvorfor det giver mening:** Forebygger datatab uden at kræve, at brugeren selv holder styr på tekniske tokens eller samtykker.
- **Hvornår den sendes:** 14 dage og 2 dage før et kendt samtykke eller en autorisation udløber.
- **Timing og begrænsning:** Maksimalt to varsler pr. udløb.
- **Kræver:** En autorisationsmodel med kendt udløbsdato.
- **Åbner:** Den relevante forbindelsesside.

## Opsummeringer

### Månedlig energirapport

- **Eksempel:** “September: 412 kWh el og 9,4 GJ varme — 6 % under forventet.”
- **Hvorfor det giver mening:** Giver overblik uden at brugeren selv skal åbne appen og fremhæver udviklingen i et roligt format.
- **Hvornår den sendes:** På første dag efter en afsluttet måned, når de nødvendige data er modtaget eller mærket som foreløbige.
- **Timing og begrænsning:** Én gang pr. måned på brugerens valgte tidspunkt.
- **Kræver:** Tilstrækkelige el- og/eller varmedata. Udelad en kategori, hvis datagrundlaget ikke er komplet.
- **Åbner:** Overblik med den afsluttede måned valgt.

## Sikkerhed

### Ny enhed eller usædvanlig kontoaktivitet

- **Eksempel:** “En ny enhed blev brugt til at logge ind på din Strømblik-konto.”
- **Hvorfor det giver mening:** Giver brugeren mulighed for hurtigt at reagere på mulig uautoriseret adgang.
- **Hvornår den sendes:** Ved login fra en ny verificeret enhed eller efter en væsentlig sikkerhedshændelse.
- **Timing og begrænsning:** Sendes straks. Saml gentagne hændelser fra samme enhed.
- **Kræver:** Sikker og privatlivsbevidst enhedsidentifikation. Vis ikke præcis placering uden udtrykkeligt samtykke.
- **Åbner:** Sikkerhedsindstillinger med aktive sessioner.

## Anbefalet rækkefølge

1. Månedlig energirapport, manglende målerdata og adgang der udløber.
2. Lav/høj elpris og elbudget — kun efter brugerens valgte grænser.
3. Varme over forventning.
4. Usædvanligt elforbrug og bedste opladningsvindue.
5. Vandlækage og høj returtemperatur, når de nødvendige detaljerede målerdata findes og reglerne er testet på rigtige data.

Alle notifikationer bør først testes med syntetiske data, derefter med et lille frivilligt testhold og tydelige frekvensgrænser. Mål åbningsrate, fravalg og om brugeren efterfølgende udfører den foreslåede handling — ikke blot antallet af sendte beskeder.
