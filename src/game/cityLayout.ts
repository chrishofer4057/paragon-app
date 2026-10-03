import type { PanelId } from '../bridge/bridge';
import type { GatherActivity } from '../sim/commands/commands';
import { CITIES, CITY_IDS, type CityDef, type CityId, type CitySize, type Culture } from '../sim/data/cities';
import { hashFloat } from '../sim/rng';

/**
 * Grundriss einer Stadt samt Umland – für jede Stadt eigen (Platzhalter für spätere Tiled-Karten).
 * Rein und deterministisch: gleiche Stadt + gleicher Besitz = gleicher Grundriss. Öffentliche
 * Gebäude und alle Bauplätze hängen NICHT vom Besitz ab; Besitz entscheidet nur, was auf den
 * Plätzen steht. So springt nichts, wenn der Spieler ein Haus baut.
 *
 * Immer: Norden oben, Stadttor am Nordrand, Hafen im Süden. Je Stadt verschieden: Größe,
 * Küstenform, Seite von Wald und Steinbruch, Lage von Tor, Marktplatz und Mole, Straßennetz,
 * Oberstadt auf einem Plateau und ein Wahrzeichen (Brunnen, Windmühle, Leuchtturm, Denkmal).
 */

/** Pixel je Kachel – nur noch für die alte 2D-Ansicht (Phaser), die 3D-Welt rechnet in Kacheln. */
export const TILE = 32;

export const CITY_SIZES: Readonly<Record<CitySize, { cols: number; rows: number }>> = {
  small: { cols: 46, rows: 36 },
  medium: { cols: 48, rows: 38 },
  large: { cols: 56, rows: 42 },
};

export type Terrain = 'grass' | 'sand' | 'road' | 'plaza' | 'water' | 'pier' | 'forest' | 'quarry' | 'meadow';

export type BuildingKind =
  | 'market'
  | 'townhall'
  | 'temple'
  | 'guild'
  | 'tavern'
  | 'bathhouse'
  | 'lender'
  | 'builder'
  | 'shipyard'
  | 'gate'
  | 'stall'
  | 'kontor'
  | 'lot'
  | 'house'
  | 'business'
  | 'fountain'
  | 'windmill'
  | 'lighthouse'
  | 'monument';

/** Wahrzeichen: reine Kulisse ohne Fenster. */
export const LANDMARK_KINDS: readonly BuildingKind[] = ['fountain', 'windmill', 'lighthouse', 'monument'];

export interface PlacedBuilding {
  id: string;
  kind: BuildingKind;
  label: string;
  /** Kachelkoordinaten der linken oberen Ecke und Größe. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Kachel vor der Tür, von der aus man das Gebäude betritt. */
  door: { x: number; y: number };
  panel: PanelId | null;
  /** Kleine Variation für die Optik (Dachfarbe, Höhe …). */
  variant: number;
}

export interface GatherSpot {
  id: string;
  activity: GatherActivity;
  x: number;
  y: number;
}

export interface Decoration {
  kind: 'tree' | 'rock' | 'flower' | 'barrel' | 'lamp' | 'crate';
  x: number;
  y: number;
  variant: number;
}

export interface CityLayout {
  cityId: CityId;
  culture: Culture;
  cols: number;
  rows: number;
  terrain: Terrain[][];
  /** Höhenstufe je Kachel (0 = Stadtniveau). Benachbarte Kacheln dürfen sich um höchstens 1 unterscheiden, um begehbar zu sein. */
  levels: number[][];
  /** Je Spalte die erste Wasserzeile (Küstenlinie). */
  shore: number[];
  /** Linke Spalte der zweispurigen Torstraße. */
  gateX: number;
  buildings: PlacedBuilding[];
  spots: GatherSpot[];
  decorations: Decoration[];
  spawn: { x: number; y: number };
  /** Liegeplätze für Schiffe im Hafen (Kachelkoordinaten). */
  berths: { x: number; y: number }[];
}

export interface LayoutExtras {
  hasKontor: boolean;
  businesses: number;
  houses: number;
}

/** Plätze für Spielerbesitz, die jede Stadt mindestens bietet. */
export const MIN_HOUSE_SLOTS = 10;
export const MIN_BUSINESS_SLOTS = 6;
const MAX_HOUSE_SLOTS = 14;
const MAX_BUSINESS_SLOTS = 8;

// --- Zufall --------------------------------------------------------------------------

/** Deterministischer Zufall je Stadt (zustandslos über hashFloat). */
class CityRand {
  private n = 0;
  constructor(private readonly key: number) {}

  next(): number {
    return hashFloat(0x51ea, this.key, this.n++);
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]!;
  }
}

// --- Gerüst --------------------------------------------------------------------------

interface Rect {
  x0: number;
  y0: number;
  x1: number; // exklusiv
  y1: number; // exklusiv
}

function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
}

type ShoreShape = 'straight' | 'bay' | 'point' | 'slant';

