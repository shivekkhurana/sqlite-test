import Database from "better-sqlite3";
import { executeWrite } from "../../src/workerCore.js";
import type { WriteTask } from "../../src/workerCore.js";

/**
 * WAL Sync Normal Autocheckpoint 4000 Worker
 * 
 * Opens database with WAL + synchronous NORMAL + wal_autocheckpoint 4000 (set in setup).
 * Sets busy_timeout = 2000ms and wal_autocheckpoint = 4000 per connection.
 */
export default function worker(task: WriteTask) {
    const db = new Database(task.dbPath);
    db.pragma('busy_timeout = 2000');
    db.pragma('wal_autocheckpoint = 4000');
    return executeWrite(db, task);
}

