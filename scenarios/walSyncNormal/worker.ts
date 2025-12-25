import Database from "better-sqlite3";
import { executeWrite } from "../../src/workerCore.js";
import type { WriteTask } from "../../src/workerCore.js";

/**
 * WAL Sync Normal Worker
 * 
 * Opens database with WAL + synchronous NORMAL (set in setup).
 * Sets busy_timeout = 2000ms per connection.
 */
export default function worker(task: WriteTask) {
    const db = new Database(task.dbPath);
    db.pragma('busy_timeout = 2000');
    return executeWrite(db, task);
}

