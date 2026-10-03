# Audio – Fiera

Arbeitsliste aller Klänge: Musik (**Suno**), Geräusche und Atmosphären (**ElevenLabs Sound Effects**),
Stimmen (**ElevenLabs Text-to-Speech / Voice Design**). Status: `offen` → `erzeugt` → `eingebaut`.

## Rahmen

- **Lizenz:** Fiera wird verkauft. Suno-Titel nur mit bezahltem Plan (Pro/Premier) erzeugen, sonst
  keine kommerzielle Nutzung. ElevenLabs ebenfalls nur mit bezahltem Plan. Jede Datei mit Datum,
  Plan und Prompt in `assets/LICENSES.md` eintragen.
- **Prompts** nennen keine Künstler, Spiele oder Marken – nur Stil, Instrumente, Stimmung.
- **Format:** OGG Vorbis, 44,1 kHz, Stereo (Stimmen Mono). Loops sauber geschnitten (Nulldurchgang,
  kein Ausklang). Ablage `public/audio/<gruppe>/<id>.ogg`.
- **Lautheit:** Musik ≈ −16 LUFS, Atmosphären ≈ −22 LUFS, Effekte Spitze −3 dBFS, Stimmen ≈ −18 LUFS.
- **Varianten:** Häufige Effekte (Schritte, Axthiebe, Münzen) je 3–4 Varianten `_a`, `_b`, `_c` …
- **Technik (später):** Ein `AudioService` in der Spielwelt-Schicht hört auf Sim-Events und
  Kamera/Ort; die Simulation selbst kennt keinen Ton (CLAUDE.md §5.1).

---

## 1. Musik (Suno)

Instrumental, außer wo anders angegeben. Länge 2–3 Min., als Loop nutzbar (Anfang/Ende ähnlich).
Gemeinsame Klangfarbe: kleines mittelalterliches Ensemble, warm, verspielt, leicht märchenhaft.

| ID | Wo | Länge | Suno-Prompt | Status |
|---|---|---|---|---|
| `music/title` | Titelbild | 2:30 | *Instrumental, warm medieval folk overture, lute, recorder, hurdy-gurdy, frame drum, string ensemble, hopeful and adventurous, rising melody, seafaring trade town, cinematic but intimate* | offen |
| `music/city_north_day` | Nordstädte, Tag | 3:00 | *Instrumental, cozy northern medieval village, fiddle, nyckelharpa, wooden flute, soft hand drum, gentle and pastoral, cool morning air, loopable, no vocals* | offen |
| `music/city_south_day` | Südstädte, Tag | 3:00 | *Instrumental, sunny mediterranean medieval harbour town, oud, mandolin, ney flute, darbuka, light strings, bright and lively, warm breeze, loopable, no vocals* | offen |
| `music/city_north_night` | Nordstädte, Nacht | 2:30 | *Instrumental, calm night in a northern medieval town, solo harp and low flute, soft drone, peaceful, sparse, loopable* | offen |
| `music/city_south_night` | Südstädte, Nacht | 2:30 | *Instrumental, warm mediterranean night, slow oud arpeggios, soft frame drum, distant strings, dreamy and quiet, loopable* | offen |
| `music/winter` | Norden im Winter | 2:30 | *Instrumental, snowy medieval village, celesta-like bells, soft strings, wooden flute, melancholic but cozy, slow, loopable* | offen |
| `music/tavern_a` | Taverne (im Haus) | 2:00 | *Instrumental, rowdy medieval tavern jig, fiddle, bodhrán, tin whistle, stomping rhythm, cheerful, 6/8* | offen |
| `music/tavern_b` | Taverne, Abwechslung | 2:00 | *Instrumental, medieval tavern reel, lute and accordion-like drone, clapping, upbeat, folk dance* | offen |
| `music/tavern_song` | Taverne, Sänger | 2:30 | *German lyrics, medieval sea shanty sung by a rough male choir in a tavern, about trade winds, salt and silver, call and response, fiddle and drum* (Text selbst schreiben, siehe unten) | offen |
| `music/world_sea` | Weltkarte / Reisen | 3:00 | *Instrumental, sailing across open sea, rolling 6/8, strings, low whistle, frame drum, sense of distance and adventure, loopable* | offen |
| `music/market` | Marktfenster offen | 2:00 | *Instrumental, busy medieval market, playful recorder and lute, pizzicato strings, light percussion, bustling and cheerful* | offen |
| `music/temple` | Tempel | 2:00 | *Instrumental, serene sacred medieval chant atmosphere, wordless choir pad, soft organ-like drone, small bells, reverberant* | offen |
| `music/townhall` | Stadthaus / Politik | 2:00 | *Instrumental, dignified medieval court music, brass ensemble, harpsichord-like plucks, measured tempo, ceremonial* | offen |
| `music/festival` | Fest | 2:30 | *Instrumental, joyful medieval town festival, shawm, bagpipe-like drone, drums, tambourine, dancing crowd energy* | offen |
| `music/tension` | Feuer, Seuche, Ermittlung | 1:30 | *Instrumental, urgent medieval danger, low drums, tense strings tremolo, dissonant horn calls, loopable* | offen |
| `music/plague` | Seuche (Stadt) | 2:00 | *Instrumental, somber medieval plague town, slow low strings, distant tolling bell, sparse and heavy, loopable* | offen |
| `music/credits` | Abspann | 3:00 | *Instrumental, warm triumphant medieval finale, full folk ensemble, lute, strings, horns, nostalgic and proud* | offen |

