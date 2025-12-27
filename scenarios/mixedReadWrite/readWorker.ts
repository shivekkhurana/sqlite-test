import Database from "better-sqlite3";
import { executeRead } from "../../src/readWorkerCore.js";
import type { ReadTask } from "../../src/readWorkerCore.js";

/**
 * Mixed Read/Write Scenario - Read Worker
 * 
 * Opens database with connection-level pragmas:
 * - busy_timeout = 2000ms
 * - wal_autocheckpoint = 4000 (for consistency, though reads don't checkpoint)
 * - mmap_size = 1000000000 (1GB)
 * - cache_size = configurable (default -16000 = 16MB)
 */
export default function worker(task: ReadTask) {
    const db = new Database(task.dbPath);
    db.pragma('busy_timeout = 2000');
    db.pragma('wal_autocheckpoint = 4000');
    db.pragma('mmap_size = 1000000000');
    db.pragma(`cache_size = ${task.cacheSize ?? -16000}`);
    return executeRead(db, task);
}

