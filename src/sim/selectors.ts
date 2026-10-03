import { BUSINESS_TYPE_IDS, BUSINESSES, type BusinessTypeId } from './data/businesses';
import {
  HOUSE_TYPE_IDS,
  HOUSES,
  INFRASTRUCTURE,
  INFRASTRUCTURE_IDS,
  RENT_LEVELS,
  type HouseTypeId,
  type InfrastructureId,
} from './data/buildings';
import { FACTION_BALANCE, FACTION_IDS, FACTIONS, notorietyLabel, type FactionId } from './data/factions';
import { CHARACTERS } from './data/characters';
import { CITIES, CITY_IDS, type CityId } from './data/cities';
import { GOOD_IDS, GOODS, type GoodAmounts, type GoodCategory, type GoodId } from './data/goods';
import { CITIZEN_OPINIONS, EARNED_RANKS, RANKS, rankIndex, type RankId } from './data/ranks';
import { SHIP_TYPES } from './data/ships';
import { SKILL_IDS, SKILL_NAMES, xpForLevel, type SkillId } from './data/skills';
import type { GameState } from './state/gameState';
import type { BusinessId, HouseId, ShipId } from './state/ids';
import { canBuildBusinessIn, isEffectiveIn } from './systems/businesses';
import { constructionName } from './systems/construction';
import { isShortage, targetStock, totalDemandWeekly, totalPopulation } from './systems/demand';
import { dailyPlayerCosts, managerWagePerDay } from './systems/finance';
import { personalPriceBonus } from './systems/market';
import {
  CLASSES,
  HAPPINESS_LABELS,
  happinessLevel,
  healthScore,
  housingCapacity,
  jobsTotal,
  wellsNeeded,
} from './systems/population';
import { buyPrice, sellPrice } from './systems/prices';
import { displayRank, hasPermission, isLandammann, isMayorOf, localRank } from './systems/ranks';
import { effectiveReputation, hanseReputation, type ReputationValue } from './systems/reputation';
import { electionForecast, mayorName } from './systems/politics';
import { amountOf, kontorCapacity, shipInPort, totalAmount } from './systems/storage';
import { priestHint } from './systems/temple';
import { daysToTicks, formatDate, isWinter, toDate, HOURS_PER_DAY } from './time';

/**
 * Lesemodelle für die Oberfläche. Reine Funktionen über dem Spielzustand – die UI rechnet
 * nichts selbst, sondern zeigt an, was hier herauskommt.
 */

export function currentCityId(state: GameState): CityId | null {
  return state.player.location.kind === 'city' ? state.player.location.cityId : null;
}

export interface ClockView {
  text: string;
  hour: number;
  day: number;
  winter: boolean;
  /** 0 = Mitternacht, 1 = Mittag – für Tag/Nacht-Färbung. */
  daylight: number;
}

export function clockView(state: GameState): ClockView {
  const date = toDate(state.tick);
  const daylight = Math.max(0, Math.cos(((date.hour - 12) / 24) * 2 * Math.PI));
  return {
    text: formatDate(state.tick),
    hour: date.hour,
    day: date.day,
    winter: isWinter(state.tick),
    daylight,
  };
}

export interface AmountRow {
  good: GoodId;
  name: string;
  amount: number;
}

