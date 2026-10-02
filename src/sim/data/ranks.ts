/**
 * Ränge und Aufstiegsleiter.
 *
 * Kombination aus der Fiera-Aufstiegsleiter (CLAUDE.md §2.2: Tagelöhner → Stadthändler →
 * Frachtmieter → Reeder → Patrizier) und den Rängen aus der Tippsammlung (6.1.2:
 * Krämer … Patrizier, Bürgermeister, Eldermann). Für jeden Aufstieg braucht es
 * Unternehmenswert UND Ansehen – soziales (Arme) und gesellschaftliches (Reiche).
 *
 * Ansehen wird in Prozentpunkten gemessen: 100 = Anforderung an den Landammann
 * (Eldermann). Werte über 100 sind möglich.
 *
 * Die frühen Schwellen sind gegenüber dem Original stark gesenkt, weil Fiera mittellos
 * beginnt. Ab dem Ratsherrn gelten die Originalwerte.
 */

export const RANK_IDS = [
  'dayLaborer',
  'huckster',
  'trader',
  'merchant',
  'distanceMerchant',
  'councilor',
  'patrician',
  'mayor',
  'landammann',
] as const;
export type RankId = (typeof RANK_IDS)[number];

export const PERMISSIONS = [
  'gather',
  'dayJobs',
  'sellToMarket',
  'tradeFreely',
  'rentStall',
  'cityContracts',
  'rentCargo',
  'foundKontor',
  'buildWarehouse',
  'ownShips',
  'buildBusinesses',
  'buildHouses',
  'fundInfrastructure',
  'foundKontorAbroad',
  'hireManager',
  'hireCaptain',
  'councilMotions',
  'gateTrade',
  'runForMayor',
  'cityTreasury',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface RankDef {
  id: RankId;
  name: string;
  /** Fiera-Stufe aus CLAUDE.md §2.2 (1–5). */
  stage: 1 | 2 | 3 | 4 | 5;
  stageName: string;
  netWorth: number;
  social: number;
  societal: number;
  requiresHomeGuild: boolean;
  /** Ämter werden gewählt, nicht automatisch erreicht. */
  elected: boolean;
  /** Neu hinzukommende Rechte (kumulativ zu allen niedrigeren Rängen). */
  grants: readonly Permission[];
}

export const RANKS: Readonly<Record<RankId, RankDef>> = {
  dayLaborer: {
    id: 'dayLaborer',
    name: 'Tagelöhner',
    stage: 1,
    stageName: 'Tagelöhner',
    netWorth: 0,
    social: 0,
    societal: 0,
    requiresHomeGuild: false,
    elected: false,
    grants: ['gather', 'dayJobs', 'sellToMarket'],
  },
  huckster: {
    id: 'huckster',
    name: 'Krämer',
    stage: 2,
    stageName: 'Stadthändler',
    netWorth: 300,
    social: 0.3,
    societal: 0.15,
    requiresHomeGuild: false,
    elected: false,
    grants: ['tradeFreely', 'rentStall', 'cityContracts'],
  },
  trader: {
    id: 'trader',
    name: 'Händler',
    stage: 3,
    stageName: 'Frachtmieter',
    netWorth: 3000,
    social: 1.5,
    societal: 1.5,
    requiresHomeGuild: false,
    elected: false,
    grants: ['rentCargo', 'foundKontor', 'buildWarehouse'],
  },
  merchant: {
    id: 'merchant',
    name: 'Kaufmann',
    stage: 4,
    stageName: 'Reeder',
    netWorth: 20_000,
    social: 4,
    societal: 5,
    requiresHomeGuild: false,
    elected: false,
    grants: ['ownShips', 'buildBusinesses', 'buildHouses', 'fundInfrastructure', 'foundKontorAbroad'],
  },
  distanceMerchant: {
    id: 'distanceMerchant',
    name: 'Fernkaufmann',
    stage: 5,
    stageName: 'Patrizier',
    netWorth: 80_000,
    social: 5,
    societal: 10,
    requiresHomeGuild: true,
    elected: false,
    grants: ['hireManager', 'hireCaptain'],
  },
  councilor: {
    id: 'councilor',
    name: 'Ratsherr',
    stage: 5,
    stageName: 'Patrizier',
    netWorth: 500_000,
    social: 10,
    societal: 15,
    requiresHomeGuild: false,
    elected: false,
    grants: ['councilMotions', 'gateTrade'],
  },
  patrician: {
    id: 'patrician',
    name: 'Patrizier',
    stage: 5,
    stageName: 'Patrizier',
    netWorth: 900_000,
    social: 50,
    societal: 50,
    requiresHomeGuild: false,
    elected: false,
    grants: ['runForMayor'],
  },
  mayor: {
    id: 'mayor',
    name: 'Schultheiss',
    stage: 5,
    stageName: 'Patrizier',
    netWorth: 0,
    social: 75,
    societal: 75,
    requiresHomeGuild: false,
    elected: true,
    grants: ['cityTreasury'],
  },
  landammann: {
    id: 'landammann',
    name: 'Landammann der Lia',
    stage: 5,
    stageName: 'Patrizier',
    netWorth: 0,
    social: 100,
    societal: 100,
    requiresHomeGuild: false,
    elected: true,
    grants: [],
  },
};

export function rankIndex(rank: RankId): number {
  return RANK_IDS.indexOf(rank);
}

/** Alle Rechte bis einschließlich des gegebenen Rangs. */
export function permissionsUpTo(rank: RankId): ReadonlySet<Permission> {
  const result = new Set<Permission>();
  for (const id of RANK_IDS.slice(0, rankIndex(rank) + 1)) {
    for (const p of RANKS[id].grants) result.add(p);
  }
  return result;
}

/** Ränge, die durch die monatliche Prüfung erreicht werden können (keine Ämter). */
export const EARNED_RANKS: readonly RankId[] = RANK_IDS.filter(
  (r) => !RANKS[r].elected && r !== 'dayLaborer',
);

/**
 * "Meinung der Bürger" (Tippsammlung 6.1.3.4) – eine Textstufe je Rangschwelle, damit
 * Spieler ihr Ansehen ohne Zahlen einschätzen können.
 */
export const CITIZEN_OPINIONS: readonly { minRank: RankId | null; text: string }[] = [
  { minRank: null, text: 'will niemand mit Euch zu tun haben' },
  { minRank: 'huckster', text: 'kennt Euch kaum jemand' },
  { minRank: 'trader', text: 'kennen Euch einige' },
  { minRank: 'merchant', text: 'kennen Euch viele' },
  { minRank: 'distanceMerchant', text: 'sind Euch einige dankbar' },
  { minRank: 'councilor', text: 'sind Euch viele dankbar' },
  { minRank: 'patrician', text: 'seid Ihr gut im Rennen' },
  { minRank: 'mayor', text: 'sehen Euch als Schultheiss' },
];
