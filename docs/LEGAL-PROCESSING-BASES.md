# D07 – formål og behandlingsgrundlag

26. oktober 2026. **Arbejdsudkast; D07 står åbent.** Bygger på [funktionsscope](LEGAL-RELEASE-SCOPE.md), [datakortlægning](LEGAL-DATA-MAP.md) og [teknisk inventar](LEGAL-TECHNICAL-DATA-INVENTORY.md). Matricen fastlægger afgrænsninger og mangler; den er ikke en automatisk godkendelse af alle eksisterende baggrundskald.

Dataansvarlig er BluePeach, CVR 40876375. Ejeren er eneste oplyste interne administrator og håndterer support. Første version er valgt til voksne 18+, gratis uden reklamer eller køb. Ejeren har 26. oktober 2026 bekræftet **“Ja, kun de nævnte appformål”**: kundedata bruges kun til kundens egne appfunktioner, familiedeling og nødvendig drift/support, uden generel AI-træning, reklameprofilering eller videresalg.

Dette er formålsafgrænsningen for første udgivelse. Almindelige beregninger af brugerens eget basisforbrug eller mønstre er en del af den valgte appfunktion; det er ikke i sig selv tilladelse til at træne en fælles model på tværs af kunder. Dokumentet aktiverer eller stopper ingen eksisterende kode; nødvendige rettelser kontrolleres under de åbne tekniske punkter.

## Princip for valget

Et behandlingsgrundlag vælges pr. konkret formål og person. Nødvendighed for en aftalt funktion kan ikke udvides blot ved at skrive ekstra anvendelser i vilkårene. En valgfri funktion kan være aftalebaseret, når brugeren aktivt bestiller den, og behandlingen objektivt er nødvendig for den funktion. Et klik på tilslutning/upload er ikke automatisk et GDPR-samtykke til andre formål.

