import { describe, expect, it } from 'vitest';
import { applyCommand, createNewGame, tick } from '../../sim/engine';
import { loadSave } from '../saveFile';

/** Ein Spielstand im Format 2 (vor den Fraktionen). */
function v2Save(): string {
  const state = createNewGame({ seed: 5, characterId: 'duri' }) as unknown as {
    player: Record<string, unknown>;
  };
  for (const key of ['factions', 'pledge', 'pledgeChangedTick', 'notoriety']) delete state.player[key];
  return JSON.stringify({
    saveVersion: 2,
    gameVersion: '0.3.0',
    createdAt: '2026-10-03T12:00:00Z',
    meta: { slotName: 'Alt', characterId: 'duri', cityId: 'NewArk', gameDay: 61, money: 30 },
    state,
  });
}

describe('Migration 2 → 3', () => {
  it('ergänzt Fraktionen und Verruf, und das Spiel läuft weiter', () => {
    const loaded = loadSave(v2Save());
    expect(loaded.saveVersion).toBe(3);
    expect(loaded.state.player.factions).toEqual({ merchants: 0, temple: 0, harbour: 0 });
    expect(loaded.state.player.pledge).toBeNull();
    expect(loaded.state.player.notoriety).toBe(0);
    tick(loaded.state, 24 * 8);
    expect(applyCommand(loaded.state, { type: 'PledgeFaction', faction: 'harbour' }).result.ok).toBe(false);
  });
});
