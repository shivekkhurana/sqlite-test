# Write Performance Test Plan

## Overview
Create a comprehensive performance test suite for SQLite database writes with 8 different concurrency configurations, measuring various performance metrics and outputting results in JSON format.

## Requirements
- Test 8 configurations: 1, 2, 4, 8, 16, 32, 64, 128 concurrent writes
- Each configuration performs 100,000 total writes
- Write to multiple tables: users, posts, tags, user_posts, posts_tags
- Use sensible proportions for data distribution
- Record performance metrics: avg, min, max, p95, p99, writes/sec, errors
- Output results to JSON file (e.g., `results/base-0.json`)
- Use Bun test framework
- Database should be passed as parameter (configurable)
- Use database file (not in-memory): for base-0, use `db/base-0.db`

## Implementation Plan

### 1. Database Setup Functions (`src/db.ts`)
   - Add `setupBase0Database()`: creates a Database instance with default SQLite config (out of the box experience)
     - Uses file-based database: `db/base-0.db`
     - Not in-memory, uses actual database file
   - Add `setupDatabase(db: Database)`: calls `setupTables()` to create tables
   - Add `teardownDatabase(db: Database)`: calls `tearDownTables()` and closes the database
   - Export utility functions for reuse
   - Each database config will have its own setup function

### 2. Write Operations Module (`src/writeOperations.ts`)
   - Create `performWrite(db: Database)`: generic write function that:
     - Sets up database (tables) before writing
     - Writes data in sensible proportions:
       - Users: ~10% of total writes (10,000 users for 100k writes)
       - Posts: ~40% of total writes (40,000 posts)
       - Tags: ~10% of total writes (10,000 tags)
       - User_posts: ~30% of total writes (30,000 relationships)
       - Posts_tags: ~10% of total writes (10,000 relationships)
     - Uses faker for random data generation
     - Returns `{ success: boolean, duration: number, error?: string }`
     - Tears down database after each write (setup and teardown for each write)

### 3. Performance Test Suite (`tests/write.test.ts`)
   - Test structure:
     - 8 test cases (1, 2, 4, 8, 16, 32, 64, 128 concurrent writes)
     - Each test:
       - Creates database instance using `setupBase0Database()` (uses `db/base-0.db` file)
       - Runs 100,000 total writes distributed across concurrent workers
       - Collects timing data for each write
       - Calculates metrics
       - Saves results to JSON
       - Cleans up database
   - Reuse same database across configurations (setup once, teardown once)

### 4. Metrics Calculation
   - For each configuration, calculate:
     - Average write time (ms)
     - Min write time (ms)
     - Max write time (ms)
     - P95 percentile (ms)
     - P99 percentile (ms)
     - Writes per second
     - Error count
     - Total duration

### 5. Type Definitions (`resultTypes/base0.types.ts`)
   - Create TypeScript types for base-0 test results
   - Define interfaces for:
     - Configuration metrics
     - Overall test results
     - Error tracking
   - Each database config will have its own types file

### 6. Results Output (`results/base-0.json`)
   - JSON structure:
     ```json
     {
       "testName": "write",
       "configurationId": "base-0",
       "timestamp": "...",
       "configurations": [
         {
           "concurrency": 1,
           "totalWrites": 100000,
           "metrics": {
             "avgWriteTime": ...,
             "minWriteTime": ...,
             "maxWriteTime": ...,
             "p95": ...,
             "p99": ...,
             "writesPerSecond": ...,
             "errorCount": ...,
             "totalDuration": ...
           }
         },
         ...
       ]
     }
     ```

### 7. Implementation Details
   - Use Bun's test framework
   - Use `Promise.all()` with concurrency control for parallel writes
   - Track errors separately from successful writes
   - Use database file (e.g., `db/base-0.db`) for each test run
   - Ensure proper cleanup
   - Each write operation should setup and teardown the database

### 8. File Structure
   ```
   src/
     - db.ts (enhanced with setupBase0Database)
     - writeOperations.ts (new - generic write function)
   tests/
     - write.test.ts (performance test suite)
   resultTypes/
     - base0.types.ts (TypeScript types for base-0 results)
   results/
     - base-0.json (output file)
   db/
     - base-0.db (database file for base-0 configuration)
   ```

## Data Distribution Proportions
- Users: 10% (10,000 for 100k writes)
- Posts: 40% (40,000 for 100k writes)
- Tags: 10% (10,000 for 100k writes)
- User_posts: 30% (30,000 for 100k writes)
- Posts_tags: 10% (10,000 for 100k writes)

## Notes
- Setup and teardown database for each write operation
- Use utility functions for reusability
- Generate sensible random data with faker
- Record errors to track failures
- Test name (e.g., "base-0") signifies SQLite configuration
- Use file-based database (not in-memory): `db/base-0.db` for base-0 configuration
- Create type definitions in `resultTypes/` for each database configuration

