import { faker } from "@faker-js/faker";
import Piscina from "piscina";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WriteResult } from "./workerCore.js";
import type { ReadResult, ReadQueryType } from "./readWorkerCore.js";
import type { PostgresReadTask, PostgresWriteTask } from "./postgresWorkerCore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

interface ConfigResult {
    totalWorkers: number;
    readWorkers: number;
    writeWorkers: number;
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
const DEGRADATION_THRESHOLD = 20; // Stop after 20 consecutive degradations

function generateReadTask(
    connectionString: string,
    userIds: number[],
    postIds: number[]
): PostgresReadTask {
    const queryType = faker.helpers.arrayElement(READ_QUERY_TYPES);
    
    const endDate = faker.date.recent({ days: 30 });
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    switch (queryType) {
        case "posts_for_user":
            return {
                connectionString,
                queryType,
                params: {
                    userId: faker.helpers.arrayElement(userIds),
                    offset: faker.number.int({ min: 0, max: 10 }) * 100
                }
            };
        case "posts_in_timeframe":
            return {
                connectionString,
                queryType,
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    offset: faker.number.int({ min: 0, max: 5 }) * 100
                }
            };
        case "single_post_with_details":
            return {
                connectionString,
                queryType,
                params: {
                    postId: faker.helpers.arrayElement(postIds)
                }
            };
        case "users_in_timeframe":
            return {
                connectionString,
                queryType,
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            };
    }
}