export function amountRows(storage: GoodAmounts): AmountRow[] {
  return (Object.entries(storage) as [GoodId, number][])
    .filter(([, amount]) => amount > 0.0005)
    .map(([good, amount]) => ({ good, name: GOODS[good].name, amount }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PlayerView {
  name: string;
  characterTitle: string;
  money: number;
  netWorth: number;
  rankName: string;
  rankId: RankId;
  stage: number;
  stageName: string;
  locationText: string;
  traveling: boolean;
  travelProgress: number;
  busyHours: number;
  inventory: AmountRow[];
  inventoryUsed: number;
  inventoryCapacity: number;
  dailyCosts: number;
}

export function playerView(state: GameState): PlayerView {
  const p = state.player;
  const rankId = displayRank(state);
  const rank = RANKS[rankId];
  const loc = p.location;
  const traveling = loc.kind === 'travel';
  const locationText =
    loc.kind === 'city' ? CITIES[loc.cityId].name : `unterwegs nach ${CITIES[loc.to].name}`;
  const travelProgress =
    loc.kind === 'travel'
      ? Math.min(1, (state.tick - loc.departTick) / Math.max(1, loc.arriveTick - loc.departTick))
      : 0;
  return {
    name: p.name,
    characterTitle: CHARACTERS[p.characterId].title,
    money: p.money,
    netWorth: p.netWorth,
    rankName: rank.name,
    rankId,
    stage: RANKS[p.rank].stage,
    stageName: RANKS[p.rank].stageName,
    locationText,
    traveling,
    travelProgress,
    busyHours: Math.max(0, p.busyUntilTick - state.tick),
    inventory: amountRows(p.inventory),
    inventoryUsed: totalAmount(p.inventory),
    inventoryCapacity: 20,
    dailyCosts: dailyPlayerCosts(state),
  };
}

// ---------------------------------------------------------------------------
// Markt
// ---------------------------------------------------------------------------

export interface MarketRow {
  good: GoodId;
  name: string;
  unit: string;
  category: GoodCategory;
  stock: number;
  target: number;
  weeklyDemand: number;
  buyPrice: number;
  sellPrice: number;
  /** Preis relativ zum Basispreis (1 = normal). */
  priceLevel: number;
  shortage: boolean;
  produced: boolean;
  special: boolean;
  inventory: number;
  kontor: number | null;
  ships: number;
}

export const CATEGORY_NAMES: Readonly<Record<GoodCategory, string>> = {
  staple: 'Grundversorgung',
  consumer: 'Konsumgüter',
  luxury: 'Luxusgüter',
  material: 'Rohstoffe & Baumaterial',
};

export function marketRows(state: GameState, cityId: CityId): MarketRow[] {
  const city = state.cities[cityId];
  const def = CITIES[cityId];
  const bonus = personalPriceBonus(state);
  const kontor = state.player.kontors[cityId];
  const ships = Object.values(state.ships).filter((s) => shipInPort(s) === cityId);
  return GOOD_IDS.map((good) => {
    const sell = sellPrice(city, good) * (1 + bonus);
    return {
      good,
      name: GOODS[good].name,
      unit: GOODS[good].unit,
      category: GOODS[good].category,
      stock: city.market[good],
      target: targetStock(city, good),
      weeklyDemand: totalDemandWeekly(city, good),
      buyPrice: buyPrice(city, good) * (1 - bonus),
      sellPrice: sell,
      priceLevel: sell / GOODS[good].basePrice,
      shortage: isShortage(city, good),
      produced: (city.cityProduction[good] ?? 0) > 0,
      special: def.special === good,
      inventory: amountOf(state.player.inventory, good),
      kontor: kontor ? amountOf(kontor.storage, good) : null,
      ships: ships.reduce((sum, s) => sum + amountOf(s.cargo, good), 0),
    };
  });
}

// ---------------------------------------------------------------------------
// Stadt
// ---------------------------------------------------------------------------

export interface ClassView {
  cls: 'rich' | 'wealthy' | 'poor';
  label: string;
  population: number;
  housing: number;
  happiness: number;
  happinessLabel: string;
  happinessLevel: number;
}

export interface InfrastructureView {
  id: InfrastructureId;
  name: string;
  count: number;
  needed: number | null;
  cost: number;
  materials: AmountRow[];
  buildDays: number;
  pending: number;
}

export interface CityView {
  id: CityId;
  name: string;
  culture: 'north' | 'south';
  size: string;
  special: string;
  regular: string[];
  population: number;
  beggars: number;
  classes: ClassView[];
  jobs: number;
  health: number;
  infrastructure: InfrastructureView[];
  templeStage: number;
  templeHint: string;
  templeDonations: number;
  treasury: number;
  headTax: number;
  mayor: string;
  playerIsMayor: boolean;
  electionDate: string;
  shortages: string[];
  plague: boolean;
  festivalIn: number | null;
  shipyardLevel: number;
}

const CLASS_LABELS = { rich: 'Reiche', wealthy: 'Wohlhabende', poor: 'Arme' } as const;

export function cityView(state: GameState, cityId: CityId): CityView {
  const city = state.cities[cityId];
  const def = CITIES[cityId];
  const pop = totalPopulation(city);
  const { year, dayOfYear } = toDate(state.tick);
  const electionYear = city.electionDayOfYear > dayOfYear ? year : year + 1;
  const electionMonth = Math.floor(city.electionDayOfYear / 30);
  return {
    id: cityId,
    name: def.name,
    culture: def.culture,
    size: { small: 'klein', medium: 'mittel', large: 'groß' }[def.size],
    special: GOODS[def.special].name,
    regular: def.regular.map((g) => GOODS[g].name),
    population: pop,
    beggars: city.population.beggars,
    classes: CLASSES.map((cls) => ({
      cls,
      label: CLASS_LABELS[cls],
      population: city.population[cls],
      housing: housingCapacity(state, city, cls),
      happiness: city.happiness[cls],
      happinessLevel: happinessLevel(city.happiness[cls]),
      happinessLabel: HAPPINESS_LABELS[happinessLevel(city.happiness[cls])]!,
    })),
    jobs: jobsTotal(state, city),
    health: healthScore(city),
    infrastructure: INFRASTRUCTURE_IDS.map((id) => {
      const infra = INFRASTRUCTURE[id];
      const pending = Object.values(state.constructions).filter(
        (j) => j.cityId === cityId && j.kind.type === 'infrastructure' && j.kind.infrastructure === id,
      ).length;
      const needed =
        infra.maxCount ?? (id === 'well' ? wellsNeeded(city) : Math.ceil(pop / (infra.perPopulation ?? 1)));
      return {
        id,
        name: infra.name,
        count: city.infrastructure[id],
        needed,
        cost: infra.cost,
        materials: amountRows(infra.materials),
        buildDays: infra.buildDays,
        pending,
      };
    }),
    templeStage: city.temple.stage,
    templeHint: priestHint(city.temple.donations, city.temple.stage, city.temple.buildingUntilTick !== null),
    templeDonations: city.temple.donations,
    treasury: city.treasury,
    headTax: city.headTax,
    mayor: mayorName(state, city),
    playerIsMayor: isMayorOf(state, cityId),
    electionDate: `${(city.electionDayOfYear % 30) + 1}. ${MONTHS[electionMonth]} ${electionYear}`,
    shortages: GOOD_IDS.filter((g) => isShortage(city, g)).map((g) => GOODS[g].name),
    plague: city.plagueUntilTick !== null,
    festivalIn: city.festival ? Math.ceil((city.festival.tick - state.tick) / HOURS_PER_DAY) : null,
    shipyardLevel: city.shipyard.level,
  };
}

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

// ---------------------------------------------------------------------------
// Ansehen und Ränge
// ---------------------------------------------------------------------------

/** "Meinung der Bürger" (Tippsammlung 6.1.3.4) statt nackter Zahlen. */
export function citizenOpinion(value: number, axis: 'social' | 'societal'): string {
  let text = CITIZEN_OPINIONS[0]!.text;
  for (const opinion of CITIZEN_OPINIONS) {
    if (opinion.minRank === null) continue;
    if (value >= RANKS[opinion.minRank][axis]) text = opinion.text;
  }
  return text;
}

export interface RankStep {
  id: RankId;
  name: string;
  stage: number;
  stageName: string;
  netWorth: number;
  social: number;
  societal: number;
  requiresGuild: boolean;
  reached: boolean;
  current: boolean;
  netWorthOk: boolean;
  socialOk: boolean;
  societalOk: boolean;
  guildOk: boolean;
}

export interface RankProgressView {
  home: string;
  reputation: ReputationValue;
  netWorth: number;
  steps: RankStep[];
  hanse: number;
  isMayor: boolean;
  isLandammann: boolean;
  liaInvited: boolean;
  missionsCompleted: number;
}

export function rankProgress(state: GameState): RankProgressView {
  const p = state.player;
  const reputation = effectiveReputation(state, p.homeCityId);
  const guild = p.guilds.includes(p.homeCityId);
  const steps: RankStep[] = (['dayLaborer', ...EARNED_RANKS] as RankId[]).map((id) => {
    const r = RANKS[id];
    return {
      id,
      name: r.name,
      stage: r.stage,
      stageName: r.stageName,
      netWorth: r.netWorth,
      social: r.social,
      societal: r.societal,
      requiresGuild: r.requiresHomeGuild,
      reached: rankIndex(p.rank) >= rankIndex(id),
      current: p.rank === id,
      netWorthOk: p.netWorth >= r.netWorth,
      socialOk: reputation.social >= r.social,
      societalOk: reputation.societal >= r.societal,
      guildOk: !r.requiresHomeGuild || guild,
    };
  });
  return {
    home: CITIES[p.homeCityId].name,
    reputation,
    netWorth: p.netWorth,
    steps,
    hanse: hanseReputation(state),
    isMayor: isMayorOf(state, p.homeCityId),
    isLandammann: isLandammann(state),
    liaInvited: p.liaInvited,
    missionsCompleted: p.missionsCompleted,
  };
}

export interface CityReputationRow {
  cityId: CityId;
  name: string;
  social: number;
  societal: number;
  socialOpinion: string;
  societalOpinion: string;
  localRank: string;
}

export function reputationTable(state: GameState): CityReputationRow[] {
  return CITY_IDS.map((cityId) => {
    const rep = effectiveReputation(state, cityId);
    return {
      cityId,
      name: CITIES[cityId].name,
      social: rep.social,
      societal: rep.societal,
      socialOpinion: citizenOpinion(rep.social, 'social'),
      societalOpinion: citizenOpinion(rep.societal, 'societal'),
      localRank: RANKS[localRank(state, cityId)].name,
    };
  }).sort((a, b) => b.societal + b.social - (a.societal + a.social));
}

export interface SkillView {
  id: SkillId;
  name: string;
  level: number;
  progress: number;
}

export function skillViews(state: GameState): SkillView[] {
  return SKILL_IDS.map((id) => {
    const s = state.player.skills[id];
    const prev = xpForLevel(s.level);
    const next = xpForLevel(s.level + 1);
    return {
      id,
      name: SKILL_NAMES[id],
      level: s.level,
      progress: Math.min(1, (s.xp - prev) / Math.max(1, next - prev)),
    };
  });
}

// ---------------------------------------------------------------------------
// Besitz: Kontor, Betriebe, Häuser, Bauaufträge, Schiffe
// ---------------------------------------------------------------------------

export interface BusinessOption {
  type: BusinessTypeId;
  name: string;
  effective: boolean;
  allowed: boolean;
  cost: number;
  buildDays: number;
  outputs: AmountRow[];
  inputs: AmountRow[];
  materials: AmountRow[];
  wagesPerWeek: number;
  owned: number;
}

export function businessOptions(state: GameState, cityId: CityId): BusinessOption[] {
  return BUSINESS_TYPE_IDS.map((type) => {
    const def = BUSINESSES[type];
    return {
      type,
      name: def.name,
      effective: isEffectiveIn(cityId, type),
      allowed: canBuildBusinessIn(cityId, type),
      cost: def.buildCost,
      buildDays: def.buildDays,
      outputs: amountRows(def.outputs),
      inputs: amountRows(def.inputs),
      materials: amountRows(def.materials),
      wagesPerWeek: def.wagesPerWeek,
      owned: Object.values(state.player.businesses).filter((b) => b.cityId === cityId && b.type === type)
        .length,
    };
  }).sort((a, b) => Number(b.effective) - Number(a.effective) || Number(b.allowed) - Number(a.allowed));
}

export interface HouseOption {
  type: HouseTypeId;
  name: string;
  tenantClass: string;
  capacity: number;
  cost: number;
  buildDays: number;
  materials: AmountRow[];
}

export function houseOptions(): HouseOption[] {
  return HOUSE_TYPE_IDS.map((type) => {
    const def = HOUSES[type];
    return {
      type,
      name: def.name,
      tenantClass: CLASS_LABELS[def.tenantClass],
      capacity: def.capacity,
      cost: def.cost,
      buildDays: def.buildDays,
      materials: amountRows(def.materials),
    };
  });
}

export interface OwnedBusinessView {
  id: BusinessId;
  name: string;
  cityName: string;
  effective: boolean;
  workers: number;
  maxWorkers: number;
  utilization: number;
}

export interface OwnedHouseView {
  id: HouseId;
  name: string;
  cityName: string;
  tenants: number;
  capacity: number;
  rentLevel: number;
  rentLevels: number;
}

export interface ConstructionView {
  name: string;
  cityName: string;
  status: string;
  progress: number;
}

export interface ShipView {
  id: ShipId;
  name: string;
  typeName: string;
  capacity: number;
  cargoUsed: number;
  cargo: AmountRow[];
  condition: number;
  crew: number;
  minCrew: number;
  maxCrew: number;
  hasCaptain: boolean;
  where: string;
  portCityId: CityId | null;
  inRepair: boolean;
}

export interface PossessionsView {
  kontors: {
    cityId: CityId;
    cityName: string;
    used: number;
    capacity: number;
    warehouses: number;
    guards: number;
    manager: boolean;
    managerWage: number;
  }[];
  businesses: OwnedBusinessView[];
  houses: OwnedHouseView[];
  constructions: ConstructionView[];
  ships: ShipView[];
  loans: { id: string; cityName: string; owed: number; dueIn: number }[];
  lent: { id: string; borrower: string; principal: number; dueIn: number; defaulted: boolean }[];
}

export function shipView(state: GameState, shipId: ShipId): ShipView {
  const ship = state.ships[shipId]!;
  const def = SHIP_TYPES[ship.type];
  const port = shipInPort(ship);
  const where =
    ship.location.kind === 'port'
      ? `im Hafen von ${CITIES[ship.location.cityId].name}`
      : `auf See nach ${CITIES[ship.location.to].name}`;
  return {
    id: ship.id,
    name: ship.name,
    typeName: def.name,
    capacity: ship.capacity,
    cargoUsed: totalAmount(ship.cargo),
    cargo: amountRows(ship.cargo),
    condition: ship.condition,
    crew: ship.crew,
    minCrew: def.minCrew,
    maxCrew: def.maxCrew,
    hasCaptain: ship.hasCaptain,
    where,
    portCityId: port,
    inRepair: ship.repairUntilTick !== null,
  };
}

export function possessionsView(state: GameState): PossessionsView {
  const p = state.player;
  const days = (tick: number) => Math.ceil((tick - state.tick) / HOURS_PER_DAY);
  return {
    kontors: CITY_IDS.filter((id) => p.kontors[id]).map((cityId) => {
      const k = p.kontors[cityId]!;
      return {
        cityId,
        cityName: CITIES[cityId].name,
        used: totalAmount(k.storage),
        capacity: kontorCapacity(k),
        warehouses: k.warehouses,
        guards: k.guards,
        manager: k.manager !== null,
        managerWage: managerWagePerDay(state, cityId),
      };
    }),
    businesses: Object.values(p.businesses).map((b) => ({
      id: b.id,
      name: BUSINESSES[b.type].name,
      cityName: CITIES[b.cityId].name,
      effective: b.effective,
      workers: b.workers,
      maxWorkers: BUSINESSES[b.type].workers,
      utilization: b.utilization,
    })),
    houses: Object.values(p.houses).map((h) => ({
      id: h.id,
      name: HOUSES[h.type].name,
      cityName: CITIES[h.cityId].name,
      tenants: h.tenants,
      capacity: HOUSES[h.type].capacity,
      rentLevel: h.rentLevel,
      rentLevels: RENT_LEVELS.length,
    })),
    constructions: Object.values(state.constructions)
      .sort((a, b) => a.orderedTick - b.orderedTick)
      .map((j) => ({
        name: constructionName(j.kind),
        cityName: CITIES[j.cityId].name,
        status: j.startTick === null ? 'wartet auf Bautrupp' : `fertig in ${days(j.readyTick!)} Tagen`,
        progress:
          j.startTick === null || j.readyTick === null
            ? 0
            : Math.min(1, (state.tick - j.startTick) / Math.max(1, j.readyTick - j.startTick)),
      })),
    ships: Object.keys(state.ships).map((id) => shipView(state, id as ShipId)),
    loans: Object.values(state.loans).map((l) => ({
      id: l.id,
      cityName: CITIES[l.cityId].name,
      owed: l.owed,
      dueIn: days(l.dueTick),
    })),
    lent: Object.values(state.lentLoans).map((l) => ({
      id: l.id,
      borrower: l.borrowerName,
      principal: l.principal,
      dueIn: days(l.dueTick),
      defaulted: l.defaultedUntilTick !== null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Sonstiges
// ---------------------------------------------------------------------------

export function canDo(state: GameState, permission: Parameters<typeof hasPermission>[1]): boolean {
  return hasPermission(state, permission);
}

export function forecast(state: GameState, cityId: CityId) {
  return electionForecast(state, cityId);
}

// ---------------------------------------------------------------------------
// Fraktionen und Verruf
// ---------------------------------------------------------------------------

export interface FactionRow {
  id: FactionId;
  name: string;
  description: string;
  pledgeBenefit: string;
  rivalName: string;
  favor: number;
  /** Wohlwollen als Text (Spieler sieht keine nackte Zahl allein). */
  standing: string;
  pledged: boolean;
  canPledge: boolean;
}

export interface FactionsView {
  rows: FactionRow[];
  pledge: FactionId | null;
  /** Tage, bis das Bündnis wieder gewechselt werden darf (0 = jetzt). */
  cooldownDays: number;
  notoriety: number;
  notorietyText: string;
}

function standingText(favor: number): string {
  if (favor <= -50) return 'verfeindet';
  if (favor < -10) return 'misstrauisch';
  if (favor < 10) return 'neutral';
  if (favor < FACTION_BALANCE.pledgeMinFavor) return 'wohlgesinnt';
  if (favor < FACTION_BALANCE.favoredThreshold) return 'vertraut';
  return 'eng verbunden';
}

export function factionsView(state: GameState): FactionsView {
  const p = state.player;
  const cooldownTicks = daysToTicks(FACTION_BALANCE.pledgeCooldownDays) - (state.tick - p.pledgeChangedTick);
  const cooldownDays = Math.max(0, Math.ceil(cooldownTicks / HOURS_PER_DAY));
  return {
    rows: FACTION_IDS.map((id) => {
      const def = FACTIONS[id];
      const favor = p.factions[id];
      return {
        id,
        name: def.name,
        description: def.description,
        pledgeBenefit: def.pledgeBenefit,
        rivalName: FACTIONS[def.rival].name,
        favor,
        standing: standingText(favor),
        pledged: p.pledge === id,
        canPledge: p.pledge !== id && cooldownDays === 0 && favor >= FACTION_BALANCE.pledgeMinFavor,
      };
    }),
    pledge: p.pledge,
    cooldownDays,
    notoriety: p.notoriety,
    notorietyText: notorietyLabel(p.notoriety),
  };
}
