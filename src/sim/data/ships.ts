import type { GoodAmounts } from './goods';

/**
 * Schiffstypen (Tippsammlung 4.1, umbenannt): Schute ≈ Schnigge, Kaag ≈ Kraier,
 * Kogge, Nef ≈ Holk. Geschwindigkeit in Kartenpunkten pro Tag (Karte 0–100).
 */

export const SHIP_TYPE_IDS = ['schute', 'kaag', 'kogge', 'nef'] as const;
export type ShipTypeId = (typeof SHIP_TYPE_IDS)[number];

export interface ShipTypeDef {
  id: ShipTypeId;
  name: string;
  capacity: number;
  speedPerDay: number;
  cost: number;
  materials: GoodAmounts;
  /** Bauzeit bei einer unerfahrenen Werft. */
  baseBuildDays: number;
  minCrew: number;
  maxCrew: number;
}

export const SHIP_TYPES: Readonly<Record<ShipTypeId, ShipTypeDef>> = {
  schute: {
    id: 'schute',
    name: 'Schute',
    capacity: 50,
    speedPerDay: 16,
    cost: 6000,
    materials: { Wood: 30, Tools: 5, Oil: 10, Wool: 3 },
    baseBuildDays: 40,
    minCrew: 5,
    maxCrew: 20,
  },
  kaag: {
    id: 'kaag',
    name: 'Kaag',
    capacity: 70,
    speedPerDay: 20,
    cost: 9000,
    materials: { Wood: 40, Tools: 8, Oil: 14, Wool: 4 },
    baseBuildDays: 55,
    minCrew: 8,
    maxCrew: 28,
  },
  kogge: {
    id: 'kogge',
    name: 'Kogge',
    capacity: 120,
    speedPerDay: 10,
    cost: 14000,
    materials: { Wood: 60, Tools: 12, Oil: 20, Wool: 6 },
    baseBuildDays: 75,
    minCrew: 10,
    maxCrew: 40,
  },
  nef: {
    id: 'nef',
    name: 'Nef',
    capacity: 150,
    speedPerDay: 12,
    cost: 20000,
    materials: { Wood: 70, Tools: 15, Oil: 25, Wool: 8, Riftsteel: 4 },
    baseBuildDays: 90,
    minCrew: 12,
    maxCrew: 50,
  },
};

/** Matrosenlohn pro Tag (Tippsammlung 2.1.1.1.1: 2 GS) und Kapitänslohn. */
export const SAILOR_WAGE_PER_DAY = 2;
export const CAPTAIN_WAGE_PER_DAY = 15;
export const CAPTAIN_HIRE_FEE = 300;
/** Ohne Kapitän steuert ein Matrose und kassiert doppelten Lohn. */
export const HELMSMAN_EXTRA_WAGE = SAILOR_WAGE_PER_DAY;

/** Werft (Tippsammlung 2.1.1.9.6): Erfahrung durch Aufträge verkürzt Bauzeiten, Flaute baut sie ab. */
export const SHIPYARD = {
  maxLevel: 4,
  xpPerLevel: 3,
  /** Bauzeit-Faktor je Stufe. */
  buildTimeFactorPerLevel: 0.1,
  /** Kapazitätsplus je Stufe (bessere Rumpfvarianten). */
  capacityBonusPerLevel: 0.05,
  /** Wochen ohne Auftrag, nach denen eine Stufe Erfahrung verfällt. */
  idleWeeksPerDecay: 8,
  repairDaysPerTenPercent: 2,
  /** Reparaturkosten als Anteil des Neupreises für 100 % Schaden. */
  repairCostFactor: 0.35,
} as const;

/** Verschleiß pro Tag auf See (Prozentpunkte des Zustands). */
export const SHIP_WEAR_PER_DAY = 0.4;
/** Unter diesem Zustand verweigert die Mannschaft die Ausfahrt. */
export const SHIP_MIN_CONDITION_TO_SAIL = 15;

/** Überfahrt als Passagier ohne eigenes Schiff. */
export const PASSAGE = {
  farePerDistance: 2,
  speedPerDay: 14,
} as const;

/** Linienschiffe / Frachtraum mieten (Stufe 3). */
export const CARGO_RENTAL = {
  pricePerUnitPerDistance: 0.12,
  /** Provision des Kapitäns beim Mitgeben (Option B, CLAUDE.md §2.5). */
  captainCommission: 0.12,
  /** Erlös des Kapitäns im Vergleich zum persönlichen Verkauf. */
  captainPriceFactor: 0.93,
} as const;
