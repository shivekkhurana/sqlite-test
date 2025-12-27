import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Metrics {
    total: number;
    successful: number;
    errors: number;
    lockErrors: number;
    successRate: number;
    avgTime: number;
    p95: number;
    p99: number;
    writesPerSec: number;
    totalDuration: number;
}

export interface Configuration {
    concurrency: number;
    totalWrites: number;
    metrics: Metrics;
}

export interface TestResults {
    testName: string;
    timestamp: string;
    configurations: Configuration[];
}

/**
 * Rounds up to a "nice" number for chart axes (e.g., 1000, 5000, 10000, 50000, 100000)
 */
function roundUpToNiceNumber(value: number): number {
    if (value <= 0) return 100;

    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;

    let niceMultiplier: number;
    if (normalized <= 1) niceMultiplier = 1;
    else if (normalized <= 2) niceMultiplier = 2;
    else if (normalized <= 5) niceMultiplier = 5;
    else niceMultiplier = 10;

    return niceMultiplier * magnitude;
}

function generateSuccessRateChart(configs: Configuration[]): string {
    return `\`\`\`mermaid
xychart-beta
    title "Success Rate vs Concurrency"
    x-axis [${configs.map(c => c.concurrency).join(", ")}]
    y-axis "Success Rate (%)" 0 --> 100
    bar [${configs.map(c => c.metrics.successRate.toFixed(1)).join(", ")}]
\`\`\``;
}

function generateWritesPerSecChart(configs: Configuration[]): string {
    const maxWrites = Math.max(...configs.map(c => c.metrics.writesPerSec));
    const yAxisMax = roundUpToNiceNumber(maxWrites);

    return `\`\`\`mermaid
xychart-beta
    title "Writes Per Second vs Concurrency"
    x-axis [${configs.map(c => c.concurrency).join(", ")}]
    y-axis "Writes/sec" 0 --> ${yAxisMax}
    line [${configs.map(c => c.metrics.writesPerSec.toFixed(0)).join(", ")}]
\`\`\``;
}

