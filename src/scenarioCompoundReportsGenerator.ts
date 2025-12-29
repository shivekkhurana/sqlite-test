import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TestResults, Configuration } from "./reportGenerator";

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
    { id: "A", name: "base0", label: "Baseline", description: "SQLite defaults, no busy timeout" },
    { id: "B", name: "busyTimeout1", label: "Busy Timeout 5s", description: "PRAGMA busy_timeout = 5000ms" },
    { id: "C", name: "busyTimeout2000", label: "Busy Timeout 2s", description: "PRAGMA busy_timeout = 2000ms" },
    { id: "D", name: "busyTimeout400", label: "Busy Timeout 400ms", description: "PRAGMA busy_timeout = 400ms" },
    { id: "E", name: "wal", label: "WAL Mode", description: "journal_mode=WAL, busy_timeout=2000ms" },
    {
        id: "F",
        name: "walSyncNormal",
        label: "WAL + Sync NORMAL",
        description: "journal_mode=WAL, synchronous=NORMAL, busy_timeout=2000ms",
    },
    {
        id: "G",
        name: "walSyncNormalAutocheckpoint2000",
        label: "WAL + NORMAL + Checkpoint 2k",
        description: "wal_autocheckpoint=2000",
    },
    {
        id: "H",
        name: "walSyncNormalAutocheckpoint4000",
        label: "WAL + NORMAL + Checkpoint 4k",
        description: "wal_autocheckpoint=4000",
    },
    {
        id: "I",
        name: "walSyncNormalAutocheckpoint4000Mmap1gb",
        label: "WAL + NORMAL + Checkpoint 4k + 1GB MMAP",
        description: "mmap_size=1GB",
    },
] as const;

const FAILURE_SCENARIOS = new Set(["base0", "busyTimeout1", "busyTimeout2000", "busyTimeout400"]);

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
 * Check if a concurrency level has data for the ladder chart
 */
function hasLadderData(byScenario: Map<string, Map<number, ScenarioResult>>, concurrency: number): boolean {
    for (const stage of OPTIMIZATION_STAGES) {
        const s = byScenario.get(stage.name);
        if (!s) continue;
        const r = s.get(concurrency);
        if (!r) continue;
        const p99 = r.configurations[0]?.metrics.p99;
        if (p99 !== undefined && p99 !== null) {
            return true; // At least one stage has data
        }
    }
    return false;
}

