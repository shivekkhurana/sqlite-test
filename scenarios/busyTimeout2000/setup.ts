import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * BusyTimeout2000 Scenario Setup
 * 
 * Configuration: busy_timeout = 2000ms
 * - Workers will retry for up to 2 seconds on SQLITE_BUSY
 * - Balance between latency and lock error reduction
 * 
 * Note: busy_timeout is a connection-level pragma, so it's
 * applied in the worker, not here. This setup only creates tables.
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    setupTables(db);
    db.close();
}

