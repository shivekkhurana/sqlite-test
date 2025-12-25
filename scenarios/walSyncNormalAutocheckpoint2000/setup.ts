import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * WAL Sync Normal Autocheckpoint 2000 Scenario Setup
 * 
 * Configuration: WAL + synchronous NORMAL + wal_autocheckpoint 2000 + busy_timeout
 * - PRAGMA journal_mode = WAL (database-level, set here)
 * - PRAGMA synchronous = NORMAL (database-level, set here)
 * - PRAGMA wal_autocheckpoint = 2000 (connection-level, set in worker)
 * - PRAGMA busy_timeout = 2000ms (connection-level, set in worker)
 * 
 * Higher autocheckpoint threshold means:
 * - Less frequent checkpoints during writes
 * - Larger WAL file before checkpoint (~8MB)
 * - Potentially better write throughput
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    setupTables(db);
    db.close();
}

