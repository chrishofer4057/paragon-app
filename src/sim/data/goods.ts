/**
 * Warenkatalog. Namen/IDs stammen aus dem Paragon-Projekt (ResourcesConstants.cs),
 * Basispreise sind aus den dortigen 7-Stufen-Preiskurven abgeleitet (Mittelwert aus
 * Kauf- und Verkaufspreis der mittleren Stufe).
 *
 * Korrekturen gegenüber Paragon (bewusst, siehe Entscheidungslog):
 * - Produktionsketten preislich konsistent gemacht (Erz < Barren < Riftstahl).
 * - Verbrauchswerte an die Patrizier-Verbrauchstabelle (Tippsammlung 3.4.3) angelehnt,
 *   wo Paragon offensichtliche Tippfehler hatte (z. B. Fleisch der Reichen 10x zu hoch).
 * - Salz wird wie im Original in "Fass" gerechnet (10x Menge, gleicher Preis je Einheit).
 *
 * Verbrauch: Einheiten pro 1000 Einwohner der jeweiligen Schicht und Woche.
 * importance: Gewicht der Ware für die Zufriedenheit (0 = egal, 1 = Grundnahrung).
 */

export const GOOD_IDS = [
  'Faerybloom',
  'Wood',
  'Stone',
  'JauxiteOre',
  'JauxiteIgnot',
  'Herbs',
  'Leather',
  'Wool',
  'Soap',
  'Grain',
  'Fish',
  'Meat',
  'Ceramics',
  'GhostIron',
  'Clothes',
  'Spices',
  'Fruits',
  'Tools',
  'Silk',
  'Oil',
  'Salt',
  'Honey',
  'FrostbiteOre',
  'Lunarite',
  'Riftsteel',
  'Wine',
  'RareFlowers',
  'Marble',
  'DragonScales',
  'MagicalEssence',
] as const;

export type GoodId = (typeof GOOD_IDS)[number];

/** Warengruppen nach Tippsammlung 3.2.2.1 (Scheffeltaktik). */
export type GoodCategory = 'staple' | 'consumer' | 'luxury' | 'material';

export interface ClassRates {
  rich: number;
  wealthy: number;
  poor: number;
}

export interface GoodDef {
  id: GoodId;
  name: string;
  /** Anzeigeeinheit; rein kosmetisch, die Simulation rechnet in Einheiten. */
  unit: 'Last' | 'Fass';
  category: GoodCategory;
  /** Gleichgewichtspreis bei Zielbestand (2 Wochen Bedarf). */
  basePrice: number;
  /** Wie stark der Preis auf Knappheit reagiert (Exponent der Preisformel). */
  elasticity: number;
  minFactor: number;
  maxFactor: number;
  consumptionPer1000: ClassRates;
  importance: number;
}

type GoodRow = Omit<GoodDef, 'id' | 'elasticity'> & { elasticity?: number };

const DEFAULT_ELASTICITY = 0.7;

