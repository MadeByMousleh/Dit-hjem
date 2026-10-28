# D08 – nødvendighed og periode for forbrugshistorik

26.–27. oktober 2026. **Ejeren har besluttet at bevare al tilgængelig historik til brugerens egne funktioner. D08 afsluttes nu for det private målingsarkivs nødvendighed og periodekriterium.** Det nye [sletteflow](ACCOUNT-PRIVACY-IMPLEMENTATION.md) giver en konkret konto-/husstandsafgrænsning. Frister for revisioner, logs, backups og øvrige kategorier samt fuld oprydning er fortsat åbne under L05/L06/R05/R09. Ingen automatisk nedskæring eller historikoprydning er udført af agenten.

## Besluttet formål

Ejeren har tidligere udtrykkeligt bedt om import af alle tilgængelige forbrugsdata og sammenligning af år. Den 26. oktober er det bekræftet, at kundedata kun må bruges til kundens egne appfunktioner, familiedeling og nødvendig drift/support. Fremtidig generel AI-træning, reklameprofilering og videresalg er derfor ikke begrundelser for at gemme forbrugshistorik i første udgivelse.

På det konkrete spørgsmål om detaljeperiode har ejeren svaret **“al historik skal gemmes for at give brugeren bedre funktioner”**. Det registreres som produktkravet om et fuldt privat historikarkiv – ikke som en beslutning om automatisk at nedskalere til 12/24 måneder. Det følgende oversætter kravet til konkrete funktioner og tydeliggør de resterende juridiske afklaringer.

### Konkrete arkivformål

- Brugeren skal kunne åbne tidligere dage og se deres historiske timeforbrug, inden for de faktisk importerede data og kvalitetsgrænser.
- Brugeren skal kunne sammenligne år/måneder og selv undersøge forbrug før og efter ændringer i hjemmet.
- Målinger skal kunne forklares med relevante datoer, målerrelationer og kvalitetsoplysninger; årssummer alene kan ikke genskabe en bestemt historisk dag.

Dette er afgrænsede formål i brugerens egen tjeneste. Nuværende automatiske mønster-/baselineberegninger har stadig de kortere vinduer nedenfor; dokumentet indfører ikke en ny færdig flerårsmodel. “Bedre funktioner” uden nærmere beskrivelse eller muligheden for ukendte fremtidige formål er ikke en selvstændig begrundelse for at gemme alt for altid.

