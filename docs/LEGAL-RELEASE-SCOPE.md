# Huslyg – funktionsoversigt til juridisk udgivelsesgennemgang

Dato: 25. oktober 2026. Tjeklistepunkt: **S02**.

Opfølgning samme dato: test-APK 1.0.120/code 121 er installeret med “Om Huslyg” på login/profil. Samme kontaktfunktion og en offentlig kontakt-/udgiverside er efter godkendelse udgivet på web. Dette er tilføjelsen til nedenstående funktionsbaseline; se [B03-rapport](LEGAL-CONTACT-RELEASE.md). Det eksisterende offentlige APK-download er ikke erstattet.

## Afgrænsning og bevis

Dette dokument registrerer funktionerne i den nuværende Android-kandidat **1.0.119 / versionCode 120**, med det valgte fremtidige navn Huslyg. Det nuværende navn i appen er fortsat Strømblik. Registrering af en funktion betyder ikke, at den er juridisk godkendt, fysisk afprøvet eller klar til markedsføring.

Gennemgangen er baseret på lokal kildekode, den isolerede APK-kilde i `.tmp/property-model-apk-release/` og projektets release-dokumentation. Ingen ændringer af app, backend eller database og ingen nye live-/enhedstests i denne opgave. Web og iOS er ikke verificeret som identiske med Android-kandidaten.

`HomeCategories`, `BottomTabs`, `pausedHomeFeatures`, `HomePropertyPage`, `ProfilePage` og `HeatingPage` er sammenlignet med APK-kilden og er identiske. Dashboard og sekundære sider er læst direkte fra APK-kilden, fordi roden også indeholder andet lokalt arbejde. Det er en kildekontrol; tidligere dokumenter beskriver selve APK-pakning og installation.

## Funktioner i den nuværende kandidat

| Område / indgang | Funktion | Data og adgang | Afgrænsning / udestående |
| --- | --- | --- | --- |
| Konto og opsætning | Oprettelse/login med mailbekræftelse, personligt navn, adresse og tilknytning til husstand. | Mail, konto-ID, navn, adresse, husstandsrelation og session. | Endelig privatlivsinformation, rettighedsflows og juridiske sider behandles særskilt i tjeklisten. |
| Overblik | Dashboard med valgte widgets, grafer, genveje og gemt rækkefølge. | Profil-/widgetindstillinger og relevante pris-, forbrugs- eller varmedata. | Indhold afhænger af brugerens widgets og datatilslutninger; alle brugere har ikke samme udfyldte dashboard. |
| Spotpriser / widget | Interaktiv prisgraf, prisvisning med moms/afgifter eller kun spotpris, farvegrænser og netselskabsvalg med mulighed for gendannelse. | Offentlige pris-/tarifdata, prisområde, automatisk netselskabsgrundlag og brugerens valg. | Manuel overstyring er et valg, ikke dokumentation for brugerens faktiske netselskab. Leverandørkatalogets dækning er ikke en garanti for alle tariffer i Danmark. |
| Mit hjem → El | Tilslutning til Eloverblik samt gemt historisk forbrug og importstatus. | Autoriserede målepunkter, forbrug, periode-/kvalitetsmetadata og importstatus. | Historiske målinger, ikke live aflæsning. Tilgængelig periode afhænger af fuldmagt, måler og leverandør. Fuld import og oprindelig intervalopløsning må ikke loves ud fra lokal ny kode alene. |
| El → Forbrug | Dag-/måned-/årsvisning, sammenligning af år, månedsoversigt og beregnet pris. | Gemte målinger, elaftaler og det relevante prisgrundlag. | Manglende målinger er ikke nulforbrug. Beregnet pris skal beskrives med de faktiske forudsætninger, ikke som garanteret fakturabeløb. |
| El / Boligens eloverblik | Estimeret grundforbrug og årsforbrug samt netselskabsoplysning. | Afledte værdier fra gemt historik samt adresse-/måleroplysninger. | Grundforbrug er et estimat og identificerer ikke bestemte apparater eller tomt hus. Årsforbrug skal bevare faktisk periode/dækning. |
| El → Forbrugsmønstre | Visning af fordeling på timer og ugedage samt strøm i billige timer, når datagrundlaget rækker. | Forbrugshistorik og historiske spotpriser. | Arkivaktivering er dokumenteret, men et komplet historisk arkiv er ikke dermed garanteret. Ventetilstand og utilstrækkelig dækning må ikke beskrives som færdig statistik. |
| El → Elaftale og målerdetaljer | Visning/håndtering af aftaleoplysninger og oplysninger om tilknyttede målepunkter. | Elaftalehistorik, måleroplysninger og afledte prisberegninger. | Ingen aftaleformidling eller leverandørskift er fastslået som funktion i denne gennemgang. |
| Mit hjem → Boligen | Fanerne Overblik, Boligen, Tag, Matrikel og Plantegning. Generelle boligoplysninger og lokal caching. | Adresse-/registerdata, bolig-/grundoplysninger og bruger-/husstandsbundet cache. | Offentlige ejendomsdata kan stadig være personhenførbare. Kilde-/brugsrettigheder undersøges særskilt. |
| Boligen → Tag | Omtrentlig tagflade og hældning, når geometrien og kvalitetskravene tillader det. | Eksisterende husgeometri/LiDAR eller overflade-/terrændata. | Estimater, ikke opmåling eller garanti for en bestemt nøjagtighed. Ingen ukritisk erstatning med grundplanens areal ved manglende tagdata. |
| Boligen → Matrikel | Forenklede grund-/matrikeloplysninger og kortvisning. | Adresse, grundgrænser og relevante offentlige geografiske data. | Ikke en landinspektøropmåling eller en selvstændig afgørelse om ejendomsret. |
| Boligen → Plantegning | Upload, liste, visning/åbning og sletning af PDF/JPEG/PNG, afgrænset til husstand og adresse. | Brugeruploadede filer og filmetadata. | Backend/database er aktiveret ifølge dokumentationen. Filer er private til husstanden, men ikke ende-til-ende-krypterede. Faktisk autentificeret upload og native filvælger/PDF-åbning afventer dokumenteret kontrol. Filerne bruges ikke til AI-træning ifølge den aktuelle funktionsdokumentation. |
| Mit hjem / bundnavigation → Varme | Visning af gemt varmehistorik, årsoversigt og fremløbs-/returtemperaturer samt tilknytnings-/opdateringsflow via eForsyning. | Varmehistorik og relevante konto-/installationsoplysninger; den viste side er knyttet til Sønderborg Varme. | **Varme er fortsat synlig**. Det er ikke dokumentation for landsdækkende leverandørunderstøttelse eller en ny verificeret rigtig kundetilslutning. Credential-/databehandling skal med i den senere datakortlægning. |
| Mit hjem → Affald | Adressebaseret kalender med kommende tømninger og lokale telefonpåmindelser med valgte intervaller. | Adresse, tømningsdatoer, påmindelsesvalg og telefonens notifikationstilladelse. | Dækning afhænger af datakilden. Når faktisk tidspunkt mangler, planlægges ud fra antaget kl. 07 dansk tid. Fysisk notifikationslevering er ikke verificeret i denne gennemgang. |
| Mit hjem → Familie | Medlemsoversigt, invitation, eksplicit accept og fælles bolig-/forbrugsdata med egne navne/mailkonti. | Inviterede mailadresser, roller, invitationstilstand og husstandsrelationer. | Synlig funktion og aktiveret backend ifølge seneste release-dokumentation. **Resend-nøgle og afsender manglede ved seneste dokumenterede kontrol**; reel maillevering og fuldt invitationsflow er derfor endnu ikke verificeret. Ikke genkontrolleret live her. |
| Profil | Profil-/adressehåndtering og præferencer for beskeder/påmindelser. | Personlige profiloplysninger og beskedindstillinger. | En synlig indstilling beviser ikke levering eller markedsføringssamtykke. Kortlæg konkrete beskedtyper og baggrundsarbejde ved de senere data-/notifikationspunkter. |

