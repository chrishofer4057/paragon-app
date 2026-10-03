# Art Direction – Fiera

Vorgaben des Entwicklers (Referenzbilder vom 2026-10-02).

## Gesamtstil
- Stilisiert, cartoonig, warme Farben, weiche Formen, leicht "3D-gemalt".
- Kamera: hohe Draufsicht / schräg-isometrisch über einer Hafenstadt, wie das Key-Art von *Brave Conquest* (Wüstenhafen, Luftschiff, Segelschiff, Kaimauern).
- Technik: echtes 3D (Three.js), Welt aus Kacheln mit Höhenstufen, flach schattierte Low-Poly-Modelle,
  warme Beleuchtung mit Tag/Nacht (Laternen und Fenster leuchten nachts). Perspektivkamera ca. 50° geneigt,
  dreh- und zoombar.
- Derzeit alles prozedurale Platzhalter (`src/game/three/models`). Echte Modelle kommen als GLB;
  FBX-Quellen werden mit Blender konvertiert. Maßstab: 1 Kachel = 1 Einheit, Figur ≈ 1 Einheit hoch,
  Wohnhaus 3×3 Kacheln und ≈ 3 Einheiten hoch.
- Ambiente: lebendige Hafenstädte, Wasser, Stege, Marktstände.

## Südliche Städte (mapY ≥ 50, `culture: 'south'`)
- Helle, sandfarbene/weiß verputzte Bauten, flache Dächer und Terrassen.
- Blaue Kuppeln und spitze blaue Türme, goldene Akzente – "ähnlich Dalaran".
- Palmen, Sandstein, türkises Wasser, Markisen.

## Nördliche Städte (mapY < 50, `culture: 'north'`)
- Fachwerkhäuser mit steilen Schindeldächern (rotbraun oder blau), schwere Holzbalken,
  Rundfenster, Laternen, Fässer, Schornsteine mit Rauch – "wie die Allianz-Gebäude in den Grizzly Hills".
- Nadelbäume, sattes Gras, Steinsockel und Steinwege.

## Rechtliches
Referenzen dienen nur als Stilrichtung. Keine Assets aus WoW, Brave Conquest oder Patrizier;
alles selbst erstellt oder kommerziell lizenziert, dokumentiert in `assets/LICENSES.md`.
