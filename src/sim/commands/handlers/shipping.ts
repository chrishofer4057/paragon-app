import { CHARACTERS } from '../../data/characters';
import { mapDistance, type CityId } from '../../data/cities';
import { GOODS, type GoodId } from '../../data/goods';
import {
  CARGO_RENTAL,
  PASSAGE,
  SHIP_MIN_CONDITION_TO_SAIL,
  SHIP_TYPES,
  SHIPYARD,
  type ShipTypeId,
} from '../../data/ships';
import { newId, type SimContext } from '../../context';
import type { GameState, ShipState } from '../../state/gameState';
import type { ShipId, ShipmentId } from '../../state/ids';
import { daysToTicks } from '../../time';
import {
  applyMaterialPlan,
  describeMissing,
  enqueueConstruction,
  hasMissing,
  planMaterials,
  shipBuildDays,
} from '../../systems/construction';
import { removeGoods, resolveStorage, shipInPort, type StorageRef } from '../../systems/storage';
import { passageFare, shipTravelDays, travelDays } from '../../systems/travel';
import { fail, ok, type CommandResult } from '../commands';
import {
  cityName,
  firstError,
  requireCity,
  requireGoodsAt,
  requireMoney,
  requireNotBusy,
  requirePermission,
  requirePositiveAmount,
} from '../guards';

function cleanName(name: string): string {
  return name.trim().slice(0, 40);
}

export function handleOrderShip(ctx: SimContext, shipType: ShipTypeId, name: string): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = requirePermission(state, 'ownShips');
  if (error) return error;
  const shipName = cleanName(name);
  if (!shipName) return fail('Das Schiff braucht einen Namen.');
  const def = SHIP_TYPES[shipType];
  const plan = planMaterials(state, where.cityId, def.materials);
  if (hasMissing(plan)) return fail(`Es fehlt Baumaterial: ${describeMissing(plan)}.`);
  const moneyError = requireMoney(state, def.cost + plan.marketCost);
  if (moneyError) return moneyError;
  applyMaterialPlan(state, where.cityId, plan);
  state.player.money -= def.cost;
  const days = shipBuildDays(state, where.cityId, shipType);
  enqueueConstruction(ctx, where.cityId, { type: 'ship', shipType, name: shipName }, days);
  return ok(`Die Werft baut ${def.name} "${shipName}" (${days} Tage, sobald sie frei ist).`);
}

export function repairQuote(
  state: GameState,
  ship: ShipState,
  cityId: CityId,
): { cost: number; days: number } {
  const damage = 100 - ship.condition;
  const level = state.cities[cityId].shipyard.level;
  return {
    cost: Math.round((damage / 100) * SHIP_TYPES[ship.type].cost * SHIPYARD.repairCostFactor),
    days: Math.max(
      1,
      Math.ceil(
        (damage / 10) * SHIPYARD.repairDaysPerTenPercent * (1 - level * SHIPYARD.buildTimeFactorPerLevel),
      ),
    ),
  };
}

function shipHere(state: GameState, shipId: ShipId, cityId: CityId): ShipState | undefined {
  const ship = state.ships[shipId];
  return ship && shipInPort(ship) === cityId ? ship : undefined;
}

export function handleRepairShip(ctx: SimContext, shipId: ShipId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const ship = shipHere(state, shipId, where.cityId);
  if (!ship) return fail('Das Schiff liegt nicht hier im Hafen.');
  if (ship.repairUntilTick !== null) return fail('Das Schiff ist bereits in der Werft.');
  if (ship.condition >= 100) return fail('Das Schiff ist unbeschädigt.');
  const quote = repairQuote(state, ship, where.cityId);
  const error = requireMoney(state, quote.cost);
  if (error) return error;
  state.player.money -= quote.cost;
  ship.repairUntilTick = state.tick + daysToTicks(quote.days);
  state.cities[where.cityId].shipyard.lastOrderTick = state.tick;
  return ok(`Reparatur für ${quote.cost} GS, Dauer ${quote.days} Tage.`);
}

export function handleRenameShip(ctx: SimContext, shipId: ShipId, name: string): CommandResult {
  const ship = ctx.state.ships[shipId];
  if (!ship) return fail('Dieses Schiff gibt es nicht.');
  const shipName = cleanName(name);
  if (!shipName) return fail('Der Name darf nicht leer sein.');
  ship.name = shipName;
  return ok();
}

