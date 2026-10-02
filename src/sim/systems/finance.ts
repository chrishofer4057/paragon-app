import { KONTOR_MANAGER, POPULATION } from '../data/balance';
import { BUSINESS_LAND_TAX_PER_WEEK, BUSINESSES } from '../data/businesses';
import {
  GUARD_WAGE_PER_DAY,
  HOUSES,
  KONTOR,
  OVERFLOW_STORAGE_COST_PER_UNIT_DAY,
  RENT_LEVELS,
  WAREHOUSE,
} from '../data/buildings';
import { CITY_IDS, type CityId } from '../data/cities';
import { GOODS, type GoodAmounts, type GoodId } from '../data/goods';
import { CAPTAIN_WAGE_PER_DAY, HELMSMAN_EXTRA_WAGE, SAILOR_WAGE_PER_DAY, SHIP_TYPES } from '../data/ships';
import { postMessage, type SimContext } from '../context';
import type { GameState } from '../state/gameState';
import { weeklyBusinessWages } from './businesses';
import { totalPopulation } from './demand';
import { housingCapacity } from './population';
import { addReputation } from './reputation';
import { sellPrice } from './prices';
import { kontorCapacity, totalAmount } from './storage';

/**
 * Laufende Kosten und Einnahmen.
 * Täglich: Lagerüberlauf, Wachen, Verwalter, Schiffsbesatzungen, Kopfsteuer an die Stadtkasse.
 * Wöchentlich: Löhne und Grundsteuern (an die Stadtkasse), Mieten.
 */

export function ownBuildingsInCity(state: GameState, cityId: CityId): number {
  let count = 0;
  const p = state.player;
  const kontor = p.kontors[cityId];
  if (kontor) count += 1 + kontor.warehouses;
  for (const b of Object.values(p.businesses)) if (b.cityId === cityId) count++;
  for (const h of Object.values(p.houses)) if (h.cityId === cityId) count++;
  return count;
}

export function managerWagePerDay(state: GameState, cityId: CityId): number {
  return (
    KONTOR_MANAGER.baseWagePerDay + KONTOR_MANAGER.wagePerBuildingPerDay * ownBuildingsInCity(state, cityId)
  );
}

export function dailyPlayerCosts(state: GameState): number {
  const p = state.player;
  let total = 0;
  for (const cityId of CITY_IDS) {
    const kontor = p.kontors[cityId];
    if (!kontor) continue;
    const overflow = Math.max(0, totalAmount(kontor.storage) - kontorCapacity(kontor));
    total += overflow * OVERFLOW_STORAGE_COST_PER_UNIT_DAY;
    total += kontor.guards * GUARD_WAGE_PER_DAY;
    if (kontor.manager) total += managerWagePerDay(state, cityId);
  }
  for (const ship of Object.values(state.ships)) {
    total += ship.crew * SAILOR_WAGE_PER_DAY;
    if (ship.hasCaptain) total += CAPTAIN_WAGE_PER_DAY;
    else if (ship.crew > 0) total += HELMSMAN_EXTRA_WAGE;
  }
  return total;
}

export function runFinanceDay(ctx: SimContext): void {
  const { state } = ctx;
  state.player.money -= dailyPlayerCosts(state);
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    city.treasury += totalPopulation(city) * city.headTax * POPULATION.headTaxIncomePerCapitaDay;
  }
  if (state.player.money < 0) {
    postMessage(
      ctx,
      'danger',
      'Kasse im Minus',
      'Eure Barschaft ist aufgebraucht. Begleicht Eure Schulden rasch!',
    );
  }
}

/** Mieter verteilen sich anteilig auf allen Wohnraum ihrer Schicht. */
export function updateTenants(state: GameState): void {
  for (const house of Object.values(state.player.houses)) {
    const def = HOUSES[house.type];
    const city = state.cities[house.cityId];
    const capacity = housingCapacity(state, city, def.tenantClass);
    const occupancy = capacity > 0 ? Math.min(1, city.population[def.tenantClass] / capacity) : 0;
    house.tenants = Math.floor(def.capacity * occupancy);
  }
}

export interface WeeklyStatement {
  wages: number;
  landTax: number;
  rent: number;
}

export function runFinanceWeek(ctx: SimContext): WeeklyStatement {
  const { state } = ctx;
  const p = state.player;
  const statement: WeeklyStatement = { wages: 0, landTax: 0, rent: 0 };
  const payTax = (cityId: CityId, amount: number): void => {
    statement.landTax += amount;
    state.cities[cityId].treasury += amount;
  };

  for (const business of Object.values(p.businesses)) {
    statement.wages += weeklyBusinessWages(business);
    payTax(business.cityId, BUSINESS_LAND_TAX_PER_WEEK);
  }
  updateTenants(state);
  for (const house of Object.values(p.houses)) {
    const def = HOUSES[house.type];
    const level = RENT_LEVELS[house.rentLevel] ?? RENT_LEVELS[2]!;
    statement.rent += house.tenants * def.rentPerTenantWeek * level.factor;
    payTax(house.cityId, def.landTaxPerWeek);
    if (level.socialPerTenantWeek !== 0) {
      addReputation(state, house.cityId, { social: house.tenants * level.socialPerTenantWeek });
    }
  }
  for (const cityId of CITY_IDS) {
    const kontor = p.kontors[cityId];
    if (!kontor) continue;
    payTax(cityId, KONTOR.landTaxPerWeek + kontor.warehouses * WAREHOUSE.landTaxPerWeek);
  }

  p.money += statement.rent - statement.wages - statement.landTax;
  return statement;
}

/** Wert von Waren zum aktuellen Verkaufspreis der Stadt. */
export function valueOfGoods(state: GameState, storage: GoodAmounts, cityId: CityId | null): number {
  let value = 0;
  for (const [good, amount] of Object.entries(storage) as [GoodId, number][]) {
    const price = cityId ? sellPrice(state.cities[cityId], good) : GOODS[good].basePrice * 0.8;
    value += amount * price;
  }
  return value;
}

/**
 * Unternehmenswert (Tippsammlung 6.1.2): Bargeld + Waren + Schiffe + Gebäude − Schulden.
 * Geld in der Stadtkasse zählt nicht.
 */
export function computeNetWorth(state: GameState): number {
  const p = state.player;
  let total = p.money;
  const here = p.location.kind === 'city' ? p.location.cityId : null;
  total += valueOfGoods(state, p.inventory, here);
  for (const cityId of CITY_IDS) {
    const kontor = p.kontors[cityId];
    if (!kontor) continue;
    total += valueOfGoods(state, kontor.storage, cityId);
    total += KONTOR.cost + kontor.warehouses * WAREHOUSE.cost;
  }
  for (const b of Object.values(p.businesses)) total += BUSINESSES[b.type].buildCost;
  for (const h of Object.values(p.houses)) total += HOUSES[h.type].cost;
  for (const ship of Object.values(state.ships)) {
    total += SHIP_TYPES[ship.type].cost * (0.5 + ship.condition / 200);
    const port = ship.location.kind === 'port' ? ship.location.cityId : null;
    total += valueOfGoods(state, ship.cargo, port);
  }
  for (const loan of Object.values(state.loans)) total -= loan.owed;
  for (const lent of Object.values(state.lentLoans)) total += lent.principal;
  return Math.round(total);
}
