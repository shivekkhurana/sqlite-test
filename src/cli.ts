import { Command } from "commander";
import { faker } from "@faker-js/faker";
import Piscina from "piscina";
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WriteResult, WriteTask } from "./workerCore.js";
import type { ReadResult, ReadTask, ReadQueryType } from "./readWorkerCore.js";
import { generateReport as generateReportFromResults } from "./reportGenerator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const program = new Command();
program.version("0.0.1");

// Test configuration
const USER_COUNT = 10000;
const POST_COUNT = 40000;
const TAG_COUNT = 10000;
const USER_POST_COUNT = 30000;
const POST_TAG_COUNT = 10000;
const TOTAL_WRITES = USER_COUNT + POST_COUNT + TAG_COUNT + USER_POST_COUNT + POST_TAG_COUNT;
const CONCURRENCY_LEVELS = [1, 2, 4, 8, 16, 32, 64, 128];

// Scenario configuration
interface ScenarioConfig {
    name: string;
    dbPath: string;
    resultFile: string;
    reportFile: string;
    setupPath: string;
    workerPath: string;
}

const SCENARIOS: Record<string, ScenarioConfig> = {
    base0: {
        name: "base0",
        dbPath: join(projectRoot, "db", "base-0.db"),
        resultFile: "base-0.json",
        reportFile: "base-0-report.md",
        setupPath: join(projectRoot, "scenarios", "base0", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "base0", "worker.ts")
    },
    busyTimeout1: {
        name: "busyTimeout1",
        dbPath: join(projectRoot, "db", "busy-timeout-1.db"),
        resultFile: "busy-timeout-1.json",
        reportFile: "busy-timeout-1-report.md",
        setupPath: join(projectRoot, "scenarios", "busyTimeout1", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "busyTimeout1", "worker.ts")
    },
    busyTimeout2000: {
        name: "busyTimeout2000",
        dbPath: join(projectRoot, "db", "busy-timeout-2000.db"),
        resultFile: "busy-timeout-2000.json",
        reportFile: "busy-timeout-2000-report.md",
        setupPath: join(projectRoot, "scenarios", "busyTimeout2000", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "busyTimeout2000", "worker.ts")
    },
    busyTimeout400: {
        name: "busyTimeout400",
        dbPath: join(projectRoot, "db", "busy-timeout-400.db"),
        resultFile: "busy-timeout-400.json",
        reportFile: "busy-timeout-400-report.md",
        setupPath: join(projectRoot, "scenarios", "busyTimeout400", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "busyTimeout400", "worker.ts")
    },
    wal: {
        name: "wal",
        dbPath: join(projectRoot, "db", "wal.db"),
        resultFile: "wal.json",
        reportFile: "wal-report.md",
        setupPath: join(projectRoot, "scenarios", "wal", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "wal", "worker.ts")
    },
    walSyncNormal: {
        name: "walSyncNormal",
        dbPath: join(projectRoot, "db", "wal-sync-normal.db"),
        resultFile: "wal-sync-normal.json",
        reportFile: "wal-sync-normal-report.md",
        setupPath: join(projectRoot, "scenarios", "walSyncNormal", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "walSyncNormal", "worker.ts")
    },
    walSyncNormalAutocheckpoint2000: {
        name: "walSyncNormalAutocheckpoint2000",
        dbPath: join(projectRoot, "db", "wal-sync-normal-autocheckpoint-2000.db"),
        resultFile: "wal-sync-normal-autocheckpoint-2000.json",
        reportFile: "wal-sync-normal-autocheckpoint-2000-report.md",
        setupPath: join(projectRoot, "scenarios", "walSyncNormalAutocheckpoint2000", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "walSyncNormalAutocheckpoint2000", "worker.ts")
    },
    walSyncNormalAutocheckpoint4000: {
        name: "walSyncNormalAutocheckpoint4000",
        dbPath: join(projectRoot, "db", "wal-sync-normal-autocheckpoint-4000.db"),
        resultFile: "wal-sync-normal-autocheckpoint-4000.json",
        reportFile: "wal-sync-normal-autocheckpoint-4000-report.md",
        setupPath: join(projectRoot, "scenarios", "walSyncNormalAutocheckpoint4000", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "walSyncNormalAutocheckpoint4000", "worker.ts")
    },
    walSyncNormalBusyTimeout5000: {
        name: "walSyncNormalBusyTimeout5000",
        dbPath: join(projectRoot, "db", "wal-sync-normal-busy-timeout-5000.db"),
        resultFile: "wal-sync-normal-busy-timeout-5000.json",
        reportFile: "wal-sync-normal-busy-timeout-5000-report.md",
        setupPath: join(projectRoot, "scenarios", "walSyncNormalBusyTimeout5000", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "walSyncNormalBusyTimeout5000", "worker.ts")
    },
    mixedReadWrite: {
        name: "mixedReadWrite",
        dbPath: join(projectRoot, "db", "mixed-read-write.db"),
        resultFile: "mixed-read-write.json",
        reportFile: "mixed-read-write-report.md",
        setupPath: join(projectRoot, "scenarios", "mixedReadWrite", "setup.ts"),
        workerPath: join(projectRoot, "scenarios", "mixedReadWrite", "writeWorker.ts")
    }
};

