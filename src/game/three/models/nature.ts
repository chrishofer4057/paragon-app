import * as THREE from 'three';
import type { Culture } from '../../../sim/data/cities';
import { faeryMaterial, isSnowy, lanternMaterial, SNOW, WOOD, WOOD_DARK } from '../materials';
import { modelLibrary, type ModelKey } from '../modelLibrary';
import { box, cone, cylinder, mesh, sphere } from './shapes';

/** Echtes Modell aus der Bibliothek, falls vorhanden (leicht gedreht und skaliert je Variante). */
function fromLibrary(key: ModelKey, variant: number): THREE.Group | null {
  const model = modelLibrary()?.instance(key, variant);
  if (!model) return null;
  model.rotation.y = (variant * 2.39996) % (Math.PI * 2);
  model.scale.multiplyScalar(0.9 + ((variant * 37) % 20) / 100);
  return model;
}

/**
 * Bäume, Felsen, Blumen und Kleinkram (PLATZHALTER). Jede Funktion liefert eine Gruppe, deren
 * Fußpunkt bei (0, 0, 0) liegt. Später durch gekaufte/eigene Modelle ersetzbar – die Aufrufer
 * kennen nur diese Fabrikfunktionen.
 */

const PINE_GREENS = [0x2f6b3a, 0x36773f, 0x2a5f35];
const BROAD_GREENS = [0x5a9a3a, 0x4f8d34, 0x6aa848];

function pine(variant: number): THREE.Group {
  const g = new THREE.Group();
  const scale = 0.85 + (variant % 3) * 0.15;
  g.add(cylinder(0.08, 0.11, 0.5, WOOD_DARK, 6));
  const green = PINE_GREENS[variant % PINE_GREENS.length]!;
  const tiers = [
    [0.62, 0.9, 0.35],
    [0.48, 0.8, 0.8],
    [0.32, 0.7, 1.25],
  ] as const;
  for (const [r, h, y] of tiers) {
    const c = cone(r, h, green, 7);
    c.position.y = y;
    c.rotation.y = variant * 0.7;
    g.add(c);
    if (isSnowy()) {
      const cap = cone(r * 0.62, h * 0.5, SNOW, 7);
      cap.position.y = y + h * 0.52;
      cap.rotation.y = variant * 0.7;
      g.add(cap);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

function palm(variant: number): THREE.Group {
  const g = new THREE.Group();
  const lean = 0.12 + (variant % 3) * 0.06;
  let y = 0;
  let x = 0;
  for (let i = 0; i < 5; i++) {
    const seg = cylinder(0.065 - i * 0.006, 0.08 - i * 0.006, 0.4, 0x9a7a4e, 6);
    seg.position.set(x, y, 0);
    seg.rotation.z = -lean * (i + 1) * 0.5;
    g.add(seg);
    y += 0.38 * Math.cos(lean * (i + 1) * 0.5);
    x += 0.38 * Math.sin(lean * (i + 1) * 0.5);
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  const leafGeo = new THREE.ConeGeometry(0.14, 1.0, 4, 1)
    .rotateX(Math.PI / 2)
    .translate(0, 0, 0.5)
    .scale(1, 0.25, 1);
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(leafGeo, BROAD_GREENS[i % 3]!);
    leaf.rotation.y = (i / 7) * Math.PI * 2 + variant;
    leaf.rotation.x = 0.35;
    crown.add(leaf);
  }
  for (let i = 0; i < 3; i++) {
    const nut = sphere(0.06, 0x6b4a2a);
    nut.position.set(Math.cos(i * 2.1) * 0.1, -0.08, Math.sin(i * 2.1) * 0.1);
    crown.add(nut);
  }
  g.add(crown);
  g.scale.setScalar(0.95 + (variant % 2) * 0.15);
  return g;
}

/** Laubbaum (Süden: Olive/Zypresse, Norden: Birke-artig). */
function broadleaf(variant: number, culture: Culture): THREE.Group {
  const g = new THREE.Group();
  if (culture === 'south' && variant % 2 === 1) {
    // Zypresse
    g.add(cylinder(0.05, 0.07, 0.3, WOOD_DARK, 5));
    const body = sphere(0.3, 0x3f7a35, 1);
    body.scale.set(1, 3.2, 1);
    body.position.y = 1.1;
    g.add(body);
    return g;
  }
  g.add(cylinder(0.07, 0.1, 0.7, culture === 'north' ? 0xe8e2d4 : 0x8a6a44, 6));
  const green = BROAD_GREENS[variant % 3]!;
  for (const [x, y, z, r] of [
    [0, 1.0, 0, 0.5],
    [0.28, 0.85, 0.1, 0.34],
    [-0.25, 0.9, -0.12, 0.36],
  ] as const) {
    const blob = sphere(r, green, 0);
    blob.position.set(x, y, z);
    g.add(blob);
    if (isSnowy()) {
      const cap = sphere(r * 0.8, SNOW, 0);
      cap.scale.y = 0.5;
      cap.position.set(x, y + r * 0.55, z);
      g.add(cap);
    }
  }
  return g;
}

export function tree(culture: Culture, variant: number): THREE.Group {
  const real = fromLibrary(culture === 'north' ? 'tree-north' : 'tree-south', variant);
  if (real) return real;
  if (culture === 'north') return variant % 4 === 3 ? broadleaf(variant, culture) : pine(variant);
  return variant % 3 === 0 ? palm(variant) : broadleaf(variant, culture);
}

/** Bäume, die man fällen kann (Holz): im Norden Kiefern, im Süden Laubbäume. */
export function choppableTree(culture: Culture, variant: number): THREE.Group {
  const real =
    fromLibrary(culture === 'north' ? 'tree-choppable-north' : 'tree-choppable-south', variant) ??
    fromLibrary(culture === 'north' ? 'tree-north' : 'tree-south', variant);
  if (real) return real;
  return culture === 'north' ? pine(variant) : broadleaf(variant * 2, culture);
}

export function stump(): THREE.Group {
  const real = fromLibrary('stump', 0);
  if (real) return real;
  const g = new THREE.Group();
  g.add(cylinder(0.14, 0.17, 0.18, WOOD, 7));
  const top = cylinder(0.13, 0.13, 0.01, 0xd8b98a, 7);
  top.position.y = 0.18;
  g.add(top);
  return g;
}

export function rock(variant: number, culture: Culture): THREE.Group {
  const real = fromLibrary(culture === 'north' ? 'rock-north' : 'rock-south', variant);
  if (real) return real;
  const g = new THREE.Group();
  const color = culture === 'north' ? 0x8c8a90 : 0xc9b48c;
  const main = mesh(new THREE.DodecahedronGeometry(0.35, 0), color);
  main.scale.set(1.2, 0.8, 1);
  main.position.y = 0.2;
  main.rotation.y = variant;
  g.add(main);
  const small = mesh(new THREE.DodecahedronGeometry(0.18, 0), color);
  small.position.set(0.32, 0.1, 0.15);
  g.add(small);
  return g;
}

/** Erzbrocken im Steinbruch: grauer Fels mit hellen Kanten. */
export function quarryRock(variant: number): THREE.Group {
  const real = fromLibrary('quarry-rock', variant) ?? fromLibrary('rock-north', variant);
  if (real) return real;
  const g = rock(variant, 'north');
  const chip = mesh(new THREE.TetrahedronGeometry(0.12), 0xd8d4cf);
  chip.position.set(-0.2, 0.35, 0.1);
  g.add(chip);
  return g;
}

export function flowers(variant: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xe8504a, 0xf2c94c, 0xf4f0ff, 0xd77ad8];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3 + variant;
    const r = 0.12 + (i % 2) * 0.1;
    const stem = cylinder(0.01, 0.01, 0.15, 0x4f8d34, 3);
    stem.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(stem);
    const bloom = sphere(0.045, colors[(i + variant) % colors.length]!);
    bloom.position.set(Math.cos(a) * r, 0.16, Math.sin(a) * r);
    g.add(bloom);
  }
  return g;
}

export function herb(): THREE.Group {
  const g = fromLibrary('bush', 1) ?? new THREE.Group();
  if (g.children.length > 0) return g;
  for (let i = 0; i < 3; i++) {
    const b = sphere(0.15 - i * 0.02, 0x5e9e45, 0);
    b.position.set(Math.cos(i * 2.1) * 0.1, 0.12, Math.sin(i * 2.1) * 0.1);
    g.add(b);
  }
  for (let i = 0; i < 4; i++) {
    const f = sphere(0.035, 0xffffff);
    f.position.set(Math.cos(i * 1.6) * 0.14, 0.25, Math.sin(i * 1.6) * 0.14);
    g.add(f);
  }
  return g;
}

export function faerybloom(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    const stem = cylinder(0.012, 0.012, 0.3 + i * 0.05, 0x3f7a55, 3);
    stem.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
    g.add(stem);
    const bloom = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), faeryMaterial);
    bloom.position.set(Math.cos(a) * 0.1, 0.32 + i * 0.05, Math.sin(a) * 0.1);
    g.add(bloom);
  }
  return g;
}

