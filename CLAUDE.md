# CLAUDE.md – Projektbriefing

> Diese Datei ist die zentrale Referenz für Claude Code. Lies sie vollständig, bevor du Code schreibst.
> Architekturentscheidungen in dieser Datei gelten als verbindlich. Wenn eine Aufgabe eine davon verletzen würde, frage nach, bevor du abweichst.

---

## 1. Projektvision

Eine Handels- und Wirtschaftssimulation im Stil der Hanse-Zeit, inspiriert von klassischen Handelssimulationen wie „Patrizier“, aber **deutlich interaktiver**.

Der Spieler steuert eine **begehbare Figur in Draufsicht** und bleibt während des gesamten Spiels selbst an den Aktionen beteiligt. Er beginnt als mittelloser Einzelner, sammelt selbst Rohstoffe, nimmt Aufträge an, handelt, mietet Frachtraum, kauft oder baut Schiffe und steigt schließlich zum mächtigen Patrizier auf.

**Kernversprechen:** Die eigenen Handgriffe werden nie bedeutungslos. Die Rolle des Spielers wandelt sich von Handarbeit über Handel und Seefahrt hin zu Einfluss und Politik.

**Arbeitstitel:** **Fiera** (rätoromanisch für „Markt/Messe“). Der Städtebund heißt **Lia**.

### Rechtlicher Rahmen (wichtig)
- Das Spiel wird **kommerziell verkauft**.
- Der Name „Patrizier“ und alle Inhalte des Originals (Grafik, Musik, Texte, Städtenamen-Designs, UI) dürfen **nicht** verwendet werden. Spielmechaniken dürfen sich am Original orientieren, Namen sind eigene (siehe `docs/GEBAEUDE_UND_WIRTSCHAFT.md`).
- Alle Assets müssen selbst erstellt oder mit **kommerzieller Lizenz** erworben sein. Lizenz jedes Assets in `assets/LICENSES.md` dokumentieren.

---

## 2. Gameplay-Konzept

### 2.1 Start
- Der Spieler wählt eine von **4 Figuren**, jede mit einem eigenen Bonus (§3.1).
- Er startet in New Ark ohne Besitz als Tagelöhner.

### 2.2 Aufstiegsleiter
Jede Stufe wird durch eine Kombination aus **Geld (Unternehmenswert) und Ansehen** freigeschaltet, nicht durch Geld allein. Ansehen hat zwei Achsen: **sozial** (Arme) und **gesellschaftlich** (Reiche), in Prozentpunkten (100 = Landammann).

| Stufe | Rolle | Rang | Unternehmenswert | sozial / gesellsch. | Typische Aktivitäten |
|---|---|---|---|---|---|
| 1 | Tagelöhner | Tagelöhner | – | – | Holz hacken, fischen, sammeln, Tagesarbeit in der Taverne |
| 2 | Stadthändler | Krämer | 300 | 0,3 / 0,15 | freier Handel, Marktstand, Aushänge |
| 3 | Frachtmieter | Händler | 3.000 | 1,5 / 1,5 | Frachtraum mieten, Kontor, Lagerhaus |
| 4 | Reeder | Kaufmann | 20.000 | 4 / 5 | Schiffe, Betriebe, Häuser, Infrastruktur, Kontore in fremden Städten |
| 5 | Patrizier | Fernkaufmann → Ratsherr → Patrizier → Schultheiss → Landammann | 80.000 / 500.000 / 900.000 | 5/10 · 10/15 · 50/50 · gewählt | Verwalter, Kapitäne, Stadtrat, Landesherr, Wahlen, Lia-Aufträge |

Fernkaufmann erfordert die Gilde der Heimatstadt. Prüfung am Monatsersten, max. ein Aufstieg pro Monat, Ränge sinken nie. Werte in `src/sim/data/ranks.ts`.

