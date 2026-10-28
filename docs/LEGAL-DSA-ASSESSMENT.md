# X07 – privat filarkiv, familieadgang og DSA

27. oktober 2026 · Vurdering af det dokumenterede første scope. Ansvarlig for opfølgning: BluePeachs ejer.

## Konklusion

**Behandl den brugerbestilte filopbevaring som en hostingfunktion i releasearbejdet.** Huslyg opbevarer uploaderens fil og stiller den til rådighed for vedkommende og udvalgte accepterede medlemmer. At Vercel/Supabase står for infrastrukturen, er ikke alene en begrundelse for at undtage Huslygs egen tjeneste.

**Der er ikke identificeret en onlineplatform eller onlinemarkedsplads i dette scope.** Ingen offentlig filudgivelse, søgbar brugerprofil, kommentarstrøm, åbent optag i grupper eller handel mellem brugere er identificeret. Det konkrete invitationsvalg og de private dokumentrettigheder er afgørende; login alene ville ikke være nok til denne konklusion.

Dette er vores konkrete, konservative klassifikation til releasearbejdet, ikke en myndighedsafgørelse eller en erklæring om fuld DSA-efterlevelse. X07 kan afsluttes som **vurderingsopgave med identificerede følger**, mens publicering og teknisk efterlevelse forbliver under de åbne punkter nedenfor. Der lægges ikke en ubekræftet mikrovirksomhedsfritagelse til grund.

## Kontrolleret projektgrundlag

- `HomeFloorPlans.tsx` og `property-documents.ts`: upload/visning/hentning af PDF/JPEG/PNG knyttet til et hjem og en adresse. Der er ingen offentlig publiceringsknap eller permanent offentligt fil-link i denne kodevej.
- `property-documents-server.mjs`: kræver token og medlemskab; læsning filtrerer både hjem, adresse og dokument-ID. Listen indeholder ikke filpayload.
- `202610230001_property_documents.sql`: medlemsbaseret RLS, ingen anon-adgang og serverkontrolleret skrivning.
- `202610240001_family_access.sql`: navngiven modtager/mailbinding, verificeret identitet og accept frem for automatisk optag af enhver besøgende. Husstandsgrænse og invitationsgrænser er separate kontroller.
- En offentligt tilgængelig invitationslanding viser ikke i sig selv det private arkivs filer. Det må ikke ændres uden genvurdering og autorisationskontrol.

Kildegennemgangen beviser den beskrevne arkitektur; den erstatter ikke T01/F03 eller en fysisk prøve. Skjulte forsøgsruter og fremtidige funktioner er ikke automatisk omfattet af denne konklusion.

## Retligt grundlag og afgrænsning

[EETT's myndighedsoversigt](https://www.eett.gr/en/digital-services/general-information/categories-of-services/) skelner mellem opbevaring efter brugerens anmodning og onlineplatformes offentlige udbredelse. [DSA, betragtning 13–15 og artikel 3](https://eur-lex.europa.eu/eli/reg/2022/2065) underbygger sondringen; den søgbare tekst om private, udvalgte modtagere er gennemgået, mens direkte EUR-Lex-visning gav en browserkontrol. Klassifikationen ovenfor er vores anvendelse på kodegrundlaget.

[Bundesnetzagenturs vejledning](https://www.bundesnetzagentur.de/DE/Fachthemen/DSC/1_Themen/PflichtenVermittlunggsdienste/start.html) beskriver trinvise pligter, kontaktveje, forståelige indholdsregler samt hostingtjenesters elektroniske anmeldelsesvej, begrundede indgreb og håndtering af relevant mistanke om alvorlig kriminalitet. Privat deling er derfor ikke i sig selv en generel DSA-fritagelse. Reglerne for onlineplatforme overføres omvendt ikke ukritisk til det private arkiv.

## Konkrete følger før release

Pligtområderne er også afstemt med [EETT's tabel over udbyderforpligtelser](https://www.eett.gr/en/digital-services/information-for-providers/obligations-of-providers/), herunder sondringen mellem generelle/hostingrelaterede områder og yderligere onlineplatformskrav. Tabellen nedenfor omsætter dem til vores åbne projektopgaver, uden at erklære en bestemt størrelsesundtagelse opfyldt.

| Følge | Handling og ansvar | Åbent punkt |
| --- | --- | --- |
| Kontakt for brugere og myndigheder | Ejerbetjent info@huslyg.dk er modtagerbekræftet. Tydeliggør indholds-/myndighedshenvendelser og relevante kommunikationssprog i endelig offentlig tekst; ingen chatbot som eneste vej. | V01/V02/LANC02 |
| Anmeldelse af konkret indhold | Klargør en synlig elektronisk vej uden krav om appkonto. Muliggør begrundelse, præcis placering/dokumentidentifikation, kontakt og en godtroserklæring. Manglende felter må ikke alene medføre automatisk afvisning. | V01/V02/R08 |
| Manuel vurdering og begrundelse | Ejeren kvitterer, undersøger nødvendigt indhold under adgangskontrol, vurderer relevante parters rettigheder og informerer om beslutning og mulighed for genvurdering, når oplysninger/kontakt foreligger. Undgå at udlevere private dokumenter til en uvedkommende anmelder. | R08/T01/V01 |
| Proportional handling | Fastsæt omfang og grundlag for konkret begrænsning/fjernelse. Bevis og afprøv, at handlingen faktisk stopper relevant adgang, uden at slette et helt hjem som standard. | T01/F03/T05 |
| Alvorlige forhold og bindende pålæg | Ejeren vurderer omgående relevant myndighedskontakt og lovlig bevaring/videregivelse. Ingen automatisk generel indholdsovervågning indføres gennem denne vurdering. | T06/V01 |
| Transparens og størrelse | Afklar dokumentations-/offentliggørelseskrav og eventuelle størrelsesundtagelser før endelige vilkår. Antal administratorer eller 100 forventede husstande dokumenterer ikke alene hele virksomhedsgruppen/økonomien. | V01/X05 |

Tabellen er et arbejdsgrundlag for de eksisterende gates, ikke bevis for en publiceret anmeldelsesfunktion, udført moderation eller opfyldt samtlige pligter. Ingen indholdsanmeldelse, kontoindgreb eller politianmeldelse er foretaget i denne opgave.

## Genåbning

Genåbn X07 før offentlige links til brugernes filer, åbne grupper/automatisk optag, offentligt brugerindhold, katalog over brugerhjem, kommentarer, markedsplads eller en anden væsentlig adgangsændring. Klassificér da hver tjenestedel og dens konkrete forpligtelser igen. Årlig gennemgang følger LANC06.
