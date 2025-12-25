import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * BusyTimeout1 Scenario Setup
 * 
 * Configuration: busy_timeout = 5000ms
 * - Workers will retry for up to 5 seconds on SQLITE_BUSY
 * - Expects fewer lock errors but higher latency
 * 
 * Note: busy_timeout is a connection-level pragma, so it's
 * applied in the worker, not here. This setup only creates tables.
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    setupTables(db);
    db.close();
}

