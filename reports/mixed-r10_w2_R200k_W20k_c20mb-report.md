# Mixed Read/Write Benchmark: r10_w2_R200k_W20k_c20mb

**Test Run:** 12/25/2025, 1:50:38 AM

## Configuration

| Setting | Value |
|---------|-------|
| ID | r10_w2_R200k_W20k_c20mb |
| Read Workers | 10 |
| Write Workers | 2 |
| Total Reads | 200,000 |
| Total Writes | 20,000 |
| Total Operations | 220,000 |
| Read:Write Ratio | 10.0:1 |
| Cache Size | 20000 KB (20 MB) |

## Summary

| Metric | Reads | Writes | Combined |
|--------|-------|--------|----------|
| Total | 200,000 | 20,000 | 220,000 |
| Successful | 200,000 | 20,000 | - |
| Success Rate | 100.0% | 100.0% | - |
| Throughput | 8497/sec | 850/sec | 9347/sec |
| Avg Latency | 0.57ms | 0.56ms | - |
| P50 Latency | 0.38ms | 0.20ms | - |
| P95 Latency | 1.08ms | 1.59ms | - |
| P99 Latency | 1.59ms | 4.29ms | - |
| Errors | 0 (busy: 0) | 0 (lock: 0) | - |

**Total Duration:** 23.54 seconds

## Read Query Breakdown

| Query Type | Count | Avg (ms) | P95 (ms) | P99 (ms) | Avg Rows |
|------------|-------|----------|----------|----------|----------|
| posts_for_user | 50,115 | 0.13 | 0.18 | 0.24 | 0.3 |
| posts_in_timeframe | 50,193 | 0.88 | 1.09 | 1.43 | 100.0 |
| single_post_with_details | 49,869 | 0.14 | 0.19 | 0.26 | 1.4 |
| users_in_timeframe | 49,823 | 1.16 | 1.25 | 10.74 | 293.7 |


## Key Observations

### Read Performance
- **200,000** successful reads out of 200,000 (100.0% success rate)
- Average read latency: **0.57ms**, P99: **1.59ms**
- Read throughput: **8497 reads/sec**
- ✅ No busy errors during reads (WAL mode working well)

### Write Performance
- **20,000** successful writes out of 20,000 (100.0% success rate)
- Average write latency: **0.56ms**, P99: **4.29ms**
- Write throughput: **850 writes/sec**
- ✅ No lock errors during writes

### Combined Throughput
- Total operations completed: **220,000**
- Combined throughput: **9347 ops/sec**

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

```json
{
  "testName": "mixedReadWrite-r10_w2_R200k_W20k_c20mb",
  "timestamp": "2025-12-24T20:20:38.015Z",
  "configuration": {
    "id": "r10_w2_R200k_W20k_c20mb",
    "readWorkers": 10,
    "writeWorkers": 2,
    "readsPerWorker": 20000,
    "writesPerWorker": 10000,
    "totalReads": 200000,
    "totalWrites": 20000,
    "totalOperations": 220000,
    "readWriteRatio": 10,
    "cacheSize": 20000
  },
  "duration": 23537.572490000002,
  "reads": {
    "total": 200000,
    "successful": 200000,
    "errors": 0,
    "busyErrors": 0,
    "successRate": 100,
    "avgTime": 0.574404734780001,
    "minTime": 0.044422999999369495,
    "maxTime": 39.44968300000028,
    "p50": 0.37891499999977896,
    "p95": 1.07943399999931,
    "p99": 1.5859470000004876,
    "readsPerSec": 8497.052960111774,
    "byQueryType": {
      "posts_for_user": {
        "count": 50115,
        "avgTime": 0.12846574758056545,
        "p95": 0.1835819999978412,
        "p99": 0.2397370000007868,
        "avgRowCount": 0.32445375636037116
      },
      "posts_in_timeframe": {
        "count": 50193,
        "avgTime": 0.8764665593608755,
        "p95": 1.0861939999999777,
        "p99": 1.4259790000005523,
        "avgRowCount": 100
      },
      "single_post_with_details": {
        "count": 49869,
        "avgTime": 0.13604231849445092,
        "p95": 0.19247299999915413,
        "p99": 0.2564650000003894,
        "avgRowCount": 1.4056828891696245
      },
      "users_in_timeframe": {
        "count": 49823,
        "avgTime": 1.1574193770146541,
        "p95": 1.25057599999991,
        "p99": 10.739024999998946,
        "avgRowCount": 293.67025269453865
      }
    }
  },
  "writes": {
    "total": 20000,
    "successful": 20000,
    "errors": 0,
    "lockErrors": 0,
    "successRate": 100,
    "avgTime": 0.5634792866500018,
    "minTime": 0.08229000000028464,
    "maxTime": 58.43028400000003,
    "p50": 0.20263400000021647,
    "p95": 1.5862809999998717,
    "p99": 4.292425999999978,
    "writesPerSec": 849.7052960111776
  },
  "combined": {
    "totalOps": 220000,
    "opsPerSec": 9346.758256122952
  }
}
```

</details>