interface Plan {
  def: CityDef;
  culture: Culture;
  cols: number;
  rows: number;
  rand: CityRand;
  forestWest: boolean;
  forest: Rect;
  meadow: Rect;
  quarry: Rect;
  shore: number[];
  pierX: number;
  pierLen: number;
  gateX: number;
  plaza: Rect;
  crossY: number;
  plateau: Rect | null;
}

function makePlan(cityId: CityId): Plan {
  const def = CITIES[cityId];
  const { cols, rows } = CITY_SIZES[def.size];
  const rand = new CityRand(CITY_IDS.indexOf(cityId) + 1);
  const forestWest = rand.chance(0.5);

  // Küste
  const shape = rand.pick<ShoreShape>(['straight', 'bay', 'point', 'slant']);
  const base = rows - 8 - rand.int(0, 1);
  const amp = 2 + rand.next();
  const shore: number[] = [];
  for (let x = 0; x < cols; x++) {
    const t = x / (cols - 1);
    let off = 0;
    if (shape === 'bay') off = -Math.round(amp * Math.sin(Math.PI * t));
    else if (shape === 'point') off = Math.round(amp * Math.sin(Math.PI * t));
    else if (shape === 'slant') off = Math.round((forestWest ? t - 0.5 : 0.5 - t) * amp * 2);
    shore.push(Math.min(rows - 6, base + off));
  }

  const fw = rand.int(9, 11);
  const qw = rand.int(8, 9);
  const qh = rand.int(7, 8);
  const shoreMin = Math.min(...shore);
  const forest: Rect = forestWest
    ? { x0: 0, y0: 0, x1: fw, y1: shoreMin - 9 }
    : { x0: cols - fw, y0: 0, x1: cols, y1: shoreMin - 9 };
  const meadow: Rect = { x0: forest.x0, y0: forest.y1, x1: forest.x1, y1: shoreMin - 3 };
  const quarry: Rect = forestWest
    ? { x0: cols - qw, y0: 0, x1: cols, y1: qh }
    : { x0: 0, y0: 0, x1: qw, y1: qh };

  // Stadtkern zwischen Wald und Steinbruch
  const townX0 = forestWest ? forest.x1 + 1 : quarry.x1 + 1;
  const townX1 = forestWest ? quarry.x0 - 1 : forest.x0 - 1;
  const gateX = rand.int(townX0 + 4, townX1 - 6);
  const pw = def.size === 'small' ? 10 : def.size === 'medium' ? 12 : 14;
  const ph = def.size === 'small' ? 4 : 5;
  const plazaY = rand.int(Math.round(rows * 0.24), Math.round(rows * 0.32));
  const plazaX = Math.max(townX0 + 1, Math.min(townX1 - pw, gateX - Math.floor(pw / 2) + rand.int(-3, 3)));
  const plaza: Rect = { x0: plazaX, y0: plazaY, x1: plazaX + pw, y1: plazaY + ph };
  const crossY = Math.min(plaza.y1 + rand.int(5, 7), shoreMin - 9);
  const pierX = rand.int(Math.round(cols * 0.35), Math.round(cols * 0.62));
  const pierLen = rand.int(4, 5);

  // Oberstadt: ein Plateau eine Stufe höher zwischen Marktplatz und Steinbruch
  let plateau: Rect | null = null;
  if (rand.chance(0.5)) {
    plateau = forestWest
      ? { x0: plaza.x1 + 2, y0: 0, x1: quarry.x0, y1: plaza.y1 + 1 }
      : { x0: quarry.x1, y0: 0, x1: plaza.x0 - 2, y1: plaza.y1 + 1 };
    if (plateau.x1 - plateau.x0 < 6) plateau = null;
  }

  return {
    def,
    culture: def.culture,
    cols,
    rows,
    rand,
    forestWest,
    forest,
    meadow,
    quarry,
    shore,
    pierX,
    pierLen,
    gateX,
    plaza,
    crossY,
    plateau,
  };
}

// --- Gelände ---------------------------------------------------------------------------

