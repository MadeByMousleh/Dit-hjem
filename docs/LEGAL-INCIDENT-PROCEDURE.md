# T06 – håndtering af sikkerhedshændelser og persondatabrud

26. oktober 2026 · Ansvarlig: BluePeachs ejer · Kontakt: info@huslyg.dk.

## Hændelse til beslutning

1. Registrér straks tidspunkt for opdagelse og tidspunkt for, hvornår BluePeach har rimelig sikkerhed for, at et persondatabrud er sket. Det sidste er relevant for anmeldelsesfristen. Sagen behøver ikke være fuldt opklaret, før der reageres.
2. Begræns skade: stop berørte adgange/kald, isolér den konkrete fejl og bevar relevante beviser adgangsbegrænset. Ryd ikke logs eller nulstil en database for at skjule hændelsen. Kundedata skal ikke kopieres til Git eller chat.
3. Vurder berørte datakategorier, personer/husstande, mængde, varighed og eksponering. Forbrug, adresse og låseskærmsoplysninger kan afsløre rutiner. Undersøg også tab/ændring og utilgængelighed, ikke kun læk.
4. Kontakt relevante leverandørers sikkerheds-/supportkanal og indhent nødvendige fakta uden at vente passivt på en fuld rapport. Ejeren koordinerer og træffer dokumenterede beslutninger; der er ingen udpeget formel DPO.
5. Vurder risiko for rettigheder/frihedsrettigheder. Anmeld til Datatilsynet uden unødig forsinkelse og om muligt inden 72 timer efter kendskab, medmindre det er usandsynligt, at bruddet medfører en risiko. Ved forsinkelse begrundes den. Manglende detaljer kan nødvendiggøre supplerende oplysninger frem for at afvente anmeldelse.
6. Vurder særskilt, om bruddet sandsynligvis medfører høj risiko og kræver underretning til berørte uden unødig forsinkelse. En anmeldelse til myndigheden er ikke det samme som at underrette brugerne. Eventuelle undtagelser kræver konkret begrundelse; kryptering er ikke automatisk en undtagelse, hvis nøgler også er berørt.
7. Ret årsag, verificér sikker genåbning og opdater kontroller/DPIA. Luk først sagen med kendte rester, ansvar og opfølgning dokumenteret.

Anmeldelse sker via [Datatilsynets officielle indgang](https://www.datatilsynet.dk/sikkerhedsbrud/anmeld-sikkerhedsbrud) til Virk, ikke ved at sende kundedata i en almindelig supporttråd.

## Privat brudlog – skabelon

Oprettes i et adgangsbegrænset driftsarkiv, ikke som udfyldt kundelog i repoet:

| Felt | Indhold |
| --- | --- |
| Internt sags-ID | Tilfældigt ID, uden adresse/mail |
| Opdaget / kendskab | Dato/tid, tidszone og grundlag for sondring |
| Hvad skete? | Faktisk forløb og usikkerheder |
| Data og omfang | Kategorier og omtrentlige antal personer/records, ikke unødvendige rådata |
| Mulige følger | Konkret påvirkning af personer |
| Inddæmning | Handling, tidspunkt, ansvarlig og resultat |
| Risikovurdering | Begrundelse, risiko/høj risiko og forudsætninger |
| Myndighed | Anmeldt/ikke anmeldt, begrundelse, dato, kvitteringsreference og eventuelle supplementer |
| Berørte | Underrettet/ikke underrettet med begrundelse og kopi af nødvendigt budskab |
| Opfølgning | Årsag, rettelser, verifikation og genvurderingsdato |

Også et konstateret persondatabrud, der ikke anmeldes, dokumenteres med begrundelse. Logopbevaring skal afstemmes med L05; der oprettes ingen ubegrænset rålog.

## Kort underretningsskabelon

“Vi skriver, fordi [faktisk hændelse]. Det kan berøre [kategorier] og medføre [konkrete mulige følger]. Vi har [gennemførte foranstaltninger]. Du kan [relevant anbefaling]. Kontakt Huslyg-teamet på info@huslyg.dk. Vi opdaterer dig, hvis væsentlige nye oplysninger ændrer vurderingen.”

Tilpas til fakta; skriv ikke “ingen er berørt”, “alt er sikkert” eller “alle data var krypterede” uden belæg. Der er ikke konstateret/anmeldt et nyt brud ved at oprette denne procedure.

Kilde kontrolleret 26. oktober 2026: [Datatilsynet om anmeldelse](https://www.datatilsynet.dk/sikkerhedsbrud/anmeld-sikkerhedsbrud). Den konkrete arbejdsgang og logskabelon er projektets egen.
