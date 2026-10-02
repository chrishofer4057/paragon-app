import {
  BUSINESSES,
  INEFFECTIVE_OUTPUT_FACTOR,
  PRODUCTION_BONUS_STEPS,
  type BusinessDef,
  type BusinessTypeId,
} from '../data/businesses';
import { CITIES, type CityId } from '../data/cities';
import type { GoodId } from '../data/goods';
import { SKILL_BUSINESS_BONUS_PER_LEVEL, type SkillId } from '../data/skills';
import type { BusinessState, GameState } from '../state/gameState';
import { HOURS_PER_WEEK, isWinter } from '../time';
import { housingCapacity } from './population';
import { addGoods, amountOf, removeGoods } from './storage';

/**
 * Spielerbetriebe (Tippsammlung Kap. 5): Rohstoffe kommen aus dem Kontor der Stadt,
 * Erzeugnisse gehen dorthin. Ausstoß skaliert mit der Belegschaft; Löhne und Grundsteuer
 * werden wöchentlich fällig – auch wenn mangels Rohstoff nichts produziert wurde (5.6.3).
 */

/** Welche Fertigkeit verbessert Betriebe, die diese Ware herstellen ("selbst gemacht lehrt andere")? */
export const SKILL_FOR_GOOD: Partial<Record<GoodId, SkillId>> = {
  Wood: 'woodcutting',
  Stone: 'quarrying',
  Marble: 'quarrying',
  JauxiteOre: 'quarrying',
  GhostIron: 'quarrying',
  FrostbiteOre: 'quarrying',
  Lunarite: 'quarrying',
  Fish: 'fishing',
  Herbs: 'gathering',
  Faerybloom: 'gathering',
  RareFlowers: 'gathering',
};

/** Effektive Produktion, wenn die Stadt die Ware listet (Spezial- oder reguläre Ware). */
export function isEffectiveIn(cityId: CityId, type: BusinessTypeId): boolean {
  const city = CITIES[cityId];
  const outputs = Object.keys(BUSINESSES[type].outputs) as GoodId[];
  return outputs.some((g) => city.special === g || city.regular.includes(g));
}

/** Darf der Betrieb hier überhaupt stehen (effektiv oder klimatisch erlaubt ineffektiv)? */
export function canBuildBusinessIn(cityId: CityId, type: BusinessTypeId): boolean {
  if (isEffectiveIn(cityId, type)) return true;
  const climate = BUSINESSES[type].ineffectiveClimate;
  if (climate === 'any') return true;
  if (climate === 'listedOnly') return false;
  return CITIES[cityId].culture === climate;
}

export function businessesOfTypeIn(state: GameState, cityId: CityId, type: BusinessTypeId): number {
  let count = 0;
  for (const b of Object.values(state.player.businesses)) if (b.cityId === cityId && b.type === type) count++;
  return count;
}

/** Produktionsbonus ab 3/6/9 gleichen Betrieben in einer Stadt (5.6.2). */
export function productionBonus(count: number): number {
  for (const step of PRODUCTION_BONUS_STEPS) if (count >= step.count) return step.factor;
  return 1;
}

function skillBonus(state: GameState, def: BusinessDef): number {
  let best = 0;
  for (const good of Object.keys(def.outputs) as GoodId[]) {
    const skill = SKILL_FOR_GOOD[good];
    if (skill) best = Math.max(best, state.player.skills[skill].level);
  }
  return 1 + best * SKILL_BUSINESS_BONUS_PER_LEVEL;
}

/** Ausstoßfaktor ohne Rohstoffbegrenzung (1 = Tabellenwert). */
export function outputFactor(state: GameState, business: BusinessState, winter: boolean): number {
  const def = BUSINESSES[business.type];
  const staffing = def.workers > 0 ? business.workers / def.workers : 0;
  const effectiveness = business.effective ? 1 : INEFFECTIVE_OUTPUT_FACTOR;
  const winterFactor = winter && CITIES[business.cityId].culture === 'north' ? def.winterFactor : 1;
  const bonus = productionBonus(businessesOfTypeIn(state, business.cityId, business.type));
  return staffing * effectiveness * winterFactor * bonus * skillBonus(state, def);
}

export function runBusinessesHour(state: GameState): void {
  const winter = isWinter(state.tick);
  for (const business of Object.values(state.player.businesses)) {
    const kontor = state.player.kontors[business.cityId];
    if (!kontor || business.workers <= 0) continue;
    const def = BUSINESSES[business.type];
    const factor = outputFactor(state, business, winter) / HOURS_PER_WEEK;
    let availability = 1;
    for (const [input, perWeek] of Object.entries(def.inputs) as [GoodId, number][]) {
      const needed = perWeek * factor;
      if (needed > 0) availability = Math.min(availability, amountOf(kontor.storage, input) / needed);
    }
    availability = Math.max(0, Math.min(1, availability));
    if (availability <= 0) continue;
    for (const [input, perWeek] of Object.entries(def.inputs) as [GoodId, number][]) {
      removeGoods(kontor.storage, input, perWeek * factor * availability);
    }
    for (const [output, perWeek] of Object.entries(def.outputs) as [GoodId, number][]) {
      addGoods(kontor.storage, output, perWeek * factor * availability);
    }
  }
}

/** Höchstens so viele Neueinstellungen pro Betrieb und Tag (Betriebe füllen sich langsam). */
const MAX_HIRES_PER_DAY = 10;

/**
 * Tägliche Personalplanung: Betriebe stellen bis zur gewünschten Auslastung ein – zuerst
 * Arbeitslose, dann Bettler (die dafür Wohnraum für Arme brauchen) – oder entlassen.
 */
export function runHiringDay(state: GameState): void {
  for (const business of Object.values(state.player.businesses)) {
    const def = BUSINESSES[business.type];
    const target = Math.round(def.workers * business.utilization);
    if (business.workers > target) {
      business.workers = target;
      continue;
    }
    if (business.workers === target) continue;
    const city = state.cities[business.cityId];
    let employed = city.cityJobs;
    for (const b of Object.values(state.player.businesses)) if (b.cityId === city.id) employed += b.workers;
    const unemployed = Math.max(0, city.population.poor - employed);
    let wanted = Math.min(MAX_HIRES_PER_DAY, target - business.workers);
    const fromUnemployed = Math.min(wanted, Math.floor(unemployed));
    business.workers += fromUnemployed;
    wanted -= fromUnemployed;
    if (wanted <= 0) continue;
    const room = Math.max(0, housingCapacity(state, city, 'poor') - city.population.poor);
    const fromBeggars = Math.floor(Math.min(wanted, city.population.beggars, room));
    if (fromBeggars > 0) {
      business.workers += fromBeggars;
      city.population.beggars -= fromBeggars;
      city.population.poor += fromBeggars;
    }
  }
}

/** Wöchentliche Kosten eines Betriebs (Löhne anteilig zur Belegschaft + Grundsteuer). */
export function weeklyBusinessWages(business: BusinessState): number {
  const def = BUSINESSES[business.type];
  return def.workers > 0 ? (def.wagesPerWeek * business.workers) / def.workers : 0;
}