Kilde til principperne: [Datatilsynet – dataminimering og opbevaringsbegrænsning](https://www.datatilsynet.dk/regler-og-vejledning/grundlaeggende-begreber/hvad-er-dine-forpligtelser/de-grundlaeggende-principper) og [fastsættelse af slettefrister](https://www.datatilsynet.dk/regler-og-vejledning/behandlingssikkerhed/sletning). Nedenstående perioder er funktionernes faktiske beregningsbehov eller forslag, ikke lovbestemte standardfrister.

## Kontrolleret kodebehov

| Funktion | Faktisk periode/granularitet i den gennemgåede kode | Hvad det begrunder – og ikke begrunder |
| --- | --- | --- |
| Aktuelt basisforbrug og niveauændring | `electricityBaseline` bruger de seneste 30 dage; sammenholder seneste 7 dage med den ældre del og bruger komplette timeforløb. | Kan begrunde et kort detaljeret vindue til den aktuelle beregning. Det beviser ikke behov for alle rå intervaller fra mange år. |
| Time- og ugedagsmønstre | `useElectricityPatterns` læser højst ét kalenderår bagud fra datagrænsen, afgrænset yderligere af tilgængelige målere. | Ét års timedata understøtter den viste sæsondækkende profil. Gemte baseline-snapshots begrænses i hooken til 90 poster; dette er ikke en retentionpolitik for rådata. |
| Strøm i billige timer | Beregningen accepterer en periode på højst 366 dage og sammenholder timedata med historiske priser. | Historisk tidsopløst forbrug er nødvendigt for den valgte periode; kun årsforbrug kan ikke rekonstruere fordelingen på billige timer. |
| Månedsoverblik og årsvisning | Summerede dags-/måneds-/årsrecords kan bruges til aggregerede oversigter og sammenligning af år. | År ved siden af hinanden kan begrunde længere aggregeret historik. Den funktion alene kræver ikke, at alle oprindelige kvarterer gemmes tilsvarende længe. |
| Valg af en gammel dag/time | Brugerens historiske detaljegraf kræver historiske målinger for den valgte dag. | Et reelt valgt historikarkiv kan begrunde yderligere detaljer, men periode og nødvendighed skal beskrives særskilt fra et generelt ønske om mere data. |
| Fejlretning og rettelser af målinger | Kvalitetsmarkeringer, revisions-/importstatus og eventuelle oprindelige intervaller kan forklare datamangler og ændringer. | Det er et konkret driftsformål, men ikke en begrundelse for ubegrænset revisionshistorik eller opbevaring af alle fejlede råsvar. |

Kilder: [baseline](../src/services/electricity-baseline.mjs), [mønsterhook](../src/hooks/useElectricityPatterns.ts), [billige timer](../src/services/electricity-price-share.mjs), [forbrugsvisning](../src/hooks/useElectricityUsage.ts) og [import-/lagringsdokumentation](ELECTRICITY-HISTORY-IMPORT.md).

## Importadgang er ikke en slettefrist

Eloverbliks officielle [ThirdParty API-beskrivelse](https://api.eloverblik.dk/ThirdPartyApi/index.html) angiver tidsserier for de foregående fem år plus indeværende år og kun data under aktive fuldmagter. Det er en grænse for hentning, ikke automatisk en passende opbevaringsperiode for Huslyg. Tidligere importerede records og revisioner slettes ikke af, at providerens hentefrist eller en fuldmagt udløber.

Den aktuelle APK-kilde anmoder om Hour; nyere lokal kode har Actual-backfill. De to formater må ikke blandes sammen i den juridiske beskrivelse. Originale intervaller, hvor de faktisk findes, kan understøtte kvalitet og nøjagtige beregninger; manglende kvarterer må ikke opfindes.

## Foreløbig konklusion

1. Et års detaljerede målinger har et dokumenterbart formål i de nuværende års-/sæsonmønstre og prisfordelinger; aktuelt basisforbrug behøver kun 30 dage.
2. Mere end ét års aggregerede tal kan understøtte den allerede ønskede sammenligning af år.
3. Ejeren har valgt flerårige detaljer til eget privat arkiv og historisk dag-/timevisning; der foreslås derfor ikke en automatisk 12-/24-månedersbegrænsning. Den konkrete periode fra første importerede dag og frem skal afstemmes med arkivets fortsatte nødvendighed og kontolivscyklus, ikke blot providerens maksimum.
4. Det skal vurderes særskilt, hvor længe kontoaktivitet, frakobling, inaktivitet og slettede konti begrunder opbevaring, inklusive gamle records, versioner og backups. Kontosletning er ikke det samme som udløb af en fuldmagt.

Dataminimering i dette valgte scope skal blandt andet ske ved at holde privat arkiv adskilt fra generel træning, undgå unødige dubletter/rå fejlsvar og fastlægge særskilte frister for revisioner, logs og afsluttede konti. Det betyder ikke automatisk nedskalering af de historiske målinger, brugeren faktisk skal kunne se. Ingen tidligere instruktion om at bevare importerede data tilsidesættes ved at skrive dette dokument.

## Afsluttet periodekriterium for privat målingsarkiv

Rå målinger og relevante summeringer bevares fra første importerede dag, så længe husstanden har den valgte private arkivtjeneste, og historikken fortsat er nødvendig for adgang til gamle dage/timer og sammenligning af år. Der indføres ingen 12-/24-månedersbegrænsning, og der opfindes ingen manglende kvartermålinger. Arkivet er ikke begrundet med generel kundetræning eller ukendte fremtidige funktioner.

Ophør er en konkret konto-/husstandshændelse: ved sletning af sidste medlem fjernes husstanden og dens databaserelaterede arkiv gennem det implementerede transaktionelle flow. Ved én persons afgang fra en delt husstand bevares det fælles arkiv for de tilbageværende medlemmers fortsatte tjeneste; anmodning om egne oplysninger i fælles data kræver konkret rettighedsvurdering, ikke automatisk ubegrænset bevaring eller massesletning. Der opfindes ikke et samtykke fra alle beboere.

Frakobling stopper fremtidig import, men ophæver ikke i sig selv brugerens ønskede historiske arkiv. Inaktivitet alene udløser ikke sletning af det valgte arkiv. Ved tjenesteophør skal eksport, varsel og ophør håndteres under L07; der er ikke udsendt varsler eller aktiveret ny inaktivitetslukning.

Ejeren skal genvurdere nødvendigheden ved den planlagte periodiske gennemgang og ved ændret tjeneste/scope; ny indsamling eller andet genbrug kræver særskilt vurdering. Det er et konkret formåls-/periodekriterium, ikke en tilladelse til at gemme alle datalag for altid. Separate gamle revisioner/rå fejlsvar, support-/rettighedssager, credentials, logs og backupkopier kræver fortsat egne nødvendige frister og teknisk efterlevelse under L05/L06/R05/R09. D08's afslutning lukker ikke dem eller den samlede DPIA.

Den særskilt godkendte kontosletningsmigration/backend er udgivet, og det delte/sidste-medlem-flow er prøvet med syntetiske data i dev. Der er ikke slettet en rigtig konto for at bevise dette. Ingen ny automatisk oprydning af eksisterende historik følger af denne dokumentopdatering.
