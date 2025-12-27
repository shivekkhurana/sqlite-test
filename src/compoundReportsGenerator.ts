import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MixedResults } from "./reportGenerator";

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

/**
 * Load all mixed read/write result files
 */
function loadMixedResults(resultsDir: string): MixedResults[] {
    const files = readdirSync(resultsDir);
    const mixedFiles = files
        .filter(f => f.startsWith("mixed-r") && f.endsWith(".json") && f !== "mixed-read-write.json")
        .map(f => join(resultsDir, f));

    const results: MixedResults[] = [];
    for (const file of mixedFiles) {
        try {
            const content = readFileSync(file, "utf-8");
            const data = JSON.parse(content);
            if (data.reads && data.writes && data.combined) {
                results.push(data as MixedResults);
            }
        } catch (error) {
            console.warn(`Failed to load ${file}:`, error);
        }
    }

    // Sort by read workers (ascending) for consistent ordering
    results.sort((a, b) => {
        const aReadWorkers = a.configuration.readWorkers || 0;
        const bReadWorkers = b.configuration.readWorkers || 0;
        if (aReadWorkers !== bReadWorkers) {
            return aReadWorkers - bReadWorkers;
        }
        // If read workers are the same, sort by write workers
        const aWriteWorkers = a.configuration.writeWorkers || 0;
        const bWriteWorkers = b.configuration.writeWorkers || 0;
        return aWriteWorkers - bWriteWorkers;
    });

    return results;
}

/**
 * Generate letter labels (A0, B0, C0...Z0, A1, B1, etc.) for configurations
 */
function generateLabels(count: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
        const letterIndex = i % 26;
        const numberIndex = Math.floor(i / 26);
        const letter = String.fromCharCode(65 + letterIndex); // A=65, B=66, etc.
        labels.push(`${letter}${numberIndex}`);
    }
    return labels;
}

/**
 * Generate bar chart for reads throughput
 */
function generateReadsThroughputChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const readsPerSec = results.map(r => r.reads.readsPerSec);
    const maxThroughput = Math.max(...readsPerSec);
    const yAxisMax = roundUpToNiceNumber(maxThroughput);

    return `\`\`\`mermaid
xychart-beta
    title "Reads Throughput by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Reads/sec" 0 --> ${yAxisMax}
    bar [${readsPerSec.map(v => v.toFixed(0)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for writes throughput
 */
function generateWritesThroughputChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const writesPerSec = results.map(r => r.writes.writesPerSec);
    const maxThroughput = Math.max(...writesPerSec);
    const yAxisMax = roundUpToNiceNumber(maxThroughput);

    return `\`\`\`mermaid
xychart-beta
    title "Writes Throughput by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Writes/sec" 0 --> ${yAxisMax}
    bar [${writesPerSec.map(v => v.toFixed(0)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for total ops throughput
 */
function generateTotalOpsThroughputChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const opsPerSec = results.map(r => r.combined.opsPerSec);
    const maxThroughput = Math.max(...opsPerSec);
    const yAxisMax = roundUpToNiceNumber(maxThroughput);

    return `\`\`\`mermaid
xychart-beta
    title "Total Operations Throughput by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Ops/sec" 0 --> ${yAxisMax}
    bar [${opsPerSec.map(v => v.toFixed(0)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for best case latency (min times) - Reads
 */
function generateLatencyBestCaseReadChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const readMinTimes = results.map(r => r.reads.minTime);
    
    const maxLatency = Math.max(...readMinTimes);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Read Latency: Best Case (Min) by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${readMinTimes.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for best case latency (min times) - Writes
 */
function generateLatencyBestCaseWriteChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const writeMinTimes = results.map(r => r.writes.minTime);
    
    const maxLatency = Math.max(...writeMinTimes);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Write Latency: Best Case (Min) by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${writeMinTimes.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for worst case latency (max times) - Reads
 */
function generateLatencyWorstCaseReadChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const readMaxTimes = results.map(r => r.reads.maxTime);
    
    const maxLatency = Math.max(...readMaxTimes);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Read Latency: Worst Case (Max) by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${readMaxTimes.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for worst case latency (max times) - Writes
 */
function generateLatencyWorstCaseWriteChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const writeMaxTimes = results.map(r => r.writes.maxTime);
    
    const maxLatency = Math.max(...writeMaxTimes);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Write Latency: Worst Case (Max) by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${writeMaxTimes.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for average latency - Reads
 */
function generateLatencyAverageReadChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const readAvg = results.map(r => r.reads.avgTime);
    
    const maxLatency = Math.max(...readAvg);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Read Latency: Average by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${readAvg.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for average latency - Writes
 */
function generateLatencyAverageWriteChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const writeAvg = results.map(r => r.writes.avgTime);
    
    const maxLatency = Math.max(...writeAvg);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Write Latency: Average by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${writeAvg.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for P50 latency (median) - Reads
 */
function generateLatencyP50ReadChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const readP50 = results.map(r => r.reads.p50);
    
    const maxLatency = Math.max(...readP50);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Read Latency: P50 (Median) by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${readP50.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for P50 latency (median) - Writes
 */
function generateLatencyP50WriteChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const writeP50 = results.map(r => r.writes.p50);
    
    const maxLatency = Math.max(...writeP50);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Write Latency: P50 (Median) by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${writeP50.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for P95 latency - Reads
 */
function generateLatencyP95ReadChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const readP95 = results.map(r => r.reads.p95);
    
    const maxLatency = Math.max(...readP95);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Read Latency: P95 by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${readP95.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for P95 latency - Writes
 */
function generateLatencyP95WriteChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const writeP95 = results.map(r => r.writes.p95);
    
    const maxLatency = Math.max(...writeP95);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    return `\`\`\`mermaid
xychart-beta
    title "Write Latency: P95 by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Latency (ms)" 0 --> ${yAxisMax}
    bar [${writeP95.map(v => v.toFixed(2)).join(", ")}]
\`\`\``;
}

