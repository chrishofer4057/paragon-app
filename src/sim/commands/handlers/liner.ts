import { CITIES, type CityId } from '../../data/cities';
import { GOODS, type GoodId } from '../../data/goods';
import { LINES, type LineId } from '../../data/lines';
import type { SimContext } from '../../context';
import { lineTravelHours, linerCargoFee, linerFare, nextDeparture } from '../../systems/liners';
import { addGoods, removeGoods, resolveStorage, type StorageRef } from '../../systems/storage';
import { formatDate } from '../../time';
import { fail, ok, type CommandResult } from '../commands';
import {
  firstError,
  requireCity,
  requireGoodsAt,
  requireMoney,
  requirePermission,
  requirePositiveAmount,
} from '../guards';

/**
 * Fahrt auf einem Linienschiff buchen (CLAUDE.md §2.5, Option A): Die Figur reist mit,
 * gemieteter Frachtraum wird am Ziel ins Hafenlager entladen – dort verkauft man persönlich.
 */
export function handleBookLiner(
  ctx: SimContext,
  lineId: LineId,
  destination: CityId,
  cargo: { good: GoodId; amount: number; from: StorageRef } | undefined,
): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const p = state.player;
  if (p.linerBooking) return fail('Ihr habt bereits eine Fahrt gebucht.');
  const line = LINES[lineId];
  if (!line) return fail('Diese Linie gibt es nicht.');
  const hours = lineTravelHours(lineId, cityId, destination);
  const depart = nextDeparture(lineId, cityId, state.tick + 1);
  if (hours === null || depart === null) return fail(`Die ${line.name} verbindet diese Städte nicht.`);
  let cost = linerFare(state, lineId, cityId, destination);
  if (cargo) {
    const error = firstError(
      requirePermission(state, 'rentCargo'),
      requirePositiveAmount(cargo.amount),
      requireGoodsAt(state, cargo.from, cityId, cargo.good, cargo.amount),
    );
    if (error) return error;
    cost += linerCargoFee(state, lineId, cityId, destination, cargo.amount);
  }
  const moneyError = requireMoney(state, cost);
  if (moneyError) return moneyError;

  p.money -= cost;
  if (cargo) removeGoods(resolveStorage(state, cargo.from)!, cargo.good, cargo.amount);
  p.linerBooking = {
    lineId,
    from: cityId,
    to: destination,
    departTick: depart,
    arriveTick: depart + hours,
    cargo: cargo ? { good: cargo.good, amount: cargo.amount } : null,
    departed: false,
    passengerAboard: false,
  };
  const freight = cargo ? ` mit ${cargo.amount} ${GOODS[cargo.good].name}` : '';
  return ok(
    `Gebucht: ${line.name} nach ${CITIES[destination].name}${freight}, Abfahrt ${formatDate(depart)} (${Math.round(cost)} GS). Seid rechtzeitig am Hafen!`,
  );
}

/** Buchung stornieren: Fahrgeld verfällt, Fracht kommt ins Hafenlager der Abfahrtsstadt. */
export function handleCancelLiner(ctx: SimContext): CommandResult {
  const p = ctx.state.player;
  const booking = p.linerBooking;
  if (!booking) return fail('Ihr habt keine Fahrt gebucht.');
  if (booking.departed) return fail('Das Schiff ist bereits ausgelaufen.');
  if (booking.cargo) addGoods((p.holds[booking.from] ??= {}), booking.cargo.good, booking.cargo.amount);
  p.linerBooking = null;
  return ok('Fahrt storniert. Das Fahrgeld ist verloren.');
}
