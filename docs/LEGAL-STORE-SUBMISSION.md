# Google Play og App Store – indsendelsespakke

26.–27. oktober 2026 · **Udkast; ikke indsendt.** Ejeren har bekræftet, at både Google Play Console- og Apple Developer-konto findes. Efterfølgende svar “det er til min organisation og efter 2023” registreres som ejeroplyst Google Play-organisationskonto oprettet efter 2023; faktisk kontotype/verifikation i konsollen er ikke uafhængigt kontrolleret. Apples præcise enrollment-type skal stadig afstemmes med PMV-udgiveren. Der er ikke oprettet betalte konti, accepteret aftaler eller købt tjenester her.

## Fælles metadata, klar til afstemning

| Felt | Udkast / status |
| --- | --- |
| Navn | Huslyg |
| Udgiver / kontakt | BluePeach, CVR 40876375; Huslyg-teamet, info@huslyg.dk. Den faktiske butikskontos juridiske udgiver skal matche dens type/verifikation. |
| Målgruppe | Voksne 18+ efter ejerens scope. Indholdsbedømmelse skal udfyldes sandfærdigt; 18+ som målgruppe er ikke automatisk samme indholdsrating. |
| Forretningsmodel | Gratis; ingen reklamer, køb eller abonnementer valgt. |
| Android package / iOS bundle ID | `dk.dithjem.stromblik`. Teknisk ID bevares trods Huslyg-branding. |
| Support | info@huslyg.dk; eksisterende kontaktside `https://huslyg.dk/kontakt.html`. |
| Privacy / deletion URL | Slettevej: https://huslyg.dk/slet-konto.html, publiceret og livekontrolleret 27. oktober. Færdig offentlig privatlivspolitik mangler stadig. URL skal registreres/verificeres i konsollen. |
| Screenshots | Brug syntetisk husstand/forbrug og egne licenserede aktiver. Ingen screenshots af virkelige kunders adresse/mail/forbrug. |

Kort beskrivelse: **“Overblik over dit hjem, elforbrug og hverdag.”**

Lang beskrivelse, kun når de beskrevne flows er releaseklar: “Huslyg samler overblik over hjemmet. Se historisk elforbrug og beregnede mønstre, følg elpriser med tydelige forudsætninger, gem private plantegninger, og få overblik over affaldstømning. Tilslut relevante datakilder, og del hjemmets oplysninger med familiemedlemmer via deres egne konti. Målinger kan være forsinkede, og beregninger er estimater.”

Brug ikke teksten til at markedsføre pauseret 3D/AI/bil/styring, grøn strøm, præcise opmålinger eller garanterede besparelser. Hvilke tilvalg der fungerer, skal afstemmes med faktisk release og leverandørdækning.

## Google Play: G01–G09

| ID | Klargjort / konkret rest |
| --- | --- |
| G01 | Konto findes ifølge ejeren. Verificér privat kontotype, korrekt juridisk udgiver og nødvendige kontakt-/virksomhedsoplysninger. |
| G02 | Test-APK er fortsat signeret med kendt Android Debug-certifikat. Det er ikke produktionssignering. Play App Signing, uploadnøgle og sikker privat backup skal etableres i konsollen. Lov ikke almindelig opdatering fra debug-certifikat til et andet certifikat; bevar clouddata og planlæg lokal migration. |
| G03 | Faktisk test-APK 1.0.123 har target API 36. Intet produktionssigneret AAB er bygget; SDK-/signeringskrav skal genkontrolleres ved upload. |
| G04 | Se datakategorierne nedenfor. Ikke udfyldt eller indsendt i konsollen. |
| G05 | Kontaktside findes; endelige privacy-/deletion-URL'er mangler live kontrol. |
| G06 | Navn, kontakt, gratis/uden-reklame-scope og tekstudkast klar. Faktisk rating-/tilladelses-/målgruppeformular og syntetiske screenshots mangler. |
| G07 | Reviewer skal kunne se relevante flows med egnet syntetisk demoadgang uden egen MitID-/Eloverblik-konto. Ingen virkelig kundekonto eller fælles privilegeret konto må udleveres. Demo/test-login skal implementeres og verificeres særskilt. |
| G08 | Vurderet ud fra ejerens oplyste organisationskonto: den specifikke regel om 12 testere i 14 sammenhængende dage for nye personlige konti er ikke identificeret som aktuel for denne kontotype. Konsoltypen skal stemme ved indsendelse; andre test-/reviewkrav er ikke fravalgt. Genåbn straks, hvis kontoen faktisk er personlig. Officiel kilde genkontrolleret 27. oktober 2026. |
| G09 | Ingen indsendelse, konsolgodkendelse eller produktionsadgang verificeret. |

