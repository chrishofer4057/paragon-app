import type { GoodId } from './goods';

/**
 * Die 26 Städte aus Paragon (WorldFactory.cs): Größe, Spezialware, reguläre Produktion
 * und Kartenposition wurden übernommen.
 *
 * - Spezialware: effektive Produktion mit Bonus, die Stadt produziert davon am meisten.
 * - Reguläre Waren: effektive Produktion.
 * - Alles andere ist für Spielerbetriebe höchstens ineffektiv möglich (siehe businesses.ts).
 *
 * Kultur (nordisch/südlich) ergibt sich aus der Kartenposition: obere Kartenhälfte
 * (mapY < 50) ist nordisch. Nordische Städte haben im Winter reduzierte Anbauproduktion.
 */

export const CITY_IDS = [
  'NewArk',
  'Reach',
  'Valtirock',
  'Brenton',
  'Asteer',
  'Asteria',
  'Ashenharbor',
  'PortNyx',
  'Emberstead',
  'Whiteridge',
  'TheSpire',
  'Ebonfall',
  'Kargath',
  'Riverrun',
  'Eldrath',
  'Stormwatch',
  'Druumora',
  'Aetherion',
  'Umber',
  'Volthaven',
  'Eldrosa',
  'Nexara',
  'Bastion',
  'Zor',
  'Eos',
  'Moira',
] as const;

export type CityId = (typeof CITY_IDS)[number];
export type CitySize = 'small' | 'medium' | 'large';
export type Culture = 'north' | 'south';

export interface CityDef {
  id: CityId;
  name: string;
  size: CitySize;
  special: GoodId;
  regular: readonly GoodId[];
  mapX: number;
  mapY: number;
  culture: Culture;
}

/** Grenze zwischen nordischen und südlichen Städten auf der Karte (0–100). */
export const NORTH_SOUTH_BORDER_Y = 50;

type Row = Omit<CityDef, 'id' | 'culture'>;