function generateReport(config: ScenarioConfig): void {
    generateReportFromResults({
        resultsPath: join(projectRoot, "results", config.resultFile),
        outputPath: join(projectRoot, "reports", config.reportFile),
        scenarioName: config.name
    });
}

function deleteDatabase(dbPath: string) {
    if (existsSync(dbPath)) {
        unlinkSync(dbPath);
    }
}

function calculateMetrics(results: WriteResult[], totalDuration: number) {
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.duration).sort((a, b) => a - b);
    const errors = results.filter(r => !r.success);
    const lockErrors = errors.filter(r => r.errorCode === "SQLITE_LOCK");
    
    return {
        total: results.length,
        successful: successful.length,
        errors: errors.length,
        lockErrors: lockErrors.length,
        successRate: (successful.length / TOTAL_WRITES) * 100,
        avgTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        p95: durations[Math.floor(durations.length * 0.95)] ?? 0,
        p99: durations[Math.floor(durations.length * 0.99)] ?? 0,
        writesPerSec: totalDuration > 0 ? (successful.length / totalDuration) * 1000 : 0,
        totalDuration
    };
}

// N pools, each with 1 thread = N truly concurrent writers
async function runConcurrentWrites(
    tasks: WriteTask[], 
    pools: Piscina[]
): Promise<{ results: WriteResult[]; insertedIds: number[] }> {
    if (tasks.length === 0) return { results: [], insertedIds: [] };
    
    const concurrency = pools.length;
    const results: WriteResult[] = [];
    const insertedIds: number[] = [];
    
    // Process in batches of N (one task per pool, all fire simultaneously)
    for (let i = 0; i < tasks.length; i += concurrency) {
        const batch = tasks.slice(i, i + concurrency);
        
        // Fire one task to each pool simultaneously
        const promises = batch.map((task, idx) => {
            const pool = pools[idx % pools.length]!;
            return pool.run(task).catch((error): WriteResult => ({
                success: false,
                duration: 0,
                error: String(error),
                errorCode: "WORKER_ERROR"
            }));
        });
        
        const batchResults = await Promise.all(promises);
        
        for (const r of batchResults) {
            results.push(r);
            if (r.success && r.insertedId !== undefined) {
                insertedIds.push(r.insertedId);
            }
        }
    }
    
    return { results, insertedIds };
}

