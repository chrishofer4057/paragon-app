# Gebäude, Wirtschaft und Ansehen – Fiera vs. Patrizier

Grundlage: *Tippsammlung 2010 & Handbucherweiterung zum Patrizier II-Add-On*. Die Logik
folgt dem Original, Namen und Zahlen sind eigene. Alle Balancing-Werte stehen in
`src/sim/data/` (vor allem `balance.ts`).

## Umbenennungen

| Patrizier II | Fiera | Code |
|---|---|---|
| Hanse | Lia | `state.lia` |
| Kirche | Tempel | `systems/temple.ts`, `handlers/civic.ts` |
| Kneipe | Taverne | `systems/tavern.ts`, `handlers/tavern.ts` |
| Badhaus | Badehaus | `handlers/civic.ts` |
| Rathaus | Stadthaus | `systems/politics.ts`, `systems/contracts.ts`, `handlers/townhall.ts` |
| Darlehensgeber | Geldverleiher | `systems/lender.ts`, `handlers/lender.ts` |
| Landesfürst / Stadttor | Landesherr / Stadttor | `systems/gate.ts` |
| Bürgermeister | Schultheiss | `mayor` |
| Eldermann | Landammann | `landammann` |
| Schnigge / Kraier / Kogge / Holk | Schute / Kaag / Kogge / Nef | `data/ships.ts` |

## Öffentliche Gebäude (gehören der Stadt)

| Gebäude | Funktionen in Fiera | Original-Kapitel |
|---|---|---|
| **Markthalle** | Bestand, Preise, Verbrauch; Preise nach Angebot/Nachfrage (Ziel: 2 Wochen Vorrat) | 2.1.2.2 |
| **Taverne** | Tagelöhnerarbeit, Matrosen (aus Bettlern), Kapitäne, Informant, fliegender Händler, Nebenraum-Aufträge (Reisender, Warenkäufer) | 2.1.1.1 |
| **Gildenhaus** | Beitritt (Gebühr nach Unternehmenswert, max. 75.000, Heimatstadt billiger) – Pflicht für Fernkaufmann | 2.1.1.2 |
| **Stadthaus** | Aushang (Preisgarantie / Lieferausschreibung, Sperre bei Versäumnis), Stadtinfo mit Wahlprognose, Anträge (Kopfsteuer, Sondersteuer), Ratssitzung nach 14 Tagen, Stadtkasse, Lia-Kanzlei | 2.1.1.3 |
| **Geldverleiher** | bis zu 3 Darlehen (Wochenzins), Mahnung, Pfändung; eigene Kredite vergeben, Ausfall → pfänden oder erlassen | 2.1.1.5 |
| **Badehaus** | Baden (schützt vor Anklagen), Ratsherren bestechen (Stimmen für die nächste Wahl) | 2.1.1.6 |
| **Tempel** | Beten (schützt vor Anklagen), Spenden, Armenspeisung (Bettlerzustrom ×4,5 für einen Tag), 3 Ausbaustufen (Priester kauft Material mit Preislimit) | 2.1.1.7 |
| **Werft** | Schiffe bauen (eine nach der anderen), reparieren; Erfahrung verkürzt Bauzeit und vergrößert den Rumpf, Flaute baut ab | 2.1.1.9 |
| **Stadttor** | Landesherr: monatlich 4 nachgefragte Waren zu Spitzenpreisen (ab Ratsherr) | 2.1.1.11, 6.5.1 |
| **Marktplatz** | Fest ankündigen (21 Tage Vorlauf, Bewirtung aus dem Kontor, Gäste nach Beliebtheit) | 2.1.1.12 |
| **Marktstand** *(neu)* | Persönlicher Verkauf: +15 % Preis, begrenzte Kundschaft, kostet Zeit | CLAUDE.md §2.4 |

## Private Gebäude (gehören dem Spieler)

