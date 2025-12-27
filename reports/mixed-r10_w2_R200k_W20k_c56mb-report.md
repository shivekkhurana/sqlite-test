# Mixed Read/Write Benchmark: r10_w2_R200k_W20k_c56mb

**Test Run:** 12/25/2025, 6:12:13 PM

## Configuration

| Setting | Value |
|---------|-------|
| ID | r10_w2_R200k_W20k_c56mb |
| Read Workers | 10 |
| Write Workers | 2 |
| Total Reads | 200,000 |
| Total Writes | 20,000 |
| Total Operations | 220,000 |
| Read:Write Ratio | 10.0:1 |
| Cache Size | 56000 KB (56 MB) |

## Summary

| Metric | Reads | Writes | Combined |
|--------|-------|--------|----------|
| Total | 200,000 | 20,000 | 220,000 |
| Successful | 200,000 | 20,000 | - |
| Success Rate | 100.0% | 100.0% | - |
| Throughput | 8447/sec | 845/sec | 9291/sec |
| Avg Latency | 0.56ms | 0.58ms | - |
| P50 Latency | 0.50ms | 0.21ms | - |
| P95 Latency | 1.09ms | 1.62ms | - |
| P99 Latency | 1.40ms | 4.21ms | - |
| Errors | 0 (busy: 0) | 0 (lock: 0) | - |

**Total Duration:** 23.68 seconds

## Read Query Breakdown

| Query Type | Count | Avg (ms) | P95 (ms) | P99 (ms) | Avg Rows |
|------------|-------|----------|----------|----------|----------|
| posts_for_user | 49,749 | 0.13 | 0.19 | 0.25 | 0.3 |
| posts_in_timeframe | 50,047 | 0.90 | 1.11 | 1.41 | 100.0 |
| single_post_with_details | 49,957 | 0.13 | 0.19 | 0.25 | 1.4 |
| users_in_timeframe | 50,247 | 1.09 | 1.21 | 8.49 | 279.5 |


## Charts

### Read vs Write Latency Comparison

This chart compares latency percentiles (P50, P95, P99) between read and write operations. It shows how read and write latencies differ under concurrent load.

```mermaid
xychart-beta
    title "Read vs Write Latency Comparison"
    x-axis ["P50", "P95", "P99"]
    y-axis "Latency (ms)" 0 --> 5
    line "Reads" [0.50, 1.09, 1.40]
    line "Writes" [0.21, 1.62, 4.21]
```

### Throughput Comparison

This chart compares the throughput of reads, writes, and combined operations. It shows the relative performance of read vs write operations.

```mermaid
xychart-beta
    title "Throughput Comparison"
    x-axis ["Reads", "Writes", "Combined"]
    y-axis "Operations/sec" 0 --> 10000
    bar [8447, 845, 9291]
```

### Average Latency by Query Type

This chart shows the average latency for each read query type. It helps identify which queries are the slowest.

```mermaid
xychart-beta
    title "Average Latency by Query Type"
    x-axis ["posts for user", "posts in timeframe", "single post with details", "users in timeframe"]
    y-axis "Avg Latency (ms)" 0 --> 2
    bar [0.13, 0.90, 0.13, 1.09]
```

### P95 Latency by Query Type

This chart shows the P95 latency (95th percentile) for each read query type. It highlights the worst-case performance for each query type.

```mermaid
xychart-beta
    title "P95 Latency by Query Type"
    x-axis ["posts for user", "posts in timeframe", "single post with details", "users in timeframe"]
    y-axis "P95 Latency (ms)" 0 --> 2
    bar [0.19, 1.11, 0.19, 1.21]
```

### Query Type Distribution

This chart shows the distribution of query types executed during the test. It helps verify that queries are evenly distributed.

```mermaid
xychart-beta
    title "Query Type Distribution"
    x-axis ["posts for user", "posts in timeframe", "single post with details", "users in timeframe"]
    y-axis "Count" 0 --> 100000
    bar [49749, 50047, 49957, 50247]
```

