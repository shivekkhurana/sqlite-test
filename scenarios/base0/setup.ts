import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * Base-0 Scenario Setup
 * 
 * Configuration: SQLite out-of-the-box defaults
 * - No busy_timeout (immediate SQLITE_BUSY on lock)
 * - Default journal mode
 * - Default synchronous mode
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    setupTables(db);
    db.close();
}

