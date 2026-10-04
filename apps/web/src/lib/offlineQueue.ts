import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface OfflineLogItem {
  id?: number;
  empId: string;
  action: 'CLOCK_IN' | 'CLOCK_OUT' | 'AUTO_PAUSE' | 'AUTO_RESUME' | 'AUTO_EXIT';
  lat: number | null;
  lng: number | null;
  dateTime: string;
  note?: string;
  expense?: number;
  createdAt: number;
}

interface TimeTrackerDB extends DBSchema {
  offlineLogs: {
    key: number;
    value: OfflineLogItem;
    indexes: { 'by-empId': string };
  };
}

const DB_NAME = 'timetracker_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TimeTrackerDB>> | null = null;

function getDb(): Promise<IDBPDatabase<TimeTrackerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TimeTrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('offlineLogs')) {
          const store = db.createObjectStore('offlineLogs', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-empId', 'empId');
        }
      },
    });
  }
  return dbPromise;
}

// Event listeners for offline queue count changes
type QueueListener = (count: number) => void;
const listeners: Set<QueueListener> = new Set();

export function onQueueChange(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function notifyListeners(empId: string) {
  const count = await getPendingCount(empId);
  listeners.forEach((fn) => fn(count));
}

/**
 * Enqueue an action when offline or when network call failed
 */
export async function enqueueOfflineLog(
  item: Omit<OfflineLogItem, 'id' | 'createdAt'>
): Promise<number> {
  const db = await getDb();
  const id = await db.add('offlineLogs', {
    ...item,
    createdAt: Date.now(),
  } as OfflineLogItem);
  await notifyListeners(item.empId);
  return id;
}

/**
 * Get all pending logs for an employee sorted chronologically
 */
export async function getPendingLogs(empId: string): Promise<OfflineLogItem[]> {
  const db = await getDb();
  const logs = await db.getAllFromIndex('offlineLogs', 'by-empId', empId);
  return logs.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

/**
 * Get count of pending unsynced logs
 */
export async function getPendingCount(empId: string): Promise<number> {
  const db = await getDb();
  return db.countFromIndex('offlineLogs', 'by-empId', empId);
}

/**
 * Remove an individual log after successful sync
 */
export async function removeOfflineLog(id: number, empId: string): Promise<void> {
  const db = await getDb();
  await db.delete('offlineLogs', id);
  await notifyListeners(empId);
}

/**
 * Clear all pending logs for an employee
 */
export async function clearPendingLogs(empId: string): Promise<void> {
  const db = await getDb();
  const logs = await getPendingLogs(empId);
  const tx = db.transaction('offlineLogs', 'readwrite');
  for (const log of logs) {
    if (log.id !== undefined) {
      await tx.store.delete(log.id);
    }
  }
  await tx.done;
  await notifyListeners(empId);
}

/**
 * Flush and sync all pending logs to the backend
 */
export async function flushOfflineQueue(
  empId: string,
  syncApiCall: (logs: OfflineLogItem[]) => Promise<boolean>
): Promise<{ success: boolean; count: number }> {
  const pending = await getPendingLogs(empId);
  if (pending.length === 0) {
    return { success: true, count: 0 };
  }

  const success = await syncApiCall(pending);
  if (success) {
    await clearPendingLogs(empId);
    return { success: true, count: pending.length };
  }

  return { success: false, count: pending.length };
}
