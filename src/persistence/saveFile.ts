import type { GameState } from '../sim/state/gameState';
import { toDate } from '../sim/time';
import { migrate_1_to_2 } from './migrations/migrate_1_to_2';
import { migrate_2_to_3 } from './migrations/migrate_2_to_3';

/**
 * Speicherformat (CLAUDE.md §6). Bei jeder Änderung am Zustandsmodell SAVE_VERSION
 * erhöhen und in MIGRATIONS eine Funktion `n -> n+1` ergänzen (mit Test).
 */

export const SAVE_VERSION = 3;

export interface SaveFile {
  saveVersion: number;
  gameVersion: string;
  /** ISO-Zeitstempel, wird außerhalb der Simulation gesetzt. */
  createdAt: string;
  meta: { slotName: string; characterId: string; cityId: string; gameDay: number; money: number };
  state: GameState;
}

type Migration = (state: unknown) => unknown;

/** Index n migriert Version n+1 nach n+2 (MIGRATIONS[0]: 1 -> 2). */
export const MIGRATIONS: readonly Migration[] = [migrate_1_to_2, migrate_2_to_3];

export function createSaveFile(
  state: GameState,
  slotName: string,
  gameVersion: string,
  createdAt: string,
): SaveFile {
  const location = state.player.location;
  return {
    saveVersion: SAVE_VERSION,
    gameVersion,
    createdAt,
    meta: {
      slotName,
      characterId: state.player.characterId,
      cityId: location.kind === 'city' ? location.cityId : location.to,
      gameDay: toDate(state.tick).day,
      money: Math.round(state.player.money),
    },
    state: structuredClone(state),
  };
}

export function serializeSave(save: SaveFile): string {
  return JSON.stringify(save);
}

/** Lädt einen Spielstand und hebt ihn bei Bedarf auf die aktuelle Version. */
export function loadSave(json: string): SaveFile {
  const raw = JSON.parse(json) as SaveFile;
  if (typeof raw.saveVersion !== 'number' || raw.saveVersion < 1)
    throw new Error('Unbekanntes Speicherformat');
  if (raw.saveVersion > SAVE_VERSION) throw new Error('Spielstand stammt aus einer neueren Spielversion');
  let state: unknown = raw.state;
  for (let v = raw.saveVersion; v < SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v - 1];
    if (!migrate) throw new Error(`Migration ${v} -> ${v + 1} fehlt`);
    state = migrate(state);
  }
  return { ...raw, saveVersion: SAVE_VERSION, state: state as GameState };
}

/** Speicher-Adapter (Browser: IndexedDB, Electron: Dateien im userData-Verzeichnis). */
export interface SaveStorage {
  list(): Promise<SaveFile['meta'][]>;
  save(slotName: string, data: string): Promise<void>;
  load(slotName: string): Promise<string | null>;
  remove(slotName: string): Promise<void>;
}
