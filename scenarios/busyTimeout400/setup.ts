import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * BusyTimeout400 Scenario Setup
 * 
 * Configuration: busy_timeout = 400ms
 * - Workers will retry for up to 400ms on SQLITE_BUSY
 * - Lower latency but more likely to see lock errors under contention
 * 
 * Note: busy_timeout is a connection-level pragma, so it's
 * applied in the worker, not here. This setup only creates tables.
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    setupTables(db);
    db.close();
}

