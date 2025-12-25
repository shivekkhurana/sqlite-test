import Database from "better-sqlite3";
import { executeWrite } from "../../src/workerCore.js";
import type { WriteTask } from "../../src/workerCore.js";

/**
 * BusyTimeout400 Worker
 * 
 * Opens database with PRAGMA busy_timeout = 400
 * This means the connection will retry for up to 400ms
 * before returning SQLITE_BUSY error.
 */
export default function worker(task: WriteTask) {
    const db = new Database(task.dbPath);
    db.pragma('busy_timeout = 400');
    return executeWrite(db, task);
}

