import { describe, expect, it } from 'vitest';
import { applyCommand, createNewGame, tick } from '../sim/engine';
import { createSaveFile, loadSave, SAVE_VERSION, serializeSave } from './saveFile';

describe('Speichern und Laden', () => {
  it('Spielstand übersteht Speichern/Laden und läuft identisch weiter', () => {
    const original = createNewGame({ seed: 9, characterId: 'duri' });
    applyCommand(original, { type: 'ChopWood', quality: 0.9 });
    tick(original, 24 * 5);
    const json = serializeSave(createSaveFile(original, 'Slot 1', '0.1.0', '2026-10-02T12:00:00.000Z'));
    const loaded = loadSave(json);
    expect(loaded.saveVersion).toBe(SAVE_VERSION);
    expect(loaded.meta.characterId).toBe('duri');
    expect(loaded.state).toEqual(original);
    tick(original, 24 * 10);
    tick(loaded.state, 24 * 10);
    expect(loaded.state).toEqual(original);
  });

  it('lehnt Spielstände aus der Zukunft ab', () => {
    const save = createSaveFile(
      createNewGame({ seed: 1, characterId: 'gian' }),
      'x',
      '0.1.0',
      '2026-01-01T00:00:00Z',
    );
    expect(() => loadSave(JSON.stringify({ ...save, saveVersion: SAVE_VERSION + 1 }))).toThrow();
  });
});
