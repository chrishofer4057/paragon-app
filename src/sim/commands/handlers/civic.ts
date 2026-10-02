import { GUILD, POLITICS, POPULATION, REPUTATION } from '../../data/balance';
import { ALMS_GOODS, FESTIVAL_LEAD_DAYS } from '../../data/buildings';
import { CHARACTERS } from '../../data/characters';
import type { CityId } from '../../data/cities';
import { GOODS, type GoodAmounts, type GoodId } from '../../data/goods';
import type { SimContext } from '../../context';
import { hashFloat } from '../../rng';
import { CITY_IDS } from '../../data/cities';
import type { GameState } from '../../state/gameState';
import { dayOf, daysToTicks } from '../../time';
import { totalPopulation } from '../../systems/demand';
import { addReputation } from '../../systems/reputation';
import { removeGoods, resolveStorage, type StorageRef } from '../../systems/storage';
import { priestHint } from '../../systems/temple';
import { fail, ok, type CommandResult } from '../commands';
import {
  cityName,
  firstError,
  requireCity,
  requireGoodsAt,
  requireMoney,
  requireNotBusy,
  requirePositiveAmount,
} from '../guards';

/** Ansehen für Beten/Baden gibt es höchstens einmal pro Woche. */
const WEEK = daysToTicks(7);

export function handlePray(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = requireNotBusy(state);
  if (error) return error;
  const p = state.player;
  if (state.tick - p.lastPrayerTick >= WEEK)
    addReputation(state, where.cityId, { social: REPUTATION.prayerSocial });
  p.lastPrayerTick = state.tick;
  p.busyUntilTick = state.tick + 1;
  return ok('Ihr habt im Tempel gebetet.');
}

export function handleDonate(ctx: SimContext, amount: number): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = firstError(requirePositiveAmount(amount), requireMoney(state, amount));
  if (error) return error;
  const temple = state.cities[where.cityId].temple;
  state.player.money -= amount;
  temple.donations += amount;
  const rep = amount * REPUTATION.donationPerGold;
  addReputation(state, where.cityId, { social: rep, societal: rep });
  return ok(priestHint(temple.donations, temple.stage, temple.buildingUntilTick !== null));
}

/** Benötigter Warenwert für eine erfolgreiche Armenspeisung. */
export function almsValueNeeded(state: GameState, cityId: CityId): number {
  return totalPopulation(state.cities[cityId]) * POPULATION.almsValuePerCapita;
}

/** Armenspeisung (2.1.1.7.2): wirkt einen Tag lang, mehr als eine pro Tag bringt nichts. */
export function handleGiveAlms(ctx: SimContext, goods: GoodAmounts, from: StorageRef): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const { cityId } = where;
  const entries = Object.entries(goods) as [GoodId, number][];
  if (entries.length === 0) return fail('Ihr müsst etwas spenden.');
  let value = 0;
  for (const [good, amount] of entries) {
    if (!(ALMS_GOODS as readonly GoodId[]).includes(good))
      return fail(`${GOODS[good].name} taugt nicht zur Armenspeisung.`);
    const error = firstError(
      requirePositiveAmount(amount),
      requireGoodsAt(state, from, cityId, good, amount),
    );
    if (error) return error;
    value += amount * GOODS[good].basePrice;
  }
  const storage = resolveStorage(state, from)!;
  for (const [good, amount] of entries) removeGoods(storage, good, amount);
  const city = state.cities[cityId];
  const today = dayOf(state.tick);
  if (value < almsValueNeeded(state, cityId)) {
    addReputation(state, cityId, {
      social: REPUTATION.almsSocial * (value / almsValueNeeded(state, cityId)) * 0.5,
    });
    return ok('Der Priester dankt Euch, doch für alle Bedürftigen reicht es nicht.');
  }
  if (city.almsBoostDay !== today) addReputation(state, cityId, { social: REPUTATION.almsSocial });
  city.almsBoostDay = today;
  return ok('Eine äußerst großzügige Spende! Heute strömen viele Bedürftige in die Stadt.');
}

export function handleTakeBath(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const error = requireNotBusy(state);
  if (error) return error;
  const p = state.player;
  if (state.tick - p.lastBathTick >= WEEK)
    addReputation(state, where.cityId, { societal: REPUTATION.bathSocietal });
  p.lastBathTick = state.tick;
  p.busyUntilTick = state.tick + 2;
  return ok('Frisch gebadet und frei von bösen Gerüchten.');
}

export function bribeCost(state: GameState, cityId: CityId): number {
  return Math.round((totalPopulation(state.cities[cityId]) / 1000) * POLITICS.bribeCostPer1000);
}

/** Ratsherren im Badehaus bestechen (2.1.1.6.2): Stimmen gelten für die nächste Wahl. */
export function handleBribe(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const cost = bribeCost(state, where.cityId);
  const error = requireMoney(state, cost);
  if (error) return error;
  // Ob heute ein Ratsherr im Badehaus sitzt, steht pro Tag fest.
  const roll = hashFloat(state.rng.seed, dayOf(state.tick), CITY_IDS.indexOf(where.cityId), 7);
  if (roll >= POLITICS.bribeAvailability) {
    return fail('Heute ist kein empfänglicher Ratsherr im Badehaus.');
  }
  state.player.money -= cost;
  state.cities[where.cityId].bribeVotes += POLITICS.bribeVotes;
  return ok(`Ein Ratsherr nimmt ${cost} GS diskret entgegen.`);
}

export function guildFee(state: GameState, cityId: CityId): number {
  const raw = Math.min(
    GUILD.maxFee,
    Math.max(GUILD.minFee, state.player.netWorth * GUILD.feeShareOfNetWorth),
  );
  const home = cityId === state.player.homeCityId ? GUILD.homeCityFactor : 1;
  return Math.round(raw * home * CHARACTERS[state.player.characterId].guildFeeFactor);
}

export function handleJoinGuild(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  if (state.player.guilds.includes(where.cityId)) return fail('Ihr seid hier bereits Gildenmitglied.');
  const fee = guildFee(state, where.cityId);
  const error = requireMoney(state, fee);
  if (error) return error;
  state.player.money -= fee;
  state.player.guilds.push(where.cityId);
  return ok(`Willkommen in der Gilde von ${cityName(where.cityId)} (${fee} GS).`);
}

export function handleAnnounceFestival(ctx: SimContext): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const city = state.cities[where.cityId];
  if (!state.player.kontors[where.cityId])
    return fail('Für ein Fest braucht Ihr ein Kontor, aus dem bewirtet wird.');
  if (city.festival) return fail('Ein Fest ist bereits angekündigt.');
  city.festival = { tick: state.tick + daysToTicks(FESTIVAL_LEAD_DAYS) };
  return ok(`Das Fest findet in ${FESTIVAL_LEAD_DAYS} Tagen statt. Haltet die Waren im Kontor bereit!`);
}
