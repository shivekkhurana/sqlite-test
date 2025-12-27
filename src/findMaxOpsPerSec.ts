import { faker } from "@faker-js/faker";
import Piscina from "piscina";
import { existsSync, unlinkSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WriteResult, WriteTask } from "./workerCore.js";
import type { ReadResult, ReadTask, ReadQueryType } from "./readWorkerCore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

interface ConfigResult {
    totalWorkers: number;
    readWorkers: number;
    writeWorkers: number;
    cacheSizeMB: number;
    readsPerSec: number;
    writesPerSec: number;
    opsPerSec: number;
}

const READ_QUERY_TYPES: ReadQueryType[] = [
    "posts_for_user",
    "posts_in_timeframe",
    "single_post_with_details",
    "users_in_timeframe"
];

const TOTAL_READS = 2000;
const TOTAL_WRITES = 200;
const CACHE_SIZES_MB = [8, 16, 32, 40, 48, 52, 56, 64, 128];
const DEGRADATION_THRESHOLD = 20; // Stop after 20 consecutive degradations

function deleteDatabase(dbPath: string) {
    const filesToDelete = [
        dbPath,
        dbPath + "-wal",
        dbPath + "-shm"
    ];
    
    for (const file of filesToDelete) {
        if (existsSync(file)) {
            try {
                unlinkSync(file);
            } catch (error) {
                // Ignore errors - file might be locked or already deleted
            }
        }
    }
}

function cleanupOptimizeDatabases() {
    const dbDir = join(projectRoot, "db");
    try {
        const files = readdirSync(dbDir);
        for (const file of files) {
            if (file.startsWith("optimize-") && file.endsWith(".db")) {
                const dbPath = join(dbDir, file);
                deleteDatabase(dbPath);
            }
        }
    } catch (error) {
        // Ignore errors - directory might not exist or be inaccessible
    }
}

function saveResult(config: ConfigResult, isBest: boolean = false): string {
    const resultsDir = join(projectRoot, "autoOptimiseResults");
    
    // Ensure directory exists
    if (!existsSync(resultsDir)) {
        mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString();
    const prefix = isBest ? "best-" : "";
    const filename = `${prefix}optimize-r${config.readWorkers}_w${config.writeWorkers}_c${config.cacheSizeMB}mb-${Date.now()}.json`;
    const filePath = join(resultsDir, filename);
    
    const jsonOutput = {
        testName: `optimize-r${config.readWorkers}_w${config.writeWorkers}_c${config.cacheSizeMB}mb`,
        timestamp,
        isBest,
        configuration: {
            totalWorkers: config.totalWorkers,
            readWorkers: config.readWorkers,
            writeWorkers: config.writeWorkers,
            cacheSizeMB: config.cacheSizeMB,
            totalReads: TOTAL_READS,
            totalWrites: TOTAL_WRITES
        },
        results: {
            readsPerSec: config.readsPerSec,
            writesPerSec: config.writesPerSec,
            opsPerSec: config.opsPerSec
        }
    };
    
    writeFileSync(filePath, JSON.stringify(jsonOutput, null, 2));
    return filePath;
}

function generateReadTask(
    dbPath: string,
    userIds: number[],
    postIds: number[],
    cacheSize: number
): ReadTask {
    const queryType = faker.helpers.arrayElement(READ_QUERY_TYPES);
    
    const endDate = faker.date.recent({ days: 30 });
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    switch (queryType) {
        case "posts_for_user":
            return {
                dbPath,
                queryType,
                cacheSize,
                params: {
                    userId: faker.helpers.arrayElement(userIds),
                    offset: faker.number.int({ min: 0, max: 10 }) * 100
                }
            };
        case "posts_in_timeframe":
            return {
                dbPath,
                queryType,
                cacheSize,
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    offset: faker.number.int({ min: 0, max: 5 }) * 100
                }
            };
        case "single_post_with_details":
            return {
                dbPath,
                queryType,
                cacheSize,
                params: {
                    postId: faker.helpers.arrayElement(postIds)
                }
            };
        case "users_in_timeframe":
            return {
                dbPath,
                queryType,
                cacheSize,
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            };
    }
}