**Kurzmotive (Stinger, 3–8 s)** – in Suno als kurze Stücke erzeugen und zuschneiden:

| ID | Anlass | Prompt | Status |
|---|---|---|---|
| `stinger/rank_up` | Aufstieg im Rang | *short triumphant medieval fanfare, brass and drums, 5 seconds* | offen |
| `stinger/elected` | Zum Schultheiss/Landammann gewählt | *short ceremonial medieval fanfare with choir swell, 8 seconds* | offen |
| `stinger/quest_done` | Auftrag erfüllt | *short cheerful lute flourish, 3 seconds* | offen |
| `stinger/ship_built` | Schiff fertig | *short seafaring horn call with drum, 5 seconds* | offen |
| `stinger/caught` | Beim Schmuggel erwischt | *short ominous medieval sting, low brass hit and drum, 3 seconds* | offen |
| `stinger/disaster` | Feuer/Seuche bricht aus | *short alarming medieval sting, bell clang and tense strings, 4 seconds* | offen |

---

## 2. Atmosphären (ElevenLabs Sound Effects, Loops 30–60 s)

| ID | Wo / wann | Prompt (EN, für ElevenLabs) | Status |
|---|---|---|---|
| `amb/harbour_day` | nahe Hafen, Tag | *medieval harbour ambience, gentle waves against stone quay, seagulls, creaking wooden ships and ropes, distant workers, loopable* | offen |
| `amb/harbour_night` | Hafen, Nacht | *quiet harbour at night, soft lapping water, creaking moored boats, distant dog, loopable* | offen |
| `amb/square_north` | Marktplatz Nord | *medieval northern market square, murmuring crowd, footsteps on cobblestones, distant blacksmith hammer, cart wheels, loopable* | offen |
| `amb/square_south` | Marktplatz Süd | *warm mediterranean medieval bazaar, lively crowd chatter, merchants calling in the distance, fountain, loopable* | offen |
| `amb/town_north` | Gassen Nord | *calm northern medieval town, wind through streets, birds, distant church bell, wooden shutters, loopable* | offen |
| `amb/town_south` | Gassen Süd | *sunny southern town, cicadas, warm breeze, distant voices, a donkey far away, loopable* | offen |
| `amb/night_north` | Stadt Nord, Nacht | *northern town at night, crickets, owl, gentle wind, occasional distant footsteps, loopable* | offen |
| `amb/night_south` | Stadt Süd, Nacht | *warm southern night, crickets and cicadas, soft breeze, faint distant music, loopable* | offen |
| `amb/forest_north` | Wald Nord | *pine forest ambience, wind in conifers, woodpecker, small birds, loopable* | offen |
| `amb/forest_south` | Hain Süd | *olive grove and palms, warm wind in leaves, cicadas, songbirds, loopable* | offen |
| `amb/quarry` | Steinbruch | *open quarry, gusty wind, small stones trickling, distant pick hits, loopable* | offen |
| `amb/meadow` | Wiese | *flower meadow, bees humming, grasshoppers, light breeze, loopable* | offen |
| `amb/winter` | Norden im Winter | *snowy medieval village, soft cold wind, muffled quiet, occasional snow falling off roof, loopable* | offen |
| `amb/tavern` | Taverne (Fenster offen) | *busy medieval tavern interior, crowd laughter and chatter, clinking mugs, crackling fireplace, loopable* | offen |
| `amb/temple` | Tempel (Fenster offen) | *large stone temple interior, deep reverb, faint whispers, soft footsteps, distant chant, loopable* | offen |
| `amb/sea_open` | Weltkarte | *open sea from a sailing ship, wind in sails, waves on hull, creaking timber, loopable* | offen |
| `amb/fire` | brennendes Gebäude | *building on fire, roaring crackling flames, wood cracking, people shouting in the distance, loopable* | offen |
| `amb/plague` | Seuche | *eerie quiet town, distant coughing, slow tolling bell, wind, few footsteps, loopable* | offen |
| `amb/festival` | Fest | *medieval town festival crowd, cheering, laughter, clapping, loopable* | offen |
| `amb/windmill` | nahe Windmühle | *wooden windmill turning, creaking sails and gears, wind, loopable* | offen |
| `amb/fountain` | nahe Brunnen | *small stone fountain splashing water, loopable* | offen |

