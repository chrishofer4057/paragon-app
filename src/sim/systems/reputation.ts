import { REPUTATION } from '../data/balance';
import { HOUSES } from '../data/buildings';
import { CITY_IDS, type CityId } from '../data/cities';
import { GOODS, type GoodId } from '../data/goods';
import type { CityState, GameState } from '../state/gameState';
import { targetStock, totalPopulation } from './demand';

/**
 * Ansehen (Tippsammlung 6.1–6.3).
 *
 * Zwei Achsen je Stadt:
 * - sozial: Anerkennung der Armen (Versorgung, Brunnen, Spitäler, Arbeitsplätze …)
 * - gesellschaftlich: Anerkennung der Reichen (Handelserfolg, Vermögen, Gilde …)
 *
 * Zusammensetzung des wirksamen Ansehens:
 *   zeitlich begrenzt (klingt täglich ab)  – Handel, Feste, Spenden, Aufträge
 * + dauerhaft                              – gestiftete Infrastruktur, Tempelausbau
 * + Stellung (laufend aus Besitz berechnet) – Arbeitsplätze, Wohnraum, Kontor, Gilde
 * + global                                 – Unternehmenswert, Flottengröße
 */

export interface ReputationDelta {
  social?: number;
  societal?: number;
}

export interface ReputationValue {
  social: number;
  societal: number;
}

export function addReputation(
  state: GameState,
  cityId: CityId,
  delta: ReputationDelta,
  permanent = false,
): void {
  const rep = state.player.reputation[cityId];
  if (permanent) {
    rep.socialBase += delta.social ?? 0;
    rep.societalBase += delta.societal ?? 0;
  } else {
    rep.social += delta.social ?? 0;
    rep.societal += delta.societal ?? 0;
  }
}

/** Wirkt in allen Städten der Lia (z. B. Missionen, Piratenjagd). */
export function addReputationEverywhere(state: GameState, delta: ReputationDelta, permanent = false): void {
  for (const cityId of CITY_IDS) addReputation(state, cityId, delta, permanent);
}

export function workersInCity(state: GameState, cityId: CityId): number {
  let workers = 0;
  for (const b of Object.values(state.player.businesses)) if (b.cityId === cityId) workers += b.workers;
  return workers;
}

export function housingSlotsInCity(state: GameState, cityId: CityId): number {
  let slots = 0;
  for (const h of Object.values(state.player.houses))
    if (h.cityId === cityId) slots += HOUSES[h.type].capacity;
  return slots;
}

/** Laufende Stellung aus Besitz in der Stadt – verschwindet, sobald der Besitz weg ist. */
export function standingReputation(state: GameState, cityId: CityId): ReputationValue {
  const workers = workersInCity(state, cityId);
  const slots = housingSlotsInCity(state, cityId);
  let social = workers * REPUTATION.perWorkerSocial + slots * REPUTATION.perHousingSlotSocial;
  let societal = workers * REPUTATION.perWorkerSocietal;
  if (state.player.kontors[cityId]) societal += REPUTATION.kontorSocietal;
  if (state.player.guilds.includes(cityId)) societal += REPUTATION.guildMemberSocietal;
  if (social < 0) social = 0;
  return { social, societal };
}

/** Hanseweites Ansehen aus Unternehmenswert und Flotte (Tippsammlung 6.3.2.2). */
export function globalReputation(state: GameState): ReputationValue {
  const worth = Math.min(Math.max(state.player.netWorth, 0), REPUTATION.netWorthGlobalCap);
  const fromWorth = (worth / REPUTATION.netWorthGlobalCap) * REPUTATION.netWorthGlobalMax;
  const ships = Object.keys(state.ships).length;
  const fromShips = Math.min(ships * REPUTATION.shipGlobalPerShip, REPUTATION.shipGlobalMax);
  return { social: fromShips * 0.5, societal: fromWorth + fromShips };
}

export function effectiveReputation(state: GameState, cityId: CityId): ReputationValue {
  const rep = state.player.reputation[cityId];
  const standing = standingReputation(state, cityId);
  const global = globalReputation(state);
  return {
    social: rep.social + rep.socialBase + standing.social + global.social,
    societal: rep.societal + rep.societalBase + standing.societal + global.societal,
  };
}

/** Ansehen für Wahlen und Rangvergleiche als ein Wert (Wohlhabende werten 50:50). */
export function combinedReputation(value: ReputationValue): number {
  return (value.social + value.societal) / 2;
}

/** Hanseweites Ansehen: nach Einwohnern gewichteter Durchschnitt über alle Städte. */
export function hanseReputation(state: GameState): number {
  let weighted = 0;
  let population = 0;
  for (const cityId of CITY_IDS) {
    const pop = totalPopulation(state.cities[cityId]);
    weighted += combinedReputation(effectiveReputation(state, cityId)) * pop;
    population += pop;
  }
  return population > 0 ? weighted / population : 0;
}

export function decayReputation(state: GameState): void {
  const keep = 1 - REPUTATION.dailyDecay;
  for (const cityId of CITY_IDS) {
    const rep = state.player.reputation[cityId];
    rep.social *= keep;
    rep.societal *= keep;
  }
}

/** Knappheitsfaktor: Verkäufe knapper Waren bringen mehr, Käufe knapper Waren kosten mehr. */
function scarcityFactor(city: CityState, good: GoodId): number {
  const ratio = targetStock(city, good) / Math.max(city.market[good], 1);
  return Math.min(REPUTATION.scarcityMax, Math.max(REPUTATION.scarcityMin, ratio));
}

/**
 * Ansehen durch Handel (Tippsammlung 3.1.1): Verkäufe steigern, Einkäufe schmälern das
 * Ansehen – beides skaliert mit dem Umsatz und der Knappheit der Ware in der Stadt.
 * Muss VOR der Bestandsänderung aufgerufen werden.
 */
export function tradeReputationDelta(
  city: CityState,
  good: GoodId,
  value: number,
  direction: 'buy' | 'sell',
  personal: boolean,
): ReputationValue {
  const scarcity = scarcityFactor(city, good);
  let amount = value * REPUTATION.tradePerValue * scarcity * (personal ? REPUTATION.personalTradeFactor : 1);
  if (direction === 'buy') amount = -amount * REPUTATION.purchaseFactor;
  const category = GOODS[good].category;
  const socialShare =
    category === 'staple' || category === 'consumer'
      ? REPUTATION.tradeSocialShareStaple
      : REPUTATION.tradeSocialShareOther;
  return { social: amount * socialShare, societal: amount };
}
