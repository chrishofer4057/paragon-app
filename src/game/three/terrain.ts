import * as THREE from 'three';
import type { Culture } from '../../sim/data/cities';
import { hashFloat } from '../../sim/rng';
import { levelAt, type CityLayout, type Terrain } from '../cityLayout';
import { mat, PALETTE, WOOD_DARK } from './materials';
import { box, cylinder } from './models/shapes';
import { grassTuft, rock, tree } from './models/nature';

/**
 * Gelände aus 3D-Kacheln: jede Kachel ist ein Block, dessen Oberkante von Geländeart und
 * Höhenstufe abhängt. Um die Karte herum liegt ein nicht begehbarer Rand (Hügel, Wald, Meer),
 * damit die Stadt nicht im Leeren schwebt.
 */

/** Höhe einer Stufe in Kacheln. */
export const LEVEL_H = 0.45;
export const WATER_Y = -0.2;
/** Breite des Zierrandes um die Karte (Kacheln). */
export const MARGIN = 22;
const BOTTOM = -2;

const TOP: Record<Terrain, number> = {
  water: -0.7,
  sand: 0,
  road: 0.03,
  plaza: 0.05,
  grass: 0.07,
  forest: 0.08,
  meadow: 0.09,
  quarry: 0.02,
  pier: 0.14,
};

/** Kacheln mit Fugen (Pflaster, Planken) werden etwas schmaler gezeichnet. */
const GAP: Partial<Record<Terrain, number>> = { plaza: 0.94, road: 0.96, pier: 0.9, quarry: 0.97 };

/** Schneefarben für den nordischen Winter. */
const SNOW_COLORS: Partial<Record<Terrain, number>> = {
  grass: 0xe9eff3,
  forest: 0xdde6ea,
  meadow: 0xeef3f6,
  sand: 0xd9d6cc,
  quarry: 0xc9cdd2,
};

function terrainColor(t: Terrain, culture: Culture, winter = false): number {
  const pal = PALETTE[culture];
  if (winter && SNOW_COLORS[t] !== undefined) return SNOW_COLORS[t]!;
  switch (t) {
    case 'grass':
      return pal.ground;
    case 'forest':
      return culture === 'north' ? 0x5f9a45 : 0xb9b46a;
    case 'meadow':
      return culture === 'north' ? 0x8cc463 : 0xcfd08a;
    case 'sand':
      return pal.sand;
    case 'road':
      return pal.road;
    case 'plaza':
      return pal.plaza;
    case 'quarry':
      return culture === 'north' ? 0x9a948e : 0xc8b28a;
    case 'pier':
      return 0xa57a4a;
    case 'water':
      return culture === 'north' ? 0x6d8c7a : 0xd9c690;
  }
}

/** Erste Wasserzeile einer Spalte; außerhalb der Karte die der nächsten Randspalte. */
function shoreAt(layout: CityLayout, x: number): number {
  return layout.shore[Math.max(0, Math.min(layout.cols - 1, x))]!;
}

function seabed(layout: CityLayout, x: number, y: number): number {
  return TOP.water - Math.min(1.2, (y - shoreAt(layout, x) + 1) * 0.12);
}

/** Oberkante der Kachel (Weltkoordinate y). Außerhalb der Karte: Stadtniveau. */
export function tileTop(layout: CityLayout, x: number, y: number): number {
  const t = layout.terrain[y]?.[x];
  if (t === undefined) return 0;
  if (t === 'water') return seabed(layout, x, y);
  return TOP[t] + Math.max(0, levelAt(layout, x, y)) * LEVEL_H;
}

/** Bodenhöhe an einer beliebigen Stelle (für Figuren): die Kachel unter dem Punkt. */
export function groundHeight(layout: CityLayout, wx: number, wz: number): number {
  const x = Math.floor(wx);
  const y = Math.floor(wz);
  const t = layout.terrain[y]?.[x];
  if (t === 'pier') return TOP.pier;
  return tileTop(layout, x, y);
}

const tmpColor = new THREE.Color();
const tmpMatrix = new THREE.Matrix4();

function jitter(color: number, amount: number, ...keys: number[]): THREE.Color {
  tmpColor.setHex(color);
  const f = 1 + (hashFloat(0x7e44, ...keys) - 0.5) * amount;
  tmpColor.r *= f;
  tmpColor.g *= f;
  tmpColor.b *= f;
  return tmpColor;
}

