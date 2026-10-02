/**
 * Zentrale Balancing-Werte (CLAUDE.md §10: nie in der Logik hart kodieren).
 * Werte, die zu einem bestimmten Gebäude/einer Ware gehören, stehen in deren Datei.
 */

export const TIME = {
  hoursPerDay: 24,
  daysPerWeek: 7,
  daysPerMonth: 30,
  monthsPerYear: 12,
  startYear: 1350,
  /** Spiel beginnt im März (0-basiert), damit der erste Winter nicht sofort kommt. */
  startMonth: 2,
  startHour: 7,
  /** Wintermonate (0-basiert): Dezember, Januar, Februar (Tippsammlung 5.6.4.1). */
  winterMonths: [11, 0, 1] as readonly number[],
} as const;

export const MARKET = {
  /** Zielbestand = so viele Wochen Bedarf (Tippsammlung: "Vorräte für zwei Wochen"). */
  targetWeeks: 2,
  /** Mindestzielbestand für Waren ohne Bedarf in einer Stadt, skaliert mit Stadtgröße. */
  minTargetPer1000: 4,
  /** Abstand zwischen Kauf- und Verkaufspreis (gesamt). */
  spread: 0.12,
  /** Startbestand relativ zum Ziel. */
  startStockProduced: 1.2,
  startStockImported: 0.7,
  /** Unter so vielen Wochen Vorrat gilt eine Ware als knapp. */
  shortageWeeks: 1,
  /** Tagelöhner dürfen pro Tag nur so viel je Ware für den Eigenbedarf kaufen. */
  dayLaborerDailyBuyLimit: 5,
} as const;

export const WORLD = {
  /** Städtische Betriebe decken den Weltbedarf mit leichtem Überschuss (wie Paragon: 1,08); Lücken entstehen durch Verteilung und Wachstum. */
  citySupplyRatio: 1.08,
  specialtyShareWeight: 3,
  regularShareWeight: 1,
  /** Spezialwaren sind am Herkunftsort günstiger. */
  specialtyPriceFactor: 0.9,
  /** Bettler zu Spielbeginn als Anteil der Bevölkerung. */
  startBeggarShare: 0.04,
  /** Städte haben zu Beginn etwas freien Wohnraum. */
  startHousingSlack: 1.04,
  /** Bautrupps je Stadt: Grundwert plus einer je so vielen Einwohnern. */
  baseBuilderCrews: 2,
  builderCrewPerPopulation: 2500,
  startTreasuryPerCapita: 4,
  notablesPerCity: 4,
} as const;

/** Hintergrundhandel der KI-Händler, damit Städte ohne eigene Produktion nicht verhungern. */
export const NPC_TRADE = {
  /** Anteil des Überschusses über dem Ziel, den KI-Händler pro Tag aufkaufen. */
  surplusRate: 0.2,
  /** Anteil der Lücke zum Ziel, den Mangelstädte pro Tag nachfragen. */
  deficitRate: 0.25,
  /** Über diesem Vielfachen des Ziels gilt Ware als Überschuss. */
  surplusThreshold: 1.1,
  /** Unter diesem Vielfachen des Ziels wird nachgefragt. */
  deficitThreshold: 0.9,
  /** Schwund/Eigenverbrauch der Händler unterwegs. */
  efficiency: 0.95,
  minTransitDays: 1,
  maxTransitDays: 4,
} as const;

export const POPULATION = {
  /** Ziel-Wochen Vorrat für volle Zufriedenheit (Tippsammlung 2.1.2.2.3). */
  targetWeeks: 2,
  /** Anteilsgrenzen ohne Bettler (Tippsammlung 3.1.2). */
  shares: {
    rich: { min: 0.06, max: 0.24 },
    wealthy: { min: 0.15, max: 0.32 },
    poor: { min: 0.44, max: 0.8 },
  },
  /** Tägliche Wanderungsrate je Zufriedenheitsstufe (0 = verärgert … 5 = sehr glücklich). */
  dailyGrowthByLevel: [-0.004, -0.0012, 0.0008, 0.0016, 0.0024, 0.0032] as readonly number[],
  /** Grenzwerte des Zufriedenheitswerts für die sechs Stufen. */
  levelThresholds: [0.2, 0.4, 0.55, 0.7, 0.85] as readonly number[],
  /** Bettlerzustrom pro Tag relativ zur Bevölkerung bei voller Zufriedenheit der Armen. */
  beggarInflowRate: 0.003,
  beggarCapShare: 0.12,
  /** Abwanderung der Bettler, wenn die Armen unzufrieden sind. */
  beggarOutflowRate: 0.02,
  /** Anteil der Bettler über der Obergrenze, der täglich weiterzieht. */
  beggarExcessOutflowRate: 0.1,
  /** Arbeitslose Arme, die eine Stadt duldet (Anteil der Arbeitsplätze). */
  unemployedTolerance: 0.08,
  /** Anteil der überzähligen Arbeitslosen, der täglich wegzieht (die Hälfte wird zu Bettlern). */
  unemployedOutflowRate: 0.1,
  /** Default-Kopfsteuer (Tippsammlung 2.1.1.3.3: 10 %). */
  defaultHeadTax: 0.1,
  maxHeadTax: 0.2,
  /** Zufriedenheit je Prozentpunkt Kopfsteuer unter/über 10 %. */
  headTaxHappinessPerPoint: 0.012,
  /** Kopfsteuer pro Einwohner und Tag bei 100 % Steuersatz. */
  headTaxIncomePerCapitaDay: 0.6,
  housingShortagePenalty: 0.15,
  wellShortagePenalty: 0.04,
  roadBonusPerStep: 0.01,
  festivalHappiness: 0.12,
  plagueHappinessPenalty: 0.2,
  /** Armenspeisung: Bettlerzustrom-Faktor für einen Tag (Tippsammlung 2.1.1.7.2: 4,5–5). */
  almsBeggarFactor: 4.5,
  /** Benötigter Warenwert für eine erfolgreiche Armenspeisung je Einwohner. */
  almsValuePerCapita: 0.15,
} as const;

