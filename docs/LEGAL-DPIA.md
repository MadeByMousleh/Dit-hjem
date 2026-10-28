# Huslyg – konsekvensanalyse for databeskyttelse

Version 0.1 · 26. oktober 2026 · **Arbejdsudkast; ikke endeligt godkendt.**

Dataansvarlig og beslutningsansvarlig: BluePeach, CVR 40876375, ved ejeren. Privatlivskontakt: Huslyg-teamet, info@huslyg.dk. Ingen formel DPO er udpeget; se [DPO-vurderingen](LEGAL-DPO-AND-CONSULTATION.md).

Dette dokument viderefører [screeningen](LEGAL-DPIA-SCREENING.md). Det beskriver behandling, nødvendighed, personrisici og konkrete betingelser for afslutning. Uafklarede kontroller er ikke godkendt gennem dokumentets oprettelse. Grundlaget er eksisterende kilde-/artefaktgennemgang og ejerens oplysninger; der er ikke foretaget en ny driftsaudit eller hentet kundedata her.

## 1. Behandling og omfang

Første udgivelse omfatter Android og iOS til voksne, gratis uden reklamer eller køb. Estimatet er cirka **100 aktive husstande**, oplyst af ejeren; det er ikke et verificeret antal brugere eller særskilte prognoser for lancering og år ét. Målinger kan også vedrøre medbeboere uden konto, herunder børn. Antal berørte personer, geografisk spredning og faktisk datamængde skal opdateres før generel lancering.

| Led | Data og behandling | Modtagere / afgrænsning |
| --- | --- | --- |
| Oprettelse og login | Mail, identitet, profil/adresse, session og husstandsrelation | App/backend og Supabase Auth/database; egne identitetsoplysninger forbliver personlige. |
| Tilvalgt forbrug | Eloverblik-autorisation, målerrelationer, daterede målinger og kvalitetsstatus importeres og gemmes | Autoriseret husstand; krypterede forbrugspayloads. Metadata er ikke nødvendigvis krypteret. Backendens administrerede nøgleflow giver mulighed for dekryptering. |
| Egen analyse | Historiske grafer, basisforbrug, tidsmønstre og sammenhold med priser/tariffer | Brugeren og accepterede familiemedlemmer. Estimater er ikke betydelige automatiske afgørelser som kredit- eller forsikringsafgørelser. |
| Bolig og tilvalg | Adressebaseret bolig/tag/matrikel/affald, eventuel varmeintegration og private plantegninger | Relevante dataleverandører, app/backend og husstandsmedlemmer. Plantegninger har ikke samme vault-kryptering som forbrug; varmecredentials har separat serverkryptering. |
| Familiedeling | Invitationsmail, inviterende konto, accept og medlemskab | Mailleverandør og tiltænkt modtager; efter accept fælles husstandsdata. Invitationsudløb er ikke sletning. |
| Drift og enhed | Request-/authlogs, cache, session og tilvalgte lokale påmindelser | Hosting/Auth og telefonens OS; support ved konkret behov. Native SDK-modtagere og faktisk logretention er endnu ikke fuldt afklaret. |
| Ophør | Frakobling, medlemsfjernelse, kontosletning og eventuelle backuprester | Livscyklus og verificeret oprydning mangler; frakobling af import sletter ikke automatisk tidligere historik. |

Generel træning på kundedata, reklameprofilering og videresalg er fravalgt. Skjulte gamle integrationers restkald skal kontrolleres/udbedres; en skjult menu er ikke dokumentation for stoppet behandling. Eksisterende offentlig APK og allerede lagrede oplysninger er omfattet af det fortsatte databeskyttelsesarbejde.

Detaljerede kilder, tabeller og adgangsforhold: [datakort](LEGAL-DATA-MAP.md), [teknisk inventar](LEGAL-TECHNICAL-DATA-INVENTORY.md) og [release-scope](LEGAL-RELEASE-SCOPE.md). Hostingregion alene dokumenterer ikke alle modtagere, supportadgange eller overførsler; leverandør-/overførselsvurderingen står åben.

## 2. Nødvendighed og proportionalitet

