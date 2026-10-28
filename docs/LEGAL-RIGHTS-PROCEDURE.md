# Rettighedsanmodninger – drift, eksport og sletning

26. oktober 2026 · Ansvarlig: BluePeachs ejer · Kontakt: info@huslyg.dk.

## Modtagelse og frister (R01)

Den ejerbekræftede kontaktmail er indgangen for indsigt, kopi, rettelse, begrænsning, indsigelse, dataportabilitet og sletning. Ejeren håndterer indbakken og sagen. En anmodning kræver ikke, at brugeren kan huske et juridisk begreb eller sende en bestemt formular.

1. Registrér modtagelsesdato, internt sagsnummer, ønsket rettighed og svarfrist i en adgangsbegrænset sagslog. Loggen må ikke ligge i Git. Kopiér ikke kundens målinger, dokumenter eller tokens ind i almindelige udviklingslogs.
2. Bekræft modtagelse uden at afsløre, om en uvedkommendes mail har konto. Afklar kun nødvendig tvivl om, hvilke oplysninger anmodningen vedrører.
3. Kontroller identitet forholdsmæssigt: foretræk en autentificeret henvendelse eller kontrol via den allerede registrerede kontaktkanal. En mail med påstået navn/adresse er ikke tilstrækkeligt bevis til udlevering af private data. Ved mistanke om kompromitteret mail kræves supplerende egnet kontrol. Bed aldrig om password, API-token eller engangskode. ID-kopi er ikke et standardkrav.
4. Sæt almindelig svarfrist til én kalendermåned fra modtagelsen; kalendermåned er ikke altid 30 dage. Ved behov for identitetsafklaring registreres forløbet særskilt uden automatisk at love, at fristen er sat i bero. Ved kompleksitet eller mange anmodninger kan fristen forlænges efter reglerne med højst to yderligere måneder; begrund og meddel det inden den første måned.
5. Svar uden unødig forsinkelse. Eventuelt afslag, gebyr eller begrænsning kræver konkret grundlag, begrundelse og information om klage-/prøvelsesmuligheder; ingen automatisk betaling for almindelige anmodninger.
6. Registrér handlinger og afslutning med mindst mulig dokumentation. Endelig opbevaringsfrist for sagsloggen afklares under L05; intet løfte om ubegrænset opbevaring.

Dette etablerer den manuelle modtagelses-/identitetskontrolproces. Efterfølgende er R03 og R06 implementeret og dev-testet, og den konkret godkendte kontosletningsbackend er aktiveret; se [implementeringsrapporten](ACCOUNT-PRIVACY-IMPLEMENTATION.md). R02/R04/R05/R07–R09 er fortsat åbne for henholdsvis samlet kopi, offentlig indgang, fuld livscyklus og samlet prøvesag.

## Svarskabeloner

**Modtagelse:** “Vi har modtaget din henvendelse om dine personoplysninger den [dato]. Huslyg-teamet behandler den og svarer normalt senest [dato]. Vi kontakter dig, hvis vi behøver nødvendige oplysninger for sikkert at identificere dig eller forstå din anmodning. Send ikke adgangskoder eller engangskoder.”

**Afklaring:** “For at beskytte dine oplysninger skal vi bekræfte, at anmodningen kommer fra den rette person. [Beskriv den konkrete, forholdsmæssige kontrol]. Vi behøver ikke dit password eller din engangskode.”

**Forlængelse:** “Din anmodning kræver [konkret begrundelse]. Vi forlænger derfor svarfristen til [dato inden for den lovlige forlængelse]. Du kan kontakte os på info@huslyg.dk og klage til Datatilsynet.”

**Afslutning:** “Vi har [konkret gennemført handling]. Følgende er fortsat opbevaret: [kategori, konkret grundlag og periode/ophør]. [Beskriv relevante konsekvenser for fælles husstandsdata]. Kontakt os ved spørgsmål; du kan klage til Datatilsynet.” Skabelonen må først bruges som gennemført, når handlingen er verificeret.

