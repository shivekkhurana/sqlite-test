import Database from "better-sqlite3";
import { executeWrite } from "../../src/workerCore.js";
import type { WriteTask } from "../../src/workerCore.js";

/**
 * WAL Worker
 * 
 * Opens database with WAL mode already enabled (set in setup).
 * Also sets busy_timeout = 2000ms per connection.
 */
export default function worker(task: WriteTask) {
    const db = new Database(task.dbPath);
    db.pragma('busy_timeout = 2000');
    return executeWrite(db, task);
}