---

## 3. Effekte (ElevenLabs Sound Effects, One-Shots)

### Figur und Welt

| ID | Anlass | Prompt | Varianten | Status |
|---|---|---|---|---|
| `sfx/step_stone` | Schritt Pflaster/Straße | *single footstep, leather boot on cobblestone* | 4 | offen |
| `sfx/step_sand` | Schritt Sand | *single footstep on dry sand* | 4 | offen |
| `sfx/step_grass` | Schritt Gras/Wald | *single footstep on grass and leaves* | 4 | offen |
| `sfx/step_wood` | Schritt Steg | *single footstep on wooden pier planks* | 4 | offen |
| `sfx/step_snow` | Schritt Schnee | *single footstep crunching in snow* | 4 | offen |
| `sfx/click_ground` | Laufziel gesetzt | *soft subtle UI tick, wooden* | 1 | offen |
| `sfx/door_wood` | Gebäude betreten (Fenster auf) | *heavy medieval wooden door opening with iron latch* | 2 | offen |
| `sfx/chop` | Axthieb | *axe chopping into tree trunk, single hit* | 4 | offen |
| `sfx/tree_fall` | Baum gefällt | *tree cracking and falling, short* | 1 | offen |
| `sfx/pick_stone` | Steinbrechen | *iron pickaxe striking rock, single hit* | 4 | offen |
| `sfx/rock_break` | Stein gebrochen | *rock cracking apart, small stones falling* | 1 | offen |
| `sfx/fish_cast` | Angel auswerfen | *fishing line cast, whoosh and small splash* | 1 | offen |
| `sfx/fish_bite` | Biss! | *fish bite, quick splash and line tug* | 2 | offen |
| `sfx/fish_catch` | Fang | *fish pulled out of water, splash and flapping* | 1 | offen |
| `sfx/pick_herbs` | Kräuter pflücken | *plucking herbs, leaves rustling* | 3 | offen |
| `sfx/faerybloom` | Feenblüte pflücken | *magical soft chime with sparkle, picking a glowing flower* | 2 | offen |
| `sfx/minigame_perfect` | Minispiel perfekt | *bright satisfying chime, two notes up* | 1 | offen |
| `sfx/minigame_miss` | daneben | *dull wooden thud, slightly comic* | 1 | offen |
| `sfx/hammer_build` | Baustelle | *carpenter hammering nails into wood* | 3 | offen |
| `sfx/build_done` | Bau fertig | *wooden structure settling, small celebratory knock* | 1 | offen |
| `sfx/church_bell_north` | volle Stunde (Nord) | *single medieval church bell strike, distant* | 1 | offen |
| `sfx/bell_south` | volle Stunde (Süd) | *bronze temple bell, warm and distant* | 1 | offen |
| `sfx/rooster` | Morgendämmerung | *rooster crowing in the distance* | 1 | offen |
| `sfx/gull` | Hafen zufällig | *single seagull call* | 3 | offen |
| `sfx/dog_bark` | Stadt zufällig | *dog barking twice in the distance* | 2 | offen |

