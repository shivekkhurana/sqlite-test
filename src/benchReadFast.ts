import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlinkSync, existsSync } from 'node:fs';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../db/fast.db');
const DURATION_MS = 1000;
const MAX_CONCURRENCY = 512;

interface WorkerResult {
    success: boolean;
    count: number;
    threadId: number;
}

if (isMainThread) {
    (async () => {
        console.log("=== Beast Mode Read Benchmark ===");
        console.log(`Max Concurrency: ${MAX_CONCURRENCY}`);
        console.log(`Duration per run: ${DURATION_MS}ms`);

        // 1. Setup Database
        if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
        if (existsSync(DB_PATH + '-wal')) unlinkSync(DB_PATH + '-wal');
        if (existsSync(DB_PATH + '-shm')) unlinkSync(DB_PATH + '-shm');

        const dbDir = dirname(DB_PATH);
        if (!existsSync(dbDir)) {
             try {
                 const { mkdirSync } = await import('node:fs');
                 mkdirSync(dbDir, { recursive: true });
             } catch (e) {
                 // ignore if exists
             }
        }

        const db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('temp_store = memory');
        db.exec('CREATE TABLE fast (col INTEGER)');
        db.exec('INSERT INTO fast (col) VALUES (0)');
        db.close();

        // 2. Loop Concurrency
        const results: { concurrency: number; readsPerSec: number; avgLatency: number }[] = [];

        for (let c = 129; c <= MAX_CONCURRENCY; c++) {
            const workers: Worker[] = [];
            const resultPromises: Promise<number>[] = [];

            // Spawn workers
            for (let i = 0; i < c; i++) {
                const w = new Worker(fileURLToPath(import.meta.url), {
                    workerData: { dbPath: DB_PATH, duration: DURATION_MS },
                    execArgv: [...process.execArgv, "--no-warnings"]
                });
                workers.push(w);
                resultPromises.push(new Promise((resolve) => {
                    w.on('message', (msg: number) => resolve(msg));
                }));
            }

            // Wait for all results
            const counts = await Promise.all(resultPromises);
            
            // Terminate workers
            await Promise.all(workers.map(w => w.terminate()));

            const totalReads = counts.reduce((a, b) => a + b, 0);
            
            // Calc stats
            // Duration is fixed at DURATION_MS per worker. 
            // Total Reads in DURATION_MS seconds.
            const readsPerSec = (totalReads / DURATION_MS) * 1000;
            // Latency = Duration * Concurrency / TotalOps (Little's Law variation for closed system?)
            // Avg Latency (ms) = 1000ms / (ReadsPerSec / Concurrency) = (1000 * C) / RPS
            const avgLatency = (DURATION_MS * c) / totalReads;

            results.push({ concurrency: c, readsPerSec, avgLatency });
            console.log(`Concurrency ${c}: ${Math.round(readsPerSec).toLocaleString()} reads/sec, Avg Latency: ${avgLatency.toFixed(3)} ms`);
        }

        // 3. Report Winner
        const winner = results.reduce((prev, curr) => (curr.readsPerSec > prev.readsPerSec ? curr : prev));
        
        console.log("\n=== WINNER ===");
        console.log(`Concurrency: ${winner.concurrency}`);
        console.log(`Throughput:  ${Math.round(winner.readsPerSec).toLocaleString()} reads/sec`);
        console.log(`Ave Latency: ${winner.avgLatency.toFixed(3)} ms`);

    })();

} else {
    // Worker Thread
    const { dbPath, duration } = workerData;
    const db = new Database(dbPath, { readonly: true }); // optimize for read? better-sqlite3 doesn't stick strict readonly but we can try
    
    // Optimizations from walSyncNormalAutocheckpoint4000Mmap1gb
    db.pragma('busy_timeout = 2000');
    db.pragma('wal_autocheckpoint = 4000');
    db.pragma('mmap_size = 1000000000');
    db.pragma('query_only = true'); // Enforce read-only

    const stmt = db.prepare('SELECT col FROM fast');
    
    let count = 0;
    const end = Date.now() + duration;

    // Tight loop
    while (true) {
        stmt.get();
        count++;
        // Check time every 1024 ops to reduce overhead
        if ((count & 1023) === 0) {
            if (Date.now() >= end) break;
        }
    }

    parentPort?.postMessage(count);
    db.close();
}