function paintTerrain(plan: Plan): Terrain[][] {
  const { cols, rows, shore } = plan;
  const ground: Terrain = plan.culture === 'south' ? 'sand' : 'grass';
  const terrain: Terrain[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: Terrain[] = [];
    for (let x = 0; x < cols; x++) {
      let t: Terrain = ground;
      if (y >= shore[x]!) t = 'water';
      else if (y >= shore[x]! - 1) t = 'sand';
      else if (inRect(plan.forest, x, y)) t = 'forest';
      else if (inRect(plan.meadow, x, y)) t = 'meadow';
      else if (inRect(plan.quarry, x, y)) t = 'quarry';
      row.push(t);
    }
    terrain.push(row);
  }
  const set = (x: number, y: number, t: Terrain) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows && terrain[y]![x] !== 'water') terrain[y]![x] = t;
  };
  const vRoad = (x: number, y0: number, y1: number) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (const dx of [0, 1]) set(x + dx, y, 'road');
  };
  const hRoad = (y: number, x0: number, x1: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (const dy of [0, 1]) set(x, y + dy, 'road');
  };
  const { plaza, gateX, crossY, pierX } = plan;

  // Torstraße zum Marktplatz (mit Knick, falls das Tor nicht über dem Platz liegt)
  const entryX = Math.max(plaza.x0 + 1, Math.min(plaza.x1 - 3, gateX));
  const jogY = Math.max(3, plaza.y0 - 3);
  vRoad(gateX, 0, jogY);
  hRoad(jogY, gateX, entryX);
  vRoad(entryX, jogY, plaza.y0);

  // Querstraße und Straße hinunter zum Hafen
  const townEdge0 = plan.forestWest ? plan.forest.x1 - 1 : 1;
  const townEdge1 = plan.forestWest ? cols - 2 : plan.forest.x0;
  hRoad(crossY, townEdge0, townEdge1);
  const downX = Math.max(plaza.x0 + 1, Math.min(plaza.x1 - 3, pierX));
  vRoad(downX, plaza.y1, crossY);
  const promenade = (x: number) => shore[x]! - 2;
  vRoad(pierX, crossY, promenade(pierX));
  if (pierX !== downX) hRoad(crossY, downX, pierX);
  // Große Städte: zweite Längsstraße auf der anderen Seite des Platzes
  if (plan.def.size !== 'small') {
    const sideX = pierX < plaza.x0 + (plaza.x1 - plaza.x0) / 2 ? plaza.x1 + 3 : plaza.x0 - 5;
    if (sideX > 2 && sideX < cols - 4) vRoad(sideX, plaza.y0, crossY);
  }
  // Gasse von der Querstraße zur Promenade auf der Werftseite
  const laneX = plan.forestWest ? Math.round(cols * 0.78) : Math.round(cols * 0.2);
  for (let y = crossY + 2; y <= promenade(laneX); y++) set(laneX, y, 'road');

  // Hafenpromenade entlang der Küste; Sprünge der Küstenlinie werden verbunden
  for (let x = 0; x < cols; x++) {
    if (inRect(plan.meadow, x, promenade(x)) && x !== townEdge0) continue;
    const y = promenade(x);
    set(x, y, 'road');
    const prev = x > 0 ? promenade(x - 1) : y;
    for (let yy = Math.min(prev, y); yy <= Math.max(prev, y); yy++) set(x, yy, 'road');
  }
  // Marktplatz
  for (let y = plaza.y0; y < plaza.y1; y++) for (let x = plaza.x0; x < plaza.x1; x++) set(x, y, 'plaza');
  // Mole
  for (let y = shore[pierX]!; y < Math.min(rows - 1, shore[pierX]! + plan.pierLen); y++)
    for (const dx of [0, 1]) terrain[y]![pierX + dx] = 'pier';
  return terrain;
}

function paintLevels(plan: Plan, terrain: Terrain[][]): number[][] {
  const { cols, rows, rand, forest, quarry } = plan;
  const cx = forest.x0 + 2 + rand.next() * (forest.x1 - forest.x0 - 4);
  const cy = 3 + rand.next() * Math.max(1, forest.y1 - 8);
  const qCornerX = plan.forestWest ? cols : 0;
  const levels: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < cols; x++) {
      const t = terrain[y]![x]!;
      let level = 0;
      if (t === 'water') level = -1;
      else if (t === 'forest') {
        const d = Math.hypot(x - cx, (y - cy) * 0.8);
        level = d < 3 ? 2 : d < 6.5 ? 1 : 0;
      } else if (t === 'quarry') {
        // Terrassen zur äußeren Ecke hin
        const d = Math.max(Math.abs(x + 0.5 - qCornerX) / (quarry.x1 - quarry.x0), y / quarry.y1);
        level = d < 0.45 ? 2 : d < 0.75 ? 1 : 0;
      } else if (plan.plateau && inRect(plan.plateau, x, y) && t !== 'pier') level = 1;
      row.push(level);
    }
    levels.push(row);
  }
  return levels;
}

// --- Gebäude ---------------------------------------------------------------------------

interface Builder {
  plan: Plan;
  terrain: Terrain[][];
  levels: number[][];
  occupied: Uint8Array;
  /** Türkacheln und die Kachel davor bleiben frei. */
  reserved: Uint8Array;
  buildings: PlacedBuilding[];
  spawn: { x: number; y: number };
  mustReach: { x: number; y: number }[];
}

function idx(b: Builder, x: number, y: number): number {
  return y * b.plan.cols + x;
}

function inBounds(b: Builder, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.plan.cols && y < b.plan.rows;
}

function walkableTile(b: Builder, x: number, y: number): boolean {
  return inBounds(b, x, y) && b.terrain[y]![x] !== 'water' && !b.occupied[idx(b, x, y)];
}