### Handel und Geld

| ID | Anlass | Prompt | Varianten | Status |
|---|---|---|---|---|
| `sfx/coins_small` | kleiner Verkauf | *few silver coins clinking into a hand* | 3 | offen |
| `sfx/coins_large` | großer Verkauf | *heavy pouch of coins dropped on wooden table* | 2 | offen |
| `sfx/coins_pay` | bezahlen | *coins counted onto a counter* | 2 | offen |
| `sfx/haggle_accept` | Händler willigt ein | *hand slap on wooden table, deal sealed* | 1 | offen |
| `sfx/stall_cloth` | Marktstand | *canvas awning flapping in wind* | 1 | offen |
| `sfx/crate` | Ware umladen | *wooden crate set down on stone* | 3 | offen |
| `sfx/bribe` | Bestechung | *coins slid quietly across a table, hushed* | 1 | offen |
| `sfx/smuggle_ok` | Schmuggel gelungen | *crate quietly handed over, low whistle* | 1 | offen |
| `sfx/guard_whistle` | erwischt | *guard whistle blast and armor clanking* | 1 | offen |

### Schiffe

| ID | Anlass | Prompt | Varianten | Status |
|---|---|---|---|---|
| `sfx/ship_bell` | Ankunft im Hafen | *ship bell ringing three times* | 1 | offen |
| `sfx/anchor` | Anlegen | *anchor chain rattling and splash* | 1 | offen |
| `sfx/sail_unfurl` | Ablegen | *large canvas sail unfurling and catching wind* | 1 | offen |
| `sfx/ship_horn` | Linienschiff legt ab | *deep wooden horn blast from a ship* | 1 | offen |

### Ereignisse

| ID | Anlass | Prompt | Varianten | Status |
|---|---|---|---|---|
| `sfx/fire_start` | Brand bricht aus | *flames igniting with a whoosh, wood catching fire* | 1 | offen |
| `sfx/alarm_bell` | Feuerglocke | *frantic alarm bell ringing* | 1 | offen |
| `sfx/crowd_cheer` | Fest/Wahl | *crowd cheering and applauding* | 2 | offen |
| `sfx/crowd_gasp` | Katastrophe | *crowd gasping in shock* | 1 | offen |

### Oberfläche

| ID | Anlass | Prompt | Varianten | Status |
|---|---|---|---|---|
| `ui/click` | Knopf | *soft wooden button click* | 2 | offen |
| `ui/hover` | Mausüber | *very soft paper tick* | 1 | offen |
| `ui/panel_open` | Fenster auf | *parchment unrolling* | 1 | offen |
| `ui/panel_close` | Fenster zu | *parchment rolling up* | 1 | offen |
| `ui/notify_info` | Meldung | *soft quill scratch with light chime* | 1 | offen |
| `ui/notify_success` | Erfolg | *pleasant two-note harp pluck* | 1 | offen |
| `ui/notify_warning` | Warnung | *low wooden knock, twice* | 1 | offen |
| `ui/notify_danger` | Gefahr | *dramatic low drum hit* | 1 | offen |
| `ui/letter` | Neue Nachricht | *wax seal breaking, letter opened* | 1 | offen |
| `ui/save` | Gespeichert | *book closing softly* | 1 | offen |

