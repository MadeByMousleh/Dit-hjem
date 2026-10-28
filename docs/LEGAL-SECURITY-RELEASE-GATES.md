# T01/T02 – konkret sikkerhedskontrol før release

26. oktober 2026. Dette er evidens og åbne kontroller, ikke en afsluttet sikkerhedsgodkendelse.

## T01: Konto-/husstandsautorisation

- `familyResponse` tager aktør-ID fra verificeret kontekst, ikke klientens påståede aktør. Management-RPC er service-only i migrationen. Node-testen med syntetisk kontekst passerer for manglende token, afvist rolle, aktørbinding og mailfejl.
- Familiemigrationen binder accept til verificeret mail, aktiv/afsendt invitation og eksplicit accept. SQL-testen dækker uvedkommende, ikke-verificeret konto, udløb, accept, rolleeskalering og RLS-læsning. **SQL-testen er ikke kørt i denne opgave.**
- `propertyDocumentsResponse` kontrollerer bruger/husstandsmedlemskab og filtrerer husstand, adresse og dokument-ID. Gemning sker gennem service-only RPC med aktørbinding. Kildelæsning alene verificerer ikke alle databasepolicies eller nedstrøms storage.
- Den samlede kontrol skal omfatte vault, perioderecords, nøgler, dokumenter/modeller, familie og alle aktive integrationsruter. Prøv også tidligere accepteret medlem efter fjernelse med stadig gyldig session. Ingen konkret kundes session eller data ændres for at teste.

T01 står åbent for denne samlede syntetiske kontrol mod den relevante dev-database og afstemning med faktisk release. Der køres ikke produktionstest med oprettelse/sletning af brugere uden særskilt afgrænsning og godkendelse.

## T02: Sessioner, transport, hemmeligheder og logs

| Kontrol | Kendt evidens | Næste nødvendige handling |
| --- | --- | --- |
| Transport | APK 1.0.122 embeds HTTPS API; tidligere releasekontrol dokumenteret | Kontrollér alle aktive endpoints og redirect-/callbackflows i endelig release. |
| Auth-session | AsyncStorage-persistens er kortlagt | Beslut og implementér passende sessionsbeskyttelse; SecureStore-nøgler er ikke bevis for SecureStore-sessioner. |
| Tokenophør | Logout og medlemschecks findes; notifikationslogout opryddes | Dokumentér og verificér adgangs-/refresh-/provider-tokenadfærd efter logout, fjernelse, udløb og kontosletning. |
| Notifikationer | N01 implementeret, lokale service-/hooktests og APK-kontrol dokumenteret | Native levering og remote medlemsfjernelse/offline scenarier resterer. |
| Serverhemmeligheder | Tidligere APK-pakkekontrol ekskluderer kendte servermoduler/konfiguration | Gentag målrettet på den endelige release uden at printe hemmeligheder. MFA alene beskytter ikke kopierede tokens. |
| Logs | Teknisk inventar beskriver udvalgte redigerede diagnostikfelter og øvrige providerlogs | Verificér faktiske felter, URL/queryrisici, adgang og frister. Ingen automatisk godkendelse af alle platformstandarder. |
| Pauserede integrationer | S03 registrerer rester fra Tesla, EV-katalog, ladepåmindelser og SmartThings-callback | Stop unødvendig behandling på faktisk frontend/backend og vurder gammel lagring; at skjule en fane er utilstrækkeligt. |
| Mail-DNS | Tidligere opslag fandt ingen MX og to DMARC-poster; ejeren har bekræftet fungerende mail | Genkontrollér og afklar med DNS/mailudbyder. Ingen MX alene beviser ikke fejlet levering; dobbelt DMARC skal håndteres. Ingen DNSændring udført. |

## Kontroller udført i denne 50-punktsrunde

Alle fire eksisterende lokale tests passerede 26. oktober 2026:

- `node scripts/test-family-server.mjs`: API-aktør-/rollebinding, fejl ved maillevering, fælles profilfilter og mailescaping; ingen rigtig mail sendt.
- `node scripts/test-waste-reminders.mjs`: før-tider, grænser, udløb og ugyldige datoer.
- `node scripts/test-electricity-baseline.mjs`: lavt vedvarende niveau, skift, DST, mangler og ægte nul.
- `node scripts/test-electricity-price-share.mjs`: kWh-andele, time-/kvarterpriser, DST, huller/overlap, område, ens/negative priser og nulforbrug.

Dette er afgrænsede kode-/beregningskontroller med syntetiske data. Ingen fysisk telefon, samlet kontosletningssag, ny DB-kontrol, faktisk invitation eller produktionsændring er verificeret. T01/T02 og tilknyttede DPIA-risici står åbne.
