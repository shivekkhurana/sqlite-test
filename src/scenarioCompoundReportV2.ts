import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TestResults, Configuration } from "./reportGenerator";



/**
 * Scenario result with all configurations and extracted settings
 */
interface ScenarioResult {
    scenarioName: string;
    configurations: Configuration[];
    databaseSettings: string;
    connectionSettings: string;
}

/**
 * Load all scenario result files (excluding mixed results)
 */
function loadScenarioResults(resultsDir: string, scenariosDir: string): ScenarioResult[] {
    const files = readdirSync(resultsDir);
    const scenarioFiles = files
        .filter(
            (f) =>
                f.endsWith(".json") &&
                !f.startsWith("mixed-") &&
                !f.startsWith("turso-") &&
                !f.startsWith("postgres-") &&
                f !== "mixed-read-write.json" &&
                f !== "postgres-read-write.json"
        )
        .map((f) => join(resultsDir, f));

    const results: ScenarioResult[] = [];

    for (const file of scenarioFiles) {
        try {
            const content = readFileSync(file, "utf-8");
            const data = JSON.parse(content) as TestResults;

            if (!data.configurations || data.configurations.length === 0) {
                continue;
            }

            const filename = file.split(/[/\\]/).pop()?.replace(".json", "") || "";
            const scenarioName = filename
                .split("-")
                .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
                .join("");

            const { databaseSettings, connectionSettings } = extractSettingsFromScenario(scenarioName, scenariosDir);

            for (const config of data.configurations) {
                results.push({
                    scenarioName,
                    configurations: [config],
                    databaseSettings,
                    connectionSettings,
                });
            }
        } catch (error) {
            console.warn(`Failed to load ${file}:`, error);
        }
    }

    results.sort((a, b) => {
        const nameCompare = a.scenarioName.localeCompare(b.scenarioName);
        if (nameCompare !== 0) return nameCompare;
        const aConcurrency = a.configurations[0]?.concurrency || 0;
        const bConcurrency = b.configurations[0]?.concurrency || 0;
        return aConcurrency - bConcurrency;
    });

    return results;
}

/**
 * Extract PRAGMA settings from scenario setup.ts and worker.ts files
 */
