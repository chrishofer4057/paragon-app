import { describe, expect, it } from 'vitest';
import { CITIES, CITY_IDS } from '../../sim/data/cities';
import { buildCityLayout, isWalkable, LANDMARK_KINDS, type CityLayout, type Terrain } from '../cityLayout';
import { canStep, findPath, nearestWalkable } from './pathfinding';

/** Kleine Testkarte aus Zeichen: . = Gras, ~ = Wasser, # = Gebäude, Ziffern = Höhenstufe auf Gras. */
function grid(rows: string[]): CityLayout {
  const terrain: Terrain[][] = [];
  const levels: number[][] = [];
  const buildings: CityLayout['buildings'] = [];
  rows.forEach((row, y) => {
    terrain.push([...row].map((c) => (c === '~' ? 'water' : 'grass')));
    levels.push([...row].map((c) => (/\d/.test(c) ? Number(c) : 0)));
    [...row].forEach((c, x) => {
      if (c === '#')
        buildings.push({
          id: `b${x}_${y}`,
          kind: 'house',
          label: '',
          x,
          y,
          w: 1,
          h: 1,
          door: { x, y: y + 1 },
          panel: null,
          variant: 0,
        });
    });
  });
  return {
    cityId: 'NewArk',
    culture: 'south',
    cols: rows[0]!.length,
    rows: rows.length,
    terrain,
    levels,
    shore: Array.from({ length: rows[0]!.length }, () => rows.length),
    gateX: 0,
    buildings,
    spots: [],
    decorations: [],
    spawn: { x: 0, y: 0 },
    berths: [],
  };
}

describe('Wegsuche', () => {
  it('findet den direkten Weg', () => {
    const layout = grid(['.....']);
    expect(findPath(layout, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it('ist leer, wenn man schon am Ziel steht', () => {
    expect(findPath(grid(['...']), { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it('geht um Gebäude herum und schneidet keine Ecken', () => {
    const layout = grid(['.#.', '.#.', '...']);
    const path = findPath(layout, { x: 0, y: 0 }, { x: 2, y: 0 })!;
    expect(path.at(-1)).toEqual({ x: 2, y: 0 });
    let prev = { x: 0, y: 0 };
    for (const p of path) {
      expect(isWalkable(layout, p.x, p.y)).toBe(true);
      expect(canStep(layout, prev, p)).toBe(true);
      prev = p;
    }
    // Ecke (1,1)->(2,2)-Diagonale vorbei am Gebäude ist verboten: der Weg muss über (1,2)
    expect(path).toContainEqual({ x: 1, y: 2 });
  });

  it('nutzt Diagonalen auf freier Fläche', () => {
    const path = findPath(grid(['...', '...', '...']), { x: 0, y: 0 }, { x: 2, y: 2 })!;
    expect(path).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('kein Weg übers Wasser', () => {
    expect(findPath(grid(['.~.']), { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('Stufen höher als 1 sind Wände, Rampen gehen', () => {
    expect(findPath(grid(['0.2']), { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    expect(findPath(grid(['012']), { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(2);
  });

  it('sucht für ein unbegehbares Ziel die nächste begehbare Kachel in Richtung des Spielers', () => {
    const layout = grid(['.....', '.###.', '.....']);
    expect(nearestWalkable(layout, { x: 2, y: 1 }, { x: 2, y: 2 })).toEqual({ x: 2, y: 2 });
    expect(nearestWalkable(layout, { x: 2, y: 1 }, { x: 2, y: 0 })).toEqual({ x: 2, y: 0 });
    expect(nearestWalkable(grid(['~~~']), { x: 1, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('in jeder Stadt ist jede Tür und jeder Sammelplatz vom Startpunkt aus erreichbar', () => {
    for (const cityId of CITY_IDS) {
      const layout = buildCityLayout(cityId, CITIES[cityId].culture, {
        hasKontor: true,
        businesses: 8,
        houses: 14,
      });
      const goals = [
        ...layout.buildings.filter((b) => !LANDMARK_KINDS.includes(b.kind)).map((b) => b.door),
        ...layout.spots,
      ];
      for (const goal of goals) {
        const path = findPath(layout, layout.spawn, { x: goal.x, y: goal.y });
        expect(path, `${cityId}: ${goal.x},${goal.y}`).not.toBeNull();
      }
    }
  });
});
