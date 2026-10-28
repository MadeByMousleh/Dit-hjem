# Cloudarkiv for rå spotprognoser og facit

Status: **Godkendt og aktiveret i produktion 27. oktober 2026.** Migration `202610270005_energy_forecast_audit.sql` og fem isolerede filer er udgivet. De fem crondefinitioner er verificeret som registreret og aktiveret på den nye Vercel-deployment. Første snapshot er initialiseret og læst tilbage fra produktion. Ingen APK, appside eller åben telefon er nødvendig.

## Hvilke priser vi gemmer

Den rå markedspris følger **DK1 eller DK2**, ikke det enkelte netselskab. Netselskabets nettarif er en anden priskomponent. Vi gemmer derfor ikke samme rå spotpris 35 gange. Eksisterende tarifarkiv kan bruges separat, hvis der senere skal regnes totalpriser pr. netselskab.

Prognoser gemmes i **DKK/MWh uden moms, net, afgifter, skatter, tillæg og abonnement**. Rapportvisninger dividerer med 10 og viser rå øre/kWh. Negative priser og reelle nulpriser bevares. Ingen afrundet forbruger-total bruges som træningslabel.

Den aktive prognosekilde er Elpriser.dk, og facit er Energinets offentliggjorte day-ahead-priser. Der er ikke aktiveret løbende Strømligning-kald. [Åben prognose og CC BY 4.0](https://elpriser.dk/data/), [officielle DK1-/DK2-data](https://www.energidataservice.dk/guides/api-guides).

## Daglige cloudjob

Alle job kører på Vercel og skriver til Supabase, også hvis appen aldrig åbnes. Eksisterende `CRON_SECRET` beskytter ruten, og Supabase-serveradgang forlader ikke backend.

| Job | UTC | Dansk vintertid | Dansk sommertid | Funktion |
| --- | --- | --- | --- | --- |
| Prognosecapture | 08:00 | 09:00 | 10:00 | Gemmer dagens første gyldige DK1- og DK2-snapshot for op til syv dage frem |
| Captureretry | 09:00 | 10:00 | 11:00 | Forsøger igen ved fejl; erstatter aldrig en allerede gemt prognose |
| Facitsynkronisering | 15:00 | 16:00 | 17:00 | Gemmer faktiske kvarterpriser; sammenligninger og fejlmål opdateres via databasevisninger |
| Facitretry | 19:00 | 20:00 | 21:00 | Ekstra dagligt forsøg ved drifts-/udgivelsesforsinkelse |
| Eksisterende historikjob | 03:00 | 04:00 | 05:00 | Fortsætter det historiske spotprisarkiv |

Vercel bruger UTC. På Hobby kan et job starte når som helst i den angivne time; vi gemmer den faktiske observationstid, ikke det planlagte klokkeslæt. Vercel foretager ikke automatisk retry, så retryjobbene er eksplicitte. Se [Vercels tidspræcision](https://vercel.com/docs/cron-jobs/usage-and-pricing) og [drift/retry](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Tabellerne i clouden

| Tabel eller visning | Indhold |
| --- | --- |
| `energy_forecast_capture_runs` | Én uforanderlig capture pr. kilde/dansk dato, med serverbestemt observationstid, kildeudgivelse, antal timepunkter og metadata |
| `energy_forecast_predictions` | DK1/DK2, UTC-targettime, udgivelsestid, model-/udgave-id, rå spotprognose og rå p10/p90-bånd |
| `spot_price_archive` og `spot_price_versions` | Eksisterende faktiske rå kvarterpriser og tidligere udgaver ved officielle rettelser |
| `energy_forecast_comparison` | Time-for-time-prognose, facit, fejl og status; null betyder afventer, aldrig nulpris |
| `energy_forecast_daily_accuracy` | Fejl pr. capturedato, targetdato, prisområde, model og antal dage frem |
| `energy_forecast_accuracy` | Samlet MAE, RMSE og bias pr. område/model/horisont med antal faktisk scorede timer/dage |
| `energy_forecast_training_rows` | Kun prospektive rækker med fuldt facit, klar til en senere tidsopdelt trænings-/valideringsproces |
| `energy_forecast_job_runs` og `energy_forecast_audit_health` | Jobforsøg, fejl/ufuldstændige synkroniseringer, sidste capture/facitsynk og fastlåste job |

Kør [forecast-accuracy-report.sql](../scripts/forecast-accuracy-report.sql) i cloudprojektets SQL Editor for at se tabellen og den løbende præcision. Visninger og rå data er kun tilgængelige for backend/projektadministratoren; de er ikke nye offentlige app-API'er.

## Regler for en ærlig sammenligning

- Prognoser kopieres kun én gang pr. capturedato. Et nyt forsøg returnerer samme capture; senere bedre bud kan ikke erstatte dagens oprindelige bud.
- Dage frem beregnes ud fra **vores capture** og den danske leveringsdato, ikke udbyderens relative horisontnummer. 1, 2, …, 7 dage evalueres separat. Præcise timer frem gemmes også.
- Prognoser til næste dag skal være gemt før kl. 12 dansk tid for at tælle med. Prognosens eget udgivelsestidspunkt må ikke ligge efter vores capture. Dette forhindrer, at forsinket indsamling ligner en ægte forudsigelse. [Nord Pools daglige auktion](https://www.nordpoolgroup.com/en/the-power-market/Day-ahead-market/) lukker budgivningen kl. 12; morgenjobbene er lagt før dette.
- Timeprognosen sammenlignes med gennemsnittet af **alle fire** faktiske 15-minutters intervaller. Tre kvarterer giver intet facit. DST-timer holdes adskilt i UTC, også når kl. 02 forekommer to gange i Danmark.
- Faktiske priser er day-ahead-markedets offentliggjorte priser. De kan derfor være facit allerede dagen før leveringen; vi behøver ikke vente på husstandens forbrug.
- Fejl = prognose minus facit. Positiv bias betyder for høj prognose. MAE/RMSE vises i rå øre/kWh. Vi bruger ikke procentfejl, der bliver misvisende ved nul eller negative elpriser.
- Officielle efterrettelser opdaterer sammenligningen; arkivets tidligere labelversioner og visningens revisionsmetadata gør ændringer sporbare.
- Fejl i kilde/job giver gemt fejlstatus og et retryforsøg, ikke opdigtede prognoser eller nulpriser. En tabt morgenprognose kan ikke bagefter genskabes som en påstået rettidig prognose.

## Senere AI-træning

Capturemetadata bevarer kilde, licens, modeludgave, weather-run og de vind-/soludsigter, som var tilgængelige ved capture. Auditmetadata og pristabeller kopierer ikke udbyderens moms-/net-/afgiftspriser. De eksisterende kildepakker fra appens prognoseservice bevarer fortsat den oprindelige feedproveniens separat.

Inputfeatures skal bruge oplysninger tilgængelige **senest ved capture**; facit er label, aldrig input. Del træning/validering efter leveringsdato i tid, så samme faktiske time ikke kan ligge i både træning og test via forskellige horisonter. Flere eksterne forklaringsdata kan senere tilføjes med tilsvarende observationstider og kildevilkår. Arkivet skaber grundlaget; det beviser ikke, at en ny AI bliver bedre end prognoseudbyderen.

## Kontrol og aktivering

Udviklingsmigrationen er anvendt eksplicit på `wsdomkzhnksyjrpxqfvn`. Fokuserede backendtests og rollback-SQL-test passerer: begge områder, syvdageshorisont, rå enheder/bånd, dubletbeskyttelse, afvisning før DB ved manglende jobnøgle, nul/negative facitpriser, manglende kvarterer, rettelsesversioner, DST og udelukkelse af sene captures. Ingen testfixture er bevaret af rollback-testen.

Den isolerede Preview-test bruger en tilfældig jobnøgle i testprocessens hukommelse og Preview-runtime, uden at ændre produktionsnøglen eller udskrive/gemme den lokalt. Dev-Auth kontrolleres før skrivekald; derefter testes capture, retry uden overskrivning samt facitsynk med offentlige data. Produktionspakken ligger i `.tmp/forecast-audit-release/manifest.json`.

Verificeret Preview: `dpl_F4FtUVd2xsj3CB3adyAUemL6Shzy`, READY og alle 380 kildehashes stemmer. Cloudruten gemte 288 prognosetimer, 144 for DK1 og 144 for DK2, og retry beholdt samme capture. Facitjobbet gemte 1.736 kvarterpriser, inklusive DST-døgnet. Den efterfølgende databasekontrol viser 288 afventende timer og 0 træningsrækker, fordi disse leveringsdages officielle priser endnu ikke findes. To captureforsøg og én facitsynk er logget som fuldført; ingen fejl eller fastlåste job. Det er faktiske udviklings-cloudkald, ikke kun lokale mocks.

Vercels nuværende produktion har allerede de to historik-/facitcronjob aktiveret og en eksisterende sensitiv `CRON_SECRET`. Denne nøgle er ikke ændret eller udlæst. Ved udgivelsen kontrolleres Vercels registrerede fem crondefinitioner og deres deployment-id. Et første snapshot kan initialiseres én gang via den serverbeskyttede databasefunktion med korrekt faktisk observationstid; det dokumenteres særskilt fra et automatisk produktionscron-kald. Derefter kører den daglige indsamling alene i clouden. Preview-testen er ikke i sig selv bevis for et allerede afviklet planlagt produktionsjob.

Efter konkret produktionsgodkendelse: anvend kun migration 005 på `arkpfdsglgufnnukader`, udgiv de fem gennemgåede filer fra live-baseline `dpl_2NgYSvjLN9ms8wVx52T8yR2HJp6R`, verificér kilder/Auth/cronbeskyttelse og cronregistrering. Initialisér første snapshot med korrekt observationstid, og kontrollér de faktiske rækker i produktion. Automatisk jobstatus kontrolleres efter den første planlagte kørsel. Cronen er ikke aktiveret ved blot at oprette denne dokumentation eller teste Preview. Ingen APK, nøgleændring, kundedata eller AI-træning indgår i denne udgivelse.

## Verificeret produktionsresultat

- Production `dpl_GQFK1ypCPyiNodwMijW1NrmCLQZb` er READY i fra1. Alle 380 kildehashes stemmer med den gennemgåede fem-filers pakke; baseline/rollback-kilde er `dpl_2NgYSvjLN9ms8wVx52T8yR2HJp6R`.
- Produktions-Auth er bevaret. Begge domæners officielle priser og eksisterende prognosevisning svarer korrekt. De nye capture-/retryruter afviser anonyme kald med 401/no-store.
- Vercels projektmetadata bekræfter alle fem tidsplaner, ingen disabledAt og korrekt deployment-id. Der er ikke kun kontrolleret en lokal vercel.json. Eksisterende sensitive jobnøgle er hverken læst eller ændret.
- Første capture: `8fa855dc-1fd7-4fa1-a835-ca0631bf5ddc`, 288 timepunkter. Produktionskontrol: DK1 = 144 timer, DK2 = 144 timer. 288 timer afventer facit; 0 rækker kan endnu scores/trænes.
- Det første snapshot er en engangsinitialisering via databasefunktionen med dens faktiske serverobservationstid, ikke et påstået allerede afviklet planlagt produktionscron-kald. Første planlagte morgenkørsel efter udgivelsen er 28. oktober 2026; den logger sit eget resultat i energy_forecast_job_runs. Preview-capture/retry/facitsynk er faktisk afviklet og verificeret separat.
- Ingen private husstandsdata, Auth-/nøgleændringer, APK, commit eller push. Beviser: `.tmp/forecast-audit-release/production-verification.json`, `production-data-verification.json` og `initial-capture.json`.

Ved rollback bevares alle arkivtabeller og rækker. Vercel Instant Rollback ændrer ikke automatisk crondefinitionerne; de ekstra capture-/retrydefinitioner skal opdateres eller deaktiveres særskilt sammen med tilbageførsel af koden.
