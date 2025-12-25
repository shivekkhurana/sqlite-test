# Mixed Read/Write Benchmark: r10_w2_R200k_W20k_c16mb

**Test Run:** 12/25/2025, 1:48:11 AM

## Configuration

| Setting | Value |
|---------|-------|
| ID | r10_w2_R200k_W20k_c16mb |
| Read Workers | 10 |
| Write Workers | 2 |
| Total Reads | 200,000 |
| Total Writes | 20,000 |
| Total Operations | 220,000 |
| Read:Write Ratio | 10.0:1 |
| Cache Size | 16000 KB (16 MB) |

## Summary

| Metric | Reads | Writes | Combined |
|--------|-------|--------|----------|
| Total | 200,000 | 20,000 | 220,000 |
| Successful | 200,000 | 20,000 | - |
| Success Rate | 100.0% | 100.0% | - |
| Throughput | 7704/sec | 770/sec | 8475/sec |
| Avg Latency | 0.62ms | 0.58ms | - |
| P50 Latency | 0.52ms | 0.21ms | - |
| P95 Latency | 1.12ms | 1.68ms | - |
| P99 Latency | 3.38ms | 4.45ms | - |
| Errors | 0 (busy: 0) | 0 (lock: 0) | - |

**Total Duration:** 25.96 seconds

## Read Query Breakdown

| Query Type | Count | Avg (ms) | P95 (ms) | P99 (ms) | Avg Rows |
|------------|-------|----------|----------|----------|----------|
| posts_for_user | 50,105 | 0.15 | 0.21 | 0.55 | 0.3 |
| posts_in_timeframe | 50,110 | 0.97 | 1.25 | 3.04 | 100.0 |
| single_post_with_details | 49,793 | 0.15 | 0.22 | 0.42 | 1.4 |
| users_in_timeframe | 49,992 | 1.21 | 1.58 | 11.39 | 283.7 |


## Key Observations

### Read Performance
- **200,000** successful reads out of 200,000 (100.0% success rate)
- Average read latency: **0.62ms**, P99: **3.38ms**
- Read throughput: **7704 reads/sec**
- ✅ No busy errors during reads (WAL mode working well)

### Write Performance
- **20,000** successful writes out of 20,000 (100.0% success rate)
- Average write latency: **0.58ms**, P99: **4.45ms**
- Write throughput: **770 writes/sec**
- ✅ No lock errors during writes

### Combined Throughput
- Total operations completed: **220,000**
- Combined throughput: **8475 ops/sec**

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

```json
{
  "testName": "mixedReadWrite-r10_w2_R200k_W20k_c16mb",
  "timestamp": "2025-12-24T20:18:11.358Z",
  "configuration": {
    "id": "r10_w2_R200k_W20k_c16mb",
    "readWorkers": 10,
    "writeWorkers": 2,
    "readsPerWorker": 20000,
    "writesPerWorker": 10000,
    "totalReads": 200000,
    "totalWrites": 20000,
    "totalOperations": 220000,
    "readWriteRatio": 10,
    "cacheSize": -16000
  },
  "duration": 25959.236746000002,
  "reads": {
    "total": 200000,
    "successful": 200000,
    "errors": 0,
    "busyErrors": 0,
    "successRate": 100,
    "avgTime": 0.61707964002001,
    "minTime": 0.047704000000067026,
    "maxTime": 58.03740899999957,
    "p50": 0.5217400000001362,
    "p95": 1.1247050000001764,
    "p99": 3.3791820000005828,
    "readsPerSec": 7704.386764407375,
    "byQueryType": {
      "posts_for_user": {
        "count": 50105,
        "avgTime": 0.14658721949905468,
        "p95": 0.2112489999999525,
        "p99": 0.5505149999989953,
        "avgRowCount": 0.3219439177726774
      },
      "posts_in_timeframe": {
        "count": 50110,
        "avgTime": 0.9650208520255541,
        "p95": 1.2538899999999558,
        "p99": 3.035407999999734,
        "avgRowCount": 100
      },
      "single_post_with_details": {
        "count": 49793,
        "avgTime": 0.14693372791357398,
        "p95": 0.22020999999949709,
        "p99": 0.42095700000027136,
        "avgRowCount": 1.4075874118852048
      },
      "users_in_timeframe": {
        "count": 49992,
        "avgTime": 1.2081474908385477,
        "p95": 1.575235000000248,
        "p99": 11.38897999999972,
        "avgRowCount": 283.71331413026087
      }
    }
  },
  "writes": {
    "total": 20000,
    "successful": 20000,
    "errors": 0,
    "lockErrors": 0,
    "successRate": 100,
    "avgTime": 0.5791837353499986,
    "minTime": 0.05909900000006019,
    "maxTime": 59.04332299999987,
    "p50": 0.21183700000074168,
    "p95": 1.6754080000009708,
    "p99": 4.449179000000186,
    "writesPerSec": 770.4386764407375
  },
  "combined": {
    "totalOps": 220000,
    "opsPerSec": 8474.825440848113
  }
}
```

</details>
