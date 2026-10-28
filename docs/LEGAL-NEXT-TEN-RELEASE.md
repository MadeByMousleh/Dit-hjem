# Gennemgået forslag: sletteside, filnavne og testversionstekst

27. oktober 2026 · **Særskilt godkendt, udgivet og verificeret i produktion.** Ejeren svarede “Ja, udgiv de tre filer”. Ingen ny database-, nøgle- eller Auth-ændring.

## Præcis afgrænsning

Baseline er den verificerede mailudgivelse `dpl_Fs3RD1eppPtDXu6Ntaqb1EBrGC5r`. Forslaget genbruger alle øvrige livekildefilers hashes og ændrer kun:

1. **Ny `public/slet-konto.html`**: tydelig anmodning via info@huslyg.dk uden appinstallation/login, identitetskontrol, konsekvenser for eget/delt hjem og oplysning om særskilt håndtering af logs/backups. Siden påstår ikke, at alle data kan slettes øjeblikkeligt eller at ukendte backupfrister er fastlagt. Dette er ikke publicering af den endnu uafsluttede fulde privatlivspolitik.
2. **`public/family.html`**: Huslyg-navn og ærlig mærkning af eksisterende Android-download som testversion. Deep-link-scheme, hjem-ID-validering og downloadsti er bevaret. Ingen ny invitation, kontaktliste eller personlige screenshots.
3. **`src/services/property-documents-server.mjs`**: filnavne afsluttes med den validerede MIME-types endelse ved upload og ved hentning af ældre dokumenter. En fil med navn `plan.html` og PDF-header hentes som `plan.html.pdf`. Kontrol-/bidi-tegn fjernes fra downloadnavnet, som begrænses til 120 tegn. Eksisterende filpayload/DB-rækker ændres ikke ved hentning. Login, medlemskab, RLS, revisionskontrol og størrelsesgrænser bevares.

Filnavnerettelsen er ikke en antivirus- eller fuld PDF-indholdsscanning. PDF hentes/åbnes efter brugerens handling; den eksekveres ikke af en tilføjet serverprocessor. Den konkrete uploadrisiko og grænser dokumenteres under T05.

## Kontroller

- `test-floor-plan-download-name.mjs` passerer: korrekt endelse, misvisende gamle navne, kontroltegn, længde og afvist læsning uden medlemskab; payload forbliver uændret.
- Eksisterende `test-home-simple.mjs` passerer efter ændringen: typer/størrelse, login, medlemsafgrænsning, revision og tagberegning.
- Slettesiden er tidligere lokalt Chrome-kontrolleret ved 320/390/1280 px med tastatur, forstørret tekst og uden eksterne requests.
- Source-diff mod de faktisk hentede livefiler indeholder kun de beskrevne ændringer.
- Preview **`dpl_6Rno4R1T5fNrC4DaUdqPX3PYa8Cr` er READY**; alle 369 kildehashes matcher forslaget. Produktionen var uændret ved Preview-kontrollen; den efterfølgende godkendte udgivelse er beskrevet nedenfor.

Evidens: `.tmp/legal-next-ten-release/manifest.json`, `preview-verification.json` og de to `.before`-filer. Der deployes ikke fra det beskidte rod-worktree.

## Efter godkendelse

Udgiv de samme hashafgrænsede kilder med Production-indstillinger. Kontroller begge domæners kildehashes, produktions-Auth, slettesidens HTML/mailvej, invitationssidens scheme/downloadlink og 401/no-store uden/med ugyldigt token på fil- og kontosletningsruter. Send ingen mail og slet ingen konto i denne udgivelseskontrol.

Rollback er baseline ovenfor; de tre kildeændringer kan rulles tilbage uden en databasemigration. En rollback fjerner den nye offentlige slettevej og filnavnebeskyttelsen, så åbne releasegates skal genvurderes. Klient/APK og det offentlige APK-download erstattes ikke her.

## Faktisk produktionsresultat

Deployment **`dpl_7bQLKoeLwLbbcKhkQh7c2mpMYN8e`** er READY i fra1. Alle 369 kildehashes matcher forslaget; alene de tre godkendte filer er ændret/tilføjet. Begge domæners sletteside og invitationsside svarer 200 og matcher de forventede indholdshashes. Produktions-Auth er bevaret. Fil-, familie- og kontosletningsoperationer afviser manglende og ugyldige tokens med 401/no-store. Root, kontakt og eksisterende APK-download svarer fortsat 200.

Den offentlige anmodningsside er **https://huslyg.dk/slet-konto.html** (og samme sti på dit-hjem-five.vercel.app). Der er ikke foretaget rigtig upload, kontosletning, mailudsendelse eller DB-/nøgle-/Auth-konfigurationsændring ved kontrollen. Ingen ny APK bygget eller installeret; rettelsen gælder server og de to statiske websider.

Evidens: `.tmp/legal-next-ten-release/production.json`, `production-verification.json` og manifestet. R04/T05/V06 er nu afsluttet for det beskrevne scope; P02/P06 og de øvrige åbne releasekrav består.
