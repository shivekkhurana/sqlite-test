import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MixedResults } from "./reportGenerator";

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
                if (!data.reads.byQueryType) {
                    data.reads.byQueryType = {};
                }
                results.push(data as MixedResults);
            }
        } catch (error) {
            console.warn(`Failed to load ${file}:`, error);
        }
    }
    return results;
}

/**
 * Filter data for Concurrency Analysis (Fixed Cache 64MB)
 * Looking for cacheSize = -64000
 */
function getConcurrencyData(results: MixedResults[]) {
    const targetCache = 64000;
    const filtered = results.filter(r => Math.abs(Math.abs(r.configuration.cacheSize) - targetCache) < 10);
    
    return filtered.sort((a, b) => (a.configuration.readWorkers + a.configuration.writeWorkers) - (b.configuration.readWorkers + b.configuration.writeWorkers));
}

/**
 * Filter data for Cache Analysis (Fixed Workers 10: 8r/2w)
 */
function getCacheData(results: MixedResults[]) {
    const targetWorkers = 10;
    const filtered = results.filter(r => (r.configuration.readWorkers + r.configuration.writeWorkers) === targetWorkers);
    
    return filtered.sort((a, b) => Math.abs(a.configuration.cacheSize) - Math.abs(b.configuration.cacheSize));
}

/**
 * Generate Vega-Lite chart for throughput
 */
function generateThroughputChart(data: Array<{workers: number; opsPerSec: number}>): string {
    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": 800,
        "height": 300,
        "data": { "values": data },
        "mark": { "type": "line", "point": true, "tooltip": true },
        "encoding": {
            "x": { "field": "workers", "type": "quantitative", "title": "Total Workers" },
            "y": { "field": "opsPerSec", "type": "quantitative", "title": "Total Ops / Sec" }
        }
    };

    const chartId = `chart-throughput-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite chart for multiple latency metrics
 */
function generateMultiMetricLatencyChart(
    data: Array<{x: number; min: number; max: number; avg: number; p50: number; p99: number}>, 
    xTitle: string, 
    yTitle: string, 
    useLogX: boolean = false
): string {
    const transformedData: Array<{x: number; metric: string; latency: number}> = [];
    
    data.forEach(item => {
        transformedData.push({ x: item.x, metric: "Min", latency: item.min });
        transformedData.push({ x: item.x, metric: "Avg", latency: item.avg });
        transformedData.push({ x: item.x, metric: "P50", latency: item.p50 });
        transformedData.push({ x: item.x, metric: "P99", latency: item.p99 });
        transformedData.push({ x: item.x, metric: "Max", latency: item.max });
    });

    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": 800,
        "height": 300,
        "data": { "values": transformedData },
        "mark": { "type": "line", "point": true, "tooltip": true },
        "encoding": {
            "x": { 
                "field": "x", 
                "type": "quantitative", 
                "title": xTitle,
                "scale": useLogX ? { "type": "log" } : undefined
            },
            "y": { 
                "field": "latency", 
                "type": "quantitative", 
                "title": yTitle 
            },
            "color": { 
                "field": "metric", 
                "type": "nominal",
                "scale": {
                    "domain": ["Min", "Avg", "P50", "P99", "Max"],
                    "range": ["#4c78a8", "#72b7b2", "#54a24b", "#e45756", "#b279a2"]
                }
            }
        }
    };

    const chartId = `chart-latency-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite chart for latency (log scale) - P99 comparison
 */
function generateP99ComparisonChart(data: Array<{x: number; readP99: number; writeP99: number}>, xTitle: string, useLogX: boolean = false): string {
    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": 800,
        "height": 300,
        "data": { "values": data },
        "transform": [
            { "fold": ["readP99", "writeP99"], "as": ["Type", "Latency"] }
        ],
        "mark": { "type": "line", "point": true, "tooltip": true },
        "encoding": {
            "x": { 
                "field": "x", 
                "type": "quantitative", 
                "title": xTitle,
                "scale": useLogX ? { "type": "log" } : undefined
            },
            "y": { "field": "Latency", "type": "quantitative", "title": "P99 Latency (ms)" },
            "color": { "field": "Type", "type": "nominal" }
        }
    };

    const chartId = `chart-p99-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite chart for query type breakdown
 */
function generateQueryTypeChart(data: Array<{workers: number; query: string; latency: number}>): string {
    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": 800,
        "height": 300,
        "data": { "values": data },
        "mark": { "type": "bar", "tooltip": true },
        "encoding": {
            "x": { "field": "workers", "type": "ordinal", "title": "Total Workers" },
            "y": { "field": "latency", "type": "quantitative", "title": "P99 Latency (ms)" },
            "xOffset": { "field": "query" },
            "color": { "field": "query", "title": "Query Type" }
        }
    };

    const chartId = `chart-query-types-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite chart for cache throughput
 */
