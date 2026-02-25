# Plan: Fix MySQL CPU 100% & Redis Monitoring

## Context
MySQL container (`absenta13-mysql`) running at 100% CPU. Redis monitoring dashboard shows 0 connections/pool. Report page "Presensi Siswa (Format SMKN 13)" loads 8,813 records with max query time 2,923ms. 2 slow queries detected. Database has 208K+ records in `absensi_siswa`.

## Root Causes Identified
1. **MySQL CPU 100%**: `DATE(a.waktu_absen)` function in WHERE clauses prevents index usage → Full Table Scan on 208K records
2. **Redis "0 connections"**: `monitoringController.js` references `globalThis.redis` (undefined) instead of `globalThis.cacheSystem`
3. **Connection Pool "0 total"**: Uses internal `_allConnections`/`_freeConnections` that don't exist in `mysql2/promise`
4. **No MySQL tuning**: Default config, no `my.cnf`, no resource limits in Docker

## Scope
**IN**: Query optimization, index additions, monitoring fix, MySQL tuning, Docker resource limits
**OUT**: Frontend UI changes, new features, schema migrations, pagination changes (teacher view already has it)

## Architecture Decisions
- Follow existing pattern: `a.tanggal BETWEEN ? AND ?` (already used in `getPresensiSiswaSmkn13()`)
- Redis reference: use `globalThis.cacheSystem.redis` (ioredis instance) and `globalThis.cacheSystem.isConnected`
- MySQL pool stats: use `pool.pool._allConnections` (mysql2/promise wraps the underlying pool)
- Add Redis stats section to `buildDashboardResponse()` matching frontend expectations

## Test Strategy
- After each query fix: verify query still returns correct data format
- After monitoring fix: check `/api/admin/monitoring-dashboard` returns redis stats with `connected: true`
- After Docker changes: `docker-compose config` to validate YAML
- Manual verification: reload Presensi Siswa report page, confirm reduced query time in System Monitoring

---

## Tasks

### Task 1: Fix ExportService.js — Replace DATE(waktu_absen) with tanggal column
**File**: `server/services/ExportService.js`
**Priority**: CRITICAL — This is the #1 CPU killer

**Changes**:

**1a. `getStudentReportData()` (line 91)**
Replace:
```sql
WHERE DATE(a.waktu_absen) BETWEEN ? AND ?
```
With:
```sql
WHERE a.tanggal BETWEEN ? AND ?
```
Also update SELECT columns: replace `DATE_FORMAT(a.waktu_absen, '%Y-%m-%d') as tanggal` (line 74) with `a.tanggal` and `DATE_FORMAT(a.waktu_absen, '%d/%m/%Y') as tanggal_formatted` (line 75) with `DATE_FORMAT(a.tanggal, '%d/%m/%Y') as tanggal_formatted`. Replace `DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen` (line 81) with `TIME_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen` (TIME_FORMAT avoids wrapping the full datetime).

**1b. `getStudentSummaryCounts()` (lines 248-250)**
Replace the subquery:
```sql
LEFT JOIN (
    SELECT DISTINCT siswa_id, DATE(waktu_absen) as tgl, status
    FROM absensi_siswa
    WHERE DATE(waktu_absen) BETWEEN ? AND ?
) deduped ON s.id_siswa = deduped.siswa_id
```
With:
```sql
LEFT JOIN (
    SELECT DISTINCT siswa_id, tanggal as tgl, status
    FROM absensi_siswa
    WHERE tanggal BETWEEN ? AND ?
) deduped ON s.id_siswa = deduped.siswa_id
```

**1c. `getLaporanKehadiranSiswaData()` (lines 309-317)**
Replace both guru and admin queries:
- Line 309: `DATE(a.waktu_absen) as tanggal` → `a.tanggal`
- Line 311: `DATE(a.waktu_absen) BETWEEN ? AND ?` → `a.tanggal BETWEEN ? AND ?`
- Line 315: `DATE(a.waktu_absen) as tanggal` → `a.tanggal`
- Line 317: `DATE(a.waktu_absen) BETWEEN ? AND ?` → `a.tanggal BETWEEN ? AND ?`

**QA**: After changes, call the endpoint `/api/admin/student-attendance-report?startDate=2025-04-25&endDate=2026-02-25` and verify:
- Response format unchanged (same field names)
- `tanggal` field still returns date in YYYY-MM-DD format
- Row count matches pre-change count
- Response time should drop from ~2900ms to <500ms

---

### Task 2: Add Composite Indexes for Report Queries
**File**: `server/services/system/database-optimization.js`
**Priority**: HIGH

