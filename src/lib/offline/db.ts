import type { OfflineQuizPack, WorkspaceSnapshot } from "./types";

const DATABASE = "nle-reviewer-local-v1";
const VERSION = 1;
const STORE = "records";

type RecordValue = WorkspaceSnapshot | OfflineQuizPack | string | number | boolean;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export function readLocal<T extends RecordValue>(key: string) {
  return transact<T | undefined>("readonly", (store) => store.get(key));
}

export function writeLocal(key: string, value: RecordValue) {
  return transact<IDBValidKey>("readwrite", (store) => store.put(value, key));
}

export function deleteLocal(key: string) {
  return transact<undefined>("readwrite", (store) => store.delete(key));
}

export async function clearLocalWorkspace() {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("nle-")).map((name) => caches.delete(name)));
  }
}

export const workspaceKey = (userId: string) => `workspace:${userId}`;
export const quizKey = (attemptId: string) => `quiz:${attemptId}`;
