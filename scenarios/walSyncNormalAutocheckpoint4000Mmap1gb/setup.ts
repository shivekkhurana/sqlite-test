import Database from "better-sqlite3";
import { setupTables } from "../../src/db.js";

/**
 * WAL Sync Normal Autocheckpoint 4000 Mmap 1GB Scenario Setup
 * 
 * Configuration: WAL + synchronous NORMAL + wal_autocheckpoint 4000 + busy_timeout + temp_store = memory
 * - PRAGMA journal_mode = WAL (database-level, set here)
 * - PRAGMA synchronous = NORMAL (database-level, set here)
 * - PRAGMA temp_store = memory (database-level, set here)
 * - PRAGMA wal_autocheckpoint = 4000 (connection-level, set in worker)
 * - PRAGMA busy_timeout = 2000ms (connection-level, set in worker)
 * - PRAGMA mmap_size = 1000000000 (1GB, connection-level, set in worker)
 * 
 * Additional optimizations:
 * - temp_store = memory: Stores temporary tables and indices in memory instead of disk
 * - mmap_size = 1GB: Uses memory-mapped I/O for faster reads
 * - Even higher autocheckpoint threshold means:
 *   - Even less frequent checkpoints during writes
 *   - Larger WAL file before checkpoint (~16MB)
 *   - Potentially better write throughput for large batch writes
 */
export function setup(dbPath: string): void {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = memory');
    setupTables(db);
    db.close();
}

