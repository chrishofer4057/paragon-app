import { CHARACTERS } from '../data/characters';
import type { CityId } from '../data/cities';
import type { GoodAmounts, GoodId } from '../data/goods';
import { emit, type SimContext } from '../context';
import type { GameState } from '../state/gameState';
import { quoteBuy, quoteSell } from './prices';
import { addReputation, tradeReputationDelta, type ReputationValue } from './reputation';
import { addGoods, removeGoods } from './storage';
import { gainSkillXp } from './skills';

/**
 * Ausführung von Handelsgeschäften mit dem Stadtmarkt. Prüfungen (Rang, Geld, Platz,
 * Anwesenheit) erledigen die Command-Handler vorher – hier wird nur noch gebucht.
 */

export interface TradeOutcome {
  amount: number;
  total: number;
  reputation: ReputationValue;
}

/** Preisvorteil beim persönlichen Handel: Figurenbonus + 0,5 % je Stufe "Handeln". */
export function personalPriceBonus(state: GameState): number {
  const character = CHARACTERS[state.player.characterId];
  return character.personalTradeBonus + state.player.skills.trading.level * 0.005;
}

export function sellToMarket(
  ctx: SimContext,
  cityId: CityId,
  good: GoodId,
  amount: number,
  from: GoodAmounts,
  options: { personal: boolean; priceBonus: number },
): TradeOutcome {
  const { state } = ctx;
  const city = state.cities[cityId];
  const total = quoteSell(city, good, amount, 1 + options.priceBonus);
  const reputation = tradeReputationDelta(city, good, total, 'sell', options.personal);
  removeGoods(from, good, amount);
  city.market[good] += amount;
  state.player.money += total;
  addReputation(state, cityId, reputation);
  if (options.personal) gainSkillXp(state, 'trading', Math.min(5, total / 200));
  emit(ctx, { type: 'GoodsTraded', cityId, good, amount, totalPrice: total, direction: 'sell' });
  return { amount, total, reputation };
}

export function buyFromMarket(
  ctx: SimContext,
  cityId: CityId,
  good: GoodId,
  amount: number,
  into: GoodAmounts,
  options: { personal: boolean; priceBonus: number },
): TradeOutcome {
  const { state } = ctx;
  const city = state.cities[cityId];
  const total = quoteBuy(city, good, amount, 1 - options.priceBonus);
  const reputation = tradeReputationDelta(city, good, total, 'buy', options.personal);
  city.market[good] = Math.max(0, city.market[good] - amount);
  addGoods(into, good, amount);
  state.player.money -= total;
  addReputation(state, cityId, reputation);
  if (options.personal) gainSkillXp(state, 'trading', Math.min(5, total / 400));
  emit(ctx, { type: 'GoodsTraded', cityId, good, amount, totalPrice: total, direction: 'buy' });
  return { amount, total, reputation };
}
