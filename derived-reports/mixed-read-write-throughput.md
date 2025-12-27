# Mixed Read/Write Throughput Analysis

**Generated:** 12/25/2025, 10:06:03 PM

## Configuration Legend

**Config ID Format:** `rX_wY_R..._W..._c...mb`

Where:
- `rX` = number of read workers (e.g., r10 = 10 read workers)
- `wY` = number of write workers (e.g., w2 = 2 write workers)
- `R...` = total reads per worker (e.g., R200k = 200,000 reads per worker)
- `W...` = total writes per worker (e.g., W20k = 20,000 writes per worker)
- `c...mb` = cache size in megabytes (e.g., c16mb = 16 MB cache)

**Example:** `r10_w2_R200k_W20k_c16mb` means:
- 10 read workers
- 2 write workers
- 200,000 reads per read worker (2,000,000 total reads)
- 20,000 writes per write worker (40,000 total writes)
- 16 MB cache size

## Throughput Charts

### Reads Throughput

This chart shows the read operations per second for each configuration.

```mermaid
xychart-beta
    title "Reads Throughput by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Reads/sec" 0 --> 20000
    bar [689, 1903, 1878, 7704, 7632, 8168, 8456, 8601, 8447, 7254, 3468, 3283, 3750, 3595, 9024, 2992, 9394, 9425, 9590, 9392, 10092, 10246, 9418, 9999, 2197, 5300, 1464, 3654, 4921, 3745, 4334, 4210, 293, 966]
```

### Writes Throughput

This chart shows the write operations per second for each configuration.

```mermaid
xychart-beta
    title "Writes Throughput by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Writes/sec" 0 --> 2000
    bar [34, 381, 188, 770, 763, 817, 846, 860, 845, 725, 347, 328, 375, 359, 902, 299, 939, 943, 959, 939, 1009, 1025, 942, 1000, 220, 530, 146, 365, 492, 375, 433, 421, 29, 97]
```

### Total Operations Throughput

This chart shows the combined (reads + writes) operations per second for each configuration.

```mermaid
xychart-beta
    title "Total Operations Throughput by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Ops/sec" 0 --> 20000
    bar [723, 2283, 2066, 8475, 8395, 8985, 9302, 9461, 9291, 7979, 3814, 3611, 4125, 3954, 9926, 3292, 10333, 10368, 10549, 10331, 11102, 11270, 10360, 10998, 2417, 5830, 1610, 4019, 5413, 4120, 4768, 4631, 322, 1063]
```

## Latency Charts

### Best Case Latency (Min)

#### Read Latency: Best Case (Min)

This chart shows the minimum (best case) latency for read operations across all configurations.

```mermaid
xychart-beta
    title "Read Latency: Best Case (Min) by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 0.1
    bar [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.05, 0.06, 0.06, 0.06, 0.07, 0.07]
```

#### Write Latency: Best Case (Min)

This chart shows the minimum (best case) latency for write operations across all configurations.

```mermaid
xychart-beta
    title "Write Latency: Best Case (Min) by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 0.1
    bar [0.06, 0.07, 0.07, 0.06, 0.06, 0.07, 0.08, 0.08, 0.07, 0.09, 0.07, 0.08, 0.06, 0.07, 0.08, 0.08, 0.08, 0.08, 0.08, 0.06, 0.09, 0.08, 0.06, 0.09, 0.08, 0.06, 0.08, 0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.06]
```

### Worst Case Latency (Max)

#### Read Latency: Worst Case (Max)

This chart shows the maximum (worst case) latency for read operations across all configurations.

```mermaid
xychart-beta
    title "Read Latency: Worst Case (Max) by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 10000
    bar [11.24, 1.62, 223.20, 58.04, 57.23, 77.19, 54.68, 19.67, 13.94, 4.08, 340.84, 235.53, 228.50, 304.14, 22.25, 459.30, 17.15, 62.96, 109.62, 49.30, 135.59, 73.52, 76.35, 112.07, 564.62, 534.58, 1892.43, 1047.70, 1177.36, 3255.20, 4177.34, 3638.77, 5563.74, 3113.71]
```

#### Write Latency: Worst Case (Max)

This chart shows the maximum (worst case) latency for write operations across all configurations.

```mermaid
xychart-beta
    title "Write Latency: Worst Case (Max) by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 5000
    bar [0.60, 0.76, 150.87, 59.04, 108.33, 87.82, 106.50, 58.82, 55.92, 35.08, 134.15, 100.74, 114.39, 113.50, 109.26, 148.95, 134.35, 85.19, 202.55, 187.16, 197.44, 442.91, 239.57, 444.07, 249.91, 192.69, 700.07, 364.92, 865.52, 1373.36, 2137.63, 1496.50, 1263.36, 2131.46]
```

### Average Latency

#### Read Latency: Average

This chart shows the average latency for read operations across all configurations.

