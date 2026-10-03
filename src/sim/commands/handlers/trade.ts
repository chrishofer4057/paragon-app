import { MARKET, REPUTATION } from '../../data/balance';
import { MARKET_STALL } from '../../data/buildings';
import type { CityId } from '../../data/cities';
import { GOODS, type GoodId } from '../../data/goods';
import { emit, type SimContext } from '../../context';
import type { GameState } from '../../state/gameState';
import { dayOf } from '../../time';
import { totalDemandWeekly } from '../../systems/demand';
import { buyFromMarket, personalPriceBonus, sellToMarket } from '../../systems/market';
import { quoteBuy, quoteSell } from '../../systems/prices';
import { hasLocalPermission, hasPermission } from '../../systems/ranks';
import { addReputation, tradeReputationDelta } from '../../systems/reputation';
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
  requireNotBusy,
  requirePermission,
  requirePositiveAmount,
} from '../guards';

/** Tagesbuch zurücksetzen, sobald ein neuer Tag begonnen hat. */
export function ledger(state: GameState): GameState['player']['dailyLedger'] {
  const today = dayOf(state.tick);
  if (state.player.dailyLedger.day !== today)
    state.player.dailyLedger = { day: today, bought: {}, stallSold: {}, haggles: {} };
  return state.player.dailyLedger;
}

function formatGold(value: number): string {
  return `${Math.round(value)} GS`;
}

export function handleBuyGoods(
  ctx: SimContext,
  good: GoodId,
  amount: number,
  into: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const city = state.cities[cityId];
  const error = firstError(requirePositiveAmount(amount));
  if (error) return error;
  if (!storageInCity(state, into, cityId)) return fail('Dieser Lagerort ist hier nicht erreichbar.');
  if (!hasPermission(state, 'tradeFreely')) {
    // Tagelöhner dürfen nur kleine Mengen für den Eigenbedarf kaufen.
    const already = amountOf(
      state.player.dailyLedger.day === dayOf(state.tick) ? state.player.dailyLedger.bought : {},
      good,
    );
    if (into.kind !== 'inventory' || already + amount > MARKET.dayLaborerDailyBuyLimit) {
      return fail(
        `Als Tagelöhner kauft Ihr höchstens ${MARKET.dayLaborerDailyBuyLimit} Einheiten je Ware und Tag für Euch selbst.`,
      );
    }
  }
  if (amount > Math.floor(city.market[good])) return fail(`So viel ${GOODS[good].name} hat der Markt nicht.`);
  if (amount > freeCapacity(state, into)) return fail('Dafür ist nicht genug Platz.');
  const bonus = personalPriceBonus(state);
  const moneyError = requireMoney(state, quoteBuy(city, good, amount, 1 - bonus));
  if (moneyError) return moneyError;

  const storage = resolveStorage(state, into)!;
  const outcome = buyFromMarket(ctx, cityId, good, amount, storage, { personal: true, priceBonus: bonus });
  const book = ledger(state);
  book.bought[good] = amountOf(book.bought, good) + amount;
  return ok(`${amount} ${GOODS[good].name} für ${formatGold(outcome.total)} gekauft.`);
}

export function handleSellGoods(
  ctx: SimContext,
  good: GoodId,
  amount: number,
  from: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const error = firstError(
    requirePositiveAmount(amount),
    requirePermission(state, 'sellToMarket'),
    requireGoodsAt(state, from, cityId, good, amount),
  );
  if (error) return error;
  const storage = resolveStorage(state, from)!;
  const outcome = sellToMarket(ctx, cityId, good, amount, storage, {
    personal: true,
    priceBonus: personalPriceBonus(state),
  });
  return ok(`${amount} ${GOODS[good].name} für ${formatGold(outcome.total)} verkauft.`);
}

export function handleTransferGoods(
  ctx: SimContext,
  good: GoodId,
  amount: number,
  from: StorageRef,
  to: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = firstError(
    requirePositiveAmount(amount),
    requireGoodsAt(state, from, where.cityId, good, amount),
  );
  if (error) return error;
  if (!storageInCity(state, to, where.cityId)) return fail('Das Ziel ist hier nicht erreichbar.');
  if (amount > freeCapacity(state, to)) return fail('Am Ziel ist nicht genug Platz.');
  removeGoods(resolveStorage(state, from)!, good, amount);
  addGoods(resolveStorage(state, to)!, good, amount);
  return ok();
}