async function runTest(concurrency: number, config: ScenarioConfig) {
    console.log(`\n=== Concurrency ${concurrency} ===`);
    deleteDatabase(config.dbPath);
    
    // Run scenario setup
    const { setup } = await import(config.setupPath);
    setup(config.dbPath);
    
    // Create N pools, each with exactly 1 thread
    // This ensures N truly concurrent workers hitting the DB
    const pools: Piscina[] = [];
    for (let i = 0; i < concurrency; i++) {
        pools.push(new Piscina({
            filename: config.workerPath,
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    
    const allResults: WriteResult[] = [];
    const startTime = performance.now();
    
    try {
        // Users
        const userTasks: WriteTask[] = Array.from({ length: USER_COUNT }, () => ({
            dbPath: config.dbPath,
            writeType: "user" as const,
            data: { userName: faker.person.fullName() }
        }));
        const { results: userResults, insertedIds: userIds } = await runConcurrentWrites(userTasks, pools);
        allResults.push(...userResults);
        console.log(`  Users: ${userIds.length}/${USER_COUNT}`);
        
        // Tags
        const tagTasks: WriteTask[] = Array.from({ length: TAG_COUNT }, () => ({
            dbPath: config.dbPath,
            writeType: "tag" as const,
            data: { tagName: faker.lorem.word() }
        }));
        const { results: tagResults, insertedIds: tagIds } = await runConcurrentWrites(tagTasks, pools);
        allResults.push(...tagResults);
        console.log(`  Tags: ${tagIds.length}/${TAG_COUNT}`);
        
        // Posts
        const postTasks: WriteTask[] = Array.from({ length: POST_COUNT }, () => ({
            dbPath: config.dbPath,
            writeType: "post" as const,
            data: { postTitle: faker.lorem.sentence(), postContent: faker.lorem.paragraphs(2) }
        }));
        const { results: postResults, insertedIds: postIds } = await runConcurrentWrites(postTasks, pools);
        allResults.push(...postResults);
        console.log(`  Posts: ${postIds.length}/${POST_COUNT}`);
        
        // User-Posts
        if (userIds.length > 0 && postIds.length > 0) {
            const userPostTasks: WriteTask[] = Array.from({ length: USER_POST_COUNT }, () => ({
                dbPath: config.dbPath,
                writeType: "user_post" as const,
                data: { 
                    userId: faker.helpers.arrayElement(userIds), 
                    postId: faker.helpers.arrayElement(postIds) 
                }
            }));
            const { results: upResults } = await runConcurrentWrites(userPostTasks, pools);
            allResults.push(...upResults);
            console.log(`  User-Posts: ${upResults.filter(r => r.success).length}/${USER_POST_COUNT}`);
        } else {
            console.log(`  User-Posts: skipped (no users/posts)`);
        }
        
        // Post-Tags
        if (postIds.length > 0 && tagIds.length > 0) {
            const postTagTasks: WriteTask[] = Array.from({ length: POST_TAG_COUNT }, () => ({
                dbPath: config.dbPath,
                writeType: "post_tag" as const,
                data: { 
                    postId: faker.helpers.arrayElement(postIds), 
                    tagId: faker.helpers.arrayElement(tagIds) 
                }
            }));
            const { results: ptResults } = await runConcurrentWrites(postTagTasks, pools);
            allResults.push(...ptResults);
            console.log(`  Post-Tags: ${ptResults.filter(r => r.success).length}/${POST_TAG_COUNT}`);
        } else {
            console.log(`  Post-Tags: skipped (no posts/tags)`);
        }
    } finally {
        // Destroy all pools
        await Promise.all(pools.map(p => p.destroy()));
    }
    
    const totalDuration = performance.now() - startTime;
    const metrics = calculateMetrics(allResults, totalDuration);
    
    console.log(`  Duration: ${(metrics.totalDuration / 1000).toFixed(2)}s`);
    console.log(`  Success: ${metrics.successRate.toFixed(1)}%`);
    console.log(`  Writes/sec: ${metrics.writesPerSec.toFixed(0)}`);
    console.log(`  Avg: ${metrics.avgTime.toFixed(2)}ms, P95: ${metrics.p95.toFixed(2)}ms, P99: ${metrics.p99.toFixed(2)}ms`);
    console.log(`  Errors: ${metrics.errors} (locks: ${metrics.lockErrors})`);
    
    return { concurrency, metrics };
}

async function runScenario(config: ScenarioConfig) {
    console.log(`${config.name} Concurrent Writes Test`);
    console.log(`Total writes per test: ${TOTAL_WRITES}`);
    console.log("N pools x 1 thread each = N simultaneous DB writers");
    
    const results: { concurrency: number; metrics: ReturnType<typeof calculateMetrics> }[] = [];
    
    const saveResults = () => {
        mkdirSync(join(projectRoot, "results"), { recursive: true });
        writeFileSync(
            join(projectRoot, "results", config.resultFile),
            JSON.stringify({
                testName: `${config.name}ConcurrentWrites`,
                timestamp: new Date().toISOString(),
                configurations: results.map(r => ({
                    concurrency: r.concurrency,
                    totalWrites: TOTAL_WRITES,
                    metrics: r.metrics
                }))
            }, null, 2)
        );
    };
    
    for (const concurrency of CONCURRENCY_LEVELS) {
        try {
            const result = await runTest(concurrency, config);
            results.push(result);
            saveResults();
        } catch (error) {
            console.error(`  Error: ${error}`);
            results.push({
                concurrency,
                metrics: {
                    total: 0,
                    successful: 0,
                    errors: TOTAL_WRITES,
                    lockErrors: 0,
                    successRate: 0,
                    avgTime: 0,
                    p95: 0,
                    p99: 0,
                    writesPerSec: 0,
                    totalDuration: 0
                }
            });
            saveResults();
        }
    }
    
    console.log("\n=== Done ===");
    console.log(`Results saved to results/${config.resultFile}`);
}

// CLI Commands
program.command("base0")
    .description("Run base-0 concurrent writes test (SQLite defaults, no busy timeout)")
    .action(async () => {
        await runScenario(SCENARIOS.base0!);
    });

program.command("busyTimeout1")
    .description("Run busy-timeout-1 concurrent writes test (PRAGMA busy_timeout = 5000ms)")
    .action(async () => {
        await runScenario(SCENARIOS.busyTimeout1!);
    });

program.command("busyTimeout2000")
    .description("Run busy-timeout-2000 concurrent writes test (PRAGMA busy_timeout = 2000ms)")
    .action(async () => {
        await runScenario(SCENARIOS.busyTimeout2000!);
    });

program.command("busyTimeout400")
    .description("Run busy-timeout-400 concurrent writes test (PRAGMA busy_timeout = 400ms)")
    .action(async () => {
        await runScenario(SCENARIOS.busyTimeout400!);
    });

program.command("wal")
    .description("Run WAL concurrent writes test (journal_mode = WAL, busy_timeout = 2000ms)")
    .action(async () => {
        await runScenario(SCENARIOS.wal!);
    });

program.command("walSyncNormal")
    .description("Run WAL + sync NORMAL test (journal_mode = WAL, synchronous = NORMAL, busy_timeout = 2000ms)")
    .action(async () => {
        await runScenario(SCENARIOS.walSyncNormal!);
    });

program.command("walSyncNormalAutocheckpoint2000")
    .description("Run WAL + sync NORMAL + autocheckpoint 2000 test")
    .action(async () => {
        await runScenario(SCENARIOS.walSyncNormalAutocheckpoint2000!);
    });

program.command("walSyncNormalAutocheckpoint4000")
    .description("Run WAL + sync NORMAL + autocheckpoint 4000 test")
    .action(async () => {
        await runScenario(SCENARIOS.walSyncNormalAutocheckpoint4000!);
    });

program.command("walSyncNormalBusyTimeout5000")
    .description("Run WAL + sync NORMAL + autocheckpoint 4000 + busy_timeout 5000 test")
    .action(async () => {
        await runScenario(SCENARIOS.walSyncNormalBusyTimeout5000!);
    });

program.command("report <scenario>")
    .description("Generate a report for a scenario (e.g., base0, busyTimeout1, wal, walSyncNormal, or mixed-<id>)")
    .action((scenario: string) => {
        // Check if it's a mixed scenario (starts with "mixed-")
        if (scenario.startsWith("mixed-")) {
            const resultFile = `${scenario}.json`;
            const resultsPath = join(projectRoot, "results", resultFile);
            if (!existsSync(resultsPath)) {
                console.error(`Results file not found: ${resultsPath}`);
                process.exit(1);
            }
            generateReportFromResults({
                resultsPath,
                outputPath: join(projectRoot, "reports", `${scenario}-report.md`),
                scenarioName: scenario
            });
            return;
        }
        
        const config = SCENARIOS[scenario];
        if (!config) {
            console.error(`Unknown scenario: ${scenario}`);
            console.error(`Available scenarios: ${Object.keys(SCENARIOS).join(", ")}`);
            console.error(`For mixed benchmarks, use: mixed-<id> (e.g., mixed-small, mixed-medium)`);
            process.exit(1);
        }
        generateReport(config);
    });

program.command("report-all")
    .description("Generate reports for all scenarios that have results")
    .action(() => {
        // Generate reports for standard scenarios
        for (const config of Object.values(SCENARIOS)) {
            const resultsPath = join(projectRoot, "results", config.resultFile);
            if (existsSync(resultsPath)) {
                generateReport(config);
            } else {
                console.log(`Skipping ${config.name}: no results found`);
            }
        }
        
        // Also scan for mixed-*.json files
        const resultsDir = join(projectRoot, "results");
        if (existsSync(resultsDir)) {
            const files = readdirSync(resultsDir) as string[];
            for (const file of files) {
                if (file.startsWith("mixed-") && file.endsWith(".json")) {
                    const scenarioName = file.replace(".json", "");
                    generateReportFromResults({
                        resultsPath: join(resultsDir, file),
                        outputPath: join(projectRoot, "reports", `${scenarioName}-report.md`),
                        scenarioName
                    });
                }
            }
        }
    });

// Mixed Read/Write Scenario
interface MixedReadWriteOptions {
    id: string;
    readWorkers: number;
    writeWorkers: number;
    readsPerWorker: number;
    writesPerWorker: number;
    cacheSize: number; // in KB, negative value (e.g., -16000 = 16MB)
}

const READ_QUERY_TYPES: ReadQueryType[] = [
    "posts_for_user",
    "posts_in_timeframe",
    "single_post_with_details",
    "users_in_timeframe"
];

function generateReadTask(
    dbPath: string, 
    userIds: number[], 
    postIds: number[],
    cacheSize: number
): ReadTask {
    const queryType = faker.helpers.arrayElement(READ_QUERY_TYPES);
    
    // Generate date range for timeframe queries (within last 2 years)
    const endDate = faker.date.recent({ days: 30 });
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days before
    
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

function generateWriteTask(dbPath: string, userIds: number[], postIds: number[], tagIds: number[], cacheSize: number): WriteTask {
    // Randomly pick a write type
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
    const errors = results.filter(r => !r.success);
    const busyErrors = errors.filter(r => r.errorCode === "SQLITE_BUSY");
    
    // Group by query type
    const byQueryType = READ_QUERY_TYPES.reduce((acc, qt) => {
        const typeResults = successful.filter(r => r.queryType === qt);
        const typeDurations = typeResults.map(r => r.duration).sort((a, b) => a - b);
        acc[qt] = {
            count: typeResults.length,
            avgTime: typeDurations.length > 0 ? typeDurations.reduce((a, b) => a + b, 0) / typeDurations.length : 0,
            p95: typeDurations[Math.floor(typeDurations.length * 0.95)] ?? 0,
            p99: typeDurations[Math.floor(typeDurations.length * 0.99)] ?? 0,
            avgRowCount: typeResults.length > 0 ? typeResults.reduce((a, b) => a + b.rowCount, 0) / typeResults.length : 0
        };
        return acc;
    }, {} as Record<string, { count: number; avgTime: number; p95: number; p99: number; avgRowCount: number }>);
    
    return {
        total: results.length,
        successful: successful.length,
        errors: errors.length,
        busyErrors: busyErrors.length,
        successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0,
        avgTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        minTime: durations[0] ?? 0,
        maxTime: durations[durations.length - 1] ?? 0,
        p50: durations[Math.floor(durations.length * 0.5)] ?? 0,
        p95: durations[Math.floor(durations.length * 0.95)] ?? 0,
        p99: durations[Math.floor(durations.length * 0.99)] ?? 0,
        readsPerSec: totalDuration > 0 ? (successful.length / totalDuration) * 1000 : 0,
        byQueryType
    };
}

function calculateWriteMetricsForMixed(results: WriteResult[], totalDuration: number) {
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.duration).sort((a, b) => a - b);
    const errors = results.filter(r => !r.success);
    const lockErrors = errors.filter(r => r.errorCode === "SQLITE_LOCK");
    
    return {
        total: results.length,
        successful: successful.length,
        errors: errors.length,
        lockErrors: lockErrors.length,
        successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0,
        avgTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        minTime: durations[0] ?? 0,
        maxTime: durations[durations.length - 1] ?? 0,
        p50: durations[Math.floor(durations.length * 0.5)] ?? 0,
        p95: durations[Math.floor(durations.length * 0.95)] ?? 0,
        p99: durations[Math.floor(durations.length * 0.99)] ?? 0,
        writesPerSec: totalDuration > 0 ? (successful.length / totalDuration) * 1000 : 0
    };
}

async function runMixedReadWrite(options: MixedReadWriteOptions) {
    const { id, readWorkers, writeWorkers, readsPerWorker, writesPerWorker, cacheSize } = options;
    
    // Dynamic paths based on id
    const dbPath = join(projectRoot, "db", `mixed-${id}.db`);
    const resultFile = `mixed-${id}.json`;
    const setupPath = join(projectRoot, "scenarios", "mixedReadWrite", "setup.ts");
    
    const totalReads = readWorkers * readsPerWorker;
    const totalWrites = writeWorkers * writesPerWorker;
    
    console.log(`\n=== Mixed Read/Write Benchmark [${id}] ===`);
    console.log(`Read workers: ${readWorkers} × ${readsPerWorker} = ${totalReads.toLocaleString()} reads`);
    console.log(`Write workers: ${writeWorkers} × ${writesPerWorker} = ${totalWrites.toLocaleString()} writes`);
    console.log(`Total operations: ${(totalReads + totalWrites).toLocaleString()}`);
    console.log(`Read:Write ratio: ${(totalReads / totalWrites).toFixed(1)}:1`);
    console.log(`Cache size: ${Math.abs(cacheSize)} KB (${Math.abs(cacheSize) / 1000} MB)`);
    
    // Delete and setup database
    deleteDatabase(dbPath);
    deleteDatabase(dbPath + "-wal");
    deleteDatabase(dbPath + "-shm");
    
    console.log("\nSetting up database...");
    const { setup } = await import(setupPath);
    const { userIds, postIds, tagIds } = setup(dbPath) as { userIds: number[]; postIds: number[]; tagIds: number[] };
    
    // Create read worker pools (one pool per worker with 1 thread each)
    console.log(`\nSpawning ${readWorkers} read workers...`);
    const readPools: Piscina[] = [];
    for (let i = 0; i < readWorkers; i++) {
        readPools.push(new Piscina({
            filename: join(projectRoot, "scenarios", "mixedReadWrite", "readWorker.ts"),
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    
    // Create write worker pools
    console.log(`Spawning ${writeWorkers} write workers...`);
    const writePools: Piscina[] = [];
    for (let i = 0; i < writeWorkers; i++) {
        writePools.push(new Piscina({
            filename: join(projectRoot, "scenarios", "mixedReadWrite", "writeWorker.ts"),
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    
    let allReadResults: ReadResult[] = [];
    let allWriteResults: WriteResult[] = [];
    
    console.log("\nStarting benchmark (all workers fire simultaneously)...");
    const startTime = performance.now();
    
    try {
        // Create promises for all read operations
        const readPromises: Promise<ReadResult>[] = [];
        for (let w = 0; w < readWorkers; w++) {
            const pool = readPools[w]!;
            for (let i = 0; i < readsPerWorker; i++) {
                const task = generateReadTask(dbPath, userIds, postIds, cacheSize);
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
            }
        }
        
        // Create promises for all write operations
        const writePromises: Promise<WriteResult>[] = [];
        for (let w = 0; w < writeWorkers; w++) {
            const pool = writePools[w]!;
            for (let i = 0; i < writesPerWorker; i++) {
                const task = generateWriteTask(dbPath, userIds, postIds, tagIds, cacheSize);
                writePromises.push(
                    pool.run(task).catch((error): WriteResult => ({
                        success: false,
                        duration: 0,
                        error: String(error),
                        errorCode: "WORKER_ERROR"
                    }))
                );
            }
        }
        
        // Progress tracking
        let completedReads = 0;
        let completedWrites = 0;
        const progressInterval = setInterval(() => {
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            console.log(`  [${elapsed}s] Reads: ${completedReads.toLocaleString()}/${totalReads.toLocaleString()}, Writes: ${completedWrites.toLocaleString()}/${totalWrites.toLocaleString()}`);
        }, 5000);
        
        // Track read completions
        const trackedReadPromises = readPromises.map(p => 
            p.then(r => { completedReads++; return r; })
        );
        
        // Track write completions
        const trackedWritePromises = writePromises.map(p => 
            p.then(r => { completedWrites++; return r; })
        );
        
        // Wait for all operations
        const [readResults, writeResults] = await Promise.all([
            Promise.all(trackedReadPromises),
            Promise.all(trackedWritePromises)
        ]);
        
        clearInterval(progressInterval);
        
        // Assign directly instead of spread to avoid stack overflow with large arrays
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
    const writeMetrics = calculateWriteMetricsForMixed(allWriteResults, totalDuration);
    
    // Print results
    console.log(`\n=== Results ===`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Combined throughput: ${((readMetrics.successful + writeMetrics.successful) / totalDuration * 1000).toFixed(0)} ops/sec`);
    
    console.log(`\n--- Reads ---`);
    console.log(`  Success: ${readMetrics.successful.toLocaleString()}/${readMetrics.total.toLocaleString()} (${readMetrics.successRate.toFixed(1)}%)`);
    console.log(`  Throughput: ${readMetrics.readsPerSec.toFixed(0)} reads/sec`);
    console.log(`  Latency: avg=${readMetrics.avgTime.toFixed(2)}ms, p50=${readMetrics.p50.toFixed(2)}ms, p95=${readMetrics.p95.toFixed(2)}ms, p99=${readMetrics.p99.toFixed(2)}ms`);
    console.log(`  Errors: ${readMetrics.errors} (busy: ${readMetrics.busyErrors})`);
    console.log(`  By query type:`);
    for (const [qt, stats] of Object.entries(readMetrics.byQueryType)) {
        console.log(`    ${qt}: ${stats.count} ops, avg=${stats.avgTime.toFixed(2)}ms, p95=${stats.p95.toFixed(2)}ms, avgRows=${stats.avgRowCount.toFixed(1)}`);
    }
    
    console.log(`\n--- Writes ---`);
    console.log(`  Success: ${writeMetrics.successful.toLocaleString()}/${writeMetrics.total.toLocaleString()} (${writeMetrics.successRate.toFixed(1)}%)`);
    console.log(`  Throughput: ${writeMetrics.writesPerSec.toFixed(0)} writes/sec`);
    console.log(`  Latency: avg=${writeMetrics.avgTime.toFixed(2)}ms, p50=${writeMetrics.p50.toFixed(2)}ms, p95=${writeMetrics.p95.toFixed(2)}ms, p99=${writeMetrics.p99.toFixed(2)}ms`);
    console.log(`  Errors: ${writeMetrics.errors} (locks: ${writeMetrics.lockErrors})`);
    
    // Save results
    mkdirSync(join(projectRoot, "results"), { recursive: true });
    const resultData = {
        testName: `mixedReadWrite-${id}`,
        timestamp: new Date().toISOString(),
        configuration: {
            id,
            readWorkers,
            writeWorkers,
            readsPerWorker,
            writesPerWorker,
            totalReads,
            totalWrites,
            totalOperations: totalReads + totalWrites,
            readWriteRatio: totalReads / totalWrites,
            cacheSize
        },
        duration: totalDuration,
        reads: readMetrics,
        writes: writeMetrics,
        combined: {
            totalOps: readMetrics.successful + writeMetrics.successful,
            opsPerSec: ((readMetrics.successful + writeMetrics.successful) / totalDuration) * 1000
        }
    };
    
    writeFileSync(
        join(projectRoot, "results", resultFile),
        JSON.stringify(resultData, null, 2)
    );
    
    console.log(`\nResults saved to results/${resultFile}`);
}

program.command("mixedReadWrite")
    .description("Run mixed read/write benchmark (WAL + sync NORMAL + 2000ms busy + 4000 checkpoint)")
    .requiredOption("-i, --id <id>", "Unique ID for this benchmark run (used for db and result file names)")
    .option("-r, --read-workers <n>", "Number of concurrent read workers", "10")
    .option("-w, --write-workers <n>", "Number of concurrent write workers", "5")
    .option("-R, --total-reads <n>", "Total number of read operations", "2000000")
    .option("-W, --total-writes <n>", "Total number of write operations", "100000")
    .option("-c, --cache-size <kb>", "Cache size in KB (negative value, e.g., -16000 = 16MB)", "-16000")
    .action(async (opts) => {
        const readWorkers = parseInt(opts.readWorkers, 10);
        const writeWorkers = parseInt(opts.writeWorkers, 10);
        const totalReads = parseInt(opts.totalReads, 10);
        const totalWrites = parseInt(opts.totalWrites, 10);
        const cacheSize = parseInt(opts.cacheSize, 10);
        
        const readsPerWorker = Math.ceil(totalReads / readWorkers);
        const writesPerWorker = Math.ceil(totalWrites / writeWorkers);
        
        await runMixedReadWrite({
            id: opts.id,
            readWorkers,
            writeWorkers,
            readsPerWorker,
            writesPerWorker,
            cacheSize
        });
    });

async function runTursoReadWrite(options: MixedReadWriteOptions) {
    const { id, readWorkers, writeWorkers, readsPerWorker, writesPerWorker, cacheSize } = options;
    
    // Dynamic paths based on id
    const dbPath = join(projectRoot, "db", `turso-${id}.db`);
    const resultFile = `turso-${id}.json`;
    const setupPath = join(projectRoot, "scenarios", "tursoReadWrite", "setup.ts");
    
    const totalReads = readWorkers * readsPerWorker;
    const totalWrites = writeWorkers * writesPerWorker;
    
    console.log(`\n=== Turso Read/Write Benchmark [${id}] ===`);
    console.log(`Read workers: ${readWorkers} × ${readsPerWorker} = ${totalReads.toLocaleString()} reads`);
    console.log(`Write workers: ${writeWorkers} × ${writesPerWorker} = ${totalWrites.toLocaleString()} writes`);
    console.log(`Total operations: ${(totalReads + totalWrites).toLocaleString()}`);
    console.log(`Read:Write ratio: ${(totalReads / totalWrites).toFixed(1)}:1`);
    console.log(`Using Turso/libSQL in local embedded mode`);
    
    // Delete database (Turso doesn't use -wal or -shm files)
    deleteDatabase(dbPath);
    
    console.log("\nSetting up database...");
    const { setup } = await import(setupPath);
    const { userIds, postIds, tagIds } = await setup(dbPath);
    
    // Create read worker pools (one pool per worker with 1 thread each)
    console.log(`\nSpawning ${readWorkers} read workers...`);
    const readPools: Piscina[] = [];
    for (let i = 0; i < readWorkers; i++) {
        readPools.push(new Piscina({
            filename: join(projectRoot, "scenarios", "tursoReadWrite", "readWorker.ts"),
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    
    // Create write worker pools
    console.log(`Spawning ${writeWorkers} write workers...`);
    const writePools: Piscina[] = [];
    for (let i = 0; i < writeWorkers; i++) {
        writePools.push(new Piscina({
            filename: join(projectRoot, "scenarios", "tursoReadWrite", "writeWorker.ts"),
            maxThreads: 1,
            minThreads: 1,
            execArgv: ["--import", "tsx"]
        }));
    }
    
    let allReadResults: ReadResult[] = [];
    let allWriteResults: WriteResult[] = [];
    
    console.log("\nStarting benchmark (all workers fire simultaneously)...");
    const startTime = performance.now();
    
    try {
        // Create promises for all read operations
        const readPromises: Promise<ReadResult>[] = [];
        for (let w = 0; w < readWorkers; w++) {
            const pool = readPools[w]!;
            for (let i = 0; i < readsPerWorker; i++) {
                const task = generateReadTask(dbPath, userIds, postIds, cacheSize);
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
            }
        }
        
        // Create promises for all write operations
        const writePromises: Promise<WriteResult>[] = [];
        for (let w = 0; w < writeWorkers; w++) {
            const pool = writePools[w]!;
            for (let i = 0; i < writesPerWorker; i++) {
                const task = generateWriteTask(dbPath, userIds, postIds, tagIds, cacheSize);
                writePromises.push(
                    pool.run(task).catch((error): WriteResult => ({
                        success: false,
                        duration: 0,
                        error: String(error),
                        errorCode: "WORKER_ERROR"
                    }))
                );
            }
        }
        
        // Progress tracking
        let completedReads = 0;
        let completedWrites = 0;
        const progressInterval = setInterval(() => {
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            console.log(`  [${elapsed}s] Reads: ${completedReads.toLocaleString()}/${totalReads.toLocaleString()}, Writes: ${completedWrites.toLocaleString()}/${totalWrites.toLocaleString()}`);
        }, 5000);
        
        // Track read completions
        const trackedReadPromises = readPromises.map(p => 
            p.then(r => { completedReads++; return r; })
        );
        
        // Track write completions
        const trackedWritePromises = writePromises.map(p => 
            p.then(r => { completedWrites++; return r; })
        );
        
        // Wait for all operations
        const [readResults, writeResults] = await Promise.all([
            Promise.all(trackedReadPromises),
            Promise.all(trackedWritePromises)
        ]);
        
        clearInterval(progressInterval);
        
        // Assign directly instead of spread to avoid stack overflow with large arrays
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
    const writeMetrics = calculateWriteMetricsForMixed(allWriteResults, totalDuration);
    
    // Print results
    console.log(`\n=== Results ===`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Combined throughput: ${((readMetrics.successful + writeMetrics.successful) / totalDuration * 1000).toFixed(0)} ops/sec`);
    
    console.log(`\n--- Reads ---`);
    console.log(`  Success: ${readMetrics.successful.toLocaleString()}/${readMetrics.total.toLocaleString()} (${readMetrics.successRate.toFixed(1)}%)`);
    console.log(`  Throughput: ${readMetrics.readsPerSec.toFixed(0)} reads/sec`);
    console.log(`  Latency: avg=${readMetrics.avgTime.toFixed(2)}ms, p50=${readMetrics.p50.toFixed(2)}ms, p95=${readMetrics.p95.toFixed(2)}ms, p99=${readMetrics.p99.toFixed(2)}ms`);
    console.log(`  Errors: ${readMetrics.errors} (busy: ${readMetrics.busyErrors})`);
    console.log(`  By query type:`);
    for (const [qt, stats] of Object.entries(readMetrics.byQueryType)) {
        console.log(`    ${qt}: ${stats.count} ops, avg=${stats.avgTime.toFixed(2)}ms, p95=${stats.p95.toFixed(2)}ms, avgRows=${stats.avgRowCount.toFixed(1)}`);
    }
    
    console.log(`\n--- Writes ---`);
    console.log(`  Success: ${writeMetrics.successful.toLocaleString()}/${writeMetrics.total.toLocaleString()} (${writeMetrics.successRate.toFixed(1)}%)`);
    console.log(`  Throughput: ${writeMetrics.writesPerSec.toFixed(0)} writes/sec`);
    console.log(`  Latency: avg=${writeMetrics.avgTime.toFixed(2)}ms, p50=${writeMetrics.p50.toFixed(2)}ms, p95=${writeMetrics.p95.toFixed(2)}ms, p99=${writeMetrics.p99.toFixed(2)}ms`);
    console.log(`  Errors: ${writeMetrics.errors} (locks: ${writeMetrics.lockErrors})`);
    
    // Save results
    mkdirSync(join(projectRoot, "results"), { recursive: true });
    const resultData = {
        testName: `tursoReadWrite-${id}`,
        timestamp: new Date().toISOString(),
        configuration: {
            id,
            readWorkers,
            writeWorkers,
            readsPerWorker,
            writesPerWorker,
            totalReads,
            totalWrites,
            totalOperations: totalReads + totalWrites,
            readWriteRatio: totalReads / totalWrites,
            cacheSize
        },
        duration: totalDuration,
        reads: readMetrics,
        writes: writeMetrics,
        combined: {
            totalOps: readMetrics.successful + writeMetrics.successful,
            opsPerSec: ((readMetrics.successful + writeMetrics.successful) / totalDuration) * 1000
        }
    };
    
    writeFileSync(
        join(projectRoot, "results", resultFile),
        JSON.stringify(resultData, null, 2)
    );
    
    console.log(`\nResults saved to results/${resultFile}`);
}

program.command("tursoReadWrite")
    .description("Run mixed read/write benchmark using Turso/libSQL in local embedded mode")
    .requiredOption("-i, --id <id>", "Unique ID for this benchmark run (used for db and result file names)")
    .option("-r, --read-workers <n>", "Number of concurrent read workers", "10")
    .option("-w, --write-workers <n>", "Number of concurrent write workers", "5")
    .option("-R, --total-reads <n>", "Total number of read operations", "2000000")
    .option("-W, --total-writes <n>", "Total number of write operations", "100000")
    .option("-c, --cache-size <kb>", "Cache size in KB (negative value, e.g., -16000 = 16MB) - Note: not used with Turso", "-16000")
    .action(async (opts) => {
        const readWorkers = parseInt(opts.readWorkers, 10);
        const writeWorkers = parseInt(opts.writeWorkers, 10);
        const totalReads = parseInt(opts.totalReads, 10);
        const totalWrites = parseInt(opts.totalWrites, 10);
        const cacheSize = parseInt(opts.cacheSize, 10);
        
        const readsPerWorker = Math.ceil(totalReads / readWorkers);
        const writesPerWorker = Math.ceil(totalWrites / writeWorkers);
        
        await runTursoReadWrite({
            id: opts.id,
            readWorkers,
            writeWorkers,
            readsPerWorker,
            writesPerWorker,
            cacheSize
        });
    });

program.parse(process.argv);
