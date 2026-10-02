import { GOODS, type GoodAmounts, type GoodId } from './goods';

/**
 * Betriebe (Tippsammlung Kap. 5). Werte sind Wochenwerte bei 100 % Auslastung und
 * effektiver Produktion; die Simulation rechnet sie stündlich herunter.
 *
 * Löhne werden nicht von Hand gepflegt, sondern so abgeleitet, dass die Stückkosten
 * bei effektiver Produktion ~62 % des Basispreises betragen (wie im Original:
 * Herstellungspreis Holz 55 GS bei Marktpreisen von 75–95 GS). Ineffektive Produktion
 * halbiert den Ausstoß bei gleichen Kosten und ist damit in der Regel ein Verlustgeschäft.
 */

export const BUSINESS_TYPE_IDS = [
  'woodcutter',
  'quarry',
  'grainFarm',
  'fishery',
  'faeryMeadow',
  'apiary',
  'vineyard',
  'saltworks',
  'sheepFarm',
  'cattleFarm',
  'pottery',
  'weaver',
  'ghostIronMine',
  'workshop',
  'oilMill',
  'soapery',
  'herbGarden',
  'orchard',
  'spiceGarden',
  'silkFarm',
  'marbleQuarry',
  'jauxiteMine',
  'jauxiteSmelter',
  'frostPit',
  'lunariteMine',
  'riftForge',
  'flowerGarden',
  'distillery',
  'dragonHunter',
] as const;

export type BusinessTypeId = (typeof BUSINESS_TYPE_IDS)[number];

/** Wo ein Betrieb ineffektiv (außerhalb der Stadt-Produktionsliste) gebaut werden darf. */
export type Climate = 'any' | 'south' | 'north' | 'listedOnly';

export interface BusinessDef {
  id: BusinessTypeId;
  name: string;
  outputs: GoodAmounts;
  inputs: GoodAmounts;
  workers: number;
  buildDays: number;
  buildCost: number;
  materials: GoodAmounts;
  /** Löhne pro Woche bei voller Belegschaft. */
  wagesPerWeek: number;
  /** Anbaubetriebe produzieren im Winter weniger (Tippsammlung 5.6.4). */
  winterFactor: number;
  /** Wo ineffektive Produktion möglich ist, falls die Stadt die Ware nicht listet. */
  ineffectiveClimate: Climate;
}

/** Grundsteuer pro Betrieb und Woche (Tippsammlung 5.6.3: 280 GS). */
export const BUSINESS_LAND_TAX_PER_WEEK = 280;
/** Zielverhältnis Stückkosten / Basispreis bei effektiver Produktion. */
export const BUSINESS_COST_RATIO = 0.62;
export const INEFFECTIVE_OUTPUT_FACTOR = 0.5;
/** Produktionsbonus ab 3/6/9 gleichartigen Betrieben in einer Stadt (Tippsammlung 5.6.2). */
export const PRODUCTION_BONUS_STEPS: readonly { count: number; factor: number }[] = [
  { count: 9, factor: 1.1 },
  { count: 6, factor: 1.06 },
  { count: 3, factor: 1.03 },
];

type Row = Omit<BusinessDef, 'id' | 'wagesPerWeek'>;

const STD_SMALL: GoodAmounts = { Stone: 25, Wood: 2, Tools: 2 };
const STD_MEDIUM: GoodAmounts = { Stone: 40, Wood: 10, Tools: 5 };
const STD_LARGE: GoodAmounts = { Stone: 50, Wood: 20, Tools: 20 };

