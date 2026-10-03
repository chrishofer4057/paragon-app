# 3D-Assets – Fiera

Buchführung aller 3D-Modelle: was das Spiel braucht, was es schon gibt und woher es kommt.

**Stand-Werte**
- `prozedural`: Platzhalter, der im Code aus Grundkörpern gebaut wird (`src/game/three/models`)
- `Blender ✓`: echtes Modell aus `tools/blender/buildings.py`, liegt in `public/models/`
- `gekauft ✓`: aus einem Paket, Lizenz in `assets/LICENSES.md`
- `offen`: fehlt noch (das Spiel zeigt dann den prozeduralen Platzhalter)

**Regeln für alle Modelle** (siehe auch `docs/ART_DIRECTION.md`)
- Maßstab: 1 Einheit = 1 Kachel, Figur ≈ 1 hoch. Ursprung = Mitte der Grundfläche am Boden.
- Vorderseite mit Tür zeigt nach Süden (Blender: −Y, Spiel: +Z).
- Stil: wenige Polygone, weiche Fasen, flache warme Farben. Lieber Farbflächen als feine Texturen.
- Kultur: Norden Fachwerk mit steilen Ziegeldächern, Süden weißer Putz mit blauen Kuppeln.
- Für Varianten keine eigenen Modelle drehen (die Tür muss nach Süden zeigen), sondern Dachfarbe,
  Schornstein oder Dachaufbau variieren.
- Einbindung: GLB nach `public/models/`, Schlüssel in `public/models/manifest.json`
  (`src/game/three/modelLibrary.ts`).

---

## Gebäude

Grundfläche in Kacheln (Breite × Tiefe), wie im Stadtgrundriss (`src/game/cityLayout.ts`).

| Gebäude | Größe | Norden | Süden | Hinweise |
|---|---|---|---|---|
| Wohnhaus | 3×3 (auch 4×3) | **Blender ✓** (4 Dachfarben) | **Blender ✓** (Kuppel, Sonnensegel) | Schlüssel `house-north`, `house-south`. Wünschenswert: 2–3 weitere Formen (schmales Giebelhaus, Eckhaus mit Turm, zweistöckig mit Laube) |
| Markthalle | 5×4 | prozedural | prozedural | offene Halle mit Säulen/Pfosten, Waren darunter |
| Stadthaus (Rathaus) | 5×5 | prozedural | prozedural | Uhrturm vorne, Fahnen |
| Tempel | 5×5 | prozedural | prozedural | Norden: Steinkirche mit Turmspitze; Süden: große Kuppel und zwei Minarett-Türme |
| Gildenhaus | 5×5 | prozedural | prozedural | breites Haus mit Bannern und Wappen |
| Taverne | 5×5 | prozedural | prozedural | Hängeschild, Fässer, Bank vor der Tür |
| Badehaus | 4×4 | prozedural | prozedural | Dampf aus dem Dach; Süden mit Kuppel |
| Geldverleiher | 4×4 | prozedural | prozedural | Schild mit Goldmünze |
| Bauhof | 5×4 | prozedural | prozedural | Schuppen, Gerüst, Steine, Balken |
| Werft | 6×5 | prozedural | prozedural | Helling mit Schiffsgerippe, Kran, Schuppen |
| Stadttor | 6×2 | prozedural | prozedural | zwei Türme, Torbogen, Zinnen |
| Marktstand | 2×1 | prozedural | prozedural | Tisch, gestreiftes Tuch, Waren |
| Kontor (Spieler) | 4×4 | prozedural | prozedural | Haus mit roter Spielerfahne und Kisten |
| Bauplatz | 4×4 | prozedural | prozedural | Zaun, Erde, Schild |
| Betrieb (Spieler) | 3×2 | prozedural | prozedural | Werkstatt mit großem Schornstein und Vordach. Später je Betriebsart (29 Arten, `data/businesses.ts`) eigene Kennzeichen: Sägebock, Webstuhl, Brennofen … |
| Lagerhaus | – | offen | offen | gibt es in der Simulation, noch nicht in der Welt |

## Wahrzeichen

| Wahrzeichen | Größe | Norden | Süden | Wo |
|---|---|---|---|---|
| Brunnen | 2×1 | prozedural | prozedural | Marktplatz aller mittleren und großen Städte |
| Ziehbrunnen | 2×1 | prozedural | prozedural | Marktplatz kleiner Städte |
| Windmühle | 3×3 | prozedural | prozedural | Städte mit Getreide oder Honig; Flügel drehen sich (eigenes Teil) |
| Leuchtturm | 1×1 auf Felsinsel | prozedural | prozedural | große Städte und Städte mit Fisch, Salz oder Öl |
| Denkmal | 2×2 | prozedural | prozedural | Städte ohne Windmühle und Leuchtturm |

## Schiffe und Figuren

| Modell | Stand | Hinweise |
|---|---|---|
| Kogge (eigene Schiffe) | prozedural | rote Wimpel; später je Schiffstyp (`data/ships.ts`) eigenes Modell |
| Linienschiff | prozedural | blaue Wimpel |
| Spielerfiguren (4) | prozedural | eigene Kleidung je Figur; später mit Animationen (Laufen, Hacken, Angeln) |
| Bürger arm / wohlhabend / reich | prozedural | je 2 Kleidungsvarianten |

---

## Umgebung

Diese Objekte lassen sich am besten mit deinen Unity-Paketen abdecken (Bäume, Steine). Die
Schlüssel stehen schon im Code bereit.

| Objekt | Schlüssel | Stand | Varianten | Hinweise |
|---|---|---|---|---|
| Nadelbaum (Norden) | `tree-north` | prozedural | 3–5 | Wald und Rand der Nordstädte |
| Laubbaum / Palme / Zypresse (Süden) | `tree-south` | prozedural | 3–5 | Hain und Rand der Südstädte |
| fällbarer Baum Norden | `tree-choppable-north` | prozedural | 2–3 | Sammelplatz Holz; ohne eigenes Modell wird `tree-north` genommen |
| fällbarer Baum Süden | `tree-choppable-south` | prozedural | 2–3 | dito |
| Baumstumpf | `stump` | prozedural | 1–2 | nach dem Fällen |
| Fels Norden | `rock-north` | prozedural | 3–5 | Deko und Rand |
| Fels Süden | `rock-south` | prozedural | 3–5 | Sandstein |
| Steinbruchbrocken | `quarry-rock` | prozedural | 2–3 | Sammelplatz Stein |
| Busch / Kräuter | `bush` | prozedural | 2–3 | Sammelplatz Kräuter |
| Feenblüte | – | prozedural | 1 | leuchtend, eher selbst bauen |
| Blumen, Grasbüschel | – | prozedural | – | sehr klein; prozedural reicht |
| Laterne | – | prozedural | 1 | leuchtet nachts |
| Fass, Kiste | – | prozedural | je 2 | Hafen, Märkte |
| Zaun, Karren, Säcke, Netze, Anker | – | offen | – | Belebung von Hafen und Höfen |
| Steg, Kaimauer | – | prozedural | – | Teil des Geländes |
| Bodenkacheln (Gras, Sand, Pflaster, Steg) | – | prozedural (Farben) | – | später optional Texturen aus deinem Paket |

---

## Verlauf

| Datum | Was | Quelle |
|---|---|---|
| 2026-10-03 | Alle Platzhalter prozedural im Code | eigenes Werk |
| 2026-10-03 | Wohnhaus Nord (4 Dachfarben), Wohnhaus Süd (Kuppel, Sonnensegel) | Blender-Skript `tools/blender/buildings.py`, eigenes Werk |