| Formål | Nødvendigt omfang og mindre indgribende alternativ | Konklusion / udestående |
| --- | --- | --- |
| Personlig konto og adgang | Identitet og husstandsrelation er nødvendige for private data. Anonym visning af offentlige priser kræver ikke samme personkobling. | Begræns personkobling til den bestilte funktion. Endelig kontrol af obligatoriske felter og grundlag under D07. |
| Privat historikarkiv | Historiske dage/timer kræver daterede detaljer; årssummer kan ikke genskabe en valgt dag. | Ejerens fulde arkivvalg bevares. Afklar kontolivscyklus/ophør og revisions-/backupfrister under D08; ingen automatisk 12-/24-månedersbeskæring. |
| Aktuel baseline og mønstre | Nuværende baseline bruger 30 dage, mønstre højst ét år. | Disse beregninger begrunder ikke alene alle års rådata; længere lagring begrundes særskilt med brugerens arkiv. Ingen nye tværgående træningsformål. |
| Familieadgang | Kun accepterede medlemmer skal have de nødvendige fælles oplysninger. Et link alene må ikke give adgang. | Oplys datadeling før accept; kontroller fjernelse og lokale kopier. Ejerens invitation er ikke generelt samtykke fra alle beboere. |
| Upload og boligoplysninger | Fil og relevante ejendomsfelter er nødvendige for den valgte funktion; rå nabodata/personoplysninger er ikke automatisk nødvendige. | Afgræns filindhold, oplys om rettigheder og dokumentér grundlag for andre berørte personer. |
| Support, logs og påmindelser | Udvalgte fejlmetadata frem for rå tokens/målinger; sagsbestemt support frem for rutineadgang; valgfri lokal påmindelse med begrænset tekst. | Afklar faktisk logretention, adgang og låseskærmsindhold. OS-tilladelse erstatter ikke anden nødvendig information. |

[Formålsmatrix og interesseafvejninger](LEGAL-PROCESSING-BASES.md) er arbejdsgrundlag, ikke en afsluttet godkendelse af alle behandlinger. Manglende grundlag skal løses før den pågældende behandling kan godkendes. Privatlivsinformation, eksport og sletning skal beskrive og understøtte de faktiske flows.

## 3. Personrisici og kontrolplan

Vurderingen vedrører konsekvenser for personer, eksempelvis afslørede rutiner, tab af kontrol eller økonomiske fejldispositioner. Lav/middel/høj er kvalitative vurderinger; ukendt sandsynlighed betegnes **uafklaret**, ikke automatisk lav. Planlagte kontroller tæller ikke som indførte. Der anvendes ingen numerisk score, som skjuler en alvorlig uafklaret risiko.

BluePeachs ejer har ansvar for gennemførelse og endelig vurdering af alle rækker. Teknisk arbejde kan udføres i projektet; leverandør- og ejerbekræftelser skal fremgå af evidensen. Frist: før generel lancering med den pågældende behandling; eksisterende konkrete sikkerhedsfejl håndteres løbende.

| ID | Hændelse og mulig personkonsekvens | Nuværende kontrol / evidens | Krav til afslutning | Residualrisiko nu |
| --- | --- | --- | --- | --- |
| DPIA-01 | Kompromitteret konto/admin giver adgang til bolig og rutiner | Auth, husstandsautorisation og krypterede forbrugspayloads; én oplyst intern administrator. Ejeren har bekræftet MFA på Vercel, Supabase og login-kontoen, jf. [adgangsdokumentationen](LEGAL-ADMIN-ACCESS.md) | T01/T02/T04: autorisationskontrol med syntetiske husstande, sessionsbeskyttelse og gennemgang af faktiske roller/tjenesteadgange. MFA-bekræftelsen er ikke en IAM-audit | Uafklaret; høj mulig konsekvens |
| DPIA-02 | Forkert familieadgang eller fortsat adgang efter fjernelse | Invitationsaccept og serverbaseret medlemskontrol er kortlagt | F01–F03/R07: kontroller modtagerbinding, afvis direkte API-adgang efter fjernelse, håndter cache/session og forklar eksporterede kopier | Uafklaret; høj mulig konsekvens |
| DPIA-03 | Besked til forkert konto eller afsløring på låseskærm | N01-kø, ejer-ID'er og race-/logoutkontroller lokalt testet og pakket i APK 1.0.122; installation fravalgt | F06/T02: native leverings-/kontoskiftkontrol og vurdering af indhold; remote fjernelse/offline enhed skal vurderes særskilt | Kendt race rettet; samlet risiko uafklaret |
| DPIA-04 | Overflødige dubletter eller efterladte data gør rutiner tilgængelige længere end nødvendigt | Arkivformål og særskilte revisions-/cachelag kortlagt | D08/L05/R03–R09: dokumenter konto-/arkivophør, revisioner/logs/backups og verificér sletteforløb uden at slette andre familiemedlemmers nødvendige data | Uafklaret |
| DPIA-05 | Brugeren tror filer er ende-til-ende-krypterede og uploader mere følsomt materiale | Forskelle mellem forbrug, filer, modeller og varmecredentials dokumenteret | P01–P06/T03: korrekt forståelig information i politik og relevant upload-/nøgleflow; ingen løfter om serverblind lagring | Uafklaret informationsrisiko |
| DPIA-06 | SDK, logs eller gamle integrationer deler unødige data | Teknisk inventar; ingen direkte annonce-/analytics-init fundet i gennemgåede områder | C01/C02/T02 og leverandørpunkter: fastslå faktisk native adfærd, stop unødige restkald og afklar modtagere/overførsler | Uafklaret; fravær af fund er ikke bevis for fravær |
| DPIA-07 | Uklar eksport/sletning fratager brugeren kontrol eller rammer medbeboere | Personlige/fælles datakategorier kortlagt | R01–R09: identitetskontrol og syntetisk prøvesag for eksport, kontosletning, medlemsfjernelse og relevante rester | Uafklaret |
| DPIA-08 | Ukorrekte priser/baseline fører til økonomiske valg på forkert grundlag | Kvalitets-/komplethedsflag og estimatbegrænsninger beskrevet | E06/E07: kontroller måler/netselskab, tidszoner, prisbestanddele, datamangler og brugerens forståelse på endelig release | Uafklaret; ingen væsentlig automatisk afgørelse identificeret |
| DPIA-09 | Fejladresseret invitation eller skadelig fil afslører relationer/kompromitterer adgang | Invitationsgrænser og filgrænser kortlagt, ikke samlet driftsvalideret her | F04/F05/T05: funktionelt mailindhold, afsenderopsætning, misbrugsbeskyttelse og relevante filkontroller | Uafklaret |