/** Sind alle Ziele vom Startpunkt aus erreichbar (4er-Nachbarschaft, Stufen ≤ 1)? */
function allReachable(b: Builder, extra: { x: number; y: number }[]): boolean {
  const { cols, rows } = b.plan;
  const seen = new Uint8Array(cols * rows);
  const queue = [b.spawn];
  seen[idx(b, b.spawn.x, b.spawn.y)] = 1;
  while (queue.length > 0) {
    const p = queue.pop()!;
    const lv = b.levels[p.y]![p.x]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!walkableTile(b, x, y) || seen[idx(b, x, y)]) continue;
      if (Math.abs(b.levels[y]![x]! - lv) > 1) continue;
      seen[idx(b, x, y)] = 1;
      queue.push({ x, y });
    }
  }
  return [...b.mustReach, ...extra].every((t) => seen[idx(b, t.x, t.y)] === 1);
}

const BUILDABLE: ReadonlySet<Terrain> = new Set(['grass', 'sand']);

interface Candidate {
  x: number;
  y: number;
  score: number;
}

interface Request {
  id: string;
  kind: BuildingKind;
  label: string;
  w: number;
  h: number;
  panel: PanelId | null;
  /** Kleiner ist besser; `null` = Platz nicht erlaubt. */
  score: (x: number, y: number, door: { x: number; y: number }, onRoad: boolean) => number | null;
  /** Darf die Tür auch auf freiem Boden liegen statt an einer Straße? */
  allowOffRoad?: boolean;
}

function fits(b: Builder, x: number, y: number, w: number, h: number, rowHouse = false): boolean {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      if (!inBounds(b, xx, yy) || !BUILDABLE.has(b.terrain[yy]![xx]!)) return false;
      if (b.occupied[idx(b, xx, yy)] || b.reserved[idx(b, xx, yy)]) return false;
      if (b.terrain[yy]![xx] === 'sand' && yy >= b.plan.shore[xx]! - 1) return false; // Kaikante frei
    }
  // eine Kachel Abstand zu Nachbarhäusern links und rechts (Wohnhäuser dürfen Reihen bilden)
  if (rowHouse) return true;
  for (let yy = y; yy < y + h; yy++)
    for (const xx of [x - 1, x + w]) if (inBounds(b, xx, yy) && b.occupied[idx(b, xx, yy)]) return false;
  return true;
}

function occupy(b: Builder, x: number, y: number, w: number, h: number, value: 0 | 1): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) b.occupied[idx(b, xx, yy)] = value;
}

/** Bestes passendes Grundstück suchen; prüft, dass danach alles erreichbar bleibt. */
function place(b: Builder, req: Request, variant: number): PlacedBuilding | null {
  const { cols, rows } = b.plan;
  for (const offRoad of req.allowOffRoad ? [false, true] : [false]) {
    const candidates: Candidate[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const door = { x: x + Math.floor(req.w / 2), y: y + req.h };
        if (!inBounds(b, door.x, door.y) || !walkableTile(b, door.x, door.y)) continue;
        const t = b.terrain[door.y]![door.x]!;
        const onRoad = t === 'road' || t === 'plaza';
        if (!onRoad && !offRoad) continue;
        if (!fits(b, x, y, req.w, req.h, req.kind === 'house')) continue;
        const score = req.score(x, y, door, onRoad);
        if (score === null) continue;
        candidates.push({ x, y, score: score + b.plan.rand.next() * 0.5 });
      }
    candidates.sort((a, c) => a.score - c.score);
    for (const c of candidates.slice(0, 40)) {
      const door = { x: c.x + Math.floor(req.w / 2), y: c.y + req.h };
      occupy(b, c.x, c.y, req.w, req.h, 1);
      if (allReachable(b, [door])) {
        b.reserved[idx(b, door.x, door.y)] = 1;
        if (inBounds(b, door.x, door.y + 1)) b.reserved[idx(b, door.x, door.y + 1)] = 1;
        b.mustReach.push(door);
        const building: PlacedBuilding = {
          id: req.id,
          kind: req.kind,
          label: req.label,
          x: c.x,
          y: c.y,
          w: req.w,
          h: req.h,
          door,
          panel: req.panel,
          variant,
        };
        b.buildings.push(building);
        return building;
      }
      occupy(b, c.x, c.y, req.w, req.h, 0);
    }
  }
  return null;
}

function dist(a: { x: number; y: number }, x: number, y: number): number {
  return Math.hypot(a.x - x, a.y - y);
}

/** Feste Bauten, die nicht gesucht, sondern gesetzt werden (Tor, Stände, Brunnen). */
function fixed(b: Builder, building: PlacedBuilding): void {
  occupy(b, building.x, building.y, building.w, building.h, 1);
  b.buildings.push(building);
  if (building.panel) {
    b.reserved[idx(b, building.door.x, building.door.y)] = 1;
    b.mustReach.push(building.door);
  }
}

