import * as THREE from 'three';
import type { Culture } from '../../../sim/data/cities';
import type { PlacedBuilding } from '../../cityLayout';
import { modelLibrary } from '../modelLibrary';
import {
  GOLD,
  isSnowy,
  SNOW,
  lanternMaterial,
  mat,
  PALETTE,
  WOOD,
  WOOD_DARK,
  windowMaterial,
  type Palette,
} from '../materials';
import { box, cone, crenellations, cylinder, dome, flag, gableRoof, gableWall, sphere } from './shapes';

/**
 * Prozedurale Gebäude (PLATZHALTER). Vorderseite zeigt nach +z (Süden), dort liegt die Tür.
 * Die Gruppe steht mittig auf der Grundfläche, Unterkante y = 0.
 * Norden: Fachwerk mit Überhang und steilem Dach. Süden: weißer Putz, blaue Kuppeln.
 */

type Face = 'front' | 'back' | 'left' | 'right';
const FACES: readonly Face[] = ['front', 'back', 'left', 'right'];

function faceWidth(face: Face, w: number, d: number): number {
  return face === 'front' || face === 'back' ? w : d;
}

/** Setzt ein Objekt auf eine Wandseite; `u` läuft entlang der Wand, `y` ist die Höhe. */
function onFace(
  obj: THREE.Object3D,
  face: Face,
  w: number,
  d: number,
  u: number,
  y: number,
  out = 0.02,
): THREE.Object3D {
  switch (face) {
    case 'front':
      obj.position.set(u, y, d / 2 + out);
      obj.rotation.y = 0;
      break;
    case 'back':
      obj.position.set(-u, y, -d / 2 - out);
      obj.rotation.y = Math.PI;
      break;
    case 'right':
      obj.position.set(w / 2 + out, y, -u);
      obj.rotation.y = Math.PI / 2;
      break;
    case 'left':
      obj.position.set(-w / 2 - out, y, u);
      obj.rotation.y = -Math.PI / 2;
      break;
  }
  return obj;
}

function windowAt(culture: Culture, pal: Palette): THREE.Group {
  const g = new THREE.Group();
  const frame = box(0.3, 0.36, 0.03, culture === 'north' ? pal.timber : pal.trim);
  g.add(frame);
  const glass = box(0.22, 0.28, 0.03, windowMaterial);
  glass.position.set(0, 0.04, 0.01);
  g.add(glass);
  if (culture === 'south') {
    const arch = cylinder(0.15, 0.15, 0.03, pal.trim, 8);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(0, 0.36, 0);
    arch.scale.set(1, 1, 0.6);
    g.add(arch);
  } else {
    const sill = box(0.36, 0.04, 0.08, pal.timber);
    g.add(sill);
  }
  return g;
}

function doorAt(culture: Culture, pal: Palette, width = 0.36, height = 0.6): THREE.Group {
  const g = new THREE.Group();
  g.add(box(width + 0.08, height + 0.06, 0.03, culture === 'north' ? pal.timber : pal.trim));
  const leaf = box(width, height, 0.04, culture === 'north' ? WOOD : 0x3566b0);
  leaf.position.z = 0.01;
  g.add(leaf);
  return g;
}

/** Fenster auf allen Seiten einer Wand, Tür vorn in der Mitte. */
function decorateWalls(
  group: THREE.Group,
  w: number,
  d: number,
  y0: number,
  h: number,
  culture: Culture,
  pal: Palette,
  door: boolean,
): void {
  for (const face of FACES) {
    const fw = faceWidth(face, w, d);
    const count = Math.max(1, Math.floor((fw - 0.3) / 0.7));
    for (let i = 0; i < count; i++) {
      const u = -fw / 2 + (fw / (count + 1)) * (i + 1);
      if (door && face === 'front' && Math.abs(u) < 0.35) continue;
      group.add(onFace(windowAt(culture, pal), face, w, d, u, y0 + h * 0.4));
    }
  }
  if (door) group.add(onFace(doorAt(culture, pal), 'front', w, d, 0, y0, 0.01));
}

/** Fachwerk: Eckpfosten, Schwelle/Rähm, Zwischenpfosten und Streben auf jeder Seite. */
function timberFrame(group: THREE.Group, w: number, d: number, y0: number, h: number, pal: Palette): void {
  const t = 0.07;
  for (const face of FACES) {
    const fw = faceWidth(face, w, d);
    for (const yy of [y0, y0 + h - t]) {
      group.add(onFace(beam(fw + 0.02, t, 0.04), face, w, d, 0, yy, 0.015));
    }
    const posts = Math.max(2, Math.round(fw / 0.75) + 1);
    for (let i = 0; i < posts; i++) {
      const u = -fw / 2 + t / 2 + (i * (fw - t)) / (posts - 1);
      group.add(onFace(beam(t, h, 0.04), face, w, d, u, y0, 0.015));
    }
    // Streben in den äußeren Feldern
    const span = (fw - t) / (posts - 1);
    const len = Math.hypot(span, h - t);
    const angle = Math.atan2(span, h - t);
    for (const side of [-1, 1]) {
      const brace = beam(0.05, len, 0.035);
      onFace(brace, face, w, d, side * (fw / 2 - t / 2), y0 + t / 2, 0.012);
      brace.rotation.z = side * angle;
      group.add(brace);
    }
  }
  function beam(bw: number, bh: number, bd: number): THREE.Mesh {
    return box(bw, bh, bd, pal.timber);
  }
}