---

## 4. Stimmen (ElevenLabs)

Alle Texte **deutsch**, kurz (1–2 s), mehrere Varianten pro Anlass, damit es sich nicht wiederholt.
Stimmen per *Voice Design* anlegen (Beschreibung unten) und für alle Zeilen derselben Rolle
wiederverwenden. Ablage `public/audio/voice/<rolle>/<id>.ogg`.

### Stimmen anlegen (Voice Design)

| Rolle | Beschreibung für Voice Design |
|---|---|
| Gian (Spielerfigur) | *young man, early twenties, strong and friendly, slight mountain-village accent, grounded* |
| Ursina (Spielerfigur) | *young woman, quick-witted and confident, warm, slightly teasing* |
| Duri (Spielerfigur) | *man in his thirties, calm fisherman, weathered slightly husky voice, dry humor* |
| Mengia (Spielerfigur) | *young noblewoman, refined diction, proud but kind, clear voice* |
| Erzähler | *mature male narrator, warm, storybook tone, unhurried* |
| Herold | *loud town crier, projecting, theatrical* |
| Händler | *middle-aged merchant, shrewd, jovial, a bit greedy* |
| Händlerin | *middle-aged market woman, brisk, loud, good-humored* |
| Wirt | *burly innkeeper, booming, friendly* |
| Priester | *elderly priest, soft, solemn* |
| Stadtwache | *stern guard, gruff, commanding* |
| Kapitän | *old sea captain, raspy, confident* |
| Schmuggler | *shady harbour man, low, whispering, sly* |
| Bettler | *frail old voice, pleading* |
| Bürger arm | *ordinary worker, tired but friendly* |
| Bürger reich | *wealthy townsman, polite, slightly condescending* |

### Zeilen

**Spielerfiguren** (je Figur alle Zeilen, eigene Färbung erlaubt)

| ID | Text | Status |
|---|---|---|
| `player/perfect_a` | „Sauber!“ | offen |
| `player/perfect_b` | „Genau so.“ | offen |
| `player/miss_a` | „Mist …“ | offen |
| `player/miss_b` | „Das war nichts.“ | offen |
| `player/effort_a/b/c` | Anstrengungslaute beim Hacken/Hauen (ohne Worte) | offen |
| `player/cant_go` | „Da komme ich nicht hin.“ | offen |
| `player/full` | „Mehr kann ich nicht tragen.“ | offen |
| `player/rich` | „Das lohnt sich!“ | offen |
| `player/broke` | „Mir fehlt das Geld.“ | offen |
| `player/caught` | „Verdammt!“ | offen |
| `player/rank_up` | „Man kennt meinen Namen.“ | offen |

**Händler** (Feilschen und Markt)

| ID | Text | Status |
|---|---|---|
| `merchant/greet_a` | „Was darf's sein?“ | offen |
| `merchant/greet_b` | „Frische Ware, gute Preise!“ | offen |
| `merchant/accept_a` | „Abgemacht!“ | offen |
| `merchant/accept_b` | „Ihr seid ein harter Brocken – einverstanden.“ | offen |
| `merchant/hesitant_a` | „So nicht – aber wir sind nicht weit auseinander.“ | offen |
| `merchant/hesitant_b` | „Hm. Da müsst Ihr mir schon entgegenkommen.“ | offen |
| `merchant/offended_a` | „Haltet Ihr mich für einen Narren?“ | offen |
| `merchant/offended_b` | „Raus mit Euch!“ | offen |
| `merchant/hawk_a` | „Holz! Trockenes Holz!“ | offen |
| `merchant/hawk_b` | „Fisch, frisch aus dem Hafen!“ | offen |
| `merchant/hawk_c` | „Gewürze aus dem Süden!“ | offen |