Add these indexes to the `indexes` array in `addDatabaseIndexes()` method (after line 173, before the closing `];` at line 175):

```javascript
// Composite index for SMKN13 report query (tanggal + jadwal_id + status)
{
    table: 'absensi_siswa',
    name: 'idx_tanggal_jadwal_status',
    columns: '(tanggal, jadwal_id, status)',
    description: 'Optimize SMKN13 report aggregation queries'
},
// Composite index for student summary (tanggal + siswa_id + status)
{
    table: 'absensi_siswa',
    name: 'idx_tanggal_siswa_status',
    columns: '(tanggal, siswa_id, status)',
    description: 'Optimize student summary count queries'
},
// Index for kelas_id on siswa table (used in total_siswa subquery)
{
    table: 'siswa',
    name: 'idx_siswa_kelas_status',
    columns: '(kelas_id, status)',
    description: 'Optimize student count per class queries'
},
```

**QA**: After server restart, check logs for "Added index" messages. Verify indexes exist by checking the `addDatabaseIndexes` log output shows the new indexes were created (or already exist if previously added).

---

### Task 3: Fix Redis Monitoring in monitoringController.js
**File**: `server/controllers/monitoringController.js`
**Priority**: HIGH — Fixes the "Redis 0 connections" display

**3a. Fix `getSystemPerformance()` Redis stats (lines 725-733)**
Replace:
```javascript
// Get Redis stats
let redisStats = { connected: false, error: 'Redis not available' };
if (globalThis.redis && globalThis.redis.isOpen) {
    try {
        const info = await globalThis.redis.info();
        redisStats = { connected: true, info };
    } catch (err) {
        redisStats = { connected: false, error: err.message };
    }
}
```
With:
```javascript
// Get Redis stats from CacheSystem (uses ioredis)
let redisStats = { connected: false, error: 'Redis not available' };
const cacheSystem = globalThis.cacheSystem;
if (cacheSystem && cacheSystem.isConnected && cacheSystem.redis) {
    try {
        const info = await cacheSystem.redis.info();
        const cacheStats = cacheSystem.getCacheStatistics ? cacheSystem.getCacheStatistics() : {};
        redisStats = { 
            connected: true, 
            info,
            cacheStats,
            status: cacheSystem.redis.status
        };
    } catch (err) {
        redisStats = { connected: false, error: err.message };
    }
}
```

**3b. Add Redis section to `buildDashboardResponse()` (after line 345, the `alerts` property)**
Add a new `redis` property to the return object:
```javascript
redis: (() => {
    const cs = globalThis.cacheSystem;
    if (!cs) return { connected: false, status: 'unavailable' };
    return {
        connected: cs.isConnected || false,
        status: cs.redis?.status || 'unknown',
        cacheStats: cs.getCacheStatistics ? cs.getCacheStatistics() : { hits: 0, misses: 0, sets: 0, deletes: 0 }
    };
})(),
```

**QA**: Hit `GET /api/admin/monitoring-dashboard` and verify:
- Response contains `redis` object with `connected: true`
- `redis.status` shows `'ready'`
- `redis.cacheStats` contains `hits`, `misses`, `sets`, `deletes` numbers

---

### Task 4: Fix DB Connection Pool Stats
**File**: `server/controllers/monitoringController.js`
**Priority**: MEDIUM

**Replace `getDbConnectionStats()` function (lines 777-791)**:
```javascript
function getDbConnectionStats() {
    const extractPoolStats = (poolWrapper) => {
        // mysql2/promise pool wraps the underlying pool
        const innerPool = poolWrapper?.pool || poolWrapper;
        return {
            active: innerPool?._allConnections?.length || 0,
            idle: innerPool?._freeConnections?.length || 0,
            total: (innerPool?._allConnections?.length || 0)
        };
    };

    if (globalThis.dbOptimization?.pool) {
        return extractPoolStats(globalThis.dbOptimization.pool);
    }
    if (db?.pool) {
        return extractPoolStats(db.pool);
    }
    return { active: 0, idle: 0, total: 0 };
}
```

Key change: access `poolWrapper.pool` first (the inner mysql2 pool), then fall back to direct access. The `mysql2/promise` `createPool()` returns a `PromisePool` that wraps the underlying callback pool in `.pool` property.

**QA**: Hit `GET /api/admin/monitoring-dashboard` and verify `metrics.database.connections` shows non-zero values when the app is handling requests.

---

### Task 5: Add MySQL Custom Configuration
**Create new file**: `docker/mysql/my.cnf`
**Priority**: HIGH