/** Satteldach mit dunkleren Ziegelreihen (First entlang x, wie `gableRoof`). */
function tiledRoof(w: number, d: number, h: number, baseColor: number): THREE.Group {
  const g = new THREE.Group();
  // Im Winter liegt Schnee: Dach fast weiß, Ziegelreihen schimmern durch
  const color = isSnowy() ? new THREE.Color(baseColor).lerp(new THREE.Color(SNOW), 0.62).getHex() : baseColor;
  g.add(gableRoof(w, d, h, color));
  const dark = isSnowy()
    ? new THREE.Color(baseColor).lerp(new THREE.Color(SNOW), 0.2).getHex()
    : new THREE.Color(color).multiplyScalar(0.78).getHex();
  const angle = Math.atan2(h, d / 2);
  for (const side of [-1, 1]) {
    for (const f of [0.08, 0.32, 0.56, 0.8]) {
      const strip = box(w + 0.02, 0.035, 0.07, dark);
      strip.position.set(0, h * f, side * (d / 2) * (1 - f));
      strip.rotation.x = side * angle;
      g.add(strip);
    }
  }
  const ridge = box(w + 0.04, 0.07, 0.1, dark);
  ridge.position.y = h - 0.04;
  g.add(ridge);
  return g;
}

const ROOF_DECKS = [0xeadcc0, 0xd8b28a, 0xe4d6bc, 0xcdbf9f] as const;

// --- Wohnhäuser --------------------------------------------------------------

/** Nordisches Fachwerkhaus. Gibt die Oberkante des Daches zurück. */
function northHouse(
  group: THREE.Group,
  w: number,
  d: number,
  variant: number,
  pal: Palette,
  door = true,
): number {
  const plinth = box(w, 0.22, d, pal.stone);
  group.add(plinth);
  const f1h = 0.8;
  const f1 = box(w - 0.08, f1h, d - 0.08, pal.wall);
  f1.position.y = 0.22;
  group.add(f1);
  timberFrame(group, w - 0.08, d - 0.08, 0.22, f1h, pal);
  decorateWalls(group, w - 0.08, d - 0.08, 0.22, f1h, 'north', pal, door);
  // Obergeschoss mit Überhang
  const y2 = 0.22 + f1h;
  const f2h = 0.75;
  const w2 = w + 0.06;
  const d2 = d + 0.06;
  const f2 = box(w2, f2h, d2, pal.wall);
  f2.position.y = y2;
  group.add(f2);
  timberFrame(group, w2, d2, y2, f2h, pal);
  decorateWalls(group, w2, d2, y2, f2h, 'north', pal, false);

  const roofY = y2 + f2h;
  const roofH = 1.05 + (variant % 3) * 0.15;
  const roofColor = pal.roofs[variant % pal.roofs.length]!;
  const gableFront = variant % 2 === 0;
  const roof = gableFront
    ? tiledRoof(d2 + 0.3, w2 + 0.22, roofH, roofColor)
    : tiledRoof(w2 + 0.3, d2 + 0.22, roofH, roofColor);
  if (gableFront) roof.rotation.y = Math.PI / 2;
  roof.position.y = roofY;
  group.add(roof);
  // Giebeldreiecke in Wandfarbe mit Rundfenster
  for (const side of [-1, 1]) {
    const gw = gableFront
      ? gableWall(w2, roofH * 0.92, 0.06, pal.wall)
      : gableWall(d2, roofH * 0.92, 0.06, pal.wall);
    if (gableFront) {
      gw.rotation.y = -Math.PI / 2;
      gw.position.set(0, roofY, (side * d2) / 2);
    } else {
      gw.position.set((side * w2) / 2, roofY, 0);
    }
    group.add(gw);
    const round = cylinder(0.12, 0.12, 0.05, windowMaterial, 8);
    round.rotation.x = Math.PI / 2;
    if (gableFront) {
      round.position.set(0, roofY + roofH * 0.35, side * (d2 / 2 + 0.04));
    } else {
      round.rotation.z = Math.PI / 2;
      round.rotation.x = 0;
      round.position.set(side * (w2 / 2 + 0.04), roofY + roofH * 0.35, 0);
    }
    group.add(round);
  }
  // Schornstein
  const chimney = box(0.25, roofH + 0.35, 0.25, pal.stone);
  chimney.position.set(w2 / 2 - 0.35, roofY, -d2 / 4);
  group.add(chimney);
  group.userData['chimney'] = new THREE.Vector3(w2 / 2 - 0.35, roofY + roofH + 0.4, -d2 / 4);
  return roofY + roofH;
}