/**
 * Generate bar chart for errors (read errors and write errors as separate bars)
 */
function generateErrorsChart(results: MixedResults[], labels: string[]): string {
    const labelStrings = labels.map(l => `"${l}"`);
    const readErrors = results.map(r => r.reads.busyErrors);
    const writeErrors = results.map(r => r.writes.lockErrors);
    
    const maxErrors = Math.max(...readErrors, ...writeErrors, 1);
    const yAxisMax = roundUpToNiceNumber(maxErrors);

    return `\`\`\`mermaid
xychart-beta
    title "Errors by Configuration"
    x-axis [${labelStrings.join(", ")}]
    y-axis "Error Count" 0 --> ${yAxisMax}
    bar "Read Errors (Busy)" [${readErrors.join(", ")}]
    bar "Write Errors (Lock)" [${writeErrors.join(", ")}]
\`\`\``;
}

/**
 * Parse config ID to extract components for legend
 */
function parseConfigId(configId: string): {
    readWorkers: string;
    writeWorkers: string;
    totalReads: string;
    totalWrites: string;
    cacheSize: string;
} | null {
    // Format: r10_w2_R200k_W20k_c16mb
    const match = configId.match(/^r(\d+)_w(\d+)_R([\dkm]+)_W([\dkm]+)_c(\d+mb)$/);
    if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5]) return null;

    return {
        readWorkers: match[1],
        writeWorkers: match[2],
        totalReads: match[3],
        totalWrites: match[4],
        cacheSize: match[5]
    };
}

/**
 * Generate legend explaining config ID format
 */
function generateConfigLegend(results: MixedResults[]): string {
    if (results.length === 0) return "";

    const firstConfigId = results[0]?.configuration?.id;
    if (!firstConfigId) {
        return "**Config ID Format:** `rX_wY_R..._W..._c...mb`\n\nWhere:\n- `rX` = number of read workers\n- `wY` = number of write workers\n- `R...` = total reads (e.g., 200k = 200,000)\n- `W...` = total writes (e.g., 20k = 20,000)\n- `c...mb` = cache size in megabytes";
    }

    const firstConfig = parseConfigId(firstConfigId);
    if (!firstConfig) {
        return "**Config ID Format:** `rX_wY_R..._W..._c...mb`\n\nWhere:\n- `rX` = number of read workers\n- `wY` = number of write workers\n- `R...` = total reads (e.g., 200k = 200,000)\n- `W...` = total writes (e.g., 20k = 20,000)\n- `c...mb` = cache size in megabytes";
    }

    return `**Config ID Format:** \`rX_wY_R..._W..._c...mb\`

Where:
- \`rX\` = number of read workers (e.g., r10 = 10 read workers)
- \`wY\` = number of write workers (e.g., w2 = 2 write workers)
- \`R...\` = total reads per worker (e.g., R200k = 200,000 reads per worker)
- \`W...\` = total writes per worker (e.g., W20k = 20,000 writes per worker)
- \`c...mb\` = cache size in megabytes (e.g., c16mb = 16 MB cache)

**Example:** \`r10_w2_R200k_W20k_c16mb\` means:
- 10 read workers
- 2 write workers
- 200,000 reads per read worker (2,000,000 total reads)
- 20,000 writes per write worker (40,000 total writes)
- 16 MB cache size`;
}

