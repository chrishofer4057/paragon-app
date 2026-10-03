import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../sim/engine';
import { IndexedDbSaveStorage } from './indexedDbStorage';
import { createSaveFile, loadSave, serializeSave } from './saveFile';

describe('IndexedDbSaveStorage', () => {
  it('speichert, listet, lädt und löscht Spielstände', async () => {
    const storage = new IndexedDbSaveStorage(new IDBFactory());
    const state = createNewGame({ seed: 4, characterId: 'mengia' });
    await storage.save(
      'Slot A',
      serializeSave(createSaveFile(state, 'Slot A', '0.1.0', '2026-10-02T10:00:00Z')),
    );
    await storage.save(
      'Autosave',
      serializeSave(createSaveFile(state, 'Autosave', '0.1.0', '2026-10-02T11:00:00Z')),
    );
    const list = await storage.list();
    expect(list.map((m) => m.slotName)).toEqual(['Autosave', 'Slot A']);
    const json = await storage.load('Slot A');
    expect(loadSave(json!).state).toEqual(state);
    await storage.remove('Slot A');
    expect(await storage.load('Slot A')).toBeNull();
  });
});
