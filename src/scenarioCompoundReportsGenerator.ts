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
        .filter(f => f.endsWith(".json") && 
                     !f.startsWith("mixed-") && 
                     !f.startsWith("turso-") && 
                     !f.startsWith("postgres-") && 
                     f !== "mixed-read-write.json" &&
                     f !== "postgres-read-write.json")
        .map(f => join(resultsDir, f));

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
                .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
                .join("");

            const { databaseSettings, connectionSettings } = extractSettingsFromScenario(
                scenarioName,
                scenariosDir
            );

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
        } catch (error) {}
    }

    if (existsSync(workerPath)) {
        try {
            const workerContent = readFileSync(workerPath, "utf-8");
            const busyTimeoutMatch = workerContent.match(/\.pragma\s*\(\s*['"]busy_timeout\s*=\s*(\d+)['"]\s*\)/i);
            if (busyTimeoutMatch && busyTimeoutMatch[1]) connectionSettings.push(`busy_timeout=${busyTimeoutMatch[1]}ms`);
            const autocheckpointMatch = workerContent.match(/\.pragma\s*\(\s*['"]wal_autocheckpoint\s*=\s*(\d+)['"]\s*\)/i);
            if (autocheckpointMatch && autocheckpointMatch[1]) connectionSettings.push(`wal_autocheckpoint=${autocheckpointMatch[1]}`);
            const mmapMatch = workerContent.match(/\.pragma\s*\(\s*['"]mmap_size\s*=\s*(\d+)['"]\s*\)/i);
            if (mmapMatch && mmapMatch[1]) connectionSettings.push(`mmap=${parseInt(mmapMatch[1]) / 1e9}GB`);
        } catch (error) {}
    }

    return {
        databaseSettings: databaseSettings.length > 0 ? databaseSettings.join(", ") : "defaults",
        connectionSettings: connectionSettings.length > 0 ? connectionSettings.join(", ") : "none"
    };
}

function generateScenarioLabels(scenarios: ScenarioResult[]): Map<string, string> {
    const labelMap = new Map<string, string>();
    const uniqueScenarios = Array.from(new Set(scenarios.map(r => r.scenarioName))).sort();
    for (let i = 0; i < uniqueScenarios.length; i++) {
        labelMap.set(uniqueScenarios[i]!, String.fromCharCode(65 + i));
    }
    return labelMap;
}

function getLabel(scenarioName: string, labelMap: Map<string, string>): string {
    return labelMap.get(scenarioName) || scenarioName;
}

const OPTIMIZATION_STAGES = [
    { id: 'A', name: 'base0', label: 'Baseline', description: 'SQLite defaults, no busy timeout' },
    { id: 'B', name: 'busyTimeout1', label: 'Busy Timeout 5s', description: 'PRAGMA busy_timeout = 5000ms' },
    { id: 'C', name: 'busyTimeout2000', label: 'Busy Timeout 2s', description: 'PRAGMA busy_timeout = 2000ms' },
    { id: 'D', name: 'busyTimeout400', label: 'Busy Timeout 400ms', description: 'PRAGMA busy_timeout = 400ms' },
    { id: 'E', name: 'wal', label: 'WAL Mode', description: 'journal_mode=WAL, busy_timeout=2000ms' },
    { id: 'F', name: 'walSyncNormal', label: 'WAL + Sync NORMAL', description: 'journal_mode=WAL, synchronous=NORMAL, busy_timeout=2000ms' },
    { id: 'G', name: 'walSyncNormalAutocheckpoint2000', label: 'WAL + NORMAL + Checkpoint 2k', description: 'wal_autocheckpoint=2000' },
    { id: 'H', name: 'walSyncNormalAutocheckpoint4000', label: 'WAL + NORMAL + Checkpoint 4k', description: 'wal_autocheckpoint=4000' },
    { id: 'I', name: 'walSyncNormalAutocheckpoint4000Mmap1gb', label: 'WAL + NORMAL + Checkpoint 4k + 1GB MMAP', description: 'mmap_size=1GB' },
];

function generateStageAnalysis(
    stage: typeof OPTIMIZATION_STAGES[0],
    results: ScenarioResult[],
    concurrencyLevels: number[]
): string {
    const stageResults = results.filter(r => r.scenarioName === stage.name);
    if (stageResults.length === 0) return `<p><em>No data available for Stage ${stage.id}</em></p>`;

    const latencyData: any[] = [];
    const errorData: any[] = [];

    for (const level of concurrencyLevels) {
        const result = stageResults.find(r => r.configurations[0]?.concurrency === level);
        if (result) {
            const m = result.configurations[0]!.metrics;
            const points = [
                { type: 'Min', value: m.minTime ?? 0 },
                { type: 'P50', value: m.p50 ?? m.avgTime },
                { type: 'Avg', value: m.avgTime },
                { type: 'P95', value: m.p95 },
                { type: 'P99', value: m.p99 },
                { type: 'Max', value: m.maxTime ?? m.p99 * 1.5 }
            ];
            for (const p of points) {
                latencyData.push({ concurrency: level, type: p.type, value: Math.max(p.value, 0.1) });
            }
            errorData.push({ concurrency: level, errors: m.lockErrors, successRate: m.successRate });
        }
    }

    const latencyYMax = roundUpToNiceNumber(Math.max(...latencyData.map(d => d.value), 1));
    const errorYMax = roundUpToNiceNumber(Math.max(...errorData.map(d => d.errors), 1));

    const latencySpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": { "values": latencyData },
        "width": 500, "height": 300,
        "mark": { "type": "line", "point": true, "tooltip": true },
        "encoding": {
            "x": { "field": "concurrency", "type": "ordinal", "title": "Concurrency" },
            "y": { "field": "value", "type": "quantitative", "title": "Latency (ms)", "scale": { "type": "log", "domain": [0.1, latencyYMax] } },
            "color": { "field": "type", "type": "nominal", "title": "Metric", "scale": { "domain": ["Min", "P50", "Avg", "P95", "P99", "Max"] } }
        }
    };

    const errorSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": { "values": errorData },
        "width": 500, "height": 300,
        "mark": { "type": "bar", "tooltip": true },
        "encoding": {
            "x": { "field": "concurrency", "type": "ordinal", "title": "Concurrency" },
            "y": { "field": "errors", "type": "quantitative", "title": "Lock Errors", "scale": { "type": "symlog", "domain": [0, errorYMax] } },
            "color": { "value": "#e74c3c" }
        }
    };

    const id = `stage-${stage.id}-${Math.random().toString(36).substr(2, 5)}`;
    return `
    <div class="stage-container">
        <div class="stage-header">
            <span class="stage-id">${stage.id}</span>
            <div class="stage-title">${stage.label}</div>
        </div>
        <p class="stage-desc">${stage.description}</p>
        <div class="charts-row">
            <div id="lat-${id}"></div>
            <div id="err-${id}"></div>
        </div>
    </div>
    <script type="text/javascript">
        vegaEmbed('#lat-${id}', ${JSON.stringify(latencySpec)});
        vegaEmbed('#err-${id}', ${JSON.stringify(errorSpec)});
    </script>
    `;
}

function generateOpsPerSecChart(scenarioList: ScenarioResult[], byScenario: Map<string, Map<number, ScenarioResult>>, labelMap: Map<string, string>, concurrencyLevels: number[]): string {
    const data: any[] = [];
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (scenarioData) {
            for (const level of concurrencyLevels) {
                const result = scenarioData.get(level);
                if (result) {
                    data.push({ scenario: getLabel(scenario.scenarioName, labelMap), concurrency: level, value: Math.max(result.configurations[0]?.metrics.writesPerSec || 0, 1) });
                }
            }
        }
    }
    const yAxisMax = roundUpToNiceNumber(Math.max(...data.map(d => d.value), 1));
    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": { "values": data },
        "mark": { "type": "line", "point": true, "tooltip": true },
        "encoding": {
            "x": { "field": "concurrency", "type": "ordinal", "title": "Concurrency" },
            "y": { "field": "value", "type": "quantitative", "title": "Writes/sec", "scale": {"type": "log", "domain": [1, yAxisMax]} },
            "color": { "field": "scenario", "type": "nominal", "title": "Scenario", "scale": {"scheme": "category20"} }
        },
        "width": 800, "height": 400
    };
    const chartId = `ops-per-sec-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div><script>vegaEmbed('#${chartId}', ${JSON.stringify(vegaSpec)});</script>`;
}

function generateLatencyP99Chart(scenarioList: ScenarioResult[], byScenario: Map<string, Map<number, ScenarioResult>>, labelMap: Map<string, string>, concurrencyLevels: number[]): string {
    const data: any[] = [];
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (scenarioData) {
            for (const level of concurrencyLevels) {
                const result = scenarioData.get(level);
                if (result) {
                    data.push({ scenario: getLabel(scenario.scenarioName, labelMap), concurrency: level, value: Math.max(result.configurations[0]?.metrics.p99 || 0, 0.1) });
                }
            }
        }
    }
    const yAxisMax = roundUpToNiceNumber(Math.max(...data.map(d => d.value), 1));
    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": { "values": data },
        "mark": { "type": "line", "point": true, "tooltip": true },
        "encoding": {
            "x": { "field": "concurrency", "type": "ordinal", "title": "Concurrency" },
            "y": { "field": "value", "type": "quantitative", "title": "Latency (ms)", "scale": {"type": "log", "domain": [0.1, yAxisMax]} },
            "color": { "field": "scenario", "type": "nominal", "title": "Scenario", "scale": {"scheme": "category20"} }
        },
        "width": 800, "height": 400
    };
    const chartId = `p99-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div><script>vegaEmbed('#${chartId}', ${JSON.stringify(vegaSpec)});</script>`;
}

function generateCompoundReportMarkdown(results: ScenarioResult[]): string {
    if (results.length === 0) return "<h1>No results found.</h1>";
    const timestamp = new Date().toLocaleString();
    const uniqueScenarios = new Map<string, ScenarioResult>();
    for (const result of results) { if (!uniqueScenarios.has(result.scenarioName)) uniqueScenarios.set(result.scenarioName, result); }
    const scenarioList = Array.from(uniqueScenarios.values()).sort((a,b) => a.scenarioName.localeCompare(b.scenarioName));
    const labelMap = generateScenarioLabels(scenarioList);
    const byScenario = new Map<string, Map<number, ScenarioResult>>();
    const concurrencySet = new Set<number>();
    for (const result of results) {
        const concurrency = result.configurations[0]?.concurrency;
        if (concurrency !== undefined) {
            concurrencySet.add(concurrency);
            if (!byScenario.has(result.scenarioName)) byScenario.set(result.scenarioName, new Map());
            byScenario.get(result.scenarioName)!.set(concurrency, result);
        }
    }
    const concurrencyLevels = Array.from(concurrencySet).sort((a, b) => a - b);

    return `<!DOCTYPE html>
<html>
<head>
    <title>The SQLite Optimization Journey</title>
    <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
    <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
    <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px auto; max-width: 1200px; line-height: 1.6; color: #333; }
        h1, h2, h3 { color: #2c3e50; }
        .summary-table { border-collapse: collapse; width: 100%; margin: 20px 0; font-size: 0.9em; }
        .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .summary-table th { background-color: #f8f9fa; font-weight: 600; }
        .hero { background: #f8f9fa; padding: 40px; border-radius: 12px; margin-bottom: 40px; }
        .hero h1 { margin-top: 0; font-size: 2.5em; }
        .journey-nav { display: flex; gap: 10px; margin: 20px 0; overflow-x: auto; padding-bottom: 10px; }
        .nav-item { padding: 8px 16px; background: #eee; border-radius: 20px; text-decoration: none; color: #666; font-size: 0.8em; white-space: nowrap; }
        .nav-item:hover { background: #ddd; }
        .stage-container { margin-top: 40px; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .stage-header { display: flex; align-items: center; gap: 15px; margin-bottom: 10px; }
        .stage-id { background: #333; color: white; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; }
        .stage-title { font-size: 1.5em; font-weight: bold; color: #2c3e50; }
        .stage-desc { color: #7f8c8d; font-style: italic; margin-bottom: 20px; }
        .charts-row { display: flex; flex-wrap: wrap; gap: 20px; }
    </style>
</head>
<body>
    <div class="hero">
        <h1>The SQLite Optimization Journey</h1>
        <p>A step-by-step evolution of SQLite write performance.</p>
    </div>

    <h2>The Incremental Evolution</h2>
    <div class="journey-nav">
        ${OPTIMIZATION_STAGES.map(s => `<a href="#stage-${s.id}" class="nav-item">${s.id}: ${s.label}</a>`).join('')}
    </div>

    ${OPTIMIZATION_STAGES.map(stage => `<div id="stage-${stage.id}">${generateStageAnalysis(stage, results, concurrencyLevels)}</div>`).join('')}

    <hr style="margin: 60px 0;">
    <h2>Comparative Analysis (All Scenarios)</h2>
    <h3>Writes Per Second</h3>
    ${generateOpsPerSecChart(scenarioList.filter(s => s.scenarioName !== 'base0' && s.scenarioName !== 'busyTimeout400'), byScenario, labelMap, concurrencyLevels)}
    <h3>P99 Latency Scaling</h3>
    ${generateLatencyP99Chart(scenarioList.filter(s => s.scenarioName !== 'base0' && s.scenarioName !== 'busyTimeout400'), byScenario, labelMap, concurrencyLevels)}

    <div style="margin-top: 40px;">
        <h3>Scenario Configuration Reference</h3>
        <table class="summary-table">
            <thead><tr><th>ID</th><th>Scenario Name</th><th>Database Settings</th><th>Connection Settings</th></tr></thead>
            <tbody>
    ${OPTIMIZATION_STAGES.map(s => {
        const result = scenarioList.find(r => r.scenarioName === s.name);
        return `<tr><td><strong>${s.id}</strong></td><td>${s.name}</td><td>${result?.databaseSettings || '-'}</td><td>${result?.connectionSettings || '-'}</td></tr>`;
    }).join("\n")}
            </tbody>
        </table>
    </div>
</body>
</html>`;
}

export function generateScenarioCompoundReport(config: { resultsDir: string; scenariosDir: string; outputPath: string; }): void {
    const results = loadScenarioResults(config.resultsDir, config.scenariosDir);
    if (results.length === 0) return;
    const markdown = generateCompoundReportMarkdown(results);
    mkdirSync(dirname(config.outputPath), { recursive: true });
    writeFileSync(config.outputPath, markdown);
    console.log(`Compound report generated: ${config.outputPath}`);
}
