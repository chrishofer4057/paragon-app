import { BUSINESSES, type BusinessTypeId } from '../../data/businesses';
import {
  HOUSES,
  INFRASTRUCTURE,
  RENT_LEVELS,
  type HouseTypeId,
  type InfrastructureId,
} from '../../data/buildings';
import type { GoodAmounts } from '../../data/goods';
import type { SimContext } from '../../context';
import type { ConstructionKind, GameState } from '../../state/gameState';
import type { BusinessId, HouseId } from '../../state/ids';
import { canBuildBusinessIn, isEffectiveIn } from '../../systems/businesses';
import {
  applyMaterialPlan,
  constructionName,
  describeMissing,
  enqueueConstruction,
  hasMissing,
  planMaterials,
} from '../../systems/construction';
import { totalPopulation } from '../../systems/demand';
import { wellsNeeded } from '../../systems/population';
import { fail, ok, type CommandResult } from '../commands';
import { cityName, requireCity, requireMoney, requirePermission } from '../guards';
import type { CityId } from '../../data/cities';

/** Gemeinsamer Ablauf: Material planen, Geld prüfen, buchen, Auftrag einreihen. */
function orderConstruction(
  ctx: SimContext,
  cityId: CityId,
  kind: ConstructionKind,
  cost: number,
  materials: GoodAmounts,
  days: number,
): CommandResult {
  const { state } = ctx;
  const plan = planMaterials(state, cityId, materials);
  if (hasMissing(plan)) return fail(`Es fehlt Baumaterial: ${describeMissing(plan)}.`);
  const moneyError = requireMoney(state, cost + plan.marketCost);
  if (moneyError) return moneyError;
  applyMaterialPlan(state, cityId, plan);
  state.player.money -= cost;
  enqueueConstruction(ctx, cityId, kind, days);
  return ok(`${constructionName(kind)} in ${cityName(cityId)} in Auftrag gegeben.`);
}

export function handleBuildBusiness(ctx: SimContext, businessType: BusinessTypeId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const error = requirePermission(state, 'buildBusinesses');
  if (error) return error;
  if (!state.player.kontors[cityId])
    return fail('Betriebe brauchen ein Kontor in der Stadt (Rohstoffe und Erzeugnisse lagern dort).');
  if (!canBuildBusinessIn(cityId, businessType)) {
    return fail(`${BUSINESSES[businessType].name} kann in ${cityName(cityId)} nicht betrieben werden.`);
  }
  const def = BUSINESSES[businessType];
  const effective = isEffectiveIn(cityId, businessType);
  return orderConstruction(
    ctx,
    cityId,
    { type: 'business', businessType, effective },
    def.buildCost,
    def.materials,
    def.buildDays,
  );
}

export function handleSetUtilization(
  ctx: SimContext,
  businessId: BusinessId,
  utilization: number,
): CommandResult {
  const business = ctx.state.player.businesses[businessId];
  if (!business) return fail('Diesen Betrieb gibt es nicht.');
  if (!Number.isFinite(utilization) || utilization < 0 || utilization > 1)
    return fail('Auslastung zwischen 0 und 100 %.');
  business.utilization = utilization;
  return ok();
}

export function handleDemolishBusiness(ctx: SimContext, businessId: BusinessId): CommandResult {
  const business = ctx.state.player.businesses[businessId];
  if (!business) return fail('Diesen Betrieb gibt es nicht.');
  // Die Arbeiter bleiben als Arbeitslose in der Stadt.
  delete ctx.state.player.businesses[businessId];
  return ok(`${BUSINESSES[business.type].name} abgerissen.`);
}

export function handleBuildHouse(ctx: SimContext, houseType: HouseTypeId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = requirePermission(state, 'buildHouses');
  if (error) return error;
  const def = HOUSES[houseType];
  return orderConstruction(
    ctx,
    where.cityId,
    { type: 'house', houseType },
    def.cost,
    def.materials,
    def.buildDays,
  );
}

export function handleSetRentLevel(ctx: SimContext, houseId: HouseId, level: number): CommandResult {
  const house = ctx.state.player.houses[houseId];
  if (!house) return fail('Dieses Haus gibt es nicht.');
  if (!Number.isInteger(level) || level < 0 || level >= RENT_LEVELS.length)
    return fail('Ungültige Mietstufe.');
  house.rentLevel = level;
  return ok();
}

function pendingCount(state: GameState, cityId: CityId, infrastructure: InfrastructureId): number {
  return Object.values(state.constructions).filter(
    (j) =>
      j.cityId === cityId && j.kind.type === 'infrastructure' && j.kind.infrastructure === infrastructure,
  ).length;
}

/** Wie viele Einheiten dieser Infrastruktur sind sinnvoll (Brunnen je 500 Einwohner usw.)? */
export function infrastructureLimit(
  state: GameState,
  cityId: CityId,
  infrastructure: InfrastructureId,
): number {
  const def = INFRASTRUCTURE[infrastructure];
  const city = state.cities[cityId];
  if (def.maxCount !== null) return def.maxCount;
  if (infrastructure === 'well') return wellsNeeded(city);
  return Math.max(1, Math.ceil(totalPopulation(city) / (def.perPopulation ?? 1)));
}

export function handleFundInfrastructure(ctx: SimContext, infrastructure: InfrastructureId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const error = requirePermission(state, 'fundInfrastructure');
  if (error) return error;
  const def = INFRASTRUCTURE[infrastructure];
  const existing =
    state.cities[cityId].infrastructure[infrastructure] + pendingCount(state, cityId, infrastructure);
  if (existing >= infrastructureLimit(state, cityId, infrastructure)) {
    return fail(`${cityName(cityId)} braucht derzeit kein weiteres Bauwerk dieser Art (${def.name}).`);
  }
  return orderConstruction(
    ctx,
    cityId,
    { type: 'infrastructure', infrastructure },
    def.cost,
    def.materials,
    def.buildDays,
  );
}