/** Südliches Haus: weißer Kubus, blaue Zierbänder, Dachterrasse oder Kuppel. */
function southHouse(
  group: THREE.Group,
  w: number,
  d: number,
  variant: number,
  pal: Palette,
  door = true,
): number {
  const h = 1.5 + (variant % 2) * 0.45;
  group.add(box(w, h, d, pal.wall));
  const band = box(w + 0.04, 0.1, d + 0.04, pal.trim);
  band.position.y = h - 0.22;
  group.add(band);
  const rim = crenellations(w, d, 0.14, pal.wall);
  rim.position.y = h;
  group.add(rim);
  const deck = box(w - 0.2, 0.02, d - 0.2, ROOF_DECKS[variant % ROOF_DECKS.length]!);
  deck.position.y = h;
  group.add(deck);
  decorateWalls(group, w, d, 0, h * 0.9, 'south', pal, door);
  let top = h;
  switch (variant % 4) {
    case 0: {
      const drum = cylinder(0.45, 0.45, 0.25, pal.wall, 12);
      drum.position.y = h;
      group.add(drum);
      const cap = dome(0.47, pal.roofs[0]!);
      cap.position.y = h + 0.25;
      group.add(cap);
      const tip = sphere(0.06, GOLD);
      tip.position.y = h + 0.78;
      group.add(tip);
      top = h + 0.8;
      break;
    }
    case 1: {
      // Dachterrasse mit Sonnensegel
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const post = cylinder(0.03, 0.03, 0.6, WOOD, 5);
        post.position.set(w * 0.05 + (x * w * 0.4) / 2, h, d * 0.05 + (z * d * 0.4) / 2);
        group.add(post);
      }
      const stripes = variant % 8 === 1 ? [0xc9663f, 0xfbf5e8] : [pal.trim, 0xfbf5e8];
      for (let i = 0; i < 5; i++) {
        const s = box((w * 0.45) / 5, 0.03, d * 0.45, stripes[i % 2]!);
        s.position.set(w * 0.05 - w * 0.225 + ((i + 0.5) * w * 0.45) / 5, h + 0.6, d * 0.05);
        group.add(s);
      }
      const table = cylinder(0.15, 0.15, 0.25, WOOD, 8);
      table.position.set(w * 0.05, h, d * 0.05);
      group.add(table);
      top = h + 0.65;
      break;
    }
    case 2: {
      const upper = box(w * 0.55, 0.8, d * 0.55, pal.wall);
      upper.position.set(-w * 0.15, h, -d * 0.15);
      group.add(upper);
      const cap = dome(Math.min(w, d) * 0.22, pal.roofs[1]!);
      cap.position.set(-w * 0.15, h + 0.8, -d * 0.15);
      group.add(cap);
      top = h + 0.8 + Math.min(w, d) * 0.22;
      break;
    }
    default: {
      for (let i = 0; i < 3; i++) {
        const pot = cylinder(0.08, 0.06, 0.12, 0xb5653a, 6);
        pot.position.set(-w / 3 + (i * w) / 3, h, d / 2 - 0.25);
        group.add(pot);
        const bush = sphere(0.13, pal.foliage);
        bush.position.set(-w / 3 + (i * w) / 3, h + 0.2, d / 2 - 0.25);
        group.add(bush);
      }
    }
  }
  return top;
}

function house(
  group: THREE.Group,
  w: number,
  d: number,
  variant: number,
  culture: Culture,
  door = true,
): number {
  return culture === 'north'
    ? northHouse(group, w, d, variant, PALETTE.north, door)
    : southHouse(group, w, d, variant, PALETTE.south, door);
}

// --- Einzelne Gebäudearten ---------------------------------------------------

function towerTop(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  r: number,
  culture: Culture,
  pal: Palette,
): number {
  if (culture === 'north') {
    const spire = cone(r * 1.25, r * 3.2, pal.roofs[1]!, 8);
    spire.position.set(x, y, z);
    group.add(spire);
    const tip = sphere(0.06, GOLD);
    tip.position.set(x, y + r * 3.2, z);
    group.add(tip);
    return y + r * 3.2;
  }
  const cap = dome(r * 1.1, pal.roofs[0]!);
  cap.position.set(x, y, z);
  group.add(cap);
  const spire = cone(0.06, r * 1.4, GOLD, 6);
  spire.position.set(x, y + r * 1.0, z);
  group.add(spire);
  return y + r * 2.4;
}

function roundTower(
  group: THREE.Group,
  x: number,
  z: number,
  r: number,
  h: number,
  culture: Culture,
  pal: Palette,
): void {
  const t = cylinder(r, r * 1.05, h, culture === 'north' ? pal.stone : pal.wall, 10);
  t.position.set(x, 0, z);
  group.add(t);
  for (let i = 0; i < 2; i++) {
    const win = box(0.14, 0.22, 0.03, windowMaterial);
    win.position.set(x, h * (0.45 + i * 0.3), z + r + 0.005);
    group.add(win);
  }
  towerTop(group, x, h, z, r, culture, pal);
}

