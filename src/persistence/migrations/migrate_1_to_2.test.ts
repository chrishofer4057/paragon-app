import { describe, expect, it } from 'vitest';
import { applyCommand, createNewGame, tick } from '../../sim/engine';
import { loadSave, SAVE_VERSION } from '../saveFile';

/** Ein Spielstand im Format 1, wie ihn Version 0.2.0 geschrieben hat. */
function v1Save(): string {
  const state = createNewGame({ seed: 3, characterId: 'ursina' }) as unknown as {
    player: Record<string, unknown> & { dailyLedger: Record<string, unknown> };
  };
  delete state.player['merchantMood'];
  delete state.player['linerBooking'];
  delete state.player['holds'];
  delete state.player.dailyLedger['haggles'];
  return JSON.stringify({
    saveVersion: 1,
    gameVersion: '0.2.0',
    createdAt: '2026-10-02T12:00:00Z',
    meta: { slotName: 'Alt', characterId: 'ursina', cityId: 'NewArk', gameDay: 60, money: 40 },
    state,
  });
}

describe('Migration 1 → 2', () => {
  it('ergänzt die neuen Felder, und das Spiel läuft weiter', () => {
    const loaded = loadSave(v1Save());
    expect(loaded.saveVersion).toBe(SAVE_VERSION);
    expect(loaded.state.player.merchantMood).toEqual({});
    expect(loaded.state.player.linerBooking).toBeNull();
    expect(loaded.state.player.holds).toEqual({});
    expect(loaded.state.player.dailyLedger.haggles).toEqual({});
    tick(loaded.state, 48);
    loaded.state.player.rank = 'huckster';
    loaded.state.player.inventory.Wood = 3;
    const { result } = applyCommand(loaded.state, {
      type: 'Haggle',
      good: 'Wood',
      amount: 3,
      direction: 'sell',
      pricePerUnit: 1,
      storage: { kind: 'inventory' },
    });
    expect(result.ok).toBe(true);
  });
});