function generateKnobLadder(byScenario: Map<string, Map<number, ScenarioResult>>, concurrency: number): string {
    const data: any[] = [];
    const missingScenarios: string[] = [];
    const missingConcurrency: string[] = [];
    const missingMetrics: string[] = [];
    
    for (const stage of OPTIMIZATION_STAGES) {
        const s = byScenario.get(stage.name);
        if (!s) {
            missingScenarios.push(stage.name);
            continue;
        }
        const r = s.get(concurrency);
        if (!r) {
            const availableConcurrencies = Array.from(s.keys()).sort((a, b) => a - b);
            missingConcurrency.push(`${stage.name} (available: ${availableConcurrencies.join(", ")})`);
            continue;
        }
        const p99 = r.configurations[0]?.metrics.p99;
        if (p99 === undefined || p99 === null) {
            missingMetrics.push(stage.name);
            continue;
        }
        data.push({ 
            step: `${stage.id}: ${stage.label}`, 
            p99: Math.max(p99, 0.1),
            type: stage.id === 'A' ? 'Baseline (High Failure)' : 'Optimization'
        });
    }
    
    if (data.length === 0) {
        let message = `<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 10px 0;">`;
        message += `<p><strong>No ladder data available at concurrency=${concurrency}.</strong></p>`;
        if (missingScenarios.length > 0) {
            message += `<p><strong>Missing scenarios:</strong> ${missingScenarios.join(", ")}</p>`;
        }
        if (missingConcurrency.length > 0) {
            message += `<p><strong>Missing concurrency data:</strong> ${missingConcurrency.join("; ")}</p>`;
        }
        if (missingMetrics.length > 0) {
            message += `<p><strong>Missing P99 metrics:</strong> ${missingMetrics.join(", ")}</p>`;
        }
        // Also log available scenarios for debugging
        const availableScenarios = Array.from(byScenario.keys()).sort();
        message += `<p><strong>Available scenarios:</strong> ${availableScenarios.join(", ")}</p>`;
        message += `</div>`;
        return message;
    }

    const id = chartId("ladder");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: data },
        width: 1000,
        height: 280,
        mark: { type: "bar", tooltip: true },
        encoding: {
            x: { field: "step", type: "ordinal", title: "Optimization Step", axis: { labelAngle: -30 } },
            y: { field: "p99", type: "quantitative", title: "P99 Latency (ms)", scale: { type: "log" } },
            color: { 
                field: "type", 
                type: "nominal", 
                title: "Type", 
                scale: { domain: ["Baseline (High Failure)", "Optimization"], range: ["#e74c3c", "#4c78a8"] } 
            }
        },
    };

    // Debug: Log data summary
    const dataStr = JSON.stringify(data);
    const dataLength = data.length;
    const concurrencyStr = concurrency.toString();
    const idStr = id;
    const specStr = JSON.stringify(spec);
    const maxAttemptsStr = "100";

    return `<div id="${id}"></div><script>
        (function() {
            let attempts = 0;
            const maxAttempts = ${maxAttemptsStr};
            function embed() {
                attempts++;
                if (typeof vegaEmbed !== 'undefined') {
                    vegaEmbed('#${id}', ${specStr})
                        .then((result) => {
                            console.log('[Knob Ladder] Chart ${id} rendered successfully with ${dataLength} data points');
                            console.log('[Knob Ladder] Chart view:', result.view);
                            const container = document.getElementById('${id}');
                            if (container) {
                                const svg = container.querySelector('svg');
                                if (svg) {
                                    console.log('[Knob Ladder] SVG found, dimensions:', svg.getAttribute('width'), 'x', svg.getAttribute('height'));
                                } else {
                                    console.warn('[Knob Ladder] No SVG found in container');
                                }
                            }
                        })
                        .catch((error) => {
                            console.error('[Knob Ladder] Error rendering chart ${id}:', error);
                            const container = document.getElementById('${id}');
                            if (container) {
                                const errorMsg = error.message || String(error);
                                container.innerHTML = '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px;"><strong>Chart rendering error:</strong> ' + errorMsg + '<br><small>Data points: ${dataLength}, Concurrency: ${concurrencyStr}</small><br><pre style="font-size: 10px; overflow: auto; max-height: 200px;">' + ${JSON.stringify(dataStr)} + '</pre></div>';
                            }
                        });
                } else if (attempts < maxAttempts) {
                    setTimeout(embed, 50);
                } else {
                    console.error('[Knob Ladder] vegaEmbed not available after ' + maxAttempts + ' attempts');
                    const container = document.getElementById('${id}');
                    if (container) {
                        container.innerHTML = '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px;"><strong>Error:</strong> Vega-Lite library failed to load. Please check your internet connection and ensure CDN scripts are accessible.</div>';
                    }
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', embed);
            } else {
                embed();
            }
        })();
    </script>`;
}