### 2.3 Designprinzipien für die Interaktivität
1. **Die Rolle wächst mit.** Frühe Tätigkeiten werden nicht verboten, lohnen sich aber relativ zu neuen Tätigkeiten immer weniger. Kein Grind: Handarbeit darf später nie die beste Einnahmequelle sein.
2. **Eigene Zeit als Ressource.** Die Figur ist immer an genau einem Ort. Anwesenheit gibt Boni (Verwalter handelt besser, weniger Diebstahl, halber Schaden bei Feuer/Seuche, bessere Preise beim persönlichen Verkauf).
3. **Selbst gemacht lehrt andere.** Tätigkeiten, die der Spieler oft selbst ausgeführt hat, erhöhen Fertigkeiten. Diese verbessern später eigene Betriebe (+1 % je Stufe) bzw. die Handelspreise.
4. **Automatisierbarkeit.** Alles, was der Spieler selbst getan hat, lässt sich später delegieren.
5. **Ereignisse, die Anwesenheit verlangen.** Brand, Seuche, Einbruch … lassen sich nur persönlich abmildern.
6. **Tätigkeiten sind kleine Entscheidungen, kein reines Klicken.** Z. B. Timing beim Holzhacken (Command-Parameter `quality` 0..1 aus dem Minispiel).

### 2.4 Handel und Feilschen
- Händler haben eine verborgene Schmerzgrenze. Feilschen ist ein kleines Minispiel (Meilenstein 3).
- Persönlicher Verkauf am eigenen Marktstand bringt bessere Preise (+15 %) als der Großhandel, kostet aber Zeit und hat begrenzte Kundschaft.

### 2.5 Frachtraum mieten (Stufe 3)
- Option A: Spieler reist mit (Überfahrt), verkauft am Ziel persönlich.
- Option B: Ware dem Kapitän mitgeben (`ShipCargo`), Erlös abzüglich Provision.
- Linienschiffe mit echtem Fahrplan folgen in Meilenstein 2.

### 2.6 Quests
- **Dynamische Quests aus der Simulation:** Aushänge im Stadthaus bei Warenmangel, Warenkäufer und Reisende in der Taverne.
- **Handgeschriebene Quests** für Einstieg und Geschichte (noch offen).

### 2.7 Spätere Ideen (nicht für die ersten Meilensteine)
- Seeschlachten, Piraten, Konvois, Entern, Auslieger
- Belagerungen, Stadtmauer, Miliz, Versteigerungen
- Figurenzustände: Hunger, Müdigkeit, Krankheit

---

## 3. Spieldaten

Statische Definitionen liegen in `src/sim/data/`. Übernommen aus dem Paragon-Projekt (`/home/malik/RiderProjects/Paragon`): Warennamen, Städte, Spezial-/Regulärproduktion, Größe, Kartenposition, Preiskurven (→ Basispreise).

### 3.1 Figuren (`data/characters.ts`)
| Figur | Bonus |
|---|---|
| Gian Caduff – Holzfäller | Holz/Stein sammeln ×1,5, Holzfällen Stufe 2 |
| Ursina Cathomen – Marktfrau-Tochter | 5 % bessere Preise beim persönlichen Handel, Handeln Stufe 2 |
| Duri Pult – Fischer | Fisch ×1,5, Fracht/Überfahrt −25 %, Kontakte in Port Nyx und Stormwatch |
| Mengia da Lumbrein – verarmte Patriziertochter | Startansehen bei den Reichen in New Ark, halbe Gildengebühr |

### 3.2 Städte (`data/cities.ts`)
26 Städte aus Paragon. Kultur nach Kartenposition: `mapY < 50` = **nordisch** (Fachwerk, Winterflaute bei Anbaubetrieben), sonst **südlich**. Optik siehe `docs/ART_DIRECTION.md`.

### 3.3 Waren (`data/goods.ts`)
30 Waren aus Paragon in vier Gruppen (Grundversorgung, Konsum, Luxus, Rohstoffe). Basispreise aus den Paragon-Preiskurven; Verbrauch nach der Patrizier-Verbrauchstabelle; Produktionsketten in `data/businesses.ts`.

