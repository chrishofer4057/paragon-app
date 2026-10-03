import { describe, expect, it } from 'vitest';
import { CITIES, CITY_IDS } from '../sim/data/cities';
import {
  buildCityLayout,
  CITY_SIZES,
  isWalkable,
  LANDMARK_KINDS,
  MIN_BUSINESS_SLOTS,
  MIN_HOUSE_SLOTS,
  slotCounts,
} from './cityLayout';

const FULL = { hasKontor: true, businesses: 8, houses: 16 };
const EMPTY = { hasKontor: false, businesses: 0, houses: 0 };

describe('Stadtgrundriss', () => {
  it('ist deterministisch', () => {
    expect(buildCityLayout('Reach', 'north', FULL)).toEqual(buildCityLayout('Reach', 'north', FULL));
  });

  it('jede Stadt hat ihren eigenen Grundriss', () => {
    const fingerprints = new Set(
      CITY_IDS.map((id) => {
        const l = buildCityLayout(id, CITIES[id].culture, EMPTY);
        const market = l.buildings.find((b) => b.kind === 'market')!;
        return `${l.gateX}|${market.x},${market.y}|${l.shore.join(',')}`;
      }),
    );
    expect(fingerprints.size).toBe(CITY_IDS.length);
  });

  it('die Kartengröße folgt der Stadtgröße', () => {
    for (const id of CITY_IDS) {
      const l = buildCityLayout(id, CITIES[id].culture, EMPTY);
      expect({ cols: l.cols, rows: l.rows }).toEqual(CITY_SIZES[CITIES[id].size]);
    }
  });

  it('Besitz verschiebt keine öffentlichen Gebäude', () => {
    for (const id of CITY_IDS) {
      const pub = (extras: typeof FULL) =>
        buildCityLayout(id, CITIES[id].culture, extras)
          .buildings.filter((b) => b.kind !== 'house' && b.kind !== 'business')
          .map((b) => `${b.id}@${b.x},${b.y}`)
          .sort();
      expect(pub(FULL).map((s) => s.replace('kontor', 'lot'))).toEqual(
        pub(EMPTY).map((s) => s.replace('kontor', 'lot')),
      );
    }
  });

  it('Gebäude überlappen nicht und liegen in der Karte', () => {
    for (const cityId of CITY_IDS) {
      const layout = buildCityLayout(cityId, CITIES[cityId].culture, FULL);
      const seen = new Map<string, string>();
      for (const b of layout.buildings) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(layout.cols);
        expect(b.y + b.h).toBeLessThanOrEqual(layout.rows);
        for (let y = b.y; y < b.y + b.h; y++) {
          for (let x = b.x; x < b.x + b.w; x++) {
            const key = `${x},${y}`;
            expect(seen.get(key), `${cityId}: ${b.id} überlappt ${seen.get(key)} bei ${key}`).toBeUndefined();
            seen.set(key, b.id);
            expect(layout.terrain[y]![x]).not.toBe('water');
          }
        }
      }
    }
  });

  it('jede Tür und jeder Sammelplatz ist begehbar', () => {
    for (const cityId of CITY_IDS) {
      const layout = buildCityLayout(cityId, CITIES[cityId].culture, FULL);
      for (const b of layout.buildings) {
        if (LANDMARK_KINDS.includes(b.kind)) continue;
        expect(isWalkable(layout, b.door.x, b.door.y), `${cityId}: Tür von ${b.id}`).toBe(true);
      }
      for (const s of layout.spots) expect(isWalkable(layout, s.x, s.y), `${cityId}: ${s.id}`).toBe(true);
      expect(isWalkable(layout, layout.spawn.x, layout.spawn.y)).toBe(true);
    }
  });

  it('alle wichtigen Gebäude, Sammelplätze, Bauplätze und Liegeplätze sind vorhanden', () => {
    for (const cityId of CITY_IDS) {
      const layout = buildCityLayout(cityId, CITIES[cityId].culture, EMPTY);
      const kinds = new Set(layout.buildings.map((b) => b.kind));
      for (const kind of [
        'market',
        'tavern',
        'temple',
        'townhall',
        'guild',
        'bathhouse',
        'lender',
        'shipyard',
        'gate',
        'builder',
        'stall',
        'lot',
        'fountain',
      ] as const) {
        expect(kinds.has(kind), `${cityId}: ${kind}`).toBe(true);
      }
      for (const activity of ['wood', 'stone', 'fish', 'herbs'] as const)
        expect(
          layout.spots.some((s) => s.activity === activity),
          `${cityId}: ${activity}`,
        ).toBe(true);
      const slots = slotCounts(cityId);
      expect(slots.houses, cityId).toBeGreaterThanOrEqual(MIN_HOUSE_SLOTS);
      expect(slots.businesses, cityId).toBeGreaterThanOrEqual(MIN_BUSINESS_SLOTS);
      expect(layout.berths.length, cityId).toBeGreaterThanOrEqual(3);
      for (const b of layout.berths) expect(layout.terrain[b.y]![b.x], cityId).toBe('water');
    }
  });

  it('Getreidestädte haben eine Windmühle, Fischerstädte einen Leuchtturm', () => {
    const kinds = (id: (typeof CITY_IDS)[number]) =>
      new Set(buildCityLayout(id, CITIES[id].culture, EMPTY).buildings.map((b) => b.kind));
    expect(kinds('NewArk').has('windmill')).toBe(true);
    expect(kinds('Stormwatch').has('lighthouse')).toBe(true);
  });

  it('die Küstenlinie springt höchstens eine Kachel je Spalte', () => {
    for (const id of CITY_IDS) {
      const { shore } = buildCityLayout(id, CITIES[id].culture, EMPTY);
      for (let x = 1; x < shore.length; x++)
        expect(Math.abs(shore[x]! - shore[x - 1]!)).toBeLessThanOrEqual(1);
    }
  });
});
