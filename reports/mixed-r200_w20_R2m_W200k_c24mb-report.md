# Mixed Read/Write Benchmark: r200_w20_R2m_W200k_c24mb

**Test Run:** 12/25/2025, 2:18:42 AM

## Configuration

| Setting | Value |
|---------|-------|
| ID | r200_w20_R2m_W200k_c24mb |
| Read Workers | 200 |
| Write Workers | 20 |
| Total Reads | 2,000,000 |
| Total Writes | 200,000 |
| Total Operations | 2,200,000 |
| Read:Write Ratio | 10.0:1 |
| Cache Size | 24000 KB (24 MB) |

## Summary

| Metric | Reads | Writes | Combined |
|--------|-------|--------|----------|
| Total | 2,000,000 | 200,000 | 2,200,000 |
| Successful | 2,000,000 | 200,000 | - |
| Success Rate | 100.0% | 100.0% | - |
| Throughput | 4334/sec | 433/sec | 4768/sec |
| Avg Latency | 3.27ms | 7.96ms | - |
| P50 Latency | 0.99ms | 1.52ms | - |
| P95 Latency | 8.08ms | 35.80ms | - |
| P99 Latency | 47.17ms | 91.75ms | - |
| Errors | 0 (busy: 0) | 0 (lock: 0) | - |

**Total Duration:** 461.42 seconds

## Read Query Breakdown

| Query Type | Count | Avg (ms) | P95 (ms) | P99 (ms) | Avg Rows |
|------------|-------|----------|----------|----------|----------|
| posts_for_user | 499,782 | 0.83 | 2.54 | 13.94 | 0.6 |
| posts_in_timeframe | 499,580 | 3.52 | 11.71 | 43.89 | 100.0 |
| single_post_with_details | 500,001 | 0.72 | 2.13 | 11.61 | 3.1 |
| users_in_timeframe | 500,637 | 8.01 | 17.71 | 163.06 | 731.5 |


## Key Observations

### Read Performance
- **2,000,000** successful reads out of 2,000,000 (100.0% success rate)
- Average read latency: **3.27ms**, P99: **47.17ms**
- Read throughput: **4334 reads/sec**
- ✅ No busy errors during reads (WAL mode working well)

### Write Performance
- **200,000** successful writes out of 200,000 (100.0% success rate)
- Average write latency: **7.96ms**, P99: **91.75ms**
- Write throughput: **433 writes/sec**
- ✅ No lock errors during writes

### Combined Throughput
- Total operations completed: **2,200,000**
- Combined throughput: **4768 ops/sec**

## Raw Data

<details>
<summary>Click to expand raw JSON data</summary>

```json
{
  "testName": "mixedReadWrite-r200_w20_R2m_W200k_c24mb",
  "timestamp": "2025-12-24T20:48:42.715Z",
  "configuration": {
    "id": "r200_w20_R2m_W200k_c24mb",
    "readWorkers": 200,
    "writeWorkers": 20,
    "readsPerWorker": 10000,
    "writesPerWorker": 10000,
    "totalReads": 2000000,
    "totalWrites": 200000,
    "totalOperations": 2200000,
    "readWriteRatio": 10,
    "cacheSize": 24000
  },
  "duration": 461415.053001,
  "reads": {
    "total": 2000000,
    "successful": 2000000,
    "errors": 0,
    "busyErrors": 0,
    "successRate": 100,
    "avgTime": 3.2708326658583537,
    "minTime": 0.055886000001919456,
    "maxTime": 4177.337731000036,
    "p50": 0.9931439999782015,
    "p95": 8.083238000006531,
    "p99": 47.17456199997105,
    "readsPerSec": 4334.492312273274,
    "byQueryType": {
      "posts_for_user": {
        "count": 499782,
        "avgTime": 0.8279733681964705,
        "p95": 2.53740899998229,
        "p99": 13.940100000007078,
        "avgRowCount": 0.6057921253666598
      },
      "posts_in_timeframe": {
        "count": 499580,
        "avgTime": 3.5181250141500318,
        "p95": 11.70549999998184,
        "p99": 43.89327300002333,
        "avgRowCount": 100
      },
      "single_post_with_details": {
        "count": 500001,
        "avgTime": 0.7175911728716653,
        "p95": 2.1276600000128383,
        "p99": 11.610232000006363,
        "avgRowCount": 3.0731698536602927
      },
      "users_in_timeframe": {
        "count": 500637,
        "avgTime": 8.012747653921087,
        "p95": 17.70813600003021,
        "p99": 163.0570810000063,
        "avgRowCount": 731.4705605059155
      }
    }
  },
  "writes": {
    "total": 200000,
    "successful": 200000,
    "errors": 0,
    "lockErrors": 0,
    "successRate": 100,
    "avgTime": 7.957772203105036,
    "minTime": 0.06524400001217145,
    "maxTime": 2137.6333589999704,
    "p50": 1.5162819999968633,
    "p95": 35.79609800000617,
    "p99": 91.75076699996134,
    "writesPerSec": 433.4492312273274
  },
  "combined": {
    "totalOps": 2200000,
    "opsPerSec": 4767.941543500601
  }
}
```

</details>