const rows: Record<BusinessTypeId, Row> = {
  woodcutter: {
    name: 'Holzfällerei',
    outputs: { Wood: 14 },
    inputs: {},
    workers: 30,
    buildDays: 10,
    buildCost: 3000,
    materials: STD_SMALL,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  quarry: {
    name: 'Steinbruch',
    outputs: { Stone: 7 },
    inputs: { Wood: 0.1 },
    workers: 15,
    buildDays: 5,
    buildCost: 1000,
    materials: { Stone: 10, Wood: 1, Tools: 1 },
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  grainFarm: {
    name: 'Getreidehof',
    outputs: { Grain: 7 },
    inputs: {},
    workers: 30,
    buildDays: 10,
    buildCost: 3000,
    materials: STD_SMALL,
    winterFactor: 2 / 3,
    ineffectiveClimate: 'any',
  },
  fishery: {
    name: 'Fischerei',
    outputs: { Fish: 5.25 },
    inputs: { Salt: 14 },
    workers: 30,
    buildDays: 20,
    buildCost: 5000,
    materials: { Stone: 40, Wood: 5, Tools: 5, Wool: 2 },
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  faeryMeadow: {
    name: 'Feenblütenwiese',
    outputs: { Faerybloom: 35 },
    inputs: {},
    workers: 30,
    buildDays: 10,
    buildCost: 3000,
    materials: STD_SMALL,
    winterFactor: 0.5,
    ineffectiveClimate: 'any',
  },
  apiary: {
    name: 'Imkerei',
    outputs: { Honey: 14 },
    inputs: {},
    workers: 30,
    buildDays: 20,
    buildCost: 3000,
    materials: { Stone: 40, Wood: 10, Tools: 5 },
    winterFactor: 0.5,
    ineffectiveClimate: 'any',
  },
  vineyard: {
    name: 'Weingut',
    outputs: { Wine: 14 },
    inputs: {},
    workers: 30,
    buildDays: 40,
    buildCost: 8000,
    materials: STD_LARGE,
    winterFactor: 0.5,
    ineffectiveClimate: 'south',
  },
  saltworks: {
    name: 'Salzsiederei',
    outputs: { Salt: 35 },
    inputs: { Wood: 1.5 },
    workers: 30,
    buildDays: 10,
    buildCost: 3000,
    materials: STD_SMALL,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  sheepFarm: {
    name: 'Schafzucht',
    outputs: { Wool: 3.5 },
    inputs: {},
    workers: 30,
    buildDays: 40,
    buildCost: 8000,
    materials: STD_LARGE,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  cattleFarm: {
    name: 'Viehhof',
    outputs: { Meat: 1.75, Leather: 7 },
    inputs: { Salt: 5 },
    workers: 30,
    buildDays: 40,
    buildCost: 5000,
    materials: STD_LARGE,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  pottery: {
    name: 'Töpferei',
    outputs: { Ceramics: 14 },
    inputs: { Wood: 1.4 },
    workers: 30,
    buildDays: 20,
    buildCost: 5000,
    materials: { Stone: 40, Wood: 10, Tools: 10 },
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  weaver: {
    name: 'Weberei',
    outputs: { Clothes: 21 },
    inputs: { Wool: 2.1 },
    workers: 30,
    buildDays: 40,
    buildCost: 8000,
    materials: STD_LARGE,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  ghostIronMine: {
    name: 'Geistereisenmine',
    outputs: { GhostIron: 3.5 },
    inputs: {},
    workers: 30,
    buildDays: 20,
    buildCost: 10000,
    materials: { Stone: 10, Wood: 10, Tools: 10 },
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
  workshop: {
    name: 'Werkstatt',
    outputs: { Tools: 21 },
    inputs: { GhostIron: 2.1, Wood: 3.5 },
    workers: 30,
    buildDays: 40,
    buildCost: 8000,
    materials: STD_LARGE,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  oilMill: {
    name: 'Ölmühle',
    outputs: { Oil: 28 },
    inputs: {},
    workers: 30,
    buildDays: 20,
    buildCost: 5000,
    materials: STD_MEDIUM,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  soapery: {
    name: 'Seifensiederei',
    outputs: { Soap: 21 },
    inputs: { Oil: 4.2, Salt: 3 },
    workers: 30,
    buildDays: 20,
    buildCost: 5000,
    materials: STD_MEDIUM,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  herbGarden: {
    name: 'Kräutergarten',
    outputs: { Herbs: 14 },
    inputs: {},
    workers: 30,
    buildDays: 10,
    buildCost: 3000,
    materials: STD_SMALL,
    winterFactor: 0.5,
    ineffectiveClimate: 'any',
  },
  orchard: {
    name: 'Obstgarten',
    outputs: { Fruits: 14 },
    inputs: {},
    workers: 30,
    buildDays: 20,
    buildCost: 4000,
    materials: STD_MEDIUM,
    winterFactor: 0.5,
    ineffectiveClimate: 'south',
  },
  spiceGarden: {
    name: 'Gewürzgarten',
    outputs: { Spices: 14 },
    inputs: {},
    workers: 30,
    buildDays: 40,
    buildCost: 8000,
    materials: STD_LARGE,
    winterFactor: 0.5,
    ineffectiveClimate: 'listedOnly',
  },
  silkFarm: {
    name: 'Seidenraupenzucht',
    outputs: { Silk: 7 },
    inputs: { Fruits: 1.4 },
    workers: 30,
    buildDays: 40,
    buildCost: 8000,
    materials: STD_LARGE,
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
  marbleQuarry: {
    name: 'Marmorbruch',
    outputs: { Marble: 3.5 },
    inputs: { Tools: 0.4 },
    workers: 30,
    buildDays: 20,
    buildCost: 6000,
    materials: { Stone: 20, Wood: 10, Tools: 10 },
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
  jauxiteMine: {
    name: 'Jauxitmine',
    outputs: { JauxiteOre: 7 },
    inputs: { Wood: 0.7 },
    workers: 30,
    buildDays: 20,
    buildCost: 8000,
    materials: { Stone: 20, Wood: 10, Tools: 10 },
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
  jauxiteSmelter: {
    name: 'Jauxitschmelze',
    outputs: { JauxiteIgnot: 3.5 },
    inputs: { JauxiteOre: 2.5, Wood: 1.5 },
    workers: 30,
    buildDays: 20,
    buildCost: 8000,
    materials: STD_MEDIUM,
    winterFactor: 1,
    ineffectiveClimate: 'any',
  },
  frostPit: {
    name: 'Frostgrube',
    outputs: { FrostbiteOre: 2 },
    inputs: { Tools: 0.4 },
    workers: 30,
    buildDays: 30,
    buildCost: 10000,
    materials: { Stone: 30, Wood: 10, Tools: 15 },
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
  lunariteMine: {
    name: 'Lunaritmine',
    outputs: { Lunarite: 3 },
    inputs: { Tools: 0.4 },
    workers: 30,
    buildDays: 30,
    buildCost: 10000,
    materials: { Stone: 30, Wood: 10, Tools: 15 },
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
  riftForge: {
    name: 'Riftschmiede',
    outputs: { Riftsteel: 2 },
    inputs: { JauxiteIgnot: 2, FrostbiteOre: 1 },
    workers: 30,
    buildDays: 40,
    buildCost: 14000,
    materials: { Stone: 50, Wood: 20, Tools: 30 },
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
  flowerGarden: {
    name: 'Wildblumengarten',
    outputs: { RareFlowers: 3.5 },
    inputs: {},
    workers: 30,
    buildDays: 20,
    buildCost: 6000,
    materials: { Stone: 30, Wood: 10, Tools: 5 },
    winterFactor: 0.5,
    ineffectiveClimate: 'listedOnly',
  },
  distillery: {
    name: 'Essenzdestillerie',
    outputs: { MagicalEssence: 1.4 },
    inputs: { RareFlowers: 1, Faerybloom: 3.5 },
    workers: 30,
    buildDays: 40,
    buildCost: 16000,
    materials: { Stone: 50, Wood: 20, Tools: 30 },
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
  dragonHunter: {
    name: 'Drachenjägerhütte',
    outputs: { DragonScales: 1.4 },
    inputs: { Tools: 0.7 },
    workers: 30,
    buildDays: 30,
    buildCost: 12000,
    materials: { Stone: 30, Wood: 15, Tools: 20 },
    winterFactor: 1,
    ineffectiveClimate: 'listedOnly',
  },
};

function valueOf(amounts: GoodAmounts): number {
  let total = 0;
  for (const [good, amount] of Object.entries(amounts) as [GoodId, number][]) {
    total += GOODS[good].basePrice * amount;
  }
  return total;
}

function deriveWages(row: Row): number {
  const target =
    valueOf(row.outputs) * BUSINESS_COST_RATIO - valueOf(row.inputs) - BUSINESS_LAND_TAX_PER_WEEK;
  // Untergrenze: niemand arbeitet für weniger als 3 GS pro Woche.
  return Math.max(row.workers * 3, Math.round(target));
}

export const BUSINESSES: Readonly<Record<BusinessTypeId, BusinessDef>> = Object.fromEntries(
  BUSINESS_TYPE_IDS.map((id) => {
    const row = rows[id];
    return [id, { ...row, id, wagesPerWeek: deriveWages(row) }];
  }),
) as Record<BusinessTypeId, BusinessDef>;

const BUSINESS_BY_OUTPUT: Partial<Record<GoodId, BusinessDef>> = {};
for (const id of BUSINESS_TYPE_IDS) {
  const def = BUSINESSES[id];
  for (const good of Object.keys(def.outputs) as GoodId[]) BUSINESS_BY_OUTPUT[good] ??= def;
}

/** Welcher Betrieb stellt eine Ware her. */
export function businessForGood(good: GoodId): BusinessDef | undefined {
  return BUSINESS_BY_OUTPUT[good];
}
