import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * WAL Scenario Setup
 * 
 * Configuration: WAL journal mode + busy_timeout
 * - PRAGMA journal_mode = WAL (Write-Ahead Logging)
 * - PRAGMA busy_timeout = 2000ms (set per-connection in worker)
 * - WAL allows concurrent reads during writes
 * - Writers don't block readers, readers don't block writers
 * - Only one writer at a time, but with better concurrency than rollback journal
 * 
 * Note: journal_mode is database-level and persists after connection closes.
 * Note: busy_timeout is connection-level and set in worker.ts.
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    setupTables(db);
    db.close();
}