export interface TerrainMeshes {
  /** Begehbare Kacheln der Karte – Ziel für Mausklicks; instanceId → Kachel über `tileOf`. */
  pick: THREE.InstancedMesh;
  tileOf: { x: number; y: number }[];
  /** Statische Zierobjekte (Rand, Grasbüschel, Steg). */
  statics: THREE.Group;
  water: THREE.Mesh;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

interface BorderTile {
  x: number;
  y: number;
  t: Terrain;
  level: number;
}

function borderTiles(layout: CityLayout): BorderTile[] {
  const out: BorderTile[] = [];
  const cityKey = layout.cityId.length * 31 + layout.cityId.charCodeAt(0);
  for (let y = -MARGIN; y < layout.rows + MARGIN; y++) {
    for (let x = -MARGIN; x < layout.cols + MARGIN; x++) {
      if (x >= 0 && y >= 0 && x < layout.cols && y < layout.rows) continue;
      let t: Terrain;
      const shore = shoreAt(layout, x);
      if (y >= shore) t = 'water';
      else if (y >= shore - 1) t = 'sand';
      else if (y < 0 && (x === layout.gateX || x === layout.gateX + 1)) t = 'road';
      else t = 'grass';
      const dx = x < 0 ? -x : x >= layout.cols ? x - layout.cols + 1 : 0;
      const dy = y < 0 ? -y : 0;
      const dist = Math.max(dx, dy);
      let level = 0;
      if (t === 'grass') {
        const n = hashFloat(0x80de, cityKey, Math.floor(x / 3), Math.floor(y / 3));
        level = Math.min(5, Math.floor((dist + n * 4) / 3.2));
        if (y >= shore - 4) level = Math.min(level, Math.max(0, shore - 2 - y));
      }
      out.push({ x, y, t, level });
    }
  }
  return out;
}

export function buildTerrain(layout: CityLayout, winter = false): TerrainMeshes {
  const culture = layout.culture;
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0);
  const material = mat(0xffffff);

  // --- Karte -----------------------------------------------------------------
  const tileOf: { x: number; y: number }[] = [];
  const mapCount = layout.cols * layout.rows;
  const pick = new THREE.InstancedMesh(geo, material, mapCount);
  pick.receiveShadow = true;
  let i = 0;
  for (let y = 0; y < layout.rows; y++) {
    for (let x = 0; x < layout.cols; x++) {
      const t = layout.terrain[y]![x]!;
      // Unter dem Steg liegt Meeresgrund; die Planken kommen als eigene Objekte dazu.
      const top = t === 'pier' ? seabed(layout, x, y) : tileTop(layout, x, y);
      const g = t === 'pier' ? 1 : (GAP[t] ?? 1);
      tmpMatrix.makeScale(g, top - BOTTOM, g).setPosition(x + 0.5, top, y + 0.5);
      pick.setMatrixAt(i, tmpMatrix);
      const base = t === 'pier' ? terrainColor('water', culture) : terrainColor(t, culture, winter);
      const checker = t === 'plaza' && (x + y) % 2 === 0 ? 0.08 : 0;
      const c = jitter(base, t === 'water' ? 0.05 : 0.09, x, y);
      c.offsetHSL(0, 0, checker + Math.max(0, levelAt(layout, x, y)) * 0.025);
      pick.setColorAt(i, c);
      tileOf.push({ x, y });
      i++;
    }
  }
  pick.instanceMatrix.needsUpdate = true;
  if (pick.instanceColor) pick.instanceColor.needsUpdate = true;

