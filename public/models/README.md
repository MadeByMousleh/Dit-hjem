# 3D Tesla Modeller

Placer dine `.glb` 3D-modelfiler i denne mappe for at bruge dem direkte i web-appen.

## Understøttede filnavne
- `tesla_model_3.glb`
- `tesla.glb`

3D-visningen (`Tesla3DViewer.tsx`) forsøger automatisk at indlæse `/models/tesla_model_3.glb`.
Hvis filen findes, udskiftes bilens lak-materiale automatisk med bilens faktiske farve fra Tesla API'et (`exteriorColor`).

Hvis der ikke er lagt en `.glb`-fil her, benytter appen en lynhurtig indbygget aerodynamisk 3D-standardmodel i Three.js med nøjagtig lakfarve, ruder, LED-lygter og hjul.
