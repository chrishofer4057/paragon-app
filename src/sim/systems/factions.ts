import type { CityId } from '../data/cities';
import {
  FACTION_BALANCE,
  FAVOR_GAINS,
  FACTION_IDS,
  NOTORIETY,
  SMUGGLING,
  type FactionId,
} from '../data/factions';
import type { GoodId } from '../data/goods';
import { postMessage, type SimContext } from '../context';
import { chance } from '../rng';
import type { GameState } from '../state/gameState';
import { quoteSell } from './prices';
import { addReputation } from './reputation';

/**
 * Fraktionen und Verruf (data/factions.ts): Wohlwollen, Bündnis, Vorteile, wöchentliche
 * Ermittlungen der Stadtwache.
 */

export function addFavor(state: GameState, faction: FactionId, delta: number): void {
  const f = state.player.factions;
  f[faction] = Math.max(FACTION_BALANCE.minFavor, Math.min(FACTION_BALANCE.maxFavor, f[faction] + delta));
}

/** Mehrere Fraktionen auf einmal, z. B. `FAVOR_GAINS.bribe`. */
export function applyFavor(state: GameState, gains: Partial<Record<FactionId, number>>, scale = 1): void {
  for (const id of FACTION_IDS) {
    const delta = gains[id];
    if (delta) addFavor(state, id, delta * scale);
  }
}

export function addNotoriety(state: GameState, delta: number): void {
  state.player.notoriety = Math.max(0, Math.min(NOTORIETY.max, state.player.notoriety + delta));
}

function favored(state: GameState, faction: FactionId): 'pledged' | 'favored' | null {
  if (state.player.pledge === faction) return 'pledged';
  return state.player.factions[faction] >= FACTION_BALANCE.favoredThreshold ? 'favored' : null;
}

/** Preisvorteil durch die Kaufmannsgilde (fließt in `personalPriceBonus`). */
export function merchantTradeBonus(state: GameState): number {
  const tier = favored(state, 'merchants');
  if (tier === 'pledged') return FACTION_BALANCE.merchantTradeBonusPledged;
  if (tier === 'favored') return FACTION_BALANCE.merchantTradeBonusFavored;
  return 0;
}

/** Faktor auf die Chance willkürlicher Anklagen (Tempelorden). */
export function accusationFactor(state: GameState): number {
  const tier = favored(state, 'temple');
  if (tier === 'pledged') return FACTION_BALANCE.templeAccusationPledged;
  if (tier === 'favored') return FACTION_BALANCE.templeAccusationFavored;
  return 1;
}

/** Faktor auf die Anheuergebühr für Matrosen (Hafenbruderschaft). */
export function sailorFeeFactor(state: GameState): number {
  return state.player.pledge === 'harbour' ? FACTION_BALANCE.harbourSailorFeePledged : 1;
}

export function smuggleCatchChance(state: GameState): number {
  const tier = favored(state, 'harbour');
  const harbour =
    tier === 'pledged'
      ? FACTION_BALANCE.harbourCatchPledged
      : tier === 'favored'
        ? FACTION_BALANCE.harbourCatchFavored
        : 1;
  const suspicion = 1 + state.player.notoriety * SMUGGLING.catchPerNotoriety;
  return Math.min(SMUGGLING.maxCatchChance, SMUGGLING.baseCatchChance * harbour * suspicion);
}

/** Was Schmuggelware einbrächte – und was der Markt regulär zahlen würde. */
export function smuggleQuote(
  state: GameState,
  cityId: CityId,
  good: GoodId,
  amount: number,
): { value: number; marketValue: number; catchChance: number } {
  const marketValue = quoteSell(state.cities[cityId], good, amount);
  return {
    value: Math.round(marketValue * SMUGGLING.priceFactor),
    marketValue,
    catchChance: smuggleCatchChance(state),
  };
}

/** Stimmenverlust bei Wahlen durch Verruf. */
export function notorietyElectionPenalty(state: GameState): number {
  return state.player.notoriety * NOTORIETY.electionPenaltyPerPoint;
}

/** Wöchentlich: Verruf klingt ab; wer zu verrufen ist, gerät in eine Ermittlung. */
export function runFactionsWeek(ctx: SimContext): void {
  const { state } = ctx;
  const p = state.player;
  if (p.notoriety >= NOTORIETY.investigationThreshold) {
    const risk =
      ((p.notoriety - NOTORIETY.investigationThreshold + 10) / 100) * NOTORIETY.investigationFactor;
    if (chance(state.rng, risk)) {
      const fine = Math.round(
        Math.max(NOTORIETY.investigationMinFine, p.netWorth * NOTORIETY.investigationFineShare),
      );
      p.money -= fine;
      addReputation(state, p.homeCityId, { societal: -NOTORIETY.investigationSocietal });
      applyFavor(state, FAVOR_GAINS.investigation);
      addNotoriety(state, -NOTORIETY.investigationRelief);
      postMessage(
        ctx,
        'danger',
        'Ermittlung',
        `Die Stadtwache ist Gerüchten über Eure Geschäfte nachgegangen. Ihr zahlt ${fine} GS, um die Sache aus der Welt zu schaffen.`,
      );
    }
  }
  addNotoriety(state, -NOTORIETY.weeklyDecay);
}