function generateWriteTask(
    dbPath: string,
    userIds: number[],
    postIds: number[],
    tagIds: number[],
    cacheSize: number
): WriteTask {
    const writeTypes: Array<"user" | "post" | "tag" | "user_post" | "post_tag"> = [
        "user", "post", "tag", "user_post", "post_tag"
    ];
    const writeType = faker.helpers.arrayElement(writeTypes);
    
    switch (writeType) {
        case "user":
            return {
                dbPath,
                writeType,
                cacheSize,
                data: { userName: faker.person.fullName() }
            };
        case "post":
            return {
                dbPath,
                writeType,
                cacheSize,
                data: { postTitle: faker.lorem.sentence(), postContent: faker.lorem.paragraphs(2) }
            };
        case "tag":
            return {
                dbPath,
                writeType,
                cacheSize,
                data: { tagName: faker.lorem.word() }
            };
        case "user_post":
            return {
                dbPath,
                writeType,
                cacheSize,
                data: {
                    userId: faker.helpers.arrayElement(userIds),
                    postId: faker.helpers.arrayElement(postIds)
                }
            };
        case "post_tag":
            return {
                dbPath,
                writeType,
                cacheSize,
                data: {
                    postId: faker.helpers.arrayElement(postIds),
                    tagId: faker.helpers.arrayElement(tagIds)
                }
            };
    }
}

function calculateReadMetrics(results: ReadResult[], totalDuration: number) {
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.duration).sort((a, b) => a - b);
    
    return {
        successful: successful.length,
        readsPerSec: totalDuration > 0 ? (successful.length / totalDuration) * 1000 : 0
    };
}

function calculateWriteMetrics(results: WriteResult[], totalDuration: number) {
    const successful = results.filter(r => r.success);
    
    return {
        successful: successful.length,
        writesPerSec: totalDuration > 0 ? (successful.length / totalDuration) * 1000 : 0
    };
}

function calculateWorkers(totalWorkers: number): { readWorkers: number; writeWorkers: number } {
    const readWorkers = Math.max(1, Math.round(totalWorkers * 0.8));
    const writeWorkers = Math.max(1, totalWorkers - readWorkers);
    return { readWorkers, writeWorkers };
}

