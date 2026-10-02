/**
 * Geseedeter Zufallsgenerator (mulberry32). Der Zustand ist eine einzige Zahl im
 * Spielzustand, damit Speichern/Laden und spätere Netzwerk-Replays deterministisch sind.
 */

export interface RngState {
  seed: number;
  state: number;
}

export function createRng(seed: number): RngState {
  const s = seed >>> 0;
  return { seed: s, state: s === 0 ? 0x9e3779b9 : s };
}

/** Gleichverteilte Zahl in [0, 1). Verändert den RNG-Zustand. */
export function nextFloat(rng: RngState): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Ganze Zahl in [min, max] (beide inklusive). */
export function nextInt(rng: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

export function nextRange(rng: RngState, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

export function chance(rng: RngState, probability: number): boolean {
  return nextFloat(rng) < probability;
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() auf leerer Liste');
  return items[Math.floor(nextFloat(rng) * items.length)]!;
}

/** Gewichtete Auswahl; Gewichte <= 0 werden ignoriert. */
export function pickWeighted<T>(
  rng: RngState,
  items: readonly T[],
  weight: (item: T) => number,
): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return undefined;
  let roll = nextFloat(rng) * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Zustandsloser Zufallswert aus Seed und Schlüsseln – für "heute ja/nein"-Fragen, die
 * keinen RNG-Zustand verbrauchen sollen (z. B. damit abgelehnte Commands nichts ändern).
 */
export function hashFloat(seed: number, ...keys: number[]): number {
  let h = seed >>> 0;
  for (const k of keys) {
    h = Math.imul(h ^ (k >>> 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}