## Uden for den beskrevne brugerudgivelse

- Bil, lader, apparater og SmartThings er filtreret fra navigationen via `pausedHomeFeatures.ts`.
- Den ufærdige hus-/sol- og 3D-visning er ikke en fane på den forenklede boligside.
- Lokale AI-trænere, annotation og eksperimenter er ikke beskrevet som slutbrugerfunktioner i denne udgivelse.
- Automatisk identificering af bilopladning og garanteret apparatgenkendelse er ikke medtaget som færdige funktioner.
- En ny huslyg.dk-markedsføringsforside er endnu ikke implementeret som del af denne opgave. Eksisterende invitationsside/APK-download er en separat dokumenteret udgivelse.

Dette afslutter ikke S03: gamle integrationer, hook-kald, serverruter og data kan stadig findes, selv når en indgang er skjult. De skal kontrolleres særskilt, før vi siger, at behandling er ophørt. Betaling, reklamer og endelig målgruppe afgøres under S05; deres fravær er ikke certificeret her.

## Kildehenvisninger i projektet

- [APK-kildens dashboard](../.tmp/property-model-apk-release/src/screens/DashboardScreen.tsx) og [sekundære sider](../.tmp/property-model-apk-release/src/screens/SecondaryTabsScreen.tsx).
- [Mit hjem-kategorier](../src/components/HomeCategories.tsx), [bundnavigation](../src/components/BottomTabs.tsx) og [midlertidigt skjulte indgange](../src/utils/pausedHomeFeatures.ts).
- [Boligens faner](../src/components/HomePropertyPage.tsx), [varmesiden](../src/components/HeatingPage.tsx), [profil](../src/components/ProfilePage.tsx) og [widgettyper](../src/utils/electricityWidgets.ts).
- [Forenklet bolig og plantegninger](MIT-HJEM-SIMPLE.md), især aktiveringsopdateringen fra 24. oktober; ældre afventende noter er historik.
- [Forbrugshistorik og spotprisarkiv](ELECTRICITY-HISTORY-IMPORT.md), [netselskabsvalg](GRID-SUPPLIER-SETTINGS.md) og [familie/påmindelser med seneste release-status](FAMILY-AND-REMINDERS-RELEASE.md).

## Resultat for S02

Funktionslisten og dens væsentlige begrænsninger er dokumenteret. **S02 kan krydses af som dokumentationsopgave**. Juridisk godkendelse, udbedring af udeståender, fysisk acceptkontrol og den endelige releasebeslutning forbliver i deres egne åbne punkter. Ved ændret kandidat skal denne oversigt opdateres.