function sailingProblem(ship: ShipState, destination: CityId): string | null {
  const port = shipInPort(ship);
  if (!port) return 'Das Schiff ist auf See.';
  if (port === destination) return 'Das Schiff liegt bereits dort.';
  if (ship.repairUntilTick !== null) return 'Das Schiff liegt in der Werft.';
  if (ship.crew < SHIP_TYPES[ship.type].minCrew)
    return `Zu wenig Besatzung (mindestens ${SHIP_TYPES[ship.type].minCrew}).`;
  if (ship.condition < SHIP_MIN_CONDITION_TO_SAIL) return 'Das Schiff ist nicht seetüchtig.';
  return null;
}

function setSail(state: GameState, ship: ShipState, destination: CityId): number {
  const from = shipInPort(ship)!;
  const arriveTick = state.tick + daysToTicks(shipTravelDays(ship, from, destination));
  ship.location = { kind: 'sea', from, to: destination, departTick: state.tick, arriveTick };
  return arriveTick;
}

export function handleSendShip(ctx: SimContext, shipId: ShipId, destination: CityId): CommandResult {
  const { state } = ctx;
  const ship = state.ships[shipId];
  if (!ship) return fail('Dieses Schiff gibt es nicht.');
  const problem = sailingProblem(ship, destination);
  if (problem) return fail(problem);
  const loc = state.player.location;
  if (loc.kind === 'travel' && loc.shipId === shipId) return fail('Ihr seid an Bord – nutzt "Reisen".');
  setSail(state, ship, destination);
  return ok(`${ship.name} sticht in See nach ${cityName(destination)}.`);
}

/** Die Figur reist – als Passagier oder an Bord eines eigenen Schiffs. */
export function handleTravel(ctx: SimContext, destination: CityId, shipId?: ShipId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = requireNotBusy(state);
  if (error) return error;
  if (destination === where.cityId) return fail('Ihr seid bereits dort.');
  if (shipId !== undefined) {
    const ship = shipHere(state, shipId, where.cityId);
    if (!ship) return fail('Das Schiff liegt nicht hier im Hafen.');
    const problem = sailingProblem(ship, destination);
    if (problem) return fail(problem);
    const arriveTick = setSail(state, ship, destination);
    state.player.location = {
      kind: 'travel',
      from: where.cityId,
      to: destination,
      departTick: state.tick,
      arriveTick,
      shipId,
    };
    return ok(`An Bord der ${ship.name} nach ${cityName(destination)}.`);
  }
  const fare = passageFare(where.cityId, destination, CHARACTERS[state.player.characterId].freightFactor);
  const moneyError = requireMoney(state, fare);
  if (moneyError) return moneyError;
  state.player.money -= fare;
  const days = travelDays(where.cityId, destination, PASSAGE.speedPerDay);
  state.player.location = {
    kind: 'travel',
    from: where.cityId,
    to: destination,
    departTick: state.tick,
    arriveTick: state.tick + daysToTicks(days),
    shipId: null,
  };
  return ok(`Überfahrt nach ${cityName(destination)} für ${fare} GS (${days} Tage).`);
}

export function cargoFee(state: GameState, from: CityId, to: CityId, amount: number): number {
  const factor = CHARACTERS[state.player.characterId].freightFactor;
  return Math.round(amount * mapDistance(from, to) * CARGO_RENTAL.pricePerUnitPerDistance * factor);
}

/** Frachtraum auf einem Linienschiff mieten und Ware dem Kapitän mitgeben (CLAUDE.md §2.5, Option B). */
export function handleShipCargo(
  ctx: SimContext,
  good: GoodId,
  amount: number,
  destination: CityId,
  from: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  if (destination === where.cityId) return fail('Die Ware ist bereits hier.');
  const fee = cargoFee(state, where.cityId, destination, amount);
  const error = firstError(
    requirePermission(state, 'rentCargo'),
    requirePositiveAmount(amount),
    requireGoodsAt(state, from, where.cityId, good, amount),
    requireMoney(state, fee),
  );
  if (error) return error;
  removeGoods(resolveStorage(state, from)!, good, amount);
  state.player.money -= fee;
  state.player.consignments.push({
    id: newId<ShipmentId>(state, 'x'),
    good,
    amount,
    from: where.cityId,
    to: destination,
    arriveTick: state.tick + daysToTicks(travelDays(where.cityId, destination, PASSAGE.speedPerDay)),
  });
  return ok(`${amount} ${GOODS[good].name} gehen für ${fee} GS Fracht nach ${cityName(destination)}.`);
}