async function runBenchmark(
    readWorkers: number,
    writeWorkers: number,
    cacheSizeKB: number
): Promise<{ readsPerSec: number; writesPerSec: number; opsPerSec: number }> {
    const dbPath = join(projectRoot, "db", `optimize-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    const setupPath = join(projectRoot, "scenarios", "mixedReadWrite", "setup.ts");
    
    const readsPerWorker = Math.ceil(TOTAL_READS / readWorkers);
    const writesPerWorker = Math.ceil(TOTAL_WRITES / writeWorkers);
    
    // Clean up any existing database
    deleteDatabase(dbPath);
    
    // Setup database
    console.log("Setting up database...");
    const { setup } = await import(setupPath);
    const { userIds, postIds, tagIds } = setup(dbPath) as { userIds: number[]; postIds: number[]; tagIds: number[] };
    console.log(`Setup complete. Got ${userIds.length} userIds, ${postIds.length} postIds, ${tagIds.length} tagIds`);
    
    // Create worker pools
    console.log(`Creating ${readWorkers} read worker pools and ${writeWorkers} write worker pools...`);
    const readPools: Piscina[] = [];
    for (let i = 0; i < readWorkers; i++) {
        readPools.push(new Piscina({
            filename: join(projectRoot, "scenarios", "mixedReadWrite", "readWorker.ts"),
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    
    const writePools: Piscina[] = [];
    for (let i = 0; i < writeWorkers; i++) {
        writePools.push(new Piscina({
            filename: join(projectRoot, "scenarios", "mixedReadWrite", "writeWorker.ts"),
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    console.log("Worker pools created.");
    
    let allReadResults: ReadResult[] = [];
    let allWriteResults: WriteResult[] = [];
    
    const startTime = performance.now();
    
    try {
        // Create read promises
        console.log(`Generating ${TOTAL_READS} read tasks (${readsPerWorker} per worker)...`);
        const readPromises: Promise<ReadResult>[] = [];
        let readTasksGenerated = 0;
        for (let w = 0; w < readWorkers; w++) {
            const pool = readPools[w]!;
            for (let i = 0; i < readsPerWorker; i++) {
                const task = generateReadTask(dbPath, userIds, postIds, cacheSizeKB);
                readPromises.push(
                    pool.run(task).catch((error): ReadResult => ({
                        success: false,
                        duration: 0,
                        rowCount: 0,
                        queryType: task.queryType,
                        error: String(error),
                        errorCode: "WORKER_ERROR"
                    }))
                );
                readTasksGenerated++;
                if (readTasksGenerated % 50000 === 0) {
                    console.log(`  Generated ${readTasksGenerated}/${TOTAL_READS} read tasks...`);
                }
            }
        }
        console.log(`All ${readTasksGenerated} read tasks generated and queued.`);
        
        // Create write promises
        console.log(`Generating ${TOTAL_WRITES} write tasks (${writesPerWorker} per worker)...`);
        const writePromises: Promise<WriteResult>[] = [];
        let writeTasksGenerated = 0;
        for (let w = 0; w < writeWorkers; w++) {
            const pool = writePools[w]!;
            for (let i = 0; i < writesPerWorker; i++) {
                const task = generateWriteTask(dbPath, userIds, postIds, tagIds, cacheSizeKB);
                writePromises.push(
                    pool.run(task).catch((error): WriteResult => ({
                        success: false,
                        duration: 0,
                        error: String(error),
                        errorCode: "WORKER_ERROR"
                    }))
                );
                writeTasksGenerated++;
                if (writeTasksGenerated % 5000 === 0) {
                    console.log(`  Generated ${writeTasksGenerated}/${TOTAL_WRITES} write tasks...`);
                }
            }
        }
        console.log(`All ${writeTasksGenerated} write tasks generated and queued.`);
        
        // Wait for all operations
        console.log(`Executing ${readPromises.length} read tasks and ${writePromises.length} write tasks...`);
        const executionStartTime = performance.now();
        
        // Track progress
        let completedReads = 0;
        let completedWrites = 0;
        const progressInterval = setInterval(() => {
            const elapsed = ((performance.now() - executionStartTime) / 1000).toFixed(1);
            console.log(`  [${elapsed}s] Progress: ${completedReads.toLocaleString()}/${readPromises.length.toLocaleString()} reads, ${completedWrites.toLocaleString()}/${writePromises.length.toLocaleString()} writes`);
        }, 5000);
        
        // Wrap promises to track completion
        const trackedReadPromises = readPromises.map(p => p.then(r => { completedReads++; return r; }));
        const trackedWritePromises = writePromises.map(p => p.then(r => { completedWrites++; return r; }));
        
        const [readResults, writeResults] = await Promise.all([
            Promise.all(trackedReadPromises),
            Promise.all(trackedWritePromises)
        ]);
        
        clearInterval(progressInterval);
        console.log(`All tasks completed. Processing results...`);
        
        allReadResults = readResults;
        allWriteResults = writeResults;
        
    } finally {
        console.log("Cleaning up worker pools...");
        // Destroy all pools and wait for them to fully close
        await Promise.all([
            ...readPools.map(p => p.destroy()),
            ...writePools.map(p => p.destroy())
        ]);
        console.log("Worker pools destroyed.");
        
        // Give SQLite time to fully close all connections and release file handles
        // This prevents "database is locked" errors and resource leaks
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Retry database deletion in case files are still locked
        let retries = 10;
        while (retries > 0) {
            try {
                deleteDatabase(dbPath);
                // Verify deletion succeeded
                if (!existsSync(dbPath) && !existsSync(dbPath + "-wal") && !existsSync(dbPath + "-shm")) {
                    break;
                }
            } catch (error) {
                // Continue retrying
            }
            retries--;
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        if (existsSync(dbPath) || existsSync(dbPath + "-wal") || existsSync(dbPath + "-shm")) {
            console.warn(`Warning: Could not fully delete database at ${dbPath}`);
        } else {
            console.log("Database cleanup complete.");
        }
    }
    
    const totalDuration = performance.now() - startTime;
    console.log(`Benchmark completed in ${(totalDuration / 1000).toFixed(2)}s`);
    
    // Calculate metrics
    console.log("Calculating metrics...");
    const readMetrics = calculateReadMetrics(allReadResults, totalDuration);
    const writeMetrics = calculateWriteMetrics(allWriteResults, totalDuration);
    
    const opsPerSec = readMetrics.readsPerSec + writeMetrics.writesPerSec;
    
    console.log(`Metrics: ${readMetrics.successful}/${TOTAL_READS} reads successful, ${writeMetrics.successful}/${TOTAL_WRITES} writes successful`);
    
    return {
        readsPerSec: readMetrics.readsPerSec,
        writesPerSec: writeMetrics.writesPerSec,
        opsPerSec
    };
}

async function findMaxOpsPerSec(): Promise<ConfigResult> {
    let bestConfig: ConfigResult | null = null;
    let bestOpsPerSec = 0;
    
    // Clean up any leftover optimize databases from previous runs
    console.log("Cleaning up any leftover optimize databases...");
    cleanupOptimizeDatabases();
    
    console.log("Starting optimization...");
    console.log(`Testing cache sizes: ${CACHE_SIZES_MB.join(", ")} MB`);
    console.log(`Workload: ${TOTAL_READS.toLocaleString()} reads, ${TOTAL_WRITES.toLocaleString()} writes`);
    console.log(`Worker ratio: 80% readers, 20% writers`);
    console.log(`Stopping worker count testing after ${DEGRADATION_THRESHOLD} consecutive degradations per cache size\n`);
    
    for (const cacheSizeMB of CACHE_SIZES_MB) {
        const cacheSizeKB = -cacheSizeMB * 1000; // Negative value for SQLite
        console.log(`\n=== Testing Cache Size: ${cacheSizeMB} MB ===`);
        
        let totalWorkers = 2; // Start with 2 workers (minimum: 1 reader, 1 writer)
        let consecutiveDegradations = 0; // Reset degradation counter for each cache size
        
        // Continue testing worker counts for this cache size until we hit degradation threshold
        while (consecutiveDegradations < DEGRADATION_THRESHOLD) {
            const { readWorkers, writeWorkers } = calculateWorkers(totalWorkers);
            
            console.log(`Testing ${totalWorkers} total workers (${readWorkers} readers, ${writeWorkers} writers)...`);
            
            try {
                const metrics = await runBenchmark(readWorkers, writeWorkers, cacheSizeKB);
                
                const currentConfig: ConfigResult = {
                    totalWorkers,
                    readWorkers,
                    writeWorkers,
                    cacheSizeMB,
                    readsPerSec: metrics.readsPerSec,
                    writesPerSec: metrics.writesPerSec,
                    opsPerSec: metrics.opsPerSec
                };
                
                console.log(`  Result: ${metrics.opsPerSec.toFixed(0)} ops/sec (${metrics.readsPerSec.toFixed(0)} reads/sec, ${metrics.writesPerSec.toFixed(0)} writes/sec)`);
                
                // Save every result
                const savedPath = saveResult(currentConfig, false);
                console.log(`  Saved result to: ${savedPath}`);
                
                if (metrics.opsPerSec > bestOpsPerSec) {
                    bestOpsPerSec = metrics.opsPerSec;
                    bestConfig = currentConfig;
                    consecutiveDegradations = 0;
                    console.log(`  ✓ New best! (global best: ${bestOpsPerSec.toFixed(0)} ops/sec)`);
                } else {
                    consecutiveDegradations++;
                    console.log(`  Degradation ${consecutiveDegradations}/${DEGRADATION_THRESHOLD} for this cache size (global best: ${bestOpsPerSec.toFixed(0)} ops/sec)`);
                    
                    if (consecutiveDegradations >= DEGRADATION_THRESHOLD) {
                        console.log(`\nStopped worker count testing for cache size ${cacheSizeMB} MB after ${DEGRADATION_THRESHOLD} consecutive degradations.`);
                        break;
                    }
                }
                
                totalWorkers++;
                
                // Small delay to allow system resources to fully clean up
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`  Error running benchmark: ${error}`);
                consecutiveDegradations++;
                totalWorkers++;
                
                // Small delay even on error to allow cleanup
                await new Promise(resolve => setTimeout(resolve, 200));
                
                if (consecutiveDegradations >= DEGRADATION_THRESHOLD) {
                    console.log(`\nStopped worker count testing for cache size ${cacheSizeMB} MB after ${DEGRADATION_THRESHOLD} consecutive degradations (including errors).`);
                    break;
                }
            }
        }
        
        // Continue to next cache size regardless of degradations
        console.log(`Moving to next cache size...`);
        
        // Clean up any leftover databases before moving to next cache size
        cleanupOptimizeDatabases();
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\nCompleted testing all cache sizes.`);
    
    if (!bestConfig) {
        throw new Error("No valid configuration found");
    }
    
    return bestConfig;
}

// Run the optimization
findMaxOpsPerSec()
    .then((result) => {
        console.log("\n" + "=".repeat(60));
        console.log("BEST CONFIGURATION FOUND:");
        console.log("=".repeat(60));
        console.log(`Total Workers: ${result.totalWorkers}`);
        console.log(`  - Read Workers: ${result.readWorkers}`);
        console.log(`  - Write Workers: ${result.writeWorkers}`);
        console.log(`Cache Size: ${result.cacheSizeMB} MB`);
        console.log(`Reads/sec: ${result.readsPerSec.toFixed(0)}`);
        console.log(`Writes/sec: ${result.writesPerSec.toFixed(0)}`);
        console.log(`Total Ops/sec: ${result.opsPerSec.toFixed(0)}`);
        console.log("=".repeat(60));
        
        // Output in the requested format
        console.log(`\n${result.totalWorkers}, ${result.readsPerSec.toFixed(0)}, ${result.writesPerSec.toFixed(0)}`);
        
        // Save best result (marked as best)
        const bestPath = saveResult(result, true);
        console.log(`\nBest result saved to: ${bestPath}`);
        
        // Final cleanup of any remaining optimize databases
        cleanupOptimizeDatabases();
    })
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });

