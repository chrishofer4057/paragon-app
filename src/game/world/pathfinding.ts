import { isWalkable, levelAt, type CityLayout } from '../cityLayout';

/**
 * Wegsuche auf dem Kachelraster der Stadt (A*, 8 Richtungen). Rein und testbar; die 3D-Ansicht
 * nutzt sie für Mausklicks und für die Bürger auf den Straßen.
 */

export interface GridPoint {
  x: number;
  y: number;
}

/** Größter begehbarer Höhenunterschied zwischen Nachbarkacheln. */
export const MAX_STEP = 1;
const SQRT2 = Math.SQRT2;
/** Aufpreis je Höhenstufe, damit Wege lieber eben bleiben. */
const CLIMB_COST = 0.4;

/** Darf man direkt von a nach b (Nachbarn) gehen? Diagonal nur, wenn keine Ecke geschnitten wird. */
export function canStep(layout: CityLayout, a: GridPoint, b: GridPoint): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) return false;
  if (!isWalkable(layout, b.x, b.y)) return false;
  if (Math.abs(levelAt(layout, a.x, a.y) - levelAt(layout, b.x, b.y)) > MAX_STEP) return false;
  if (dx !== 0 && dy !== 0) {
    const side1 = { x: a.x + dx, y: a.y };
    const side2 = { x: a.x, y: a.y + dy };
    for (const s of [side1, side2]) {
      if (!isWalkable(layout, s.x, s.y)) return false;
      if (Math.abs(levelAt(layout, a.x, a.y) - levelAt(layout, s.x, s.y)) > MAX_STEP) return false;
    }
  }
  return true;
}

/** Kleiner Binärheap nach Priorität. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly prio: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.prio.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent]! <= this.prio[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastPrio = this.prio.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.prio[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l]! < this.prio[m]!) m = l;
        if (r < this.items.length && this.prio[r]! < this.prio[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.prio[a], this.prio[b]] = [this.prio[b]!, this.prio[a]!];
  }
}

function octile(a: GridPoint, b: GridPoint): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Kürzester Weg von `from` nach `to`. Liefert die Kacheln nach `from` bis einschließlich `to`,
 * `[]` wenn man schon dort ist, `null` wenn das Ziel unerreichbar ist.
 */
export function findPath(layout: CityLayout, from: GridPoint, to: GridPoint): GridPoint[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!isWalkable(layout, to.x, to.y)) return null;
  const cols = layout.cols;
  const size = cols * layout.rows;
  const cost = new Float64Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const start = from.y * cols + from.x;
  const goal = to.y * cols + to.x;
  cost[start] = 0;
  const open = new MinHeap();
  open.push(start, octile(from, to));
  while (open.size > 0) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % cols;
    const cy = (cur - cx) / cols;
    const here = { x: cx, y: cy };
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: cx + dx, y: cy + dy };
        if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= layout.rows) continue;
        const ni = next.y * cols + next.x;
        if (closed[ni] || !canStep(layout, here, next)) continue;
        const climb = Math.abs(levelAt(layout, cx, cy) - levelAt(layout, next.x, next.y));
        const g = cost[cur]! + (dx !== 0 && dy !== 0 ? SQRT2 : 1) + climb * CLIMB_COST;
        if (g < cost[ni]!) {
          cost[ni] = g;
          came[ni] = cur;
          open.push(ni, g + octile(next, to));
        }
      }
    }
  }
  if (came[goal] === -1) return null;
  const path: GridPoint[] = [];
  for (let i = goal; i !== start; i = came[i]!) {
    const x = i % cols;
    path.push({ x, y: (i - x) / cols });
  }
  return path.reverse();
}

/**
 * Nächste begehbare Kachel zu einem (evtl. unbegehbaren) Ziel; bei Gleichstand die, die näher
 * am Spieler liegt. Sucht in wachsenden Ringen bis `maxRadius`.
 */
export function nearestWalkable(
  layout: CityLayout,
  target: GridPoint,
  from: GridPoint,
  maxRadius = 6,
): GridPoint | null {
  if (isWalkable(layout, target.x, target.y)) return { x: target.x, y: target.y };
  for (let r = 1; r <= maxRadius; r++) {
    let best: GridPoint | null = null;
    let bestScore = Infinity;
    for (let y = target.y - r; y <= target.y + r; y++) {
      for (let x = target.x - r; x <= target.x + r; x++) {
        if (Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) !== r) continue;
        if (!isWalkable(layout, x, y)) continue;
        const score = Math.hypot(x - target.x, y - target.y) * 10 + Math.hypot(x - from.x, y - from.y) * 0.01;
        if (score < bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return null;
}
