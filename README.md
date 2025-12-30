# SQLite Test

SQLite benchmark scenarios for testing concurrent read/write performance.

## Usage

### Scenarios (write-only)

Run a scenario:
```bash
npm run cli <scenario-name>
```

Available scenarios: `base0`, `busyTimeout1`, `busyTimeout2000`, `busyTimeout400`, `wal`, `walSyncNormal`, `walSyncNormalAutocheckpoint2000`, `walSyncNormalAutocheckpoint4000`, `walSyncNormalAutocheckpoint4000Mmap1gb`, `walSyncNormalBusyTimeout5000`

### Mixed read/write

Run mixed read/write benchmark:
```bash
npm run cli mixedReadWrite -- -r 10 -w 5 -R 2000000 -W 100000
```

Options: `-r` (read workers), `-w` (write workers), `-R` (total reads), `-W` (total writes), `-c` (cache size in KB)

## Reports

Generate a report for a specific scenario:
```bash
npm run cli report <scenario>
```

Generate reports for all scenarios:
```bash
npm run cli report-all
```

Generate derived reports (run in order):
```bash
npm run cli compound-report
npm run cli scenario-compound-report
npm run cli scenario-compound-report-v2
```
