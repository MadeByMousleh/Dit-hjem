# Betingede krav og løbende gennemgang

26. oktober 2026 · Bygger på ejerens bekræftede første scope: voksne 18+, gratis, ingen reklamer/køb, ingen generel kundedata-træning.

| Punkt | Konklusion for første version | Genåbnes når |
| --- | --- | --- |
| V03 | Ingen betaling, prøvebetaling eller abonnementsfornyelse valgt. Betalingspris-/moms-/fornyelsesflow er derfor ikke aktuelt i dette scope. | Før betalingsmodel, betalt prøveperiode eller abonnement tilbydes. |
| V04 | Ingen digitale køb eller abonnementer valgt. Intet betalings-/gendannelsesflow skal etableres for fraværende køb. | Før køb, eksterne betalinger eller abonnementer introduceres; vurder da aktuelle butiksregler. |
| V05 | Der søges ikke samtykke til at fraskrive eller lade fortrydelsesret bortfalde. Intet sådant bortfald implementeres. Ufravigelige rettigheder bevares; øvrige forbrugeroplysninger/vilkår er fortsat under V01. Gratis ydelse med persondata er ikke antaget generelt undtaget fra forbrugerregler. | Før ændring af kontrakt-/betalingsmodel eller et ønske om bortfald/strakslevering med særlige retsvirkninger. |
| X01 | Generel træning på kundernes data er udtrykkeligt fravalgt. Punktet afsluttes som ikke relevant for første scope; det giver ikke ret til at genbruge eksisterende trænings-/forsøgsdata. | Før kundedata bruges til en fælles model eller andet nyt træningsformål. |
| X04 | Børn er ikke den valgte målgruppe. Der planlægges ingen børnetjeneste eller forældresamtykkefunktion i første scope. Beboerbørn kan stadig være indirekte berørt; dette håndteres i D07/DPIA og må ikke ignoreres. | Ved ændret målgruppe, børnerettet markedsføring eller faktiske forhold, der kræver en ny vurdering. Butiksaldersoplysninger kontrolleres separat. |
| I06 | Den gennemgåede app bruger eget mail-/OTP-/linklogin via Supabase, ikke Google-/Facebook-/andet socialt login til primær konto. Der er derfor ikke identificeret et krav om at tilføje et alternativ efter Apples 4.8 alene på dette grundlag. | Før tredjeparts-/socialt login tilføjes eller faktisk loginimplementering ændres. |

Dette er afgrænsede konklusioner, ikke generelle fritagelser fra GDPR, butikkernes øvrige krav eller forbrugerregler. S03's pauserede integrationer og X02's AI-leverandørkald skal fortsat undersøges; en scopebeslutning stopper ikke automatisk kode.

## LANC06 – fast gennemgang

Ejeren har ansvaret for samlet gennemgang før hver offentlig release og mindst årligt, næste planlagte ordinære gennemgang **26. oktober 2027**. Det er en intern plan, ikke en lovbestemt årsfrist eller et automatisk oprettet kalenderjob.

Gennemgå tidligere ved nye leverandører/lande, væsentlig vækst, AI/træning, betaling, reklamer/tracking, ny målgruppe, ændret familiedeling, nye datakategorier, sikkerhedsbrud eller ændrede relevante regler. Registrér scope, grundlag, data/modtagere/frister, DPIA-/DPO-behov, privatliv/vilkår, butiksoplysninger, ændringsmeddelelser og nødvendige kontroller. En ændring aktiveres først, når relevante krav er håndteret.

Sikre evidensreferencer gemmes i [releasechecklisten](LEGAL-RELEASE-CHECKLIST.md). Ingen kundedata eller hemmeligheder i loggen. LANC06 afslutter planlægning; LANC01–LANC05 og faktisk releasegodkendelse er særskilte.

Kilde for I06, kontrolleret 26. oktober 2026: [Apple App Review Guidelines, 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services). Øvrige rækker registrerer ejerens scope og projektets kontrolbeslutninger, ikke en påstand om, at gratis tjenester er uden lovkrav.
