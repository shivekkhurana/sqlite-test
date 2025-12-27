import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TestResults, Configuration, Metrics } from "./reportGenerator";

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
        .filter(f => f.endsWith(".json") && !f.startsWith("mixed-") && f !== "mixed-read-write.json")
        .map(f => join(resultsDir, f));

    const results: ScenarioResult[] = [];
    
    for (const file of scenarioFiles) {
        try {
            const content = readFileSync(file, "utf-8");
            const data = JSON.parse(content) as TestResults;
            
            if (!data.configurations || data.configurations.length === 0) {
                continue;
            }

            // Extract scenario name from filename (e.g., "base-0.json" -> "base0")
            // Convert kebab-case to camelCase: "wal-sync-normal" -> "walSyncNormal"
            const filename = file.split(/[/\\]/).pop()?.replace(".json", "") || "";
            const scenarioName = filename
                .split("-")
                .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
                .join("");

            // Extract settings from scenario files
            const { databaseSettings, connectionSettings } = extractSettingsFromScenario(
                scenarioName,
                scenariosDir
            );

            // Include all configurations for this scenario
            for (const config of data.configurations) {
                results.push({
                    scenarioName,
                    configurations: [config],
                    databaseSettings,
                    connectionSettings
                });
            }
        } catch (error) {
            console.warn(`Failed to load ${file}:`, error);
        }
    }

    // Sort by scenario name, then by concurrency level for consistent ordering
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

    // Parse setup.ts for database-level settings
    if (existsSync(setupPath)) {
        try {
            const setupContent = readFileSync(setupPath, "utf-8");
            
            // Extract journal_mode - matches db.pragma('journal_mode = WAL')
            const journalMatch = setupContent.match(/\.pragma\s*\(\s*['"]journal_mode\s*=\s*(\w+)['"]\s*\)/i);
            if (journalMatch && journalMatch[1]) {
                databaseSettings.push(`journal_mode=${journalMatch[1]}`);
            }

            // Extract synchronous - matches db.pragma('synchronous = NORMAL')
            const syncMatch = setupContent.match(/\.pragma\s*\(\s*['"]synchronous\s*=\s*(\w+)['"]\s*\)/i);
            if (syncMatch && syncMatch[1]) {
                databaseSettings.push(`sync=${syncMatch[1]}`);
            }

            // Extract temp_store - matches db.pragma('temp_store = memory')
            const tempStoreMatch = setupContent.match(/\.pragma\s*\(\s*['"]temp_store\s*=\s*(\w+)['"]\s*\)/i);
            if (tempStoreMatch && tempStoreMatch[1]) {
                databaseSettings.push(`temp_store=${tempStoreMatch[1]}`);
            }
        } catch (error) {
            console.warn(`Failed to parse setup.ts for ${scenarioName}:`, error);
        }
    }

    // Parse worker.ts for connection-level settings
    if (existsSync(workerPath)) {
        try {
            const workerContent = readFileSync(workerPath, "utf-8");
            
            // Extract busy_timeout - matches db.pragma('busy_timeout = 2000')
            const busyTimeoutMatch = workerContent.match(/\.pragma\s*\(\s*['"]busy_timeout\s*=\s*(\d+)['"]\s*\)/i);
            if (busyTimeoutMatch && busyTimeoutMatch[1]) {
                const ms = parseInt(busyTimeoutMatch[1], 10);
                connectionSettings.push(`busy_timeout=${ms}ms`);
            }

            // Extract wal_autocheckpoint - matches db.pragma('wal_autocheckpoint = 4000')
            const autocheckpointMatch = workerContent.match(/\.pragma\s*\(\s*['"]wal_autocheckpoint\s*=\s*(\d+)['"]\s*\)/i);
            if (autocheckpointMatch && autocheckpointMatch[1]) {
                connectionSettings.push(`wal_autocheckpoint=${autocheckpointMatch[1]}`);
            }

            // Extract mmap_size - matches db.pragma('mmap_size = 1000000000')
            const mmapMatch = workerContent.match(/\.pragma\s*\(\s*['"]mmap_size\s*=\s*(\d+)['"]\s*\)/i);
            if (mmapMatch && mmapMatch[1]) {
                const bytes = parseInt(mmapMatch[1], 10);
                const gb = bytes / 1000000000;
                if (gb >= 1) {
                    connectionSettings.push(`mmap=${gb}GB`);
                } else {
                    const mb = bytes / 1000000;
                    connectionSettings.push(`mmap=${mb}MB`);
                }
            }

            // Extract cache_size - matches db.pragma('cache_size = -16000')
            const cacheMatch = workerContent.match(/\.pragma\s*\(\s*['"]cache_size\s*=\s*([-\d]+)['"]\s*\)/i);
            if (cacheMatch && cacheMatch[1]) {
                const cacheSize = parseInt(cacheMatch[1], 10);
                const mb = Math.abs(cacheSize) / 1000;
                connectionSettings.push(`cache=${mb}MB`);
            }
        } catch (error) {
            console.warn(`Failed to parse worker.ts for ${scenarioName}:`, error);
        }
    }

    return {
        databaseSettings: databaseSettings.length > 0 ? databaseSettings.join(", ") : "defaults",
        connectionSettings: connectionSettings.length > 0 ? connectionSettings.join(", ") : "none"
    };
}

/**
 * Generate labels for scenarios (A, B, C, etc.)
 */
function generateScenarioLabels(scenarios: ScenarioResult[]): Map<string, string> {
    const labelMap = new Map<string, string>();
    const uniqueScenarios = Array.from(new Set(scenarios.map(r => r.scenarioName))).sort();
    
    for (let i = 0; i < uniqueScenarios.length; i++) {
        const scenarioName = uniqueScenarios[i];
        if (scenarioName) {
            const letter = String.fromCharCode(65 + i); // A=65, B=66, etc.
            labelMap.set(scenarioName, letter);
        }
    }
    
    return labelMap;
}

/**
 * Get label for scenario, with fallback to scenario name
 */
function getLabel(scenarioName: string, labelMap: Map<string, string>): string {
    return labelMap.get(scenarioName) || scenarioName;
}

/**
 * Generate Vega-Lite grouped bar chart for average write latency across all concurrency levels
 */
function generateLatencyAverageChart(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    labelMap: Map<string, string>,
    concurrencyLevels: number[]
): string {
    // Prepare data for Vega-Lite
    const data: Array<{scenario: string; concurrency: number; value: number}> = [];
    
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (scenarioData) {
            for (const level of concurrencyLevels) {
                const result = scenarioData.get(level);
                if (result) {
                    data.push({
                        scenario: getLabel(scenario.scenarioName, labelMap),
                        concurrency: level,
                        value: result.configurations[0]?.metrics.avgTime || 0
                    });
                }
            }
        }
    }

    const maxLatency = Math.max(...data.map(d => d.value), 1);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": "Write Latency: Average by Scenario and Concurrency",
        "data": { "values": data },
        "mark": "bar",
        "encoding": {
            "x": {
                "field": "scenario",
                "type": "ordinal",
                "title": "Scenario",
                "axis": {"labelAngle": 0}
            },
            "y": {
                "field": "value",
                "type": "quantitative",
                "title": "Latency (ms)",
                "scale": {"domain": [0, yAxisMax]}
            },
            "xOffset": {
                "field": "concurrency",
                "type": "ordinal"
            },
            "color": {
                "field": "concurrency",
                "type": "ordinal",
                "title": "Concurrency",
                "scale": {"scheme": "category10"}
            }
        },
        "width": 800,
        "height": 400
    };

    const chartId = `latency-avg-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite grouped bar chart for P95 write latency across all concurrency levels
 */
function generateLatencyP95Chart(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    labelMap: Map<string, string>,
    concurrencyLevels: number[]
): string {
    // Prepare data for Vega-Lite
    const data: Array<{scenario: string; concurrency: number; value: number}> = [];
    
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (scenarioData) {
            for (const level of concurrencyLevels) {
                const result = scenarioData.get(level);
                if (result) {
                    data.push({
                        scenario: getLabel(scenario.scenarioName, labelMap),
                        concurrency: level,
                        value: result.configurations[0]?.metrics.p95 || 0
                    });
                }
            }
        }
    }

    const maxLatency = Math.max(...data.map(d => d.value), 1);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": "Write Latency: P95 by Scenario and Concurrency",
        "data": { "values": data },
        "mark": "bar",
        "encoding": {
            "x": {
                "field": "scenario",
                "type": "ordinal",
                "title": "Scenario",
                "axis": {"labelAngle": 0}
            },
            "y": {
                "field": "value",
                "type": "quantitative",
                "title": "Latency (ms)",
                "scale": {"domain": [0, yAxisMax]}
            },
            "xOffset": {
                "field": "concurrency",
                "type": "ordinal"
            },
            "color": {
                "field": "concurrency",
                "type": "ordinal",
                "title": "Concurrency",
                "scale": {"scheme": "category10"}
            }
        },
        "width": 800,
        "height": 400
    };

    const chartId = `latency-p95-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite grouped bar chart for P99 write latency across all concurrency levels
 */
function generateLatencyP99Chart(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    labelMap: Map<string, string>,
    concurrencyLevels: number[]
): string {
    // Prepare data for Vega-Lite
    const data: Array<{scenario: string; concurrency: number; value: number}> = [];
    
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (scenarioData) {
            for (const level of concurrencyLevels) {
                const result = scenarioData.get(level);
                if (result) {
                    data.push({
                        scenario: getLabel(scenario.scenarioName, labelMap),
                        concurrency: level,
                        value: result.configurations[0]?.metrics.p99 || 0
                    });
                }
            }
        }
    }

    const maxLatency = Math.max(...data.map(d => d.value), 1);
    const yAxisMax = roundUpToNiceNumber(maxLatency);

    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": "Write Latency: P99 by Scenario and Concurrency",
        "data": { "values": data },
        "mark": "bar",
        "encoding": {
            "x": {
                "field": "scenario",
                "type": "ordinal",
                "title": "Scenario",
                "axis": {"labelAngle": 0}
            },
            "y": {
                "field": "value",
                "type": "quantitative",
                "title": "Latency (ms)",
                "scale": {"domain": [0, yAxisMax]}
            },
            "xOffset": {
                "field": "concurrency",
                "type": "ordinal"
            },
            "color": {
                "field": "concurrency",
                "type": "ordinal",
                "title": "Concurrency",
                "scale": {"scheme": "category10"}
            }
        },
        "width": 800,
        "height": 400
    };

    const chartId = `latency-p99-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite grouped bar chart for writes per second across all concurrency levels
 */
function generateOpsPerSecChart(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    labelMap: Map<string, string>,
    concurrencyLevels: number[]
): string {
    // Prepare data for Vega-Lite
    const data: Array<{scenario: string; concurrency: number; value: number}> = [];
    
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (scenarioData) {
            for (const level of concurrencyLevels) {
                const result = scenarioData.get(level);
                if (result) {
                    data.push({
                        scenario: getLabel(scenario.scenarioName, labelMap),
                        concurrency: level,
                        value: result.configurations[0]?.metrics.writesPerSec || 0
                    });
                }
            }
        }
    }

    const maxThroughput = Math.max(...data.map(d => d.value), 1);
    const yAxisMax = roundUpToNiceNumber(maxThroughput);

    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": "Writes Per Second by Scenario and Concurrency",
        "data": { "values": data },
        "mark": "bar",
        "encoding": {
            "x": {
                "field": "scenario",
                "type": "ordinal",
                "title": "Scenario",
                "axis": {"labelAngle": 0}
            },
            "y": {
                "field": "value",
                "type": "quantitative",
                "title": "Writes/sec",
                "scale": {"domain": [0, yAxisMax]}
            },
            "xOffset": {
                "field": "concurrency",
                "type": "ordinal"
            },
            "color": {
                "field": "concurrency",
                "type": "ordinal",
                "title": "Concurrency",
                "scale": {"scheme": "category10"}
            }
        },
        "width": 800,
        "height": 400
    };

    const chartId = `writes-per-sec-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite grouped bar chart for error counts across all concurrency levels
 */
function generateErrorsChart(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    labelMap: Map<string, string>,
    concurrencyLevels: number[]
): string {
    // Prepare data for Vega-Lite
    const data: Array<{scenario: string; concurrency: number; value: number}> = [];
    
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (scenarioData) {
            for (const level of concurrencyLevels) {
                const result = scenarioData.get(level);
                if (result) {
                    data.push({
                        scenario: getLabel(scenario.scenarioName, labelMap),
                        concurrency: level,
                        value: result.configurations[0]?.metrics.lockErrors || 0
                    });
                }
            }
        }
    }

    const maxErrors = Math.max(...data.map(d => d.value), 1);
    const yAxisMax = roundUpToNiceNumber(maxErrors);

    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": "Error Counts by Scenario and Concurrency",
        "data": { "values": data },
        "mark": "bar",
        "encoding": {
            "x": {
                "field": "scenario",
                "type": "ordinal",
                "title": "Scenario",
                "axis": {"labelAngle": 0}
            },
            "y": {
                "field": "value",
                "type": "quantitative",
                "title": "Error Count",
                "scale": {"domain": [0, yAxisMax]}
            },
            "xOffset": {
                "field": "concurrency",
                "type": "ordinal"
            },
            "color": {
                "field": "concurrency",
                "type": "ordinal",
                "title": "Concurrency",
                "scale": {"scheme": "category10"}
            }
        },
        "width": 800,
        "height": 400
    };

    const chartId = `errors-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate the compound report markdown
 */
function generateCompoundReportMarkdown(results: ScenarioResult[]): string {
    if (results.length === 0) {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Scenario Throughput Analysis</title>
</head>
<body>
    <h1>Scenario Throughput Analysis</h1>
    <p>No results found.</p>
</body>
</html>`;
    }

    const timestamp = new Date().toLocaleString();

    // Get unique scenarios for summary table (configuration only)
    const uniqueScenarios = new Map<string, ScenarioResult>();
    for (const result of results) {
        if (!uniqueScenarios.has(result.scenarioName)) {
            uniqueScenarios.set(result.scenarioName, result);
        }
    }
    const scenarioList = Array.from(uniqueScenarios.values()).sort((a, b) => 
        a.scenarioName.localeCompare(b.scenarioName)
    );

    // Generate label map for all scenarios
    const labelMap = generateScenarioLabels(scenarioList);

    // Group results by scenario, then by concurrency level
    const byScenario = new Map<string, Map<number, ScenarioResult>>();
    const concurrencySet = new Set<number>();
    
    for (const result of results) {
        const concurrency = result.configurations[0]?.concurrency;
        if (concurrency !== undefined) {
            concurrencySet.add(concurrency);
            
            if (!byScenario.has(result.scenarioName)) {
                byScenario.set(result.scenarioName, new Map());
            }
            byScenario.get(result.scenarioName)!.set(concurrency, result);
        }
    }

    // Sort concurrency levels
    const concurrencyLevels = Array.from(concurrencySet).sort((a, b) => a - b);

    return `<!DOCTYPE html>
<html>
<head>
    <title>Scenario Throughput Analysis</title>
    <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
    <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
    <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2, h3 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Scenario Throughput Analysis</h1>
    <p><strong>Generated:</strong> ${timestamp}</p>

    <h2>Summary Table</h2>
    <table>
        <thead>
            <tr>
                <th>Label</th>
                <th>Scenario Name</th>
                <th>Database Settings</th>
                <th>Connection Settings</th>
            </tr>
        </thead>
        <tbody>
${scenarioList.map(r => {
    const label = getLabel(r.scenarioName, labelMap);
    return `            <tr>
                <td>${label}</td>
                <td>${r.scenarioName}</td>
                <td>${r.databaseSettings}</td>
                <td>${r.connectionSettings}</td>
            </tr>`;
}).join("\n")}
        </tbody>
    </table>

    <h2>Charts</h2>

    <h3>Writes Per Second</h3>
    <p>This chart shows the write operations per second for each scenario (A-J) with grouped bars for each concurrency level (1, 2, 4, 8, 16, 32, 64, 128).</p>
    ${generateOpsPerSecChart(scenarioList, byScenario, labelMap, concurrencyLevels)}

    <h3>Average Latency</h3>
    <p>This chart shows the average write latency for each scenario (A-J) with grouped bars for each concurrency level.</p>
    ${generateLatencyAverageChart(scenarioList, byScenario, labelMap, concurrencyLevels)}

    <h3>P95 Latency</h3>
    <p>This chart shows the 95th percentile write latency for each scenario (A-J) with grouped bars for each concurrency level.</p>
    ${generateLatencyP95Chart(scenarioList, byScenario, labelMap, concurrencyLevels)}

    <h3>P99 Latency</h3>
    <p>This chart shows the 99th percentile write latency for each scenario (A-J) with grouped bars for each concurrency level.</p>
    ${generateLatencyP99Chart(scenarioList, byScenario, labelMap, concurrencyLevels)}

    <h3>Error Counts</h3>
    <p>This chart shows the number of lock errors for each scenario (A-J) with grouped bars for each concurrency level.</p>
    ${generateErrorsChart(scenarioList, byScenario, labelMap, concurrencyLevels)}
</body>
</html>`;
}

/**
 * Generate compound report for scenario results
 */
export function generateScenarioCompoundReport(config: {
    resultsDir: string;
    scenariosDir: string;
    outputPath: string;
}): void {
    console.log(`Loading scenario results from ${config.resultsDir}...`);
    const results = loadScenarioResults(config.resultsDir, config.scenariosDir);
    
    if (results.length === 0) {
        console.warn("No scenario results found!");
        return;
    }

    console.log(`Found ${results.length} scenario configurations (across all concurrency levels)`);
    console.log("Generating compound report with Mermaid charts...");
    
    const markdown = generateCompoundReportMarkdown(results);

    mkdirSync(dirname(config.outputPath), { recursive: true });
    writeFileSync(config.outputPath, markdown);

    console.log(`Compound report generated: ${config.outputPath}`);
}