const rows: Record<CityId, Row> = {
  NewArk: {
    name: 'New Ark',
    size: 'large',
    special: 'Grain',
    regular: ['Wood', 'Stone', 'Tools', 'Wool'],
    mapX: 78,
    mapY: 62,
  },
  Reach: {
    name: 'Reach',
    size: 'medium',
    special: 'JauxiteOre',
    regular: ['Stone', 'GhostIron', 'Wool', 'Marble'],
    mapX: 40,
    mapY: 30,
  },
  Valtirock: {
    name: 'Valtirock',
    size: 'medium',
    special: 'Marble',
    regular: ['Stone', 'JauxiteOre', 'Leather'],
    mapX: 36,
    mapY: 18,
  },
  Brenton: {
    name: 'Brenton',
    size: 'medium',
    special: 'Fruits',
    regular: ['Wood', 'Grain', 'Wool'],
    mapX: 15,
    mapY: 78,
  },
  Asteer: {
    name: 'Asteer',
    size: 'medium',
    special: 'Salt',
    regular: ['Fish', 'Wool', 'Leather'],
    mapX: 22,
    mapY: 45,
  },
  Asteria: {
    name: 'Asteria',
    size: 'large',
    special: 'Spices',
    regular: ['Fish', 'Silk', 'Wine', 'Ceramics'],
    mapX: 17,
    mapY: 58,
  },
  Ashenharbor: {
    name: 'Ashenharbor',
    size: 'medium',
    special: 'GhostIron',
    regular: ['Stone', 'JauxiteOre', 'Tools', 'JauxiteIgnot'],
    mapX: 58,
    mapY: 26,
  },
  PortNyx: {
    name: 'Port Nyx',
    size: 'medium',
    special: 'Oil',
    regular: ['Fish', 'Leather', 'Salt'],
    mapX: 73,
    mapY: 55,
  },
  Emberstead: {
    name: 'Emberstead',
    size: 'medium',
    special: 'JauxiteIgnot',
    regular: ['JauxiteOre', 'Tools', 'Stone'],
    mapX: 90,
    mapY: 33,
  },
  Whiteridge: {
    name: 'Whiteridge',
    size: 'small',
    special: 'FrostbiteOre',
    regular: ['Wool', 'Meat', 'Leather', 'Lunarite'],
    mapX: 60,
    mapY: 48,
  },
  TheSpire: {
    name: 'The Spire',
    size: 'small',
    special: 'MagicalEssence',
    regular: ['Faerybloom', 'RareFlowers', 'Herbs'],
    mapX: 93,
    mapY: 38,
  },
  Ebonfall: {
    name: 'Ebonfall',
    size: 'medium',
    special: 'Herbs',
    regular: ['Wood', 'Leather', 'Faerybloom'],
    mapX: 91,
    mapY: 47,
  },
  Kargath: {
    name: 'Kargath',
    size: 'medium',
    special: 'Meat',
    regular: ['Leather', 'Wool', 'Wood'],
    mapX: 75,
    mapY: 27,
  },
  Riverrun: {
    name: 'Riverrun',
    size: 'medium',
    special: 'Honey',
    regular: ['Grain', 'Fish', 'Fruits'],
    mapX: 19,
    mapY: 90,
  },
  Eldrath: {
    name: 'Eldrath',
    size: 'medium',
    special: 'Faerybloom',
    regular: ['Wood', 'RareFlowers', 'Herbs'],
    mapX: 15,
    mapY: 65,
  },
  Stormwatch: {
    name: 'Stormwatch',
    size: 'medium',
    special: 'Fish',
    regular: ['Salt', 'Stone', 'Wool'],
    mapX: 54,
    mapY: 44,
  },
  Druumora: {
    name: 'Druumora',
    size: 'small',
    special: 'DragonScales',
    regular: ['Meat', 'Stone', 'Leather', 'Riftsteel'],
    mapX: 82,
    mapY: 18,
  },
  Aetherion: {
    name: 'Aetherion',
    size: 'large',
    special: 'Silk',
    regular: ['Spices', 'Wine', 'Ceramics', 'Clothes'],
    mapX: 38,
    mapY: 20,
  },
  Umber: {
    name: 'Umber',
    size: 'medium',
    special: 'Tools',
    regular: ['JauxiteOre', 'GhostIron', 'Stone'],
    mapX: 46,
    mapY: 34,
  },
  Volthaven: {
    name: 'Volthaven',
    size: 'medium',
    special: 'Ceramics',
    regular: ['Fish', 'Wool', 'Oil', 'Soap'],
    mapX: 41,
    mapY: 52,
  },
  Eldrosa: {
    name: 'Eldrosa',
    size: 'small',
    special: 'RareFlowers',
    regular: ['Fruits', 'Honey', 'Wood'],
    mapX: 27,
    mapY: 84,
  },
  Nexara: {
    name: 'Nexara',
    size: 'large',
    special: 'Clothes',
    regular: ['Wool', 'Silk', 'Ceramics', 'Spices'],
    mapX: 56,
    mapY: 60,
  },
  Bastion: {
    name: 'Bastion',
    size: 'large',
    special: 'Soap',
    regular: ['Stone', 'Tools', 'GhostIron', 'Wool'],
    mapX: 79,
    mapY: 40,
  },
  Zor: {
    name: 'Zor',
    size: 'small',
    special: 'Riftsteel',
    regular: ['Salt', 'Spices', 'Stone', 'DragonScales'],
    mapX: 8,
    mapY: 20,
  },
  Eos: {
    name: 'Eos',
    size: 'medium',
    special: 'Wine',
    regular: ['Grain', 'Fruits', 'Honey'],
    mapX: 57,
    mapY: 74,
  },
  Moira: {
    name: 'Moira',
    size: 'small',
    special: 'Lunarite',
    regular: ['FrostbiteOre', 'Stone', 'MagicalEssence'],
    mapX: 70,
    mapY: 80,
  },
};

export const CITIES: Readonly<Record<CityId, CityDef>> = Object.fromEntries(
  CITY_IDS.map((id) => {
    const row = rows[id];
    const culture: Culture = row.mapY < NORTH_SOUTH_BORDER_Y ? 'north' : 'south';
    return [id, { ...row, id, culture }];
  }),
) as Record<CityId, CityDef>;

/** Startbevölkerung je Stadtgröße (Reiche, Wohlhabende, Arme) – aus Paragon übernommen. */
export const START_POPULATION: Readonly<Record<CitySize, { rich: number; wealthy: number; poor: number }>> = {
  small: { rich: 60, wealthy: 250, poor: 680 },
  medium: { rich: 160, wealthy: 600, poor: 1740 },
  large: { rich: 360, wealthy: 1300, poor: 3860 },
};

/** Die Stadt, in der jedes neue Spiel beginnt (sofern die Figur nichts anderes sagt). */
export const DEFAULT_START_CITY: CityId = 'NewArk';

export function isCityId(value: string): value is CityId {
  return (CITY_IDS as readonly string[]).includes(value);
}

/** Luftlinie auf der Karte (0–100 je Achse). */
export function mapDistance(a: CityId, b: CityId): number {
  const ca = CITIES[a];
  const cb = CITIES[b];
  return Math.hypot(ca.mapX - cb.mapX, ca.mapY - cb.mapY);
}