Det følger af [Datatilsynets oversigt over behandlingsgrundlag](https://www.datatilsynet.dk/regler-og-vejledning/grundlaeggende-begreber/hvornaar-maa-du-behandle-personoplysninger/) og [EDPB's endelige retningslinjer om artikel 6(1)(b)](https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines-art_6-1-b-adopted_after_public_consultation_en.pdf). Matricens anvendelse på Huslyg er vores vurdering ud fra det dokumenterede scope, ikke en myndighedsafgørelse om appen.

## Formålsmatrix

| Formål | Person/data | Foreslået grundlag og nødvendighed | Grænse / nødvendigt før afslutning |
| --- | --- | --- | --- |
| Konto, login og adgang til eget hjem | Kontohaverens mail, konto-ID, session og medlemskab | Artikel 6(1)(b), levering af den bestilte kontobaserede tjeneste. | Saml endelige aftalevilkår og information; anvend ikke kontosessionen til reklameprofilering. |
| Tilvalgt Eloverblik-forbrug og egne analyser | Kontohaver/målerberettiget, autoriserede målepunkter og målinger | Artikel 6(1)(b) for den funktion brugeren bestiller; providerfuldmagt er et særskilt adgangskrav. | Adgangen giver ikke automatisk lovgrundlag til ubegrænset historik, andres data eller tværgående træning. D08 skal begrunde periode og nødvendighed. |
| Personligt pris-/netselskabsgrundlag | Kontohaverens adresse-/målerrelation og egne valg | Artikel 6(1)(b), nødvendig kobling for brugerens valgte pris-/tarifvisning. | Selve offentlige markedsprisarkiv er ikke i sig selv persondata; kontokoblingen er. Brug mindst mulig geografisk præcision. |
| Tilvalgt boligoverblik, tag og matrikel | Konto/adresse og nødvendige ejendomsoplysninger | Artikel 6(1)(b) for kontohaverens bestilte boligfunktion. | Dækker ikke automatisk selvstændige formål om naboer, andre beboere eller publicering. Offentlige registerdata er ikke en generel tilladelse til genbrug. |
| Privat opbevaring af plantegning | Uploadende bruger og filmetadata/-indhold | Artikel 6(1)(b) i det nødvendige omfang for brugerens ønskede opbevaring/deling. | Indhold om andre personer kræver særskilt vurdering; uploaderens aftale kan ikke uden videre bruges som deres behandlingsgrundlag. Ingen generel modeltræning. |
| Tilvalgt varmeintegration | Konto-/kunde-/installationsdata og credentials | Artikel 6(1)(b) for den bestilte import/visning, forudsat credentials faktisk er nødvendige. | Beskriv serverbaseret credentiallager korrekt; providerkontrakt og sletning står åbne. |
| Familieadgang efter accept | Ejer og accepterende medlemmers konto-/husstandsrelationer | Artikel 6(1)(b) for deltagernes bestilte fælles tjeneste. | Husstandens ejer kan ikke give ubegrænset samtykke på andre voksnes vegne. Vis delingsomfang før accept; håndter børn/udenforstående særskilt. |
| Invitationsmail før modtageren har konto | Modtagermail, inviterendes navn og husstandsrelation | Kandidat: artikel 6(1)(f), en begrænset funktionel invitation på et medlems anmodning; konkret interesseafvejning nedenfor. | Der er endnu ikke en aftale med modtageren. Spamregler/informationspligt og misbrug skal vurderes særskilt. Ingen reklame eller belønnet videresendelse i dette formål. |
| Affalds-/pris-/budgetpåmindelser | Konto-/husstandsvalg og lokal notifikationstekst/-metadata | Artikel 6(1)(b), når påmindelsen udtrykkeligt er valgt som funktion. | OS-tilladelse og låseskærmsindhold er separate forhold. Reklamer har ikke dette grundlag. Kontoadskillelse og annullering skal rettes/kontrolleres. |
| Besvare brugerens konkrete supporthenvendelse | Kontaktoplysninger og nødvendige sagsdata | Artikel 6(1)(b), når det er nødvendigt for den bestilte tjeneste/forudgående forespørgsel. Andre henvendelser vurderes særskilt. | Support betyder ikke rutinemæssig adgang til fuld forbrugshistorik; begræns til sagen og aftal retention. |
| Sikkerhed og nødvendig misbrugs-/fejldiagnose | Begrænsede request-/auth-events og tekniske fejlfelter | Kandidat: artikel 6(1)(f) for den nødvendige sikkerhedsinteresse; afvejning nedenfor. | Alle leverandørlogs, alle felter og ubegrænset opbevaring er ikke automatisk nødvendige. L05/T04 skal fastlægge faktisk omfang/adgang/frister. |
| Lovpligtig dokumentation og rettighedsanmodninger | Nødvendige sags-/regnskabsoplysninger | Artikel 6(1)(c), når en konkret pligt påhviler BluePeach. | Identificér den relevante pligt pr. kategori, fx behandling af GDPR-anmodning eller relevante regnskabsbilag. Ikke en generel begrundelse for at bevare alt. |
| Analyse af produktbrug, annonceprofilering eller markedsføring | Eventuelle klik-/installations-/kontaktdata | Ikke valgt som aktivt formål i det gratis launch-scope. Et senere formål kræver særskilt vurdering, gyldigt grundlag og eventuelt samtykke til sporing/markedsføring. | Native SDK-adfærd er stadig uafklaret under C01/C02; fravær af reklameindtægt er ikke bevis for fravær af teknisk dataindsamling. |
| Generel AI-træning eller videresalg af kundedata | Forbrug, billeder, filer, labels eller afledninger på tværs af kunder | Fravalgt af ejeren for første udgivelse. Intet trænings-/videresalgsgrundlag godkendes her. | Hvis faktisk behandling går ud over afgrænsningen, skal den stoppes eller vurderes særskilt før fortsættelse. En senere formålsændring kræver ny vurdering under X01/X02. |
| Skjulte integrationers restkald / gamle modeldata | Tesla/SmartThings, lokale præferencer, tidligere gemte data | Intet nyt grundlag antages alene ud fra tidligere implementering eller en skjult menu. | S03/T02/L05 skal afklare nødvendig fortsat behandling, stoppe unødvendige kald og håndtere gammel lagring. |

## Interesseafvejning – dokumenteret udkast

Disse to afvejninger er konkrete udkast. De anvender den almindelige struktur interesse → nødvendighed → hensyn til den registrerede. Endelig afgrænsning kræver de angivne driftsfakta. Kilde: [GDPR artikel 6(1)(f), 13–14 og 21](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

### LI-01: Funktionel familieinvitation

- **Interesse:** Gøre det muligt for en bruger at invitere et bestemt familiemedlem til et privat fælles hjem.
- **Nødvendighed:** Én målrettet mail kan være egnet til at give den tiltænkte modtager adgang til at vælge deltagelse. Modtagermail behøves til maillevering og identitetsbinding; der er ikke behov for reklameprofilering eller at sende forbrugsdata i mailen. Vurder om en delbar linkfunktion kan reducere vores indsamling i relevante situationer.
- **Modtagerhensyn:** Modtageren har ikke nødvendigvis bedt BluePeach om noget; forkert mail eller misbrug kan afsløre en privat relation. Adgang gives derfor først efter verificeret konto og eksplicit accept. Den nuværende rategrænse, deltagergrænse, korte invitationsgyldighed og begrænsede mailindhold reducerer indgrebet, men udløb er ikke sletning.
- **Rester før endelig konklusion:** Informationspligt over for modtager, kontakt for indsigelser, konkret frist/oprensning og eventuel spærring mod gentagne uønskede invitationer. F04 og L05 er åbne. Der er ikke dokumenteret en færdig afmeld-/blokérfunktion for ikke-brugere.

### LI-02: Sikkerheds- og fejldiagnostik

- **Interesse:** Beskytte konti/husstandsadgang og identificere fejl, så den bestilte tjeneste kan drives forsvarligt.
- **Nødvendighed:** Udvalgte status-/stage-/tidsfelter kan være nødvendige for at opdage fejl/misbrug. Rå passwords, nøgler, fulde målinger og alle request bodies er ikke nødvendige til det kortlagte diagnostikformål. Leverandørens standardfelter er ikke automatisk vores godkendte dataminimum.
- **Brugerhensyn:** IP, tidspunkt, konto-/request-ID og URL-parametre kan tilsammen beskrive adfærd. Begræns felter, adgang og varighed; undgå følsomme værdier i URL'er og brug aggregering, hvor den løser formålet.
- **Rester før endelig konklusion:** Faktiske logprodukter/-modtagere, valgte opbevaringsfrister, adgang og rettighedshåndtering. Dette er ikke en afvejning, som på forhånd godkender al native Firebase-/referreradfærd.

## For at afslutte D07

1. Ejerens formålsafgrænsning er nu bekræftet og registreret ovenfor; teknisk efterlevelse skal fortsat kontrolleres.
2. Afslut relevante nødvendigheds-/interesseafvejninger med reelle driftsfakta, ikke kun standardformuleringer.
3. Afklar de markerede behandlinger uden fastlagt grundlag, især andre personers fil-/boligdata, native SDK'er og pauserede integrationer.
4. Brug kun de afklarede formål i privatlivsinformationen; ret databehandling, der ikke passer til den besluttede afgrænsning. Ingen samtykkeboks indføres blot for at dække alle mangler.

Ingen appkode, behandling, samtykketekst, database eller produktionsindstilling er ændret af dette dokument.
