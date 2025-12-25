import Database from "better-sqlite3";
import { executeWrite } from "../../src/workerCore.js";
import type { WriteTask } from "../../src/workerCore.js";

/**
 * Mixed Read/Write Scenario - Write Worker
 * 
 * Opens database with connection-level pragmas:
 * - busy_timeout = 2000ms
 * - wal_autocheckpoint = 4000
 * - cache_size = configurable (default -16000 = 16MB)
 */
export default function worker(task: WriteTask) {
    const db = new Database(task.dbPath);
    db.pragma('busy_timeout = 2000');
    db.pragma('wal_autocheckpoint = 4000');
    db.pragma(`cache_size = ${task.cacheSize ?? -16000}`);
    return executeWrite(db, task);
}