export function lamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.035, 0.05, 1.3, 0x3b3b40, 6));
  const arm = box(0.3, 0.04, 0.04, 0x3b3b40);
  arm.position.set(0.12, 1.25, 0);
  g.add(arm);
  const light = box(0.14, 0.2, 0.14, lanternMaterial);
  light.position.set(0.25, 1.02, 0);
  g.add(light);
  const cap = cone(0.12, 0.1, 0x3b3b40, 4);
  cap.position.set(0.25, 1.22, 0);
  g.add(cap);
  g.userData['light'] = new THREE.Vector3(0.25, 1.1, 0);
  return g;
}

export function barrel(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.16, 0.14, 0.42, WOOD, 8));
  for (const y of [0.08, 0.32]) {
    const ring = cylinder(0.165, 0.165, 0.03, 0x4a4a4a, 8);
    ring.position.y = y;
    g.add(ring);
  }
  return g;
}

export function crate(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.36, 0.34, 0.36, 0xa0703f));
  const band = box(0.38, 0.05, 0.38, WOOD_DARK);
  band.position.y = 0.15;
  g.add(band);
  return g;
}

/** Gras-/Schilfbüschel zur Belebung der Wiesen. */
export function grassTuft(culture: Culture): THREE.Group {
  const g = new THREE.Group();
  const color = culture === 'north' ? 0x5f9e45 : 0xb9a960;
  for (let i = 0; i < 4; i++) {
    const blade = cone(0.03, 0.22, color, 3);
    blade.position.set(Math.cos(i * 1.7) * 0.06, 0, Math.sin(i * 1.7) * 0.06);
    blade.rotation.z = (i - 1.5) * 0.15;
    g.add(blade);
  }
  return g;
}