/**
 * Generate the compound report markdown
 */
function generateCompoundReportMarkdown(results: MixedResults[]): string {
    if (results.length === 0) {
        return "# Mixed Read/Write Throughput Analysis\n\nNo results found.";
    }

    const timestamp = new Date().toLocaleString();
    const labels = generateLabels(results.length);

    return `# Mixed Read/Write Throughput Analysis

**Generated:** ${timestamp}

## Configuration Legend

${generateConfigLegend(results)}

## Throughput Charts

### Reads Throughput

This chart shows the read operations per second for each configuration.

${generateReadsThroughputChart(results, labels)}

### Writes Throughput

This chart shows the write operations per second for each configuration.

${generateWritesThroughputChart(results, labels)}

### Total Operations Throughput

This chart shows the combined (reads + writes) operations per second for each configuration.

${generateTotalOpsThroughputChart(results, labels)}

## Latency Charts

### Best Case Latency (Min)

#### Read Latency: Best Case (Min)

This chart shows the minimum (best case) latency for read operations across all configurations.

${generateLatencyBestCaseReadChart(results, labels)}

#### Write Latency: Best Case (Min)

This chart shows the minimum (best case) latency for write operations across all configurations.

${generateLatencyBestCaseWriteChart(results, labels)}

### Worst Case Latency (Max)

#### Read Latency: Worst Case (Max)

This chart shows the maximum (worst case) latency for read operations across all configurations.

${generateLatencyWorstCaseReadChart(results, labels)}

#### Write Latency: Worst Case (Max)

This chart shows the maximum (worst case) latency for write operations across all configurations.

${generateLatencyWorstCaseWriteChart(results, labels)}

### Average Latency

#### Read Latency: Average

This chart shows the average latency for read operations across all configurations.

${generateLatencyAverageReadChart(results, labels)}

#### Write Latency: Average

This chart shows the average latency for write operations across all configurations.

${generateLatencyAverageWriteChart(results, labels)}

### P50 Latency (Median)

#### Read Latency: P50 (Median)

This chart shows the 50th percentile (median) latency for read operations across all configurations.

${generateLatencyP50ReadChart(results, labels)}

#### Write Latency: P50 (Median)

This chart shows the 50th percentile (median) latency for write operations across all configurations.

${generateLatencyP50WriteChart(results, labels)}

### P95 Latency

#### Read Latency: P95

This chart shows the 95th percentile latency for read operations across all configurations.

${generateLatencyP95ReadChart(results, labels)}

#### Write Latency: P95

This chart shows the 95th percentile latency for write operations across all configurations.

${generateLatencyP95WriteChart(results, labels)}

## Error Analysis

### Errors by Configuration

This chart shows the number of errors for read operations (SQLITE_BUSY errors) and write operations (lock errors) across all configurations. Read errors combine busy errors, and write errors combine lock errors.

${generateErrorsChart(results, labels)}

## Summary Table

| Label | Config ID | Read Workers | Write Workers | Cache Size | Reads/sec | Writes/sec | Total Ops/sec | Read Errors | Write Errors |
|-------|-----------|--------------|---------------|------------|-----------|------------|---------------|-------------|--------------|
${results.map((r, i) => {
    const config = r.configuration;
    const cacheSizeMB = Math.abs(config.cacheSize) / 1000;
    return `| ${labels[i]} | ${config.id} | ${config.readWorkers} | ${config.writeWorkers} | ${cacheSizeMB} MB | ${r.reads.readsPerSec.toFixed(0)} | ${r.writes.writesPerSec.toFixed(0)} | ${r.combined.opsPerSec.toFixed(0)} | ${r.reads.busyErrors} | ${r.writes.lockErrors} |`;
}).join("\n")}
`;
}

/**
 * Generate compound report for mixed read/write results
 */
export function generateCompoundReport(config: {
    resultsDir: string;
    outputPath: string;
}): void {
    console.log(`Loading mixed read/write results from ${config.resultsDir}...`);
    const results = loadMixedResults(config.resultsDir);
    
    if (results.length === 0) {
        console.warn("No mixed read/write results found!");
        return;
    }

    console.log(`Found ${results.length} mixed read/write configurations`);
    console.log("Generating compound report with Mermaid charts...");
    
    const markdown = generateCompoundReportMarkdown(results);

    mkdirSync(dirname(config.outputPath), { recursive: true });
    writeFileSync(config.outputPath, markdown);

    console.log(`Compound report generated: ${config.outputPath}`);
}

