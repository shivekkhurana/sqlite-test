import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * WAL Sync Normal Autocheckpoint 4000 + Busy Timeout 5000 Scenario Setup
 * 
 * Configuration: WAL + synchronous NORMAL + wal_autocheckpoint 4000 + busy_timeout 5000
 * - PRAGMA journal_mode = WAL (database-level, set here)
 * - PRAGMA synchronous = NORMAL (database-level, set here)
 * - PRAGMA wal_autocheckpoint = 4000 (connection-level, set in worker)
 * - PRAGMA busy_timeout = 5000ms (connection-level, set in worker)
 * 
 * Higher autocheckpoint + longer busy timeout:
 * - Less frequent checkpoints during writes (~16MB before checkpoint)
 * - More time to wait for locks before failing
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    setupTables(db);
    db.close();
}