| Gebäude | Logik |
|---|---|
| **Kontor** | Lager (300 Einheiten), Überlauf wird automatisch gemietet (1 GS je Einheit und Tag), Grundsteuer, Wachen, Verwalter mit Daueraufträgen (täglich, Lohn 10 GS + 1 GS je Gebäude) |
| **Lagerhaus** | +200 Kapazität, Grundsteuer, erhöht Einbruchsrisiko (Wachen und Anwesenheit senken es) |
| **Betriebe** (29 Arten) | Arbeiter aus Arbeitslosen/Bettlern (brauchen Wohnraum), Rohstoffe aus dem Kontor, effektiv/ineffektiv (½ Ausstoß), Bonus ab 3/6/9 gleichen Betrieben, Winterflaute im Norden für Anbaubetriebe, Löhne + 280 GS Grundsteuer pro Woche auch im Stillstand |
| **Wohnhäuser** | Fachwerkhaus (Arme), Giebelhaus (Wohlhabende), Kaufmannshaus (Reiche); 5 Mietstufen, niedrige Mieten = etwas soziales Ansehen |
| **Infrastruktur** (gestiftet) | Brunnen (1 je 500 Einw., Brandschutz), Straßen (4 × 25 %), Spital/Kapelle (Seuchenschutz, +10 % Wachstum), Schule (+30 % Bettler), Münze (+50 % Zuwanderung Reicher) – jeweils dauerhaftes Ansehen |

### Betriebe (Wochenwerte, 100 % Auslastung)

| Betrieb | Erzeugnis | Rohstoffe | Arbeiter | Bautage | Kosten |
|---|---|---|---|---|---|
| Holzfällerei | 14 Holz | – | 30 | 10 | 3.000 |
| Steinbruch | 7 Stein | 0,1 Holz | 15 | 5 | 1.000 |
| Getreidehof | 7 Getreide | – | 30 | 10 | 3.000 |
| Fischerei | 5,25 Fisch | 14 Salz | 30 | 20 | 5.000 |
| Feenblütenwiese | 35 Feenblüte | – | 30 | 10 | 3.000 |
| Imkerei | 14 Honig | – | 30 | 20 | 3.000 |
| Weingut | 14 Wein | – | 30 | 40 | 8.000 |
| Salzsiederei | 35 Salz | 1,5 Holz | 30 | 10 | 3.000 |
| Schafzucht | 3,5 Wolle | – | 30 | 40 | 8.000 |
| Viehhof | 1,75 Fleisch + 7 Leder | 5 Salz | 30 | 40 | 5.000 |
| Töpferei | 14 Keramik | 1,4 Holz | 30 | 20 | 5.000 |
| Weberei | 21 Kleidung | 2,1 Wolle | 30 | 40 | 8.000 |
| Geistereisenmine | 3,5 Geistereisen | – | 30 | 20 | 10.000 |
| Werkstatt | 21 Werkzeug | 2,1 Geistereisen + 3,5 Holz | 30 | 40 | 8.000 |
| Ölmühle | 28 Öl | – | 30 | 20 | 5.000 |
| Seifensiederei | 21 Seife | 4,2 Öl + 3 Salz | 30 | 20 | 5.000 |
| Kräutergarten | 14 Kräuter | – | 30 | 10 | 3.000 |
| Obstgarten | 14 Früchte | – | 30 | 20 | 4.000 |
| Gewürzgarten | 14 Gewürze | – | 30 | 40 | 8.000 |
| Seidenraupenzucht | 7 Seide | 1,4 Früchte | 30 | 40 | 8.000 |
| Marmorbruch | 3,5 Marmor | 0,4 Werkzeug | 30 | 20 | 6.000 |
| Jauxitmine | 7 Jauxiterz | 0,7 Holz | 30 | 20 | 8.000 |
| Jauxitschmelze | 3,5 Jauxitbarren | 2,5 Jauxiterz + 1,5 Holz | 30 | 20 | 8.000 |
| Frostgrube | 2 Frostbisserz | 0,4 Werkzeug | 30 | 30 | 10.000 |
| Lunaritmine | 3 Lunarit | 0,4 Werkzeug | 30 | 30 | 10.000 |
| Riftschmiede | 2 Riftstahl | 2 Jauxitbarren + 1 Frostbisserz | 30 | 40 | 14.000 |
| Wildblumengarten | 3,5 Seltene Blumen | – | 30 | 20 | 6.000 |
| Essenzdestillerie | 1,4 Magische Essenz | 1 Seltene Blumen + 3,5 Feenblüte | 30 | 40 | 16.000 |
| Drachenjägerhütte | 1,4 Drachenschuppen | 0,7 Werkzeug | 30 | 30 | 12.000 |

Löhne werden aus den Basispreisen abgeleitet (Stückkosten ≈ 62 % des Basispreises), damit
Preisänderungen die Betriebe nicht versehentlich unrentabel machen – ein Test prüft das.

## Wirtschaftskreislauf

1. **Städtische Betriebe** produzieren die gelisteten Waren der Stadt (Spezialware 3-fach
   gewichtet) und verbrauchen dafür Rohstoffe vom Markt. Städte bauen keine neuen Betriebe.