```mermaid
xychart-beta
    title "Read Latency: Average by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 20
    bar [0.30, 0.40, 0.62, 0.62, 0.59, 0.56, 0.56, 0.55, 0.56, 0.55, 0.80, 0.87, 0.76, 0.78, 0.59, 1.04, 0.60, 0.63, 0.66, 0.65, 0.69, 0.70, 0.72, 0.75, 1.10, 1.07, 4.87, 1.35, 2.97, 2.14, 3.27, 3.35, 12.33, 5.86]
```

#### Write Latency: Average

This chart shows the average latency for write operations across all configurations.

```mermaid
xychart-beta
    title "Write Latency: Average by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 20
    bar [0.22, 0.15, 0.34, 0.58, 0.55, 0.52, 0.63, 0.60, 0.58, 0.47, 0.65, 0.67, 0.62, 0.63, 0.60, 0.70, 1.03, 1.04, 1.37, 1.38, 1.34, 1.70, 1.75, 1.63, 1.80, 1.29, 2.45, 3.10, 7.37, 5.91, 7.96, 15.55, 16.08, 12.54]
```

### P50 Latency (Median)

#### Read Latency: P50 (Median)

This chart shows the 50th percentile (median) latency for read operations across all configurations.

```mermaid
xychart-beta
    title "Read Latency: P50 (Median) by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 2
    bar [0.39, 0.44, 0.42, 0.52, 0.52, 0.47, 0.44, 0.33, 0.50, 0.38, 0.50, 0.48, 0.47, 0.48, 0.47, 0.57, 0.47, 0.52, 0.59, 0.54, 0.64, 0.74, 0.64, 0.73, 0.68, 0.56, 1.19, 0.93, 0.95, 1.00, 0.99, 0.96, 1.06, 1.13]
```

#### Write Latency: P50 (Median)

This chart shows the 50th percentile (median) latency for write operations across all configurations.

```mermaid
xychart-beta
    title "Write Latency: P50 (Median) by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 5
    bar [0.25, 0.13, 0.34, 0.21, 0.21, 0.20, 0.22, 0.22, 0.21, 0.21, 0.27, 0.32, 0.24, 0.25, 0.22, 0.30, 0.40, 0.49, 0.50, 0.47, 0.31, 0.40, 0.46, 0.27, 1.21, 0.31, 0.72, 1.42, 1.57, 1.46, 1.52, 3.63, 1.37, 1.38]
```

### P95 Latency

#### Read Latency: P95

This chart shows the 95th percentile latency for read operations across all configurations.

```mermaid
xychart-beta
    title "Read Latency: P95 by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 20
    bar [0.62, 0.85, 0.90, 1.12, 1.08, 1.08, 1.06, 1.05, 1.09, 1.14, 1.13, 1.10, 1.09, 1.08, 1.10, 1.31, 1.12, 1.17, 1.26, 1.21, 1.34, 1.37, 1.36, 1.45, 1.47, 1.46, 13.54, 2.39, 3.12, 5.15, 8.08, 9.82, 15.09, 18.57]
```

#### Write Latency: P95

This chart shows the 95th percentile latency for write operations across all configurations.

```mermaid
xychart-beta
    title "Write Latency: P95 by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Latency (ms)" 0 --> 100
    bar [0.41, 0.24, 0.65, 1.68, 1.58, 1.53, 1.70, 1.62, 1.62, 1.48, 1.50, 1.52, 1.50, 1.49, 1.61, 1.57, 3.76, 3.88, 4.11, 4.20, 4.11, 4.40, 4.70, 4.28, 5.20, 3.96, 9.13, 10.65, 36.19, 22.36, 35.80, 67.00, 60.10, 58.70]
```

## Error Analysis

### Errors by Configuration

This chart shows the number of errors for read operations (SQLITE_BUSY errors) and write operations (lock errors) across all configurations. Read errors combine busy errors, and write errors combine lock errors.

```mermaid
xychart-beta
    title "Errors by Configuration"
    x-axis ["A0", "B0", "C0", "D0", "E0", "F0", "G0", "H0", "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0", "A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]
    y-axis "Error Count" 0 --> 5
    bar "Read Errors (Busy)" [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    bar "Write Errors (Lock)" [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3]
```

## Summary Table

