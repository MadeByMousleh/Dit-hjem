# L06/T08 – backup, slettejournal og sikker gendannelse

27. oktober 2026. **Slettejournalen er særskilt godkendt og aktiveret i produktion; samlet restoreproces er fortsat ikke verificeret.** L06/T08 står åbne.

## Konkret risiko og implementering

Den allerede godkendte produktionssletning fjerner konto og relevante aktive rækker. Et ældre databasebackup kan stadig indeholde dem. En almindelig restore må derfor ikke straks sættes online.

Migrationerne `202610270001_account_erasure_ledger.sql` og `202610270002_erasure_choice_minimization.sql` er først gennemgået, dry-run-kontrolleret og anvendt i dev. Ejeren har derefter særskilt godkendt dem, og et produktions-dry-run viste præcis disse to migrationer. Begge er anvendt på **`arkpfdsglgufnnukader`** med eksplicit projektmål, uden relink. Den anden begrænser journalen til efterfølgervalg, som faktisk blev brugt ved en valideret sletning. Der registreres:

- SHA256 af kontoens tilfældige UUID, ikke navn/mail, tokens, forbrug eller dokumentpayloads.
- Slettetid, ID'er for hjem faktisk fjernet ved sidste medlem og nødvendige efterfølgervalg.
- Sikkerhedsstatus: server-only RLS/ACL; almindelige klienter kan ikke læse/skrive, og service-rollen kan ikke blot slette journalen.

Dette er **pseudonyme personoplysninger**, ikke anonym statistik. Formålet er afgrænset til at efterleve sletninger og undgå genoprettelse/adgang ved restore. Journalen er ikke et skjult ekstra forbrugsarkiv. Den nødvendige periode skal knyttes til, hvor længe ældre kopier reelt kan gendannes, og relevant dokumentationsbehov; en kendt maksimal backupperiode er endnu ikke verificeret. L05 er fortsat åben.

Journalen skrives i samme transaktion som Auth-/husstandsoprydningen. Ugyldig efterfølger eller anden fejl efterlader ikke en falsk slettepost. Rollback-test med syntetiske dev-konti passerer for netop disse forhold. Efter særskilt ejerbesked “Ja, aktivér slettejournalen” er ændringen nu anvendt på produktion; den tidligere godkendelse fra 26. oktober blev ikke genbrugt til dette.

Produktionskontrollen læste kun schema-/ACL-metadata: begge migrationsversioner registreret, RLS slået til, anon/authenticated uden SELECT, service_role med SELECT men uden DELETE, minimeret cleanup-funktion og aktiv Auth-trigger. Alle otte kontroller var sande. Ingen kundedata blev læst, ingen rigtig konto slettet, og ingen restore blev udført. Evidens: `.tmp/legal-mail-release/verify-ledger.sql` og `ledger-production-verification.json`.

Efterfølgende dev-prøve passerer også for den SQL, offlinegeneratoren faktisk producerer: en syntetisk gendannet konto og dens tidligere slettede hjem fjernes igen, og journalens oprindelige tidsorden bevares. Hele prøven afsluttes med rollback, og en ikke-tom eksisterende dev-journal afviser fixturekørslen. Dette er en afgrænset reconciliation-prøve, ikke en fuld leverandørrestore eller verifikation af alle medlems-/tokenændringer.

## Procedure før enhver restore

Ansvarlig er ejeren. En produktionsrestore er en særskilt destruktiv handling, der kræver konkret godkendelse og et reviewbart forløb.

1. Hold tjenesten utilgængelig for brugere og stop importer, job og integrationer, der kan læse/skrive data under gendannelse. Kontosletningsflag alene er ikke en vedligeholdelseslås for hele appen.
2. Bevar den **aktuelle** slettejournal uden for den databaseversion, der skal erstattes, i et privat adgangsbeskyttet driftsarkiv. Brug ikke Git, chat eller en offentlig fil. Et gammelt backup af journalen er ikke nok; hvis komplet aktuel dokumentation mangler, må trafikken ikke blot genåbnes.
3. Registrér backupidentitet/tidspunkt, faktisk omfang (database, Auth, filer, logs og nøgler), godkendelse og forventede huller. Kopiér ikke produktionens husstandsdata til dev for at prøve forløbet.
4. Gendan isoleret/offline efter leverandørens konkrete procedure og anvend nødvendige reviewede schemaændringer. Sletninger, medlemsfjernelser, tilbagekaldte tokens og ændret ejerskab efter backuptidspunktet skal afstemmes. Slettejournalen erstatter ikke en samlet log over enhver medlems-/providerrevokering.
5. Forbered SQL med `scripts/prepare-erasure-restore.mjs` fra den komplette journal til en **ny privat reviewfil**. Scriptet kontakter ingen database og udfører intet SQL. Det afviser ugyldige data, skriver ikke uden for workspace og overskriver ikke en eksisterende fil.
6. Review og prøv på syntetisk/egnet isoleret grundlag før målrettet udførelse. SQL kræver eksplicit `huslyg.restore_mode='approved_offline'` i samme session. Et manglende efterfølgermedlemskab giver rollback; genopret ikke adgang ved at opfinde en ny ejer.
7. Verificér konto-/husstandsfravær, fælles arkiv/ejerskab, session-/token-/nøgleophør og relevante fil-/cacheforhold. Kontroller, at ingen ældre fuldmagt eller fjernet medlem igen kan hente data. Gem nødvendige redigerede kontrolresultater.
8. Genåbn først efter afsluttet kontrol og ejerens beslutning. Registrér hændelse, eventuelle kundemeddelelser og næste opfølgning. Journalens oprindelige tidsorden skal bevares ved gentagen reconciliation.

## Hvad der stadig mangler

Faktiske leverandørbackupfrister og restoreadgang, komplet medlems-/adgangsrevokering ved restore, ekstern holdbarhed af journalen ved totalt tab af databasen og én samlet kontrolleret restoreprøve er åbne. Generatoren er et forberedelsesværktøj, ikke en automatisk fuld sikker backup-/sletteproces. Ingen produktionsrestore, sletning, ny lagringsleverandør eller betalt backupservice er aktiveret.