---

## 4. Tech-Stack

| Bereich | Technologie |
|---|---|
| Sprache | TypeScript (`strict: true`, `noUncheckedIndexedAccess`) |
| Spielwelt / Rendering | Phaser (aktuelle stabile Version) |
| Oberfläche | Angular (Signals, zoneless bevorzugt) |
| Karten | Tiled-Editor, Export als JSON |
| Tests | Vitest (Simulation), Playwright optional für E2E |
| Desktop / Steam | Electron + steamworks.js |
| Browser-Demo | Web-Build, Speichern in IndexedDB |

Befehle: `npm test`, `npm run typecheck`, `npm run lint`, `npm run check` (alles).

---

## 5. Architektur

### 5.1 Grundregel: drei getrennte Schichten

```
┌─────────────────────┐   ┌─────────────────────┐
│ Phaser (Spielwelt)  │   │ Angular (UI)        │
│ – liest Zustand     │   │ – liest Zustand     │
│ – sendet Commands   │   │ – sendet Commands   │
└─────────┬───────────┘   └──────────┬──────────┘
          │        Bridge / GameService          │
          └──────────────┬───────────────────────┘
                         ▼
              ┌──────────────────────┐
              │ Simulation (sim/)    │
              │ reines TypeScript    │
              │ Zustand + Commands   │
              │ + Tick + Events      │
              └──────────────────────┘
```

**Verbindliche Regeln für `src/sim/`** (per ESLint abgesichert):
- Keine Imports aus Phaser, Angular, DOM oder Electron. Die Simulation läuft headless in Node (Vitest).
- Zustand ist **reines, serialisierbares JSON**: keine Klasseninstanzen, keine Funktionen, keine zirkulären Referenzen. Beziehungen nur über **IDs**.
- **Deterministisch:** kein `Math.random()`, kein `Date.now()`. Zufall nur über `sim/rng.ts` (Zustand in `state.rng`); für zustandslose Tageswürfe `hashFloat`.
- Zustandsänderungen **ausschließlich** über `applyCommand(state, command)` und `tick(state, hours)`.
- Commands werden validiert. Ungültige Commands ändern nichts (auch nicht den RNG) und liefern `{ ok: false, reason }`.
- Die Simulation gibt **Events** aus (`events/events.ts`) und schreibt amtliche Nachrichten (`state.messages`).
- `applyCommand`/`tick` verändern den Zustand direkt (Performance); `applyCommandPure` arbeitet auf einer Kopie.

**Phaser und Angular:** verändern den Simulationszustand nie direkt. Phasers Spielschleife läuft außerhalb der Angular-Änderungserkennung. Angular bekommt den Zustand über Signals aus einem `GameService`.

### 5.2 Zeit
- **1 Tick = 1 Spielstunde.** Kalender: 12 Monate à 30 Tage, Start März 1350.
- Stündlich: Stadtwirtschaft, Betriebe, Reisen, Bau, Lieferungen. Täglich (0 Uhr): Bevölkerung, Personal, Verwalter, Tempel, Aushänge, Taverne, KI-Handel, Katastrophen, Kosten, Wahlen. Wöchentlich: Löhne, Steuern, Mieten, Zinsen, Anklagen, Einbrüche. Monatlich: Rangprüfung, Landesherr.
- Alle Städte werden immer simuliert (≈1,5 s Rechenzeit pro Spieljahr).

### 5.3 Welt
- Jede Stadt samt Umland ist eine eigene Tiled-Karte und Phaser-Szene; Reisen über eine Weltkarte.
- Phaser-Szenen: `BootScene`, `CityScene` (parametrisiert pro Stadt), `WorldMapScene`.

### 5.4 Preisbildung
```
preis = basispreis * clamp( (zielbestand / max(bestand, 1)) ^ elastizität, minFaktor, maxFaktor )
```
Zielbestand = 2 Wochen Bedarf (Bürger + städtische Betriebe). Kauf/Verkauf mit 12 % Spanne, Mengen werden Einheit für Einheit bewertet (`systems/prices.ts`).

