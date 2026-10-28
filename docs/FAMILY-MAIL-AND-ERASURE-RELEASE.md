# Review: familieafsender, sikkerhedsrettelser og slettejournal

27. oktober 2026 · **Mailudgivelsen og slettejournalen er særskilt godkendt, aktive og verificeret i produktion.** Efter aktivering af modtagelse har ejeren godkendt endnu én kontrolmail og bekræftet, at den er modtaget. Den faktiske familieinvitation/accept er fortsat en separat åben kontrol.

## A. Minimal slettejournal

To additive migrationer er først anvendt og testet i dev og efter særskilt godkendelse også anvendt i produktion:

- `202610270001_account_erasure_ledger.sql`: serverbeskyttet journal i samme transaktion som faktisk sletning.
- `202610270002_erasure_choice_minimization.sql`: gem kun efterfølgervalg, der faktisk blev anvendt af den validerede sletning.

Journalen indeholder hash af konto-UUID, slettetid, ID'er for faktisk slettede hjem og nødvendige ejerskiftevalg. Ingen mail/navn, credentials, forbrug eller dokumentpayload kopieres. Hash/ID'er er stadig pseudonyme personoplysninger. Formålet er at undgå, at restore genopretter slettede konti. Nødvendig periode er knyttet til relevante gamle kopiers gendannelighed og dokumentationsbehov; faktiske leverandørbackupfrister er stadig under L05.

Slette-/RLS-/minimeringsprøve og den genererede reconciliation-SQL passerer i dev med syntetiske data og rollback. Produktionens eksplicitte projektmål var `arkpfdsglgufnnukader`; dry-run viste kun de to nævnte migrationer. Efter anvendelsen bekræfter otte read-only schema-/ACL-kontroller versionsregistrering, RLS, klientafvisning, serverrettigheder, minimering og aktiv trigger. Journalen indføres ved fremtidige sletninger; den beviser ikke i sig selv, at alle tidligere sletninger/medlemsrevokeringer er afstemt. Migrationen sletter ingen eksisterende konto/husstand, og ingen restore er udført. [Procedure og rester](LEGAL-BACKUP-RESTORE.md).

## B. Familieinvitationer og kompatible sikkerhedsrettelser

Ved forberedelsen blev følgende navne/miljømål læst uden nøgleværdier; den efterfølgende aktivering er beskrevet nederst:

- Nøglen hedder **`resend`** og findes kun i **Preview**.
- **`EMAIL_FROM`** findes nu i **Production**.
- Den aktuelle familiehandler forventer `RESEND_API_KEY`, hvorfor tilstedeværelsen af `resend` ikke aktiverer funktionen.

Den forberedte rettelse understøtter `RESEND_API_KEY`, `resend` og `RESEND`, med den eksisterende stavemåde bevaret. Huslyg-navnet erstatter Strømblik i invitationsmailen; deling, egen konto, accept og kontakt beskrives. Node-testen af faktisk handler/mailskabelon passerer med syntetisk key/fetch, herunder den konkrete lowercase-alias. Ingen mail er sendt under testen.

Godkendt aktivering vil udvide den eksisterende `resend`-variabel til Production og bevare Preview. Kun miljømål ændres; nøgleværdien skal ikke udskrives, trækkes ned eller kopieres til en lokal env-fil. Hvis Vercels metadataopdatering kræver nøgleindtastning, stoppes denne del, så ejeren kan sætte den privat.

Den isolerede kildeændring består kun af:

1. `src/services/family-server.mjs` – alias og mailtekst.
2. `package-lock.json` – shell-quote 1.10.0 → 1.12.0, source-map-js 1.2.1 → 1.2.2 og undici 6.28.1 → 6.29.1. Samtlige relevante eksisterende dependency-ranges er kontrolleret med semver. Intet frameworks majorversion ændres.

## Build og kildeafgrænsning

Observeret ny livebaseline `dpl_9xDinfqTXQ2qtXigt7GbA1LtWn2n` har nøjagtig samme 368 kildehashes som den tidligere verificerede kontosletningsudgivelse. Det er kontrolleret efter ekstern redeployment; ingen fremmede ændringer overskrives.

Preview `dpl_2aaDU1PbCwhNQ8PU4oVSjC2SgLkv` er **READY**. Alle 368 kildehashes matcher det to-filers ændringsforslag; produktionsalias er uændret. Der er ikke sendt mail eller ændret runtimekonfiguration i produktion ved Preview-kontrollen.

Payload og kontroller ligger i `.tmp/legal-mail-release/manifest.json` og `preview-verification.json`. Der publiceres ikke fra rod-worktree. Frontend-/privacypolitik-/downloadkilde ændres ikke i denne pakke. Efter evt. udgivelse skal hashes, Auth, kontakt/familielanding og afvisning uden login kontrolleres igen.

## Kontrakt og mailprøve

