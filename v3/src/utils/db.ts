import { TelemetryRecord } from "../types";

const DB_NAME = "TelemetryAppDatabase";
const DB_VERSION = 1;
const STORE_NAME = "session_records";

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Saves a list of telemetry records for a given session ID.
 * Falls back to localStorage if IndexedDB is not supported or fails.
 */
export async function setSessionRecords(sessionId: string, records: TelemetryRecord[]): Promise<void> {
  const dbKey = `records_${sessionId}`;
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(records, dbKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    // If IndexedDB succeeded, clean up any old localStorage backup/record with the same key to free space.
    try {
      localStorage.removeItem(dbKey);
    } catch (_) {}
  } catch (err) {
    console.warn("IndexedDB set failed, falling back to localStorage:", err);
    // Fallback:
    try {
      localStorage.setItem(dbKey, JSON.stringify(records));
    } catch (e) {
      console.error("LocalStorage quota exceeded, and IndexedDB was unavailable:", e);
      throw e;
    }
  }
}

/**
 * Retrieves records for a given session ID.
 * Tries IndexedDB first, then falls back to checking localStorage.
 */
export async function getSessionRecords(sessionId: string): Promise<TelemetryRecord[] | null> {
  const dbKey = `records_${sessionId}`;
  try {
    const db = await initDB();
    const records = await new Promise<TelemetryRecord[] | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(dbKey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (records) {
      return records;
    }
  } catch (err) {
    console.warn("IndexedDB get failed, falling back to localStorage:", err);
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(dbKey);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Failed to parse localStorage records fallbacks:", err);
  }
  return null;
}

/**
 * Deletes records for a given session ID from both IndexedDB and localStorage.
 */
export async function deleteSessionRecords(sessionId: string): Promise<void> {
  const dbKey = `records_${sessionId}`;
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(dbKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB delete failed:", err);
  }

  // Always attempt to delete from localStorage too
  try {
    localStorage.removeItem(dbKey);
  } catch (_) {}
}

/**
 * Saves recording backup records.
 * Keeps a copy in IndexedDB if possible.
 */
export async function setBackupRecords(records: TelemetryRecord[]): Promise<void> {
  const backupKey = "recording_backup_records";
  let idbSuccess = false;
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(records, backupKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    idbSuccess = true;
  } catch (err) {
    console.warn("IndexedDB backup set failed:", err);
  }

  try {
    // If IndexedDB saved it successfully, we can store a smaller indicator or write to localStorage.
    // However, keeping standard JSON.stringify ensures we can use it. If it fails, write "INDEXEDDB_ONLY".
    if (idbSuccess) {
      try {
        localStorage.setItem(backupKey, JSON.stringify(records));
      } catch (quotaErr) {
        localStorage.setItem(backupKey, "INDEXEDDB_ONLY");
      }
    } else {
      localStorage.setItem(backupKey, JSON.stringify(records));
    }
  } catch (err) {
    console.error("Both localStorage and IndexedDB failed for saving backups:", err);
  }
}

/**
 * Retrieves recording backup records.
 */
export async function getBackupRecords(): Promise<TelemetryRecord[] | null> {
  const backupKey = "recording_backup_records";
  try {
    const db = await initDB();
    const records = await new Promise<TelemetryRecord[] | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(backupKey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (records && records.length > 0) {
      return records;
    }
  } catch (err) {
    console.warn("IndexedDB backup retrieve failed:", err);
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(backupKey);
    if (stored && stored !== "INDEXEDDB_ONLY") {
      return JSON.parse(stored);
    }
  } catch (_) {}
  return null;
}

/**
 * Deletes backup records.
 */
export async function deleteBackupRecords(): Promise<void> {
  const backupKey = "recording_backup_records";
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(backupKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (_) {}

  try {
    localStorage.removeItem(backupKey);
  } catch (_) {}
}