| Label | Config ID | Read Workers | Write Workers | Cache Size | Reads/sec | Writes/sec | Total Ops/sec | Read Errors | Write Errors |
|-------|-----------|--------------|---------------|------------|-----------|------------|---------------|-------------|--------------|
| A0 | r1_w1_R20k_W1k_c16mb | 1 | 1 | 16 MB | 689 | 34 | 723 | 0 | 0 |
| B0 | r5_w1_R1000_W200_c16mb | 5 | 1 | 16 MB | 1903 | 381 | 2283 | 0 | 0 |
| C0 | r5_w1_R2m_W200k_c24mb | 5 | 1 | 24 MB | 1878 | 188 | 2066 | 0 | 0 |
| D0 | r10_w2_R200k_W20k_c16mb | 10 | 2 | 16 MB | 7704 | 770 | 8475 | 0 | 0 |
| E0 | r10_w2_R200k_W20k_c20mb | 10 | 2 | 20 MB | 7632 | 763 | 8395 | 0 | 0 |
| F0 | r10_w2_R200k_W20k_c24mb | 10 | 2 | 24 MB | 8168 | 817 | 8985 | 0 | 0 |
| G0 | r10_w2_R200k_W20k_c32mb | 10 | 2 | 32 MB | 8456 | 846 | 9302 | 0 | 0 |
| H0 | r10_w2_R200k_W20k_c48mb | 10 | 2 | 48 MB | 8601 | 860 | 9461 | 0 | 0 |
| I0 | r10_w2_R200k_W20k_c56mb | 10 | 2 | 56 MB | 8447 | 845 | 9291 | 0 | 0 |
| J0 | r10_w2_R20k_W2000_c24mb | 10 | 2 | 24 MB | 7254 | 725 | 7979 | 0 | 0 |
| K0 | r10_w2_R2m_W200k_c16mb | 10 | 2 | 16 MB | 3468 | 347 | 3814 | 0 | 0 |
| L0 | r10_w2_R2m_W200k_c24mb | 10 | 2 | 24 MB | 3283 | 328 | 3611 | 0 | 0 |
| M0 | r10_w2_R2m_W200k_c32mb | 10 | 2 | 32 MB | 3750 | 375 | 4125 | 0 | 0 |
| N0 | r10_w2_R2m_W200k_c8mb | 10 | 2 | 8 MB | 3595 | 359 | 3954 | 0 | 0 |
| O0 | r11_w2_R200k_W20k_c48mb | 11 | 2 | 48 MB | 9024 | 902 | 9926 | 0 | 0 |
| P0 | r12_w2_R2m_W200k_c100mb | 12 | 2 | 100 MB | 2992 | 299 | 3292 | 0 | 0 |
| Q0 | r12_w3_R200k_W20k_c48mb | 12 | 3 | 48 MB | 9394 | 939 | 10333 | 0 | 0 |
| R0 | r13_w3_R200k_W20k_c48mb | 13 | 3 | 48 MB | 9425 | 943 | 10368 | 0 | 0 |
| S0 | r14_w4_R200k_W20k_c48mb | 14 | 4 | 48 MB | 9590 | 959 | 10549 | 0 | 0 |
| T0 | r14_w4_R300k_W30k_c48mb | 14 | 4 | 48 MB | 9392 | 939 | 10331 | 0 | 0 |
| U0 | r16_w4_R200k_W20k_c48mb | 16 | 4 | 48 MB | 10092 | 1009 | 11102 | 0 | 0 |
| V0 | r17_w5_R200k_W20k_c48mb | 17 | 5 | 48 MB | 10246 | 1025 | 11270 | 0 | 0 |
| W0 | r17_w5_R300k_W30k_c48mb | 17 | 5 | 48 MB | 9418 | 942 | 10360 | 0 | 0 |
| X0 | r18_w5_R200k_W20k_c48mb | 18 | 5 | 48 MB | 9999 | 1000 | 10998 | 0 | 0 |
| Y0 | r20_w4_R2m_W200k_c100mb | 20 | 4 | 100 MB | 2197 | 220 | 2417 | 0 | 0 |
| Z0 | r20_w4_R2m_W200k_c24mb | 20 | 4 | 24 MB | 5300 | 530 | 5830 | 0 | 0 |
| A1 | r40_w4_R2m_W200k_c48mb | 40 | 4 | 48 MB | 1464 | 146 | 1610 | 0 | 0 |
| B1 | r80_w8_R2m_W200k_c100mb | 80 | 8 | 100 MB | 3654 | 365 | 4019 | 0 | 0 |
| C1 | r10_w2_R2m_W200k_c20mb | 80 | 20 | 20 MB | 4921 | 492 | 5413 | 0 | 0 |
| D1 | r160_w16_R2m_W200k_c100mb | 160 | 16 | 100 MB | 3745 | 375 | 4120 | 0 | 0 |
| E1 | r200_w20_R2m_W200k_c24mb | 200 | 20 | 24 MB | 4334 | 433 | 4768 | 0 | 0 |
| F1 | r400_w40_R2m_W200k_c100mb | 400 | 40 | 100 MB | 4210 | 421 | 4631 | 0 | 0 |
| G1 | r800_w40_R200k_W20k_c48mb | 800 | 40 | 48 MB | 293 | 29 | 322 | 0 | 0 |
| H1 | r800_w40_R2m_W200k_c100mb | 800 | 40 | 100 MB | 966 | 97 | 1063 | 0 | 3 |