Aktivering forudsætter ejerens bekræftelse af, at Resend-kontoen/nøglen må bruges af ejeren/BluePeach, og at de relevante vilkår/DPA er accepteret. [Resends offentlige DPA](https://resend.com/legal/dpa) er gennemgået, men konkret ejeraccept er ikke automatisk afledt af den tidligere bekræftelse om Vercel/Supabase.

En kontrolmail til **info@huslyg.dk** kræver særskilt udtrykkeligt valgt godkendelse. Den må ikke oprette adgang eller sende et reelt familiemedlems oplysninger. API-accept, providerens leveringsstatus og faktisk invitationsaccept skal rapporteres hver for sig. F05 er ikke afsluttet blot fordi variablen findes eller en POST giver 200.

Rollback: rull familiehandler/lockfil tilbage til den hashverificerede baseline og fjern kun det tilføjede Production-mål efter konkret vurdering. Slettejournalen må ikke blot droppes og dens dokumentation mistes; en tilbageførsel af cleanup-funktionen kræver separat plan. Ingen allerede gennemført brugersletning kan fortrydes med en koderollback.

## Faktisk godkendelse og mailaktivering

Ejeren svarede “Ja, aktivér slettejournalen” og “Aktivér og send én kontrolmail”. Sidstnævnte bekræfter den i spørgsmålet angivne tilladelse til BluePeachs brug af Resend-kontoen samt accepterede vilkår/DPA. Konkret aftaleversion/overførselskontrol og de øvrige L02–L05-forhold er fortsat særskilte.

Den eksisterende sensitive `resend`-variabel er opdateret med **kun metadata-PATCH af target** fra Preview til Preview + Production. Ingen cloud-nøgleværdi er aflæst, udskrevet eller kopieret. `EMAIL_FROM` og kontosletningsflaget er bevaret i Production.

Produktionsudgivelse **`dpl_Fs3RD1eppPtDXu6Ntaqb1EBrGC5r`** er READY i fra1. Alle 368 kildehashes matcher det godkendte forslag med netop familiehandleren og de tre kompatible lockfilrettelser. Baseline/rollback er `dpl_9xDinfqTXQ2qtXigt7GbA1LtWn2n`. Der er ikke deployet fra rod-worktree. Produktions-Auth er bevaret; begge domæner afviser manglende/ugyldige tokens med 401/no-store for familie og kontosletning. Root, kontakt, familielanding og eksisterende APK-download svarer 200. Lokale klientsider, slette-HTML og APK 1.0.124 er ikke publiceret med denne pakke.

Én mærket kontrolmail til **info@huslyg.dk** er accepteret af Resend med HTTP 200. Mail-ID: `01a17c92-25b1-79f8-b02e-747cc4685c54`. Den indeholder ingen rigtig invitation, adgang, kundedata eller aktive acceptlinks. Afsenderen blev hentet privat fra den eksisterende Production-`EMAIL_FROM`; sending brugte den allerede eksisterende lokale projekt-nøgle, udelukkende i proceshukommelsen. Den sensitive cloud-nøgle blev ikke hentet og kan derfor ikke hævdes afprøvet via denne direkte kontrolmail.

Statusopslag for det første mail-ID returnerede 401 `restricted_api_key`: send-nøglen har ikke læserettighed. Der er ikke anmodet om en bredere nøgle. Den persistente kontroltilstand og idempotency key beskytter mod utilsigtet ny sending.

Ejeren oplyste derefter at have aktiveret receiving i Resend og godkendte med “try” én ny kontrolmail. Denne blev sendt til info@huslyg.dk med emnet **[KONTROLMAIL 2] Huslyg – modtagelse aktiveret**, mail-ID `01a17cab-a78e-745b-a97e-56b25ee32de3`, og accepteret med HTTP 200. Ejeren bekræftede derefter “den er modatget”. **Modtagelsen af den anden kontrolmail er dermed ejerbekræftet**; der er ikke udledt status for den første mail eller bestemt indbakke/spamplacering. Beviset er modtagerens bekræftelse, ikke providerstatus via API.

Den anden prøve brugte samme begrænsede lokale send-nøgle og Production-afsender, med separat one-shot-tilstand i `.tmp/legal-mail-release/control-mail-after-receiving.json`; ingen cloud-nøgle blev aflæst. Ingen invitation eller adgang blev oprettet, og ingen yderligere mail er sendt efter bekræftelsen. F05 står fortsat åbent for en faktisk produktionsinvitation/accept og resterende domæne-/leveringskontrol. Bekræftet direkte kontrolmail dokumenterer ikke i sig selv den deployede handlers sending med dens sensitive cloud-nøgle.

Evidens: `.tmp/legal-mail-release/environment-activation.json`, `production.json`, `production-verification.json` og `control-mail.json`. Sidstnævnte indeholder mailstatus, aldrig nøgle eller lokal env-kopi. [Vercels metadataopdatering](https://vercel.com/docs/rest-api/projects/edit-an-environment-variable), [Resend sending](https://resend.com/docs/api-reference/emails/send-email), [statusopslag](https://resend.com/docs/api-reference/emails/retrieve-email) og [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) er primære tekniske referencer.
