# T07 / X08 – afhængigheder, licenser og kendte fund

26. oktober 2026. **T07's fokuserede audit er udført; ingen påstand om sårbarhedsfri release.**

## Sårbarheder og håndtering

`npm audit --json` fandt først 13 advisories: én kritisk, otte høje og fire moderate i afhængighedsgrafen. Følgende indirekte pakker er opdateret inden for de eksisterende versionskrav, med installationsscripts fravalgt:

| Pakke | Før | Efter |
| --- | --- | --- |
| shell-quote | 1.10.0 | 1.12.0 |
| source-map-js | 1.2.1 | 1.2.2 |
| undici | 6.28.1 | 6.29.1 |

Kontrol efter ændring: **0 kritiske, 6 høje, 4 moderate**. Rester vedrører bl.a. image-size, node-forge, postcss og afledte Expo-værktøjspakker samt uuid/xcode. Afledte pakketællinger er ikke seks uafhængigt beviste runtimeangreb. Auditværktøjets forslag om frameworknedgradering til Expo 44 er ikke fulgt.

Praktisk afgrænsning: ingen moduler fra node-forge, image-size, postcss, shell-quote eller undici findes i den færdige Android-klients sourcemap. Det fritager ikke buildmiljøet eller en fremtidig backendimport fra risiko. Expo OTA-updates er deaktiveret i native konfiguration. Brug kun betroede projekt-/buildinputs; åbn ikke fremmed CSS, kildekort, certifikater eller assets i værktøjskæden uden kontrol. Ingen ny ekstern upload-/certifikatprocessor er aktiveret.

De høje/moderate fund skal fortsat følges ved tilgængelige kompatible upstreamrettelser og før ændret eksponering. Der er ikke erklæret en generel undtagelse eller nedgraderet alvor på advisories. Hvis et berørt værktøj skal behandle ubekræftet indhold, skal den konkrete risiko løses før brug. T07 afslutter audit og dokumenteret håndtering, ikke alle sikkerhedskrav eller DPIA-residualgodkendelse.

Evidens: `.tmp/legal-all/dependency-audit.json`, `dependency-audit-after.json`, tidligere lockfil og den nuværende `package-lock.json`. Root/staged TypeScript, relevante sikkerhedstests og Gradle passerer efter ændringerne. Kun de tre nævnte pakkeversioner ændredes i lockfilen.

## Licenser og kreditering

Generatoren `scripts/generate-open-source-notices.mjs` bruger faktisk APK-sourcemap og installerede pakkers licensfiler. Der er 97 identificerede pakkestier og 101 noticeposter inklusive font-/himmeldata. Manglende monoreponotices er suppleret fra de officielle Expo SDK 54- og React Native 0.81.5-repositoriers licenser, som er gemt under `docs/licenses/`.

Noticer findes i `src/generated/open-source-notices.json` og `public/open-source.txt`. I appen åbnes de fra **Om Huslyg → Open source og licenser**; noticernes navne er verificeret i den færdige Hermes-bundle. En tidligere JSON-kilde har ikke normal Metro-sourcemap-post, så kildehash og faktisk bundleindhold kontrolleres særskilt.

Nunito samt eventuelle medfølgende DM Sans/Fraunces-fontlicenser er medtaget. d3-celestial/BSD-teksten fra det eksisterende himmelasset er bevaret sammen med kildehenvisning. NASA-/katalogproveniens følger det eksisterende asset; det er ikke en kopi af Stellarium-artwork. Nyt Huslyg-ikon er repoets kodebaserede vektorform; det afviste AI-logo er ikke valgt som launcherikon.

Opfølgning 27. oktober: de fire onboardingillustrationers oprindelse er nu lokaliseret i [ONBOARDING.md](ONBOARDING.md) og [ONBOARDING-ILLUSTRATIONS.md](ONBOARDING-ILLUSTRATIONS.md): de er genereret med projektets imagegen-værktøj med dokumenterede prompts, ikke kopieret fra inspirationsreferencen. En kildegennemgang fandt ingen import af onboarding-pulse eller Lottie-komponenter i den aktuelle src-kode; en ubrugt fil/pakkedeklaration er ikke i sig selv et vist animationsasset. Denne kontrol er ikke en generel ophavsretsgaranti eller ny licens til fotos.

**X08 står stadig åbent** for den samlede kontrol, især anvendte kort-/fotoprodukters konkrete attribution/licens (E03) og faktisk release-afstemning. At JavaScript-pakkerne har notices dokumenterer ikke rettigheder til ethvert billede i projektet. `public/open-source.txt` er endnu ikke publiceret ved den isolerede backendændring; native notices er pakket fra 1.0.123 og videreført/verificeret i 1.0.125.

Primær evidens er npm-advisories i auditrapporten, de installerede pakkers licenstekster og officielle monorepolicenser: [Expo SDK 54](https://github.com/expo/expo/blob/sdk-54/LICENSE), [React Native 0.81.5](https://github.com/facebook/react-native/blob/v0.81.5/LICENSE). Ingen tredjepartspakke er erklæret BluePeachs egen kode.