**Wirt, Priester, Wache, Kapitän, Schmuggler**

| ID | Text | Status |
|---|---|---|
| `innkeeper/greet_a` | „Willkommen! Setzt Euch, trinkt was.“ | offen |
| `innkeeper/greet_b` | „Na, wieder durstig?“ | offen |
| `innkeeper/captain` | „Da hinten sitzt ein Kapitän, der Arbeit sucht.“ | offen |
| `priest/greet` | „Der Segen sei mit Euch.“ | offen |
| `priest/thanks` | „Eure Gabe wird nicht vergessen.“ | offen |
| `guard/halt` | „Halt! Im Namen des Rates!“ | offen |
| `guard/fine` | „Das kostet Euch.“ | offen |
| `guard/investigate` | „Man hört so einiges über Euch …“ | offen |
| `captain/hired` | „Ich bring Euer Schiff sicher heim.“ | offen |
| `captain/sail` | „Leinen los!“ | offen |
| `smuggler/greet` | „Ihr habt mich nicht gesehen. Was habt Ihr?“ | offen |
| `smuggler/deal` | „Gute Ware. Kein Wort zu niemandem.“ | offen |
| `smuggler/unknown` | „Kenn ich Euch?“ | offen |

**Bürger (Zurufe beim Vorbeigehen, abhängig vom Ansehen)**

| ID | Text | Status |
|---|---|---|
| `citizen/poor_good` | „Gott schütze Euch!“ | offen |
| `citizen/poor_bad` | „Ihr schon wieder …“ | offen |
| `citizen/rich_good` | „Ah, der ehrbare Handelsherr.“ | offen |
| `citizen/rich_bad` | „Neureiches Pack.“ | offen |
| `beggar/plea_a` | „Eine Münze, edler Herr?“ | offen |
| `beggar/plea_b` | „Habt Erbarmen …“ | offen |

**Herold und Erzähler**

| ID | Text | Status |
|---|---|---|
| `herald/fire` | „Feuer! Feuer in der Stadt!“ | offen |
| `herald/plague` | „Die Seuche! Bleibt in den Häusern!“ | offen |
| `herald/festival` | „Hört, hört! Ein Fest auf dem Marktplatz!“ | offen |
| `herald/election` | „Die Stadt hat gewählt!“ | offen |
| `narrator/intro` | Einleitung zum Spielbeginn (ca. 30 s, Text folgt mit den Einstiegsquests) | offen |
| `narrator/rank_<rang>` | je Rang ein Satz, z. B. „Aus dem Tagelöhner ist ein Krämer geworden.“ | offen |

### Liedtext `music/tavern_song` (Entwurf, für Suno „Custom Lyrics“)

```
[Strophe 1]
Wir laden Salz in Port Nyx ein, und Wolle oben in Reach,
der Wind ist kalt, das Bier ist dünn, doch Silber füllt den Beutel gleich!
[Refrain]
Hoch die Segel, Brüder, hoch, die Lia ruft uns fort,
von Kai zu Kai, von Markt zu Markt, bis heim nach New Ark Hafenort!
[Strophe 2]
Der Schultheiss zählt, der Händler lacht, der Pfaffe sammelt ein,
und wer am Zoll vorbei sich schleicht, der muss verdammt gerissen sein!
[Refrain]
```

---

## Mengen im Überblick

| Gruppe | Anzahl Dateien (mit Varianten) |
|---|---|
| Musik + Stinger | 17 + 6 |
| Atmosphären | 21 |
| Effekte | ≈ 95 |
| Oberfläche | 11 |
| Stimmen | ≈ 50 Zeilen × Rollen (Spielerfiguren 4×) ≈ 100 |
