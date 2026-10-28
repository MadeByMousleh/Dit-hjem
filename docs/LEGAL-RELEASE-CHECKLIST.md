# Huslyg – juridisk tjekliste før udgivelse

Oprettet: 25. oktober 2026. Omfatter Danmark/EU, appen, backend og huslyg.dk.
Grundlag: brugerens vedhæftede lanceringsliste, en begrænset lokal kode-/dokumentgennemgang og myndigheds-/butikskilder nedenfor.

Status 27. oktober 2026: **47 afsluttede og 61 åbne af 108**. [50-punktsrunden](LEGAL-BATCH-50.md) er et historisk snapshot; efterfølgende implementering, dev-tests, installeret APK og den særskilt godkendte backendaktivering er dokumenteret i [implementeringsrapporten](ACCOUNT-PRIVACY-IMPLEMENTATION.md). Afsluttede delopgaver er ikke en samlet releasegodkendelse.

## Sådan bruger vi listen

Hvert punkt har et fast ID. Sæt først `[x]`, når opgaven er udført og dokumenteret. Skriv dokumentationslink, dato og ansvarlig i afslutningsloggen nederst. En eksisterende funktion eller tidligere test er ikke i sig selv juridisk godkendelse.

- **A:** App-ejeren udfylder eller beslutter.
- **K:** Implementering og teknisk kontrol.
- **J:** Juridisk vurdering; ejeren har ansvaret og inddrager rådgiver ved behov.
- **FØR RELEASE:** Skal være afklaret/udført før offentlig udgivelse med den relevante funktion.
- **BETINGET:** Afklar om kravet gælder. Hvis nej, dokumentér begrundelsen og markér derefter punktet afsluttet.

Dette er vores arbejds- og dokumentationsliste, ikke en erklæring om, at appen allerede er juridisk klar. Ingen krav er på forhånd krydset af. Privatliv og sikkerhed gælder også ved offentlig APK-download uden om butikkerne.

## 0. Afgræns den version, vi udgiver

### Afsluttet: S01 – udgiver og navn

Afsluttet 25. oktober 2026 med ejerens oplysninger og bekræftelser i samtalen. Ejeren har valgt **Huslyg** som endeligt appnavn og bekræftet **BluePeach, CVR 40876375**, som udgiver. Lokal appkonfiguration bruger fortsat det tidligere navn **Strømblik**; intet app-/pakkenavn er ændret i dette dokumentationsskridt.

| Oplysning | Status |
| --- | --- |
| Domæne | huslyg.dk, valgt af ejeren |
| Endeligt app-/brandnavn | Huslyg, valgt af ejeren 25. oktober 2026 |
| Juridisk udgiver | BluePeach, CVR 40876375; bekræftet af ejeren i svar på spørgsmålet om de to virksomheder |
| Kontaktperson og kontaktmail | Huslyg-teamet · info@huslyg.dk, oplyst af ejeren |
| Navn på tværs af app, mails og butik | Huslyg er det valgte navn; resterende Strømblik-branding skal opdateres og kontrolleres særskilt |