### 5.5 Ordnerstruktur
```
/src
  /sim
    /state        # GameState, IDs
    /data         # Waren, Städte, Betriebe, Gebäude, Ränge, Figuren, Schiffe, balance.ts
    /commands     # Command-Typen, Prüfungen, Handler je Gebäudegruppe
    /systems      # economy, prices, demand, population, businesses, reputation, ranks, politics, …
    /events
    /world        # Welterzeugung und Produktionsabgleich
    /testing      # Test-Fixtures
    rng.ts, time.ts, context.ts, engine.ts
  /persistence    # SaveFile, Migrationen, SaveStorage-Interface
  /game  /ui  /bridge   # folgen
/docs             # ART_DIRECTION.md, GEBAEUDE_UND_WIRTSCHAFT.md
```

---

## 6. Speichersystem

- Freies Speichern/Laden, mehrere Slots, Autosave. Format `SaveFile` in `src/persistence/saveFile.ts`, aktuell **`saveVersion` 1**.
- **Migrationen:** Bei jeder Änderung am Zustandsmodell `SAVE_VERSION` erhöhen und eine Migration in `MIGRATIONS` ergänzen, inklusive Test mit einem alten Beispielspielstand.
- Adapter-Interface `SaveStorage` (Browser: IndexedDB, Electron: `userData`).

---

## 7. Multiplayer
Kein Multiplayer in den ersten Versionen. Die command-basierte, deterministische Simulation hält einen Koop-Modus (Host + SignalR-Hub) offen.

## 8. Vertrieb
Einmalkauf über Steam (Electron), Browser-Demo (itch.io), eventuell Early Access.

---

## 9. Meilensteine

### Meilenstein 1 – Vertikaler Ausschnitt
- [x] Projektsetup (TypeScript strict, Vitest, ESLint, Prettier) – Angular/Phaser folgen
- [x] Simulationskern: `GameState`, `createNewGame`, `applyCommand`, `tick`, geseedeter RNG
- [x] Figurenauswahl (4 Figuren, Bonus wirkt sich aus)
- [ ] Eine Stadt als Tiled-Karte, Figur läuft in Draufsicht herum
- [x] Holz hacken (Timing-Qualität) → Command `ChopWood` (Sim-Seite)
- [x] Markt: Holz verkaufen, Preis reagiert auf den Bestand
- [ ] Angular-Oberfläche: Inventar, Geld, Marktfenster, Uhrzeit
- [x] Tests für Preisbildung, Commands und Tick

### Zusätzlich bereits in der Simulation (vorgezogen)
Alle Gebäude nach Patrizier-Logik (Kontor, Lagerhaus, 29 Betriebe, Wohnhäuser, Infrastruktur, Tempel, Taverne, Gilde, Stadthaus, Geldverleiher, Badehaus, Werft, Stadttor, Fest, Marktstand), Bevölkerung mit Zufriedenheit/Wachstum, Ansehen (sozial/gesellschaftlich), Ränge, Wahlen, Lia, Schiffe, Reisen, Frachtraum, Kredite, Katastrophen, Speicherformat v1.

### Meilenstein 2 – Zweite Stadt und Speichern
- [ ] Weltkarte, Reisen mit Zeitvorlauf (Sim fertig)
- [ ] Linienschiffe mit Fahrplan (Sim: Fracht mitgeben fertig)
- [ ] Speichern/Laden-UI, Autosave (Format fertig)

### Meilenstein 3 – Quests und Fortschritt
- [x] Dynamische Quests aus Warenknappheit (Sim)
- [x] Ansehen, Freischaltung der Stufen (Sim)
- [x] Fertigkeiten durch eigenes Tun (Sim)
- [ ] Feilschen-Minispiel

---

