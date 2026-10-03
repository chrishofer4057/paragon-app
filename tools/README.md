# Werkzeuge

## FBX → GLB (`fbx2glb.py`)

Echte Modelle für die 3D-Welt kommen als GLB nach `public/models/`. Quellen (z. B. FBX aus
Unity-Paketen) liegen in `assets/source/` und werden mit Blender umgewandelt:

```bash
blender -b -P tools/fbx2glb.py -- assets/source/<paket> public/models
```

Danach in `public/models/manifest.json` eintragen, wofür das Modell steht:

```json
{
  "models": {
    "tree-north": { "files": ["pine_a.glb", "pine_b.glb"], "height": 2.2 },
    "rock-north": { "files": ["rock_01.glb"] }
  }
}
```

Schlüssel (siehe `src/game/three/modelLibrary.ts`): `tree-north`, `tree-south`,
`tree-choppable-north`, `tree-choppable-south`, `stump`, `rock-north`, `rock-south`,
`quarry-rock`, `bush`. `height` ist die Zielhöhe in Kacheln (Figur ≈ 1). Fehlt ein Schlüssel,
bleibt der prozedurale Platzhalter. Lizenz in `assets/LICENSES.md` eintragen.

## Gebäude aus Blender (`blender/buildings.py`)

Baut Gebäude per Python-Skript in Blender, exportiert GLB und rendert eine Vorschau:

```bash
blender -b -P tools/blender/buildings.py -- /tmp/fiera-modelle            # alle Modelle
blender -b -P tools/blender/buildings.py -- /tmp/fiera-modelle house_north_2
cp /tmp/fiera-modelle/*.glb public/models/
```

Neue Gebäude: eine Funktion wie `house_north(variant)` schreiben (Bausteine `box`, `cylinder`,
`prism_roof`, `timber_face`, `window` …), in `MODELS` eintragen, im Manifest einen Schlüssel
vergeben und in `src/game/three/models/buildings.ts` verwenden. Stand in `docs/ASSETS_3D.md`
nachführen.