function market(group: THREE.Group, w: number, d: number, culture: Culture, pal: Palette): void {
  const h = 1.5;
  group.add(box(w, 0.15, d, pal.stone));
  const cols = 4;
  for (let i = 0; i < cols; i++) {
    for (const z of [-1, 1]) {
      const x = -w / 2 + 0.2 + (i * (w - 0.4)) / (cols - 1);
      const post =
        culture === 'north' ? box(0.16, h, 0.16, pal.timber) : cylinder(0.11, 0.13, h, pal.wall, 8);
      post.position.set(x, 0.15, (z * (d - 0.4)) / 2);
      group.add(post);
    }
  }
  if (culture === 'north') {
    const roof = tiledRoof(w + 0.4, d + 0.3, 1.3, pal.roofs[0]!);
    roof.position.y = 0.15 + h;
    group.add(roof);
  } else {
    const slab = box(w + 0.2, 0.18, d + 0.2, pal.wall);
    slab.position.y = 0.15 + h;
    group.add(slab);
    const band = box(w + 0.24, 0.08, d + 0.24, pal.trim);
    band.position.y = 0.15 + h + 0.05;
    group.add(band);
    for (const x of [-w / 4, w / 4]) {
      const cap = dome(0.55, pal.roofs[x < 0 ? 0 : 1]!);
      cap.position.set(x, 0.15 + h + 0.18, 0);
      group.add(cap);
    }
  }
  // Waren unter dem Dach
  const goods = [0xc28a3c, 0x7a9c3e, 0xa33b2b, 0xdcc48e, 0x5b7fa6];
  for (let i = 0; i < 7; i++) {
    const crate = i % 2 ? cylinder(0.14, 0.14, 0.3, WOOD, 8) : box(0.3, 0.26, 0.3, goods[i % goods.length]!);
    crate.position.set(-w / 2 + 0.6 + ((i * 0.53) % (w - 1.2)), 0.15, -d / 4 + (i % 3) * 0.45);
    group.add(crate);
  }
}

function stall(
  group: THREE.Group,
  w: number,
  d: number,
  variant: number,
  culture: Culture,
  pal: Palette,
): void {
  const table = box(w - 0.3, 0.35, d - 0.25, WOOD);
  group.add(table);
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const post = cylinder(0.03, 0.03, 1.05, WOOD_DARK, 5);
    post.position.set((x * (w - 0.3)) / 2, 0, (z * (d - 0.2)) / 2);
    group.add(post);
  }
  const stripes = culture === 'north' ? [0xa2432f, 0xf3e6cc] : [0x2f6fc4, 0xfbf5e8];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const s = box((w - 0.1) / n, 0.04, d + 0.1, stripes[(i + variant) % 2]!);
    s.position.set(-w / 2 + 0.05 + ((i + 0.5) * (w - 0.1)) / n, 1.05, 0);
    s.rotation.x = -0.18;
    group.add(s);
  }
  const goods = [0xd8a03a, 0x8db04a, 0xb8422e, 0xe9d7a8];
  for (let i = 0; i < 5; i++) {
    const g = sphere(0.08, goods[(i + variant) % goods.length]!);
    g.position.set(-w / 2 + 0.45 + i * ((w - 0.9) / 4), 0.43, 0);
    group.add(g);
  }
  void pal;
}

function gate(group: THREE.Group, w: number, d: number, culture: Culture, pal: Palette): void {
  const wallColor = culture === 'north' ? pal.stone : pal.wall;
  const wallH = 1.8;
  // Mauer links und rechts der Durchfahrt (Straße liegt in der Mitte)
  for (const side of [-1, 1]) {
    const seg = box(w / 2 - 0.7, wallH, d * 0.6, wallColor);
    seg.position.set(side * (w / 4 + 0.35), 0, 0);
    group.add(seg);
    const cren = crenellations(w / 2 - 0.7, d * 0.6, 0.18, wallColor);
    cren.position.set(side * (w / 4 + 0.35), wallH, 0);
    group.add(cren);
  }
  // Torbogen
  for (const side of [-1, 1]) {
    const pier = box(0.35, wallH + 0.6, d * 0.8, wallColor);
    pier.position.set(side * 0.85, 0, 0);
    group.add(pier);
  }
  const lintel = box(2.05, 0.5, d * 0.8, wallColor);
  lintel.position.set(0, wallH + 0.1, 0);
  group.add(lintel);
  const arch = cylinder(0.68, 0.68, d * 0.82, wallColor, 12);
  arch.rotation.x = Math.PI / 2;
  arch.position.set(0, wallH - 0.1, 0);
  arch.scale.set(1, 1, 0.5);
  group.add(arch);
  const portcullis = box(1.3, 0.12, 0.05, WOOD_DARK);
  portcullis.position.set(0, wallH - 0.25, d * 0.41);
  group.add(portcullis);
  for (const side of [-1, 1]) roundTower(group, side * (w / 2 - 0.45), 0, 0.5, 2.6, culture, pal);
  const banner = flag(0.9, culture === 'north' ? 0xa2432f : pal.trim);
  banner.position.set(0, wallH + 0.6, 0);
  group.add(banner);
}