2. **Bürger** verbrauchen nach Schicht (Verbrauchstabelle je 1000 Einwohner/Woche).
3. **Preise**: `basis * clamp((ziel / bestand) ^ elastizität, min, max)`, Ziel = 2 Wochen Bedarf;
   Mengengeschäfte werden Einheit für Einheit bewertet, Kauf/Verkauf mit Spanne.
4. **KI-Händler** verschieben Überschüsse träge (1–4 Tage) in Mangelstädte, damit die Welt
   ohne Spieler stabil bleibt (Test: ein Jahr ohne Spieler).
5. **Zufriedenheit** je Schicht aus der Versorgung der Waren, die diese Schicht braucht, plus
   Kopfsteuer, Wohnraum, Brunnen, Straßen, Tempel, Fest, Seuche → 6 Stufen
   (verärgert … sehr glücklich).
6. **Wachstum**: Reiche/Wohlhabende wandern zu, solange Wohnraum und Anteilsgrenzen
   (6–24 % / 15–32 %) es erlauben. **Arme sind Arbeiter**: Sie entstehen nur, wenn Betriebe
   Bettler einstellen. Bettler kommen, wenn die Armen zufrieden sind. → Wachstum braucht
   Spielerbetriebe + Wohnraum + Versorgung, genau wie im Original.
7. **Ereignisse**: Feuer (Brunnen schützen), Seuche (Straßen/Spital/Kapelle schützen),
   Einbruch, Anklagen. Anwesenheit des Spielers halbiert den Schaden.

## Ansehen und Aufstieg

- Zwei Achsen je Stadt: **sozial** (Arme) und **gesellschaftlich** (Reiche).
- Quellen: Verkäufe (knappe Waren zählen mehr), Einkäufe kosten Ansehen, Aufträge, Feste,
  Spenden, Armenspeisung, Tagelöhnerarbeit, gestiftete Infrastruktur (dauerhaft),
  Arbeitsplätze/Wohnraum/Kontor/Gilde (laufend), Unternehmenswert und Flotte (hanseweit).
- Zeitlich begrenztes Ansehen klingt täglich um 1,2 % ab – man muss dranbleiben.
- Rangprüfung am Monatsersten in der Heimatstadt, höchstens ein Aufstieg pro Monat,
  Ränge sinken nie. Hinweisbriefe, wenn nur Geld oder nur Ansehen fehlt.

| Rang | Fiera-Stufe | Unternehmenswert | sozial | gesellschaftlich | Neu freigeschaltet |
|---|---|---|---|---|---|
| Tagelöhner | 1 Tagelöhner | – | – | – | Sammeln, Tagesarbeit, an den Markt verkaufen |
| Krämer | 2 Stadthändler | 300 | 0,3 | 0,15 | freier Handel, Marktstand, Aushänge |
| Händler | 3 Frachtmieter | 3.000 | 1,5 | 1,5 | Frachtraum mieten, Kontor (Heimat), Lagerhaus |
| Kaufmann | 4 Reeder | 20.000 | 4 | 5 | Schiffe, Betriebe, Häuser, Infrastruktur, Kontore in fremden Städten |
| Fernkaufmann | 5 Patrizier | 80.000 | 5 | 10 | + Gilde der Heimatstadt nötig; Verwalter, Kapitäne |
| Ratsherr | 5 | 500.000 | 10 | 15 | Anträge im Stadtrat, Landesherr |
| Patrizier | 5 | 900.000 | 50 | 50 | Kandidatur als Schultheiss (Heimatstadt) |
| Schultheiss | gewählt | – | ~75 | ~75 | Stadtkasse, Kopfsteuer direkt, 2 Stimmen im Rat |
| Landammann | gewählt | – | ~100 hanseweit | | 2 Lia-Aufträge erfüllt, 3 Stimmen, überall antragsberechtigt |

Die frühen Schwellen sind gegenüber dem Original stark gesenkt, weil Fiera mittellos beginnt
(Simulation: alle vier Figuren werden nach ~3–4 Wochen Krämer). Ab Ratsherr gelten die
Originalwerte.

## Noch nicht umgesetzt (bewusst später)

Seekampf, Piraten, Konvois, Auslieger, Autorouten, Versteigerungen, Belagerungen,
Stadtmauer/Miliz, Mittelmeer/Amerika, Niederlassungen gründen, Piratennest-Missionen,
Ehe/Familie, Feilschen-Minispiel.