function generateLatencyChart(configs: Configuration[]): string {
    const maxLatency = Math.max(...configs.map(c => c.metrics.p99));
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Latency Metrics (ms) vs Concurrency"
    x-axis [${configs.map(c => c.concurrency).join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    line [${configs.map(c => c.metrics.avgTime.toFixed(2)).join(", ")}]
    line [${configs.map(c => c.metrics.p95.toFixed(2)).join(", ")}]
    line [${configs.map(c => c.metrics.p99.toFixed(2)).join(", ")}]
\`\`\``;
}

function generateErrorsChart(configs: Configuration[]): string {
    const maxErrors = Math.max(...configs.map(c => c.metrics.lockErrors));
    const yAxisMax = roundUpToNiceNumber(maxErrors);

    return `\`\`\`mermaid
xychart-beta
    title "Errors vs Concurrency"
    x-axis [${configs.map(c => c.concurrency).join(", ")}]
    y-axis "Error Count" 0 --> ${yAxisMax}
    bar [${configs.map(c => c.metrics.lockErrors).join(", ")}]
\`\`\``;
}

function generateSummaryTable(configs: Configuration[]): string {
    let table = `| Concurrency | Success Rate | Writes/sec | Avg (ms) | P95 (ms) | P99 (ms) | Lock Errors |
|-------------|--------------|------------|----------|----------|----------|-------------|
`;

    for (const c of configs) {
        table += `| ${c.concurrency} | ${c.metrics.successRate.toFixed(1)}% | ${c.metrics.writesPerSec.toFixed(0)} | ${c.metrics.avgTime.toFixed(2)} | ${c.metrics.p95.toFixed(2)} | ${c.metrics.p99.toFixed(2)} | ${c.metrics.lockErrors} |\n`;
    }

    return table;
}

function generateKeyFindings(configs: Configuration[]): string {
    const singleWriter = configs.find(c => c.concurrency === 1);
    const worstCase = configs.reduce((prev, curr) =>
        curr.metrics.successRate < prev.metrics.successRate ? curr : prev
    );
    const bestThroughput = configs.reduce((prev, curr) =>
        curr.metrics.writesPerSec > prev.metrics.writesPerSec ? curr : prev
    );

    let findings = "";

    if (singleWriter) {
        findings += `- **Single writer achieves ${singleWriter.metrics.successRate.toFixed(1)}% success rate** with ${singleWriter.metrics.writesPerSec.toFixed(0)} writes/sec\n`;
    }

    findings += `- **Best throughput:** ${bestThroughput.metrics.writesPerSec.toFixed(0)} writes/sec at concurrency ${bestThroughput.concurrency}\n`;
    findings += `- **Worst success rate:** ${worstCase.metrics.successRate.toFixed(1)}% at concurrency ${worstCase.concurrency} with ${worstCase.metrics.lockErrors} lock errors\n`;

    const highConcurrency = configs.filter(c => c.concurrency >= 16);
    if (highConcurrency.length > 0) {
        const avgP99 = highConcurrency.reduce((sum, c) => sum + c.metrics.p99, 0) / highConcurrency.length;
        findings += `- **High concurrency P99 latency:** ${avgP99.toFixed(0)}ms average at 16+ concurrent writers\n`;
    }

    return findings;
}

function analyzeSingleWriter(configs: Configuration[]): string {
    const single = configs.find(c => c.concurrency === 1);
    if (!single) return "No single-writer data available.";

    return `With a single writer, SQLite performs optimally:
- **Success Rate:** ${single.metrics.successRate.toFixed(1)}%
- **Throughput:** ${single.metrics.writesPerSec.toFixed(0)} writes/second
- **Average Latency:** ${single.metrics.avgTime.toFixed(2)}ms
- **P99 Latency:** ${single.metrics.p99.toFixed(2)}ms
- **Lock Errors:** ${single.metrics.lockErrors}

This represents the baseline performance without contention.`;
}

function analyzeLowConcurrency(configs: Configuration[]): string {
    const low = configs.filter(c => c.concurrency >= 2 && c.concurrency <= 4);
    if (low.length === 0) return "No low concurrency data available.";

    const avgSuccess = low.reduce((sum, c) => sum + c.metrics.successRate, 0) / low.length;
    const avgErrors = low.reduce((sum, c) => sum + c.metrics.lockErrors, 0) / low.length;

    return `Even at low concurrency levels (2-4 writers), significant contention occurs:
- **Average Success Rate:** ${avgSuccess.toFixed(1)}%
- **Average Lock Errors:** ${Math.round(avgErrors)} per test run

This demonstrates SQLite's fundamental limitation with concurrent writes - even 2 simultaneous writers will frequently conflict.`;
}

function analyzeHighConcurrency(configs: Configuration[]): string {
    const high = configs.filter(c => c.concurrency >= 16);
    if (high.length === 0) return "No high concurrency data available.";

    const avgSuccess = high.reduce((sum, c) => sum + c.metrics.successRate, 0) / high.length;
    const avgP99 = high.reduce((sum, c) => sum + c.metrics.p99, 0) / high.length;
    const maxP99 = Math.max(...high.map(c => c.metrics.p99));

    return `At high concurrency (16+ writers), performance degrades significantly:
- **Average Success Rate:** ${avgSuccess.toFixed(1)}%
- **Average P99 Latency:** ${avgP99.toFixed(0)}ms
- **Maximum P99 Latency:** ${maxP99.toFixed(0)}ms

The vast majority of write attempts fail due to lock contention. Successful writes also take much longer due to retry overhead and queuing.`;
}

function generateMarkdown(results: TestResults): string {
    const configs = results.configurations;
    const timestamp = new Date(results.timestamp).toLocaleString();

    return `# SQLite Concurrent Writes Test: ${results.testName}

**Test Run:** ${timestamp}

## Overview

This test evaluates SQLite's behavior under concurrent write pressure. Each test configuration runs ${configs[0]?.totalWrites || 1000} total write operations across different concurrency levels (number of simultaneous writers).

## Key Findings

${generateKeyFindings(configs)}

## Summary Table

${generateSummaryTable(configs)}

## Charts

### Success Rate by Concurrency

This chart shows how the success rate of write operations decreases as concurrency increases. SQLite uses file-level locking, so concurrent writes often fail with \`SQLITE_BUSY\` or \`SQLITE_LOCKED\` errors.

${generateSuccessRateChart(configs)}

### Throughput (Writes Per Second)

Despite lower success rates at higher concurrency, the overall throughput pattern shows interesting behavior. The effective writes per second decreases as contention increases.

${generateWritesPerSecChart(configs)}

### Latency Distribution

This chart shows average, P95, and P99 latencies. As concurrency increases, latency variance grows significantly due to lock contention.

${generateLatencyChart(configs)}

### Lock Errors by Concurrency

The number of lock errors (SQLITE_BUSY/SQLITE_LOCKED) increases with concurrency, demonstrating SQLite's single-writer limitation.

${generateErrorsChart(configs)}

## Detailed Analysis

### Single Writer (Concurrency = 1)

${analyzeSingleWriter(configs)}

### Low Concurrency (2-4 writers)

${analyzeLowConcurrency(configs)}

### High Concurrency (16+ writers)

${analyzeHighConcurrency(configs)}

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

</details>
`;
}

export interface ReportConfig {
    resultsPath: string;
    outputPath: string;
    scenarioName: string;
}

// Mixed read/write result types
export interface MixedReadMetrics {
    total: number;
    successful: number;
    errors: number;
    busyErrors: number;
    successRate: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    p50: number;
    p95: number;
    p99: number;
    readsPerSec: number;
    byQueryType: Record<string, {
        count: number;
        avgTime: number;
        p95: number;
        p99: number;
        avgRowCount: number;
    }>;
}

export interface MixedWriteMetrics {
    total: number;
    successful: number;
    errors: number;
    lockErrors: number;
    successRate: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    p50: number;
    p95: number;
    p99: number;
    writesPerSec: number;
}

export interface MixedResults {
    testName: string;
    timestamp: string;
    configuration: {
        id: string;
        readWorkers: number;
        writeWorkers: number;
        readsPerWorker: number;
        writesPerWorker: number;
        totalReads: number;
        totalWrites: number;
        totalOperations: number;
        readWriteRatio: number;
        cacheSize: number;
    };
    duration: number;
    reads: MixedReadMetrics;
    writes: MixedWriteMetrics;
    combined: {
        totalOps: number;
        opsPerSec: number;
    };
}

// Graph generation functions for mixed read/write reports
function generateReadWriteLatencyChart(reads: MixedReadMetrics, writes: MixedWriteMetrics): string {
    const maxLatency = Math.max(reads.p99, writes.p99);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Read vs Write Latency Comparison"
    x-axis ["P50", "P95", "P99"]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    line "Reads" [${reads.p50.toFixed(2)}, ${reads.p95.toFixed(2)}, ${reads.p99.toFixed(2)}]
    line "Writes" [${writes.p50.toFixed(2)}, ${writes.p95.toFixed(2)}, ${writes.p99.toFixed(2)}]
\`\`\``;
}

function generateThroughputChart(reads: MixedReadMetrics, writes: MixedWriteMetrics, combined: { opsPerSec: number }): string {
    const maxThroughput = Math.max(reads.readsPerSec, writes.writesPerSec, combined.opsPerSec);
    const yAxisMax = roundUpToNiceNumber(maxThroughput);

    return `\`\`\`mermaid
xychart-beta
    title "Throughput Comparison"
    x-axis ["Reads", "Writes", "Combined"]
    y-axis "Operations/sec" 0 --> ${yAxisMax}
    bar [${reads.readsPerSec.toFixed(0)}, ${writes.writesPerSec.toFixed(0)}, ${combined.opsPerSec.toFixed(0)}]
\`\`\``;
}

function generateQueryTypeLatencyChart(reads: MixedReadMetrics): string {
    const queryTypes = Object.keys(reads.byQueryType);
    const avgTimes = queryTypes.map(qt => {
        const stats = reads.byQueryType[qt];
        return stats ? stats.avgTime : 0;
    });
    if (avgTimes.length === 0) return '';
    const maxLatency = Math.max(...avgTimes);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    // Format query type names for better readability
    const formattedTypes = queryTypes.map(qt => qt.replace(/_/g, ' '));

    return `\`\`\`mermaid
xychart-beta
    title "Average Latency by Query Type"
    x-axis [${formattedTypes.map(t => `"${t}"`).join(", ")}]
    y-axis "Avg Latency (ms)" 0 --> ${yAxisMax}
    bar [${avgTimes.map(t => t.toFixed(2)).join(", ")}]
\`\`\``;
}

function generateQueryTypeP95Chart(reads: MixedReadMetrics): string {
    const queryTypes = Object.keys(reads.byQueryType);
    const p95Times = queryTypes.map(qt => {
        const stats = reads.byQueryType[qt];
        return stats ? stats.p95 : 0;
    });
    if (p95Times.length === 0) return '';
    const maxLatency = Math.max(...p95Times);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    // Format query type names for better readability
    const formattedTypes = queryTypes.map(qt => qt.replace(/_/g, ' '));

    return `\`\`\`mermaid
xychart-beta
    title "P95 Latency by Query Type"
    x-axis [${formattedTypes.map(t => `"${t}"`).join(", ")}]
    y-axis "P95 Latency (ms)" 0 --> ${yAxisMax}
    bar [${p95Times.map(t => t.toFixed(2)).join(", ")}]
\`\`\``;
}

function generateQueryTypeDistributionChart(reads: MixedReadMetrics): string {
    const queryTypes = Object.keys(reads.byQueryType);
    const counts = queryTypes.map(qt => {
        const stats = reads.byQueryType[qt];
        return stats ? stats.count : 0;
    });
    if (counts.length === 0) return '';
    const maxCount = Math.max(...counts);
    const yAxisMax = roundUpToNiceNumber(maxCount);

    // Format query type names for better readability
    const formattedTypes = queryTypes.map(qt => qt.replace(/_/g, ' '));

    return `\`\`\`mermaid
xychart-beta
    title "Query Type Distribution"
    x-axis [${formattedTypes.map(t => `"${t}"`).join(", ")}]
    y-axis "Count" 0 --> ${yAxisMax}
    bar [${counts.join(", ")}]
\`\`\``;
}

function generateErrorRateChart(reads: MixedReadMetrics, writes: MixedWriteMetrics): string {
    const maxErrors = Math.max(reads.busyErrors, writes.lockErrors, 1);
    const yAxisMax = roundUpToNiceNumber(maxErrors);

    return `\`\`\`mermaid
xychart-beta
    title "Error Rates: Reads vs Writes"
    x-axis ["Read Busy Errors", "Write Lock Errors"]
    y-axis "Error Count" 0 --> ${yAxisMax}
    bar [${reads.busyErrors}, ${writes.lockErrors}]
\`\`\``;
}

function generateMixedSuccessRateChart(reads: MixedReadMetrics, writes: MixedWriteMetrics): string {
    return `\`\`\`mermaid
xychart-beta
    title "Success Rate: Reads vs Writes"
    x-axis ["Reads", "Writes"]
    y-axis "Success Rate (%)" 0 --> 100
    bar [${reads.successRate.toFixed(1)}, ${writes.successRate.toFixed(1)}]
\`\`\``;
}

function generateMixedMarkdown(results: MixedResults): string {
    const timestamp = new Date(results.timestamp).toLocaleString();
    const config = results.configuration;
    const reads = results.reads;
    const writes = results.writes;
    const combined = results.combined;
    const durationSec = results.duration / 1000;

    // Query type breakdown table
    let queryTypeTable = `| Query Type | Count | Avg (ms) | P95 (ms) | P99 (ms) | Avg Rows |
|------------|-------|----------|----------|----------|----------|
`;
    for (const [qt, stats] of Object.entries(reads.byQueryType)) {
        queryTypeTable += `| ${qt} | ${stats.count.toLocaleString()} | ${stats.avgTime.toFixed(2)} | ${stats.p95.toFixed(2)} | ${stats.p99.toFixed(2)} | ${stats.avgRowCount.toFixed(1)} |\n`;
    }

    return `# Mixed Read/Write Benchmark: ${config.id}

**Test Run:** ${timestamp}

## Configuration

| Setting | Value |
|---------|-------|
| ID | ${config.id} |
| Read Workers | ${config.readWorkers} |
| Write Workers | ${config.writeWorkers} |
| Total Reads | ${config.totalReads.toLocaleString()} |
| Total Writes | ${config.totalWrites.toLocaleString()} |
| Total Operations | ${config.totalOperations.toLocaleString()} |
| Read:Write Ratio | ${config.readWriteRatio.toFixed(1)}:1 |
| Cache Size | ${Math.abs(config.cacheSize)} KB (${(Math.abs(config.cacheSize) / 1000).toFixed(0)} MB) |

## Summary

| Metric | Reads | Writes | Combined |
|--------|-------|--------|----------|
| Total | ${reads.total.toLocaleString()} | ${writes.total.toLocaleString()} | ${combined.totalOps.toLocaleString()} |
| Successful | ${reads.successful.toLocaleString()} | ${writes.successful.toLocaleString()} | - |
| Success Rate | ${reads.successRate.toFixed(1)}% | ${writes.successRate.toFixed(1)}% | - |
| Throughput | ${reads.readsPerSec.toFixed(0)}/sec | ${writes.writesPerSec.toFixed(0)}/sec | ${combined.opsPerSec.toFixed(0)}/sec |
| Avg Latency | ${reads.avgTime.toFixed(2)}ms | ${writes.avgTime.toFixed(2)}ms | - |
| P50 Latency | ${reads.p50.toFixed(2)}ms | ${writes.p50.toFixed(2)}ms | - |
| P95 Latency | ${reads.p95.toFixed(2)}ms | ${writes.p95.toFixed(2)}ms | - |
| P99 Latency | ${reads.p99.toFixed(2)}ms | ${writes.p99.toFixed(2)}ms | - |
| Errors | ${reads.errors} (busy: ${reads.busyErrors}) | ${writes.errors} (lock: ${writes.lockErrors}) | - |

**Total Duration:** ${durationSec.toFixed(2)} seconds

## Read Query Breakdown

${queryTypeTable}

## Charts

### Read vs Write Latency Comparison

This chart compares latency percentiles (P50, P95, P99) between read and write operations. It shows how read and write latencies differ under concurrent load.

${generateReadWriteLatencyChart(reads, writes)}

### Throughput Comparison

This chart compares the throughput of reads, writes, and combined operations. It shows the relative performance of read vs write operations.

${generateThroughputChart(reads, writes, combined)}

### Average Latency by Query Type

This chart shows the average latency for each read query type. It helps identify which queries are the slowest.

${generateQueryTypeLatencyChart(reads)}

### P95 Latency by Query Type

This chart shows the P95 latency (95th percentile) for each read query type. It highlights the worst-case performance for each query type.

${generateQueryTypeP95Chart(reads)}

### Query Type Distribution

This chart shows the distribution of query types executed during the test. It helps verify that queries are evenly distributed.

${generateQueryTypeDistributionChart(reads)}

### Error Rates

This chart compares error rates between reads (SQLITE_BUSY errors) and writes (lock errors). It helps identify contention issues.

${generateErrorRateChart(reads, writes)}

### Success Rate Comparison

This chart compares the success rate of read vs write operations. Both should ideally be at 100%.

${generateMixedSuccessRateChart(reads, writes)}

## Key Observations

### Read Performance
- **${reads.successful.toLocaleString()}** successful reads out of ${reads.total.toLocaleString()} (${reads.successRate.toFixed(1)}% success rate)
- Average read latency: **${reads.avgTime.toFixed(2)}ms**, P99: **${reads.p99.toFixed(2)}ms**
- Read throughput: **${reads.readsPerSec.toFixed(0)} reads/sec**
${reads.busyErrors > 0 ? `- ⚠️ ${reads.busyErrors} SQLITE_BUSY errors during reads` : '- ✅ No busy errors during reads (WAL mode working well)'}

### Write Performance
- **${writes.successful.toLocaleString()}** successful writes out of ${writes.total.toLocaleString()} (${writes.successRate.toFixed(1)}% success rate)
- Average write latency: **${writes.avgTime.toFixed(2)}ms**, P99: **${writes.p99.toFixed(2)}ms**
- Write throughput: **${writes.writesPerSec.toFixed(0)} writes/sec**
${writes.lockErrors > 0 ? `- ⚠️ ${writes.lockErrors} lock errors during writes` : '- ✅ No lock errors during writes'}

### Combined Throughput
- Total operations completed: **${combined.totalOps.toLocaleString()}**
- Combined throughput: **${combined.opsPerSec.toFixed(0)} ops/sec**

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

</details>
`;
}

function isMixedResults(data: unknown): data is MixedResults {
    return typeof data === 'object' && data !== null && 'reads' in data && 'writes' in data && 'combined' in data;
}

/**
 * Generate a markdown report from test results
 */
export function generateReport(config: ReportConfig): void {
    console.log(`Loading results from ${config.resultsPath}...`);
    const content = readFileSync(config.resultsPath, "utf-8");
    const results = JSON.parse(content);

    console.log("Generating markdown with Mermaid charts...");
    
    let markdown: string;
    if (isMixedResults(results)) {
        markdown = generateMixedMarkdown(results);
    } else {
        markdown = generateMarkdown(results as TestResults);
    }

    mkdirSync(dirname(config.outputPath), { recursive: true });
    writeFileSync(config.outputPath, markdown);

    console.log(`Report generated: ${config.outputPath}`);
}