  // --- Rand ----------------------------------------------------------------
  const statics = new THREE.Group();
  const border = borderTiles(layout);
  const borderMesh = new THREE.InstancedMesh(geo, material, border.length);
  borderMesh.receiveShadow = true;
  const cityKey = layout.cityId.length * 31 + layout.cityId.charCodeAt(0);
  border.forEach((b, j) => {
    const top = b.t === 'water' ? seabed(layout, b.x, b.y) : TOP[b.t] + b.level * LEVEL_H;
    tmpMatrix.makeScale(1, top - BOTTOM, 1).setPosition(b.x + 0.5, top, b.y + 0.5);
    borderMesh.setMatrixAt(j, tmpMatrix);
    const c = jitter(terrainColor(b.t, culture, winter), 0.1, b.x + 500, b.y + 500);
    c.offsetHSL(0, 0, b.level * 0.02);
    borderMesh.setColorAt(j, c);
    if (b.t === 'grass') {
      const r = hashFloat(0x7ee5, cityKey, b.x, b.y);
      const edgeDist = Math.min(Math.abs(b.x + 0.5 - layout.cols / 2) - layout.cols / 2, -b.y);
      const density = edgeDist > 2 ? 0.42 : 0.18;
      if (r < density) {
        const obj =
          r < density * 0.85 ? tree(culture, Math.floor(r * 1000)) : rock(Math.floor(r * 100), culture);
        obj.position.set(b.x + 0.3 + r * 0.4, top, b.y + 0.3 + ((r * 7) % 0.4));
        obj.rotation.y = r * 40;
        statics.add(obj);
      }
    }
  });
  statics.add(borderMesh);

  // --- Kleinkram auf der Karte ------------------------------------------------
  for (let y = 0; y < layout.rows; y++) {
    for (let x = 0; x < layout.cols; x++) {
      const t = layout.terrain[y]![x]!;
      if (t === 'pier') {
        const deck = box(1, 0.08, 0.92, 0xa57a4a);
        deck.position.set(x + 0.5, TOP.pier - 0.08, y + 0.5);
        statics.add(deck);
        for (const [px, pz] of [
          [0.1, 0.1],
          [0.9, 0.9],
        ] as const) {
          const post = cylinder(0.06, 0.06, 1.2, WOOD_DARK, 5);
          post.position.set(x + px, TOP.pier - 1.2, y + pz);
          statics.add(post);
        }
        continue;
      }
      if (
        !winter &&
        (t === 'grass' || t === 'meadow' || t === 'forest') &&
        hashFloat(0x9a55, cityKey, x, y) < 0.18
      ) {
        const tuft = grassTuft(culture);
        tuft.position.set(x + hashFloat(1, x, y), tileTop(layout, x, y), y + hashFloat(2, x, y));
        statics.add(tuft);
      }
    }
  }
  // Kaimauer entlang des Ufers
  for (let x = 0; x < layout.cols; x++) {
    const shore = shoreAt(layout, x);
    if (layout.terrain[shore - 1]?.[x] !== 'sand') continue;
    const wall = box(1, 0.5, 0.2, culture === 'north' ? 0x7d7a86 : 0xd8c39a);
    wall.position.set(x + 0.5, -0.45, shore - 0.05);
    statics.add(wall);
  }

  // --- Wasser ----------------------------------------------------------------
  const minX = -MARGIN;
  const maxX = layout.cols + MARGIN;
  const minZ = Math.min(...layout.shore) - 2;
  const maxZ = layout.rows + MARGIN;
  const waterGeo = new THREE.PlaneGeometry(
    maxX - minX,
    maxZ - minZ,
    (maxX - minX) / 1.5,
    (maxZ - minZ) / 1.5,
  );
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate((minX + maxX) / 2, WATER_Y, (minZ + maxZ) / 2);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      color: PALETTE[culture].water,
      transparent: true,
      opacity: 0.78,
      roughness: 0.25,
      metalness: 0.05,
      flatShading: true,
    }),
  );
  water.receiveShadow = true;
  water.userData['base'] = Float32Array.from(
    (waterGeo.attributes['position'] as THREE.BufferAttribute).array,
  );

  return {
    pick,
    tileOf,
    statics,
    water,
    bounds: { minX: -MARGIN, maxX: layout.cols + MARGIN, minZ: -MARGIN, maxZ: layout.rows + MARGIN },
  };
}

/** Sanfte Wellen: Eckpunkte des Wassers heben und senken. */
export function animateWater(water: THREE.Mesh, time: number): void {
  const pos = water.geometry.attributes['position'] as THREE.BufferAttribute;
  const base = water.userData['base'] as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3]!;
    const z = base[i * 3 + 2]!;
    pos.setY(
      i,
      base[i * 3 + 1]! + Math.sin(x * 0.7 + time * 1.3) * 0.04 + Math.cos(z * 0.9 + time * 1.1) * 0.035,
    );
  }
  pos.needsUpdate = true;
}
