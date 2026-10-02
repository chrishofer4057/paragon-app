import { WORLD } from '../data/balance';
import { BUSINESSES } from '../data/businesses';
import { DEFAULT_RENT_LEVEL, HOUSES, INFRASTRUCTURE, KONTOR, WAREHOUSE } from '../data/buildings';
import { CITY_IDS, type CityId } from '../data/cities';
import { GOODS, type GoodAmounts, type GoodId } from '../data/goods';
import { SHIP_TYPES, SHIPYARD } from '../data/ships';
import { emit, newId, postMessage, type SimContext } from '../context';
import type { ConstructionJob, ConstructionKind, GameState } from '../state/gameState';
import type { BusinessId, HouseId, JobId, ShipId } from '../state/ids';
import { daysToTicks } from '../time';
import { totalPopulation } from './demand';
import { quoteBuy } from './prices';
import { addReputation } from './reputation';
import { amountOf, removeGoods, shipInPort } from './storage';

/**
 * Bautrupps (Tippsammlung 5.7, 2.1.1.9.2): Jeder Bau bindet einen Trupp der Stadt für
 * eine Anzahl Tage. Schiffe baut die Werft – eins nach dem anderen. Baumaterial wird
 * beim Auftrag zuerst aus dem Kontor genommen, dann aus Schiffen im Hafen, der Rest
 * wird auf dem Markt gekauft.
 */

export function builderCrews(state: GameState, cityId: CityId): number {
  return (
    WORLD.baseBuilderCrews +
    Math.floor(totalPopulation(state.cities[cityId]) / WORLD.builderCrewPerPopulation)
  );
}

export function constructionName(kind: ConstructionKind): string {
  switch (kind.type) {
    case 'business':
      return BUSINESSES[kind.businessType].name;
    case 'house':
      return HOUSES[kind.houseType].name;
    case 'kontor':
      return KONTOR.name;
    case 'warehouse':
      return WAREHOUSE.name;
    case 'infrastructure':
      return INFRASTRUCTURE[kind.infrastructure].name;
    case 'ship':
      return `${SHIP_TYPES[kind.shipType].name} "${kind.name}"`;
    case 'templeStage':
      return `Tempelausbau (Stufe ${kind.stage + 1})`;
  }
}

// ---------------------------------------------------------------------------
// Baumaterial
// ---------------------------------------------------------------------------

export interface MaterialPlan {
  fromKontor: GoodAmounts;
  fromShips: { shipId: ShipId; good: GoodId; amount: number }[];
  fromMarket: GoodAmounts;
  marketCost: number;
  /** Was nirgends zu bekommen ist – dann kann nicht gebaut werden. */
  missing: GoodAmounts;
}

export function planMaterials(state: GameState, cityId: CityId, materials: GoodAmounts): MaterialPlan {
  const plan: MaterialPlan = { fromKontor: {}, fromShips: [], fromMarket: {}, marketCost: 0, missing: {} };
  const city = state.cities[cityId];
  const kontor = state.player.kontors[cityId];
  const ships = Object.values(state.ships).filter(
    (s) => shipInPort(s) === cityId && s.repairUntilTick === null,
  );
  for (const [good, needed] of Object.entries(materials) as [GoodId, number][]) {
    let remaining = needed;
    if (kontor) {
      const take = Math.min(remaining, amountOf(kontor.storage, good));
      if (take > 0) plan.fromKontor[good] = take;
      remaining -= take;
    }
    for (const ship of ships) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, amountOf(ship.cargo, good));
      if (take > 0) plan.fromShips.push({ shipId: ship.id, good, amount: take });
      remaining -= take;
    }
    if (remaining > 0) {
      const available = Math.min(remaining, Math.floor(city.market[good]));
      if (available > 0) {
        plan.fromMarket[good] = available;
        plan.marketCost += quoteBuy(city, good, available);
      }
      remaining -= available;
    }
    if (remaining > 1e-6) plan.missing[good] = remaining;
  }
  return plan;
}

export function hasMissing(plan: MaterialPlan): boolean {
  return Object.keys(plan.missing).length > 0;
}

export function describeMissing(plan: MaterialPlan): string {
  return (Object.entries(plan.missing) as [GoodId, number][])
    .map(([good, amount]) => `${Math.ceil(amount)} ${GOODS[good].name}`)
    .join(', ');
}

export function applyMaterialPlan(state: GameState, cityId: CityId, plan: MaterialPlan): void {
  const kontor = state.player.kontors[cityId];
  for (const [good, amount] of Object.entries(plan.fromKontor) as [GoodId, number][]) {
    if (kontor) removeGoods(kontor.storage, good, amount);
  }
  for (const entry of plan.fromShips) {
    const ship = state.ships[entry.shipId];
    if (ship) removeGoods(ship.cargo, entry.good, entry.amount);
  }
  const city = state.cities[cityId];
  for (const [good, amount] of Object.entries(plan.fromMarket) as [GoodId, number][]) {
    city.market[good] = Math.max(0, city.market[good] - amount);
  }
  state.player.money -= plan.marketCost;
}

// ---------------------------------------------------------------------------
// Aufträge
// ---------------------------------------------------------------------------

export function shipBuildDays(state: GameState, cityId: CityId, shipType: keyof typeof SHIP_TYPES): number {
  const level = state.cities[cityId].shipyard.level;
  return Math.round(SHIP_TYPES[shipType].baseBuildDays * (1 - level * SHIPYARD.buildTimeFactorPerLevel));
}

