import * as THREE from 'three';
import type { Culture } from '../../sim/data/cities';

/**
 * PLATZHALTERGRAFIK (CLAUDE.md §11.6): Alle Modelle sind prozedural aus Grundkörpern gebaut,
 * keine fremden Assets. Stil laut docs/ART_DIRECTION.md: warm, cartoonig, flach schattiert.
 */

export const PALETTE = {
  north: {
    ground: 0x7cb85a,
    road: 0xa39478,
    plaza: 0xb9ab90,
    sand: 0xd9c38f,
    wall: 0xf3e6cc,
    timber: 0x5e3a20,
    stone: 0x8f8a8f,
    roofs: [0xa2432f, 0x3f62a8, 0x7d4f2c, 0xb0563a],
    trim: 0x4a2c18,
    foliage: 0x2f6b3a,
    water: 0x2e7fb0,
  },
  south: {
    ground: 0xe8d29e,
    road: 0xd2b98d,
    plaza: 0xf1e3c2,
    sand: 0xf0dcab,
    wall: 0xfbf5e8,
    timber: 0xd8c39e,
    stone: 0xd9c49b,
    roofs: [0x2f6fc4, 0x3b8ad8, 0xc9663f, 0x2a5fb0],
    trim: 0x2c5aa0,
    foliage: 0x4f9a3a,
    water: 0x2aa6c4,
  },
} as const;

export type Palette = (typeof PALETTE)[Culture];

export const GOLD = 0xe0b23a;
export const WOOD = 0x7a4a26;
export const WOOD_DARK = 0x4e2f18;
export const SKIN = 0xf0c9a0;

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Gemeinsame, flach schattierte Materialien – ein Material je Farbe spart Draw-State. */
export function mat(
  color: number,
  opts: { emissive?: number; emissiveIntensity?: number; opacity?: number } = {},
): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.emissive ?? 0}|${opts.emissiveIntensity ?? 0}|${opts.opacity ?? 1}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.88,
      metalness: 0,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

/** Fenster leuchten nachts – alle teilen sich dieses Material, die Ansicht dimmt es zentral. */
export const windowMaterial = new THREE.MeshStandardMaterial({
  color: 0x2b3a55,
  emissive: 0xffc56b,
  emissiveIntensity: 0,
  flatShading: true,
  roughness: 0.4,
});

export const lanternMaterial = new THREE.MeshStandardMaterial({
  color: 0xffe2a0,
  emissive: 0xffb347,
  emissiveIntensity: 0.3,
  flatShading: true,
});

export const faeryMaterial = new THREE.MeshStandardMaterial({
  color: 0xd8a8ff,
  emissive: 0xb070ff,
  emissiveIntensity: 0.8,
  flatShading: true,
});

/** Nacht-Anteil 0..1 auf die leuchtenden Materialien übertragen. */
export function setNightGlow(night: number): void {
  windowMaterial.emissiveIntensity = night * 1.4;
  lanternMaterial.emissiveIntensity = 0.3 + night * 2.2;
}

let snowy = false;

/** Winter im Norden: neu gebaute Modelle bekommen Schnee (Dächer, Baumkappen). */
export function setSnowy(value: boolean): void {
  snowy = value;
}

export function isSnowy(): boolean {
  return snowy;
}

export const SNOW = 0xf2f6fa;
