import { REPUTATION, TAVERN } from '../../data/balance';
import { FAVOR_GAINS } from '../../data/factions';
import { applyFavor, sailorFeeFactor } from '../../systems/factions';
import { CITIES, CITY_IDS } from '../../data/cities';
import { GOOD_IDS, GOODS } from '../../data/goods';
import { CAPTAIN_HIRE_FEE, SHIP_TYPES } from '../../data/ships';
import { postMessage, type SimContext } from '../../context';
import type { QuestId, ShipId } from '../../state/ids';
import { daysToTicks } from '../../time';
import { targetStock } from '../../systems/demand';
import { addReputation } from '../../systems/reputation';
import { removeGoods, resolveStorage, shipInPort, type StorageRef } from '../../systems/storage';
import { fail, ok, type CommandResult } from '../commands';
import { firstError, requireCity, requireGoodsAt, requireMoney, requirePermission } from '../guards';

export function handleAcceptQuest(ctx: SimContext, questId: QuestId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const tavern = state.cities[where.cityId].tavern;
  const quest = tavern.quests.find((q) => q.id === questId);
  if (!quest) return fail('Dieser Auftrag ist vergeben.');
  tavern.quests = tavern.quests.filter((q) => q.id !== questId);
  state.player.quests.push({
    ...quest,
    acceptedTick: state.tick,
    deadlineTick: state.tick + daysToTicks(quest.days),
  });
  return ok('Auftrag angenommen.');
}

/** Warenkäufer aus dem Nebenraum beliefern (2.1.1.1.10.7). */
export function handleDeliverQuestGoods(ctx: SimContext, questId: QuestId, from: StorageRef): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const quest = state.player.quests.find((q) => q.id === questId);
  if (!quest || quest.quest.kind !== 'buyer') return fail('Ihr habt keinen solchen Lieferauftrag.');
  if (quest.cityId !== where.cityId) return fail(`Der Käufer wartet in ${CITIES[quest.cityId].name}.`);
  const { good, amount, reward } = quest.quest;
  const error = requireGoodsAt(state, from, where.cityId, good, amount);
  if (error) return error;
  removeGoods(resolveStorage(state, from)!, good, amount);
  state.player.money += reward;
  state.player.quests = state.player.quests.filter((q) => q.id !== questId);
  addReputation(state, where.cityId, { social: REPUTATION.questFlat, societal: REPUTATION.questFlat });
  applyFavor(state, FAVOR_GAINS.deliverQuest);
  return ok(`Der Käufer zahlt ${reward} GS für ${amount} ${GOODS[good].name}.`);
}

/** Informant (2.1.1.1.8): größter Mangel und größter Überschuss der Lia. */
export function handleBuyInformation(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = requireMoney(state, TAVERN.informantFee);
  if (error) return error;
  let shortage = { ratio: Infinity, text: '' };
  let surplus = { ratio: 0, text: '' };
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    for (const good of GOOD_IDS) {
      if (GOODS[good].category === 'material') continue;
      const ratio = city.market[good] / targetStock(city, good);
      if (ratio < shortage.ratio) {
        shortage = {
          ratio,
          text: `In ${CITIES[cityId].name} fehlt es an ${GOODS[good].name} – dort zahlt man gut.`,
        };
      }
      if (ratio > surplus.ratio) {
        surplus = {
          ratio,
          text: `In ${CITIES[cityId].name} gibt es ${GOODS[good].name} im Überfluss und daher billig.`,
        };
      }
    }
  }
  state.player.money -= TAVERN.informantFee;
  applyFavor(state, FAVOR_GAINS.buyInformation);
  postMessage(ctx, 'info', 'Der Informant flüstert', `${shortage.text} ${surplus.text}`, where.cityId);
  return ok(`${shortage.text} ${surplus.text}`);
}

function shipHere(ctx: SimContext, shipId: ShipId, cityId: (typeof CITY_IDS)[number]) {
  const ship = ctx.state.ships[shipId];
  return ship && shipInPort(ship) === cityId ? ship : undefined;
}

/** Matrosen kommen aus dem Bettlerreservoir der Stadt (2.1.1.1.1). */
export function handleHireSailors(ctx: SimContext, shipId: ShipId, count: number): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const ship = shipHere(ctx, shipId, where.cityId);
  if (!ship) return fail('Das Schiff liegt nicht hier im Hafen.');
  if (!Number.isInteger(count) || count <= 0) return fail('Ungültige Anzahl.');
  const city = state.cities[where.cityId];
  const available = Math.floor(city.population.beggars * TAVERN.sailorShareOfBeggars);
  if (count > available) return fail(`In der Taverne sitzen nur ${available} arbeitswillige Matrosen.`);
  if (ship.crew + count > SHIP_TYPES[ship.type].maxCrew) return fail('So viele Leute passen nicht an Bord.');
  const error = requireMoney(state, Math.round(count * TAVERN.sailorHireFee * sailorFeeFactor(state)));
  if (error) return error;
  state.player.money -= Math.round(count * TAVERN.sailorHireFee * sailorFeeFactor(state));
  applyFavor(state, FAVOR_GAINS.hireSailors);
  city.population.beggars -= count;
  ship.crew += count;
  return ok(`${count} Matrosen angeheuert.`);
}

/** Entlassene Matrosen werden in dieser Stadt wieder zu Bettlern. */
export function handleDismissSailors(ctx: SimContext, shipId: ShipId, count: number): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const ship = shipHere(ctx, shipId, where.cityId);
  if (!ship) return fail('Das Schiff liegt nicht hier im Hafen.');
  if (!Number.isInteger(count) || count <= 0 || count > ship.crew) return fail('Ungültige Anzahl.');
  ship.crew -= count;
  state.cities[where.cityId].population.beggars += count;
  return ok(`${count} Matrosen entlassen.`);
}

export function handleHireCaptain(ctx: SimContext, shipId: ShipId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const ship = shipHere(ctx, shipId, where.cityId);
  const tavern = state.cities[where.cityId].tavern;
  const error = firstError(requirePermission(state, 'hireCaptain'), requireMoney(state, CAPTAIN_HIRE_FEE));
  if (error) return error;
  if (!ship) return fail('Das Schiff liegt nicht hier im Hafen.');
  if (ship.hasCaptain) return fail('Das Schiff hat schon einen Kapitän.');
  if (!tavern.captainAvailable) return fail('Heute ist kein Kapitän in der Taverne.');
  state.player.money -= CAPTAIN_HIRE_FEE;
  ship.hasCaptain = true;
  tavern.captainAvailable = false;
  return ok('Ein Kapitän übernimmt das Kommando.');
}