function placeBuildings(b: Builder): { houseSlots: PlacedBuilding[]; businessSlots: PlacedBuilding[] } {
  const { plan } = b;
  const { plaza, rand, cols } = plan;
  const plazaCenter = { x: (plaza.x0 + plaza.x1) / 2, y: (plaza.y0 + plaza.y1) / 2 };
  const pier = { x: plan.pierX + 1, y: plan.shore[plan.pierX]! - 2 };
  const crossMid = { x: cols / 2, y: plan.crossY };
  const v = () => Math.floor(rand.next() * 4);

  fixed(b, {
    id: 'gate',
    kind: 'gate',
    label: 'Stadttor',
    x: plan.gateX - 2,
    y: 0,
    w: 6,
    h: 2,
    door: { x: plan.gateX, y: 2 },
    panel: 'gate',
    variant: v(),
  });
  const stallY = plaza.y0;
  for (const [i, sx] of [plaza.x0 + 2, plaza.x1 - 4].entries()) {
    fixed(b, {
      id: `stall${i + 1}`,
      kind: 'stall',
      label: 'Marktstand',
      x: sx,
      y: stallY,
      w: 2,
      h: 1,
      door: { x: sx + (i === 0 ? 1 : 0), y: stallY + 1 },
      panel: 'marketplace',
      variant: v(),
    });
  }
  // Brunnen mitten auf dem Platz (kleine Städte: Ziehbrunnen)
  const fx = Math.floor(plazaCenter.x) - 1;
  const fy = plaza.y1 - 2;
  fixed(b, {
    id: 'fountain',
    kind: 'fountain',
    label: '',
    x: fx,
    y: fy,
    w: 2,
    h: 1,
    door: { x: fx, y: fy + 1 },
    panel: null,
    variant: plan.def.size === 'small' ? 1 : 0,
  });

  const nearPlaza = (_x: number, _y: number, door: { x: number; y: number }, onRoad: boolean) => {
    const d = dist(plazaCenter, door.x, door.y);
    if (b.terrain[door.y]![door.x] === 'plaza') return d - 4;
    return d < 11 ? d + (onRoad ? 0 : 3) : null;
  };
  const requests: Request[] = [
    {
      id: 'market',
      kind: 'market',
      label: 'Markthalle',
      w: 5,
      h: 4,
      panel: 'market',
      allowOffRoad: true,
      score: nearPlaza,
    },
    {
      id: 'townhall',
      kind: 'townhall',
      label: 'Stadthaus',
      w: 5,
      h: 5,
      panel: 'townhall',
      allowOffRoad: true,
      score: nearPlaza,
    },
    {
      id: 'temple',
      kind: 'temple',
      label: 'Tempel',
      w: 5,
      h: 5,
      panel: 'temple',
      allowOffRoad: true,
      // Tempel gern auf der Oberstadt
      score: (x, y, door) =>
        dist(plazaCenter, door.x, door.y) * 0.6 + (b.levels[y]![x]! > 0 ? -6 : 0) + rand.next() * 4,
    },
    {
      id: 'guild',
      kind: 'guild',
      label: 'Gildenhaus',
      w: 5,
      h: 5,
      panel: 'guild',
      allowOffRoad: true,
      score: (_x, _y, door) => dist(plazaCenter, door.x, door.y) + rand.next() * 4,
    },
    {
      id: 'shipyard',
      kind: 'shipyard',
      label: 'Werft',
      w: 6,
      h: 5,
      panel: 'shipyard',
      allowOffRoad: true,
      score: (x, _y, door) =>
        Math.abs(door.y - (plan.shore[door.x]! - 2)) * 4 - Math.abs(x + 3 - pier.x) * 0.5,
    },
    {
      id: 'tavern',
      kind: 'tavern',
      label: 'Taverne',
      w: 5,
      h: 5,
      panel: 'tavern',
      allowOffRoad: true,
      score: (_x, _y, door) => dist(pier, door.x, door.y),
    },
    {
      id: 'kontor',
      kind: 'lot',
      label: 'Bauplatz',
      w: 4,
      h: 4,
      panel: 'construction',
      allowOffRoad: true,
      score: (_x, _y, door) => dist(pier, door.x, door.y) + 3 + rand.next() * 3,
    },
    ...(
      [
        ['lender', 'Geldverleiher', 4, 4, 'lender'],
        ['bathhouse', 'Badehaus', 4, 4, 'bathhouse'],
        ['builder', 'Bauhof', 5, 4, 'construction'],
      ] as const
    ).map(([id, label, w, h, panel]): Request => ({
      id,
      kind: id,
      label,
      w,
      h,
      panel,
      allowOffRoad: true,
      score: (_x, _y, door, onRoad) =>
        dist(crossMid, door.x, door.y) * 0.5 + (onRoad ? 0 : 8) + rand.next() * 8,
    })),
  ];
  for (const req of requests) {
    if (!place(b, req, v())) throw new Error(`${plan.def.name}: kein Platz für ${req.label}`);
  }

  // Wahrzeichen nach Charakter der Stadt
  const goods = [plan.def.special, ...plan.def.regular];
  if (goods.includes('Grain') || goods.includes('Honey')) {
    place(
      b,
      {
        id: 'windmill',
        kind: 'windmill',
        label: '',
        w: 3,
        h: 3,
        panel: null,
        allowOffRoad: true,
        score: (_x, y) => y * 0.5 + rand.next() * 6,
      },
      0,
    );
  }
  if (plan.def.size === 'large' || ['Fish', 'Salt', 'Oil'].includes(plan.def.special)) placeLighthouse(b);
  if (!b.buildings.some((x) => x.kind === 'windmill' || x.kind === 'lighthouse')) {
    place(
      b,
      {
        id: 'monument',
        kind: 'monument',
        label: '',
        w: 2,
        h: 2,
        panel: null,
        allowOffRoad: true,
        score: (_x, _y, door) => dist(plazaCenter, door.x, door.y) + rand.next() * 3,
      },
      v(),
    );
  }

  // Bauplätze für Spielerbetriebe am Stadtrand, für Wohnhäuser an den Straßen
  const businessSlots: PlacedBuilding[] = [];
  const maxBusinesses = plan.def.size === 'small' ? MIN_BUSINESS_SLOTS : MAX_BUSINESS_SLOTS;
  for (let i = 0; i < maxBusinesses; i++) {
    const slot = place(
      b,
      {
        id: `business${i}`,
        kind: 'business',
        label: 'Euer Betrieb',
        w: 3,
        h: 2,
        panel: 'possessions',
        allowOffRoad: true,
        // lieber am Nordrand und an den Seiten, nicht an der Hafenfront
        score: (x, y, _door, onRoad) =>
          Math.min(y, x, cols - x) * 0.8 + (y > plan.crossY ? 20 : 0) + (onRoad ? 0 : 3) + rand.next() * 5,
      },
      i % 4,
    );
    if (!slot) break;
    businessSlots.push(slot);
  }
  const houseSlots: PlacedBuilding[] = [];
  for (let i = 0; i < MAX_HOUSE_SLOTS; i++) {
    const slot = place(
      b,
      {
        id: `house${i}`,
        kind: 'house',
        label: '',
        w: 3,
        h: 3,
        panel: null,
        allowOffRoad: true,
        score: (_x, _y, door, onRoad) =>
          dist(plazaCenter, door.x, door.y) * 0.3 + (onRoad ? 0 : 6) + rand.next() * 10,
      },
      v(),
    );
    if (!slot) break;
    houseSlots.push(slot);
  }
  // Weitere Stadthäuser füllen die Stadt; sie gehören nie dem Spieler und kommen nach allen
  // Bauplätzen, damit sie deren Lage nicht beeinflussen.
  const target = Math.round((plan.cols * plan.rows) / 75);
  for (let i = 0; i < target; i++) {
    const w = rand.chance(0.3) ? 4 : 3;
    if (
      !place(
        b,
        {
          id: `town${i}`,
          kind: 'house',
          label: '',
          w,
          h: 3,
          panel: null,
          allowOffRoad: true,
          score: (_x, _y, door, onRoad) =>
            dist(plazaCenter, door.x, door.y) * 0.25 + (onRoad ? 0 : 4) + rand.next() * 12,
        },
        v(),
      )
    )
      break;
  }
  return { houseSlots, businessSlots };
}