function shipyard(group: THREE.Group, w: number, d: number, culture: Culture, pal: Palette): void {
  // Schuppen hinten links
  const shed = new THREE.Group();
  house(shed, 2, 1.6, 1, culture, false);
  shed.position.set(-w / 2 + 1.1, 0, -d / 2 + 0.9);
  shed.scale.setScalar(0.85);
  group.add(shed);
  // Helling: Rampe zum Wasser mit Schiffsgerippe
  const ramp = box(1.6, 0.12, d, WOOD);
  ramp.position.set(w / 4, 0, 0.2);
  group.add(ramp);
  const keel = box(0.12, 0.15, d * 0.75, WOOD_DARK);
  keel.position.set(w / 4, 0.12, 0.3);
  group.add(keel);
  for (let i = 0; i < 6; i++) {
    const z = -d * 0.3 + i * (d * 0.13);
    const r = 0.65 - Math.abs(i - 2.5) * 0.08;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 4, 10, Math.PI), mat(WOOD_DARK));
    rib.castShadow = true;
    rib.rotation.z = Math.PI;
    rib.position.set(w / 4, 0.12 + r, z + 0.3);
    group.add(rib);
  }
  // Kran
  const mast = box(0.14, 2.6, 0.14, WOOD_DARK);
  mast.position.set(-0.2, 0, d / 2 - 0.6);
  group.add(mast);
  const boom = box(1.9, 0.1, 0.1, WOOD_DARK);
  boom.position.set(0.6, 2.4, d / 2 - 0.6);
  group.add(boom);
  const logs = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const log = cylinder(0.09, 0.09, 1.3, WOOD, 6);
    log.rotation.z = Math.PI / 2;
    log.position.set(0.65, 0.09 + (i > 2 ? 0.17 : 0), (i % 3) * 0.19);
    logs.add(log);
  }
  logs.position.set(-w / 2 + 0.6, 0, d / 2 - 1.2);
  group.add(logs);
  void pal;
}

function builderYard(group: THREE.Group, w: number, d: number, culture: Culture, pal: Palette): void {
  const shed = new THREE.Group();
  house(shed, w * 0.5, d * 0.6, 3, culture);
  shed.position.set(-w * 0.2, 0, -d * 0.15);
  group.add(shed);
  // Gerüst
  for (let i = 0; i < 3; i++) {
    for (const z of [0, 0.5]) {
      const pole = cylinder(0.03, 0.03, 2, WOOD, 4);
      pole.position.set(w * 0.15 + i * 0.5, 0, -d * 0.2 + z);
      group.add(pole);
    }
  }
  for (const y of [0.7, 1.4]) {
    const plank = box(1.2, 0.04, 0.6, WOOD);
    plank.position.set(w * 0.15 + 0.5, y, -d * 0.2 + 0.25);
    group.add(plank);
  }
  // Steine und Balken
  for (let i = 0; i < 4; i++) {
    const s = box(0.3, 0.2, 0.25, pal.stone);
    s.position.set(w * 0.3, i * 0.2, d * 0.3);
    s.rotation.y = i * 0.3;
    group.add(s);
  }
}

function lot(group: THREE.Group, w: number, d: number): void {
  const dirt = box(w - 0.2, 0.04, d - 0.2, 0x9b7b55);
  group.add(dirt);
  const posts = 6;
  for (let i = 0; i < posts; i++) {
    for (const z of [-1, 1]) {
      const p = box(0.07, 0.4, 0.07, WOOD);
      p.position.set(-w / 2 + 0.15 + (i * (w - 0.3)) / (posts - 1), 0, (z * (d - 0.3)) / 2);
      group.add(p);
    }
  }
  for (const z of [-1, 1]) {
    const rail = box(w - 0.3, 0.05, 0.04, WOOD);
    rail.position.set(0, 0.28, (z * (d - 0.3)) / 2);
    group.add(rail);
  }
  const sign = box(0.6, 0.35, 0.04, 0xe9d6ae);
  sign.position.set(0, 0.45, d / 2 - 0.1);
  group.add(sign);
  const pole = box(0.06, 0.5, 0.06, WOOD);
  pole.position.set(0, 0, d / 2 - 0.12);
  group.add(pole);
  for (let i = 0; i < 3; i++) {
    const stake = cylinder(0.02, 0.02, 0.3, 0xf0e0b0, 4);
    stake.position.set(-0.8 + i * 0.8, 0, -0.3);
    group.add(stake);
  }
}

/** Hängeschild am Haus. */
function sign(group: THREE.Group, x: number, y: number, z: number, color: number): void {
  const arm = box(0.5, 0.05, 0.05, WOOD_DARK);
  arm.position.set(x + 0.25, y, z);
  group.add(arm);
  const board = box(0.34, 0.28, 0.04, color);
  board.position.set(x + 0.38, y - 0.32, z);
  group.add(board);
}

function lantern(group: THREE.Group, x: number, y: number, z: number): void {
  const l = box(0.12, 0.16, 0.12, lanternMaterial);
  l.position.set(x, y, z);
  group.add(l);
}

export interface BuildingModel {
  group: THREE.Group;
  /** Punkte (lokal), an denen Rauch aufsteigt. */
  smoke: THREE.Vector3[];
  height: number;
  /** Bewegliche Teile (lokal positioniert), die nicht mit der statischen Welt verschmolzen werden. */
  spinners: THREE.Object3D[];
  /** Lichtquellen (lokal), z. B. das Leuchtfeuer. */
  lights: THREE.Vector3[];
}

// --- Wahrzeichen ---------------------------------------------------------------

