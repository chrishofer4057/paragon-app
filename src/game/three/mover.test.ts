import { describe, expect, it } from 'vitest';
import { buildCityLayout } from '../cityLayout';
import { findPath } from '../world/pathfinding';
import { Mover } from './mover';
import { tileTop } from './terrain';

const layout = buildCityLayout('NewArk', 'south', { hasKontor: false, businesses: 0, houses: 0 });

describe('Figurenbewegung', () => {
  it('läuft den Pfad ab und meldet die Ankunft genau einmal', () => {
    const mover = new Mover(layout, 3);
    mover.placeAt(layout.spawn.x + 0.5, layout.spawn.y + 0.5);
    const goal = { x: layout.spawn.x - 4, y: layout.spawn.y };
    const path = findPath(layout, layout.spawn, goal)!;
    let arrived = 0;
    mover.setPath(path, () => arrived++);
    for (let i = 0; i < 200 && mover.moving; i++) mover.update(0.05);
    expect(arrived).toBe(1);
    expect(mover.tile).toEqual(goal);
    expect(mover.position.x).toBeCloseTo(goal.x + 0.5);
  });

  it('braucht für die Strecke ungefähr Weg / Geschwindigkeit', () => {
    const mover = new Mover(layout, 2);
    mover.placeAt(layout.spawn.x + 0.5, layout.spawn.y + 0.5);
    mover.setPath(findPath(layout, layout.spawn, { x: layout.spawn.x + 6, y: layout.spawn.y })!);
    let t = 0;
    while (mover.moving && t < 10) {
      mover.update(0.02);
      t += 0.02;
    }
    expect(t).toBeGreaterThan(2.7);
    expect(t).toBeLessThan(3.3);
  });

  it('ein leerer Pfad löst die Ankunft sofort aus, stop() verwirft sie', () => {
    const mover = new Mover(layout, 3);
    mover.placeAt(10.5, 10.5);
    let arrived = false;
    mover.setPath([], () => (arrived = true));
    expect(arrived).toBe(true);
    let late = false;
    mover.setPath([{ x: 11, y: 10 }], () => (late = true));
    mover.stop();
    mover.update(1);
    expect(late).toBe(false);
  });

  it('folgt der Geländehöhe', () => {
    const mover = new Mover(layout, 3);
    const x = layout.spawn.x;
    const y = layout.spawn.y;
    mover.placeAt(x + 0.5, y + 0.5);
    expect(mover.position.y).toBeCloseTo(tileTop(layout, x, y));
  });
});
