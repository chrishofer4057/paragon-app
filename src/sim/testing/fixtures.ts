import type { CharacterId } from '../data/characters';
import type { CityId } from '../data/cities';
import type { GoodAmounts } from '../data/goods';
import type { RankId } from '../data/ranks';
import { applyCommand, createNewGame, tick } from '../engine';
import type { Command } from '../commands/commands';
import type { GameState } from '../state/gameState';
import { HOURS_PER_DAY } from '../time';

/** Hilfsfunktionen nur für Tests: Spielstände in bestimmte Situationen bringen. */

export interface SetupOptions {
  seed?: number;
  characterId?: CharacterId;
  rank?: RankId;
  money?: number;
  kontorIn?: CityId[];
  kontorGoods?: GoodAmounts;
}

export function setupGame(options: SetupOptions = {}): GameState {
  const state = createNewGame({ seed: options.seed ?? 1234, characterId: options.characterId ?? 'gian' });
  if (options.rank) state.player.rank = options.rank;
  if (options.money !== undefined) {
    state.player.money = options.money;
    state.player.netWorth = options.money;
  }
  for (const cityId of options.kontorIn ?? []) {
    state.player.kontors[cityId] = {
      cityId,
      storage: { ...(options.kontorGoods ?? {}) },
      warehouses: 0,
      guards: 0,
      manager: null,
    };
  }
  return state;
}

/** Command ausführen und bei Fehler mit lesbarer Meldung scheitern. */
export function run(state: GameState, command: Command): string | undefined {
  const { result } = applyCommand(state, command);
  if (!result.ok) throw new Error(`${command.type} fehlgeschlagen: ${result.reason}`);
  return result.message;
}

export function runDays(state: GameState, days: number): void {
  tick(state, Math.round(days * HOURS_PER_DAY));
}

/** Bis kurz vor den nächsten Tagesbeginn vorspulen, damit Tagessysteme gezielt laufen. */
export function advanceToNextDay(state: GameState): void {
  const remaining = HOURS_PER_DAY - (state.tick % HOURS_PER_DAY);
  tick(state, remaining);
}
