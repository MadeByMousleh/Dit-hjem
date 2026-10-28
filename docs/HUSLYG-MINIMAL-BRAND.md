# Huslyg – minimalistisk vektorlogo og appikon

26. oktober 2026. Erstatter det afviste H/vindue-forslag som den aktuelle ikonretning.

## Design og filer

En enkelt hvid huskontur med døråbning på flad blå `#4158D8`. Ingen tekst, vinduer, skygger, gradienter eller rastertekstur. Logoet er tegnet direkte som SVG fra den nye brief; det tidligere genererede PNG er ikke redigeret eller brugt som rastermaster.

- [Appikon, vektor](../assets/brand/huslyg-app-icon.svg) og [1024 px PNG](../assets/brand/huslyg-app-icon.png): firkantet fuld baggrund; platformen bestemmer masken.
- [Adaptiv forgrund, vektor](../assets/brand/huslyg-adaptive-foreground.svg) og [PNG](../assets/brand/huslyg-adaptive-foreground.png): transparent, hvid form, med ekstra luft til Androids maskering/bevægelse.
- [Separat blå logomark, vektor](../assets/brand/huslyg-mark.svg) og [PNG](../assets/brand/huslyg-mark.png): transparent baggrund til opstart/lyse flader.

SVG-mastere giver skarp skalering; PNG/WebP er eksportfiler. Det almindelige ikon har en større form end den adaptive forgrund, fordi Android skalerer/maske-behandler foreground-laget anderledes. Brug ikke almindelig ikonflade som adaptiv forgrund, da det giver forkert padding og dobbelt baggrund.

## Implementering og kontrol

- Expo-konfiguration i rod og isoleret APK-kilde peger på de nye filer. Navnet under ikonet er Huslyg; teknisk pakkenavn/deep-link-skema er bevaret.
- Native Android launcher- og round-ikoner er eksporteret ved 48/72/96/144/192 px; adaptive forgrunde ved 108/162/216/324/432 px. Native baggrund er blå.
- Native opstartslogoer er eksporteret i de fem eksisterende drawable-tætheder fra den nye mark; gamle ikoner er ikke blot efterladt i den genererede Android-mappe.
- Pixelkontrol af adaptive foreground viser 0 synlige pixels uden for den centrale 66/108-sikre cirkel. Visuelt inspiceret ved 32/48/64/96 px og runde/afrundede masker. Dette er geometrisk/browserkontrol, ikke i sig selv fysisk launcher-verifikation.
- Eksport/kontrol: `.tmp/build-huslyg-minimal.mjs`, `.tmp/build-huslyg-splash.mjs` og `.tmp/huslyg-minimal/icon-verification.json`. Visuel oversigt: `.tmp/huslyg-minimal/icon-sizes.png`.
- Gamle brandfiler er bevaret; de udskiftede native ressourcer er kopieret til `.tmp/huslyg-minimal/*-before.*`. Øvrige Strømblik-tekster inde i appen og på web skal stadig gennemgås under LANC03. Ingen varemærkeregistrering eller produktionswebudgivelse i dette skridt.

## Juridisk tjekliste

Ny [teknisk datakortlægning](LEGAL-DATA-MAP.md) afslutter D02/D03/D04 som kortlægningsopgaver. D06 har teknisk dokumentation, men afventer faktisk administrator-/supportadgang; D01 og de juridiske grundlag/retention er fortsat åbne.

B05 står fortsat åbent: at tegne en ny enkel husform dokumenterer ikke navneklarering eller eksklusive rettigheder. Logoet er ikke en påstand om registreret varemærke.

## APK og installation

- Bygget fra den eksisterende isolerede APK-kilde med de nye ikoner/navne/versionstal. Gradle passerede; ingen ny pakkeafhængighed eller JavaScript-featureændring.
- [Huslyg-1.0.121.apk](../dist/Huslyg-1.0.121.apk), pakkenavn `dk.dithjem.stromblik`, versionCode 122, synlig Android-label Huslyg.
- 85.862.139 bytes; SHA256 `21CEC378ABD61B0178376F2AC6DF4333FC9CCDE127D7E585AEEB420DE4C09410`.
- Androids faktiske ressourcetabel er brugt til at finde de optimerede filnavne: alle 15 launcher-WebP'er matcher kildefiler byte for byte; alle fem PNG-optimerede opstartslogoer matcher kildebilledernes dekodede pixels. Indlejret bundle matcher buildoutput, og API er fortsat `https://dit-hjem-five.vercel.app`.
- APK-v2-signatur passerer med samme eksisterende Android Debug/test-certifikat, SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Dette er ikke produktionssignering eller butiksgodkendelse.
- Installeret på den tilsluttede Samsung SM_A576B med `install --no-streaming -r`, appdata bevaret. Installeret version/code og appstart `Status: ok` verificeret. Hjemmeskærmsikonets fysiske udseende og den kolde splashanimation er ikke manuelt gennemklikket.
- Evidence: `.tmp/huslyg-minimal/apk-verification.json`. Ingen ny web-/backendudgivelse, databaseændring, Git commit eller push; det offentlige APK-download er ikke erstattet.