function generateCacheThroughputChart(data: Array<{cacheSizeMB: number; opsPerSec: number}>): string {
    const vegaSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": 800,
        "height": 300,
        "data": { "values": data },
        "mark": { "type": "line", "point": true, "tooltip": true },
        "encoding": {
            "x": { "field": "cacheSizeMB", "type": "quantitative", "title": "Cache Size (MB)", "scale": { "type": "log" } },
            "y": { "field": "opsPerSec", "type": "quantitative", "title": "Ops / Sec" }
        }
    };

    const chartId = `chart-cache-throughput-${Math.random().toString(36).substr(2, 9)}`;
    return `<div id="${chartId}"></div>
<script type="text/javascript">
  var spec = ${JSON.stringify(vegaSpec, null, 2)};
  vegaEmbed('#${chartId}', spec);
</script>`;
}

/**
 * Generate Vega-Lite HTML Report
 */
function generateHtmlReport(results: MixedResults[]): string {
    const timestamp = new Date().toLocaleString();
    const concurrencyData = getConcurrencyData(results);
    const cacheData = getCacheData(results);
    
    // Concurrency Analysis Data
    const cData = concurrencyData.map(r => ({
        workers: r.configuration.readWorkers + r.configuration.writeWorkers,
        opsPerSec: r.combined.opsPerSec,
        readP99: r.reads.p99,
        writeP99: r.writes.p99
    }));

    const cReadLatency = concurrencyData.map(r => ({
        x: r.configuration.readWorkers + r.configuration.writeWorkers,
        min: r.reads.minTime,
        max: r.reads.maxTime,
        avg: r.reads.avgTime,
        p50: r.reads.p50,
        p99: r.reads.p99
    }));

    const cWriteLatency = concurrencyData.map(r => ({
        x: r.configuration.readWorkers + r.configuration.writeWorkers,
        min: r.writes.minTime,
        max: r.writes.maxTime,
        avg: r.writes.avgTime,
        p50: r.writes.p50,
        p99: r.writes.p99
    }));

    const queryData: Array<{workers: number; query: string; latency: number}> = [];
    concurrencyData.forEach(r => {
        const qt = r.reads.byQueryType || {};
        const workers = r.configuration.readWorkers + r.configuration.writeWorkers;
        if (qt.single_post_with_details) queryData.push({ workers, query: "Single Post with Details", latency: qt.single_post_with_details.p99 });
        if (qt.posts_for_user) queryData.push({ workers, query: "Posts for User", latency: qt.posts_for_user.p99 });
        if (qt.posts_in_timeframe) queryData.push({ workers, query: "Posts in Timeframe", latency: qt.posts_in_timeframe.p99 });
        if (qt.users_in_timeframe) queryData.push({ workers, query: "Users in Timeframe", latency: qt.users_in_timeframe.p99 });
    });

    // Cache Analysis Data
    const cCacheData = cacheData.map(r => ({
        cacheSizeMB: Math.abs(r.configuration.cacheSize) / 1000,
        opsPerSec: r.combined.opsPerSec,
    }));

    const cCacheP99 = cacheData.map(r => ({
        x: Math.abs(r.configuration.cacheSize) / 1000,
        readP99: r.reads.p99,
        writeP99: r.writes.p99
    }));

    const cCacheReadLatency = cacheData.map(r => ({
        x: Math.abs(r.configuration.cacheSize) / 1000,
        min: r.reads.minTime,
        max: r.reads.maxTime,
        avg: r.reads.avgTime,
        p50: r.reads.p50,
        p99: r.reads.p99
    }));

    const cCacheWriteLatency = cacheData.map(r => ({
        x: Math.abs(r.configuration.cacheSize) / 1000,
        min: r.writes.minTime,
        max: r.writes.maxTime,
        avg: r.writes.avgTime,
        p50: r.writes.p50,
        p99: r.writes.p99
    }));

    return `<!DOCTYPE html>
<html>
<head>
  <title>SQLite Mixed Workload Benchmark</title>
  <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background: #f4f4f9; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { margin-bottom: 10px; }
    .meta { color: #666; margin-bottom: 40px; }
    .section { margin-bottom: 60px; padding-top: 20px; border-top: 1px solid #eee; }
    .section h2 { margin-bottom: 20px; color: #2c3e50; }
    .chart-container { margin-bottom: 40px; }
    .description { margin-bottom: 15px; color: #555; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9em; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; }
    tr:hover { background-color: #f5f5f5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>SQLite Mixed Workload Benchmark</h1>
    <div class="meta">Generated: ${timestamp}</div>

    <div class="section">
      <h2>Part 1: Concurrency Scaling (Fixed RAM: 64MB)</h2>
      <div class="description">
        Analysis of performance scaling from 2 to 64 concurrent workers with a fixed 64MB page cache.
      </div>

      <div class="chart-container">
        <h3>Throughput (Ops/Sec)</h3>
        ${generateThroughputChart(cData)}
      </div>
      
      <div class="chart-container">
        <h3>P99 Latency Comparison (Read vs Write)</h3>
        ${generateP99ComparisonChart(cData.map(d => ({ x: d.workers, readP99: d.readP99, writeP99: d.writeP99 })), "Total Workers")}
      </div>

      <div class="chart-container">
        <h3>Detailed Read Latency (ms)</h3>
        ${generateMultiMetricLatencyChart(cReadLatency, "Total Workers", "Read Latency (ms)")}
      </div>
      <div class="chart-container">
        <h3>Detailed Write Latency (ms)</h3>
        ${generateMultiMetricLatencyChart(cWriteLatency, "Total Workers", "Write Latency (ms)")}
      </div>
      
      <div class="chart-container">
        <h3>Read Query Type Breakdown (P99)</h3>
        ${generateQueryTypeChart(queryData)}
      </div>
    </div>

    <div class="section">
      <h2>Part 2: Cache Impact (Fixed Workers: 10)</h2>
      <div class="description">
        Impact of RAM (Cache Size) on performance, ranging from 8MB to 4GB, with a fixed concurrent load of 10 workers (8r/2w).
      </div>
      <div class="chart-container">
        <h3>Throughput by Cache Size</h3>
        ${generateCacheThroughputChart(cCacheData)}
      </div>

      <div class="chart-container">
        <h3>P99 Latency by Cache Size</h3>
        ${generateP99ComparisonChart(cCacheP99, "Cache Size (MB)", true)}
      </div>

      <div class="chart-container">
        <h3>Detailed Read Latency by Cache Size</h3>
        ${generateMultiMetricLatencyChart(cCacheReadLatency, "Cache Size (MB)", "Read Latency (ms)", true)}
      </div>
      <div class="chart-container">
        <h3>Detailed Write Latency by Cache Size</h3>
        ${generateMultiMetricLatencyChart(cCacheWriteLatency, "Cache Size (MB)", "Write Latency (ms)", true)}
      </div>
    </div>

    <div class="section">
        <h2>Raw Data Reference</h2>
        <table>
            <thead>
                <tr>
                    <th>Config ID</th>
                    <th>Workers</th>
                    <th>Cache (MB)</th>
                    <th>Ops/Sec</th>
                    <th>Read P99 (ms)</th>
                    <th>Write P99 (ms)</th>
                    <th>Duration (s)</th>
                </tr>
            </thead>
            <tbody>
                ${results.sort((a,b) => (a.configuration.readWorkers + a.configuration.writeWorkers) - (b.configuration.readWorkers + b.configuration.writeWorkers) || Math.abs(a.configuration.cacheSize) - Math.abs(b.configuration.cacheSize)).map(r => `
                <tr>
                    <td>${r.configuration.id}</td>
                    <td>${r.configuration.readWorkers + r.configuration.writeWorkers}</td>
                    <td>${Math.abs(r.configuration.cacheSize)/1000}</td>
                    <td>${r.combined.opsPerSec.toFixed(0)}</td>
                    <td>${r.reads.p99.toFixed(2)}</td>
                    <td>${r.writes.p99.toFixed(2)}</td>
                    <td>${(r.duration / 1000).toFixed(1)}</td>
                </tr>`).join("")}
            </tbody>
        </table>
    </div>

  </div>
</body>
</html>`;
}

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
    
    let finalPath = config.outputPath;
    if (finalPath.endsWith(".md")) {
        finalPath = finalPath.replace(".md", ".html");
    }

    const html = generateHtmlReport(results);

    mkdirSync(dirname(finalPath), { recursive: true });
    writeFileSync(finalPath, html);

    console.log(`Report generated: ${finalPath}`);
}
