import type { DictEntry, PitchMap } from './types';

const DB_NAME = 'migaku-jp';
const DB_VERSION = 1;
const CHUNK = 2000;

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const entries = db.createObjectStore('entries', { keyPath: 'id' });
      entries.createIndex('forms', 'forms', { multiEntry: true });
      db.createObjectStore('pitch');
      db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function isImported(db: IDBDatabase): Promise<boolean> {
  const tx = db.transaction('meta', 'readonly');
  const value = await reqResult(tx.objectStore('meta').get('imported'));
  return value === true;
}

export async function importData(
  db: IDBDatabase,
  entries: DictEntry[],
  pitch: PitchMap,
): Promise<void> {
  for (let i = 0; i < entries.length; i += CHUNK) {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    for (const e of entries.slice(i, i + CHUNK)) store.put(e);
    await txDone(tx);
  }
  const keys = Object.keys(pitch);
  for (let i = 0; i < keys.length; i += CHUNK) {
    const tx = db.transaction('pitch', 'readwrite');
    const store = tx.objectStore('pitch');
    for (const k of keys.slice(i, i + CHUNK)) store.put(pitch[k], k);
    await txDone(tx);
  }
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put(true, 'imported');
  await txDone(tx);
}

export async function lookupEntries(
  db: IDBDatabase,
  form: string,
): Promise<DictEntry[]> {
  const tx = db.transaction('entries', 'readonly');
  const idx = tx.objectStore('entries').index('forms');
  return reqResult(idx.getAll(form));
}

export async function getAccent(
  db: IDBDatabase,
  term: string,
  reading?: string,
): Promise<number | null> {
  const keys = reading ? [`${term}|${reading}`, term] : [term];
  const tx = db.transaction('pitch', 'readonly');
  const store = tx.objectStore('pitch');
  for (const key of keys) {
    const value = await reqResult(store.get(key));
    if (typeof value === 'number') return value;
  }
  return null;
}