export const REPUTATION = {
  /** Tägliches Abklingen des zeitlich begrenzten Ansehens (Tippsammlung 6.3.1: "wirkt nur temporär"). */
  dailyDecay: 0.012,
  /** Ansehen pro GS Umsatz beim Verkauf (vor Knappheitsfaktor). */
  tradePerValue: 0.00004,
  /** Einkäufe schmälern das Ansehen (relativ zu Verkäufen). */
  purchaseFactor: 0.6,
  /** Knappheitsfaktor: (Ziel / Bestand) begrenzt auf diesen Bereich. */
  scarcityMin: 0.4,
  scarcityMax: 3,
  /** Anteil des Handelsansehens, der auch bei den Armen ankommt (nur Grundversorgung/Konsum). */
  tradeSocialShareStaple: 0.8,
  tradeSocialShareOther: 0.3,
  /** Persönlicher Verkauf wird stärker wahrgenommen als der durch den Verwalter. */
  personalTradeFactor: 1.5,
  /** Ansehen je beschäftigtem Arbeiter in eigenen Betrieben (Tippsammlung 6.3.2.1). */
  perWorkerSocial: 0.04,
  perWorkerSocietal: 0.03,
  /** Ansehen je bereitgestelltem Wohnplatz. */
  perHousingSlotSocial: 0.006,
  kontorSocietal: 0.5,
  guildMemberSocietal: 2,
  /** Globales Ansehen aus Unternehmenswert (bis 900.000 GS, Tippsammlung 6.3.2.2). */
  netWorthGlobalMax: 8,
  netWorthGlobalCap: 900_000,
  shipGlobalPerShip: 0.3,
  shipGlobalMax: 4,
  /** Tempelspende: Ansehen je GS ("kaum wahrnehmbar"). */
  donationPerGold: 0.00006,
  prayerSocial: 0.05,
  bathSocietal: 0.03,
  almsSocial: 0.6,
  festivalMax: { social: 3, societal: 2 },
  contractFactor: 2,
  questFlat: 0.3,
  dayJobSocial: 0.04,
  /** "Fleiß wird bemerkt": auch die Reichen nehmen zuverlässige Arbeit wahr. */
  dayJobSocietal: 0.025,
  loanGivenSocietal: 0.2,
  loanDefaultSocietalPenalty: 3,
  accusationPenalty: 1.5,
  /** Monatliches Minus der Stadtkasse unter dem Schultheiss kostet Ansehen (2.1.1.3.6). */
  treasuryDeficitPenalty: 0.5,
} as const;

export const ACCUSATIONS = {
  /** Mindestens alle drei Wochen beten und baden (Tippsammlung 2.1.1.6.1 / 2.1.1.7.1). */
  graceDays: 21,
  weeklyChance: 0.15,
  fineShareOfNetWorth: 0.01,
  minFine: 50,
} as const;

export const KONTOR_MANAGER = {
  hireFee: 500,
  /** Tageslohn: Pauschale + 1 GS je eigenem Gebäude in der Stadt (Tippsammlung 3.3.2.2). */
  baseWagePerDay: 10,
  wagePerBuildingPerDay: 1,
  /** Bei Anwesenheit des Spielers handelt der Verwalter etwas geschickter. */
  presencePriceBonus: 0.02,
} as const;

export const BURGLARY = {
  weeklyChancePerWarehouse: 0.04,
  guardReduction: 0.18,
  stolenShareMin: 0.1,
  stolenShareMax: 0.3,
  presenceFactor: 0.5,
} as const;

export const GUILD = {
  feeShareOfNetWorth: 0.1,
  minFee: 500,
  maxFee: 75_000,
  homeCityFactor: 0.75,
} as const;