Evidens for notifikationsrettelsen: [NOTIFICATION-ACCOUNT-ISOLATION.md](NOTIFICATION-ACCOUNT-ISOLATION.md). De øvrige rækker kræver dokumentation under deres eksisterende checklist-ID'er; de er ikke ni nye hovedpunkter.

## 4. De berørtes synspunkter

Ejeren er hørt om formål, arkiv og forventet omfang. Det er ikke det samme som at høre repræsentative brugere/medbeboere. Foreløbig plan er en begrænset gennemgang af forståelsen af familiedeling, historiklagring, frakobling kontra sletning og låseskærmsbeskeder med syntetiske eksempler. Der skal ikke indsamles deltagernes faktiske forbrug til dette formål.

Før afslutning skal ejeren dokumentere, om og hvordan det er passende at indhente disse synspunkter, og enten registrere resultater/ændringer eller begrunde fravalget konkret. Ingen deltagere er kontaktet, og ingen ekstern undersøgelse er startet.

## 5. Beslutning, høring og genvurdering

**Status: Analysen er ikke klar til endelig godkendelse.** Manglende teknisk og driftsmæssig evidens gør det umuligt at afslutte residualvurderingen forsvarligt. Cirka 100 husstande gør ikke automatisk alvorlige personrisici lave.

For at afslutte skal ejeren bekræfte behandlingsbeskrivelsen, færdiggøre de relevante grundlags-/livscyklusvurderinger, dokumentere gennemførte foranstaltninger og vurdere sandsynlighed/konsekvens på ny for hver risiko. Eventuel brugerinddragelse/fravalg skal dokumenteres. En ejergodkendelse alene erstatter ikke manglende sikkerhedsforanstaltninger.

Forudgående høring efter artikel 36 skal vurderes ud fra risikoen **efter** relevante foranstaltninger. Hvis sandsynlig høj risiko består, kræves håndtering efter reglerne før den pågældende behandling; ingen høring er indledt, og unødvendighed er ikke konkluderet. D09 og D10 forbliver derfor åbne.

Ejeren genvurderer analysen ved væsentlige ændringer i funktioner, formål, modtagere, datamængde, teknik, identificerede trusler eller hændelser og i forbindelse med projektets årlige gennemgang. Den årlige kadence er en intern kontrol. Generel AI-træning, aktivering af pauserede integrationer eller udvidet offentlig deling kræver ny vurdering inden aktivering.

## Officielt grundlag og versionsspor

- [Datatilsynet – konsekvensanalyse](https://www.datatilsynet.dk/regler-og-vejledning/behandlingssikkerhed/konsekvensanalyse), kontrolleret 26. oktober 2026: nødvendighed/proportionalitet, personrisici, passende brugerinddragelse og eventuel forudgående høring.
- [GDPR, herunder artikel 35–36](https://eur-lex.europa.eu/eli/reg/2016/679/oj). De konkrete Huslyg-vurderinger ovenfor er projektets egne.
- Version 0.1: behandlingsbeskrivelse, nødvendighed, ansvarlig kontrolplan og åbne beslutninger samlet fra eksisterende dokumentation. Ingen app-/databaseændring, datanedskæring, ny ekstern datadeling, myndighedskontakt eller release.
