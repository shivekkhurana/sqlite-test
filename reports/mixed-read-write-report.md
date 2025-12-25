# Mixed Read/Write Benchmark: undefined

**Test Run:** 12/25/2025, 1:39:52 AM

## Configuration

| Setting | Value |
|---------|-------|
| ID | undefined |
| Read Workers | 18 |
| Write Workers | 2 |
| Total Reads | 2,000,016 |
| Total Writes | 200,000 |
| Total Operations | 2,200,016 |
| Read:Write Ratio | 10.0:1 |
| Cache Size | NaN KB (NaN MB) |

## Summary

| Metric | Reads | Writes | Combined |
|--------|-------|--------|----------|
| Total | 2,000,016 | 200,000 | 2,200,016 |
| Successful | 2,000,016 | 200,000 | - |
| Success Rate | 100.0% | 100.0% | - |
| Throughput | 4553/sec | 455/sec | 5008/sec |
| Avg Latency | 1.31ms | 0.53ms | - |
| P50 Latency | 0.54ms | 0.21ms | - |
| P95 Latency | 1.33ms | 1.56ms | - |
| P99 Latency | 4.24ms | 2.89ms | - |
| Errors | 0 (busy: 0) | 0 (lock: 0) | - |

**Total Duration:** 439.29 seconds

## Read Query Breakdown

| Query Type | Count | Avg (ms) | P95 (ms) | P99 (ms) | Avg Rows |
|------------|-------|----------|----------|----------|----------|
| posts_for_user | 499,867 | 0.21 | 0.35 | 0.79 | 0.7 |
| posts_in_timeframe | 500,316 | 1.01 | 1.46 | 3.07 | 100.0 |
| single_post_with_details | 500,592 | 0.21 | 0.37 | 0.72 | 3.9 |
| users_in_timeframe | 499,241 | 3.82 | 1.98 | 115.17 | 858.0 |


## Key Observations

### Read Performance
- **2,000,016** successful reads out of 2,000,016 (100.0% success rate)
- Average read latency: **1.31ms**, P99: **4.24ms**
- Read throughput: **4553 reads/sec**
- ✅ No busy errors during reads (WAL mode working well)

### Write Performance
- **200,000** successful writes out of 200,000 (100.0% success rate)
- Average write latency: **0.53ms**, P99: **2.89ms**
- Write throughput: **455 writes/sec**
- ✅ No lock errors during writes

### Combined Throughput
- Total operations completed: **2,200,016**
- Combined throughput: **5008 ops/sec**

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

```json
{
  "testName": "mixedReadWrite",
  "timestamp": "2025-12-24T20:09:52.254Z",
  "configuration": {
    "readWorkers": 18,
    "writeWorkers": 2,
    "readsPerWorker": 111112,
    "writesPerWorker": 100000,
    "totalReads": 2000016,
    "totalWrites": 200000,
    "totalOperations": 2200016,
    "readWriteRatio": 10.00008
  },
  "duration": 439286.735894,
  "reads": {
    "total": 2000016,
    "successful": 2000016,
    "errors": 0,
    "busyErrors": 0,
    "successRate": 100,
    "avgTime": 1.3140755477550683,
    "minTime": 0.04772600000433158,
    "maxTime": 447.2691960000084,
    "p50": 0.5409229999931995,
    "p95": 1.334789999993518,
    "p99": 4.238880999997491,
    "readsPerSec": 4552.871363005607,
    "byQueryType": {
      "posts_for_user": {
        "count": 499867,
        "avgTime": 0.211951958797068,
        "p95": 0.34906999999657273,
        "p99": 0.7922140000155196,
        "avgRowCount": 0.6969373853445017
      },
      "posts_in_timeframe": {
        "count": 500316,
        "avgTime": 1.014711077063281,
        "p95": 1.4553109999978915,
        "p99": 3.06845500000054,
        "avgRowCount": 100
      },
      "single_post_with_details": {
        "count": 500592,
        "avgTime": 0.21107729606345504,
        "p95": 0.36956999998074025,
        "p99": 0.7210440000053495,
        "avgRowCount": 3.898504171061463
      },
      "users_in_timeframe": {
        "count": 499241,
        "avgTime": 3.8235732600227466,
        "p95": 1.9779339999658987,
        "p99": 115.17291000002297,
        "avgRowCount": 858.0448801280344
      }
    }
  },
  "writes": {
    "total": 200000,
    "successful": 200000,
    "errors": 0,
    "lockErrors": 0,
    "successRate": 100,
    "avgTime": 0.532216033010018,
    "minTime": 0.0711439999868162,
    "maxTime": 227.3170580000151,
    "p50": 0.20621199999004602,
    "p95": 1.5649180000182241,
    "p99": 2.8890900000114925,
    "writesPerSec": 455.2834940326085
  },
  "combined": {
    "totalOps": 2200016,
    "opsPerSec": 5008.154857038216
  }
}
```

</details>
