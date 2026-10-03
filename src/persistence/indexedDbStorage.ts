import type { SaveFile, SaveStorage } from './saveFile';

/**
 * Speicherplätze im Browser (IndexedDB). Ein Eintrag je Slot: Metadaten getrennt vom
 * (großen) Spielstand, damit die Slot-Liste schnell lädt.
 */

const DB_NAME = 'fiera';
const DB_VERSION = 1;
const SAVES = 'saves';
const META = 'meta';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB-Fehler'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-Transaktion abgebrochen'));
  });
}

export class IndexedDbSaveStorage implements SaveStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const open = this.factory.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(SAVES)) db.createObjectStore(SAVES);
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('IndexedDB nicht verfügbar'));
    });
    return this.dbPromise;
  }

  async list(): Promise<SaveFile['meta'][]> {
    const db = await this.db();
    const tx = db.transaction(META, 'readonly');
    const all = await request(
      tx.objectStore(META).getAll() as IDBRequest<(SaveFile['meta'] & { savedAt?: string })[]>,
    );
    return all.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
  }

  async save(slotName: string, data: string): Promise<void> {
    const parsed = JSON.parse(data) as SaveFile;
    const db = await this.db();
    const tx = db.transaction([SAVES, META], 'readwrite');
    tx.objectStore(SAVES).put(data, slotName);
    tx.objectStore(META).put({ ...parsed.meta, slotName, savedAt: parsed.createdAt }, slotName);
    await done(tx);
  }

  async load(slotName: string): Promise<string | null> {
    const db = await this.db();
    const tx = db.transaction(SAVES, 'readonly');
    const result = await request(tx.objectStore(SAVES).get(slotName) as IDBRequest<string | undefined>);
    return result ?? null;
  }

  async remove(slotName: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([SAVES, META], 'readwrite');
    tx.objectStore(SAVES).delete(slotName);
    tx.objectStore(META).delete(slotName);
    await done(tx);
  }
}
