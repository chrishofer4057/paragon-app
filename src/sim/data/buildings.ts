import type { GoodAmounts } from './goods';

/**
 * Gebäude außer den Produktionsbetrieben (Tippsammlung Kap. 2).
 *
 * Umbenennungen gegenüber dem Original:
 *   Kirche → Tempel, Kneipe → Taverne, Badhaus → Badehaus, Rathaus → Stadthaus,
 *   Darlehensgeber → Geldverleiher, Landesfürst → Landesherr, Hanse → Lia,
 *   Bürgermeister → Schultheiss, Eldermann → Landammann.
 */

// ---------------------------------------------------------------------------
// Private Gebäude: Kontor, Lagerhaus, Wohnhäuser
// ---------------------------------------------------------------------------

export interface PrivateBuildingDef {
  name: string;
  cost: number;
  materials: GoodAmounts;
  buildDays: number;
  landTaxPerWeek: number;
}

export const KONTOR: PrivateBuildingDef & { capacity: number } = {
  name: 'Kontor',
  cost: 4000,
  materials: { Stone: 20, Wood: 10, Tools: 5 },
  buildDays: 10,
  landTaxPerWeek: 150,
  capacity: 300,
};

export const WAREHOUSE: PrivateBuildingDef & { capacity: number } = {
  name: 'Lagerhaus',
  cost: 2500,
  materials: { Stone: 20, Wood: 10, Tools: 2 },
  buildDays: 8,
  landTaxPerWeek: 120,
  capacity: 200,
};

/** Miete für Lagerraum über der eigenen Kapazität (Tippsammlung 2.2.1.4: 1 GS je Last und Tag). */
export const OVERFLOW_STORAGE_COST_PER_UNIT_DAY = 1;
/** Lagerwache: Lohn pro Tag (Tippsammlung 2.2.1.4: 10 GS). */
export const GUARD_WAGE_PER_DAY = 10;
export const MAX_GUARDS = 5;

export const HOUSE_TYPE_IDS = ['cottage', 'gabledHouse', 'merchantHouse'] as const;
export type HouseTypeId = (typeof HOUSE_TYPE_IDS)[number];
export type PopulationClass = 'rich' | 'wealthy' | 'poor';

export interface HouseDef extends PrivateBuildingDef {
  id: HouseTypeId;
  tenantClass: PopulationClass;
  capacity: number;
  /** Miete pro Mieter und Woche auf normaler Stufe. */
  rentPerTenantWeek: number;
}

export const HOUSES: Readonly<Record<HouseTypeId, HouseDef>> = {
  cottage: {
    id: 'cottage',
    name: 'Fachwerkhaus',
    tenantClass: 'poor',
    capacity: 60,
    rentPerTenantWeek: 3,
    cost: 2500,
    materials: { Stone: 15, Wood: 15, Tools: 2 },
    buildDays: 10,
    landTaxPerWeek: 80,
  },
  gabledHouse: {
    id: 'gabledHouse',
    name: 'Giebelhaus',
    tenantClass: 'wealthy',
    capacity: 30,
    rentPerTenantWeek: 9,
    cost: 4000,
    materials: { Stone: 25, Wood: 10, Tools: 5 },
    buildDays: 15,
    landTaxPerWeek: 100,
  },
  merchantHouse: {
    id: 'merchantHouse',
    name: 'Kaufmannshaus',
    tenantClass: 'rich',
    capacity: 16,
    rentPerTenantWeek: 20,
    cost: 6000,
    materials: { Stone: 30, Wood: 10, Tools: 8, Marble: 2 },
    buildDays: 20,
    landTaxPerWeek: 120,
  },
};

/** Fünf Mietstufen (Tippsammlung 2.2.2.1). Niedrige Mieten bringen ein wenig soziales Ansehen. */
export const RENT_LEVELS: readonly { factor: number; socialPerTenantWeek: number }[] = [
  { factor: 0.6, socialPerTenantWeek: 0.0004 },
  { factor: 0.8, socialPerTenantWeek: 0.0002 },
  { factor: 1, socialPerTenantWeek: 0 },
  { factor: 1.25, socialPerTenantWeek: -0.0002 },
  { factor: 1.5, socialPerTenantWeek: -0.0004 },
];
export const DEFAULT_RENT_LEVEL = 2;

/** Stadt baut selbst nach, wenn die Belegung einer Schicht über diesem Wert liegt (2.2.2.2: 95 %). */
export const CITY_HOUSING_BUILD_THRESHOLD = 0.95;

// ---------------------------------------------------------------------------
// Infrastruktur (Tippsammlung 2.2.5) – vom Spieler gestiftet, gehört der Stadt
// ---------------------------------------------------------------------------

export const INFRASTRUCTURE_IDS = ['well', 'road', 'hospital', 'chapel', 'school', 'mint'] as const;
export type InfrastructureId = (typeof INFRASTRUCTURE_IDS)[number];

export interface InfrastructureDef {
  id: InfrastructureId;
  name: string;
  cost: number;
  materials: GoodAmounts;
  buildDays: number;
  /** Bedarf: eine Einheit je so vielen Einwohnern (null = einmalig bzw. Ausbaustufen). */
  perPopulation: number | null;
  /** Höchstzahl (Schule/Münze einmal, Straßen 4 × 25 %). */
  maxCount: number | null;
  /** Dauerhaftes Ansehen in der Stadt beim Stiften. */
  reputation: { social: number; societal: number };
}

