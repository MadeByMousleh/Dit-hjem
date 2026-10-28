# D09 – DPIA-screening og foreløbigt risikoregister

26. oktober 2026. Dataansvarlig: BluePeach, CVR 40876375. **Screeningen er udført; D09 er ikke afsluttet.** Resultatet er, at vi bør gennemføre og afslutte en egentlig konsekvensanalyse før almindelig offentlig lancering af det beskrevne samlede datascope. Dette er en projektspecifik screening, ikke en myndighedsafgørelse om pligten.

## Behandling, der vurderes

App til voksne 18+, gratis uden reklamer eller køb. Konto og bolig kobles til detaljeret elhistorik, brugerens afledte mønstre/basisforbrug, varme og eventuelle plantegninger. Ejerens produktkrav er et fuldt privat historikarkiv med adgang til tidligere dage. Familiedeling giver flere personer adgang til fælles husstandsdata. Generel kundedata-træning, reklameprofilering og videresalg er fravalgt. Én oplyst intern administrator; hosting-/Auth-/dataleverandører og administreret nøgleflow er stadig involveret.

Grundlag: [data og adgang](LEGAL-DATA-MAP.md), [logs/SDK'er](LEGAL-TECHNICAL-DATA-INVENTORY.md), [formål](LEGAL-PROCESSING-BASES.md), [historikbehov](LEGAL-CONSUMPTION-HISTORY-NECESSITY.md). Ingen produktionspersondata er hentet, og ingen ny fysisk/netværksbaseret kontrol er foretaget i screeningen.

## Kriterier og vurdering

Datatilsynet beskriver kravet ved sandsynlig høj risiko og kræver en konkret vurdering. EU-tilsynsmyndighedernes kriterier er indikatorer; flere samtidige kriterier skærper behovet uden at være en mekanisk test.

| Indikator | Vurdering for Huslyg |
| --- | --- |
| Evaluering/profilering | Relevant: tidsmønstre, forventninger og afledt grundforbrug vedrører husstandsadfærd. Ikke enhver graf er automatisk en betydelig individuel afgørelse. |
| Meget personlige oplysninger | Relevant: længere detaljerede forløb kombineret med en bestemt bolig kan gøre det muligt at udlede daglige rutiner. Det gør ikke automatisk hver måling til en artikel 9-oplysning. |
| Sammenstilling af datasæt | Relevant: el-/prisdata kobles til konto, bolig og eventuelt varme/fælles filer. Vurderingen gælder den faktiske sammenstilling, ikke blot at kilderne teknisk findes. |
| Langvarig/systematisk behandling | Relevant i risikovurderingen: løbende import og ejerens valgte fulde historik. Der er ikke dermed fastslået overvågning af offentligt tilgængelige områder. |
| Stort omfang | Ejeren har efter screeningen oplyst cirka 100 aktive husstande som planlægningsestimat. Faktiske brugere, antal berørte personer, datamængde og geografisk spredning er ikke opgjort. Estimatet fastslår ikke stor skala og ophæver ikke de øvrige risikofaktorer. |
| Automatiske betydelige afgørelser | Ikke identificeret som launch-funktion: ingen dokumenteret kredit-, forsikrings-, prisdiskriminations- eller anden afgørelse med tilsvarende væsentlig virkning. |
| Sårbare personer | Appen målrettes voksne, men en bolig/familiedata kan vedrøre andre beboere, herunder børn. Dette skal håndteres; målgruppen alene udelukker ikke sådan behandling. |
| Nye/innovative teknologier | Generel AI-træning og 3D-eksperimenter er pauseret/fravalgt fra det afgrænsede launch-scope. De bruges ikke som en automatisk begrundelse for høj risiko her. Genåbn ved aktivering. |
| Hindring af rettigheder/tjenester | Ingen sådan afgørelsesfunktion identificeret. Manglende færdig eksport/sletning er dog en konkret rettighedsrisiko, som skal afhjælpes. |

**Konklusion:** Kombinationen af langvarige detaljerede husstandsdata, personhenførbare adfærdsmønstre og sammenstilling/deling gør det uforsvarligt at afslutte dokumentationen med en generel “lav risiko”-etiket. Projektets videre arbejde skal derfor omfatte en fuld DPIA med validerede foranstaltninger og en afsluttende vurdering af residualrisiko. Omfang/faktiske brugere og eventuelle andre kriterier skal indgå, når de er kendt.

## Foreløbigt risikoregister

Skala: lav/middel/høj beskriver en foreløbig kvalitativ risikovurdering, ikke sandsynligheder beregnet fra hændelsesstatistik. Eksisterende mekanismer er fra kode/dokumenter; ikke alle er fysisk eller driftsmæssigt valideret.

| Risiko for personer | Eksisterende mekanisme | Åben foranstaltning / evidens | Foreløbig residualstatus |
| --- | --- | --- | --- |
| Uautoriseret læsning af detaljeret historik og bolig | Auth, husstandsautorisation, krypterede forbrugspayloads, administrerede nøgler | Faktiske roller/MFA, sessionsbeskyttelse, logadgang og relevante autorisationskontroller på endelig release | Uafklaret; potentielt høj konsekvens |
| Et familiemedlem får mere adgang end forventet eller beholder kopier efter fjernelse | Eksplicit invitationsaccept, roller, medlemskontrol | Klar delingsinformation, annullering/session-/cachehåndtering og samlet fjernelses-/sletningskontrol | Uafklaret; ikke løst af én acceptknap |
| Indirekte afsløring af rutiner eller privat forbrug | Privat konto/husstand; ingen valgt reklameprofilering/videresalg | Dataminimering i visning, beskeder og drift; begrænset supportadgang; begrundet historiklivscyklus | Middel/ukendt efter endelig afgrænsning |
| Låseskærmsbeskeder eller genbrugte notifikationskeys afslører oplysninger til forkert person | Ny ejerafgrænset notifikationskø, v2-nøgler, payload-/klikguard og logout-oprydning er lokalt testet | [Rettelse og bevisgrænser](NOTIFICATION-ACCOUNT-ISOLATION.md); native flow, remote revocation og beskedindhold afventer samlet kontrol | Konkret nøgle-/racefejl rettet; residualrisiko er ikke endeligt godkendt |
| Uigennemsigtig lagring af gamle records, revisioner og backup | Cachebudgetter og enkelte tombstones | Reel retention-/sletteproces, backuphåndtering og dokumenteret kontrol af ophør | Åbent; cacheeviction er ikke sletningspolitik |
| Profil/filer/credentials behandles under forkerte krypteringsløfter | Forbrug krypteres; separat varmecredential-envelope | Korrekt information: backend kan håndtere nøgler, dokumenter/modeller har anden beskyttelse | Informationsrisiko kræver færdige politikker |
| Unødig tredjeparts-/SDK-behandling | Ingen identificeret direkte annonce-/analytics-init i gennemgåede områder | Native Firebase-/referrerafklaring, minimering af tilladelser og pauserede restkald | Uafklaret; ingen påstand om verificeret aktiv upload |
| Forkerte analyser påvirker brugerens økonomiske valg | Kompletheds-/kvalitetsflag og estimatbegrænsninger | Kontroller faktiske prisforudsætninger, manglende data og tydelige estimater i endelig version | Skal vurderes på faktisk release |
| Opfyldelse af rettighedsanmodning er utilstrækkelig eller rammer andre familiemedlemmer | Adskilte konto-/husstandskategorier er kortlagt | Færdig eksport/sletning, identitetskontrol og prøvesag med syntetiske data | Åbent før lancering |

## Arbejdet for at afslutte D09

Arbejdet er videreført i [konsekvensanalyse version 0.1](LEGAL-DPIA.md) med konkret behandlingsbeskrivelse, nødvendighed, ansvar og kontrolplan pr. risiko. Analysen er ikke endeligt godkendt; de åbne forhold nedenfor og i kontrolplanen skal afsluttes med evidens.

1. Færdiggør behandlingsbeskrivelse, konkrete nødvendigheds-/proportionalitetsvurderinger og livscyklus; tilføj reelt forventet omfang.
2. Udpeg ejer/ansvarlig og dokumentér hver risikos kontrol, gennemførelse og relevante bevis, ikke blot en plan.
3. Vurder om/hvordan repræsentative brugeres synspunkter skal indhentes, og begrund valget. Ingen brugere er kontaktet i dette skridt.
4. Vurder residualrisiko på ny. Forudgående høring efter artikel 36 er kun relevant, hvis sandsynlig høj risiko består efter relevante foranstaltninger; den må ikke antages at være påkrævet eller unødvendig nu.
5. Dokumentér ejerens endelige vurdering og plan for genvurdering ved ændringer. Skemaets udfyldelse gør ikke uafklarede tekniske forhold acceptable.

Ingen data er slettet, ingen myndighed er kontaktet og ingen release er foretaget.

## Officielle kilder

- [Datatilsynet – konsekvensanalyse](https://www.datatilsynet.dk/regler-og-vejledning/behandlingssikkerhed/konsekvensanalyse).
- [Datatilsynets vejledning](https://www.datatilsynet.dk/Media/2/6/Konsekvensanalyse.pdf).
- [EU-tilsynsmyndigheden Autoriteit Persoonsgegevens – kriterier og konkret vurdering](https://autoriteitpersoonsgegevens.nl/en/themes/basic-gdpr/gdpr-in-practice/data-protection-impact-assessment-dpia).

Anvendelsen på Huslyg og de foreløbige risikovurderinger ovenfor er vores projektspecifikke vurderinger ud fra dokumenteret kode/scope, ikke citater fra myndighederne.