/** Leuchtturm auf einer kleinen Felsinsel vor der Küste, weg von Mole und Werft. */
function placeLighthouse(b: Builder): void {
  const { plan } = b;
  const shipyard = b.buildings.find((x) => x.kind === 'shipyard');
  const options = [3, plan.cols - 6];
  const lx = options
    .filter((x) => Math.abs(x - plan.pierX) > 8)
    .sort((a, c) => Math.abs(c - (shipyard?.x ?? 0)) - Math.abs(a - (shipyard?.x ?? 0)))[0];
  if (lx === undefined) return;
  const ly = plan.shore[lx]! + 1;
  if (ly + 3 >= plan.rows) return;
  for (let y = ly; y < ly + 3; y++) for (let x = lx; x < lx + 3; x++) b.terrain[y]![x] = 'quarry';
  b.buildings.push({
    id: 'lighthouse',
    kind: 'lighthouse',
    label: '',
    x: lx + 1,
    y: ly + 1,
    w: 1,
    h: 1,
    door: { x: lx + 1, y: ly + 2 },
    panel: null,
    variant: 0,
  });
}

// --- Natur, Deko, Liegeplätze -------------------------------------------------------------

function placeNature(
  plan: Plan,
  terrain: Terrain[][],
  blocked: (x: number, y: number) => boolean,
): { spots: GatherSpot[]; decorations: Decoration[] } {
  const { rand, forest, quarry, meadow } = plan;
  const spots: GatherSpot[] = [];
  const decorations: Decoration[] = [];
  let n = 0;
  const free = (x: number, y: number, allowed: Terrain[]) =>
    allowed.includes(terrain[y]?.[x] as Terrain) && !blocked(x, y);
  for (let y = forest.y0 + 1; y < forest.y1 - 1; y += 2)
    for (let x = forest.x0 + 1; x < forest.x1 - 1; x += 2) {
      const r = rand.next();
      const px = x + (r > 0.5 ? 1 : 0);
      if (!free(px, y, ['forest'])) continue;
      if (r < 0.35) spots.push({ id: `tree${n++}`, activity: 'wood', x: px, y });
      else decorations.push({ kind: 'tree', x: px, y, variant: Math.floor(r * 10) % 3 });
    }
  for (let y = quarry.y0 + 1; y < quarry.y1 - 1; y += 2)
    for (let x = quarry.x0 + 1; x < quarry.x1 - 1; x += 2) {
      if (!free(x, y, ['quarry'])) continue;
      // jede zweite Stelle sicher ein Steinbrocken, die übrigen zufällig
      if ((x + y) % 4 === 2 || rand.chance(0.4)) spots.push({ id: `rock${n++}`, activity: 'stone', x, y });
      else decorations.push({ kind: 'rock', x, y, variant: 0 });
    }
  for (let y = meadow.y0 + 1; y < meadow.y1; y += 2)
    for (let x = meadow.x0 + 1; x < meadow.x1 - 1; x += 2) {
      if (!free(x, y, ['meadow'])) continue;
      spots.push({ id: `flower${n++}`, activity: rand.chance(0.5) ? 'herbs' : 'faerybloom', x, y });
    }
  const pierEnd = Math.min(plan.rows - 2, plan.shore[plan.pierX]! + plan.pierLen - 1);
  spots.push({ id: 'fishing', activity: 'fish', x: plan.pierX + 1, y: pierEnd });
  spots.push({ id: 'fishing2', activity: 'fish', x: plan.pierX, y: pierEnd });
  return { spots, decorations };
}