export const INFRASTRUCTURE: Readonly<Record<InfrastructureId, InfrastructureDef>> = {
  well: {
    id: 'well',
    name: 'Brunnen',
    cost: 1500,
    materials: { Stone: 10, Wood: 2 },
    buildDays: 5,
    perPopulation: 500,
    maxCount: null,
    reputation: { social: 0.4, societal: 0.1 },
  },
  road: {
    id: 'road',
    name: 'Straßenausbau (+25 %)',
    cost: 2000,
    materials: { Stone: 30 },
    buildDays: 10,
    perPopulation: null,
    maxCount: 4,
    reputation: { social: 0.5, societal: 0.2 },
  },
  hospital: {
    id: 'hospital',
    name: 'Spital',
    cost: 6000,
    materials: { Stone: 30, Wood: 10, Tools: 5 },
    buildDays: 20,
    perPopulation: 2500,
    maxCount: null,
    reputation: { social: 1, societal: 0.3 },
  },
  chapel: {
    id: 'chapel',
    name: 'Kapelle',
    cost: 4000,
    materials: { Stone: 25, Wood: 10, Tools: 3 },
    buildDays: 15,
    perPopulation: 2500,
    maxCount: null,
    reputation: { social: 0.8, societal: 0.2 },
  },
  school: {
    id: 'school',
    name: 'Schule',
    cost: 8000,
    materials: { Stone: 40, Wood: 15, Tools: 5 },
    buildDays: 30,
    perPopulation: null,
    maxCount: 1,
    reputation: { social: 1.5, societal: 0.5 },
  },
  mint: {
    id: 'mint',
    name: 'Münze',
    cost: 12000,
    materials: { Stone: 40, Tools: 10, Lunarite: 5 },
    buildDays: 30,
    perPopulation: null,
    maxCount: 1,
    reputation: { social: 0.3, societal: 2 },
  },
};

/** Schule: +30 % Bettlerzustrom; Münze: +50 % Zuwanderung der Reichen; Spital: +10 % Wachstum (2.2.5.3). */
export const SCHOOL_BEGGAR_BONUS = 1.3;
export const MINT_RICH_BONUS = 1.5;
export const HOSPITAL_GROWTH_BONUS = 1.1;

// ---------------------------------------------------------------------------
// Tempel (Kirche, Tippsammlung 2.1.1.7)
// ---------------------------------------------------------------------------

export interface TempleStageDef {
  donationsNeeded: number;
  materials: GoodAmounts;
  buildDays: number;
  /** Dauerhafter Zufriedenheitsbonus für alle Schichten. */
  happiness: number;
}

/** Drei Ausbaustufen (20.000 / 40.000 / 60.000 GS, je 50 Ziegel, 20 Eisenwaren, 20 Holz). */
export const TEMPLE_STAGES: readonly TempleStageDef[] = [
  { donationsNeeded: 20_000, materials: { Stone: 50, Tools: 20, Wood: 20 }, buildDays: 30, happiness: 0.02 },
  { donationsNeeded: 40_000, materials: { Stone: 50, Tools: 20, Wood: 20 }, buildDays: 35, happiness: 0.02 },
  {
    donationsNeeded: 60_000,
    materials: { Stone: 50, Tools: 20, Wood: 20, Marble: 10 },
    buildDays: 42,
    happiness: 0.03,
  },
];
/** Der Priester kauft Baumaterial nur bis zu diesem Vielfachen des Basispreises. */
export const TEMPLE_MATERIAL_PRICE_LIMIT = 1.3;

/** Armenspeisung: diese Waren werden angenommen (Tippsammlung 2.1.1.7.2). */
export const ALMS_GOODS = ['Grain', 'Fish', 'Meat', 'Faerybloom', 'Wine'] as const;

// ---------------------------------------------------------------------------
// Marktplatz: Fest (Tippsammlung 2.1.1.12)
// ---------------------------------------------------------------------------

/** Verbrauch eines normalen Festes je 1000 Gäste. */
export const FESTIVAL_GOODS_PER_1000: GoodAmounts = {
  Faerybloom: 10,
  Wine: 10,
  Fish: 1,
  Meat: 1,
  Grain: 1.5,
  Honey: 5,
};
export const FESTIVAL_LEAD_DAYS = 21;
export const FESTIVAL_HAPPINESS_DAYS = 14;

// ---------------------------------------------------------------------------
// Marktstand (Fiera-Erweiterung, CLAUDE.md §2.4)
// ---------------------------------------------------------------------------

export const MARKET_STALL = {
  name: 'Marktstand',
  rentPerWeek: 25,
  /** Aufschlag beim persönlichen Verkauf an Bürger. */
  priceBonus: 0.15,
  /** Höchstens dieser Anteil des Tagesverbrauchs einer Ware lässt sich pro Tag am Stand verkaufen. */
  dailyDemandShare: 0.25,
  hoursPerSale: 1,
} as const;