function fountain(group: THREE.Group, w: number, culture: Culture, pal: Palette, small: boolean): void {
  const stone = culture === 'north' ? pal.stone : 0xe8dcc0;
  if (small) {
    // Ziehbrunnen mit Dach
    group.add(cylinder(0.42, 0.45, 0.45, stone, 10));
    const water = cylinder(0.34, 0.34, 0.02, mat(0x3a8fc0, { opacity: 0.85 }), 10);
    water.position.y = 0.35;
    group.add(water);
    for (const side of [-1, 1]) {
      const post = box(0.07, 1.1, 0.07, WOOD_DARK);
      post.position.set(side * 0.38, 0.3, 0);
      group.add(post);
    }
    const roof = gableRoof(0.95, 0.75, 0.35, pal.roofs[0]!);
    roof.position.y = 1.35;
    group.add(roof);
    const bucket = cylinder(0.07, 0.06, 0.12, WOOD, 6);
    bucket.position.y = 0.75;
    group.add(bucket);
    return;
  }
  const r = Math.min(w, 1.6) * 0.62;
  group.add(cylinder(r, r + 0.05, 0.35, stone, 14));
  const water = cylinder(r - 0.08, r - 0.08, 0.02, mat(0x3a9fd0, { opacity: 0.85 }), 14);
  water.position.y = 0.3;
  group.add(water);
  const column = cylinder(0.12, 0.16, 0.8, stone, 8);
  column.position.y = 0.3;
  group.add(column);
  const bowl = cylinder(0.32, 0.12, 0.15, stone, 10);
  bowl.position.y = 1.05;
  group.add(bowl);
  const top = sphere(0.1, culture === 'south' ? pal.roofs[0]! : GOLD);
  top.position.y = 1.3;
  group.add(top);
}

function windmill(culture: Culture, pal: Palette): { group: THREE.Group; sails: THREE.Group } {
  const group = new THREE.Group();
  const body = culture === 'north' ? WOOD : pal.wall;
  group.add(cylinder(0.75, 1.0, 2.6, body, 10));
  const cap = cone(0.95, 1.0, culture === 'north' ? pal.roofs[2]! : pal.roofs[0]!, 10);
  cap.position.y = 2.6;
  group.add(cap);
  const door = box(0.35, 0.6, 0.05, WOOD_DARK);
  door.position.set(0, 0, 0.98);
  group.add(door);
  for (const y of [1.2, 1.9]) {
    const win = box(0.2, 0.25, 0.05, windowMaterial);
    win.position.set(0, y, 0.86 - (y - 1.2) * 0.12);
    group.add(win);
  }
  // Flügel drehen sich um die z-Achse (zeigen nach Süden zur Kamera)
  const sails = new THREE.Group();
  sails.position.set(0, 2.45, 1.05);
  const hub = cylinder(0.12, 0.12, 0.2, WOOD_DARK, 8);
  hub.rotation.x = Math.PI / 2;
  sails.add(hub);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const spar = box(0.06, 1.7, 0.05, WOOD_DARK);
    arm.add(spar);
    const cloth = box(0.42, 1.3, 0.02, 0xf2ead8);
    cloth.position.set(0.24, 0.35, 0.02);
    arm.add(cloth);
    sails.add(arm);
  }
  return { group, sails };
}

function lighthouse(group: THREE.Group): number {
  const h = 4.6;
  const segments = 5;
  for (let i = 0; i < segments; i++) {
    const rBottom = 0.55 - i * 0.05;
    const seg = cylinder(rBottom - 0.05, rBottom, h / segments, i % 2 ? 0xc0392b : 0xf5f1e8, 12);
    seg.position.y = (i * h) / segments;
    group.add(seg);
  }
  const gallery = cylinder(0.5, 0.5, 0.08, 0x3b3b40, 12);
  gallery.position.y = h;
  group.add(gallery);
  const lamp = cylinder(0.26, 0.26, 0.5, lanternMaterial, 10);
  lamp.position.y = h + 0.08;
  group.add(lamp);
  const roof = cone(0.36, 0.45, 0x3b3b40, 10);
  roof.position.y = h + 0.58;
  group.add(roof);
  return h + 1.05;
}

function monument(group: THREE.Group, culture: Culture, pal: Palette, variant: number): number {
  const stone = culture === 'north' ? pal.stone : 0xe8dcc0;
  group.add(box(1.4, 0.3, 1.4, stone));
  const plinth = box(0.8, 0.9, 0.8, stone);
  plinth.position.y = 0.3;
  group.add(plinth);
  const bronze = mat(variant % 2 ? 0x8a6a3a : 0x6f8a7a);
  // Figur: Händler mit erhobenem Arm (Gründer der Stadt)
  const body = cylinder(0.18, 0.26, 0.75, bronze, 8);
  body.position.y = 1.2;
  group.add(body);
  const head = sphere(0.14, bronze, 1);
  head.position.y = 2.08;
  group.add(head);
  const arm = box(0.08, 0.55, 0.08, bronze);
  arm.position.set(0.22, 1.75, 0);
  arm.rotation.z = -0.5;
  group.add(arm);
  return 2.4;
}

