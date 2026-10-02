import { businessForGood } from '../data/businesses';
import { CITIES, CITY_IDS } from '../data/cities';
import { GOOD_IDS, type GoodId } from '../data/goods';
import type { CityState, GameState } from '../state/gameState';
import { HOURS_PER_WEEK, isWinter } from '../time';
import { inputsPerUnit, populationDemandWeekly } from './demand';

/**
 * Stündliche Stadtwirtschaft: städtische Betriebe produzieren (und verbrauchen dafür
 * Rohstoffe vom Markt), danach verbrauchen die Bürger.
 */

/** Winterfaktor für Anbaubetriebe – nur im Norden (Tippsammlung 5.6.4). */
export function winterFactor(cityId: CityState['id'], good: GoodId, winter: boolean): number {
  if (!winter || CITIES[cityId].culture !== 'north') return 1;
  return businessForGood(good)?.winterFactor ?? 1;
}

function produceHour(city: CityState, winter: boolean): void {
  for (const [good, perDay] of Object.entries(city.cityProduction) as [GoodId, number][]) {
    let output = (perDay / 24) * winterFactor(city.id, good, winter);
    if (output <= 0) continue;
    // Rohstoffmangel drosselt die Produktion anteilig ("ineffektive Produktion").
    const inputs = inputsPerUnit(good);
    let availability = 1;
    for (const [input, perUnit] of inputs) {
      const needed = perUnit * output;
      if (needed > 0) availability = Math.min(availability, city.market[input] / needed);
    }
    output *= Math.max(0, Math.min(1, availability));
    for (const [input, perUnit] of inputs) {
      city.market[input] = Math.max(0, city.market[input] - perUnit * output);
    }
    city.market[good] += output;
  }
}

function consumeHour(city: CityState): void {
  for (const good of GOOD_IDS) {
    const perHour = populationDemandWeekly(city, good) / HOURS_PER_WEEK;
    if (perHour > 0) city.market[good] = Math.max(0, city.market[good] - perHour);
  }
}

export function runCityEconomyHour(state: GameState): void {
  const winter = isWinter(state.tick);
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    produceHour(city, winter);
    consumeHour(city);
  }
}
