import { DISASTERS, POPULATION } from '../data/balance';
import {
  HOSPITAL_GROWTH_BONUS,
  HOUSES,
  MINT_RICH_BONUS,
  SCHOOL_BEGGAR_BONUS,
  TEMPLE_STAGES,
  type PopulationClass,
} from '../data/buildings';
import { CITY_IDS } from '../data/cities';
import { GOOD_IDS, GOODS } from '../data/goods';
import type { CityState, GameState } from '../state/gameState';
import { dayOf } from '../time';
import { totalDemandWeekly, totalPopulation } from './demand';

/**
 * Bevölkerung (Tippsammlung 3.1.2, 2.2.2, 2.2.5):
 * - Zufriedenheit je Schicht hängt von den Waren ab, die diese Schicht verbraucht
 *   (Ziel: zwei Wochen Vorrat), plus Steuern, Wohnraum, Brunnen, Feste, Tempel, Seuchen.
 * - Reiche und Wohlhabende wandern zu/ab, begrenzt durch Wohnraum und Anteilsgrenzen.
 * - Arme sind Arbeiter: Sie entstehen, wenn Betriebe Bettler einstellen.
 * - Bettler strömen zu, wenn die Armen zufrieden sind (Schule +30 %, Armenspeisung ×4,5).
 */

export const CLASSES: readonly PopulationClass[] = ['rich', 'wealthy', 'poor'];

export const HAPPINESS_LABELS = [
  'verärgert',
  'unzufrieden',
  'zufrieden',
  'sehr zufrieden',
  'glücklich',
  'sehr glücklich',
] as const;

export function happinessLevel(score: number): number {
  let level = 0;
  for (const threshold of POPULATION.levelThresholds) if (score >= threshold) level += 1;
  return level;
}

/** Gesamter Wohnraum einer Schicht: städtisch plus Spielerhäuser. */
export function housingCapacity(state: GameState, city: CityState, cls: PopulationClass): number {
  let capacity = city.housing[cls];
  for (const house of Object.values(state.player.houses)) {
    const def = HOUSES[house.type];
    if (house.cityId === city.id && def.tenantClass === cls) capacity += def.capacity;
  }
  return capacity;
}

export function playerWorkers(state: GameState, city: CityState): number {
  let workers = 0;
  for (const b of Object.values(state.player.businesses)) if (b.cityId === city.id) workers += b.workers;
  return workers;
}

/** Arbeitsplätze insgesamt (Stadt + Spieler, voll besetzt). */
export function jobsTotal(state: GameState, city: CityState): number {
  return city.cityJobs + playerWorkers(state, city);
}

/** Wie viele Brunnen braucht die Stadt (einer je angefangene 500 Einwohner, 2.2.5.1)? */
export function wellsNeeded(city: CityState): number {
  return Math.max(1, Math.ceil(totalPopulation(city) / 500));
}

export function wellCoverage(city: CityState): number {
  return Math.min(1, city.infrastructure.well / wellsNeeded(city));
}

/** Seuchenvorsorge 0..1 aus Straßen, Brunnen, Spitälern und Kapellen (2.2.5.2). */
export function healthScore(city: CityState): number {
  const pop = totalPopulation(city);
  const careNeeded = Math.max(1, Math.ceil(pop / 2500));
  const hospitals = Math.min(1, city.infrastructure.hospital / careNeeded);
  const chapels = Math.min(1, city.infrastructure.chapel / careNeeded);
  const roads = city.infrastructure.road / 4;
  return 0.3 * roads + 0.2 * wellCoverage(city) + 0.3 * hospitals + 0.2 * chapels;
}

function supplyScore(city: CityState, cls: PopulationClass): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const good of GOOD_IDS) {
    const def = GOODS[good];
    if (def.importance <= 0) continue;
    const rates = def.consumptionPer1000;
    const maxRate = Math.max(rates.rich, rates.wealthy, rates.poor);
    if (maxRate <= 0 || rates[cls] <= 0) continue;
    const weight = def.importance * (rates[cls] / maxRate);
    const weekly = totalDemandWeekly(city, good);
    const weeks = weekly > 0 ? city.market[good] / weekly : POPULATION.targetWeeks;
    weighted += weight * Math.min(1.25, Math.max(0, weeks / POPULATION.targetWeeks));
    totalWeight += weight;
  }
  return totalWeight > 0 ? weighted / totalWeight : 1;
}

/** Zufriedenheitswert einer Schicht (0 … 1.25). */
export function computeHappiness(state: GameState, city: CityState, cls: PopulationClass): number {
  let score = supplyScore(city, cls);
  score += (POPULATION.defaultHeadTax - city.headTax) * 100 * POPULATION.headTaxHappinessPerPoint;
  const capacity = housingCapacity(state, city, cls);
  const occupancy = capacity > 0 ? city.population[cls] / capacity : 1;
  if (occupancy >= 1) score -= POPULATION.housingShortagePenalty;
  else if (occupancy >= 0.97) score -= POPULATION.housingShortagePenalty / 3;
  score -= (1 - wellCoverage(city)) * POPULATION.wellShortagePenalty;
  score += city.infrastructure.road * POPULATION.roadBonusPerStep;
  for (let i = 0; i < city.temple.stage; i++) score += TEMPLE_STAGES[i]!.happiness;
  if (state.tick < city.festivalBoostUntilTick) score += POPULATION.festivalHappiness;
  if (city.plagueUntilTick !== null) score -= POPULATION.plagueHappinessPenalty;
  return Math.min(1.25, Math.max(0, score));
}

