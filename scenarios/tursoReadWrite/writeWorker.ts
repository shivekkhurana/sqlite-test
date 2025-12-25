import { executeTursoWrite } from "../../src/tursoWorkerCore.js";
import type { WriteTask } from "../../src/workerCore.js";

/**
 * Turso Read/Write Scenario - Write Worker
 * 
 * Uses libSQL client in local embedded mode.
 * Note: PRAGMAs like busy_timeout and cache_size are not applicable
 * in libSQL as they are SQLite-specific connection settings.
 */
export default async function worker(task: WriteTask) {
    return await executeTursoWrite(task);
}

