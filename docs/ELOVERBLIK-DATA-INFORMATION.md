# E02 – målepunkter, fuldmagt og gemt historik

27. oktober 2026 · **Implementeret, kontrolleret og pakket i test-APK 1.0.125.** Ikke installeret på telefonen eller publiceret på web. E02 afsluttes for kandidatens information/vej til administration; E01, faktisk leverandørtilbagekaldelse og samlet datasletning er særskilte kontroller.

## Brugeroplevelse

Den sammenklappelige tekst **Dine eldata og din adgang** vises både på Eloverblik-trinnet under oprettelsen og ved forbindelseskontrollerne. Den forklarer:

- Import omfatter historiske målinger/måleroplysninger for de målepunkter, som brugerens fuldmagt giver adgang til; målinger kan være forsinkede eller mangle perioder.
- Gemte målepunkters ID'er vises, hvis de findes, uden dubletter. Betegnelsen er **gemte**, så en gammel gemt måler ikke fejlagtigt kaldes en aktuelt autoriseret måler. Kun forventede 18-cifrede ID'er vises.
- Adgang administreres hos Eloverblik ved at fjerne den fuldmagt, brugeren gav til BluePeach/Huslyg; andre fuldmagter skal bevares. Linket åbner kun siden, og teksten siger udtrykkeligt, at åbning ikke i sig selv tilbagekalder noget.
- Allerede gemt historik bevares. Kontosletning/kontakt til info@huslyg.dk er en anden handling; elaftalen ændres ikke af frakobling.

Der tilføjes ingen lokal “forbindelsen er fjernet”-status eller sletning af målinger, når brugeren trykker på linket. Fejlet browseråbning vises med en forståelig alternativ URL. Der tilføjes ingen nye providerkald eller behandling af credentials.

Den eksisterende tredjepartsbackend bruger det gemte autorisations-ID til providerkald, undersøger aktiv fuldmagt ved status/importgrænser og kræver medlemskab. Den nye informationsvisning ændrer ikke dette flow. En rigtig tilbagekaldelse hos Eloverblik, propagationsforsinkelse og stop for alle efterfølgende hentninger er ikke afprøvet på en kundes fuldmagt her; det må ikke udledes af UI-testen.

## Kontroller og pakke

Root og isoleret kandidats TypeScript passerer. Faktisk komponent i Chrome ved 320 px med syntetiske måler-ID'er passerer: fold ud, korrekte/deduplicerede ID'er, historikforklaring, link kun ved klik, synlig browserfejl og ingen vandret overflow. Browser-/provider-I/O er simuleret; ingen fuldmagt eller kundedata ændret.

APK **dist/Huslyg-1.0.125.apk**, versionCode **126**, **85.975.859 bytes**, SHA256 **93b21610facc72db4dc202c09ccb8880fe6282c8bb0fbe23bdc7fb29bb63b75b**. Gradle passerer; 23 kilders hashes og 21 pakkede kodekilder er kontrolleret, bundlen matcher buildoutput, de nye tekster findes i Hermes som UTF-8/UTF-16, target SDK er 36, og unødvendige tilladelser/FCM-auto-init forbliver fravalgt.

Samme eksisterende test/debug-certifikat som 1.0.124, SHA256 **fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c**. APK-signatur verificeret. Backend: **https://dit-hjem-five.vercel.app**. Servermoduler er ikke pakket i klienten; ingen backend-, DB-, Auth-, provider- eller nøgleændring foretaget. Den offentlige APK-download er ikke erstattet.

Kandidaten er bygget fra den isolerede stage. AccountSetup har alene de to nye informationsreferencer oven på den gamle stage; en separat, endnu ikke pakket importprogressændring i rod-worktree er bevaret lokalt og holdt ude. De øvrige eksisterende 20 klientfiler er hashkontrolleret uændrede.

ADB og mDNS viste ingen telefon. Installation og fysisk fremtoning/linkretur er derfor ikke verificeret; ingen appdata er ryddet. Evidens: `.tmp/legal-all/eloverblik-information-ui.json` og `.tmp/legal-eloverblik-info-release/sources.json`, `apk-verification.json`. Endelig faktisk release/placeringer kontrolleres fortsat under LANC03.