function decorate(
  plan: Plan,
  terrain: Terrain[][],
  blocked: (x: number, y: number) => boolean,
): Decoration[] {
  const { rand, plaza, cols, rows, shore } = plan;
  const out: Decoration[] = [];
  const groundAt = (x: number, y: number) => {
    const t = terrain[y]?.[x];
    return (t === 'grass' || t === 'sand') && !blocked(x, y);
  };
  // Laternen an den Ecken des Platzes und entlang der Promenade
  for (const [x, y] of [
    [plaza.x0, plaza.y0],
    [plaza.x1 - 1, plaza.y0],
    [plaza.x0, plaza.y1 - 1],
    [plaza.x1 - 1, plaza.y1 - 1],
  ] as const)
    if (!blocked(x, y)) out.push({ kind: 'lamp', x, y, variant: 0 });
  for (let x = 3; x < cols - 2; x += 7) {
    const y = shore[x]! - 1;
    if (terrain[y]?.[x] === 'sand' && !blocked(x, y)) out.push({ kind: 'lamp', x, y, variant: 0 });
  }
  // Fässer und Kisten am Kai
  for (let x = 2; x < cols - 2; x += 4) {
    const y = shore[x]! - 1;
    if (terrain[y]?.[x] === 'sand' && !blocked(x, y) && rand.chance(0.5))
      out.push({ kind: rand.chance(0.5) ? 'barrel' : 'crate', x, y, variant: 0 });
  }
  // Bäume und Blumen auf freiem Boden (nicht auf Straßen)
  for (let i = 0; i < Math.round((cols * rows) / 60); i++) {
    const x = rand.int(1, cols - 2);
    const y = rand.int(1, rows - 2);
    if (!groundAt(x, y) || y >= shore[x]! - 1) continue;
    out.push({ kind: rand.chance(0.45) ? 'tree' : 'flower', x, y, variant: i % 3 });
  }
  return out;
}

function findBerths(plan: Plan, terrain: Terrain[][]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const off of [4, -3, 8, -7, 12, -11, 16, -15]) {
    const x = plan.pierX + off;
    if (x < 3 || x > plan.cols - 4) continue;
    const y = plan.shore[x]! + 2 + (out.length % 2);
    if (y >= plan.rows - 1) continue;
    let ok = true;
    for (let dx = -2; dx <= 2; dx++)
      for (const yy of [y, y - 1, y + 1]) if (terrain[yy]?.[x + dx] !== 'water') ok = false;
    if (ok) out.push({ x, y });
    if (out.length === 5) break;
  }
  return out;
}

// --- Einstieg ---------------------------------------------------------------------------

