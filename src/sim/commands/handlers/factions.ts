import {
  FACTION_BALANCE,
  FACTIONS,
  FAVOR_GAINS,
  NOTORIETY,
  SMUGGLING,
  type FactionId,
} from '../../data/factions';
import { GOODS, type GoodId } from '../../data/goods';
import { emit, postMessage, type SimContext } from '../../context';
import { chance } from '../../rng';
import { addFavor, addNotoriety, applyFavor, smuggleQuote } from '../../systems/factions';
import { addReputation } from '../../systems/reputation';
import { removeGoods, resolveStorage, type StorageRef } from '../../systems/storage';
import { daysToTicks } from '../../time';
import { fail, ok, type CommandResult } from '../commands';
import {
  firstError,
  requireCity,
  requireGoodsAt,
  requireNotBusy,
  requirePermission,
  requirePositiveAmount,
} from '../guards';

/** Bündnis schließen, wechseln oder (mit `null`) lösen. */
export function handlePledgeFaction(ctx: SimContext, faction: FactionId | null): CommandResult {
  const { state } = ctx;
  const p = state.player;
  if (faction === p.pledge) return fail(faction ? 'Ihr seid bereits verbündet.' : 'Ihr habt kein Bündnis.');
  const cooldown = daysToTicks(FACTION_BALANCE.pledgeCooldownDays);
  if (state.tick - p.pledgeChangedTick < cooldown)
    return fail('So schnell wechselt man keine Bündnisse – man würde Euch nicht mehr trauen.');
  if (faction && p.factions[faction] < FACTION_BALANCE.pledgeMinFavor)
    return fail(`${FACTIONS[faction].name} traut Euch noch nicht genug.`);
  if (p.pledge) addFavor(state, p.pledge, -FACTION_BALANCE.leavePenalty);
  p.pledge = faction;
  p.pledgeChangedTick = state.tick;
  if (!faction) return ok('Ihr habt Euer Bündnis gelöst.');
  addFavor(state, FACTIONS[faction].rival, -FACTION_BALANCE.pledgeRivalPenalty);
  return ok(`Ihr steht nun an der Seite der ${FACTIONS[faction].name}. ${FACTIONS[faction].pledgeBenefit}`);
}

/**
 * Schmuggel: Ware am Zoll vorbei an die Hafenbruderschaft verkaufen. Mehr Erlös, aber wer
 * erwischt wird, verliert die Ware, zahlt Buße und gerät in Verruf.
 */
export function handleSmuggle(
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
    requirePermission(state, 'sellToMarket'),
    requireGoodsAt(state, from, cityId, good, amount),
  );
  if (error) return error;
  if (state.player.factions.harbour < SMUGGLING.minHarbourFavor)
    return fail('Niemand von der Hafenbruderschaft kennt Euch – hier will keiner Eure Ware anfassen.');
  const quote = smuggleQuote(state, cityId, good, amount);
  removeGoods(resolveStorage(state, from)!, good, amount);
  state.player.busyUntilTick = state.tick + SMUGGLING.busyHours;
  // Schmuggelware landet trotzdem in der Stadt (Schwarzmarkt).
  state.cities[cityId].market[good] += amount;
  if (chance(state.rng, quote.catchChance)) {
    const fine = Math.round(quote.marketValue * SMUGGLING.fineFactor);
    state.player.money -= fine;
    addNotoriety(state, NOTORIETY.smuggleCaught);
    applyFavor(state, FAVOR_GAINS.smuggleCaught);
    addReputation(state, cityId, { societal: -SMUGGLING.caughtSocietal });
    postMessage(
      ctx,
      'danger',
      'Beim Schmuggel erwischt',
      `Die Zollwache hat ${amount} ${GOODS[good].name} beschlagnahmt. Buße: ${fine} GS.`,
      cityId,
    );
    return ok(`Erwischt! Die Ware ist weg, dazu ${fine} GS Buße.`);
  }
  state.player.money += quote.value;
  addNotoriety(state, NOTORIETY.smuggleSuccess);
  applyFavor(state, FAVOR_GAINS.smuggleSuccess);
  emit(ctx, { type: 'GoodsTraded', cityId, good, amount, totalPrice: quote.value, direction: 'sell' });
  return ok(`Die Bruderschaft zahlt ${quote.value} GS für ${amount} ${GOODS[good].name} – ohne Fragen.`);
}
