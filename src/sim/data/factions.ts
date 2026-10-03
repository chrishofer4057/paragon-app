/**
 * Fraktionen der Lia und Verruf (CLAUDE.md §2.2, Mittelteil): Wohlwollen gewinnt man durch
 * Taten, ein Bündnis mit genau einer Fraktion bringt Vorteile und verärgert deren Rivalen.
 * Unsaubere Geschäfte (Bestechung, Schmuggel) bringen schnelles Geld, aber Verruf.
 */

export const FACTION_IDS = ['merchants', 'temple', 'harbour'] as const;
export type FactionId = (typeof FACTION_IDS)[number];

export interface FactionDef {
  id: FactionId;
  name: string;
  description: string;
  /** Was ein Bündnis bringt (Spielertext). */
  pledgeBenefit: string;
  rival: FactionId;
}

export const FACTIONS: Readonly<Record<FactionId, FactionDef>> = {
  merchants: {
    id: 'merchants',
    name: 'Kaufmannsgilde',
    description:
      'Die ehrbaren Kaufleute der Lia. Schätzen Gildentreue und erfüllte Aufträge, verachten Schmuggler.',
    pledgeBenefit: 'Bessere Preise beim persönlichen Handel.',
    rival: 'harbour',
  },
  temple: {
    id: 'temple',
    name: 'Tempelorden',
    description:
      'Priester und Armenpfleger. Belohnen Gebet, Spenden und Armenspeisung, verabscheuen Bestechung.',
    pledgeBenefit: 'Schutz vor willkürlichen Anklagen.',
    rival: 'harbour',
  },
  harbour: {
    id: 'harbour',
    name: 'Hafenbruderschaft',
    description: 'Seeleute, Schauerleute und Schmuggler. Wer zahlt und schweigt, findet hier Freunde.',
    pledgeBenefit: 'Sichererer Schmuggel und billigere Matrosen.',
    rival: 'merchants',
  },
};

export const FACTION_BALANCE = {
  minFavor: -100,
  maxFavor: 100,
  /** Ab diesem Wohlwollen ist ein Bündnis möglich. */
  pledgeMinFavor: 25,
  /** Einmaliger Verlust beim Rivalen, wenn man sich verbündet. */
  pledgeRivalPenalty: 20,
  /** Verlust bei der alten Fraktion, wenn man das Bündnis löst oder wechselt. */
  leavePenalty: 30,
  pledgeCooldownDays: 60,
  /** Ab diesem Wohlwollen gibt es kleine Vorteile auch ohne Bündnis. */
  favoredThreshold: 50,
  merchantTradeBonusFavored: 0.02,
  merchantTradeBonusPledged: 0.04,
  /** Faktor auf die Anklagewahrscheinlichkeit. */
  templeAccusationFavored: 0.5,
  templeAccusationPledged: 0,
  harbourCatchFavored: 0.75,
  harbourCatchPledged: 0.5,
  harbourSailorFeePledged: 0.7,
} as const;

/** Wohlwollen für Taten. */
export const FAVOR_GAINS = {
  joinGuild: { merchants: 15 },
  deliverContract: { merchants: 3 },
  deliverQuest: { merchants: 2 },
  /** je 100 GS Spende, höchstens `donationMax` je Spende */
  donationPer100: { temple: 1 },
  donationMax: 10,
  pray: { temple: 1 },
  alms: { temple: 3 },
  buyInformation: { harbour: 2 },
  hireSailors: { harbour: 1 },
  bribe: { temple: -4, harbour: 1 },
  smuggleSuccess: { harbour: 3, merchants: -2 },
  smuggleCaught: { merchants: -5, harbour: 1 },
  investigation: { merchants: -3 },
} as const satisfies Record<string, Partial<Record<FactionId, number>> | number>;

export const SMUGGLING = {
  /** Erlös relativ zum normalen Marktverkauf (kein Zoll, keine Marktspanne). */
  priceFactor: 1.3,
  baseCatchChance: 0.15,
  /** Verruf macht verdächtig: +x je Verrufspunkt (relativ). */
  catchPerNotoriety: 0.01,
  maxCatchChance: 0.8,
  /** Buße als Vielfaches des Warenwerts; die Ware wird beschlagnahmt. */
  fineFactor: 1.5,
  minHarbourFavor: 10,
  busyHours: 2,
  /** Ansehensverlust bei den Reichen, wenn man erwischt wird. */
  caughtSocietal: 2,
} as const;

export const NOTORIETY = {
  max: 100,
  bribe: 10,
  smuggleSuccess: 6,
  smuggleCaught: 25,
  weeklyDecay: 3,
  /** Ab hier ermittelt die Stadtwache. */
  investigationThreshold: 30,
  /** Wochenchance = (Verruf − Schwelle + 10) / 100 × Faktor */
  investigationFactor: 0.6,
  investigationFineShare: 0.05,
  investigationMinFine: 50,
  investigationSocietal: 3,
  /** Nach einer Ermittlung ist ein Teil vergessen. */
  investigationRelief: 10,
  /** Stimmenverlust bei Wahlen je Verrufspunkt. */
  electionPenaltyPerPoint: 0.1,
} as const;

/** Wie der Verruf genannt wird (Spielertext). */
export function notorietyLabel(value: number): string {
  if (value < 10) return 'unbescholten';
  if (value < 30) return 'man munkelt';
  if (value < 60) return 'verrufen';
  return 'berüchtigt';
}