export function buildingModel(b: PlacedBuilding, culture: Culture): BuildingModel {
  const pal = PALETTE[culture];
  const group = new THREE.Group();
  // Grundfläche mit etwas Rand
  const w = b.w - 0.25;
  const d = b.h - 0.25;
  const smoke: THREE.Vector3[] = [];
  const spinners: THREE.Object3D[] = [];
  const lights: THREE.Vector3[] = [];
  let height = 2.5;
  const addChimney = (g: THREE.Group) => {
    const c = g.userData['chimney'] as THREE.Vector3 | undefined;
    if (c) smoke.push(c.clone().applyMatrix4(g.matrix));
  };

  switch (b.kind) {
    case 'house': {
      // Echtes Modell (z. B. aus tools/blender/buildings.py), sonst der prozedurale Platzhalter
      const real = modelLibrary()?.instance(culture === 'north' ? 'house-north' : 'house-south', b.variant);
      if (real) {
        real.scale.multiplyScalar(Math.min(w, d));
        group.add(real);
        height = new THREE.Box3().setFromObject(real).max.y;
        break;
      }
      height = house(group, w, d, b.variant, culture);
      addChimney(group);
      break;
    }
    case 'kontor': {
      height = house(group, w, d, 2, culture);
      addChimney(group);
      const banner = flag(1.2, 0xc0392b);
      banner.position.set(-w / 2 + 0.2, height - 0.9, d / 2 - 0.2);
      group.add(banner);
      for (let i = 0; i < 3; i++) {
        const crate = box(0.32, 0.3, 0.32, WOOD);
        crate.position.set(w / 2 - 0.3, i === 2 ? 0.3 : 0, d / 2 + 0.25 + (i % 2) * 0.05);
        crate.position.x -= i === 1 ? 0.36 : 0;
        group.add(crate);
      }
      break;
    }
    case 'business': {
      const main = new THREE.Group();
      height = house(main, w * 0.7, d, 1 + b.variant, culture);
      main.position.x = -w * 0.15;
      main.updateMatrix();
      addChimney(main);
      group.add(main);
      const lean = box(w * 0.3, 0.06, d * 0.9, culture === 'north' ? pal.roofs[2]! : pal.trim);
      lean.position.set(w * 0.35, 1.1, 0);
      lean.rotation.z = -0.25;
      group.add(lean);
      for (const z of [-1, 1]) {
        const post = box(0.08, 1.1, 0.08, WOOD);
        post.position.set(w * 0.47, 0, (z * d * 0.4) / 1);
        group.add(post);
      }
      const big = box(0.35, 1.2, 0.35, pal.stone);
      big.position.set(w * 0.35, 0, -d * 0.25);
      group.add(big);
      smoke.push(new THREE.Vector3(w * 0.35, 1.3, -d * 0.25));
      break;
    }
    case 'townhall': {
      const hall = new THREE.Group();
      house(hall, w, d * 0.7, 1, culture);
      hall.position.z = -d * 0.15;
      group.add(hall);
      const tw = 1.1;
      const tz = d / 2 - tw / 2;
      const tower = box(tw, 3.3, tw, culture === 'north' ? pal.stone : pal.wall);
      tower.position.set(0, 0, tz);
      group.add(tower);
      const clock = cylinder(0.3, 0.3, 0.05, 0xfbf5e8, 12);
      clock.rotation.x = Math.PI / 2;
      clock.position.set(0, 2.7, tz + tw / 2 + 0.02);
      group.add(clock);
      const hand = box(0.03, 0.22, 0.02, 0x222222);
      hand.position.set(0, 2.68, tz + tw / 2 + 0.05);
      group.add(hand);
      group.add(onFace(doorAt(culture, pal, 0.5, 0.8), 'front', tw, tw, 0, 0, 0.01).translateZ(tz));
      height = towerTop(group, 0, 3.3, tz, tw * (culture === 'north' ? 0.62 : 0.5), culture, pal);
      const c = crenellations(tw, tw, 0.15, culture === 'north' ? pal.stone : pal.wall);
      c.position.set(0, 3.3, tz);
      group.add(c);
      for (const side of [-1, 1]) {
        const f = flag(0.9, culture === 'north' ? 0xa2432f : pal.trim);
        f.position.set(side * (w / 2 - 0.2), 2.2, d / 2 - 0.2);
        group.add(f);
      }
      break;
    }
    case 'temple': {
      if (culture === 'north') {
        const nave = box(w * 0.65, 1.8, d, pal.stone);
        group.add(nave);
        decorateWalls(group, w * 0.65, d, 0, 1.6, 'north', pal, false);
        const roof = tiledRoof(d + 0.2, w * 0.65 + 0.25, 1.4, pal.roofs[1]!);
        roof.rotation.y = Math.PI / 2;
        roof.position.y = 1.8;
        group.add(roof);
        const gw = gableWall(w * 0.65, 1.3, 0.06, pal.stone);
        gw.rotation.y = -Math.PI / 2;
        gw.position.set(0, 1.8, d / 2);
        group.add(gw);
        const rose = cylinder(0.25, 0.25, 0.05, windowMaterial, 10);
        rose.rotation.x = Math.PI / 2;
        rose.position.set(0, 2.25, d / 2 + 0.04);
        group.add(rose);
        group.add(onFace(doorAt('north', pal, 0.5, 0.85), 'front', w, d, 0, 0, 0.01));
        const tower = box(0.9, 3.2, 0.9, pal.stone);
        tower.position.set(w / 2 - 0.5, 0, d / 2 - 0.5);
        group.add(tower);
        height = towerTop(group, w / 2 - 0.5, 3.2, d / 2 - 0.5, 0.55, culture, pal);
      } else {
        group.add(box(w * 0.8, 1.9, d * 0.8, pal.wall));
        decorateWalls(group, w * 0.8, d * 0.8, 0, 1.7, 'south', pal, false);
        group.add(onFace(doorAt('south', pal, 0.55, 0.9), 'front', w * 0.8, d * 0.8, 0, 0, 0.01));
        const band = box(w * 0.8 + 0.04, 0.12, d * 0.8 + 0.04, pal.trim);
        band.position.y = 1.7;
        group.add(band);
        const drum = cylinder(1.05, 1.05, 0.45, pal.wall, 16);
        drum.position.y = 1.9;
        group.add(drum);
        const big = dome(1.1, pal.roofs[0]!, 18);
        big.position.y = 2.35;
        group.add(big);
        const spire = cone(0.08, 0.7, GOLD, 6);
        spire.position.y = 3.4;
        group.add(spire);
        for (const [x, z] of [
          [-1, 1],
          [1, 1],
        ] as const) {
          const mx = (x * w) / 2.3;
          const mz = (z * d) / 2.3;
          const minaret = cylinder(0.22, 0.25, 3.3, pal.wall, 8);
          minaret.position.set(mx, 0, mz);
          group.add(minaret);
          const ring = cylinder(0.3, 0.3, 0.1, pal.trim, 8);
          ring.position.set(mx, 2.6, mz);
          group.add(ring);
          const top = cone(0.26, 0.8, pal.roofs[1]!, 8);
          top.position.set(mx, 3.3, mz);
          group.add(top);
        }
        height = 4.1;
      }
      break;
    }
    case 'guild': {
      height = house(group, w, d, 0, culture);
      addChimney(group);
      for (const x of [-w / 3, w / 3]) {
        const banner = box(0.35, 0.8, 0.03, culture === 'north' ? 0x3f62a8 : 0xc9663f);
        banner.position.set(x, 0.55, d / 2 + 0.06);
        group.add(banner);
        const emblem = sphere(0.09, GOLD);
        emblem.position.set(x, 1.0, d / 2 + 0.09);
        group.add(emblem);
      }
      break;
    }
    case 'tavern': {
      height = house(group, w, d, 3, culture);
      addChimney(group);
      sign(group, w / 2 - 0.2, 1.05, d / 2 + 0.2, 0xd8a03a);
      lantern(group, -0.45, 0.85, d / 2 + 0.12);
      for (let i = 0; i < 3; i++) {
        const barrel = cylinder(0.15, 0.15, 0.38, WOOD, 8);
        barrel.position.set(-w / 2 + 0.25 + i * 0.32, 0, d / 2 + 0.3);
        group.add(barrel);
      }
      const bench = box(0.9, 0.2, 0.25, WOOD_DARK);
      bench.position.set(w / 2 - 0.7, 0, d / 2 + 0.35);
      group.add(bench);
      break;
    }
    case 'bathhouse': {
      if (culture === 'south') {
        height = southHouse(group, w, d, 0, pal);
      } else {
        height = northHouse(group, w, d, 1, pal);
        addChimney(group);
      }
      smoke.push(new THREE.Vector3(0, height, 0));
      break;
    }
    case 'lender': {
      height = house(group, w, d, 1, culture);
      addChimney(group);
      const coin = cylinder(0.2, 0.2, 0.05, GOLD, 12);
      coin.rotation.x = Math.PI / 2;
      coin.position.set(w / 2 - 0.1 + 0.38, 0.95, d / 2 + 0.2);
      sign(group, w / 2 - 0.1, 1.25, d / 2 + 0.2, 0x3b2614);
      group.add(coin);
      break;
    }
    case 'builder':
      builderYard(group, w, d, culture, pal);
      break;
    case 'shipyard':
      shipyard(group, w, d, culture, pal);
      break;
    case 'gate':
      gate(group, b.w, d, culture, pal);
      height = 4;
      break;
    case 'stall':
      stall(group, b.w, b.h, b.variant, culture, pal);
      height = 1.2;
      break;
    case 'market':
      market(group, w, d, culture, pal);
      height = 3;
      break;
    case 'lot':
      lot(group, w, d);
      height = 0.6;
      break;
    case 'fountain':
      fountain(group, b.w, culture, pal, b.variant === 1);
      height = 1.4;
      break;
    case 'windmill': {
      const mill = windmill(culture, pal);
      group.add(mill.group);
      spinners.push(mill.sails);
      height = 3.8;
      break;
    }
    case 'lighthouse':
      height = lighthouse(group);
      lights.push(new THREE.Vector3(0, height - 0.7, 0));
      break;
    case 'monument':
      height = monument(group, culture, pal, b.variant);
      break;
  }
  return { group, smoke, height, spinners, lights };
}
