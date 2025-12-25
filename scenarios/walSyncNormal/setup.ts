import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * WAL Sync Normal Scenario Setup
 * 
 * Configuration: WAL + synchronous NORMAL + busy_timeout
 * - PRAGMA journal_mode = WAL (Write-Ahead Logging)
 * - PRAGMA synchronous = NORMAL (less strict fsync, better performance)
 * - PRAGMA busy_timeout = 2000ms (set per-connection in worker)
 * 
 * With WAL + NORMAL synchronous:
 * - WAL file is synced at checkpoint, not every transaction
 * - Good balance between durability and performance
 * - Safe from corruption on OS crash, may lose last transaction on power loss
 * 
 * Note: journal_mode and synchronous are database-level and persist.
 * Note: busy_timeout is connection-level and set in worker.ts.
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    setupTables(db);
    db.close();
}