const layoutCache = new Map<
  CityId,
  Omit<CityLayout, 'buildings'> & {
    buildings: PlacedBuilding[];
    houseSlots: PlacedBuilding[];
    businessSlots: PlacedBuilding[];
    kontorSlot: PlacedBuilding;
  }
>();

function baseLayout(cityId: CityId) {
  const cached = layoutCache.get(cityId);
  if (cached) return cached;
  const plan = makePlan(cityId);
  const terrain = paintTerrain(plan);
  const levels = paintLevels(plan, terrain);
  const spawn = { x: Math.floor((plan.plaza.x0 + plan.plaza.x1) / 2), y: plan.plaza.y1 - 1 };
  const b: Builder = {
    plan,
    terrain,
    levels,
    occupied: new Uint8Array(plan.cols * plan.rows),
    reserved: new Uint8Array(plan.cols * plan.rows),
    buildings: [],
    spawn,
    mustReach: [],
  };
  // Startpunkt und Wege zu Wald, Steinbruch, Wiese und Mole freihalten
  b.reserved[idx(b, spawn.x, spawn.y)] = 1;
  const { houseSlots, businessSlots } = placeBuildings(b);
  const buildingAt = (x: number, y: number) => b.occupied[idx(b, x, y)] === 1;
  const nature = placeNature(plan, terrain, buildingAt);
  const decorations = [...nature.decorations, ...decorate(plan, terrain, buildingAt)];
  const kontorSlot = b.buildings.find((x) => x.id === 'kontor')!;
  const result = {
    cityId,
    culture: plan.culture,
    cols: plan.cols,
    rows: plan.rows,
    terrain,
    levels,
    shore: plan.shore,
    gateX: plan.gateX,
    buildings: b.buildings.filter(
      (x) => !x.id.startsWith('house') && !x.id.startsWith('business') && x.id !== 'kontor',
    ),
    houseSlots,
    businessSlots,
    kontorSlot,
    spots: nature.spots,
    decorations,
    spawn,
    berths: findBerths(plan, terrain),
  };
  layoutCache.set(cityId, result);
  return result;
}

export function buildCityLayout(cityId: CityId, _culture: Culture, extras: LayoutExtras): CityLayout {
  const base = baseLayout(cityId);
  const buildings: PlacedBuilding[] = base.buildings.map((b) => ({ ...b, door: { ...b.door } }));
  const k = base.kontorSlot;
  buildings.push(
    extras.hasKontor
      ? { ...k, kind: 'kontor', label: 'Euer Kontor', panel: 'kontor', door: { ...k.door } }
      : { ...k, door: { ...k.door } },
  );
  // Spielerhäuser zuerst, die übrigen Plätze sind Stadthäuser (manche bleiben frei)
  base.houseSlots.forEach((slot, i) => {
    const own = i < extras.houses;
    if (!own && hashFloat(0x40, CITY_IDS.indexOf(cityId), i) < 0.2) return;
    buildings.push({
      ...slot,
      door: { ...slot.door },
      label: own ? 'Euer Wohnhaus' : '',
      panel: own ? 'possessions' : null,
    });
  });
  base.businessSlots
    .slice(0, extras.businesses)
    .forEach((slot) => buildings.push({ ...slot, door: { ...slot.door } }));
  const blocked = new Set<string>();
  for (const b of buildings)
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) blocked.add(`${x},${y}`);
  return {
    cityId,
    culture: base.culture,
    cols: base.cols,
    rows: base.rows,
    terrain: base.terrain.map((row) => row.slice()),
    levels: base.levels.map((row) => row.slice()),
    shore: base.shore.slice(),
    gateX: base.gateX,
    buildings,
    spots: base.spots.filter((s) => !blocked.has(`${s.x},${s.y}`)),
    decorations: base.decorations.filter((d) => !blocked.has(`${d.x},${d.y}`)),
    spawn: { ...base.spawn },
    berths: base.berths.map((p) => ({ ...p })),
  };
}

/** Wie viele Plätze bietet die Stadt für Spielerhäuser und -betriebe? */
export function slotCounts(cityId: CityId): { houses: number; businesses: number } {
  const base = baseLayout(cityId);
  return { houses: base.houseSlots.length, businesses: base.businessSlots.length };
}

/** Kann man diese Kachel betreten (kein Wasser, kein Gebäude)? Ein leerer Bauplatz ist begehbar. */
export function isWalkable(layout: CityLayout, x: number, y: number): boolean {
  const t = layout.terrain[y]?.[x];
  if (t === undefined || t === 'water') return false;
  return !layout.buildings.some(
    (b) => b.kind !== 'lot' && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h,
  );
}

export function levelAt(layout: CityLayout, x: number, y: number): number {
  return layout.levels[y]?.[x] ?? 0;
}

/** Höchste Stufe der Grundfläche eines Gebäudes. */
export function footprintLevel(layout: CityLayout, b: PlacedBuilding): number {
  let level = 0;
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) level = Math.max(level, levelAt(layout, x, y));
  return level;
}
