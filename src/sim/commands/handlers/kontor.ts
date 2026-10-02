import { KONTOR_MANAGER } from '../../data/balance';
import { KONTOR, MAX_GUARDS, WAREHOUSE } from '../../data/buildings';
import type { CityId } from '../../data/cities';
import { GOODS, type GoodId } from '../../data/goods';
import type { SimContext } from '../../context';
import type { GameState, StandingOrder } from '../../state/gameState';
import {
  applyMaterialPlan,
  describeMissing,
  enqueueConstruction,
  hasMissing,
  planMaterials,
} from '../../systems/construction';
import { effectiveReputation } from '../../systems/reputation';
import { fail, ok, type CommandResult } from '../commands';
import { cityName, firstError, requireCity, requireMoney, requirePermission } from '../guards';

/** Gesellschaftliches Ansehen, das man in einer fremden Stadt für ein Kontor braucht (6.0). */
export const KONTOR_ABROAD_MIN_SOCIETAL = 1;

function kontorPending(state: GameState, cityId: CityId): boolean {
  return Object.values(state.constructions).some((j) => j.cityId === cityId && j.kind.type === 'kontor');
}

export function handleFoundKontor(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const home = cityId === state.player.homeCityId;
  const error = requirePermission(state, home ? 'foundKontor' : 'foundKontorAbroad');
  if (error) return error;
  if (state.player.kontors[cityId] || kontorPending(state, cityId))
    return fail('Hier habt Ihr bereits ein Kontor.');
  if (!home && effectiveReputation(state, cityId).societal < KONTOR_ABROAD_MIN_SOCIETAL) {
    return fail(`Die Bürger von ${cityName(cityId)} kennen Euch noch zu wenig, um Euch bauen zu lassen.`);
  }
  const plan = planMaterials(state, cityId, KONTOR.materials);
  if (hasMissing(plan)) return fail(`Es fehlt Baumaterial: ${describeMissing(plan)}.`);
  const moneyError = requireMoney(state, KONTOR.cost + plan.marketCost);
  if (moneyError) return moneyError;

  applyMaterialPlan(state, cityId, plan);
  state.player.money -= KONTOR.cost;
  enqueueConstruction(ctx, cityId, { type: 'kontor' }, KONTOR.buildDays);
  return ok(`Der Bau Eures Kontors in ${cityName(cityId)} ist in Auftrag gegeben.`);
}

export function handleBuildWarehouse(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const error = requirePermission(state, 'buildWarehouse');
  if (error) return error;
  if (!state.player.kontors[cityId]) return fail('Ein Lagerhaus braucht ein Kontor in der Stadt.');
  const plan = planMaterials(state, cityId, WAREHOUSE.materials);
  if (hasMissing(plan)) return fail(`Es fehlt Baumaterial: ${describeMissing(plan)}.`);
  const moneyError = requireMoney(state, WAREHOUSE.cost + plan.marketCost);
  if (moneyError) return moneyError;

  applyMaterialPlan(state, cityId, plan);
  state.player.money -= WAREHOUSE.cost;
  enqueueConstruction(ctx, cityId, { type: 'warehouse' }, WAREHOUSE.buildDays);
  return ok('Lagerhaus in Auftrag gegeben.');
}

export function handleSetGuards(ctx: SimContext, cityId: CityId, count: number): CommandResult {
  const kontor = ctx.state.player.kontors[cityId];
  if (!kontor) return fail('Dort habt Ihr kein Kontor.');
  if (!Number.isInteger(count) || count < 0 || count > MAX_GUARDS)
    return fail(`Zwischen 0 und ${MAX_GUARDS} Wachen.`);
  kontor.guards = count;
  return ok();
}

export function handleHireManager(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const kontor = state.player.kontors[where.cityId];
  const error = firstError(
    requirePermission(state, 'hireManager'),
    requireMoney(state, KONTOR_MANAGER.hireFee),
  );
  if (error) return error;
  if (!kontor) return fail('Ein Verwalter braucht ein Kontor.');
  if (kontor.manager) return fail('Hier arbeitet bereits ein Verwalter.');
  state.player.money -= KONTOR_MANAGER.hireFee;
  kontor.manager = { orders: {} };
  return ok('Ein Verwalter führt nun Euer Kontor.');
}

export function handleFireManager(ctx: SimContext, cityId: CityId): CommandResult {
  const kontor = ctx.state.player.kontors[cityId];
  if (!kontor?.manager) return fail('Dort arbeitet kein Verwalter.');
  kontor.manager = null;
  return ok('Verwalter entlassen.');
}

function validOrder(order: StandingOrder): boolean {
  const nums = [order.buyUpTo, order.keepMin, order.buyBelow ?? 0, order.sellAbove ?? 0];
  if (!nums.every((n) => Number.isFinite(n) && n >= 0)) return false;
  // Wer billiger kauft als er verkauft, handelt mit sich selbst.
  if (order.buyBelow !== null && order.sellAbove !== null && order.buyBelow >= order.sellAbove) return false;
  return true;
}

export function handleSetStandingOrder(
  ctx: SimContext,
  cityId: CityId,
  good: GoodId,
  order: StandingOrder | null,
): CommandResult {
  const kontor = ctx.state.player.kontors[cityId];
  if (!kontor?.manager) return fail('Dort arbeitet kein Verwalter.');
  if (order === null) {
    delete kontor.manager.orders[good];
    return ok();
  }
  if (!validOrder(order)) return fail('Ungültiger Auftrag (Kaufpreis muss unter dem Verkaufspreis liegen).');
  kontor.manager.orders[good] = { ...order };
  return ok(`Dauerauftrag für ${GOODS[good].name} gesetzt.`);
}
