# Mixed Read/Write Benchmark: r5_w1_R1000_W200_c16mb

**Test Run:** 12/25/2025, 2:22:58 AM

## Configuration

| Setting | Value |
|---------|-------|
| ID | r5_w1_R1000_W200_c16mb |
| Read Workers | 5 |
| Write Workers | 1 |
| Total Reads | 1,000 |
| Total Writes | 200 |
| Total Operations | 1,200 |
| Read:Write Ratio | 5.0:1 |
| Cache Size | 16000 KB (16 MB) |

## Summary

| Metric | Reads | Writes | Combined |
|--------|-------|--------|----------|
| Total | 1,000 | 200 | 1,200 |
| Successful | 1,000 | 200 | - |
| Success Rate | 100.0% | 100.0% | - |
| Throughput | 1903/sec | 381/sec | 2283/sec |
| Avg Latency | 0.40ms | 0.15ms | - |
| P50 Latency | 0.44ms | 0.13ms | - |
| P95 Latency | 0.85ms | 0.24ms | - |
| P99 Latency | 1.03ms | 0.41ms | - |
| Errors | 0 (busy: 0) | 0 (lock: 0) | - |

**Total Duration:** 0.53 seconds

## Read Query Breakdown

| Query Type | Count | Avg (ms) | P95 (ms) | P99 (ms) | Avg Rows |
|------------|-------|----------|----------|----------|----------|
| posts_for_user | 245 | 0.10 | 0.17 | 0.21 | 0.3 |
| posts_in_timeframe | 238 | 0.68 | 0.90 | 1.03 | 100.0 |
| single_post_with_details | 255 | 0.11 | 0.17 | 0.24 | 1.2 |
| users_in_timeframe | 262 | 0.69 | 0.95 | 1.34 | 210.3 |


## Key Observations

### Read Performance
- **1,000** successful reads out of 1,000 (100.0% success rate)
- Average read latency: **0.40ms**, P99: **1.03ms**
- Read throughput: **1903 reads/sec**
- ✅ No busy errors during reads (WAL mode working well)

### Write Performance
- **200** successful writes out of 200 (100.0% success rate)
- Average write latency: **0.15ms**, P99: **0.41ms**
- Write throughput: **381 writes/sec**
- ✅ No lock errors during writes

### Combined Throughput
- Total operations completed: **1,200**
- Combined throughput: **2283 ops/sec**

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

```json
{
  "testName": "mixedReadWrite-r5_w1_R1000_W200_c16mb",
  "timestamp": "2025-12-24T20:52:58.114Z",
  "configuration": {
    "id": "r5_w1_R1000_W200_c16mb",
    "readWorkers": 5,
    "writeWorkers": 1,
    "readsPerWorker": 200,
    "writesPerWorker": 200,
    "totalReads": 1000,
    "totalWrites": 200,
    "totalOperations": 1200,
    "readWriteRatio": 5,
    "cacheSize": 16000
  },
  "duration": 525.5242880000001,
  "reads": {
    "total": 1000,
    "successful": 1000,
    "errors": 0,
    "busyErrors": 0,
    "successRate": 100,
    "avgTime": 0.39603562500000317,
    "minTime": 0.05111199999987548,
    "maxTime": 1.6245480000000043,
    "p50": 0.44423699999993005,
    "p95": 0.8544210000000021,
    "p99": 1.0326179999999567,
    "readsPerSec": 1902.8616237809354,
    "byQueryType": {
      "posts_for_user": {
        "count": 245,
        "avgTime": 0.10161664081632975,
        "p95": 0.16698200000018915,
        "p99": 0.21008899999992536,
        "avgRowCount": 0.2938775510204082
      },
      "posts_in_timeframe": {
        "count": 238,
        "avgTime": 0.6839106848739517,
        "p95": 0.8999659999999494,
        "p99": 1.0326179999999567,
        "avgRowCount": 100
      },
      "single_post_with_details": {
        "count": 255,
        "avgTime": 0.10637809411765714,
        "p95": 0.16744400000015958,
        "p99": 0.24210199999993165,
        "avgRowCount": 1.2078431372549019
      },
      "users_in_timeframe": {
        "count": 262,
        "avgTime": 0.6917648511450356,
        "p95": 0.9517759999998816,
        "p99": 1.3404380000001765,
        "avgRowCount": 210.28625954198472
      }
    }
  },
  "writes": {
    "total": 200,
    "successful": 200,
    "errors": 0,
    "lockErrors": 0,
    "successRate": 100,
    "avgTime": 0.14821049499999503,
    "minTime": 0.07377100000007886,
    "maxTime": 0.758265000000165,
    "p50": 0.13245000000006257,
    "p95": 0.24356699999998455,
    "p99": 0.4131919999999809,
    "writesPerSec": 380.5723247561871
  },
  "combined": {
    "totalOps": 1200,
    "opsPerSec": 2283.4339485371224
  }
}
```

</details>