export const LENDER = {
  maxLoans: 3,
  /** Kreditrahmen: Anteil des Unternehmenswerts, mindestens/höchstens. */
  creditShareOfNetWorth: 0.5,
  minCredit: 200,
  maxCredit: 30_000,
  /** Laufzeiten in Wochen mit Wochenzins (Tippsammlung 2.1.1.5: Zinsen gelten pro Woche). */
  terms: [
    { weeks: 4, weeklyRate: 0.02 },
    { weeks: 12, weeklyRate: 0.013 },
    { weeks: 26, weeklyRate: 0.009 },
  ] as readonly { weeks: number; weeklyRate: number }[],
  reminderDays: 10,
  graceDays: 10,
  seizurePriceFactor: 0.8,
  /** Ausfallwahrscheinlichkeit vergebener Kredite. */
  borrowerDefaultChance: 0.1,
  borrowerOffersPerWeek: 2,
} as const;

export const CONTRACTS = {
  maxPerCity: 5,
  dailyOfferChance: 0.15,
  minDays: 14,
  maxDays: 28,
  priceFactorMin: 1.3,
  priceFactorMax: 1.6,
  /** Menge als Anteil eines Wochenbedarfs. */
  amountWeeksMin: 0.5,
  amountWeeksMax: 1.5,
  /** Nach einem verpassten Auftrag keine neuen für so viele Tage. */
  failureLockoutDays: 28,
  failureSocietalPenalty: 1,
  /** Mindestansehen (gesellschaftlich), um Aushänge annehmen zu dürfen. */
  minSocietal: 0.3,
} as const;

export const TAVERN = {
  sailorHireFee: 10,
  /** Matrosen in der Taverne als Anteil der Bettler (Tippsammlung 2.1.1.1.1). */
  sailorShareOfBeggars: 0.3,
  captainAppearChance: 0.05,
  informantFee: 150,
  dailyJobOfferChance: 0.5,
  dayJobHours: 8,
  dayJobWageMin: 12,
  dayJobWageMax: 25,
  questOfferChance: 0.12,
  maxQuestsPerCity: 3,
  passengerRewardPerDistance: 8,
  buyerPriceFactor: 1.5,
  questDaysMin: 10,
  questDaysMax: 25,
  peddlerChance: 0.2,
  peddlerDiscount: 0.75,
} as const;

export const GATHERING = {
  /** Grundertrag pro Aktion (in Einheiten) und Dauer in Spielstunden. */
  wood: { good: 'Wood', baseYield: 0.12, hours: 2, skill: 'woodcutting' },
  stone: { good: 'Stone', baseYield: 0.1, hours: 2, skill: 'quarrying' },
  fish: { good: 'Fish', baseYield: 0.03, hours: 2, skill: 'fishing' },
  herbs: { good: 'Herbs', baseYield: 0.06, hours: 2, skill: 'gathering' },
  faerybloom: { good: 'Faerybloom', baseYield: 0.18, hours: 2, skill: 'gathering' },
  /** Qualität 0..1 aus dem Minispiel skaliert den Ertrag zwischen min und max. */
  qualityMin: 0.5,
  qualityMax: 1.5,
  xpPerAction: 3,
  /** Rucksack/Handkarren der Figur. */
  inventoryCapacity: 20,
} as const;

export const POLITICS = {
  /** Sitzung des Stadtrats 14 Tage nach Antrag (Tippsammlung 2.1.1.3.3). */
  motionDelayDays: 14,
  termYears: 1,
  /** Stimmen pro Bestechung im Badehaus, Kosten je 1000 Einwohner. */
  bribeCostPer1000: 400,
  bribeVotes: 4,
  bribeAvailability: 0.6,
  /** Ruf der KI-Honoratioren. */
  notableReputationMin: 20,
  notableReputationMax: 85,
  notableDriftPerMonth: 4,
  /** Einladung in die Lia-Kanzlei: Schultheiss mit diesem hanseweiten Ansehen. */
  liaInvitationGlobal: 40,
  missionsForCandidacy: 2,
  /** Denkmal nach eineinhalb Jahren im Amt (Tippsammlung 2.1.2.4). */
  monumentDays: 540,
  specialTaxMaxShareOfPopulation: 2,
} as const;

export const DISASTERS = {
  fireDailyChance: 0.0008,
  /** Brunnenabdeckung senkt das Brandrisiko bis auf diesen Anteil. */
  fireMinFactor: 0.15,
  fireBuildingLossChance: 0.12,
  fireGoodsLossShare: 0.15,
  plagueDailyChance: 0.0005,
  plagueMinFactor: 0.1,
  plagueDays: 30,
  plagueDailyDeathRate: 0.006,
  plagueWoodDemandFactor: 1.5,
  plagueManagerDeathChance: 0.25,
  /** Ist der Spieler beim Ausbruch in der Stadt, halbiert sich der Schaden (CLAUDE.md §2.3.5). */
  presenceDamageFactor: 0.5,
} as const;

export const GATE = {
  /** Landesherr: monatliche Nachfrage nach vier Waren (Tippsammlung 6.5.1.2). */
  goodsPerMonth: 4,
  maxUnitsPerGood: 120,
  priceFactorMin: 1.15,
  priceFactorMax: 1.45,
} as const;

export const MESSAGES = {
  maxStored: 150,
} as const;