### Error Rates

This chart compares error rates between reads (SQLITE_BUSY errors) and writes (lock errors). It helps identify contention issues.

```mermaid
xychart-beta
    title "Error Rates: Reads vs Writes"
    x-axis ["Read Busy Errors", "Write Lock Errors"]
    y-axis "Error Count" 0 --> 1
    bar [0, 0]
```

### Success Rate Comparison

This chart compares the success rate of read vs write operations. Both should ideally be at 100%.

```mermaid
xychart-beta
    title "Success Rate: Reads vs Writes"
    x-axis ["Reads", "Writes"]
    y-axis "Success Rate (%)" 0 --> 100
    bar [100.0, 100.0]
```

## Key Observations

### Read Performance
- **200,000** successful reads out of 200,000 (100.0% success rate)
- Average read latency: **0.56ms**, P99: **1.40ms**
- Read throughput: **8447 reads/sec**
- ✅ No busy errors during reads (WAL mode working well)

### Write Performance
- **20,000** successful writes out of 20,000 (100.0% success rate)
- Average write latency: **0.58ms**, P99: **4.21ms**
- Write throughput: **845 writes/sec**
- ✅ No lock errors during writes

### Combined Throughput
- Total operations completed: **220,000**
- Combined throughput: **9291 ops/sec**

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

```json
{
  "testName": "mixedReadWrite-r10_w2_R200k_W20k_c56mb",
  "timestamp": "2025-12-25T12:42:13.617Z",
  "configuration": {
    "id": "r10_w2_R200k_W20k_c56mb",
    "readWorkers": 10,
    "writeWorkers": 2,
    "readsPerWorker": 20000,
    "writesPerWorker": 10000,
    "totalReads": 200000,
    "totalWrites": 20000,
    "totalOperations": 220000,
    "readWriteRatio": 10,
    "cacheSize": 56000
  },
  "duration": 23677.782421,
  "reads": {
    "total": 200000,
    "successful": 200000,
    "errors": 0,
    "busyErrors": 0,
    "successRate": 100,
    "avgTime": 0.5639812656949965,
    "minTime": 0.048052000000097905,
    "maxTime": 13.941068000000087,
    "p50": 0.4952290000001085,
    "p95": 1.0944589999999152,
    "p99": 1.4032439999996313,
    "readsPerSec": 8446.73696395734,
    "byQueryType": {
      "posts_for_user": {
        "count": 49749,
        "avgTime": 0.13207445687349925,
        "p95": 0.1859020000010787,
        "p99": 0.2530050000000301,
        "avgRowCount": 0.3272025568353133
      },
      "posts_in_timeframe": {
        "count": 50047,
        "avgTime": 0.895354093731911,
        "p95": 1.111775000000307,
        "p99": 1.4110169999985374,
        "avgRowCount": 100
      },
      "single_post_with_details": {
        "count": 49957,
        "avgTime": 0.1329154178993949,
        "p95": 0.19221999999899708,
        "p99": 0.25473199999942153,
        "avgRowCount": 1.4033869127449607
      },
      "users_in_timeframe": {
        "count": 50247,
        "avgTime": 1.0901315326885346,
        "p95": 1.2086980000003678,
        "p99": 8.494200000001001,
        "avgRowCount": 279.46388839134676
      }
    }
  },
  "writes": {
    "total": 20000,
    "successful": 20000,
    "errors": 0,
    "lockErrors": 0,
    "successRate": 100,
    "avgTime": 0.5770029709000004,
    "minTime": 0.07104299999991781,
    "maxTime": 55.92069300000003,
    "p50": 0.21353199999975914,
    "p95": 1.624614999998812,
    "p99": 4.212603999998464,
    "writesPerSec": 844.6736963957339
  },
  "combined": {
    "totalOps": 220000,
    "opsPerSec": 9291.410660353073
  }
}
```

</details>