function generateP99DeltaVsBaseline(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    baselineScenario: string,
    concurrencyLevels: number[]
): string {
    const baseline = byScenario.get(baselineScenario);
    if (!baseline) return `<p><em>Baseline "${baselineScenario}" not found; cannot compute deltas.</em></p>`;

    const data: any[] = [];

    for (const s of scenarioList) {
        if (s.scenarioName === baselineScenario) continue;
        const cur = byScenario.get(s.scenarioName);
        if (!cur) continue;

        for (const level of concurrencyLevels) {
            const baseR = baseline.get(level);
            const curR = cur.get(level);
            if (!baseR || !curR) continue;

            const baseP99 = baseR.configurations[0]!.metrics.p99 ?? 0;
            const curP99 = curR.configurations[0]!.metrics.p99 ?? 0;
            if (baseP99 <= 0 || curP99 <= 0) continue;

            const improvementPct = ((baseP99 - curP99) / baseP99) * 100;
            data.push({
                scenario: s.scenarioName,
                concurrency: level,
                improvement: improvementPct,
            });
        }
    }

    if (data.length === 0) return `<p><em>No delta data available.</em></p>`;

    const id = chartId("delta");
    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: data },
        width: 1000,
        height: 360,
        mark: { type: "line", point: true, tooltip: true },
        encoding: {
            x: { field: "concurrency", type: "ordinal", title: "Concurrency" },
            y: { 
                field: "improvement", 
                type: "quantitative", 
                title: "P99 Improvement vs Baseline (%)",
                scale: { type: "symlog", constant: 10 }
            },
            color: { field: "scenario", type: "nominal", title: "Scenario" },
        },
    };

    // Debug: Log data summary
    const scenarios = new Set(data.map(d => d.scenario));
    const improvements = data.map(d => d.improvement);
    const dataStr = JSON.stringify(data.slice(0, 10)); // Sample for error display
    const dataLength = data.length;
    const scenariosCount = scenarios.size;
    const idStr = id;
    const specStr = JSON.stringify(spec);
    const maxAttemptsStr = "100";

    return `<div id="${id}"></div><script>
        (function() {
            let attempts = 0;
            const maxAttempts = ${maxAttemptsStr};
            function embed() {
                attempts++;
                if (typeof vegaEmbed !== 'undefined') {
                    vegaEmbed('#${id}', ${specStr})
                        .then((result) => {
                            console.log('[Baseline Deltas] Chart ${id} rendered successfully with ${dataLength} data points');
                            console.log('[Baseline Deltas] Chart view:', result.view);
                            const container = document.getElementById('${id}');
                            if (container) {
                                const svg = container.querySelector('svg');
                                if (svg) {
                                    console.log('[Baseline Deltas] SVG found, dimensions:', svg.getAttribute('width'), 'x', svg.getAttribute('height'));
                                } else {
                                    console.warn('[Baseline Deltas] No SVG found in container');
                                }
                            }
                        })
                        .catch((error) => {
                            console.error('[Baseline Deltas] Error rendering chart ${id}:', error);
                            const container = document.getElementById('${id}');
                            if (container) {
                                const errorMsg = error.message || String(error);
                                container.innerHTML = '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px;"><strong>Chart rendering error:</strong> ' + errorMsg + '<br><small>Data points: ${dataLength}, Scenarios: ${scenariosCount}</small><br><pre style="font-size: 10px; overflow: auto; max-height: 200px;">' + ${JSON.stringify(dataStr)} + '</pre></div>';
                            }
                        });
                } else if (attempts < maxAttempts) {
                    setTimeout(embed, 50);
                } else {
                    console.error('[Baseline Deltas] vegaEmbed not available after ' + maxAttempts + ' attempts');
                    const container = document.getElementById('${id}');
                    if (container) {
                        container.innerHTML = '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px;"><strong>Error:</strong> Vega-Lite library failed to load. Please check your internet connection and ensure CDN scripts are accessible.</div>';
                    }
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', embed);
            } else {
                embed();
            }
        })();
    </script>`;
}

function generateFailureLockErrorsChart(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];

    for (const s of scenarioList) {
        if (!FAILURE_SCENARIOS.has(s.scenarioName)) continue;
        const cur = byScenario.get(s.scenarioName);
        if (!cur) continue;

        for (const level of concurrencyLevels) {
            const r = cur.get(level);
            if (!r) continue;
            const m = r.configurations[0]!.metrics;
            data.push({
                scenario: s.scenarioName,
                concurrency: level,
                lockErrors: m.lockErrors ?? 0,
                successRate: m.successRate ?? 0,
            });
        }
    }

    if (data.length === 0) return `<p><em>No failure-mode (busy_timeout) data available.</em></p>`;

    const yMax = roundUpToNiceNumber(Math.max(...data.map((d) => d.lockErrors), 1));
    const id = chartId("fail-lock");

    const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: data },
        width: 1000,
        height: 360,
        mark: { type: "line", point: true, tooltip: true },
        encoding: {
            x: { field: "concurrency", type: "ordinal", title: "Concurrency" },
            y: {
                field: "lockErrors",
                type: "quantitative",
                title: "Lock Errors",
                scale: { type: "symlog", domain: [0, yMax] },
            },
            color: { field: "scenario", type: "nominal", title: "Scenario" },
        },
    };

    return `<div id="${id}"></div><script>
        (function() {
            let attempts = 0;
            const maxAttempts = 100; // 5 seconds max wait
            function embed() {
                attempts++;
                if (typeof vegaEmbed !== 'undefined') {
                    vegaEmbed('#${id}', ${JSON.stringify(spec)})
                        .then((result) => {
                            console.log('Chart ${id} rendered successfully');
                        })
                        .catch((error) => {
                            console.error('Error rendering chart ${id}:', error);
                            const container = document.getElementById('${id}');
                            if (container) {
                                container.innerHTML = '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px;"><strong>Chart rendering error:</strong> ' + error.message + '<br><small>Data points: ${data.length}</small></div>';
                            }
                        });
                } else if (attempts < maxAttempts) {
                    setTimeout(embed, 50);
                } else {
                    console.error('vegaEmbed not available after ' + maxAttempts + ' attempts');
                    const container = document.getElementById('${id}');
                    if (container) {
                        container.innerHTML = '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 4px;"><strong>Error:</strong> Vega-Lite library failed to load. Please check your internet connection and ensure CDN scripts are accessible.</div>';
                    }
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', embed);
            } else {
                embed();
            }
        })();
    </script>`;
}