```ini
[mysqld]
# InnoDB Buffer Pool - cache frequently accessed data in memory
# Set to ~50-70% of container memory (512MB for 1GB limit)
innodb_buffer_pool_size = 512M

# InnoDB Log - larger log reduces disk I/O for writes
innodb_log_file_size = 128M
innodb_log_buffer_size = 16M

# Reduce disk I/O - flush once per second instead of every commit
innodb_flush_log_at_trx_commit = 2

# Thread handling
innodb_read_io_threads = 4
innodb_write_io_threads = 4

# Temp table sizes - prevent disk-based temp tables for GROUP BY
tmp_table_size = 64M
max_heap_table_size = 64M

# Sort buffer for ORDER BY operations
sort_buffer_size = 4M
join_buffer_size = 4M

# Slow query log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# Connection limits
max_connections = 100
wait_timeout = 300
interactive_timeout = 300

# Character set (already in docker-compose command, but good to have here)
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

**Also create directory**: `docker/mysql/` (if it doesn't exist).

**QA**: Run `docker-compose config` to validate the YAML after Task 6 is also complete.

---

### Task 6: Update docker-compose.yml — MySQL Config Mount & Resource Limits
**File**: `docker-compose.yml`
**Priority**: HIGH

**6a. Add volume mount for my.cnf to mysql service (after line 76)**:
```yaml
      - ./docker/mysql/my.cnf:/etc/mysql/conf.d/custom.cnf:ro
```

**6b. Add resource limits to mysql service (after line 84, before the empty line)**:
```yaml
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

**6c. Add resource limits to redis service (after line 102, before the empty line)**:
```yaml
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
```

**6d. Update mysql command to remove redundant flags now in my.cnf** (line 77):
Keep `--default-authentication-plugin=mysql_native_password` only since charset/collation are now in my.cnf:
```yaml
    command: --default-authentication-plugin=mysql_native_password
```

**QA**: Run `docker-compose config` to validate. Verify no YAML syntax errors.

---

### Task 7: Add Redis Caching for Heavy ExportService Queries  
**File**: `server/services/ExportService.js`
**Priority**: MEDIUM

Add Redis caching to the heaviest report methods that currently have NO caching.

**7a. `getStudentReportData()` (around line 71)**
Add caching wrapper:
```javascript
async getStudentReportData(startDate, endDate, kelasId) {
    // Check cache first
    const cacheKey = `export:student-report:${startDate}:${endDate}:${kelasId || 'all'}`;
    const cacheSystem = globalThis.cacheSystem;
    if (cacheSystem?.isConnected) {
        const cached = await cacheSystem.get(cacheKey, 'attendance');
        if (cached !== null) return cached;
    }
    
    // ... existing query logic ...
    
    // Cache result (5 min TTL)
    if (cacheSystem?.isConnected) {
        await cacheSystem.set(cacheKey, rows, 'attendance', 300);
    }
    
    return rows;
}
```

**7b. `getStudentSummaryCounts()` (around line 233)**
Same pattern with cache key `export:student-summary:${startDate}:${endDate}:${kelasId || 'all'}`.

**7c. `getLaporanKehadiranSiswaData()` (around line 302)**
Same pattern with cache key `export:laporan-kehadiran:${kelasId}:${startDate}:${endDate}:${guruId || 'all'}`.

**QA**: 
- First request: should be slow (cache miss), response logged
- Second identical request: should be fast (<50ms), cache hit
- After attendance is recorded: cache should be invalidated by existing `globalThis.cacheSystem.deletePattern('*', 'attendance')` calls in `absensiController.js`

---

## Final Verification Wave

After all tasks are complete:
1. Restart all Docker services: `docker-compose down && docker-compose up -d --build`
2. Wait for health checks to pass
3. Open "Presensi Siswa (Format SMKN 13)" report with date range 25/04/2025 - 25/02/2026
4. Verify: MySQL CPU should be well below 100%, query time <500ms
5. Open System Monitoring page
6. Verify: Redis shows `connected: true` with cache stats, Connection Pool shows non-zero values
7. Check Docker: `docker stats` should show MySQL CPU within limits

## Risk Mitigations
- **Data correctness**: The `tanggal` column already contains the date-only value, same as `DATE(waktu_absen)` — verified in existing `getPresensiSiswaSmkn13()` which already uses this pattern successfully
- **Index overhead**: 3 new indexes add ~10-20MB storage and slightly slow writes — negligible for this workload
- **Cache staleness**: Using existing 5-min TTL + existing cache invalidation on attendance write — acceptable for reports
- **Docker resource limits**: `1.5 CPU + 1GB RAM` for MySQL is generous for 150 concurrent users with 208K records
