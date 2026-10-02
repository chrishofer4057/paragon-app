import { MARKET, POLITICS, POPULATION, WORLD } from '../data/balance';
import { INFRASTRUCTURE_IDS } from '../data/buildings';
import { CITIES, CITY_IDS, START_POPULATION, type CityId } from '../data/cities';
import { GOOD_IDS, type GoodAmounts, type GoodId } from '../data/goods';
import { FIRST_NAMES, LAST_NAMES } from '../data/names';
import { newId } from '../context';
import { nextInt, nextRange, pick, type RngState } from '../rng';
import type { CityState, GameState, InfrastructureCounts, Notable } from '../state/gameState';
import type { NotableId } from '../state/ids';
import { inputPerUnit, populationDemandWeekly, targetStock } from '../systems/demand';
import { DAYS_PER_YEAR } from '../time';

/**
 * Baut die 26 Städte auf. Die städtischen Betriebe werden so verteilt, dass sie den
 * Weltbedarf knapp NICHT decken (WORLD.citySupplyRatio) – die Lücke ist die Chance des
 * Spielers. Die Spezialware einer Stadt wird dreifach gewichtet.
 */

export function randomName(rng: RngState): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

function producersOf(good: GoodId): CityId[] {
  return CITY_IDS.filter((id) => CITIES[id].special === good || CITIES[id].regular.includes(good));
}

function emptyMarket(): Record<GoodId, number> {
  return Object.fromEntries(GOOD_IDS.map((g) => [g, 0])) as Record<GoodId, number>;
}

function emptyInfrastructure(): InfrastructureCounts {
  return Object.fromEntries(INFRASTRUCTURE_IDS.map((id) => [id, 0])) as InfrastructureCounts;
}

function createCity(state: GameState, id: CityId): CityState {
  const def = CITIES[id];
  const start = START_POPULATION[def.size];
  const total = start.rich + start.wealthy + start.poor;
  const notables: Notable[] = [];
  for (let i = 0; i < WORLD.notablesPerCity; i++) {
    notables.push({
      id: newId<NotableId>(state, 'n'),
      name: randomName(state.rng),
      reputation: Math.round(
        nextRange(state.rng, POLITICS.notableReputationMin, POLITICS.notableReputationMax),
      ),
    });
  }
  const mayor = notables.reduce((best, n) => (n.reputation > best.reputation ? n : best));
  const treasury = Math.round(total * WORLD.startTreasuryPerCapita);
  return {
    id,
    market: emptyMarket(),
    cityProduction: {},
    population: { ...start, beggars: Math.round(total * WORLD.startBeggarShare) },
    happiness: { rich: 0.6, wealthy: 0.6, poor: 0.6 },
    housing: {
      rich: Math.ceil(start.rich * WORLD.startHousingSlack),
      wealthy: Math.ceil(start.wealthy * WORLD.startHousingSlack),
      poor: Math.ceil(start.poor * WORLD.startHousingSlack),
    },
    cityJobs: start.poor,
    infrastructure: emptyInfrastructure(),
    temple: { stage: 0, donations: 0, materials: {}, buildingUntilTick: null },
    treasury,
    treasuryMonthStart: treasury,
    headTax: POPULATION.defaultHeadTax,
    mayor: { kind: 'notable', notableId: mayor.id },
    mayorSinceTick: state.tick,
    notables,
    electionDayOfYear: nextInt(state.rng, 0, DAYS_PER_YEAR - 1),
    bribeVotes: 0,
    monument: false,
    motions: [],
    contracts: [],
    contractLockoutUntilTick: 0,
    tavern: { captainAvailable: false, dayJobs: [], quests: [], peddler: null },
    gate: [],
    borrowerOffers: [],
    shipyard: { level: def.size === 'large' ? 1 : 0, xp: 0, lastOrderTick: state.tick },
    festival: null,
    festivalBoostUntilTick: 0,
    almsBoostDay: null,
    plagueUntilTick: null,
  };
}

/**
 * Produktionsmengen je Ware so wählen, dass Bevölkerungsbedarf plus Rohstoffbedarf der
 * nachgelagerten Betriebe (iterativ über die Produktionsketten) zu `citySupplyRatio` gedeckt ist.
 */
function balanceProduction(cities: Record<CityId, CityState>): void {
  const weeklyWorld: GoodAmounts = {};
  const popDemand: Record<GoodId, number> = Object.fromEntries(
    GOOD_IDS.map((g) => [g, CITY_IDS.reduce((sum, id) => sum + populationDemandWeekly(cities[id], g), 0)]),
  ) as Record<GoodId, number>;

  for (let pass = 0; pass < 6; pass++) {
    for (const good of GOOD_IDS) {
      let inputDemand = 0;
      for (const output of GOOD_IDS) inputDemand += (weeklyWorld[output] ?? 0) * inputPerUnit(output, good);
      weeklyWorld[good] = (popDemand[good] + inputDemand) * WORLD.citySupplyRatio;
    }
  }

  for (const good of GOOD_IDS) {
    const producers = producersOf(good);
    const weights = producers.map((id) =>
      CITIES[id].special === good ? WORLD.specialtyShareWeight : WORLD.regularShareWeight,
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) continue;
    producers.forEach((id, i) => {
      const weekly = ((weeklyWorld[good] ?? 0) * weights[i]!) / totalWeight;
      cities[id].cityProduction[good] = weekly / 7;
    });
  }
}

export function createCities(state: GameState): Record<CityId, CityState> {
  const cities = {} as Record<CityId, CityState>;
  for (const id of CITY_IDS) cities[id] = createCity(state, id);
  balanceProduction(cities);
  for (const id of CITY_IDS) {
    const city = cities[id];
    for (const good of GOOD_IDS) {
      const produced = (city.cityProduction[good] ?? 0) > 0;
      const factor = produced ? MARKET.startStockProduced : MARKET.startStockImported;
      city.market[good] = Math.round(targetStock(city, good) * factor * 10) / 10;
    }
  }
  return cities;
}
