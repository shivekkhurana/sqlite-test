import { executeTursoRead } from "../../src/tursoWorkerCore.js";
import type { ReadTask } from "../../src/readWorkerCore.js";

/**
 * Turso Read/Write Scenario - Read Worker
 * 
 * Uses libSQL client in local embedded mode.
 * Note: PRAGMAs like busy_timeout and cache_size are not applicable
 * in libSQL as they are SQLite-specific connection settings.
 */
export default async function worker(task: ReadTask) {
    return await executeTursoRead(task);
}

