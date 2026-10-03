# Asset-Lizenzen – Fiera

Fiera wird kommerziell verkauft (CLAUDE.md §1). Jedes Asset im Spiel braucht hier einen Eintrag
mit Quelle und Lizenz. Ohne Eintrag kommt kein Asset in `public/`.

## Aktueller Stand

| Asset | Quelle | Lizenz | Verwendet in |
|---|---|---|---|
| Alle 3D-Modelle (Gebäude, Bäume, Felsen, Figuren, Schiffe) | prozedural im Code (`src/game/three/models`) | eigenes Werk | Stadt, Weltkarte |
| Gelände, Wasser, Licht | prozedural im Code (`src/game/three/terrain.ts`) | eigenes Werk | Stadt |
| `public/models/house_north_0…3.glb`, `house_south_0…1.glb` | Blender-Skript `tools/blender/buildings.py` | eigenes Werk | Wohnhäuser |

Audio: noch keine Dateien. Geplant mit Suno und ElevenLabs (nur mit bezahltem Plan, siehe `docs/AUDIO.md`).

## Vorlage für gekaufte Pakete

| Paket | Händler/Shop | Kaufdatum | Lizenz (Link) | Nutzung außerhalb Unity erlaubt? | Dateien |
|---|---|---|---|---|---|
| … | Unity Asset Store | … | Standard Unity Asset Store EULA | prüfen | `public/models/…` |

Hinweis: Bei Unity-Asset-Store-Paketen vor der Nutzung prüfen, ob der Anbieter die Verwendung
in anderen Engines erlaubt (Paketbeschreibung/EULA) und ob die Weitergabe als GLB im
Spiel-Build zulässig ist.