function extractSettingsFromScenario(
    scenarioName: string,
    scenariosDir: string
): { databaseSettings: string; connectionSettings: string } {
    const setupPath = join(scenariosDir, scenarioName, "setup.ts");
    const workerPath = join(scenariosDir, scenarioName, "worker.ts");

    const databaseSettings: string[] = [];
    const connectionSettings: string[] = [];

    if (existsSync(setupPath)) {
        try {
            const setupContent = readFileSync(setupPath, "utf-8");
            const journalMatch = setupContent.match(/\.pragma\s*\(\s*['"]journal_mode\s*=\s*(\w+)['"]\s*\)/i);
            if (journalMatch && journalMatch[1]) databaseSettings.push(`journal_mode=${journalMatch[1]}`);
            const syncMatch = setupContent.match(/\.pragma\s*\(\s*['"]synchronous\s*=\s*(\w+)['"]\s*\)/i);
            if (syncMatch && syncMatch[1]) databaseSettings.push(`sync=${syncMatch[1]}`);
        } catch (error) {
            // ignore
        }
    }

    if (existsSync(workerPath)) {
        try {
            const workerContent = readFileSync(workerPath, "utf-8");
            const busyTimeoutMatch = workerContent.match(/\.pragma\s*\(\s*['"]busy_timeout\s*=\s*(\d+)['"]\s*\)/i);
            if (busyTimeoutMatch && busyTimeoutMatch[1]) connectionSettings.push(`busy_timeout=${busyTimeoutMatch[1]}ms`);
            const autocheckpointMatch = workerContent.match(
                /\.pragma\s*\(\s*['"]wal_autocheckpoint\s*=\s*(\d+)['"]\s*\)/i
            );
            if (autocheckpointMatch && autocheckpointMatch[1])
                connectionSettings.push(`wal_autocheckpoint=${autocheckpointMatch[1]}`);
            const mmapMatch = workerContent.match(/\.pragma\s*\(\s*['"]mmap_size\s*=\s*(\d+)['"]\s*\)/i);
            if (mmapMatch && mmapMatch[1]) connectionSettings.push(`mmap=${parseInt(mmapMatch[1]) / 1e9}GB`);
        } catch (error) {
            // ignore
        }
    }

    return {
        databaseSettings: databaseSettings.length > 0 ? databaseSettings.join(", ") : "defaults",
        connectionSettings: connectionSettings.length > 0 ? connectionSettings.join(", ") : "none",
    };
}

const OPTIMIZATION_STAGES = [
    { id: "A", name: "base0", label: "Baseline", description: "SQLite defaults, no busy timeout", color: "#e74c3c" }, // Red
    { id: "B", name: "busyTimeout1", label: "Busy Timeout 5s", description: "PRAGMA busy_timeout = 5000ms", color: "#d35400" }, // Pumpkin
    { id: "C", name: "busyTimeout2000", label: "Busy Timeout 2s", description: "PRAGMA busy_timeout = 2000ms", color: "#f39c12" }, // Orange
    { id: "D", name: "busyTimeout400", label: "Busy Timeout 400ms", description: "PRAGMA busy_timeout = 400ms", color: "#8e44ad" }, // Purple
    { id: "E", name: "wal", label: "WAL Mode", description: "journal_mode=WAL, busy_timeout=2000ms", color: "#27ae60" }, // Green
    {
        id: "F",
        name: "walSyncNormal",
        label: "WAL + Sync NORMAL",
        description: "journal_mode=WAL, synchronous=NORMAL, busy_timeout=2000ms",
        color: "#00bcd4", // Bright Cyan
    },
    {
        id: "G",
        name: "walSyncNormalAutocheckpoint2000",
        label: "WAL + NORMAL + Checkpoint 2k",
        description: "wal_autocheckpoint=2000",
        color: "#2980b9", // Dark Blue
    },
    {
        id: "H",
        name: "walSyncNormalAutocheckpoint4000",
        label: "WAL + NORMAL + Checkpoint 4k",
        description: "wal_autocheckpoint=4000",
        color: "#e84393", // Pink
    },
    {
        id: "I",
        name: "walSyncNormalAutocheckpoint4000Mmap1gb",
        label: "WAL + NORMAL + Checkpoint 4k + 1GB MMAP",
        description: "mmap_size=1GB",
        color: "#2c3e50", // Midnight Blue
    },
] as const;

function buildIndex(results: ScenarioResult[]): {
    uniqueScenarios: Map<string, ScenarioResult>;
    scenarioList: ScenarioResult[];
    byScenario: Map<string, Map<number, ScenarioResult>>;
    concurrencyLevels: number[];
} {
    const uniqueScenarios = new Map<string, ScenarioResult>();
    for (const r of results) if (!uniqueScenarios.has(r.scenarioName)) uniqueScenarios.set(r.scenarioName, r);

    const scenarioList = Array.from(uniqueScenarios.values()).sort((a, b) => a.scenarioName.localeCompare(b.scenarioName));

    const byScenario = new Map<string, Map<number, ScenarioResult>>();
    const concurrencySet = new Set<number>();

    for (const r of results) {
        const concurrency = r.configurations[0]?.concurrency;
        if (concurrency === undefined) continue;
        concurrencySet.add(concurrency);
        if (!byScenario.has(r.scenarioName)) byScenario.set(r.scenarioName, new Map());
        byScenario.get(r.scenarioName)!.set(concurrency, r);
    }

    const concurrencyLevels = Array.from(concurrencySet).sort((a, b) => a - b);
    return { uniqueScenarios, scenarioList, byScenario, concurrencyLevels };
}

function chartId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generates a Performance Chart for a specific scenario:
 * - Line chart for Latency (P99) vs Number of Workers
 * - Bar chart for Error Counts vs Number of Workers
 * - Both on log scale
 */
function generateScenarioChart(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[],
    scenarioName: string,
    chartIdSuffix: string
): string {
    const scenarioData = byScenario.get(scenarioName);
    
    if (!scenarioData) {
        return `<div class="error-box">Scenario '${scenarioName}' not found.</div>`;
    }

    const data: any[] = [];
    for (const level of concurrencyLevels) {
        const result = scenarioData.get(level);
        if (!result) continue;
        
        const metrics = result.configurations[0]?.metrics;
        data.push({
            concurrency: level,
            latency: metrics?.p99 ?? 0,
            errorCount: metrics?.lockErrors ?? 0
        });
    }

    const id = chartId(`perf-${chartIdSuffix}`);
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: `${scenarioName} Performance - Latency vs Errors`,
        data: { values: data },
        width: 800,
        height: 400,
        encoding: {
            x: { field: "concurrency", type: "ordinal", title: "Number of Workers (Concurrency)" }
        },
        layer: [
            {
                // Error Data Layer (Bars + Labels)
                encoding: {
                    y: {
                        field: "errorCount",
                        type: "quantitative",
                        title: "Error Counts",
                        scale: { type: "symlog", constant: 1, domainMin: 0 },
                        axis: null // No axis for errors, labels on bars
                    }
                },
                layer: [
                    {
                        mark: { type: "bar", color: "#e74c3c", opacity: 0.5, tooltip: true },
                        encoding: {
                            tooltip: [
                                { field: "concurrency", title: "Workers" },
                                { field: "errorCount", title: "Errors" }
                            ]
                        }
                    },
                    {
                        mark: { type: "text", align: "center", baseline: "bottom", dy: -5, fontSize: 11, font: "sans-serif" },
                        encoding: {
                            text: { field: "errorCount", type: "quantitative" },
                            color: { value: "#e74c3c" }
                        },
                        transform: [{ filter: "datum.errorCount > 0" }]
                    }
                ]
            },
            {
                // Latency Layer (Line)
                mark: { type: "line", point: true, color: "#2980b9", tooltip: true },
                encoding: {
                    y: {
                        field: "latency",
                        type: "quantitative",
                        title: "P99 Latency (ms)",
                        scale: { type: "log", domainMin: 1 },
                        axis: { titleColor: "#2980b9", grid: true, orient: "left" }
                    },
                     tooltip: [
                         { field: "concurrency", title: "Workers" },
                         { field: "latency", title: "P99 Latency (ms)" }
                    ]
                }
            }
        ],
        resolve: { scale: { y: "independent" } }
    };

    return `
    <div id="${id}" class="chart-container"></div>
    <script>
        (function() {
            const spec = ${JSON.stringify(spec)};
            vegaEmbed('#${id}', spec).catch(console.error);
        })();
    </script>
    `;
}

// Derive timeout scenarios/colors from the main stages
const TIMEOUT_SCENARIOS = [
    { id: "busyTimeout400", label: "400ms" }, 
    { id: "busyTimeout2000", label: "2000ms" },
    { id: "busyTimeout1", label: "5000ms" }   
].map(s => {
    const stage = OPTIMIZATION_STAGES.find(opt => opt.name === s.id);
    return { ...s, color: stage?.color ?? "#999" };
});

function generateBusyTimeoutComparisonChart(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    
    for (const s of TIMEOUT_SCENARIOS) {
        const scenarioData = byScenario.get(s.id);
        if (!scenarioData) continue;
        
        for (const level of concurrencyLevels) {
            const result = scenarioData.get(level);
            if (!result) continue; // Skip if this concurrency level failed or doesn't exist for this scenario
            
            const metrics = result.configurations[0]?.metrics;
            data.push({
                concurrency: level,
                scenario: s.label,
                color: s.color,
                latency: metrics?.p99 ?? 0,
                errorCount: metrics?.lockErrors ?? 0
            });
        }
    }

    const id = chartId("busy-timeout-comparison");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Busy Timeout Comparison - Latency vs Errors",
        data: { values: data },
        width: 800,
        height: 400,
        resolve: { scale: { y: "independent" } },
        layer: [
            {
                // Layer 1: Errors (Bars) -> Right Axis
                mark: { 
                    type: "bar", 
                    fillOpacity: 0.6,
                    strokeWidth: 2,
                    cursor: "pointer",
                    tooltip: true
                },
                encoding: {
                    x: { field: "concurrency", type: "ordinal", title: "Number of Workers" },
                    xOffset: { field: "scenario", sort: ["400ms", "2000ms", "5000ms"] },
                    y: {
                        field: "errorCount",
                        type: "quantitative",
                        title: "Error Counts",
                        scale: { type: "symlog", constant: 1, domainMin: 0 },
                        axis: { 
                            titleColor: "#e74c3c", 
                            orient: "right", 
                            grid: false,
                            titleFontWeight: "bold"
                        }
                    },
                    fill: { field: "color", scale: null },
                    stroke: { value: "#e74c3c" },
                    tooltip: [
                        { field: "scenario", title: "Timeout" },
                        { field: "concurrency", title: "Workers" },
                        { field: "errorCount", title: "Errors" }
                    ]
                }
            },
            {
                // Layer 2: Error Labels -> Right Axis (Must share encoding with bars)
                mark: { 
                    type: "text", 
                    fontSize: 10, 
                    fontWeight: "bold",
                    dy: -10, 
                    align: "center"
                },
                encoding: {
                    x: { field: "concurrency", type: "ordinal" },
                    xOffset: { field: "scenario", sort: ["400ms", "2000ms", "5000ms"] },
                    y: { 
                        field: "errorCount", 
                        type: "quantitative",
                        axis: null // explicitly hide axis for labels
                    }, 
                    text: { field: "errorCount", type: "quantitative" },
                    color: { value: "black" }
                },
                transform: [{ filter: "datum.errorCount > 0" }]
            },
            {
                // Layer 3: Latency (Lines) -> Left Axis
                mark: { type: "line", point: true, strokeWidth: 3 },
                encoding: {
                    x: { field: "concurrency", type: "ordinal" },
                    y: {
                        field: "latency",
                        type: "quantitative",
                        title: "P99 Latency (ms)",
                        scale: { type: "log", domainMin: 1 },
                        axis: { 
                            titleColor: "#333", 
                            grid: true, 
                            orient: "left",
                            titleFontWeight: "bold"
                        }
                    },
                    color: { 
                        field: "scenario", 
                        type: "nominal", 
                        scale: { 
                            domain: TIMEOUT_SCENARIOS.map(s => s.label), 
                            range: TIMEOUT_SCENARIOS.map(s => s.color) 
                        },
                        title: "Timeout Setting"
                    },
                    tooltip: [
                         { field: "scenario", title: "Timeout" },
                         { field: "concurrency", title: "Workers" },
                         { field: "latency", title: "P99 Latency (ms)" }
                    ]
                }
            }
        ]
    };

    return `
    <div id="${id}" class="chart-container"></div>
    <script>
        (function() {
            const spec = ${JSON.stringify(spec)};
            vegaEmbed('#${id}', spec).catch(console.error);
        })();
    </script>
    `;
}

function generateSummaryTable(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const maxConcurrency = concurrencyLevels[concurrencyLevels.length - 1];
    if (maxConcurrency === undefined) return "<p>No concurrency data found.</p>";

    const rows: string[] = [];
    
    // Sort scenarios: look for them in OPTIMIZATION_STAGES first to preserve order, then others
    const scenarios = Array.from(byScenario.keys());
    const sortedScenarios = scenarios.sort((a, b) => {
        const indexA = OPTIMIZATION_STAGES.findIndex(s => s.name === a);
        const indexB = OPTIMIZATION_STAGES.findIndex(s => s.name === b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    for (const scenarioName of sortedScenarios) {
        const scenarioMap = byScenario.get(scenarioName);
        if (!scenarioMap) continue;

        // Use max concurrency available for this scenario, or global max if available
        // Some scenarios might fail at high concurrency, so we take their specific max
        const levels = Array.from(scenarioMap.keys()).sort((a, b) => a - b);
        const currentMax = levels[levels.length - 1];
        
        if (currentMax === undefined) continue;

        const result = scenarioMap.get(currentMax);
        if (!result) continue;

        const m = result.configurations[0]?.metrics;
        if (!m) continue;

        const stageInfo = OPTIMIZATION_STAGES.find(s => s.name === scenarioName);
        const displayName = stageInfo ? `<strong>${stageInfo.id}: ${stageInfo.label}</strong><br><small>${scenarioName}</small>` : scenarioName;
        const color = stageInfo ? stageInfo.color : "#999999";

        // Format numbers
        const min = m.minTime !== undefined ? m.minTime.toFixed(2) : "-";
        const avg = m.avgTime !== undefined ? m.avgTime.toFixed(2) : "-";
        const p50 = m.p50 !== undefined ? m.p50.toFixed(2) : "-";
        const p95 = m.p95 !== undefined ? m.p95.toFixed(2) : "-";
        const p99 = m.p99 !== undefined ? m.p99.toFixed(2) : "-";
        const max = m.maxTime !== undefined ? m.maxTime.toFixed(2) : "-";
        
        const wps = m.writesPerSec !== undefined ? m.writesPerSec.toFixed(0) : "-";
        const successRate = m.successRate !== undefined ? m.successRate.toFixed(1) : "-";
        const errorCount = m.errors !== undefined ? m.errors : 0;
        const lockErrors = m.lockErrors !== undefined ? m.lockErrors : 0;

        rows.push(`
            <tr>
                <td><div style="width: 20px; height: 20px; background-color: ${color}; border-radius: 4px; border: 1px solid #ddd;"></div></td>
                <td>${displayName}</td>
                <td>${currentMax}</td>
                <td>${wps}</td>
                <td>${min}</td>
                <td>${avg}</td>
                <td>${p50}</td>
                <td>${p95}</td>
                <td>${p99}</td>
                <td>${max}</td>
                <td>${errorCount} (${lockErrors} locks)</td>
                <td>${successRate}%</td>
            </tr>
        `);
    }

    if (rows.length === 0) return "<p>No scenario data available for summary.</p>";

    return `
    <div class="summary-table-container">
        <table class="summary-table">
            <thead>
                <tr>
                    <th style="width: 40px;">Color</th>
                    <th>Scenario</th>
                    <th>Max Workers</th>
                    <th>Writes / Sec</th>
                    <th>Min (ms)</th>
                    <th>Avg (ms)</th>
                    <th>P50 (ms)</th>
                    <th>P95 (ms)</th>
                    <th>P99 (ms)</th>
                    <th>Max (ms)</th>
                    <th>Total Errors</th>
                    <th>Success Rate</th>
                </tr>
            </thead>
            <tbody>
                ${rows.join("")}
            </tbody>
        </table>
    </div>
    `;
}

function generateCompoundReportV2Markdown(results: ScenarioResult[]): string {
    const { byScenario, concurrencyLevels } = buildIndex(results);

    return `<!DOCTYPE html>
<html>
<head>
    <title>Scenario Compound Report V2</title>
    <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
    <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
    <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px auto; max-width: 1200px; line-height: 1.6; color: #333; }
        h1, h2 { color: #2c3e50; }
        .chart-container { width: 100%; margin: 20px 0; min-height: 400px; }
        .error-box { background: #fee; color: #c00; padding: 10px; border: 1px solid #fcc; border-radius: 4px; }
        .summary-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9em; }
        .summary-table th, .summary-table td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
        .summary-table th { background-color: #f8f9fa; font-weight: 600; }
        .summary-table tr:hover { background-color: #f5f5f5; }
    </style>
</head>
<body>
    <h1>Scenario Compound Report V2</h1>
    
    <h2>Baseline Performance: Latency vs Errors</h2>
    <p>This chart visualizes the P99 latency (Blue Line) and Error Counts (Red Bars) for the baseline "base0" scenario (SQLite Defaults). Both axes use a logarithmic scale.</p>
    ${generateScenarioChart(byScenario, concurrencyLevels, "base0", "base0")}

    <h2>Busy Timeout Comparison (400ms vs 2s vs 5s)</h2>
    <p>Comparing three Busy Timeout configurations. 
    <strong>Lines</strong> represent P99 Latency. 
    <strong>Grouped Bars</strong> represent Error Counts (Red fill with colored borders).</p>
    ${generateBusyTimeoutComparisonChart(byScenario, concurrencyLevels)}

    <h2>Impact of WAL Mode (5000ms Timeout vs WAL)</h2>
    <p>This chart highlights the performance jump when switching from <strong>Journal Mode = DELETE (with 5000ms timeout)</strong> to <strong>Journal Mode = WAL</strong>. 
    It compares both <strong>P99 Latency</strong> and <strong>Average Latency</strong>.</p>
    ${generateWalJumpChart(byScenario, concurrencyLevels)}
    
    <h2>Impact of WAL Mode (Throughput)</h2>
    <p>This chart compares the <strong>Writes Per Second</strong> between DELETE Mode (5000ms Timeout) and WAL Mode.</p>
    ${generateWalThroughputJumpChart(byScenario, concurrencyLevels)}

    <h2>WAL to WAL+Sync Normal: Latency Improvement</h2>
    <p>This chart shows the latency reduction when going from <strong>WAL Mode (E)</strong> to <strong>WAL + Sync NORMAL (F)</strong>. 
    It compares both <strong>P99 Latency</strong> and <strong>Average Latency</strong> across different worker counts.</p>
    ${generateWalToSyncNormalLatencyChart(byScenario, concurrencyLevels)}

    <h2>WAL to WAL+Sync Normal: Throughput Improvement</h2>
    <p>This chart shows the throughput improvement when going from <strong>WAL Mode (E)</strong> to <strong>WAL + Sync NORMAL (F)</strong>. 
    It compares <strong>Writes Per Second</strong> across different worker counts.</p>
    ${generateWalToSyncNormalThroughputChart(byScenario, concurrencyLevels)}

    <h2>Advanced WAL Tuning (F, G, H, I): Latency Comparison</h2>
    <p>This chart compares latency metrics across four advanced WAL configurations:
    <ul>
        <li><strong>F:</strong> WAL + Sync NORMAL</li>
        <li><strong>G:</strong> WAL + NORMAL + Checkpoint 2k</li>
        <li><strong>H:</strong> WAL + NORMAL + Checkpoint 4k</li>
        <li><strong>I:</strong> WAL + NORMAL + Checkpoint 4k + 1GB MMAP</li>
    </ul>
    Both <strong>Average Latency</strong> and <strong>P99 Latency</strong> are shown on separate charts.</p>
    ${generateFGHILatencyChart(byScenario, concurrencyLevels)}

    <h2>Advanced WAL Tuning (F, G, H, I): Throughput Comparison</h2>
    <p>This chart compares <strong>Writes Per Second</strong> across the four advanced WAL configurations (F, G, H, I).</p>
    ${generateFGHIThroughputChart(byScenario, concurrencyLevels)}

    <h2>Summary of All Scenarios (Max Concurrency)</h2>
    <p>Performance metrics at the highest concurrency level tested for each scenario.</p>
    ${generateSummaryTable(byScenario, concurrencyLevels)}

</body>
</html>`;
}

function generateWalJumpChart(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    
    // We strictly compare these two
    const stage1 = OPTIMIZATION_STAGES.find(s => s.name === "busyTimeout1");
    const stage2 = OPTIMIZATION_STAGES.find(s => s.name === "wal");

    const s1 = { id: "busyTimeout1", label: "5s Timeout (Journal=DELETE)", color: stage1?.color ?? "#e74c3c" }; 
    const s2 = { id: "wal", label: "WAL Mode", color: stage2?.color ?? "#1abc9c" };

    const scenario1 = byScenario.get(s1.id);
    const scenario2 = byScenario.get(s2.id);

    if (scenario1 && scenario2) {
        for (const level of concurrencyLevels) {
            const r1 = scenario1.get(level);
            const r2 = scenario2.get(level);
            
            if (!r1 || !r2) continue;
            
            const m1 = r1.configurations[0]?.metrics;
            const m2 = r2.configurations[0]?.metrics;
            if (!m1 || !m2) continue;

            const metrics = [
                { name: "P99 Latency", v1: m1.p99, v2: m2.p99 },
                { name: "Avg Latency", v1: m1.avgTime, v2: m2.avgTime }
            ];

            for (const m of metrics) {
                // 1. Add Line Data Points
                const val1 = Math.max(m.v1, 0.1);
                const val2 = Math.max(m.v2, 0.1);

                data.push({
                    type: 'data',
                    concurrency: level,
                    scenario: s1.label,
                    color: s1.color,
                    metric: m.name,
                    value: val1
                });
                
                data.push({
                    type: 'data',
                    concurrency: level,
                    scenario: s2.label,
                    color: s2.color,
                    metric: m.name,
                    value: val2
                });

                // 2. Add Gap Annotation (if gap is significant)
                if (val2 > 0) {
                    const ratio = val1 / val2;
                    // Only label if there is a meaningful difference (> 1.2x)
                    if (ratio > 1.2) {
                        data.push({
                            type: 'annotation',
                            concurrency: level,
                            metric: m.name,
                            // Geometric mean places text in the visual center of a log-scale gap
                            midpoint: Math.sqrt(val1 * val2), 
                            label: `${((val2 - val1) / val1 * 100).toFixed(0)}%`
                        });
                    }
                }
            }
        }
    }

    const id = chartId("wal-jump");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Impact of WAL Mode - Latency Comparison",
        data: { values: data },
        facet: {
            row: { 
                field: "metric", 
                title: null, 
                header: { labelFontSize: 16, labelFontWeight: "bold" } 
            }
        },
        spec: {
            width: 800,
            height: 300,
            layer: [
                {
                    // Layer 1: Lines
                    transform: [{ filter: "datum.type === 'data'" }],
                    mark: { type: "line", point: true, strokeWidth: 3 },
                    encoding: {
                        x: { 
                            field: "concurrency", 
                            type: "ordinal", 
                            title: "Number of Workers",
                            axis: { labelAngle: 0 }
                        },
                        y: {
                            field: "value",
                            type: "quantitative",
                            title: "Latency (ms)",
                            scale: { type: "log", domainMin: 0.1 },
                            axis: { grid: true }
                        },
                        color: {
                            field: "scenario",
                            type: "nominal",
                            scale: { domain: [s1.label, s2.label], range: [s1.color, s2.color] },
                            title: "Configuration"
                        },
                        tooltip: [
                            { field: "scenario", title: "Config" },
                            { field: "concurrency", title: "Workers" },
                            { field: "value", title: "Latency", format: ".2f" }
                        ]
                    }
                },
                {
                    // Layer 2: Gap Labels (Halo)
                    transform: [{ filter: "datum.type === 'annotation'" }],
                    mark: { 
                        type: "text", 
                        align: "center", 
                        baseline: "middle", 
                        dy: 0, 
                        fontSize: 10, 
                        fontWeight: "bold", 
                        color: "#333",
                        fill: "#fff",
                        stroke: "#fff",
                        strokeWidth: 2
                    },
                    encoding: {
                        x: { field: "concurrency", type: "ordinal" },
                        y: { field: "midpoint", type: "quantitative" },
                        text: { field: "label" }
                    }
                },
                {
                    // Layer 3: Gap Labels (Text)
                    transform: [{ filter: "datum.type === 'annotation'" }],
                    mark: { 
                        type: "text", 
                        align: "center", 
                        baseline: "middle", 
                        dy: 0, 
                        fontSize: 10, 
                        fontWeight: "bold", 
                        color: "#333"
                    },
                    encoding: {
                        x: { field: "concurrency", type: "ordinal" },
                        y: { field: "midpoint", type: "quantitative" },
                        text: { field: "label" }
                    }
                }
            ]
        },
        resolve: { scale: { y: "independent" } }
    };

    return `
    <div id="${id}" class="chart-container" style="display: flex; justify-content: center;"></div>
    <script>
        (function() {
            const spec = ${JSON.stringify(spec)};
            vegaEmbed('#${id}', spec).catch(console.error);
        })();
    </script>
    `;
}

function generateWalThroughputJumpChart(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    
    const stage1 = OPTIMIZATION_STAGES.find(s => s.name === "busyTimeout1");
    const stage2 = OPTIMIZATION_STAGES.find(s => s.name === "wal");

    const s1 = { id: "busyTimeout1", label: "5s Timeout (Journal=DELETE)", color: stage1?.color ?? "#e74c3c" }; 
    const s2 = { id: "wal", label: "WAL Mode", color: stage2?.color ?? "#1abc9c" };

    const scenario1 = byScenario.get(s1.id);
    const scenario2 = byScenario.get(s2.id);

    if (scenario1 && scenario2) {
        for (const level of concurrencyLevels) {
            const r1 = scenario1.get(level);
            const r2 = scenario2.get(level);
            
            if (!r1 || !r2) continue;
            
            const m1 = r1.configurations[0]?.metrics;
            const m2 = r2.configurations[0]?.metrics;
            if (!m1 || !m2) continue;

            const val1 = m1.writesPerSec || 0;
            const val2 = m2.writesPerSec || 0;
            const metricName = "Writes / Sec";

            // 1. Add Data Points
            if (val1 > 0) {
                data.push({
                    type: 'data',
                    concurrency: level,
                    scenario: s1.label,
                    color: s1.color,
                    metric: metricName,
                    value: val1
                });
            }
            
            if (val2 > 0) {
                data.push({
                    type: 'data',
                    concurrency: level,
                    scenario: s2.label,
                    color: s2.color,
                    metric: metricName,
                    value: val2
                });
            }

            // 2. Add Gap Annotation
            if (val1 > 0 && val2 > 0) {
                const pctChange = ((val2 - val1) / val1) * 100;
                
                // Show label if change is significant (> 5% in either direction)
                if (Math.abs(pctChange) > 5) {
                    const sign = pctChange > 0 ? "+" : "";
                    data.push({
                        type: 'annotation',
                        concurrency: level,
                        metric: metricName,
                        // Geometric mean for log scale center
                        midpoint: Math.sqrt(val1 * val2), 
                        label: `${sign}${pctChange.toFixed(0)}%`
                    });
                }
            }
        }
    }

    const id = chartId("wal-throughput");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Impact of WAL Mode - Throughput Comparison",
        data: { values: data },
        width: 800,
        height: 300,
        layer: [
            {
                // Layer 1: Lines
                transform: [{ filter: "datum.type === 'data'" }],
                mark: { type: "line", point: true, strokeWidth: 3 },
                encoding: {
                    x: { 
                        field: "concurrency", 
                        type: "ordinal", 
                        title: "Number of Workers",
                        axis: { labelAngle: 0 }
                    },
                    y: {
                        field: "value",
                        type: "quantitative",
                        title: "Writes / Second",
                        scale: { type: "log", domainMin: 1 },
                        axis: { grid: true }
                    },
                    color: {
                        field: "scenario",
                        type: "nominal",
                        scale: { domain: [s1.label, s2.label], range: [s1.color, s2.color] },
                        title: "Configuration"
                    },
                    tooltip: [
                        { field: "scenario", title: "Config" },
                        { field: "concurrency", title: "Workers" },
                        { field: "value", title: "Writes/Sec", format: ",.0f" }
                    ]
                }
            },
            {
                // Layer 2: Gap Labels (Halo)
                transform: [{ filter: "datum.type === 'annotation'" }],
                mark: { 
                    type: "text", 
                    align: "center", 
                    baseline: "middle", 
                    dy: 0, 
                    fontSize: 10, 
                    fontWeight: "bold", 
                    color: "#333",
                    fill: "#fff",
                    stroke: "#fff",
                    strokeWidth: 2
                },
                encoding: {
                    x: { field: "concurrency", type: "ordinal" },
                    y: { field: "midpoint", type: "quantitative" },
                    text: { field: "label" }
                }
            },
            {
                // Layer 3: Gap Labels (Text)
                transform: [{ filter: "datum.type === 'annotation'" }],
                mark: { 
                    type: "text", 
                    align: "center", 
                    baseline: "middle", 
                    dy: 0, 
                    fontSize: 10, 
                    fontWeight: "bold", 
                    color: "#333"
                },
                encoding: {
                    x: { field: "concurrency", type: "ordinal" },
                    y: { field: "midpoint", type: "quantitative" },
                    text: { field: "label" }
                }
            }
        ]
    };

    return `
    <div id="${id}" class="chart-container" style="display: flex; justify-content: center;"></div>
    <script>
        (function() {
            const spec = ${JSON.stringify(spec)};
            vegaEmbed('#${id}', spec).catch(console.error);
        })();
    </script>
    `;
}

/**
 * Chart 5: Latency improvement from WAL (E) to WAL+Sync Normal (F)
 * Shows P99 and Average latency metrics
 */
function generateWalToSyncNormalLatencyChart(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    
    const stageE = OPTIMIZATION_STAGES.find(s => s.name === "wal");
    const stageF = OPTIMIZATION_STAGES.find(s => s.name === "walSyncNormal");

    const sE = { id: "wal", label: "WAL Mode", color: stageE?.color ?? "#27ae60" }; 
    const sF = { id: "walSyncNormal", label: "WAL + Sync NORMAL", color: stageF?.color ?? "#1abc9c" };

    const scenarioE = byScenario.get(sE.id);
    const scenarioF = byScenario.get(sF.id);

    if (scenarioE && scenarioF) {
        for (const level of concurrencyLevels) {
            const rE = scenarioE.get(level);
            const rF = scenarioF.get(level);
            
            if (!rE || !rF) continue;
            
            const mE = rE.configurations[0]?.metrics;
            const mF = rF.configurations[0]?.metrics;
            if (!mE || !mF) continue;

            const metrics = [
                { name: "P99 Latency", vE: mE.p99, vF: mF.p99 },
                { name: "Avg Latency", vE: mE.avgTime, vF: mF.avgTime }
            ];

            for (const m of metrics) {
                // 1. Add Line Data Points
                const valE = Math.max(m.vE, 0.1);
                const valF = Math.max(m.vF, 0.1);

                data.push({
                    type: 'data',
                    concurrency: level,
                    scenario: sE.label,
                    color: sE.color,
                    metric: m.name,
                    value: valE
                });
                
                data.push({
                    type: 'data',
                    concurrency: level,
                    scenario: sF.label,
                    color: sF.color,
                    metric: m.name,
                    value: valF
                });

                // 2. Add Gap Annotation (if gap is significant)
                if (valF > 0) {
                    const pctChange = ((valF - valE) / valE) * 100;
                    // Only label if there is a meaningful difference (> 5%)
                    if (Math.abs(pctChange) > 5) {
                        const sign = pctChange > 0 ? "+" : "";
                        data.push({
                            type: 'annotation',
                            concurrency: level,
                            metric: m.name,
                            // Geometric mean places text in the visual center of a log-scale gap
                            midpoint: Math.sqrt(valE * valF), 
                            label: `${sign}${pctChange.toFixed(0)}%`
                        });
                    }
                }
            }
        }
    }

    const id = chartId("wal-sync-latency");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "WAL to WAL+Sync Normal - Latency Improvement",
        data: { values: data },
        facet: {
            row: { 
                field: "metric", 
                title: null, 
                header: { labelFontSize: 16, labelFontWeight: "bold" } 
            }
        },
        spec: {
            width: 800,
            height: 300,
            layer: [
                {
                    // Layer 1: Lines
                    transform: [{ filter: "datum.type === 'data'" }],
                    mark: { type: "line", point: true, strokeWidth: 3 },
                    encoding: {
                        x: { 
                            field: "concurrency", 
                            type: "ordinal", 
                            title: "Number of Workers",
                            axis: { labelAngle: 0 }
                        },
                        y: {
                            field: "value",
                            type: "quantitative",
                            title: "Latency (ms)",
                            scale: { type: "log", domainMin: 0.1 },
                            axis: { grid: true }
                        },
                        color: {
                            field: "scenario",
                            type: "nominal",
                            scale: { domain: [sE.label, sF.label], range: [sE.color, sF.color] },
                            title: "Configuration"
                        },
                        tooltip: [
                            { field: "scenario", title: "Config" },
                            { field: "concurrency", title: "Workers" },
                            { field: "value", title: "Latency", format: ".2f" }
                        ]
                    }
                },
                {
                    // Layer 2: Gap Labels (Halo)
                    transform: [{ filter: "datum.type === 'annotation'" }],
                    mark: { 
                        type: "text", 
                        align: "center", 
                        baseline: "middle", 
                        dy: 0, 
                        fontSize: 10, 
                        fontWeight: "bold", 
                        color: "#333",
                        fill: "#fff",
                        stroke: "#fff",
                        strokeWidth: 2
                    },
                    encoding: {
                        x: { field: "concurrency", type: "ordinal" },
                        y: { field: "midpoint", type: "quantitative" },
                        text: { field: "label" }
                    }
                },
                {
                    // Layer 3: Gap Labels (Text)
                    transform: [{ filter: "datum.type === 'annotation'" }],
                    mark: { 
                        type: "text", 
                        align: "center", 
                        baseline: "middle", 
                        dy: 0, 
                        fontSize: 10, 
                        fontWeight: "bold", 
                        color: "#333"
                    },
                    encoding: {
                        x: { field: "concurrency", type: "ordinal" },
                        y: { field: "midpoint", type: "quantitative" },
                        text: { field: "label" }
                    }
                }
            ]
        },
        resolve: { scale: { y: "independent" } }
    };

    return `
    <div id="${id}" class="chart-container" style="display: flex; justify-content: center;"></div>
    <script>
        (function() {
            const spec = ${JSON.stringify(spec)};
            vegaEmbed('#${id}', spec).catch(console.error);
        })();
    </script>
    `;
}

/**
 * Chart 6: Throughput improvement from WAL (E) to WAL+Sync Normal (F)
 * Shows Writes/Second metrics
 */
function generateWalToSyncNormalThroughputChart(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    
    const stageE = OPTIMIZATION_STAGES.find(s => s.name === "wal");
    const stageF = OPTIMIZATION_STAGES.find(s => s.name === "walSyncNormal");

    const sE = { id: "wal", label: "WAL Mode", color: stageE?.color ?? "#27ae60" }; 
    const sF = { id: "walSyncNormal", label: "WAL + Sync NORMAL", color: stageF?.color ?? "#1abc9c" };

    const scenarioE = byScenario.get(sE.id);
    const scenarioF = byScenario.get(sF.id);

    if (scenarioE && scenarioF) {
        for (const level of concurrencyLevels) {
            const rE = scenarioE.get(level);
            const rF = scenarioF.get(level);
            
            if (!rE || !rF) continue;
            
            const mE = rE.configurations[0]?.metrics;
            const mF = rF.configurations[0]?.metrics;
            if (!mE || !mF) continue;

            const valE = mE.writesPerSec || 0;
            const valF = mF.writesPerSec || 0;
            const metricName = "Writes / Sec";

            // 1. Add Data Points
            if (valE > 0) {
                data.push({
                    type: 'data',
                    concurrency: level,
                    scenario: sE.label,
                    color: sE.color,
                    metric: metricName,
                    value: valE
                });
            }
            
            if (valF > 0) {
                data.push({
                    type: 'data',
                    concurrency: level,
                    scenario: sF.label,
                    color: sF.color,
                    metric: metricName,
                    value: valF
                });
            }

            // 2. Add Gap Annotation
            if (valE > 0 && valF > 0) {
                const pctChange = ((valF - valE) / valE) * 100;
                
                // Show label if change is significant (> 5% in either direction)
                if (Math.abs(pctChange) > 5) {
                    const sign = pctChange > 0 ? "+" : "";
                    data.push({
                        type: 'annotation',
                        concurrency: level,
                        metric: metricName,
                        // Geometric mean for log scale center
                        midpoint: Math.sqrt(valE * valF), 
                        label: `${sign}${pctChange.toFixed(0)}%`
                    });
                }
            }
        }
    }

    const id = chartId("wal-sync-throughput");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "WAL to WAL+Sync Normal - Throughput Improvement",
        data: { values: data },
        width: 800,
        height: 300,
        layer: [
            {
                // Layer 1: Lines
                transform: [{ filter: "datum.type === 'data'" }],
                mark: { type: "line", point: true, strokeWidth: 3 },
                encoding: {
                    x: { 
                        field: "concurrency", 
                        type: "ordinal", 
                        title: "Number of Workers",
                        axis: { labelAngle: 0 }
                    },
                    y: {
                        field: "value",
                        type: "quantitative",
                        title: "Writes / Second",
                        scale: { type: "log", domainMin: 1 },
                        axis: { grid: true }
                    },
                    color: {
                        field: "scenario",
                        type: "nominal",
                        scale: { domain: [sE.label, sF.label], range: [sE.color, sF.color] },
                        title: "Configuration"
                    },
                    tooltip: [
                        { field: "scenario", title: "Config" },
                        { field: "concurrency", title: "Workers" },
                        { field: "value", title: "Writes/Sec", format: ",.0f" }
                    ]
                }
            },
            {
                // Layer 2: Gap Labels (Halo)
                transform: [{ filter: "datum.type === 'annotation'" }],
                mark: { 
                    type: "text", 
                    align: "center", 
                    baseline: "middle", 
                    dy: 0, 
                    fontSize: 10, 
                    fontWeight: "bold", 
                    color: "#333",
                    fill: "#fff",
                    stroke: "#fff",
                    strokeWidth: 2
                },
                encoding: {
                    x: { field: "concurrency", type: "ordinal" },
                    y: { field: "midpoint", type: "quantitative" },
                    text: { field: "label" }
                }
            },
            {
                // Layer 3: Gap Labels (Text)
                transform: [{ filter: "datum.type === 'annotation'" }],
                mark: { 
                    type: "text", 
                    align: "center", 
                    baseline: "middle", 
                    dy: 0, 
                    fontSize: 10, 
                    fontWeight: "bold", 
                    color: "#333"
                },
                encoding: {
                    x: { field: "concurrency", type: "ordinal" },
                    y: { field: "midpoint", type: "quantitative" },
                    text: { field: "label" }
                }
            }
        ]
    };

    return `
    <div id="${id}" class="chart-container" style="display: flex; justify-content: center;"></div>
    <script>
        (function() {
            const spec = ${JSON.stringify(spec)};
            vegaEmbed('#${id}', spec).catch(console.error);
        })();
    </script>
    `;
}

/**
 * Chart 7: Combined Latency Chart for Scenarios F, G, H, I
 * Shows both Average and P99 latency on separate facets
 */
function generateFGHILatencyChart(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    
    // Get scenarios F, G, H, I
    const scenarios = [
        OPTIMIZATION_STAGES.find(s => s.id === "F"),
        OPTIMIZATION_STAGES.find(s => s.id === "G"),
        OPTIMIZATION_STAGES.find(s => s.id === "H"),
        OPTIMIZATION_STAGES.find(s => s.id === "I")
    ].filter(s => s !== undefined);

    for (const scenario of scenarios) {
        const scenarioData = byScenario.get(scenario.name);
        if (!scenarioData) continue;

        for (const level of concurrencyLevels) {
            const result = scenarioData.get(level);
            if (!result) continue;

            const metrics = result.configurations[0]?.metrics;
            if (!metrics) continue;

            // Add Average Latency data point
            data.push({
                concurrency: level,
                scenario: scenario.label,
                color: scenario.color,
                metric: "Average Latency",
                value: Math.max(metrics.avgTime || 0, 0.1)
            });

            // Add P99 Latency data point
            data.push({
                concurrency: level,
                scenario: scenario.label,
                color: scenario.color,
                metric: "P99 Latency",
                value: Math.max(metrics.p99 || 0, 0.1)
            });
        }
    }

    const id = chartId("fghi-latency");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Scenarios F, G, H, I - Latency Comparison",
        data: { values: data },
        facet: {
            row: { 
                field: "metric", 
                title: null, 
                header: { labelFontSize: 16, labelFontWeight: "bold" } 
            }
        },
        spec: {
            width: 800,
            height: 300,
            mark: { type: "line", point: true, strokeWidth: 3 },
            encoding: {
                x: { 
                    field: "concurrency", 
                    type: "ordinal", 
                    title: "Number of Workers",
                    axis: { labelAngle: 0 }
                },
                y: {
                    field: "value",
                    type: "quantitative",
                    title: "Latency (ms)",
                    scale: { type: "log", domainMin: 0.1 },
                    axis: { grid: true }
                },
                color: {
                    field: "scenario",
                    type: "nominal",
                    scale: { 
                        domain: scenarios.map(s => s.label), 
                        range: scenarios.map(s => s.color) 
                    },
                    title: "Configuration"
                },
                tooltip: [
                    { field: "scenario", title: "Config" },
                    { field: "concurrency", title: "Workers" },
                    { field: "value", title: "Latency", format: ".2f" }
                ]
            }
        },
        resolve: { scale: { y: "independent" } }
    };

    return `
    <div id="${id}" class="chart-container" style="display: flex; justify-content: center;"></div>
    <script>
        (function() {
            const spec = ${JSON.stringify(spec)};
            vegaEmbed('#${id}', spec).catch(console.error);
        })();
    </script>
    `;
}

/**
 * Chart 8: Throughput Chart for Scenarios F, G, H, I
 * Shows Writes/Second
 */
function generateFGHIThroughputChart(
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    
    // Get scenarios F, G, H, I
    const scenarios = [
        OPTIMIZATION_STAGES.find(s => s.id === "F"),
        OPTIMIZATION_STAGES.find(s => s.id === "G"),
        OPTIMIZATION_STAGES.find(s => s.id === "H"),
        OPTIMIZATION_STAGES.find(s => s.id === "I")
    ].filter(s => s !== undefined);

    for (const scenario of scenarios) {
        const scenarioData = byScenario.get(scenario.name);
        if (!scenarioData) continue;

        for (const level of concurrencyLevels) {
            const result = scenarioData.get(level);
            if (!result) continue;

            const metrics = result.configurations[0]?.metrics;
            if (!metrics) continue;

            const wps = metrics.writesPerSec || 0;
            if (wps > 0) {
                data.push({
                    concurrency: level,
                    scenario: scenario.label,
                    color: scenario.color,
                    value: wps
                });
            }
        }
    }

    const id = chartId("fghi-throughput");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Scenarios F, G, H, I - Throughput Comparison",
        data: { values: data },
        width: 800,
        height: 400,
        mark: { type: "line", point: true, strokeWidth: 3 },
        encoding: {
            x: { 
                field: "concurrency", 
                type: "ordinal", 
                title: "Number of Workers",
                axis: { labelAngle: 0 }
            },
            y: {
                field: "value",
                type: "quantitative",
                title: "Writes / Second",
                scale: { type: "log", domainMin: 1 },
                axis: { grid: true }
            },
            color: {
                field: "scenario",
                type: "nominal",
                scale: { 
                    domain: scenarios.map(s => s.label), 
                    range: scenarios.map(s => s.color) 
                },
                title: "Configuration"
            },
            tooltip: [
                { field: "scenario", title: "Config" },
                { field: "concurrency", title: "Workers" },
                { field: "value", title: "Writes/Sec", format: ",.0f" }
            ]
        }
    };

    return `
    <div id="${id}" class="chart-container" style="display: flex; justify-content: center;"></div>
    <script>
        (function() {
            const spec = ${JSON.stringify(spec)};
            vegaEmbed('#${id}', spec).catch(console.error);
        })();
    </script>
    `;
}

export function generateScenarioCompoundReportV2(config: { resultsDir: string; scenariosDir: string; outputPath: string }): void {
    const results = loadScenarioResults(config.resultsDir, config.scenariosDir);
    if (results.length === 0) {
        console.warn("No scenario results found!");
        return;
    }

    console.log(`Loaded ${results.length} scenario result entries (V2)`);
    const { byScenario, concurrencyLevels } = buildIndex(results);
    console.log(`Found scenarios: ${Array.from(byScenario.keys()).sort().join(", ")}`);

    const html = generateCompoundReportV2Markdown(results);
    mkdirSync(dirname(config.outputPath), { recursive: true });
    writeFileSync(config.outputPath, html);
    console.log(`Compound report V2 generated: ${config.outputPath}`);
}
