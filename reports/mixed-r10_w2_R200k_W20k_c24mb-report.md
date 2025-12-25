# Mixed Read/Write Benchmark: r10_w2_R200k_W20k_c24mb

**Test Run:** 12/25/2025, 1:51:35 AM

## Configuration

| Setting | Value |
|---------|-------|
| ID | r10_w2_R200k_W20k_c24mb |
| Read Workers | 10 |
| Write Workers | 2 |
| Total Reads | 200,000 |
| Total Writes | 20,000 |
| Total Operations | 220,000 |
| Read:Write Ratio | 10.0:1 |
| Cache Size | 24000 KB (24 MB) |

## Summary

| Metric | Reads | Writes | Combined |
|--------|-------|--------|----------|
| Total | 200,000 | 20,000 | 220,000 |
| Successful | 200,000 | 20,000 | - |
| Success Rate | 100.0% | 100.0% | - |
| Throughput | 8829/sec | 883/sec | 9712/sec |
| Avg Latency | 0.55ms | 0.59ms | - |
| P50 Latency | 0.36ms | 0.22ms | - |
| P95 Latency | 1.02ms | 1.60ms | - |
| P99 Latency | 1.39ms | 4.11ms | - |
| Errors | 0 (busy: 0) | 0 (lock: 0) | - |

**Total Duration:** 22.65 seconds

## Read Query Breakdown

| Query Type | Count | Avg (ms) | P95 (ms) | P99 (ms) | Avg Rows |
|------------|-------|----------|----------|----------|----------|
| posts_for_user | 50,123 | 0.12 | 0.18 | 0.23 | 0.3 |
| posts_in_timeframe | 49,929 | 0.86 | 1.06 | 1.34 | 100.0 |
| single_post_with_details | 49,808 | 0.13 | 0.19 | 0.25 | 1.4 |
| users_in_timeframe | 50,140 | 1.06 | 1.12 | 10.04 | 275.6 |


## Key Observations

### Read Performance
- **200,000** successful reads out of 200,000 (100.0% success rate)
- Average read latency: **0.55ms**, P99: **1.39ms**
- Read throughput: **8829 reads/sec**
- ✅ No busy errors during reads (WAL mode working well)

### Write Performance
- **20,000** successful writes out of 20,000 (100.0% success rate)
- Average write latency: **0.59ms**, P99: **4.11ms**
- Write throughput: **883 writes/sec**
- ✅ No lock errors during writes

### Combined Throughput
- Total operations completed: **220,000**
- Combined throughput: **9712 ops/sec**

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

```json
{
  "testName": "mixedReadWrite-r10_w2_R200k_W20k_c24mb",
  "timestamp": "2025-12-24T20:21:35.129Z",
  "configuration": {
    "id": "r10_w2_R200k_W20k_c24mb",
    "readWorkers": 10,
    "writeWorkers": 2,
    "readsPerWorker": 20000,
    "writesPerWorker": 10000,
    "totalReads": 200000,
    "totalWrites": 20000,
    "totalOperations": 220000,
    "readWriteRatio": 10,
    "cacheSize": 24000
  },
  "duration": 22652.237598,
  "reads": {
    "total": 200000,
    "successful": 200000,
    "errors": 0,
    "busyErrors": 0,
    "successRate": 100,
    "avgTime": 0.5458736901649979,
    "minTime": 0.046467000000120606,
    "maxTime": 53.280047000000195,
    "p50": 0.360913000000437,
    "p95": 1.0189269999991666,
    "p99": 1.392667000000074,
    "readsPerSec": 8829.149841588202,
    "byQueryType": {
      "posts_for_user": {
        "count": 50123,
        "avgTime": 0.12472173371506029,
        "p95": 0.179859999999735,
        "p99": 0.23080499999969106,
        "avgRowCount": 0.3236837380045089
      },
      "posts_in_timeframe": {
        "count": 49929,
        "avgTime": 0.8612479197660663,
        "p95": 1.0610399999995934,
        "p99": 1.3372730000000956,
        "avgRowCount": 100
      },
      "single_post_with_details": {
        "count": 49808,
        "avgTime": 0.13244641133954926,
        "p95": 0.18642999999974563,
        "p99": 0.24681500000042433,
        "avgRowCount": 1.39606087375522
      },
      "users_in_timeframe": {
        "count": 50140,
        "avgTime": 1.063525575029927,
        "p95": 1.1237200000005032,
        "p99": 10.039896999998746,
        "avgRowCount": 275.5892899880335
      }
    }
  },
  "writes": {
    "total": 20000,
    "successful": 20000,
    "errors": 0,
    "lockErrors": 0,
    "successRate": 100,
    "avgTime": 0.5851094384000004,
    "minTime": 0.07929300000068906,
    "maxTime": 106.25179200000002,
    "p50": 0.22174999999970169,
    "p95": 1.5994530000007217,
    "p99": 4.113783999999214,
    "writesPerSec": 882.9149841588202
  },
  "combined": {
    "totalOps": 220000,
    "opsPerSec": 9712.06482574702
  }
}
```

</details>
