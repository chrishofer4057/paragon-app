import * as THREE from 'three';
import type { CharacterId } from '../../../sim/data/characters';
import { SKIN } from '../materials';
import { box, cone, cylinder, sphere } from './shapes';

/** Einfache Figuren aus Grundkörpern (PLATZHALTER), mit Gelenken für die Laufanimation. */

export interface Outfit {
  tunic: number;
  legs: number;
  hair: number;
  hat?: number;
  dress?: boolean;
}

export const CHARACTER_OUTFITS: Record<CharacterId, Outfit> = {
  gian: { tunic: 0x4f7a3a, legs: 0x5a4632, hair: 0x6b4423, hat: 0x7a4a26 },
  ursina: { tunic: 0xb03a2e, legs: 0x5a3a2a, hair: 0xd8a24a, dress: true },
  duri: { tunic: 0x2f5f9e, legs: 0x3a3a46, hair: 0x2b1d10, hat: 0xe0b23a },
  mengia: { tunic: 0x6d3f8e, legs: 0x3b2614, hair: 0x1f1410, dress: true },
};

export const CITIZEN_OUTFITS = {
  poor: [
    { tunic: 0x8a7a5a, legs: 0x5a4632, hair: 0x4a3020 },
    { tunic: 0x7a6248, legs: 0x4a3a2a, hair: 0x2b1d10, hat: 0x9a8a6a },
  ],
  wealthy: [
    { tunic: 0x3f6f8e, legs: 0x3b3b46, hair: 0x6b4423 },
    { tunic: 0x9e5a2f, legs: 0x4a3a2a, hair: 0xd8a24a, dress: true },
  ],
  rich: [
    { tunic: 0x7a2a4a, legs: 0x2b1d10, hair: 0x1f1410, hat: 0x2b1d10 },
    { tunic: 0x2a4a7a, legs: 0x2b1d10, hair: 0xb08a5a, dress: true },
  ],
} satisfies Record<string, Outfit[]>;

export interface Figure {
  root: THREE.Group;
  /** Innerer Körper, der beim Laufen wippt. */
  body: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  phase: number;
}

function limb(w: number, h: number, color: number): THREE.Group {
  const pivot = new THREE.Group();
  const m = box(w, h, w, color);
  m.position.y = -h;
  pivot.add(m);
  return pivot;
}

export function makeFigure(outfit: Outfit, scale = 1): Figure {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legL = limb(0.1, 0.3, outfit.legs);
  const legR = limb(0.1, 0.3, outfit.legs);
  legL.position.set(-0.07, 0.3, 0);
  legR.position.set(0.07, 0.3, 0);
  body.add(legL, legR);
  const torso = outfit.dress
    ? cylinder(0.13, 0.22, 0.5, outfit.tunic, 8)
    : cylinder(0.14, 0.16, 0.36, outfit.tunic, 8);
  torso.position.y = outfit.dress ? 0.12 : 0.28;
  body.add(torso);
  const belt = cylinder(0.15, 0.15, 0.04, 0x3b2614, 8);
  belt.position.y = 0.42;
  body.add(belt);
  const armL = limb(0.08, 0.28, outfit.tunic);
  const armR = limb(0.08, 0.28, outfit.tunic);
  armL.position.set(-0.19, 0.6, 0);
  armR.position.set(0.19, 0.6, 0);
  for (const arm of [armL, armR]) {
    const hand = sphere(0.045, SKIN);
    hand.position.y = -0.31;
    arm.add(hand);
  }
  body.add(armL, armR);
  const head = sphere(0.13, SKIN, 1);
  head.position.y = 0.76;
  body.add(head);
  const hair = sphere(0.135, outfit.hair, 1);
  hair.scale.set(1, 0.7, 1);
  hair.position.set(0, 0.81, -0.02);
  body.add(hair);
  for (const side of [-1, 1]) {
    const eye = box(0.025, 0.035, 0.01, 0x1f1410);
    eye.position.set(side * 0.045, 0.76, 0.125);
    body.add(eye);
  }
  if (outfit.hat !== undefined) {
    const brim = cylinder(0.2, 0.2, 0.03, outfit.hat, 10);
    brim.position.y = 0.86;
    body.add(brim);
    const crown = cone(0.12, 0.16, outfit.hat, 8);
    crown.position.y = 0.88;
    body.add(crown);
  }
  root.scale.setScalar(scale);
  return { root, body, legL, legR, armL, armR, phase: 0 };
}

const XRAY = new THREE.MeshBasicMaterial({
  color: 0xffe9a8,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  depthFunc: THREE.GreaterDepth,
});

/**
 * Silhouette, die nur dort erscheint, wo etwas vor der Figur steht (Tiefentest „größer“).
 * So bleibt die eigene Figur hinter Häusern sichtbar.
 */
export function addSilhouette(f: Figure): void {
  const meshes: THREE.Mesh[] = [];
  f.root.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  for (const m of meshes) {
    const ghost = new THREE.Mesh(m.geometry, XRAY);
    ghost.position.copy(m.position);
    ghost.rotation.copy(m.rotation);
    ghost.scale.copy(m.scale);
    ghost.renderOrder = 10;
    ghost.castShadow = false;
    m.parent?.add(ghost);
  }
}

/** Lauf- bzw. Ruheanimation; `speed` in Kacheln pro Sekunde. */
export function animateFigure(f: Figure, dt: number, speed: number): void {
  if (speed > 0.05) {
    f.phase += dt * speed * 4.2;
    const swing = Math.sin(f.phase) * 0.7;
    f.legL.rotation.x = swing;
    f.legR.rotation.x = -swing;
    f.armL.rotation.x = -swing * 0.8;
    f.armR.rotation.x = swing * 0.8;
    f.body.position.y = Math.abs(Math.cos(f.phase)) * 0.04;
  } else {
    f.phase += dt * 1.5;
    const ease = (v: number) => v * 0.8;
    f.legL.rotation.x = ease(f.legL.rotation.x);
    f.legR.rotation.x = ease(f.legR.rotation.x);
    f.armL.rotation.x = ease(f.armL.rotation.x);
    f.armR.rotation.x = Math.sin(f.phase) * 0.03;
    f.body.position.y = Math.sin(f.phase) * 0.008;
  }
}

/** Arbeitsbewegung (Hacken, Angeln): rechter Arm schwingt kräftig. */
export function animateWork(f: Figure, dt: number): void {
  f.phase += dt * 9;
  f.armR.rotation.x = -1.6 + Math.sin(f.phase) * 1.1;
  f.armL.rotation.x = -0.6 + Math.sin(f.phase) * 0.3;
  f.body.position.y = 0;
}