## Eksport og sikker levering (R02/R08)

Eksport skal omfatte relevante profil-/kontooplysninger, målerrelationer, forbrug med dato/enhed/kvalitet, egne indstillinger og relevante filer/metadata. Vurder dataportabilitet særskilt for de data og grundlag, retten omfatter; det er ikke nødvendigvis samme datasæt som indsigt. Afledte analyser skal vurderes som personoplysninger, selv om ikke alle er omfattet af portabilitetsretten.

Lav en forståelig forklaring samt maskinlæsbart format, hvor relevant. Udlever ikke andre familiemedlemmers private kontakt-/sessionsoplysninger, credentials eller nøgler. Delt husstandsindhold kræver konkret hensyn til andre personers rettigheder, ikke automatisk afslag på alt.

Levering skal ske til verificeret modtager gennem beskyttet kanal. Et almindeligt offentligt link eller en ukrypteret vedhæftning med fuld historik er ikke projektets standard. Hvis krypteret fil anvendes, formidles hemmeligheden via separat verificeret kanal. Automatiseret kortlivet download og dokumenteret manuel levering er endnu ikke implementeret/prøvet som samlet flow.

## Kontosletning og delt husstand (R03–R07)

Følgende er livscykluskrav. Den efterfølgende implementering opfylder den afgrænsede konto-/ejerskiftemodel under R03/R06; de øvrige datalag skal stadig verificeres:

| Situation | Nødvendig håndtering |
| --- | --- |
| Medlem forlader hjemmet | Fjern adgang og personlige data efter gældende rettigheder; vurder egne oplysninger i fælles data. Bevar ikke automatisk enhver personoplysning blot fordi andre er medlemmer. |
| Ejer ønsker slettet konto, andre medlemmer findes | Afklar ejerskab og fortsat lovlig tjeneste uden at blokere personens sletteret på ubestemt tid. Ingen automatisk overdragelse af providerfuldmagter eller hemmeligheder. |
| Sidste medlem / husstand ophører | Identificér og håndter fælles forbrugsdata, filer, revisioner, tokens, nøgler og relevante metadata med dokumenterede undtagelser. |
| Import frakobles | Stop fremtidig adgang/import. Forklar særskilt, om brugerens valgte private arkiv fortsætter; frakobling er ikke kontosletning. |
| Sletning efterkommes | Tilbagekald relevante sessioner/adgange, håndter lokale caches/påmindelser og leverandørrester. Send først bekræftelse om faktisk sletning efter kontrol. |

R06 er efterfølgende afsluttet for den implementerede ejerskifte-/ophørsmodel: eneste ejer vælger et gyldigt tilbageværende medlem, fælles arkiv bevares, og sidste medlems hjem slettes atomisk ved kontosletning. Arkivkravet om fuld historik under en aktiv tjeneste tilsidesætter ikke sletterettigheder. R05/R07/R09 er fortsat åbne, herunder provideradgang, andre enheder og backups. Ingen rigtig konto er slettet som test.

## Syntetisk prøvesag (R09)

Opret i dev to syntetiske husstande, ejer, accepteret medlem og uvedkommende. Tilføj syntetiske profil-, forbrugs-, fil- og invitationsdata. Prøv egen eksport, afvist fremmed eksport, medlemsfjernelse, ejer-/sidste-medlem-sletning, session-/cache-/notifikationshåndtering og restore uden genaktivering af slettede adgange. Notér forventede rester og verificér dem pr. datalag. Ingen kopi af produktionsdata eller produktionsreset. Prøvesagen er planlagt, ikke kørt her.

Kilder kontrolleret 26. oktober 2026: [Datatilsynet – rettigheder](https://www.datatilsynet.dk/borger/hvad-er-dine-rettigheder), [sletning](https://www.datatilsynet.dk/regler-og-vejledning/behandlingssikkerhed/sletning) og [GDPR artikel 12–22](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
