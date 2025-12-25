import Database from "better-sqlite3";
import { executeWrite } from "../../src/workerCore.js";
import type { WriteTask } from "../../src/workerCore.js";

/**
 * BusyTimeout1 Worker
 * 
 * Opens database with PRAGMA busy_timeout = 5000
 * This means the connection will retry for up to 5 seconds
 * before returning SQLITE_BUSY error.
 */
export default function worker(task: WriteTask) {
    const db = new Database(task.dbPath);
    db.pragma('busy_timeout = 5000');
    return executeWrite(db, task);
}