Virksomhedsopslag 25. oktober 2026: [Paqle](https://www.paqle.dk/p/bluepeach/2334974) viser BluePeach, CVR **40876375**, som personligt ejet mindre virksomhed. Ejeren har efterfølgende bekræftet virksomhed, adresse og virksomhedsform. BluePeach Group I/S og Blue Peach I/S anvendes derfor ikke som udgiver. B01 er afsluttet på ejerbekræftede oplysninger; det officielle CVR-opslag kunne ikke hentes, og uafhængig officiel verifikation er ikke gennemført.

S01 afslutter fastlæggelsen af identitet og navn. B01 og B02 er efterfølgende afsluttet på ejerens bekræftelser med de beskrevne bevisgrænser. Kontaktoplysninger er publiceret under B03; DNS-opfølgning (T02) og samlet konsistens i releaseversionen (LANC03) er fortsat åbne. Teamnavnet erstatter ikke den juridiske udgiver.

- [x] S01 · A · FØR RELEASE: Fastlæg udgiver, appnavn, domæne og kontaktperson; afklar navnene Huslyg og Strømblik på tværs af app, mails og butik.
- [x] S02 · A/K · FØR RELEASE: Skriv hvilke funktioner der faktisk er med: elpriser, Eloverblik-forbrug, bolig/grund/tag, plantegninger, affald og eventuel familieadgang. Se [funktionsoversigt og begrænsninger](LEGAL-RELEASE-SCOPE.md), inklusive den fortsat synlige varmefunktion.
- [x] S03 · A/K · FØR RELEASE: Registrér udeladte funktioner og kontroller baggrundskald. [Oprindelige rester registreret](LEGAL-RELEASE-DECISIONS.md); [klientkald til pauserede integrationer er efterfølgende stoppet i den byggede APK 1.0.124](PAUSED-INTEGRATION-CONTROL.md). Den er ikke installeret/webpubliceret, og ældre klienter/backendruter kræver fortsat opfølgning under C01/T02/LANC03.
- [x] S04 · A · FØR RELEASE: Ejeren har valgt Android og iOS fra første udgivelse. Eksisterende offentlig APK er registreret; Google Play- og Apple-punkterne gælder begge. Se [beslutning](LEGAL-RELEASE-DECISIONS.md).
- [x] S05 · A/J · FØR RELEASE: Ejeren har valgt voksne 18+, gratis uden reklamer eller køb. Se [scope og vurderingsgrænser](LEGAL-RELEASE-DECISIONS.md); faktisk fravær af tracking undersøges særskilt.

### Observationer fra projektet – skal følges op

| Observation | Grundlag | Opfølgning |
| --- | --- | --- |
| Login har en intern privatlivsvisning; det beviser ikke en fuld, offentligt tilgængelig politik. | `src/screens/LoginScreen.tsx` | P01–P06 |
| Det oprindeligt manglende kontosletningsflow er efterfølgende implementeret og aktiveret under R03/R06. Samlet livscyklus er fortsat åben. | [Implementeringsrapport](ACCOUNT-PRIVACY-IMPLEMENTATION.md) | R04/R05/R07–R09 |
| `public/` indeholder ikke dedikerede privatlivs-, vilkårs- eller sletningssider i den lokale kildekode. Live-URL'er er ikke kontrolleret i denne opgave. | Lokal filoversigt | P01, R04, V01 |
| Androids release-konfiguration vælger debug-signering. | `android/app/build.gradle` | G02 |
| Krypteringsdokumentationen beskriver både ældre recovery-nøgler og nyere administrerede nøgler. | `supabase/ENCRYPTED-ENERGY.md` | D06, T03 |
| Familie-backend og offentlig APK er ifølge seneste release-dokumentation udgivet; mailafsenderkonfiguration og samlet invitationsflow afventer. Ikke genkontrolleret live her. | `docs/FAMILY-AND-REMINDERS-RELEASE.md` | F01–F06 |

## 1. Udgiver og virksomhed

Kilde: [Forbrugerombudsmanden – e-handelsloven](https://forbrugerombudsmanden.dk/alle-emner/anden-lovgivning/e-handelsloven).

- [x] B01 · A · FØR RELEASE: Virksomhedsoplysninger registreret og bekræftet af ejeren: BluePeach, CVR 40876375, personligt ejet mindre virksomhed, c/o Mohammed Mousleh, Krog-Meyers Vej 28, 6400 Sønderborg. [Grundlag](LEGAL-RELEASE-DECISIONS.md); ikke uafhængigt verificeret i officiel CVR.
- [x] B02 · A · FØR RELEASE: info@huslyg.dk og ejerens ansvar i Huslyg-teamet er bekræftet af ejeren, herunder afsendelse/modtagelse. [Driftsbekræftelse og åben DNS-opfølgning](LEGAL-RELEASE-DECISIONS.md). Ingen mailtest udført af Codex.
- [x] B03 · A/K · FØR RELEASE: Udgiver-/kontaktoplysninger findes på login og profil i installeret test-APK 1.0.120 og er publiceret på web efter ejerens godkendelse. Offentlig adgang fra web-login og [kontaktsiden](https://huslyg.dk/kontakt.html) er verificeret live. Se [udgivelse og bevisgrænser](LEGAL-CONTACT-RELEASE.md).
- [x] B04 · A/J · BETINGET: Afklaret for det oplyste gratis scope uden anden indtjening/betalte udenlandske tjenester; ejeren håndterer selv bilag og indberetning. [Konklusion, myndighedskilder og genåbningskriterier](LEGAL-BUSINESS-READINESS.md). Ingen generel skatte-/momsfritagelse eller kontrol af tidligere regnskabsår er erklæret.
- [ ] B05 · A · FØR RELEASE: Kontroller rettigheder til navn, domæne, logo og appens markedsføringsmateriale.
  Påbegyndt: [navn, domæne og aktivoversigt](LEGAL-BRAND-RIGHTS.md). Afventer dokumenterede navnesøgninger og rettighedsgrundlag; almindelig websøgning er ikke bevis for ledighed.

## 2. Kortlæg data og behandlingsgrundlag

Kilder: [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [Datatilsynet – konsekvensanalyse](https://www.datatilsynet.dk/regler-og-vejledning/behandlingssikkerhed/konsekvensanalyse).

- [ ] D01 · A/K · FØR RELEASE: Opret en behandlingsfortegnelse med data, formål, grundlag, kilder, modtagere, placering og slettefrist.
  [Samlet behandlingsfortegnelse oprettet](LEGAL-PROCESSING-REGISTER.md), suppleret af [teknisk datakortlægning](LEGAL-DATA-MAP.md). Grundlag, godkendte slettefrister og leverandør-/overførselsafklaringer mangler før den samlede fortegnelse afsluttes.
- [x] D02 · K · FØR RELEASE: Konto, profil, familie, invitationer og indstillinger er [teknisk kortlagt](LEGAL-DATA-MAP.md) med lagring, modtagere og åbne sletteforhold.
- [x] D03 · K · FØR RELEASE: Målepunkter, målinger, afledninger, netselskab og priser er [teknisk kortlagt](LEGAL-DATA-MAP.md). Aktuel APK-import bruger Hour; nyere lokal Actual-import er ikke gjort til en påstået udgivet funktion.
- [x] D04 · K · FØR RELEASE: Bolig, billeder, plantegninger, husmodeller og metadata er [teknisk kortlagt](LEGAL-DATA-MAP.md), inklusive ikke-vault-krypterede payloads og tombstones.
- [x] D05 · K · FØR RELEASE: [Tekniske data kortlagt](LEGAL-TECHNICAL-DATA-INVENTORY.md): IP/requestlogs, sessioner/caches, varmecredentials, notifikationer og SDK-/APK-fund. Faktisk leverandørretention, native SDK-adfærd og konkrete sikkerhedsrettelser er særskilte åbne punkter.
- [x] D06 · K · FØR RELEASE: [Nøgle-/læseadgang dokumenteret](LEGAL-DATA-MAP.md), suppleret med ejerens bekræftelse af, at kun ejeren har intern administratoradgang til Vercel/Supabase. Leverandøradgang er særskilt; T04/IAM-/MFA-kontrol er ikke afsluttet.
- [ ] D07 · A/J · FØR RELEASE: Fastlæg grundlag pr. formål. Adskil nødvendig appdrift fra markedsføring, analyse, deling og eventuel modeltræning; dokumentér interesseafvejning hvor relevant.
  Påbegyndt: [formålsmatrix og to konkrete interesseafvejninger](LEGAL-PROCESSING-BASES.md). Ejeren har bekræftet kun egne appformål, familiedeling og nødvendig drift/support, uden generel AI-træning, reklameprofilering eller videresalg. De markerede nødvendigheds-/driftsafklaringer står stadig åbne.
- [x] D08 · A/J · FØR RELEASE: [Nødvendighed og periodekriterium for privat målingsarkiv afsluttet](LEGAL-CONSUMPTION-HISTORY-NECESSITY.md): al tilgængelig historik til gamle dage/timer og årssammenligning under den fortsat nødvendige arkivtjeneste. Implementeret sidste-medlem-ophør og særskilt fælles-husstandsmodel; ingen automatisk 12-/24-månedersbeskæring. Logs, revisioner, backups og samlet oprydning er fortsat særskilte åbne L05/L06/R05/R09-punkter.
- [ ] D09 · A/J · FØR RELEASE: Lav en dokumenteret DPIA-screening for detaljerede husstands-/adfærdsmønstre og samkøring. Gennemfør konsekvensanalyse før behandlingen, hvis høj risiko gør den nødvendig.
  [Screening udført](LEGAL-DPIA-SCREENING.md) og [konsekvensanalyse version 0.1 udarbejdet](LEGAL-DPIA.md) med omfang, nødvendighed og ni personrisici med ansvar, kontrolkrav og evidensbehov. D09 står åbent, indtil foranstaltninger, brugerinddragelse og residualrisiko er vurderet og dokumenteret. Ingen myndighedshøring er på forhånd antaget nødvendig.
- [ ] D10 · A/J · BETINGET: Vurder behov for DPO og eventuel forudgående høring ved vedvarende høj risiko. Dokumentér også en konklusion om, at det ikke er nødvendigt.
  [Foreløbig DPO-vurdering dokumenteret](LEGAL-DPO-AND-CONSULTATION.md): Ejeren forventer cirka 100 aktive husstande. På kendt scope er DPO-pligt ikke påvist; ingen fast antalsgrænse er lagt til grund. Forudsætninger bekræftes før generel lancering og genvurderes ved vækst/ændringer samt mindst årligt. D10 står åbent, fordi høring stadig afhænger af residualrisikoen i den endnu ikke afsluttede DPIA.

## 3. Privatlivspolitik og information

Kilder: [GDPR artikel 13–14](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [Apple – privatlivskrav](https://developer.apple.com/app-store/review/guidelines/#privacy).

- [ ] P01 · A/J/K · FØR RELEASE: Publicér en dansk privatlivspolitik som offentligt tilgængelig HTML uden login, fx `https://huslyg.dk/privatliv`. URL'en er et forslag, ikke en eksisterende side.
  [Dansk publiceringsudkast](LEGAL-PRIVACY-DRAFT.md) dækker P01–P06; markerede grundlag, modtagere/overførsler, frister og SDK-forhold skal afklares før endelig tekst/HTML og publicering. Ingen ikke-fungerende privacylinks indført i appen.
- [ ] P02 · A/J · FØR RELEASE: Beskriv dataansvarlig, formål, grundlag, datatyper og datakilder, også oplysninger fra andre end brugeren.
- [ ] P03 · A/J · FØR RELEASE: Beskriv modtagere, familieadgang, overførsler uden for EØS, opbevaring og eventuel profilering/automatiserede afgørelser.
- [x] P04 · A/J · FØR RELEASE: [Rettighedsteksten er færdiggjort](LEGAL-PRIVACY-DRAFT.md): rettigheder, kontakt, klage, tilbagetrækning og konsekvenser ved manglende nødvendige oplysninger er beskrevet. Afsluttet som tekst-/beskrivelsesopgave; samlet politik, publicering og tekniske rettighedsflows forbliver åbne under P01/P05/R02/R08/R09.
- [ ] P05 · K · FØR RELEASE: Link politikken før konto-/dataoprettelse samt fra profil/indstillinger og hjemmesidens footer.
- [ ] P06 · A/K · FØR RELEASE: Angiv ikrafttrædelsesdato/version og en proces for relevante ændringsmeddelelser. Privatlivsinformation må ikke blandes sammen med frivilligt samtykke.

## 4. Brugernes rettigheder og kontosletning

Kilder: [Datatilsynet – rettigheder](https://www.datatilsynet.dk/borger/hvad-er-dine-rettigheder), [Apple – kontosletning](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Google – kontosletning](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

- [x] R01 · A/K · FØR RELEASE: [Manuel modtagelses-, identitets- og fristprocedure etableret](LEGAL-RIGHTS-PROCEDURE.md) med ejerens supportansvar og ejerbekræftet info@huslyg.dk. Backendeksport, sletning og samlet prøvesag er særskilte åbne R02–R09-punkter.
- [ ] R02 · K · FØR RELEASE: Giv adgang til indsigt og en forståelig kopi; understøt dataportabilitet, hvor retten gælder. En bestemt eksportknap er ikke altid lovkravet, men processen skal virke.
- [x] R03 · K · FØR RELEASE: Profil → Dine data kan starte reel kontosletning med frisk login, indtastet bekræftelse og beskyttet efterfølgervalg. Installeret APK 1.0.123; backend særskilt godkendt og aktiveret. [Implementering, dev-/UI-kontrol og bevisgrænser](ACCOUNT-PRIVACY-IMPLEMENTATION.md). Ingen rigtig konto slettet som test; samlet R05/R07/R09 fortsat åben.
- [x] R04 · K · FØR GOOGLE PLAY: [Offentlig sletteindgang publiceret og kontrolleret](ACCOUNT-DELETION-WEB-PAGE.md): https://huslyg.dk/slet-konto.html kan åbnes uden login/app og giver tydelig mailvej samt beskrivelse af egne/delte data og undtagelser. Begge domæners HTML matcher det godkendte forslag. Samlet retention/teknisk sletning og Play Console-feltet er fortsat særskilte L05/R05/G05-punkter.
  [Siden er nu live](https://huslyg.dk/slet-konto.html). Restopbevaring og samlet datalivscyklus er særskilte åbne punkter; ingen fuld privatlivspolitik er erklæret færdig.
- [ ] R05 · K · FØR RELEASE: Gennemfør sletning på backend og relevante leverandører: Auth, profil, personhenførbare forbrugsdata, filer, invitationer, sessions-/adgangstokens og nøgler efter den fastlagte politik.
- [x] R06 · A/J/K · FØR RELEASE: [Delt-/sidste-medlem-model implementeret og syntetisk dev-testet](ACCOUNT-PRIVACY-IMPLEMENTATION.md): kræv gyldig ny ejer ved behov, bevar øvriges fælles arkiv/nøgle, slet sidste hjem ved Auth-hard-delete, og rul hele ændringen tilbage ved fejl. Konkrete indsigelser om egne oplysninger i fælles data behandles stadig efter rettighedsproceduren; fuld oprydning/verifikation er særskilt.
- [ ] R07 · K · FØR RELEASE: Informér om behandlingstid og nødvendige undtagelser; send bekræftelse og tilbagekald aktive sessioner/adgange.
- [ ] R08 · A/K · FØR RELEASE: Etabler berigtigelse, begrænsning og indsigelse samt sikker levering af eksport; undgå andre familiemedlemmers private data i svaret.
- [ ] R09 · A/K · FØR RELEASE: Afprøv én samlet eksport-/sletningssag med syntetisk konto og delt husstand; dokumentér database, filer, enheder og leverandører.

## 5. Leverandører, databehandleraftaler og opbevaring

Kilde: [GDPR artikel 28, 30 og kapitel V](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

- [x] L01 · A/K · FØR RELEASE: [Leverandørregister oprettet](LEGAL-SUPPLIERS-AND-RETENTION.md) for hosting/Auth, mail, data-/integrationskilder og native tjenester med aktiv/tilvalgt/pauseret/uafklaret status. Bibliotek er ikke automatisk ekstern modtager; faktisk SDK-adfærd og aftaler står fortsat åbne under C01/L02–L04.
- [ ] L02 · A/J · FØR RELEASE: Afklar roller og indgå databehandleraftaler, hvor leverandøren er databehandler; dokumentér underdatabehandlere.
  Ejeren har bekræftet accepterede Vercel-/Supabase-DPA'er; offentlige aftaler er gennemgået. [Versions-/dæknings-/øvrige leverandørmangler og fristplan](LEGAL-SUPPLIERS-AND-RETENTION.md) holder L02–L07 åbne.
- [ ] L03 · A/J/K · FØR RELEASE: Kontroller database, filer, logs, backup og supportadgang hver for sig. En serverregion i EU dokumenterer ikke alene, at alle overførsler forbliver i EØS.
- [ ] L04 · A/J · BETINGET: Dokumentér gyldigt overførselsgrundlag og nødvendige vurderinger/supplerende foranstaltninger ved tredjelandsoverførsler.
- [ ] L05 · A/K · FØR RELEASE: Fastlæg konkrete opbevaringsfrister for konto, forbrug, filer, logs, invitationer og samtykkebeviser.
- [ ] L06 · K · FØR RELEASE: Implementér oprydning samt en backup-/restore-proces, der håndterer tidligere sletteanmodninger; dokumentér maksimal restopbevaring.
- [x] L07 · A/K · FØR RELEASE: [Intern inaktivitets-/afviklingsprocedure fastlagt](LEGAL-SERVICE-CLOSURE.md): ingen automatisk lukning for manglende login, mindst 60 dages varsel ved almindelig planlagt afvikling, fuld sikker eksport, individuelle/delte hjem og særskilt godkendt ophørsplan. Ingen varsling eller sletning iværksat; teknisk udførelse/retention er fortsat særskilte åbne punkter.

## 6. Eloverblik, boligdata og rettigheder til indhold

Dette er konkrete kontrakt-/rettighedskontroller for vores datakilder; de er ikke erklæret godkendt ved denne gennemgang.

- [ ] E01 · A/J · FØR RELEASE: Kontroller Eloverbliks aktuelle aftalegrundlag, produktionsadgang og tilladte brug af historik og afledte analyser.
- [x] E02 · K · FØR RELEASE: [Informations-/administrationsvej implementeret og pakket i APK 1.0.125](ELOVERBLIK-DATA-INFORMATION.md): fuldmagtens målere, gemte målepunkter, historiske/forsinkede målinger, link til at fjerne egen fuldmagt hos Eloverblik og forskel fra arkivsletning. UI, TypeScript og pakke kontrolleret. Ingen påstået lokal tilbagekaldelse ved klik; faktisk provider-/telefonkontrol og endelig publicering er særskilte.
- [ ] E03 · A/J/K · FØR RELEASE: Kontroller licenser og kildeangivelser for spotpriser, nettariffer, BBR, matrikel, LiDAR, kort og skråfotos; afklar kommerciel visning, caching og viderebrug hver for sig.
  Energinet-skiftet er [godkendt og aktiveret i produktion, med APK-kandidat 1.0.126 klar](ENERGINET-PRICE-MIGRATION.md): 100 adresser og 35 tarifområder sammenlignet; Strømligning beholdes kun i sammenligningsværktøjet i den nye version. Ældre installerede APK-versioner skal opdateres. Øvrige kildekrav mangler; E03 er derfor fortsat åbent.
- [ ] E04 · A/J · BETINGET: Indhent rettigheder til EDC-/mæglerbilleder, plantegninger og andet beskyttet materiale før visning eller træning. At kunne hente en fil giver ikke automatisk brugsret.
  Ejeren har bekræftet, at dokumentation findes. [Omfang og rester](LEGAL-FEATURE-DISCLOSURES.md): konkret dokumentreference, aktiver og tilladt visning/ændring/kommerciel brug/træning skal afklares; intet generelt træningssamtykke er udledt.
- [x] E05 · A/J/K · FØR RELEASE: Uploadvisningen i APK 1.0.123 oplyser om rettigheder, husstandsdeling, mindst nødvendige persondata, privat lagring/visning og fravalg af generel AI-træning samt info@huslyg.dk til indsigelser. [Begrænset behandlingsret og indsigelsesprocedure](LEGAL-FEATURE-DISCLOSURES.md); endelige samlede vilkår skal stadig publiceres under V01.
- [x] E06 · K · FØR RELEASE: [Kontrolleret i native kandidat 1.0.124](LEGAL-NEXT-TEN.md): historiske datoer/dækning, cirka-estimater for grundforbrug/tag, prisbestanddele og prognosemærkning. Syv UI-kilder matcher isoleret stage; fokuserede beregningstests passerer. Endelig faktisk publiceret kandidat kontrolleres stadig under LANC03; ingen garanti for alle providerdata.
- [x] E07 · A/K · BETINGET: [Vurderet for første scope](LEGAL-NEXT-TEN.md): ingen personlig grøn-/CO₂-andel eller garanteret besparelse identificeret i de gennemgåede aktive kort. Prisandel/budget er ikke sådanne beviser. Genåbnes før disse påstande/annoncer med konkret kilde, metode, usikkerhed og realistisk flytbar mængde.

## 7. Familieinvitationer og notifikationer

Kilder: [Forbrugerombudsmanden – spam og delefunktioner](https://forbrugerombudsmanden.dk/alle-emner/uanmodede-henvendelser/uanmodede-elektroniske-henvendelser-spam), [markedsførings-push](https://forbrugerombudsmanden.dk/find-sager/sager/markedsfoeringsloven/sager-efter-markedsfoeringsloven/spam/push-beskeder-er-omfattet-af-markedsfoeringslovens-spam-forbud).

- [x] F01 · A/J/K · FØR FAMILIE-RELEASE: Begge sider af invitation/accept i APK 1.0.123 beskriver fælles bolig, el/varme og plantegninger samt egen konto og navn/mail i medlemsoversigten. Modtageren oplyses om accept og hentede kopier. [Pakket implementering](ACCOUNT-PRIVACY-IMPLEMENTATION.md).
- [x] F02 · K · FØR FAMILIE-RELEASE: Verificeret modtagermail, eksplicit accept, udløb/revokering, rolle-/aktørbinding og grænser er kildekontrolleret og dækket af passerende Node- og rollback-SQL-tests i dev. [Evidens](ACCOUNT-PRIVACY-IMPLEMENTATION.md). Rigtig maillevering og acceptflow er fortsat særskilt F05; lokal kopihåndtering efter fjernelse er F03.
- [ ] F03 · K · FØR FAMILIE-RELEASE: Kontroller at fjernelse stopper adgang på serveren og håndterer lokale kopier/sessioner. Forklar at allerede eksporterede kopier ikke kan tilbagekaldes teknisk.
- [ ] F04 · A/J · FØR FAMILIE-RELEASE: Vurder invitationsmailens behandlingsgrundlag, information til modtager og spamregler; hold invitationen funktionel uden reklame eller belønnet videresendelse.
- [ ] F05 · K · FØR FAMILIE-RELEASE: Afslut Resend-/afsenderopsætning privat, domænevalidering og én kontrolleret invitationstest. Dokumentér levering og accept separat.
  [Godkendt Production-aktivering og én API-accepteret kontrolmail dokumenteret](FAMILY-MAIL-AND-ERASURE-RELEASE.md). Leveringsstatus er ikke tilgængelig med send-nøglen; modtagelsen af en særskilt godkendt anden kontrolmail er nu ejerbekræftet. Faktisk invitationsaccept mangler stadig. Ingen rigtig invitation eller adgang oprettet i kontrolmailen.
- [x] F06 · K · FØR RELEASE: [Kontekst, fravalg og affaldets kl. 07-antagelse kontrolleret](LEGAL-FEATURE-DISCLOSURES.md). Pris-/budget-/affaldstilladelse knyttes til aktivering; relevante kilder matcher APK-kandidaten. Planlægningstest passerer. Fysisk levering og øvrig notifikationssikkerhed er særskilte åbne kontroller under T02/DPIA.
- [x] F07 · A/J/K · BETINGET: Ikke relevant i ejerens bekræftede første scope uden reklame via mail/push. [Afgrænsning og genåbning](LEGAL-FEATURE-DISCLOSURES.md): Før eventuel reklame kræves særskilt vurdering og gyldigt samtykke; OS-tilladelse er ikke et markedsføringssamtykke.

## 8. Cookies, sporing og tilladelser

Kilde: [Digitaliseringsstyrelsen – huskeregler for app-udbydere](https://digst.dk/tilsyn/sporingsteknologiomraadet/vejledninger-til-tjenesteudbydere/huskeregler-for-app-udbydere/).

- [ ] C01 · K · FØR RELEASE: Gennemgå app, WebViews, hjemmeside, SDK'er og netværkskald for lagring/adgang på enheden og datadeling; registrér formål og levetid.
- [ ] C02 · A/J · FØR RELEASE: Dokumentér hvilke teknologier der er strengt nødvendige, og hvilke der kræver samtykke. Tilføj ikke en tom cookiebanner-løsning uden faktisk behov.
- [ ] C03 · K · BETINGET: Blokér samtykkekrævende sporing før valg; tilbyd let accept, afvisning og tilpasning uden forudvalgte valg.
- [ ] C04 · K · BETINGET: Gem nødvendige samtykkebeviser/versioner og giv let ændring/tilbagetrækning; kontroller at afvisning faktisk stopper kald.
- [x] C05 · A/K · BETINGET: [ATT-formålsvurdering afsluttet](LEGAL-NEXT-TEN.md): ingen valgt annoncekobling/datamæglerdeling eller direkte annonce-SDK identificeret i deklarerede afhængigheder. Ingen formålsløs ATT-dialog tilføjet. Faktisk iOS-binær/SDK-adfærd er fortsat I04/C01/I03; genåbnes ved tracking og før eventuel aktivering uden nødvendige valg.
- [ ] C06 · K · FØR RELEASE: Minimer kamera-, foto-, fil-, lokations- og notifikationstilladelser. Brug systemvælger, hvor muligt, og forklar behovet på begge platforme.

## 9. Sikkerhed og løbende ansvar

Kilder: [Datatilsynet – små virksomheder](https://www.datatilsynet.dk/regler-og-vejledning/gdpr-univers-for-smaa-virksomheder/faq), [anmeldelse af sikkerhedsbrud](https://www.datatilsynet.dk/sikkerhedsbrud/anmeld-sikkerhedsbrud).

- [ ] T01 · K · FØR RELEASE: Kontroller autorisation pr. konto/husstand for API'er, database og filstorage, også efter fjernelse af familiemedlem.
- [ ] T02 · K · FØR RELEASE: Kontroller HTTPS, sessionsopbevaring, tokenudløb/-tilbagekaldelse, logredigering og server-only hemmeligheder i det faktiske releaseartefakt.
  Åben opfølgning fra S03/B02: håndtér kald fra pauserede integrationer og afklar mail-DNS (ingen MX i opslaget og to DMARC-poster). Se [fund og nødvendige handlinger](LEGAL-RELEASE-DECISIONS.md).
  Kontoadskillelse af lokale påmindelser er nu [rettet og lokalt verificeret](NOTIFICATION-ACCOUNT-ISOLATION.md). Test-APK 1.0.122 er bygget/pakkekontrolleret; ejeren har fravalgt installation i denne opgave. Sessionslager, pauserede kald og mail-DNS gør fortsat T02 åben.
- [x] N01 · K · Afgrænset rettelse: Implementér ejer-/husstandsadskilte el-/affaldsnotifikationer og beskyttelse mod kontoskift under asynkron planlægning. [Kilde-/hook-/APK-kontrol passerer](NOTIFICATION-ACCOUNT-ISOLATION.md); fysisk OS-levering er ikke verificeret, og installation af 1.0.122 er fravalgt af ejeren.
- [ ] T03 · K · FØR RELEASE: Dokumentér nøglehåndtering, adgang til dekryptering og gendannelse; kontroller at politik og butikssvar matcher den implementerede sikkerhed.
- [ ] T04 · A/K · FØR RELEASE: Brug MFA og mindst mulige administratorrettigheder; fordel ansvar for support, drift og leverandøradgang.
  [Adgang og ansvar](LEGAL-ADMIN-ACCESS.md): Ejeren har 26. oktober 2026 bekræftet MFA på Vercel, Supabase og den anvendte login-konto. Én intern administrator og ejerens drift-/supportansvar er dokumenteret. T04 står åbent for gennemgang af faktiske roller og tjenesteadganges rettigheder; MFA er ejerbekræftet, ikke uafhængigt kontrolleret.
- [x] T05 · K · FØR RELEASE: [Filkontrol og downloadnavnerettelse gennemført og udgivet](LEGAL-NEXT-TEN.md): tilladte typer/signaturer, størrelses-/husstandskvoter, medlemsafgrænset adgang og korrekt endelse også ved læsning af ældre filer. Fokuserede tests og produktionshash-/adgangskontrol passerer. Ingen påstand om antivirus eller fuld PDF-indholdsscanning; genåbnes ved ændret eksponering/processor.
- [x] T06 · A/K · FØR RELEASE: [Incident-procedure, ejeransvar, frist-/risikovurdering, underretning og privat brudlogskabelon etableret](LEGAL-INCIDENT-PROCEDURE.md). Ingen ny hændelse konstateret eller anmeldt ved dokumentationen.
- [x] T07 · K · FØR RELEASE: [Fokuseret audit og håndtering udført](LEGAL-DEPENDENCY-REVIEW.md). Tre indirekte pakker rettet; efterkontrol viser 0 kritiske, 6 høje og 4 moderate fund. Rester og build-/runtimegrænser er dokumenteret; dette er ikke en erklæring om sårbarhedsfrihed.
- [ ] T08 · A/K · FØR RELEASE: Etabler opdaterings-/backupansvar og en kontrolleret gendannelsesprocedure uden at genaktivere slettede konti eller lække produktionsdata til test.

## 10. Vilkår, betaling og markedsføring

- [ ] V01 · A/J/K · FØR RELEASE: Udarbejd og publicér brugsvilkår med konto, familieadgang, uploads, opsigelse, driftsændringer og rimelige ansvarsbestemmelser; bevar ufravigelige forbrugerrettigheder.
- [ ] V02 · A/K · FØR RELEASE: Vis support og juridiske links i app/hjemmeside. Registrér relevant vilkårsversion ved aftaleindgåelse og fastlæg opdateringsproces.
- [x] V03 · A/J · BETINGET: Ikke aktuelt i første gratis scope uden betaling, prøvebetaling eller abonnement. [Konklusion og genåbningskrav](LEGAL-CONDITIONAL-DECISIONS.md). Øvrige forbrugerkrav er ikke fravalgt.
- [x] V04 · A/K · BETINGET: Ingen digitale køb/abonnementer valgt, derfor intet betalings-/købsgendannelsesflow nu. [Genåbnes før køb](LEGAL-CONDITIONAL-DECISIONS.md).
- [x] V05 · A/J · BETINGET: Intet bortfald af fortrydelsesret søges eller implementeres; ufravigelige rettigheder bevares. [Konkret afgrænsning](LEGAL-CONDITIONAL-DECISIONS.md). Gratis ydelse med persondata er ikke erklæret generelt fritaget; V01's forbrugerinformation er fortsat åben.
- [x] V06 · A/K · FØR RELEASE: [Den aktuelle invitations-/downloadindgang er kontrolleret og rettet](LEGAL-NEXT-TEN.md): Huslyg-branding, eksplicit Android-testversion, login/accept og ingen personlige screenshots eller uunderbyggede grøn-/spareløfter. Publiceret på begge domæner. Ny landingpage, nye annoncer/butiksmaterialer og faktiske featureændringer kræver fornyet kontrol; X08 og øvrig releasegodkendelse består.

Betalingspunkterne er åbne vurderinger, ikke en færdig vurdering af en endnu ikke besluttet salgsmodel. Kontroller konkrete danske forbrugerregler og aktuelle [Apple-regler](https://developer.apple.com/app-store/review/guidelines/#payments) / [Google-regler](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), når modellen er valgt.

## 11. AI, børn, tilgængelighed og øvrige betingede krav

- [x] X01 · A/J · BETINGET: Ikke relevant i første scope, hvor generel kundedata-træning er udtrykkeligt fravalgt. [Genåbnes før nyt træningsformål](LEGAL-CONDITIONAL-DECISIONS.md). Ingen ny ret til eksisterende forsøgsdata eller AI-providerkald følger heraf; X02/S03 er særskilte.
- [ ] X02 · A/J/K · BETINGET: Før billeder/persondata sendes til Gemini, DeepSeek eller anden AI: vurder aftale, overførsel, udbyderens genbrug/opbevaring og nødvendige brugeroplysninger/-tilladelser. Hold lokal forsøgsdata adskilt fra kundedata.
- [x] X03 · A/J · BETINGET: [Scope-/rollevurdering og aktuelle ikrafttrædelsespunkter dokumenteret](LEGAL-NEXT-TEN.md). Faste elberegninger, eksterne prognoser og pauserede AI-/3D-forsøg er vurderet særskilt. Intet højrisikoformål identificeret i den brugerrettede første version. X02/T02 og konkrete kompetence-/transparenstiltag før ny erhvervsmæssig AI-brug består; ingen generel AI-frigivelse.
- [x] X04 · A/J · BETINGET: Børn er ikke målgruppe efter ejerens voksne 18+-scope. [Afgrænsning og genåbning](LEGAL-CONDITIONAL-DECISIONS.md). Beboerbørn kan stadig være indirekte berørt under D07/DPIA; butikssvar/ratings kontrolleres særskilt.
- [x] X05 · A/J · BETINGET: [Mikrovirksomhedsvurdering for tjenesten dokumenteret](LEGAL-NEXT-TEN.md) på ejeroplyst nul omsætning og under ti ansatte i begge seneste afsluttede regnskabsår inklusive oplyste tilknyttede virksomheder. Ingen regnskabs-/koncernrevision. Genåbnes ved ændrede økonomi-/virksomhedsforhold eller produktsalg; X06's kvalitetskontrol består.
- [ ] X06 · K · FØR RELEASE SOM KVALITETSMÅL: Kontroller skærmlæser, tekstskalering, kontrast og betjening af centrale konto-/rettighedsflows; gennemfør yderligere lovpligtige tiltag, hvis X05 kræver dem.
- [x] X07 · A/J · BETINGET: [DSA-klassifikation og følger dokumenteret](LEGAL-DSA-ASSESSMENT.md): privat upload behandles konservativt som hosting; ingen offentlig onlineplatform/markedsplads identificeret i det gennemgåede scope. Afsluttet som vurdering, ikke som fuld DSA-efterlevelse. Kontakt/anmeldelse, vilkår, indgreb og transparens håndteres under de angivne åbne V-/R-/T-punkter; genåbnes ved offentlig deling eller ændret optag.
- [ ] X08 · A/K · FØR RELEASE: Lav licensoversigt og nødvendige krediteringer for kode, ikoner, fonte, animationer, kort og billeder i den udgivne version.

Kilder til afklaringer: [Datatilsynet – DPIA](https://www.datatilsynet.dk/regler-og-vejledning/behandlingssikkerhed/konsekvensanalyse), [Sikkerhedsstyrelsen – mikrovirksomheder og tilgængelighed](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester/vejledninger/tilgaengelighed-undtagelser-og-mikrovirksomheder). Scope-/klassifikationsvurderinger under X03/X04/X05/X07 er nu dokumenteret med genåbningskrav; X02 og de øvrige konkrete releasekontroller er fortsat åbne.

## 12. Google Play

- [ ] G01 · A · FØR GOOGLE PLAY: Opret/verificér korrekt udviklerkonto og nødvendige virksomheds-/kontaktoplysninger.
- [ ] G02 · A/K · FØR GOOGLE PLAY: Etabler produktionssignering, sikker uploadnøgle og Play App Signing; aftal overgang fra installerede debug-signerede APK'er uden at love almindelig opdatering på tværs af forskellige certifikater.
- [ ] G03 · K · FØR GOOGLE PLAY: Byg signeret AAB med korrekt pakkenavn/version; verificér aktuelt target-API-krav. Den kontrollerede kilde angiver API 36 for nye standard-apps/opdateringer fra 31. august 2026.
- [ ] G04 · A/K · FØR GOOGLE PLAY: Udfyld Data Safety ud fra faktiske flows og tredjepartstjenester; deklarér indsamling/deling korrekt også ved kryptering.
- [ ] G05 · A/K · FØR GOOGLE PLAY: Indsæt fungerende privatlivs- og sletnings-URL'er samt supportkontakt; kontroller adgang uden login.
- [ ] G06 · A/K · FØR GOOGLE PLAY: Udfyld målgruppe, indholdsbedømmelse, reklamer og relevante tilladelseserklæringer; lever sandfærdige beskrivelser/skærmbilleder.
- [ ] G07 · A/K · FØR GOOGLE PLAY: Tilbyd reviewer-adgang eller egnet demo med syntetiske data, så MitID/personlige eldata ikke er nødvendige for anmeldelsen.
- [x] G08 · A/K · BETINGET: [Kontotypevurdering dokumenteret](LEGAL-STORE-SUBMISSION.md): Ejeren oplyser organisationskonto efter 2023. Den specifikke 12-testere/14-dagesregel for nye personlige konti er derfor ikke identificeret som aktuel på dette grundlag. Konsoltypen er ikke uafhængigt kontrolleret; genåbn ved personlig konto. Øvrige test-/reviewkrav og G09 er fortsat åbne.
- [ ] G09 · A · FØR GOOGLE PLAY: Afslut konsollens aktuelle policy-/verifikationskrav og få produktionsadgang/godkendelse; gem kvittering og den godkendte versionsidentitet.

Kilder: [kontosletning](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [testkrav](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en). Kontroller igen ved indsendelse.

## 13. Apple App Store – hvis iOS skal med

- [ ] I01 · A · BETINGET: Opret/verificér Apple Developer-konto, korrekt udgiver og eventuelle organisationsoplysninger.
- [ ] I02 · K · BETINGET: Opsæt bundle ID, produktionssignering og påkrævet Xcode/SDK. Kontrolleret kilde kræver Xcode 26+ og iOS 26 SDK+ siden 28. april 2026; genkontroller ved upload.
- [ ] I03 · A/K · BETINGET: Udfyld App Privacy efter faktisk databehandling, inklusive SDK'er, og indsæt offentlig privatlivs- og support-URL.
- [ ] I04 · K · BETINGET: Kontroller privacy manifests, required-reason API'er, SDK-erklæringer og forklaringer til tilladelser i den faktiske iOS-build.
- [ ] I05 · K · BETINGET: Verificér at kontosletning kan startes i iOS-appen og ikke reduceres til krav om at kontakte support.
- [x] I06 · A/K · BETINGET: [Vurderet for eget mail-/OTP-/linklogin](LEGAL-CONDITIONAL-DECISIONS.md): intet krav efter 4.8 identificeret alene på dette grundlag. Genåbn før socialt/tredjepartslogin; øvrige Apple-krav er fortsat åbne.
- [ ] I07 · A · BETINGET: Afklar/verificér EU trader-status og nødvendige kontaktoplysninger i App Store Connect.
- [ ] I08 · A/K · BETINGET: Udfyld aldersmærkning, screenshots og reviewer-adgang; gennemfør TestFlight/fokuseret fysisk kontrol og App Review.

Kilder: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [SDK-krav](https://developer.apple.com/news/upcoming-requirements/?id=02212025a), [kontosletning](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion). Butikssvar og godkendelse er separate fra GDPR-dokumentation.

## 14. Endelig udgivelsesbeslutning

- [ ] LANC01 · A/K/J: Alle relevante FØR RELEASE-punkter er afsluttet med dokumentation; alle BETINGET-punkter har en konklusion.
- [ ] LANC02 · K: Kontroller offentlige juridiske sider på de rigtige domæner og links i den præcise release-build; invitationer/API/callbacks må ikke brydes af den kommende landingpage.
- [ ] LANC03 · A/K: Politik, vilkår, butikssvar, faktisk backend og markedsføring beskriver samme funktioner og databehandling.
- [ ] LANC04 · A/K: Gem releaseversion, hash/signatur, backenddeployment og dokumentversioner; udpeg support- og incidentansvarlig.
- [ ] LANC05 · A: Godkend konkret offentlig udgivelse. En tidligere test-APK, backendaktivering eller tilladelse til at lave en tjekliste erstatter ikke denne beslutning.
- [x] LANC06 · A: [Ejeransvar, ændringstriggere, gennemgang før release og mindst årligt planlagt](LEGAL-CONDITIONAL-DECISIONS.md), næste ordinære gennemgang 26. oktober 2027. Ingen kalenderautomatik oprettet; øvrige releasekrav og konkret udgivelsesgodkendelse er særskilte.

## Afslutningslog

Ingen hemmeligheder, personlige exports eller rigtige kundedata i denne fil. Link til passende beskyttet dokumentation, hvor nødvendigt.

| Punkt-ID | Resultat / evt. ikke relevant med begrundelse | Dokumentation | Ansvarlig | Dato |
| --- | --- | --- | --- | --- |
| S01 | Huslyg; huslyg.dk; BluePeach, CVR 40876375; kontakt: Huslyg-teamet, info@huslyg.dk. Tidligere navn Strømblik skal erstattes i releaseversionen. | Ejerens svar i samtalen og identitetstabellen under S01 | App-ejeren | 2026-10-25 |
| S02 | Dokumenteret nuværende Android-kandidats synlige funktioner og udeståender; familie-mail, plantegningskontrol og varmeleverandørdækning har udtrykkelige forbehold. Ikke en godkendelse af de enkelte funktioner. | [Funktionsoversigt](LEGAL-RELEASE-SCOPE.md), lokal kode og isoleret APK-kilde samt de anførte release-dokumenter | Codex – dokumentation | 2026-10-25 |
| S03 | Skjulte funktioner og resterende baggrundsadfærd registreret ved kildekontrol; konkrete udbedringer står åbne. | [S03-kontrol](LEGAL-RELEASE-DECISIONS.md) | Codex – kildegennemgang | 2026-10-25 |
| S04 | Android og iOS fra første udgivelse; begge butikkers krav gælder. | Ejerens svar og [distributionsbeslutning](LEGAL-RELEASE-DECISIONS.md) | App-ejeren | 2026-10-25 |
| S05 | Voksne 18+, gratis uden reklamer eller køb. | Ejerens svar og [målgruppe](LEGAL-RELEASE-DECISIONS.md) | App-ejeren | 2026-10-25 |
| B01 | Virksomhedsform/adresse/CVR registreret på ejerens bekræftelse; officielt CVR-opslag utilgængeligt. | [Virksomhedsoplysninger og kilder](LEGAL-RELEASE-DECISIONS.md) | App-ejeren | 2026-10-25 |
| B02 | Mailens funktion og ejerens ansvar bekræftet af ejeren; DNS-fund følges op under T02/LANC03. | [Mailstatus og DNS-fund](LEGAL-RELEASE-DECISIONS.md) | App-ejeren | 2026-10-25 |
| B03 | Kontaktkort på login/profil i installeret test-APK 1.0.120; offentligt web-login og kontakt.html verificeret efter godkendt productionudgivelse. | [Udgivelsesrapport](LEGAL-CONTACT-RELEASE.md), production-verification.json og production-browser-check.json i .tmp/legal-contact-release | Codex – implementering og livekontrol; ejeren godkendte publicering | 2026-10-25 |
| B04 | Gratis scope, ejerens oplyste fravær af anden indtjening/udenlandske køb og ejerens eget ansvar for bilag/indberetning. Skal genvurderes ved ændringer. | [Virksomhedsafklaring](LEGAL-BUSINESS-READINESS.md) og ejerens svar | App-ejeren | 2026-10-25 |
| D02 | Konto-, profil- og familiedata kortlagt fra kode/schema, inklusive personlige/fælles felter og invitationsmetadata. | [Datakortlægning](LEGAL-DATA-MAP.md) | Codex – kildekontrol | 2026-10-26 |
| D03 | Forbrugsdata og afledninger kortlagt; forskellen mellem den aktuelle APK's Hour-import og lokal Actual-import er fastholdt. | [Datakortlægning](LEGAL-DATA-MAP.md) | Codex – kildekontrol | 2026-10-26 |
| D04 | Bolig-/fil-/modeldata, caches og rester efter sletning kortlagt. Brugsrettigheder og retention er separate åbne punkter. | [Datakortlægning](LEGAL-DATA-MAP.md) | Codex – kildekontrol | 2026-10-26 |
| D05 | Kilde-/APK-baseret inventar af logs, sessioner/caches, credentials, beskeder og native SDK'er; nødvendige afklaringer/rettelser er bevaret under C/T/L/R. | [Teknisk inventar](LEGAL-TECHNICAL-DATA-INVENTORY.md), .tmp/legal-d05/source-comparison.json og APK 1.0.121 | Codex – kilde-/artefaktkontrol | 2026-10-26 |
| D06 | Teknisk nøgleadgang kombineret med ejerens oplysning om én intern administrator og ingen oplyst særskilt supportmedarbejder. Provider-/tjenesteadgang og IAM-hardening er særskilt. | [Adgangsmatrix](LEGAL-DATA-MAP.md) og ejerens svar “Kun mig” | App-ejeren og Codex – dokumentation | 2026-10-26 |
| N01 | Notifikationssession, ejerafgrænsede nøgler/payloads, legacy-/logout-oprydning og async-racebeskyttelse implementeret og testet. APK 1.0.122 verificeret; fysisk installation fravalgt. | [Rettelse og bevisgrænser](NOTIFICATION-ACCOUNT-ISOLATION.md), .tmp/notification-scope-release/apk-verification.json | Codex – implementering og lokale kontroller | 2026-10-26 |
| R01 | Manuel indgang, identitetskontrol, frister, forlængelse og svarskabeloner etableret; teknisk eksport/sletning fortsat åben. | [Rettighedsprocedure](LEGAL-RIGHTS-PROCEDURE.md) | Ejeren – modtagelse/support; Codex – procedure | 2026-10-26 |
| L01 | Leverandører og mulige modtagere registreret med tydelig faktisk/tilvalgt/uafklaret status; aftaler, regioner og SDK-kontrol er særskilt. | [Leverandørregister](LEGAL-SUPPLIERS-AND-RETENTION.md) | Codex – kilde-/dokumentgennemgang | 2026-10-26 |
| F06 | Brugeraktiveret tilladelseskontekst, fravalg og antaget afhentningstid kontrolleret; planlægningstest passerer og fire relevante kilder matcher APK-kandidaten. Ingen fysisk levering verificeret. | [Funktionsevidens](LEGAL-FEATURE-DISCLOSURES.md), [tests](LEGAL-SECURITY-RELEASE-GATES.md) | Codex – kilde-/testkontrol | 2026-10-26 |
| F07 | Reklamemail/-push ikke valgt i første scope; vurdering afsluttet som ikke relevant med genåbningskrav før ændring. | Ejerens tidligere scopebekræftelse og [afgrænsning](LEGAL-FEATURE-DISCLOSURES.md) | Ejeren – scope; Codex – dokumentation | 2026-10-26 |
| D08 | Fuld historik begrundet i brugerens private dag-/timearkiv og årssammenligning under den fortsat nødvendige arkivtjeneste; logs, revisioner og backups vurderes særskilt. | [Nødvendighed og periodekriterium](LEGAL-CONSUMPTION-HISTORY-NECESSITY.md), ejerens arkivvalg | Ejeren – formål; Codex – dokumentation | 2026-10-27 |
| R03 | Reel sletning fra profil med frisk login og bekræftelse; APK 1.0.123 installeret, konkret backend/migration godkendt og aktiveret. Ingen rigtig konto slettet som test. | [Implementering og produktionskontrol](ACCOUNT-PRIVACY-IMPLEMENTATION.md) | Ejeren – produktionsgodkendelse; Codex – implementering/kontrol | 2026-10-27 |
| R06 | Gyldigt efterfølgervalg beskytter delt arkiv/nøgle; sidste hjem slettes atomisk; fejlsager ruller tilbage. Samlet oprydning og indsigelser vurderes særskilt. | [Dev-SQL og model](ACCOUNT-PRIVACY-IMPLEMENTATION.md), [rettighedsprocedure](LEGAL-RIGHTS-PROCEDURE.md) | Codex – implementering og syntetisk dev-kontrol | 2026-10-27 |
| E05 | Upload informerer om rettigheder, fælles adgang, nødvendige persondata, privat formål og indsigelseskontakt i APK 1.0.123. Samlede vilkår er endnu ikke publiceret. | [Funktionsevidens](LEGAL-FEATURE-DISCLOSURES.md), [pakket implementering](ACCOUNT-PRIVACY-IMPLEMENTATION.md) | Codex – klientimplementering og pakkekontrol | 2026-10-27 |
| F01 | Invitation og accept beskriver fælles data, egen identitet og medlemsoversigt samt begrænsning ved hentede kopier. | [APK 1.0.123 og kildekontrol](ACCOUNT-PRIVACY-IMPLEMENTATION.md) | Codex – implementering og pakkekontrol | 2026-10-27 |
| F02 | Verificeret mail, aktiv accept, udløb/revokering og aktør-/rollebinding prøvet med syntetiske server- og rollback-SQL-tests. Rigtig maillevering/accept er særskilt F05. | [Dev-/serverkontrol](ACCOUNT-PRIVACY-IMPLEMENTATION.md) | Codex – syntetisk kontrol | 2026-10-27 |
| T06 | Incidentansvar, risikovurdering, frister, underretning og privat logskabelon etableret; ingen faktisk hændelse anmeldt. | [Incident-procedure](LEGAL-INCIDENT-PROCEDURE.md) | Ejeren – driftsansvar; Codex – procedure | 2026-10-27 |
| T07 | Audit gennemført og tre kompatible indirekte pakker rettet; 0 kritiske, 6 høje og 4 moderate restfund dokumenteret. Ingen erklæring om sårbarhedsfrihed. | [Dependency-audit og afgrænsning](LEGAL-DEPENDENCY-REVIEW.md) | Codex – audit og rettelser | 2026-10-27 |
| V03 | Betalings-/abonnementsinformation ikke aktuel i det valgte gratis scope; genåbnes før betaling. | [Betingede beslutninger](LEGAL-CONDITIONAL-DECISIONS.md) og ejerens scope | Ejeren – scope; Codex – dokumentation | 2026-10-27 |
| V04 | Ingen digitale køb eller abonnementer; købsgendannelse og betalingsflow ikke aktuelt. | [Betingede beslutninger](LEGAL-CONDITIONAL-DECISIONS.md) | Ejeren – scope; Codex – dokumentation | 2026-10-27 |
| V05 | Intet bortfald af fortrydelsesret søges; ufravigelige rettigheder bevares. V01 er fortsat åben. | [Forbrugerafgrænsning](LEGAL-CONDITIONAL-DECISIONS.md) | Codex – dokumentation på valgt scope | 2026-10-27 |
| X01 | Generel kundedata-træning fravalgt; genåbnes før et nyt træningsformål. Provider- og forsøgsdatarettigheder vurderes særskilt. | Ejerens formålsvalg og [betinget vurdering](LEGAL-CONDITIONAL-DECISIONS.md) | Ejeren – formål; Codex – dokumentation | 2026-10-27 |
| X04 | Voksne 18+ er målgruppe; indirekte berørte børn og butiksmærkning er særskilte forhold. | Ejerens målgruppe og [betinget vurdering](LEGAL-CONDITIONAL-DECISIONS.md) | Ejeren – målgruppe; Codex – dokumentation | 2026-10-27 |
| G08 | Ejeroplyst organisationskonto efter 2023; den specifikke testregel for nye personlige konti er ikke identificeret som aktuel. Konsoltype og øvrige krav skal stadig verificeres. | [Butiksgrundlag og officiel kilde](LEGAL-STORE-SUBMISSION.md), ejerens svar | Ejeren – kontoattest; Codex – regelafgrænsning | 2026-10-27 |
| I06 | Eget mail-/OTP-/linklogin udløser på kendt scope ikke alene krav efter Apples 4.8; genåbnes før socialt login. | [Loginvurdering og officiel kilde](LEGAL-CONDITIONAL-DECISIONS.md) | Codex – kildebaseret afgrænsning | 2026-10-27 |
| LANC06 | Ejeransvar og ændringstriggere dokumenteret; gennemgang før release og mindst årligt, næste ordinære 26. oktober 2027. Ingen kalenderautomatik oprettet. | [Vedligeholdelsesprocedure](LEGAL-CONDITIONAL-DECISIONS.md) | Ejeren – opfølgning; Codex – procedure | 2026-10-27 |
| P04 | Rettighedstekst færdiggjort: kontakt, klage, betingede rettigheder, tilbagetrækning og følger ved fravalg. Hele politikken er ikke publiceret; tekniske processer er særskilte. | [Privatlivsudkast, rettighedsafsnit og kildekontrol](LEGAL-PRIVACY-DRAFT.md) | Codex – tekst og kildekontrol; ejeren – fremtidig support | 2026-10-27 |
| L07 | Intern procedure fastlagt: ingen automatisk inaktivitetslukning, 60 dages varsel ved almindelig planlagt afvikling, sikker fuld eksport og særskilt konkret godkendt ophør. Ingen konto lukkes her. | [Inaktivitet og afvikling](LEGAL-SERVICE-CLOSURE.md) | Ejeren – driftsansvar; Codex – procedure | 2026-10-27 |
| X07 | Privat filopbevaring behandles som hosting; ingen offentlig onlineplatform/markedsplads identificeret på kodegrundlaget. Konkrete følger er registreret under åbne gates; ingen fuld DSA-efterlevelse erklæret. | [Klassifikation, myndighedskilder og følgeopgaver](LEGAL-DSA-ASSESSMENT.md) | Codex – kilde-/scopevurdering; ejeren – opfølgning | 2026-10-27 |
| E06 | Historiske datoer/dækning, estimerede grund-/tagværdier og pris-/prognoseforudsætninger kontrolleret. Syv UI-filer matcher kandidat 1.0.124; beregningstests passerer. Endelig publicering er særskilt. | [Ti-punktsrunde med evidens og myndighedskilder](LEGAL-NEXT-TEN.md) | Codex – kontrol/vurdering | 2026-10-27 |
| E07 | Ingen personlig grøn-/CO₂-andel eller garanteret besparelse identificeret i gennemgåede aktive kort. Betinget vurdering afsluttet med krav om metode/kilde før nye påstande. | [Ti-punktsrunde med evidens og myndighedskilder](LEGAL-NEXT-TEN.md) | Codex – kontrol/vurdering | 2026-10-27 |
| C05 | ATT-formål og deklarerede afhængigheder vurderet; ingen valgt annoncekobling/datamæglerdeling eller direkte annonce-SDK identificeret. Faktisk iOS-binær/SDK-kontrol forbliver I04/C01/I03. | [Ti-punktsrunde med evidens og myndighedskilder](LEGAL-NEXT-TEN.md) | Codex – kontrol/vurdering | 2026-10-27 |
| X03 | Aktuelle AI-regler, roller og scope vurderet for faste elberegninger, prisprognoser og pauserede forsøg. Ingen generel godkendelse af AI-providerkald eller opfyldelse af alle kompetence-/transparenskrav. | [Ti-punktsrunde med evidens og myndighedskilder](LEGAL-NEXT-TEN.md) | Codex – kontrol/vurdering | 2026-10-27 |
| X05 | Ejeroplyst nul omsætning og under ti ansatte i begge seneste afsluttede regnskabsår lagt til grund for tjenestens mikrovirksomhedsvurdering. Genåbnes ved ændret virksomheds-/økonomigrundlag; X06 består. | [Ti-punktsrunde med evidens og myndighedskilder](LEGAL-NEXT-TEN.md) | Ejeren – fakta; Codex – vurdering | 2026-10-27 |
| R04 | [Offentlig sletteindgang publiceret og kontrolleret](ACCOUNT-DELETION-WEB-PAGE.md): https://huslyg.dk/slet-konto.html kan åbnes uden login/app og giver tydelig mailvej samt beskrivelse af egne/delte data og undtagelser. Begge domæners HTML matcher det godkendte forslag. Samlet retention/teknisk sletning og Play Console-feltet er fortsat særskilte L05/R05/G05-punkter. | [Godkendt udgivelse og liveevidens](LEGAL-NEXT-TEN-RELEASE.md) | Ejeren – produktionsgodkendelse; Codex – implementering/kontrol | 2026-10-27 |
| T05 | [Filkontrol og downloadnavnerettelse gennemført og udgivet](LEGAL-NEXT-TEN.md): tilladte typer/signaturer, størrelses-/husstandskvoter, medlemsafgrænset adgang og korrekt endelse også ved læsning af ældre filer. Fokuserede tests og produktionshash-/adgangskontrol passerer. Ingen påstand om antivirus eller fuld PDF-indholdsscanning; genåbnes ved ændret eksponering/processor. | [Godkendt udgivelse og liveevidens](LEGAL-NEXT-TEN-RELEASE.md) | Ejeren – produktionsgodkendelse; Codex – implementering/kontrol | 2026-10-27 |
| V06 | [Den aktuelle invitations-/downloadindgang er kontrolleret og rettet](LEGAL-NEXT-TEN.md): Huslyg-branding, eksplicit Android-testversion, login/accept og ingen personlige screenshots eller uunderbyggede grøn-/spareløfter. Publiceret på begge domæner. Ny landingpage, nye annoncer/butiksmaterialer og faktiske featureændringer kræver fornyet kontrol; X08 og øvrig releasegodkendelse består. | [Godkendt udgivelse og liveevidens](LEGAL-NEXT-TEN-RELEASE.md) | Ejeren – produktionsgodkendelse; Codex – implementering/kontrol | 2026-10-27 |
| E02 | Information om fuldmagtens data, gemte målepunkter, administration hos Eloverblik og bevaret historik implementeret og kontrolleret i test-APK 1.0.125. Ikke installeret/webpubliceret; ingen rigtig fuldmagt ændret. | [UI-/pakkekontrol og afgrænsning](ELOVERBLIK-DATA-INFORMATION.md) | Codex – implementering og kontrol | 2026-10-27 |

## Anbefalet rækkefølge – én opgave ad gangen

1. Udgiver, funktioner og datakortlægning: afsnit 0–2.
2. Privatlivspolitik og vilkår med faktiske virksomhedsoplysninger.
3. Kontosletning, eksport og opbevarings-/sletteprocesser.
4. Leverandøraftaler, datakilder, familieadgang og sikkerhed.
5. Betingede krav og de valgte appbutikker.
6. Samlet kontrol og ejerens udgivelsesbeslutning.
