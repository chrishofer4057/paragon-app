import { DISASTERS } from '../data/balance';
import { CITIES, CITY_IDS, type CityId } from '../data/cities';
import { GOOD_IDS, type GoodId } from '../data/goods';
import { emit, postMessage, type SimContext } from '../context';
import { chance } from '../rng';
import type { GameState } from '../state/gameState';
import { daysToTicks } from '../time';
import { healthScore, wellCoverage } from './population';

/**
 * Feuer und Seuche (Tippsammlung 2.2.5): Brunnen senken das Brandrisiko, Straßen,
 * Spitäler und Kapellen die Seuchengefahr. Ist der Spieler beim Ausbruch in der Stadt,
 * kann er eingreifen und der Schaden halbiert sich (CLAUDE.md §2.3.5).
 */

function playerPresent(state: GameState, cityId: CityId): boolean {
  return state.player.location.kind === 'city' && state.player.location.cityId === cityId;
}

function fire(ctx: SimContext, cityId: CityId): void {
  const { state } = ctx;
  const city = state.cities[cityId];
  const damage = playerPresent(state, cityId) ? DISASTERS.presenceDamageFactor : 1;
  for (const good of ['Wood', 'Grain', 'Faerybloom'] as GoodId[]) {
    city.market[good] *= 1 - DISASTERS.fireGoodsLossShare * damage;
  }
  const kontor = state.player.kontors[cityId];
  if (kontor) {
    for (const good of GOOD_IDS) {
      const amount = kontor.storage[good];
      if (amount) kontor.storage[good] = amount * (1 - DISASTERS.fireGoodsLossShare * damage);
    }
  }
  const lost: string[] = [];
  for (const business of Object.values(state.player.businesses)) {
    if (business.cityId === cityId && chance(state.rng, DISASTERS.fireBuildingLossChance * damage)) {
      delete state.player.businesses[business.id];
      lost.push('einen Betrieb');
    }
  }
  for (const house of Object.values(state.player.houses)) {
    if (house.cityId === cityId && chance(state.rng, DISASTERS.fireBuildingLossChance * damage)) {
      delete state.player.houses[house.id];
      lost.push('ein Wohnhaus');
    }
  }
  emit(ctx, { type: 'FireBrokeOut', cityId });
  const extra = lost.length > 0 ? ` Ihr habt ${lost.join(', ')} verloren.` : '';
  const help = damage < 1 ? ' Dank Eurer Hilfe beim Löschen blieb Schlimmeres aus.' : '';
  postMessage(
    ctx,
    'danger',
    'Feuer!',
    `In ${CITIES[cityId].name} ist ein Brand ausgebrochen.${extra}${help}`,
    cityId,
  );
}

function plague(ctx: SimContext, cityId: CityId): void {
  const { state } = ctx;
  const city = state.cities[cityId];
  city.plagueUntilTick = state.tick + daysToTicks(DISASTERS.plagueDays);
  const kontor = state.player.kontors[cityId];
  const managerRisk =
    DISASTERS.plagueManagerDeathChance * (playerPresent(state, cityId) ? DISASTERS.presenceDamageFactor : 1);
  if (kontor?.manager && chance(state.rng, managerRisk)) {
    kontor.manager = null;
    postMessage(
      ctx,
      'danger',
      'Verwalter verstorben',
      `Euer Kontorverwalter in ${CITIES[cityId].name} ist der Seuche erlegen. Seine Anweisungen sind verloren.`,
      cityId,
    );
  }
  emit(ctx, { type: 'PlagueStarted', cityId });
  postMessage(ctx, 'danger', 'Seuche', `In ${CITIES[cityId].name} ist die Seuche ausgebrochen.`, cityId);
}

export function runDisastersDay(ctx: SimContext): void {
  const { state } = ctx;
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    if (city.plagueUntilTick !== null && city.plagueUntilTick <= state.tick) {
      city.plagueUntilTick = null;
      emit(ctx, { type: 'PlagueEnded', cityId });
    }
    const fireFactor = 1 - (1 - DISASTERS.fireMinFactor) * wellCoverage(city);
    if (chance(state.rng, DISASTERS.fireDailyChance * fireFactor)) fire(ctx, cityId);
    if (city.plagueUntilTick === null) {
      const plagueFactor = 1 - (1 - DISASTERS.plagueMinFactor) * healthScore(city);
      if (chance(state.rng, DISASTERS.plagueDailyChance * plagueFactor)) plague(ctx, cityId);
    }
  }
}