function updateHappiness(state: GameState, city: CityState): void {
  for (const cls of CLASSES) city.happiness[cls] = computeHappiness(state, city, cls);
}

/** Zu- und Abwanderung der Reichen und Wohlhabenden. */
function migrateUpperClasses(state: GameState, city: CityState): void {
  const total = totalPopulation(city);
  for (const cls of ['rich', 'wealthy'] as const) {
    const level = happinessLevel(city.happiness[cls]);
    let rate = POPULATION.dailyGrowthByLevel[level] ?? 0;
    if (rate > 0) {
      if (city.infrastructure.hospital > 0) rate *= HOSPITAL_GROWTH_BONUS;
      if (cls === 'rich' && city.infrastructure.mint > 0) rate *= MINT_RICH_BONUS;
      if (city.plagueUntilTick !== null) rate = 0;
    }
    const current = city.population[cls];
    let next = current * (1 + rate);
    const shares = POPULATION.shares[cls];
    const maxByShare = total * shares.max;
    const minByShare = total * shares.min;
    const capacity = housingCapacity(state, city, cls);
    if (rate > 0) next = Math.min(next, Math.max(current, Math.min(maxByShare, capacity)));
    if (next > maxByShare) next = Math.max(maxByShare, current * (1 - 0.01));
    if (next < minByShare && rate >= 0) next = Math.min(minByShare, capacity);
    city.population[cls] = Math.max(0, next);
  }
}

/**
 * Arbeitsmarkt: Städtische Betriebe haben Vorrang bei Arbeitskräften (2.1.1.7.2: "Die ältesten
 * Betriebe der Stadt bekommen als erstes Arbeitskräfte"). Fehlen Arme, verlieren zuerst die
 * Spielerbetriebe Arbeiter; überschüssige Arbeitslose werden zu Bettlern.
 */
function rebalanceEmployment(state: GameState, city: CityState): void {
  const level = happinessLevel(city.happiness.poor);
  const emigration = level <= 1 ? Math.abs(POPULATION.dailyGrowthByLevel[level] ?? 0) : 0;
  city.population.poor *= 1 - emigration;

  const cityEmployed = Math.min(city.cityJobs, city.population.poor);
  const availableForPlayer = Math.max(0, city.population.poor - cityEmployed);
  const businesses = Object.values(state.player.businesses).filter((b) => b.cityId === city.id);
  const employedByPlayer = businesses.reduce((sum, b) => sum + b.workers, 0);
  if (employedByPlayer > availableForPlayer && employedByPlayer > 0) {
    const keep = availableForPlayer / employedByPlayer;
    for (const b of businesses) b.workers = Math.floor(b.workers * keep);
  }

  const jobs = cityEmployed + businesses.reduce((sum, b) => sum + b.workers, 0);
  const unemployed = city.population.poor - jobs;
  const tolerated = jobsTotal(state, city) * POPULATION.unemployedTolerance;
  if (unemployed > tolerated) {
    const leaving = (unemployed - tolerated) * POPULATION.unemployedOutflowRate;
    city.population.poor -= leaving;
    city.population.beggars += leaving * 0.5;
  }

  // Freie städtische Stellen werden aus den Bettlern besetzt, sofern Wohnraum da ist.
  const vacancies = city.cityJobs - Math.min(city.cityJobs, city.population.poor);
  if (vacancies > 0) {
    const room = Math.max(0, housingCapacity(state, city, 'poor') - city.population.poor);
    const hired = Math.min(vacancies, city.population.beggars, room);
    city.population.poor += hired;
    city.population.beggars -= hired;
  }
}

function updateBeggars(state: GameState, city: CityState): void {
  const pop = totalPopulation(city);
  const poorScore = city.happiness.poor;
  let inflow = pop * POPULATION.beggarInflowRate * Math.max(0, (poorScore - 0.4) / 0.6);
  if (city.infrastructure.school > 0) inflow *= SCHOOL_BEGGAR_BONUS;
  if (city.almsBoostDay === dayOf(state.tick)) inflow *= POPULATION.almsBeggarFactor;
  if (city.plagueUntilTick !== null) inflow = 0;
  city.population.beggars += inflow;

  const cap = pop * POPULATION.beggarCapShare;
  if (city.population.beggars > cap) {
    city.population.beggars -= (city.population.beggars - cap) * POPULATION.beggarExcessOutflowRate;
  }
  if (happinessLevel(poorScore) <= 1) {
    city.population.beggars *= 1 - POPULATION.beggarOutflowRate;
  }
}

function applyPlague(city: CityState): void {
  if (city.plagueUntilTick === null) return;
  const rate = DISASTERS.plagueDailyDeathRate;
  city.population.poor *= 1 - rate;
  city.population.beggars *= 1 - rate * 1.5;
  city.population.wealthy *= 1 - rate * 0.5;
  city.population.rich *= 1 - rate * 0.5;
}

export function runPopulationDay(state: GameState): void {
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    updateHappiness(state, city);
    applyPlague(city);
    migrateUpperClasses(state, city);
    rebalanceEmployment(state, city);
    updateBeggars(state, city);
  }
}

/** Städte bauen selbst Wohnraum nach, wenn eine Schicht über 95 % belegt ist (2.2.2.2). */
export function runCityHousingWeek(state: GameState, threshold: number): void {
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    for (const cls of CLASSES) {
      const capacity = housingCapacity(state, city, cls);
      if (capacity > 0 && city.population[cls] / capacity > threshold) {
        const house = Object.values(HOUSES).find((h) => h.tenantClass === cls)!;
        city.housing[cls] += house.capacity;
      }
    }
  }
}