## 10. Konventionen für Code
- TypeScript `strict`, kein `any`.
- Kleine, fokussierte Dateien. Ein System pro Datei in `sim/systems`.
- Jede Änderung an `src/sim` braucht Tests (Vitest, headless).
- Balancing-Werte gehören in `src/sim/data`, nicht in die Logik.
- IDs als String-Literal-Typen (`CityId`, `GoodId`, …) oder gebrandete Typen (`BusinessId`, …).
- Kommentare und Spielertexte auf Deutsch, Bezeichner auf Englisch.

## 11. Arbeitsregeln für Claude Code
1. Lies diese Datei zu Beginn jeder Sitzung.
2. Halte die Schichtentrennung aus Abschnitt 5 strikt ein. Im Zweifel nachfragen.
3. Schreibe zuerst Tests für Simulationslogik, dann die Implementierung.
4. Führe nach Änderungen `npm run check` aus.
5. Ändere das Zustandsmodell nie ohne `saveVersion`-Erhöhung und Migration.
6. Keine Assets aus unklaren Quellen. Platzhaltergrafiken sind erlaubt und als solche zu kennzeichnen.
7. Trage wichtige Entscheidungen unten im Entscheidungslog ein.

---

## 12. Entscheidungslog

| Datum | Entscheidung | Begründung |
|---|---|---|
| 2026-09-29 | Webtechnik (TypeScript, Phaser, Angular) statt Unity | Alles textbasiert und damit gut mit KI bearbeitbar, UI-lastiges Spiel, Browser-Demo möglich |
| 2026-09-29 | Einzelspieler zuerst, Koop später optional | Freies Speichern, flexible Zeit, geringerer Aufwand; Architektur hält Koop offen |
| 2026-09-29 | Simulation als reiner, deterministischer, serialisierbarer Kern | Testbarkeit, Speichern, spätere Multiplayer-Fähigkeit |
| 2026-09-29 | Vertrieb über Steam via Electron | Kommerzielles Ziel, Steamworks-Anbindung verfügbar |
| 2026-10-02 | Arbeitstitel **Fiera**, Städtebund **Lia**, Ämter Schultheiss/Landammann | Rätoromanischer Name gewünscht; eigene Begriffe statt Patrizier-Namen |
| 2026-10-02 | 1 Tick = 1 Spielstunde, Kalender 12 × 30 Tage | Figur braucht Stunden-Auflösung; vereinfachter Kalender ist deterministisch und leicht zu rechnen |
| 2026-10-02 | `tick`/`applyCommand` mutieren den Zustand direkt, `applyCommandPure` für Kopien | `structuredClone` je Stunde wäre beim Vorspulen zu teuer |
| 2026-10-02 | Gebäude-/Wirtschafts-/Ansehenslogik nach Tippsammlung 2010, eigene Namen und Zahlen | Wunsch des Entwicklers; Mechaniken ja, Inhalte des Originals nein |
| 2026-10-02 | Nord/Süd nach Kartenposition (`mapY < 50` = Norden) | Einfach, in Daten änderbar; Norden mit Winterflaute |
| 2026-10-02 | KI-Hintergrundhandel statt simulierter KI-Händler | Städte ohne Eigenproduktion bleiben versorgt; günstig zu rechnen; Spieler bleibt schneller und lukrativer |
| 2026-10-02 | Städtische Produktion = 108 % des Weltbedarfs | Mit 100 % brach die Welt durch Transportverluste ein; Lücken entstehen durch Verteilung und Wachstum |
| 2026-10-02 | Frühe Rangschwellen stark gesenkt (Krämer nach ~3–4 Wochen) | Fiera beginnt mittellos; Original-Schwellen erst ab Ratsherr |
| 2026-10-02 | Paragon-Daten korrigiert: Fleisch-Verbrauch, Salz in Fass, Kettenpreise (Barren 800, Riftstahl 3600, Essenz 2200) | Offensichtliche Tippfehler bzw. Veredelung war ein Verlustgeschäft |