export function enqueueConstruction(
  ctx: SimContext,
  cityId: CityId,
  kind: ConstructionKind,
  durationDays: number,
): ConstructionJob {
  const { state } = ctx;
  const job: ConstructionJob = {
    id: newId<JobId>(state, 'j'),
    cityId,
    kind,
    durationDays,
    orderedTick: state.tick,
    startTick: null,
    readyTick: null,
  };
  state.constructions[job.id] = job;
  if (kind.type === 'ship') state.cities[cityId].shipyard.lastOrderTick = state.tick;
  startWaitingJobs(ctx);
  return job;
}

function isShipJob(job: ConstructionJob): boolean {
  return job.kind.type === 'ship';
}

/** Startet wartende Aufträge, sobald Bautrupps bzw. die Werft frei sind. */
export function startWaitingJobs(ctx: SimContext): void {
  const { state } = ctx;
  const jobs = Object.values(state.constructions).sort((a, b) => a.orderedTick - b.orderedTick);
  for (const cityId of CITY_IDS) {
    const cityJobs = jobs.filter((j) => j.cityId === cityId);
    if (cityJobs.length === 0) continue;
    let freeCrews =
      builderCrews(state, cityId) - cityJobs.filter((j) => !isShipJob(j) && j.startTick !== null).length;
    let shipyardFree = !cityJobs.some((j) => isShipJob(j) && j.startTick !== null);
    for (const job of cityJobs) {
      if (job.startTick !== null) continue;
      if (isShipJob(job)) {
        if (!shipyardFree) continue;
        shipyardFree = false;
      } else {
        if (freeCrews <= 0) continue;
        freeCrews -= 1;
      }
      job.startTick = state.tick;
      job.readyTick = state.tick + daysToTicks(job.durationDays);
      emit(ctx, { type: 'ConstructionStarted', jobId: job.id, cityId, kind: job.kind });
    }
  }
}

function completeJob(ctx: SimContext, job: ConstructionJob): void {
  const { state } = ctx;
  const p = state.player;
  const city = state.cities[job.cityId];
  const kind = job.kind;
  switch (kind.type) {
    case 'business': {
      const id = newId<BusinessId>(state, 'b');
      p.businesses[id] = {
        id,
        type: kind.businessType,
        cityId: job.cityId,
        effective: kind.effective,
        workers: 0,
        utilization: 1,
      };
      break;
    }
    case 'house': {
      const id = newId<HouseId>(state, 'h');
      p.houses[id] = {
        id,
        type: kind.houseType,
        cityId: job.cityId,
        rentLevel: DEFAULT_RENT_LEVEL,
        tenants: 0,
      };
      break;
    }
    case 'kontor':
      p.kontors[job.cityId] ??= { cityId: job.cityId, storage: {}, warehouses: 0, guards: 0, manager: null };
      break;
    case 'warehouse': {
      const kontor = p.kontors[job.cityId];
      if (kontor) kontor.warehouses += 1;
      break;
    }
    case 'infrastructure': {
      const def = INFRASTRUCTURE[kind.infrastructure];
      city.infrastructure[kind.infrastructure] += 1;
      addReputation(state, job.cityId, def.reputation, true);
      break;
    }
    case 'ship': {
      const typeDef = SHIP_TYPES[kind.shipType];
      const id = newId<ShipId>(state, 's');
      const capacityBonus = 1 + city.shipyard.level * SHIPYARD.capacityBonusPerLevel;
      state.ships[id] = {
        id,
        name: kind.name,
        type: kind.shipType,
        capacity: Math.round(typeDef.capacity * capacityBonus),
        condition: 100,
        crew: 0,
        hasCaptain: false,
        cargo: {},
        location: { kind: 'port', cityId: job.cityId },
        repairUntilTick: null,
      };
      gainShipyardXp(state, job.cityId);
      break;
    }
    case 'templeStage': {
      city.temple.stage = Math.max(city.temple.stage, kind.stage + 1);
      city.temple.buildingUntilTick = null;
      city.temple.materials = {};
      break;
    }
  }
  delete state.constructions[job.id];
  emit(ctx, { type: 'ConstructionCompleted', jobId: job.id, cityId: job.cityId, kind });
  if (kind.type !== 'templeStage') {
    postMessage(ctx, 'success', 'Bau fertiggestellt', `${constructionName(kind)} ist fertig.`, job.cityId);
  } else {
    postMessage(ctx, 'success', 'Tempel ausgebaut', `Der Tempel erstrahlt in neuem Glanz.`, job.cityId);
  }
}

export function gainShipyardXp(state: GameState, cityId: CityId): void {
  const yard = state.cities[cityId].shipyard;
  yard.lastOrderTick = state.tick;
  if (yard.level >= SHIPYARD.maxLevel) return;
  yard.xp += 1;
  if (yard.xp >= SHIPYARD.xpPerLevel) {
    yard.xp = 0;
    yard.level += 1;
  }
}

export function runConstructionHour(ctx: SimContext): void {
  const { state } = ctx;
  for (const job of Object.values(state.constructions)) {
    if (job.readyTick !== null && job.readyTick <= state.tick) completeJob(ctx, job);
  }
  startWaitingJobs(ctx);
}

/** Werften ohne Aufträge verlieren langsam Erfahrung (2.1.1.9.6). */
export function runShipyardDecayWeek(state: GameState): void {
  const idleTicks = daysToTicks(SHIPYARD.idleWeeksPerDecay * 7);
  for (const cityId of CITY_IDS) {
    const yard = state.cities[cityId].shipyard;
    if (yard.level > 0 && state.tick - yard.lastOrderTick > idleTicks) {
      yard.level -= 1;
      yard.lastOrderTick = state.tick;
    }
  }
}