const rows: Record<GoodId, GoodRow> = {
  // --- Grundversorgung (wichtig für die Armen) ---
  Faerybloom: {
    name: 'Feenblüte',
    unit: 'Fass',
    category: 'staple',
    basePrice: 82,
    minFactor: 0.38,
    maxFactor: 1.9,
    consumptionPer1000: { rich: 20, wealthy: 35, poor: 25 },
    importance: 0.9,
  },
  Grain: {
    name: 'Getreide',
    unit: 'Last',
    category: 'staple',
    basePrice: 178,
    minFactor: 0.31,
    maxFactor: 2.35,
    consumptionPer1000: { rich: 3.15, wealthy: 4.2, poor: 5.25 },
    importance: 1,
  },
  Fish: {
    name: 'Fisch',
    unit: 'Last',
    category: 'staple',
    basePrice: 580,
    minFactor: 0.38,
    maxFactor: 2.6,
    consumptionPer1000: { rich: 1.4, wealthy: 2.8, poor: 3.5 },
    importance: 1,
  },
  Wood: {
    name: 'Holz',
    unit: 'Last',
    category: 'staple',
    basePrice: 95,
    minFactor: 0.3,
    maxFactor: 2.27,
    consumptionPer1000: { rich: 2.8, wealthy: 2.8, poor: 3.2 },
    importance: 0.8,
  },
  // --- Konsumgüter ---
  Salt: {
    name: 'Salz',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 46,
    minFactor: 0.3,
    maxFactor: 2.37,
    consumptionPer1000: { rich: 3.5, wealthy: 3.5, poor: 3.5 },
    importance: 0.6,
  },
  Wool: {
    name: 'Wolle',
    unit: 'Last',
    category: 'consumer',
    basePrice: 476,
    minFactor: 0.3,
    maxFactor: 3,
    consumptionPer1000: { rich: 0.35, wealthy: 1.4, poor: 1.2 },
    importance: 0.8,
  },
  Oil: {
    name: 'Öl',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 105,
    minFactor: 0.3,
    maxFactor: 3,
    consumptionPer1000: { rich: 17.5, wealthy: 12.25, poor: 3.5 },
    importance: 0.75,
  },
  Ceramics: {
    name: 'Keramik',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 194,
    minFactor: 0.42,
    maxFactor: 3,
    consumptionPer1000: { rich: 10.5, wealthy: 6.3, poor: 4.2 },
    importance: 0.6,
  },
  Leather: {
    name: 'Leder',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 394,
    minFactor: 0.3,
    maxFactor: 2.23,
    consumptionPer1000: { rich: 15.4, wealthy: 12.25, poor: 1.75 },
    importance: 0.55,
  },
  Honey: {
    name: 'Honig',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 161,
    minFactor: 0.3,
    maxFactor: 2.65,
    consumptionPer1000: { rich: 17.5, wealthy: 8.75, poor: 1.75 },
    importance: 0.45,
  },
  Soap: {
    name: 'Seife',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 119,
    minFactor: 0.63,
    maxFactor: 2.43,
    consumptionPer1000: { rich: 2, wealthy: 3, poor: 3 },
    importance: 0.4,
  },
  Fruits: {
    name: 'Früchte',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 294,
    minFactor: 0.6,
    maxFactor: 2.26,
    consumptionPer1000: { rich: 6, wealthy: 5, poor: 2 },
    importance: 0.45,
  },
  Herbs: {
    name: 'Kräuter',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 245,
    minFactor: 0.6,
    maxFactor: 3,
    consumptionPer1000: { rich: 5, wealthy: 4, poor: 2 },
    importance: 0.4,
  },
  Tools: {
    name: 'Werkzeug',
    unit: 'Fass',
    category: 'consumer',
    basePrice: 479,
    minFactor: 0.3,
    maxFactor: 2.12,
    consumptionPer1000: { rich: 35, wealthy: 26.25, poor: 8.75 },
    importance: 0.35,
  },
  // --- Luxusgüter (wichtig für die Reichen) ---
  Meat: {
    name: 'Fleisch',
    unit: 'Last',
    category: 'luxury',
    basePrice: 507,
    minFactor: 0.53,
    maxFactor: 3,
    consumptionPer1000: { rich: 3.85, wealthy: 3.05, poor: 0.45 },
    importance: 0.85,
  },
  Clothes: {
    name: 'Kleidung',
    unit: 'Fass',
    category: 'luxury',
    basePrice: 374,
    minFactor: 0.3,
    maxFactor: 2.18,
    consumptionPer1000: { rich: 17.5, wealthy: 12.25, poor: 5.25 },
    importance: 0.7,
  },
  Wine: {
    name: 'Wein',
    unit: 'Fass',
    category: 'luxury',
    basePrice: 300,
    minFactor: 0.3,
    maxFactor: 2.79,
    consumptionPer1000: { rich: 52.5, wealthy: 13.3, poor: 0 },
    importance: 0.5,
  },
  Silk: {
    name: 'Seide',
    unit: 'Fass',
    category: 'luxury',
    basePrice: 691,
    minFactor: 0.65,
    maxFactor: 2.3,
    consumptionPer1000: { rich: 17.5, wealthy: 6, poor: 0 },
    importance: 0.4,
  },
  Spices: {
    name: 'Gewürze',
    unit: 'Fass',
    category: 'luxury',
    basePrice: 164,
    minFactor: 0.48,
    maxFactor: 3,
    consumptionPer1000: { rich: 1.4, wealthy: 0.7, poor: 0.7 },
    importance: 0.3,
  },
  RareFlowers: {
    name: 'Seltene Blumen',
    unit: 'Fass',
    category: 'luxury',
    basePrice: 822,
    minFactor: 0.77,
    maxFactor: 3,
    consumptionPer1000: { rich: 4, wealthy: 1.5, poor: 0 },
    importance: 0.25,
  },
  DragonScales: {
    name: 'Drachenschuppen',
    unit: 'Fass',
    category: 'luxury',
    basePrice: 1371,
    minFactor: 0.65,
    maxFactor: 3.35,
    consumptionPer1000: { rich: 1, wealthy: 0.2, poor: 0 },
    importance: 0.2,
  },
  MagicalEssence: {
    name: 'Magische Essenz',
    unit: 'Fass',
    category: 'luxury',
    basePrice: 2200,
    minFactor: 0.54,
    maxFactor: 3.5,
    consumptionPer1000: { rich: 1.2, wealthy: 0.4, poor: 0.05 },
    importance: 0.2,
  },
  // --- Rohstoffe und Baumaterial (kaum Einfluss auf die Zufriedenheit) ---
  Stone: {
    name: 'Stein',
    unit: 'Last',
    category: 'material',
    basePrice: 103,
    minFactor: 0.25,
    maxFactor: 2.18,
    consumptionPer1000: { rich: 2, wealthy: 2, poor: 1 },
    importance: 0,
  },
  Marble: {
    name: 'Marmor',
    unit: 'Last',
    category: 'material',
    basePrice: 726,
    minFactor: 0.37,
    maxFactor: 3.25,
    consumptionPer1000: { rich: 1.5, wealthy: 0.3, poor: 0 },
    importance: 0,
  },
  GhostIron: {
    name: 'Geistereisen',
    unit: 'Last',
    category: 'material',
    basePrice: 525,
    minFactor: 0.69,
    maxFactor: 2.86,
    consumptionPer1000: { rich: 0, wealthy: 0, poor: 0 },
    importance: 0,
  },
  JauxiteOre: {
    name: 'Jauxiterz',
    unit: 'Last',
    category: 'material',
    basePrice: 300,
    minFactor: 0.56,
    maxFactor: 3,
    consumptionPer1000: { rich: 0, wealthy: 0, poor: 0 },
    importance: 0,
  },
  JauxiteIgnot: {
    name: 'Jauxitbarren',
    unit: 'Last',
    category: 'material',
    basePrice: 800,
    minFactor: 0.6,
    maxFactor: 2.5,
    consumptionPer1000: { rich: 0.3, wealthy: 0.2, poor: 0 },
    importance: 0,
  },
  FrostbiteOre: {
    name: 'Frostbisserz',
    unit: 'Last',
    category: 'material',
    basePrice: 1410,
    minFactor: 0.7,
    maxFactor: 3,
    consumptionPer1000: { rich: 0, wealthy: 0, poor: 0 },
    importance: 0,
  },
  Lunarite: {
    name: 'Lunarit',
    unit: 'Last',
    category: 'material',
    basePrice: 700,
    minFactor: 0.69,
    maxFactor: 3.28,
    consumptionPer1000: { rich: 0.5, wealthy: 0.2, poor: 0 },
    importance: 0,
  },
  Riftsteel: {
    name: 'Riftstahl',
    unit: 'Last',
    category: 'material',
    basePrice: 3600,
    minFactor: 0.53,
    maxFactor: 3,
    consumptionPer1000: { rich: 0.3, wealthy: 0.1, poor: 0 },
    importance: 0,
  },
};

export const GOODS: Readonly<Record<GoodId, GoodDef>> = Object.fromEntries(
  GOOD_IDS.map((id) => {
    const row = rows[id];
    return [id, { ...row, id, elasticity: row.elasticity ?? DEFAULT_ELASTICITY }];
  }),
) as Record<GoodId, GoodDef>;

/** Baumaterial, das Bautrupps verbrauchen (Ziegel/Holz/Eisenwaren im Original). */
export const BUILDING_MATERIALS = ['Stone', 'Wood', 'Tools'] as const satisfies readonly GoodId[];

export function isGoodId(value: string): value is GoodId {
  return (GOOD_IDS as readonly string[]).includes(value);
}

export type GoodAmounts = Partial<Record<GoodId, number>>;