export function handleRentStall(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = firstError(
    requirePermission(state, 'rentStall'),
    requireMoney(state, MARKET_STALL.rentPerWeek),
  );
  if (error) return error;
  const stall = state.player.stalls[where.cityId];
  const base = Math.max(state.tick, stall?.paidUntilTick ?? 0);
  state.player.money -= MARKET_STALL.rentPerWeek;
  state.player.stalls[where.cityId] = { paidUntilTick: base + 7 * 24 };
  return ok(`Marktstand für eine Woche gemietet (${MARKET_STALL.rentPerWeek} GS).`);
}

/** Wie viel lässt sich heute noch am Stand verkaufen? */
export function stallAllowance(state: GameState, cityId: CityId, good: GoodId): number {
  const daily = totalDemandWeekly(state.cities[cityId], good) / 7;
  const sold =
    state.player.dailyLedger.day === dayOf(state.tick)
      ? amountOf(state.player.dailyLedger.stallSold, good)
      : 0;
  return Math.max(0, Math.floor(daily * MARKET_STALL.dailyDemandShare - sold));
}

/**
 * Persönlicher Verkauf am eigenen Marktstand (CLAUDE.md §2.4): bessere Preise als beim
 * Großhändler, aber begrenzte Kundschaft und es kostet Zeit.
 */
export function handleSellAtStall(
  ctx: SimContext,
  good: GoodId,
  amount: number,
  from: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const error = firstError(
    requirePositiveAmount(amount),
    requireNotBusy(state),
    requireGoodsAt(state, from, cityId, good, amount),
  );
  if (error) return error;
  const stall = state.player.stalls[cityId];
  if (!stall || stall.paidUntilTick <= state.tick) return fail('Ihr habt hier keinen Marktstand gemietet.');
  if (amount > stallAllowance(state, cityId, good)) {
    return fail(`Heute finden sich nicht mehr so viele Käufer für ${GOODS[good].name}.`);
  }
  const city = state.cities[cityId];
  const total = quoteSell(city, good, amount, 1 + MARKET_STALL.priceBonus + personalPriceBonus(state));
  const rep = tradeReputationDelta(city, good, total, 'sell', true);
  removeGoods(resolveStorage(state, from)!, good, amount);
  city.market[good] += amount;
  state.player.money += total;
  addReputation(state, cityId, rep);
  state.player.busyUntilTick = state.tick + MARKET_STALL.hoursPerSale;
  const book = ledger(state);
  book.stallSold[good] = amountOf(book.stallSold, good) + amount;
  emit(ctx, { type: 'GoodsTraded', cityId, good, amount, totalPrice: total, direction: 'sell' });
  return ok(`Am Stand ${amount} ${GOODS[good].name} für ${formatGold(total)} verkauft.`);
}

export function handleBuyFromPeddler(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const tavern = state.cities[where.cityId].tavern;
  const offer = tavern.peddler;
  if (!offer) return fail('Heute ist kein fliegender Händler in der Taverne.');
  const target: StorageRef = state.player.kontors[where.cityId]
    ? { kind: 'kontor', cityId: where.cityId }
    : { kind: 'inventory' };
  if (offer.amount > freeCapacity(state, target)) return fail('Ihr habt keinen Platz für die Ware.');
  const cost = offer.amount * offer.pricePerUnit;
  const error = requireMoney(state, cost);
  if (error) return error;
  state.player.money -= cost;
  addGoods(resolveStorage(state, target)!, offer.good, offer.amount);
  tavern.peddler = null;
  return ok(`${offer.amount} ${GOODS[offer.good].name} für ${cost} GS gekauft.`);
}

export function handleSellToLord(
  ctx: SimContext,
  good: GoodId,
  amount: number,
  from: StorageRef,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  if (!hasLocalPermission(state, cityId, 'gateTrade')) {
    return fail('Mit dem Landesherrn verhandelt nur, wer in dieser Stadt Ratsherr ist.');
  }
  const error = firstError(requirePositiveAmount(amount), requireGoodsAt(state, from, cityId, good, amount));
  if (error) return error;
  const demand = state.cities[cityId].gate.find((d) => d.good === good);
  if (!demand || demand.remaining <= 0)
    return fail(`Der Landesherr fragt diesen Monat kein ${GOODS[good].name} nach.`);
  if (amount > demand.remaining)
    return fail(`Der Landesherr nimmt höchstens noch ${demand.remaining} Einheiten.`);
  const total = amount * demand.pricePerUnit;
  removeGoods(resolveStorage(state, from)!, good, amount);
  demand.remaining -= amount;
  state.player.money += total;
  addReputation(state, cityId, { societal: total * REPUTATION.tradePerValue });
  return ok(`Der Landesherr zahlt ${formatGold(total)}.`);
}