function generateWriteTask(
    connectionString: string,
    userIds: number[],
    postIds: number[],
    tagIds: number[]
): PostgresWriteTask {
    const writeTypes: Array<"user" | "post" | "tag" | "user_post" | "post_tag"> = [
        "user", "post", "tag", "user_post", "post_tag"
    ];
    const writeType = faker.helpers.arrayElement(writeTypes);
    
    switch (writeType) {
        case "user":
            return {
                connectionString,
                writeType,
                data: { userName: faker.person.fullName() }
            };
        case "post":
            return {
                connectionString,
                writeType,
                data: { postTitle: faker.lorem.sentence(), postContent: faker.lorem.paragraphs(2) }
            };
        case "tag":
            return {
                connectionString,
                writeType,
                data: { tagName: faker.lorem.word() }
            };
        case "user_post":
            return {
                connectionString,
                writeType,
                data: {
                    userId: faker.helpers.arrayElement(userIds),
                    postId: faker.helpers.arrayElement(postIds)
                }
            };
        case "post_tag":
            return {
                connectionString,
                writeType,
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
    connectionString: string,
    readWorkers: number,
    writeWorkers: number
): Promise<{ readsPerSec: number; writesPerSec: number; opsPerSec: number }> {
    const setupPath = join(projectRoot, "scenarios", "postgresReadWrite", "setup.ts");
    
    const readsPerWorker = Math.ceil(TOTAL_READS / readWorkers);
    const writesPerWorker = Math.ceil(TOTAL_WRITES / writeWorkers);
    
    // Setup database
    const { setup } = await import(setupPath);
    const { userIds, postIds, tagIds } = await setup(connectionString);
    
    console.log("Creating worker pools...");
    // Create worker pools
    const readPools: Piscina[] = [];
    for (let i = 0; i < readWorkers; i++) {
        readPools.push(new Piscina({
            filename: join(projectRoot, "scenarios", "postgresReadWrite", "readWorker.ts"),
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    
    const writePools: Piscina[] = [];
    for (let i = 0; i < writeWorkers; i++) {
        writePools.push(new Piscina({
            filename: join(projectRoot, "scenarios", "postgresReadWrite", "writeWorker.ts"),
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    console.log(`Created ${readWorkers} read pools and ${writeWorkers} write pools`);
    
    // Test a single task to verify workers are working
    console.log("Testing a single read task...");
    try {
        const testTask = generateReadTask(connectionString, userIds, postIds);
        const testResult = await readPools[0]!.run(testTask);
        console.log(`Test task completed: ${testResult.success ? 'success' : 'failed'}`);
    } catch (error) {
        console.error(`Test task failed: ${error}`);
        throw error;
    }
    
    let allReadResults: ReadResult[] = [];
    let allWriteResults: WriteResult[] = [];
    
    const startTime = performance.now();
    
    try {
        console.log(`Generating and executing ${TOTAL_READS} read tasks and ${TOTAL_WRITES} write tasks...`);
        
        // Progress tracking
        let completedReads = 0;
        let completedWrites = 0;
        const totalReads = TOTAL_READS;
        const totalWrites = TOTAL_WRITES;
        
        const progressInterval = setInterval(() => {
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            console.log(`  [${elapsed}s] Reads: ${completedReads.toLocaleString()}/${totalReads.toLocaleString()}, Writes: ${completedWrites.toLocaleString()}/${totalWrites.toLocaleString()}`);
        }, 5000);
        
        // Process reads and writes concurrently
        const readPromises: Promise<ReadResult>[] = [];
        const writePromises: Promise<WriteResult>[] = [];
        
        // Create read tasks and execute them
        for (let w = 0; w < readWorkers; w++) {
            const pool = readPools[w]!;
            for (let i = 0; i < readsPerWorker; i++) {
                const task = generateReadTask(connectionString, userIds, postIds);
                readPromises.push(
                    pool.run(task)
                        .then(r => { completedReads++; return r; })
                        .catch((error): ReadResult => ({
                            success: false,
                            duration: 0,
                            rowCount: 0,
                            queryType: task.queryType,
                            error: String(error),
                            errorCode: "WORKER_ERROR"
                        }))
                );
            }
        }
        
        // Create write tasks and execute them
        for (let w = 0; w < writeWorkers; w++) {
            const pool = writePools[w]!;
            for (let i = 0; i < writesPerWorker; i++) {
                const task = generateWriteTask(connectionString, userIds, postIds, tagIds);
                writePromises.push(
                    pool.run(task)
                        .then(r => { completedWrites++; return r; })
                        .catch((error): WriteResult => ({
                            success: false,
                            duration: 0,
                            error: String(error),
                            errorCode: "WORKER_ERROR"
                        }))
                );
            }
        }
        
        console.log(`Queued ${readPromises.length} read tasks and ${writePromises.length} write tasks`);
        
        // Wait for all operations
        const [readResults, writeResults] = await Promise.all([
            Promise.all(readPromises),
            Promise.all(writePromises)
        ]);
        
        clearInterval(progressInterval);
        console.log("All tasks completed");
        
        allReadResults = readResults;
        allWriteResults = writeResults;
        
    } finally {
        // Destroy all pools
        await Promise.all([
            ...readPools.map(p => p.destroy()),
            ...writePools.map(p => p.destroy())
        ]);
    }
    
    const totalDuration = performance.now() - startTime;
    
    // Calculate metrics
    const readMetrics = calculateReadMetrics(allReadResults, totalDuration);
    const writeMetrics = calculateWriteMetrics(allWriteResults, totalDuration);
    
    const opsPerSec = readMetrics.readsPerSec + writeMetrics.writesPerSec;
    
    return {
        readsPerSec: readMetrics.readsPerSec,
        writesPerSec: writeMetrics.writesPerSec,
        opsPerSec
    };
}

async function findMaxOpsPerSec(connectionString: string): Promise<ConfigResult> {
    let bestConfig: ConfigResult | null = null;
    let bestOpsPerSec = 0;
    
    console.log("Starting PostgreSQL optimization...");
    console.log(`Connection: ${connectionString}`);
    console.log(`Workload: ${TOTAL_READS.toLocaleString()} reads, ${TOTAL_WRITES.toLocaleString()} writes`);
    console.log(`Worker ratio: 80% readers, 20% writers`);
    console.log(`Stopping worker count testing after ${DEGRADATION_THRESHOLD} consecutive degradations\n`);
    
    let totalWorkers = 2; // Start with 2 workers (minimum: 1 reader, 1 writer)
    let consecutiveDegradations = 0;
    
    // Continue testing worker counts until we hit degradation threshold
    while (consecutiveDegradations < DEGRADATION_THRESHOLD) {
        const { readWorkers, writeWorkers } = calculateWorkers(totalWorkers);
        
        console.log(`Testing ${totalWorkers} total workers (${readWorkers} readers, ${writeWorkers} writers)...`);
        
        try {
            const metrics = await runBenchmark(connectionString, readWorkers, writeWorkers);
            
            const currentConfig: ConfigResult = {
                totalWorkers,
                readWorkers,
                writeWorkers,
                readsPerSec: metrics.readsPerSec,
                writesPerSec: metrics.writesPerSec,
                opsPerSec: metrics.opsPerSec
            };
            
            console.log(`  Result: ${metrics.opsPerSec.toFixed(0)} ops/sec (${metrics.readsPerSec.toFixed(0)} reads/sec, ${metrics.writesPerSec.toFixed(0)} writes/sec)`);
            
            if (metrics.opsPerSec > bestOpsPerSec) {
                bestOpsPerSec = metrics.opsPerSec;
                bestConfig = currentConfig;
                consecutiveDegradations = 0;
                console.log(`  ✓ New best! (global best: ${bestOpsPerSec.toFixed(0)} ops/sec)`);
            } else {
                consecutiveDegradations++;
                console.log(`  Degradation ${consecutiveDegradations}/${DEGRADATION_THRESHOLD} (global best: ${bestOpsPerSec.toFixed(0)} ops/sec)`);
                
                if (consecutiveDegradations >= DEGRADATION_THRESHOLD) {
                    console.log(`\nStopped worker count testing after ${DEGRADATION_THRESHOLD} consecutive degradations.`);
                    break;
                }
            }
            
            totalWorkers++;
            
        } catch (error) {
            console.error(`  Error running benchmark: ${error}`);
            consecutiveDegradations++;
            totalWorkers++;
            
            if (consecutiveDegradations >= DEGRADATION_THRESHOLD) {
                console.log(`\nStopped worker count testing after ${DEGRADATION_THRESHOLD} consecutive degradations (including errors).`);
                break;
            }
        }
    }
    
    console.log(`\nCompleted testing worker counts.`);
    
    if (!bestConfig) {
        throw new Error("No valid configuration found");
    }
    
    return bestConfig;
}

// Get connection string from command line arguments
const connectionString = process.argv[2];

if (!connectionString) {
    console.error("Error: Connection string required");
    console.error("Usage: tsx src/findMaxOpsPerSecPostgres.ts <connection_string>");
    console.error("Example: tsx src/findMaxOpsPerSecPostgres.ts 'postgresql://user:password@localhost:5432/dbname'");
    process.exit(1);
}

// Run the optimization
findMaxOpsPerSec(connectionString)
    .then((result) => {
        console.log("\n" + "=".repeat(60));
        console.log("BEST CONFIGURATION FOUND:");
        console.log("=".repeat(60));
        console.log(`Total Workers: ${result.totalWorkers}`);
        console.log(`  - Read Workers: ${result.readWorkers}`);
        console.log(`  - Write Workers: ${result.writeWorkers}`);
        console.log(`Reads/sec: ${result.readsPerSec.toFixed(0)}`);
        console.log(`Writes/sec: ${result.writesPerSec.toFixed(0)}`);
        console.log(`Total Ops/sec: ${result.opsPerSec.toFixed(0)}`);
        console.log("=".repeat(60));
        
        // Output in the requested format
        console.log(`\n${result.totalWorkers}, ${result.readsPerSec.toFixed(0)}, ${result.writesPerSec.toFixed(0)}`);
    })
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });

