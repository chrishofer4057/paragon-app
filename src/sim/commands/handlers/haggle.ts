import { HAGGLE } from '../../data/balance';
import { GOODS, type GoodId } from '../../data/goods';
import { emit, type SimContext } from '../../context';
import { haggleLimit, judgeOffer, merchantMood, standardUnitPrice } from '../../systems/haggle';
import { addReputation, tradeReputationDelta } from '../../systems/reputation';
import { gainSkillXp } from '../../systems/skills';
import {
  addGoods,
  amountOf,
  freeCapacity,
  removeGoods,
  resolveStorage,
  storageInCity,
  type StorageRef,
} from '../../systems/storage';
import { fail, ok, type CommandResult } from '../commands';
import {
  firstError,
  requireCity,
  requireGoodsAt,
  requireMoney,
  requirePermission,
  requirePositiveAmount,
} from '../guards';
import { ledger } from './trade';

const VERDICT_TEXT = {
  hesitant: 'Der Händler zögert … „So nicht – aber wir sind nicht weit auseinander.“',
  offended: 'Der Händler lacht Euch aus. „Haltet Ihr mich für einen Narren?“',
} as const;

/**
 * Feilschen (CLAUDE.md §2.4). Ein abgelehntes Angebot ist ein gültiger Spielzug: Es
 * verbraucht einen Versuch und kann die Laune des Händlers verderben.
 */
export function handleHaggle(
  ctx: SimContext,
  good: GoodId,
  amount: number,
  direction: 'buy' | 'sell',
  pricePerUnit: number,
  storage: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const city = state.cities[cityId];
  const error = firstError(requirePositiveAmount(amount), requirePermission(state, 'tradeFreely'));
  if (error) return error;
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) return fail('Ungültiges Angebot.');
  if (!storageInCity(state, storage, cityId)) return fail('Dieser Lagerort ist hier nicht erreichbar.');
  const today =
    state.player.dailyLedger.day === Math.floor(state.tick / 24) ? state.player.dailyLedger.haggles : {};
  if (amountOf(today, good) >= HAGGLE.attemptsPerGoodPerDay) {
    return fail(`Über ${GOODS[good].name} will heute niemand mehr mit Euch verhandeln.`);
  }
  const total = pricePerUnit * amount;
  if (direction === 'sell') {
    const goodsError = requireGoodsAt(state, storage, cityId, good, amount);
    if (goodsError) return goodsError;
  } else {
    if (amount > Math.floor(city.market[good]))
      return fail(`So viel ${GOODS[good].name} hat der Markt nicht.`);
    if (amount > freeCapacity(state, storage)) return fail('Dafür ist nicht genug Platz.');
    const moneyError = requireMoney(state, total);
    if (moneyError) return moneyError;
  }

  const standard = standardUnitPrice(state, cityId, good, amount, direction);
  const limit = haggleLimit(state, cityId, good, amount, direction);
  const verdict = judgeOffer(pricePerUnit, limit, standard, direction);
  const book = ledger(state);
  book.haggles[good] = amountOf(book.haggles, good) + 1;

  if (verdict !== 'accepted') {
    const penalty = verdict === 'hesitant' ? HAGGLE.moodPenaltyClose : HAGGLE.moodPenaltyGreedy;
    state.player.merchantMood[cityId] = Math.max(HAGGLE.minMood, merchantMood(state, cityId) - penalty);
    if (verdict === 'offended') addReputation(state, cityId, { societal: -HAGGLE.greedySocietalPenalty });
    return ok(VERDICT_TEXT[verdict], verdict);
  }

  const target = resolveStorage(state, storage)!;
  const rep = tradeReputationDelta(city, good, total, direction, true);
  if (direction === 'sell') {
    removeGoods(target, good, amount);
    city.market[good] += amount;
    state.player.money += total;
  } else {
    city.market[good] = Math.max(0, city.market[good] - amount);
    addGoods(target, good, amount);
    state.player.money -= total;
  }
  addReputation(state, cityId, rep);
  // Wer den Spielraum gut ausreizt, lernt mehr.
  const captured = Math.abs(pricePerUnit - standard) / Math.max(1e-6, Math.abs(limit - standard));
  gainSkillXp(state, 'trading', 2 + 4 * Math.min(1, captured));
  emit(ctx, { type: 'GoodsTraded', cityId, good, amount, totalPrice: total, direction });
  const verb = direction === 'sell' ? 'verkauft' : 'gekauft';
  return ok(`Handel! ${amount} ${GOODS[good].name} für ${Math.round(total)} GS ${verb}.`, 'accepted');
}
