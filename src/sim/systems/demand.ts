import { MARKET, DISASTERS } from '../data/balance';
import { businessForGood } from '../data/businesses';
import { GOOD_IDS, GOODS, type GoodId } from '../data/goods';
import type { CityState } from '../state/gameState';

/**
 * Bedarf einer Stadt: Verbrauch der Bevölkerung plus Rohstoffbedarf der städtischen
 * Betriebe ("Wochenbedarf von Bürgern und städtischen Betrieben", Tippsammlung 2.1.2.2.3).
 */

export function totalPopulation(city: CityState): number {
  const p = city.population;
  return p.rich + p.wealthy + p.poor;
}

/** Wochenverbrauch der Bürger. */
export function populationDemandWeekly(city: CityState, good: GoodId): number {
  const rates = GOODS[good].consumptionPer1000;
  const p = city.population;
  let demand = (p.rich * rates.rich + p.wealthy * rates.wealthy + p.poor * rates.poor) / 1000;
  if (good === 'Wood' && city.plagueUntilTick !== null) demand *= DISASTERS.plagueWoodDemandFactor;
  return demand;
}

/**
 * Wie viele Einheiten `input` werden je Einheit `output` verbraucht? Bei Betrieben mit
 * mehreren Erzeugnissen (Viehhof: Fleisch + Leder) wird der Rohstoff nach Warenwert aufgeteilt.
 */
function computeInputsPerUnit(output: GoodId): [GoodId, number][] {
  const business = businessForGood(output);
  const outputAmount = business?.outputs[output];
  if (!business || !outputAmount) return [];
  let totalValue = 0;
  for (const [good, amount] of Object.entries(business.outputs) as [GoodId, number][]) {
    totalValue += GOODS[good].basePrice * amount;
  }
  const share = (GOODS[output].basePrice * outputAmount) / totalValue;
  return (Object.entries(business.inputs) as [GoodId, number][]).map(([input, amount]) => [
    input,
    (amount * share) / outputAmount,
  ]);
}

const INPUTS_PER_UNIT: Record<GoodId, [GoodId, number][]> = Object.fromEntries(
  GOOD_IDS.map((g) => [g, computeInputsPerUnit(g)]),
) as Record<GoodId, [GoodId, number][]>;

/** Alle Rohstoffe, die für eine Einheit `output` gebraucht werden. */
export function inputsPerUnit(output: GoodId): readonly [GoodId, number][] {
  return INPUTS_PER_UNIT[output];
}

export function inputPerUnit(output: GoodId, input: GoodId): number {
  return INPUTS_PER_UNIT[output].find(([g]) => g === input)?.[1] ?? 0;
}

/** Wochenbedarf der städtischen Betriebe an `good` als Rohstoff. */
export function cityInputDemandWeekly(city: CityState, good: GoodId): number {
  let demand = 0;
  for (const [output, perDay] of Object.entries(city.cityProduction) as [GoodId, number][]) {
    demand += perDay * 7 * inputPerUnit(output, good);
  }
  return demand;
}

export function totalDemandWeekly(city: CityState, good: GoodId): number {
  return populationDemandWeekly(city, good) + cityInputDemandWeekly(city, good);
}

/** Zielbestand des Marktes: zwei Wochen Bedarf, mindestens ein Sockel je nach Stadtgröße. */
export function targetStock(city: CityState, good: GoodId): number {
  const minTarget = (MARKET.minTargetPer1000 * totalPopulation(city)) / 1000;
  return Math.max(totalDemandWeekly(city, good) * MARKET.targetWeeks, minTarget, 1);
}

/** Wochen Vorrat (Infinity, wenn niemand die Ware braucht). */
export function weeksOfSupply(city: CityState, good: GoodId): number {
  const weekly = totalDemandWeekly(city, good);
  if (weekly <= 0) return Number.POSITIVE_INFINITY;
  return city.market[good] / weekly;
}

export function isShortage(city: CityState, good: GoodId): boolean {
  return GOODS[good].category !== 'material' && weeksOfSupply(city, good) < MARKET.shortageWeeks;
}

export function shortages(city: CityState): GoodId[] {
  return GOOD_IDS.filter((g) => isShortage(city, g));
}
