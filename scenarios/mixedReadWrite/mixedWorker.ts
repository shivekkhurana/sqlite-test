import Database from "better-sqlite3";
import { executeRead, type ReadTask } from "../../src/readWorkerCore.js";
import { executeWrite, type WriteTask } from "../../src/workerCore.js";

type MixedTask = ReadTask | WriteTask;

export default function worker(task: MixedTask) {
    const db = new Database(task.dbPath);
    // Apply pragmas (common to both)
    db.pragma('busy_timeout = 2000');
    db.pragma('wal_autocheckpoint = 4000');
    db.pragma('mmap_size = 1000000000'); // 1GB mmap
    db.pragma(`cache_size = ${task.cacheSize ?? -16000}`);

    if ('queryType' in task) {
        return executeRead(db, task);
    } else {
        return executeWrite(db, task);
    }
}