/**
 * Stage analysis: show ONLY P99 latency (no Min/P50/Avg/P95/Max) + lock errors.
 * This keeps each stage readable, but the story is told in the new comparative sections.
 */
function generateStageAnalysis(stage: typeof OPTIMIZATION_STAGES[number], results: ScenarioResult[], concurrencyLevels: number[]): string {
    const stageResults = results.filter((r) => r.scenarioName === stage.name);
    if (stageResults.length === 0) return `<p><em>No data available for Stage ${stage.id}</em></p>`;

    const latencyData: any[] = [];
    const errorData: any[] = [];

    for (const level of concurrencyLevels) {
        const result = stageResults.find((r) => r.configurations[0]?.concurrency === level);
        if (!result) continue;

        const m = result.configurations[0]!.metrics;
        latencyData.push({ concurrency: level, value: Math.max(m.p99 ?? 0.1, 0.1) });
        errorData.push({ concurrency: level, errors: m.lockErrors ?? 0, successRate: m.successRate ?? 0 });
    }

    const latencyYMax = roundUpToNiceNumber(Math.max(...latencyData.map((d) => d.value), 1));
    const errorYMax = roundUpToNiceNumber(Math.max(...errorData.map((d) => d.errors), 1));

    const latencySpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: latencyData },
        width: 500,
        height: 300,
        mark: { type: "line", point: true, tooltip: true },
        encoding: {
            x: { field: "concurrency", type: "ordinal", title: "Concurrency" },
            y: {
                field: "value",
                type: "quantitative",
                title: "P99 Latency (ms)",
                scale: { type: "log", domain: [0.1, latencyYMax] },
            },
        },
    };

    const errorSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: errorData },
        width: 500,
        height: 300,
        mark: { type: "bar", tooltip: true },
        encoding: {
            x: { field: "concurrency", type: "ordinal", title: "Concurrency" },
            y: {
                field: "errors",
                type: "quantitative",
                title: "Lock Errors",
                scale: { type: "symlog", domain: [0, errorYMax] },
            },
            color: { value: "#e74c3c" },
        },
    };

    const id = `stage-${stage.id}-${Math.random().toString(36).slice(2, 7)}`;
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
    <script>
        (function() {
            function embed() {
                if (typeof vegaEmbed !== 'undefined') {
                    vegaEmbed('#lat-${id}', ${JSON.stringify(latencySpec)}).catch(console.error);
                    vegaEmbed('#err-${id}', ${JSON.stringify(errorSpec)}).catch(console.error);
                } else {
                    setTimeout(embed, 50);
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', embed);
            } else {
                embed();
            }
        })();
    </script>
    `;
}

function generateOpsPerSecChart(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (!scenarioData) continue;

        for (const level of concurrencyLevels) {
            const result = scenarioData.get(level);
            if (!result) continue;
            data.push({
                scenario: scenario.scenarioName,
                concurrency: level,
                value: Math.max(result.configurations[0]?.metrics.writesPerSec || 0, 1),
            });
        }
    }

    const yAxisMax = roundUpToNiceNumber(Math.max(...data.map((d) => d.value), 1));
    const vegaSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: data },
        mark: { type: "line", point: true, tooltip: true },
        encoding: {
            x: { field: "concurrency", type: "ordinal", title: "Concurrency" },
            y: { field: "value", type: "quantitative", title: "Writes/sec", scale: { type: "log", domain: [1, yAxisMax] } },
            color: { field: "scenario", type: "nominal", title: "Scenario" },
        },
        width: 1000,
        height: 360,
    };

    const id = chartId("ops");
    return `<div id="${id}"></div><script>
        (function() {
            function embed() {
                if (typeof vegaEmbed !== 'undefined') {
                    vegaEmbed('#${id}', ${JSON.stringify(vegaSpec)}).catch(console.error);
                } else {
                    setTimeout(embed, 50);
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', embed);
            } else {
                embed();
            }
        })();
    </script>`;
}

function generateLatencyP99Chart(
    scenarioList: ScenarioResult[],
    byScenario: Map<string, Map<number, ScenarioResult>>,
    concurrencyLevels: number[]
): string {
    const data: any[] = [];
    for (const scenario of scenarioList) {
        const scenarioData = byScenario.get(scenario.scenarioName);
        if (!scenarioData) continue;

        for (const level of concurrencyLevels) {
            const result = scenarioData.get(level);
            if (!result) continue;

            data.push({
                scenario: scenario.scenarioName,
                concurrency: level,
                value: Math.max(result.configurations[0]?.metrics.p99 || 0, 0.1),
            });
        }
    }

    const yAxisMax = roundUpToNiceNumber(Math.max(...data.map((d) => d.value), 1));
    const vegaSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: data },
        mark: { type: "line", point: true, tooltip: true },
        encoding: {
            x: { field: "concurrency", type: "ordinal", title: "Concurrency" },
            y: { field: "value", type: "quantitative", title: "P99 Latency (ms)", scale: { type: "log", domain: [0.1, yAxisMax] } },
            color: { field: "scenario", type: "nominal", title: "Scenario" },
        },
        width: 1000,
        height: 360,
    };

    const id = chartId("p99");
    return `<div id="${id}"></div><script>
        (function() {
            function embed() {
                if (typeof vegaEmbed !== 'undefined') {
                    vegaEmbed('#${id}', ${JSON.stringify(vegaSpec)}).catch(console.error);
                } else {
                    setTimeout(embed, 50);
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', embed);
            } else {
                embed();
            }
        })();
    </script>`;
}

function generateCompoundReportMarkdown(results: ScenarioResult[]): string {
    if (results.length === 0) return "<h1>No results found.</h1>";

    const { scenarioList, byScenario, concurrencyLevels } = buildIndex(results);

    // Choose meaningful ladder concurrency levels (prioritize 16 and 8 workers)
    // Only include concurrency levels that actually have data for the ladder chart
    const preferred = [16, 8];
    const ladderConcurrencies: number[] = [];
    for (const c of preferred) {
        if (concurrencyLevels.includes(c) && hasLadderData(byScenario, c)) {
            ladderConcurrencies.push(c);
        }
    }
    // If neither 16 nor 8 are available with data, fall back to available levels that have data
    if (ladderConcurrencies.length === 0) {
        const available = concurrencyLevels.filter((c) => c <= 16 && hasLadderData(byScenario, c));
        if (available.length > 0) {
            const last = available[available.length - 1];
            if (last !== undefined) ladderConcurrencies.push(last);
        } else {
            // Try any concurrency level that has data
            for (const c of concurrencyLevels) {
                if (hasLadderData(byScenario, c)) {
                    ladderConcurrencies.push(c);
                    break;
                }
            }
        }
    }

    const performanceScenarios = scenarioList.filter((s) => !FAILURE_SCENARIOS.has(s.scenarioName));
    const allScenarios = scenarioList;

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
        .hero { background: #f8f9fa; padding: 40px; border-radius: 12px; margin-bottom: 30px; }
        .hero h1 { margin-top: 0; font-size: 2.5em; }
        .callout { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 18px 20px; margin: 18px 0; }
        .journey-nav { display: flex; gap: 10px; margin: 18px 0; overflow-x: auto; padding-bottom: 10px; }
        .nav-item { padding: 8px 16px; background: #eee; border-radius: 20px; text-decoration: none; color: #666; font-size: 0.8em; white-space: nowrap; }
        .nav-item:hover { background: #ddd; }
        .stage-container { margin-top: 30px; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .stage-header { display: flex; align-items: center; gap: 15px; margin-bottom: 10px; }
        .stage-id { background: #333; color: white; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; }
        .stage-title { font-size: 1.35em; font-weight: bold; color: #2c3e50; }
        .stage-desc { color: #7f8c8d; font-style: italic; margin-bottom: 18px; }
        .charts-row { display: flex; flex-wrap: wrap; gap: 20px; }
        hr { border: none; border-top: 1px solid #eee; margin: 50px 0; }
        div[id^="ladder-"], div[id^="delta-"], div[id^="fail-lock-"], div[id^="ops-"], div[id^="p99-"] {
            min-height: 300px;
            width: 100%;
            margin: 20px 0;
        }
        .vega-embed {
            width: 100% !important;
        }
        .vega-embed svg {
            width: 100% !important;
            height: auto !important;
        }
    </style>
</head>
<body>
    <div class="hero">
        <h1>The SQLite Optimization Journey</h1>
        <p>A step-by-step evolution of SQLite write performance. (Stage charts show P99 + lock errors only.)</p>
    </div>

    <h2>What Each Knob Buys You</h2>
    <div class="callout">
        <strong>Knob ladder</strong> (P99 latency). This is the primary "story" chart showing optimization impact at different concurrency levels.
    </div>
    ${ladderConcurrencies.length > 0 ? ladderConcurrencies.map((concurrency) => `
        <h3>Concurrency = ${concurrency}</h3>
        ${generateKnobLadder(byScenario, concurrency)}
    `).join("") : `<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 10px 0;"><p><strong>No ladder data available.</strong> Available concurrency levels: ${concurrencyLevels.join(", ")}. Available scenarios: ${Array.from(byScenario.keys()).sort().join(", ")}</p></div>`}

    <h2>Baseline Deltas (P99)</h2>
    <div class="callout">
        <strong>P99 improvement vs baseline</strong> (percentage). This makes step changes obvious.
    </div>
    ${generateP99DeltaVsBaseline(allScenarios, byScenario, "base0", concurrencyLevels)}

    <h2>Preventing Failure (busy_timeout)</h2>
    <div class="callout">
        Busy timeout primarily changes <strong>lock errors</strong> (survivability), not performance. This chart isolates that effect.
    </div>
    ${generateFailureLockErrorsChart(allScenarios, byScenario, concurrencyLevels)}

    <hr />

    <h2>The Incremental Evolution</h2>
    <div class="journey-nav">
        ${OPTIMIZATION_STAGES.map((s) => `<a href="#stage-${s.id}" class="nav-item">${s.id}: ${s.label}</a>`).join("")}
    </div>
    ${OPTIMIZATION_STAGES.map((stage) => `<div id="stage-${stage.id}">${generateStageAnalysis(stage, results, concurrencyLevels)}</div>`).join("")}

    <hr />

    <h2>Comparative Analysis</h2>
    <h3>Writes Per Second (all scenarios)</h3>
    ${generateOpsPerSecChart(allScenarios, byScenario, concurrencyLevels)}

    <h3>P99 Latency (performance scenarios)</h3>
    ${generateLatencyP99Chart(performanceScenarios, byScenario, concurrencyLevels)}

    <div style="margin-top: 40px;">
        <h3>Scenario Configuration Reference</h3>
        <table class="summary-table">
            <thead><tr><th>ID</th><th>Scenario Name</th><th>Database Settings</th><th>Connection Settings</th></tr></thead>
            <tbody>
            ${OPTIMIZATION_STAGES.map((s) => {
                const any = scenarioList.find((r) => r.scenarioName === s.name);
                return `<tr><td><strong>${s.id}</strong></td><td>${s.name}</td><td>${any?.databaseSettings || "-"}</td><td>${any?.connectionSettings || "-"}</td></tr>`;
            }).join("\n")}
            </tbody>
        </table>
    </div>
</body>
</html>`;
}

export function generateScenarioCompoundReport(config: { resultsDir: string; scenariosDir: string; outputPath: string }): void {
    const results = loadScenarioResults(config.resultsDir, config.scenariosDir);
    if (results.length === 0) {
        console.warn("No scenario results found!");
        return;
    }

    console.log(`Loaded ${results.length} scenario result entries`);
    const { byScenario, concurrencyLevels } = buildIndex(results);
    console.log(`Found scenarios: ${Array.from(byScenario.keys()).sort().join(", ")}`);
    console.log(`Found concurrency levels: ${concurrencyLevels.join(", ")}`);

    const html = generateCompoundReportMarkdown(results);
    mkdirSync(dirname(config.outputPath), { recursive: true });
    writeFileSync(config.outputPath, html);
    console.log(`Compound report generated: ${config.outputPath}`);
}
