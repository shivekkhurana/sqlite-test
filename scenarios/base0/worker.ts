import Database from "better-sqlite3";
import { executeWrite } from "../../src/workerCore.js";
import type { WriteTask } from "../../src/workerCore.js";

/**
 * Base-0 Worker
 * 
 * Opens database with no additional pragmas.
 * SQLite defaults - immediate failure on lock.
 */
export default function worker(task: WriteTask) {
    const db = new Database(task.dbPath);
    return executeWrite(db, task);
}

