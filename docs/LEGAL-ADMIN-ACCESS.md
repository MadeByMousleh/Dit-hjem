# T04 – administratoradgang og ansvar

26. oktober 2026. **Delvist afklaret; T04 står åbent for kontrol af konkrete rettigheder.**

## Ejerbekræftede forhold

- BluePeachs ejer er eneste oplyste interne administrator på Vercel og Supabase, jf. svaret “Kun mig”.
- Ejeren har bekræftet MFA på **begge tjenester og den anvendte login-konto**, herunder Google/GitHub hvis den bruges til login. Bekræftelsen er modtaget 26. oktober 2026.
- Ejeren varetager drift og support. Ingen særskilt intern supportmedarbejder eller ekstern administrator er oplyst.

MFA-status er ejerbekræftet, ikke uafhængigt verificeret i tjenesterne. Ingen sikkerhedsindstilling, kontoadgang eller produktionskonfiguration er ændret. Der er ikke efterspurgt adgangskoder, engangskoder eller recoverykoder.

27. oktober 2026: Vercels teammetadata er nu læst og viser **ét medlem med rollen OWNER**. Kun antal/rolle er registreret; ingen medlemsmails eller hemmelige værdier er gemt. Det stemmer med ejerens oplysning, men verificerer ikke Supabase-medlemmer, MFA-indstillinger eller alle tjenestetokens. T04 forbliver åben for disse konkrete adgangsforhold. Evidens: `.tmp/legal-all/operations-metadata.json`.

## Ansvar og adgangsgrænser

| Område | Kendt ansvar/adgang | Manglende kontrol |
| --- | --- | --- |
| Vercel og Supabase | Ejeren er eneste oplyste interne administrator; MFA er ejerbekræftet | Faktiske projekt-/organisationsroller, gamle adgange og eventuelle andre adgangsveje skal gennemgås. |
| Login-konto | MFA ejerbekræftet | Beskyt gendannelsesmuligheder; ingen recoveryhemmeligheder skal ind i projektets dokumentation. |
| Support | Ejeren via info@huslyg.dk | Teknisk mulighed for at læse data er ikke i sig selv nødvendighed i en supportsag. Begræns sagsdata og dokumentér eventuel privilegeret adgang uden at kopiere kundedata til denne fil. |
| Server- og integrationstokens | Nødvendige tjenesteadgange er en separat adgangskategori | Registrér formål, tjeneste, rettighedsomfang og ansvarlig uden tokenværdi. Kontrollér mindst mulige rettigheder og gamle tokens; MFA beskytter ikke automatisk en stjålet API-nøgle. |
| Leverandørers drift/support | Vercel/Supabase og andre leverandører kan have relevante drifts-/supportadgange | Afklares særskilt under L01–L04; én intern administrator betyder ikke, at kun ejeren teknisk kan behandle data. |

## Konkret afslutningskontrol

1. Gennemgå medlems-/rollelister for de relevante organisationer og projekter, og dokumentér kun roller og antal – ingen hemmeligheder eller kundedata. Ejerens tidligere oplysning om én administrator skal ikke blot indhentes igen.
2. Gennemgå aktive tjenesteadgange og deres nødvendige scopes. Skeln nødvendige serverrettigheder fra personlige administratorrettigheder. Notér overflødige adgange og forbered en særskilt sikker ændring; intet tilbagekaldes automatisk i denne dokumentationsopgave.
3. Dokumentér den gennemførte gennemgang med dato og eventuelle undtagelser. Fastlæg kontrol ved nye personer/integrationer og periodisk sammen med den øvrige adgangsgennemgang.

Først når den konkrete adgangsgennemgang er dokumenteret, kan T04 afsluttes. T01/T02 om husstandsautorisation og appsessioner er særskilte kontroller; MFA på driftskonti løser dem ikke.

Se også [adgangsmatricen](LEGAL-DATA-MAP.md) og [konsekvensanalysen, DPIA-01](LEGAL-DPIA.md).