### Data Safety – arbejdsgrundlag

| Data | Faktisk formål / kontrol før deklaration |
| --- | --- |
| Navn, mail, bruger-ID og adresse | Konto, profil, husstand og support. Vurder nødvendige/valgfrie kategorier i forhold til faktisk onboarding. |
| Måler-/forbrugsrelation og historik | Tilvalgt forbrugsvisning og egne analyser; nødvendige kategorier efter konsollens aktuelle definitioner. Antag ikke, at kryptering betyder “ikke indsamlet”, når backend kan håndtere nøgler. |
| Præcise boligkoordinater / geografi | Adressebaseret boligfunktion og pris-/tarifkobling; skeln fra GPS/device location. Klassifikationen skal følge den konkrete definition og brug. |
| Uploadede billeder/dokumenter | Tilvalgt privat plantegning, lagring og familiedeling. Vurder fil-/fotokategorier korrekt. |
| Invitation og medlemskab | Maillevering, kontobinding og udtrykkeligt valgt familiedeling. Databehandlermodtagere og brugerinitieret deling skal klassificeres efter Googles konkrete undtagelser, ikke automatisk som al/ingen deling. |
| Varmecredentials og historik | Kun ved valgt varmefunktion. Sensitive adgangsoplysninger skal ikke udelades, blot fordi de er serverkrypterede. |
| IP, Auth-/fejllogs og SDK | Drift/sikkerhed; faktiske felter/modtagere/frister afventer afklaring. Deaktiveret Firebase-auto-init i APK er ikke en audit af alle platforme. |

Transportkryptering og kontosletning skal afspejle faktiske flows og godkendt backendaktivering. Rene markedspriser uden personkobling er ikke automatisk persondata, men en brugerkobling kan være det. Ingen endelige Ja/Nej-svar indsendes på baggrund af denne tabel alene.

## Apple: I01–I08

| ID | Klargjort / konkret rest |
| --- | --- |
| I01 | Konto findes ifølge ejeren. Kontotype, aktivt medlemskab og korrekt juridisk udgiver skal verificeres. En PMV bliver ikke automatisk en separat selskabsudgiver i Apples system. |
| I02 | Bundle ID findes i konfigurationen. Denne Windows-maskine har ikke leveret en Xcode-signering/IPA; iOS-build, certifikater/provisioning og aktuelle SDK-krav mangler. Ingen ny cloud-/buildtjeneste aktiveret. |
| I03 | Samme faktiske datakort anvendes, men Apples kategorier og definitioner er selvstændige. Linked-to-user og tracking er forskellige spørgsmål. App Privacy og offentlige URL'er mangler konsolkontrol. |
| I04 | Undersøg faktisk IPA/privacy manifests, required-reason API'er, SDK'er og tilladelsestekster. En Android-APK beviser ikke iOS-adfærd. |
| I05 | Den nye appkomponent kan starte rigtig backendkontosletning uden supportmail; iOS-build og fysisk forløb er ikke verificeret. |
| I06 | Eget mail-login vurderet særskilt under [betingede beslutninger](LEGAL-CONDITIONAL-DECISIONS.md). Genåbn før socialt login. |
| I07 | BluePeach som erhvervsmæssig udgiver skal vurderes konkret under Apples trader-regler. Gratis app er ikke alene bevis for non-trader. Konsolvalg og kontaktverifikation mangler; intet valg er indsendt. |
| I08 | Ingen TestFlight-, iOS-fysisk kontrol eller App Review-indsendelse/godkendelse verificeret. |

## Nødvendig ejeradgang – ingen hemmeligheder i chat

Kontrol kræver adgang til de rigtige konsoller eller ejerens dokumenterede bekræftelser af de konkrete felter. Der er ingen tilsluttet App Store-/Play Console-integration i denne session. Send ikke passwords, engangskoder, uploadnøglepasswords eller API-secrets her. Status i konsollerne kan ikke erstattes af en lokal markdown-afkrydsning.

Officielle kilder: [Google – Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469), [testkrav](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [target API](https://support.google.com/googleplay/android-developer/answer/11926878), [Apple – reviewregler](https://developer.apple.com/app-store/review/guidelines/), [trader-oplysninger](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/), [kommende SDK-krav](https://developer.apple.com/news/upcoming-requirements/). Test- og Apple-kilder gennemgået i denne runde; genkontroller aktuelle indsendelseskrav i konsollen.
