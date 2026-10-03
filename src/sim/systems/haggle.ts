import { HAGGLE } from '../data/balance';
import { CITY_IDS, type CityId } from '../data/cities';
import { GOOD_IDS, type GoodId } from '../data/goods';
import { hashFloat } from '../rng';
import type { GameState } from '../state/gameState';
import { dayOf } from '../time';
import { personalPriceBonus } from './market';
import { quoteBuy, quoteSell } from './prices';

/**
 * Feilschen (CLAUDE.md §2.4): Jeder Händler hat pro Ware und Tag eine verborgene
 * Schmerzgrenze. Wer darunter (beim Kaufen) bzw. darüber (beim Verkaufen) bietet, wird
 * abgewiesen; zu gieriges Bieten verdirbt die Laune – und damit den Spielraum.
 */

export type HaggleVerdict = 'accepted' | 'hesitant' | 'offended';

export function merchantMood(state: GameState, cityId: CityId): number {
  return state.player.merchantMood[cityId] ?? 1;
}

/** Marktpreis je Einheit, den man ohne Feilschen bekäme. */
export function standardUnitPrice(
  state: GameState,
  cityId: CityId,
  good: GoodId,
  amount: number,
  direction: 'buy' | 'sell',
): number {
  const city = state.cities[cityId];
  const bonus = personalPriceBonus(state);
  const total =
    direction === 'sell' ? quoteSell(city, good, amount, 1 + bonus) : quoteBuy(city, good, amount, 1 - bonus);
  return total / amount;
}

/** Spielraum des Händlers (Anteil vom Marktpreis) – heute, für diese Ware. */
export function haggleMargin(state: GameState, cityId: CityId, good: GoodId): number {
  const roll = hashFloat(
    state.rng.seed,
    dayOf(state.tick),
    CITY_IDS.indexOf(cityId),
    GOOD_IDS.indexOf(good),
    31,
  );
  const base = HAGGLE.minMargin + (HAGGLE.maxMargin - HAGGLE.minMargin) * roll;
  return base * merchantMood(state, cityId) + state.player.skills.trading.level * HAGGLE.marginPerSkillLevel;
}

/** Grenzpreis je Einheit, den der Händler gerade noch akzeptiert. */
export function haggleLimit(
  state: GameState,
  cityId: CityId,
  good: GoodId,
  amount: number,
  direction: 'buy' | 'sell',
): number {
  const standard = standardUnitPrice(state, cityId, good, amount, direction);
  const margin = haggleMargin(state, cityId, good);
  return direction === 'sell' ? standard * (1 + margin) : standard * (1 - margin);
}

export function judgeOffer(
  offer: number,
  limit: number,
  standard: number,
  direction: 'buy' | 'sell',
): HaggleVerdict {
  const overshoot = direction === 'sell' ? (offer - limit) / standard : (limit - offer) / standard;
  if (overshoot <= 1e-9) return 'accepted';
  return overshoot <= HAGGLE.closeMiss ? 'hesitant' : 'offended';
}

/** Die Händler beruhigen sich jeden Tag ein wenig. */
export function recoverMerchantMood(state: GameState): void {
  for (const cityId of Object.keys(state.player.merchantMood) as CityId[]) {
    const mood = Math.min(1, (state.player.merchantMood[cityId] ?? 1) + HAGGLE.moodRecoveryPerDay);
    if (mood >= 1) delete state.player.merchantMood[cityId];
    else state.player.merchantMood[cityId] = mood;
  }
}
