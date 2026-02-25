# Phase D: Report System Performance & Caching

## Context
Absenta-13 school attendance system. Phases A (Redis expansion), B (JWT auth upgrade), C (performance fix) are complete. The report system is the largest uncached subsystem — 14 active endpoints in `reportsController.js` have ZERO Redis caching, and the admin dashboard (first page every admin sees) fires 7 parallel DB queries on every load without caching.

## Goal
Add Redis caching to all report endpoints, fix remaining CPU-killer SQL patterns, and standardize caching patterns across the codebase for consistent observability.

## Success Criteria
1. All 14 non-deprecated report endpoints in `reportsController.js` use Redis caching with explicit `get`/`set` + `wasCached` tracking
2. CPU-killer `COUNT(DISTINCT CONCAT(...))` patterns eliminated from `ExportService.js`
3. All `getOrSet` legacy calls migrated to explicit `get`/`set` pattern
4. Cache invalidation in `absensiController.js` prevents stale data
5. `npm run build` passes, LSP diagnostics show 0 errors

## Constraints
- ESM only (`import`/`export`), no `require()`
- Use `globalThis.cacheSystem` for Redis access
- Cache must be graceful — if Redis unavailable, fall back to direct DB queries (no crash)
- Don't change function signatures or exports
- Follow Routes → Controllers → Services pattern
- Database access via `import db from '../config/db.js'`
- Cache categories: `analytics` (1h), `schedules` (2h), `students` (4h), `classes` (4h), `teachers` (4h), `attendance` (30min)

## Reference Patterns

### Gold Standard: Explicit get/set with wasCached (from `guruReportsController.js:42-63`)
```javascript
const cacheSystem = globalThis.cacheSystem;
let result;
let wasCached = false;

if (cacheSystem) {
    const cached = await cacheSystem.get(cacheKey, 'attendance');
    if (cached !== null) {
        result = cached;
        wasCached = true;
    } else {
        result = await someService.getData(...);
        await cacheSystem.set(cacheKey, result, 'attendance', 300);
    }
} else {
    result = await someService.getData(...);
}

log.success('HandlerName', { count: result.length, cached: wasCached });
```

### Cache Invalidation Pattern (from `siswaController.js:377-380`)
```javascript
if (globalThis.cacheSystem) {
    await globalThis.cacheSystem.deletePattern('*', 'attendance');
    await globalThis.cacheSystem.deletePattern('*', 'analytics');
}
```

### Pre-dedup Subquery Pattern for SQL (from `ExportService.js:693-748`)
Replace `COUNT(DISTINCT CONCAT(date, '#', id))` with:
```sql
-- Step 1: Deduplicate in subquery
FROM (
    SELECT DISTINCT siswa_id, tanggal, status
    FROM absensi_siswa
    WHERE tanggal BETWEEN ? AND ?
) deduped
-- Step 2: Aggregate on clean data
GROUP BY ...
```

## Tasks

### Tahap 0: Cache Invalidation Prerequisite

<!-- TASKS_START -->

#### Task 0.1: Add attendance cache invalidation to `absensiController.js` mutation handlers

**File**: `server/controllers/absensiController.js`
**Why**: This is the PRIMARY mutation point for attendance data. Currently has ZERO cache invalidation. Without this, all report caching (Tahap 1) would serve stale data — teachers submit attendance, but cached reports don't update for up to 30 minutes.

**What to do**:
Add cache invalidation after successful mutations in these 5 handlers:

1. **`submitStudentAttendance`** (line 673) — After the `executeAttendanceBatchOperations` call succeeds (around line 713-714), before `res.json(...)`, add:
```javascript
// Invalidate attendance & analytics caches after successful submission
if (globalThis.cacheSystem) {
    await globalThis.cacheSystem.deletePattern('*', 'attendance');
    await globalThis.cacheSystem.deletePattern('*', 'analytics');
}
```

2. **`recordTeacherAttendanceSimple`** (line 864) — After the successful INSERT/UPDATE, before the success response. Same 2-line invalidation.

3. **`submitTeacherAttendance`** (line 946) — After the successful batch operation, before the success response. Same 2-line invalidation.

4. **`submitStudentAttendanceByPiket`** (line 1204) — After the successful piket submission flow, before the success response. Same 2-line invalidation.

5. **`updateTeacherStatus`** (line 1292) — After the successful status UPDATE, before the success response. Same 2-line invalidation.

**Pattern**: Follow exactly `siswaController.js:377-380`. Use `if (globalThis.cacheSystem)` guard (NOT optional chaining `?.deletePattern` — match the existing pattern).

**Cache categories to invalidate**: `attendance` AND `analytics` (both are affected when attendance data changes).

**QA**:
- Verify `grep -c "deletePattern.*attendance" server/controllers/absensiController.js` returns >= 5
- Verify `grep -c "deletePattern.*analytics" server/controllers/absensiController.js` returns >= 5
- Run `npx vitest run` — no test failures
- LSP diagnostics: 0 errors on `absensiController.js`

---

### Tahap 1: Redis Caching for `reportsController.js`

#### Task 1.1: Cache `getAnalyticsDashboard` (HIGHEST PRIORITY)

**File**: `server/controllers/reportsController.js`, line 418-453
**Why**: Admin landing page. Fires 7 parallel DB queries on every page load. Most-hit endpoint for admin users.

**What to do**:
1. At the top of the handler (after `log.requestStart`), construct cache key:
```javascript
const cacheKey = `report:analytics:dashboard:${todayWIB}`;
```
2. Wrap the `Promise.all([...])` block (lines 432-440) with the explicit get/set pattern.
3. Use category `'analytics'` with TTL `300` (5 minutes — shorter than default 1h since this is a dashboard).
4. Add `wasCached` to success log: `log.success('GetAnalyticsDashboard', { ..., cached: wasCached });`

**Note**: The `todayWIB`, `currentYear`, `currentMonth` vars (lines 424-427) are needed for both the cache key AND the query params. They must be computed BEFORE the cache check.

**QA**: Verify handler contains `wasCached`, `cacheSystem.get(`, `cacheSystem.set(`, NO `getOrSet`.

---

#### Task 1.2: Cache `getLiveTeacherAttendance` and `getLiveStudentAttendance` with SHORT TTL

**File**: `server/controllers/reportsController.js`
- `getLiveTeacherAttendance`: line 456-519
- `getLiveStudentAttendance`: line 522-578

**Why**: These are "live" real-time monitoring endpoints. Standard 30min TTL would show stale attendance data. Use 30-second TTL as a compromise — still reduces DB load from rapid refreshes but doesn't show significantly stale live data.

**What to do** for EACH handler:
1. Cache key:
   - Teacher: `report:live-teacher:${todayWIB}:${currentDayWIB}`
   - Student: `report:live-student:${todayWIB}`
2. Use explicit get/set pattern with category `'attendance'` and TTL `30` (30 seconds).
3. Add `wasCached` tracking.

**Note for `getLiveTeacherAttendance`**: The `todayWIB` and `currentDayWIB` vars (lines 461-463) must be computed before the cache check since they're used in both the cache key and query params.

**QA**: Verify both handlers have `wasCached`, TTL is `30` not `300`, category is `'attendance'`.

---

#### Task 1.3: Cache `getTeacherAttendanceReport` and `getStudentAttendanceReport`

**File**: `server/controllers/reportsController.js`
- `getTeacherAttendanceReport`: line 581-601
- `getStudentAttendanceReport`: line 631-651

**Why**: Report query endpoints called when viewing reports. These delegate to `ExportService` methods.

**What to do** for EACH handler:
1. Cache keys:
   - Teacher: `report:teacher:${startDate}:${endDate}:${kelas_id || 'all'}`
   - Student: `report:student:${startDate}:${endDate}:${kelas_id || 'all'}`
2. Wrap the `ExportService.getTeacherReportData(...)` / `ExportService.getStudentReportData(...)` call with explicit get/set.
3. Category: `'attendance'`, TTL: `300` (5 minutes).
4. Add `wasCached` tracking.

**QA**: Verify both handlers have caching with correct keys and `wasCached`.

---

#### Task 1.4: Cache `downloadTeacherAttendanceReport` and `downloadStudentAttendanceReport` (data-level)

**File**: `server/controllers/reportsController.js`
- `downloadTeacherAttendanceReport`: line 604-628
- `downloadStudentAttendanceReport`: line 654-678

**Why**: CSV download endpoints. We cache the DATA query result (the `rows` from ExportService), not the streamed CSV response.

**What to do** for EACH handler:
1. Cache keys (same as Task 1.3 — download uses same underlying data):
   - Teacher: `report:teacher:${startDate}:${endDate}:${kelas_id || 'all'}`
   - Student: `report:student:${startDate}:${endDate}:${kelas_id || 'all'}`
2. Wrap ONLY the `ExportService.getTeacherReportData(...)` / `ExportService.getStudentReportData(...)` call with explicit get/set. The `generateCSV(...)` call must remain OUTSIDE the cache block (it streams the response).
3. Category: `'attendance'`, TTL: `300`.
4. Add `wasCached` tracking.

**QA**: Verify CSV generation is NOT cached, only the data fetch. Verify `generateCSV` is called AFTER the cache block.

---

#### Task 1.5: Cache `getStudentAttendanceSummary` and `downloadStudentAttendanceExcel` (data-level)

**File**: `server/controllers/reportsController.js`
- `getStudentAttendanceSummary`: line 682-730
- `downloadStudentAttendanceExcel`: line 758-834

**Why**: Both call `ExportService.getStudentSummaryCounts(...)` which is the CPU-killer method (fixed in Tahap 2). Caching shields the DB even before the SQL fix.

**What to do**:
1. For `getStudentAttendanceSummary`:
   - Cache key: `report:student-summary:${startDate}:${endDate}:${kelas_id || 'all'}`
   - Cache the ENTIRE processed result (after `calculateEffectiveDays` and `processedRows` mapping) since the processing is deterministic.
   - Category: `'attendance'`, TTL: `300`.
   
2. For `downloadStudentAttendanceExcel`:
   - Cache key: same as above (same underlying data).
   - Cache ONLY the `ExportService.getStudentSummaryCounts(...)` call result (line 772). The `effectiveDays` calculation (line 777) and `streamExcel` call must remain OUTSIDE the cache block.
   - Category: `'attendance'`, TTL: `300`.

**QA**: Verify `getStudentAttendanceSummary` caches the full processed result. Verify `downloadStudentAttendanceExcel` only caches the raw data, not the Excel stream.

---

#### Task 1.6: Cache `getTeacherAttendanceSummary`

**File**: `server/controllers/reportsController.js`, line 837-889

**Why**: Teacher summary with legacy parameter backward compatibility. Has inline SQL with SUM(CASE WHEN...) aggregation.

**What to do**:
1. Cache key: `report:teacher-summary:${startDate}:${endDate}`
   - Note: `startDate` and `endDate` may be computed from legacy params (lines 844-852). The cache key must use the FINAL computed values, not the raw query params.
2. Place the cache check AFTER the legacy parameter resolution (after line 852) but BEFORE the query execution (line 882).
3. Cache the `[rows]` result.
4. Category: `'attendance'`, TTL: `300`.
5. Add `wasCached` tracking.

**QA**: Verify cache key uses computed `startDate`/`endDate` (not raw `req.query` values).

---

#### Task 1.7: Cache `getRekapKetidakhadiranGuru`

**File**: `server/controllers/reportsController.js`, line 948-1021

**Why**: Complex pivot query (12 monthly SUM columns) + dynamic import of `kalenderAkademikController.js` for effective days.

**What to do**:
1. Cache key: `report:rekap-guru:${selectedYear}:${bulan || 'all'}:${tanggal_awal || 'none'}:${tanggal_akhir || 'none'}`
2. Cache the ENTIRE `processedRows` result (after the `hariEfektifMap` enrichment, line 986-1012), since all processing is deterministic for a given set of params.
3. Place the cache check AFTER param resolution (after line 958) but wrap the entire DB query + processing block.
4. Category: `'attendance'`, TTL: `300`.
5. Add `wasCached` tracking.

**QA**: Verify the dynamic `import('./kalenderAkademikController.js')` is INSIDE the cache-miss branch (not executed on cache hit).

---

#### Task 1.8: Cache `getRekapKetidakhadiranSiswa`

**File**: `server/controllers/reportsController.js`, line 1024-1092

**Why**: Per-student per-month aggregation with GROUP_CONCAT. Can return large result sets.

**What to do**:
1. Cache key: `report:rekap-siswa:${kelas_id}:${tahun || 'none'}:${bulan || 'all'}:${tanggal_awal || 'none'}:${tanggal_akhir || 'none'}`
   - Note: `kelas_id` is processed by `extractKelasId()` at line 1030. Use the EXTRACTED value.
2. Cache the final result (either `finalResult` from aggregation branch or `result` from direct branch).
3. Place cache check after validation (line 1042) and `calculateDateRange` (line 1045).
4. Category: `'attendance'`, TTL: `300`.
5. Add `wasCached` tracking.

**QA**: Verify cache key uses the extracted `kelas_id` (post-`extractKelasId`).

---

#### Task 1.9: Cache `getStudentsByClass` and `getPresensiSiswa`

**File**: `server/controllers/reportsController.js`
- `getStudentsByClass`: line 1095-1128
- `getPresensiSiswa`: line 1131-1184

**Why**: Helper/filter endpoints. `getStudentsByClass` is a simple lookup; `getPresensiSiswa` is a daily attendance log.

**What to do**:
1. `getStudentsByClass`:
   - Cache key: `report:students-by-class:${kelasId}`
   - Note: `kelasId` is processed (compound ID extraction at line 1100-1101). Use EXTRACTED value.
   - Category: `'students'` (4h TTL — student roster rarely changes).
   - TTL: use category default (don't pass explicit TTL).
   
2. `getPresensiSiswa`:
   - Cache key: `report:presensi:${kelas_id}:${bulan}:${tahun}`
   - Note: `kelas_id` is processed (compound ID extraction at line 1136-1137). Use EXTRACTED value.
   - Category: `'attendance'`, TTL: `300`.

**QA**: Verify `getStudentsByClass` uses `students` category, `getPresensiSiswa` uses `attendance`.

---

### Tahap 2: SQL Optimization in `ExportService.js`

#### Task 2.1: Fix `getStudentSummary` CPU-killer pattern

**File**: `server/services/ExportService.js`, line 192-222
**Why**: Uses 6× `COUNT(DISTINCT CONCAT(a.tanggal, '#', a.siswa_id))` — the exact CPU-killer pattern identified in Phase C. Called from `exportController.js` (Excel export) and `pdfExportController.js`.

**What to do**:
Replace the current query with a pre-dedup subquery pattern. The new query structure:

```sql
SELECT 
    s.nama, s.nis, k.nama_kelas,
    COALESCE(SUM(CASE WHEN deduped.status = 'Hadir' THEN 1 ELSE 0 END), 0) as H,
    COALESCE(SUM(CASE WHEN deduped.status = 'Izin' THEN 1 ELSE 0 END), 0) as I,
    COALESCE(SUM(CASE WHEN deduped.status = 'Sakit' THEN 1 ELSE 0 END), 0) as S,
    COALESCE(SUM(CASE WHEN deduped.status = 'Alpa' THEN 1 ELSE 0 END), 0) as A,
    COALESCE(SUM(CASE WHEN deduped.status = 'Dispen' THEN 1 ELSE 0 END), 0) as D,
    COALESCE(
        SUM(CASE WHEN deduped.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END) * 100.0 
        / NULLIF(COUNT(deduped.status), 0), 
    0) as presentase
FROM siswa s
LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
LEFT JOIN (
    SELECT DISTINCT siswa_id, tanggal, status
    FROM absensi_siswa
    WHERE tanggal BETWEEN ? AND ?
) deduped ON s.id_siswa = deduped.siswa_id
WHERE s.status = 'aktif'
```

Plus the optional `AND k.id_kelas = ?` filter and the GROUP BY clause (keep as-is).

**CRITICAL**: Return type must remain identical — an array of objects with fields: `nama`, `nis`, `nama_kelas`, `H`, `I`, `S`, `A`, `D`, `presentase`.

**QA**: 
- Verify `grep -c "COUNT(DISTINCT CONCAT" server/services/ExportService.js` returns 0 for this method
- Verify `SELECT DISTINCT` subquery is present
- LSP diagnostics: 0 errors

---

#### Task 2.2: Fix `getStudentSummaryCounts` CPU-killer pattern

**File**: `server/services/ExportService.js`, line 227-255
**Why**: Even worse than `getStudentSummary` — uses `DATE(a.waktu_absen)` function call inside JOIN condition AND inside CONCAT, preventing ANY index usage. Called from `reportsController.js` for the student summary page and Excel download.

**What to do**:
Same pre-dedup subquery approach, but note this method uses `waktu_absen` (datetime) instead of `tanggal` (date). The dedup subquery must cast:

```sql
SELECT 
    s.nama, s.nis, k.nama_kelas,
    COALESCE(SUM(CASE WHEN deduped.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
    COALESCE(SUM(CASE WHEN deduped.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
    COALESCE(SUM(CASE WHEN deduped.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
    COALESCE(SUM(CASE WHEN deduped.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
    COALESCE(SUM(CASE WHEN deduped.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
    COALESCE(COUNT(deduped.tgl), 0) AS total
FROM siswa s
JOIN kelas k ON s.kelas_id = k.id_kelas
LEFT JOIN (
    SELECT DISTINCT siswa_id, DATE(waktu_absen) as tgl, status
    FROM absensi_siswa
    WHERE DATE(waktu_absen) BETWEEN ? AND ?
) deduped ON s.id_siswa = deduped.siswa_id
WHERE s.status = 'aktif'
```

Plus the optional `AND k.id_kelas = ?` filter and GROUP BY.

**CRITICAL**: Return type must remain identical — array of objects with fields: `nama`, `nis`, `nama_kelas`, `H`, `I`, `S`, `A`, `D`, `total`. Note `H` here includes both Hadir AND Dispen (matching current behavior from line 233).

**QA**:
- Verify no `COUNT(DISTINCT CONCAT` patterns remain in this method
- Verify `SELECT DISTINCT siswa_id, DATE(waktu_absen)` subquery is present
- Run `npm test` — all tests pass

---

#### Task 2.3: Parallelize `getScheduleMatrixData`

**File**: `server/services/ExportService.js`, line 260-290
**Why**: Two independent sequential queries (classes list + schedules list) that can run in parallel.

**What to do**:
Replace lines 262-279 with:
```javascript
const [classesResult, schedulesResult] = await Promise.all([
    this.pool.execute(
        `SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE status = 'aktif' ORDER BY tingkat, nama_kelas`
    ),
    this.pool.execute(
        `SELECT j.*, g.nama as nama_guru, m.nama_mapel, r.nama_ruang, r.kode_ruang
         FROM jadwal j
         LEFT JOIN guru g ON j.guru_id = g.id_guru
         LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
         LEFT JOIN ruang_kelas r ON j.ruang_id = r.id_ruang
         WHERE j.status = 'aktif'`
    )
]);
const [classes] = classesResult;
const [schedules] = schedulesResult;
```

Rest of the method (lines 281-290, the transform logic) stays unchanged.

**QA**: Verify `Promise.all` is used. Verify return type `{ classes, scheduleMap }` is unchanged.

---

#### Task 2.4: Parallelize `getLaporanKehadiranSiswaData`

**File**: `server/services/ExportService.js`, line 295-330
**Why**: Two independent sequential queries (siswa list + absensi records). The absensi query does NOT depend on siswa results.

**What to do**:
Replace the sequential pattern (lines 297-302 for siswa, lines 304-327 for absensi) with:

```javascript
// Build absensi query based on guruId
let absensiQuery;
let absensiParams = [kelasId, startDate, endDate];

if (guruId) {
    absensiQuery = `SELECT a.siswa_id, a.status, a.terlambat, DATE(a.waktu_absen) as tanggal, j.jam_ke
        FROM absensi_siswa a JOIN jadwal j ON a.jadwal_id = j.id_jadwal
        WHERE j.guru_id = ? AND j.kelas_id = ? AND DATE(a.waktu_absen) BETWEEN ? AND ?`;
    absensiParams = [guruId, kelasId, startDate, endDate];
} else {
    absensiQuery = `SELECT a.siswa_id, a.status, a.terlambat, DATE(a.waktu_absen) as tanggal, j.jam_ke
        FROM absensi_siswa a JOIN jadwal j ON a.jadwal_id = j.id_jadwal
        WHERE j.kelas_id = ? AND DATE(a.waktu_absen) BETWEEN ? AND ?`;
}

// Run both queries in parallel
const [siswaResult, absensiResult] = await Promise.all([
    this.pool.execute(
        `SELECT s.id_siswa, s.nis, s.nama, k.nama_kelas
         FROM siswa s JOIN kelas k ON s.kelas_id = k.id_kelas
         WHERE s.kelas_id = ? AND s.status = 'aktif' ORDER BY s.nama`,
        [kelasId]
    ),
    this.pool.execute(absensiQuery, absensiParams)
]);

const [siswa] = siswaResult;
const [absensi] = absensiResult;

return { siswa, absensi };
```

**QA**: Verify `Promise.all` is used. Verify return type `{ siswa, absensi }` is unchanged.

---

### Tahap 3: `getOrSet` Migration & Remaining Caching

#### Task 3.1: Migrate `getRekapKetidakhadiran` in `guruReportsController.js` from `getOrSet` to explicit pattern

**File**: `server/controllers/guruReportsController.js`, line 98-113
**Why**: Uses legacy `getOrSet` pattern with misleading `cached: !!cacheSystem` log (always true when Redis is connected, regardless of hit/miss).

**What to do**:
Replace lines 98-113 with the explicit get/set pattern:
```javascript
const cacheSystem = globalThis.cacheSystem;
let rows;
let wasCached = false;

if (cacheSystem) {
    const cached = await cacheSystem.get(cacheKey, 'attendance');
    if (cached !== null) {
        rows = cached;
        wasCached = true;
    } else {
        rows = await ExportService.getRekapKetidakhadiran(startDate, endDate, effectiveGuruId, kelas_id, effectiveReportType);
        await cacheSystem.set(cacheKey, rows, 'attendance', 300);
    }
} else {
    rows = await ExportService.getRekapKetidakhadiran(startDate, endDate, effectiveGuruId, kelas_id, effectiveReportType);
}

log.success('GetRekapKetidakhadiran', { count: rows.length, reportType: effectiveReportType, isAdmin, cached: wasCached });
```

**QA**: Verify `getOrSet` is gone, `wasCached` is present, log shows `cached: wasCached`.

---

#### Task 3.2: Add caching to 4 uncached handlers in `guruReportsController.js`

**File**: `server/controllers/guruReportsController.js`

**What to do** — add explicit get/set caching to:

1. **`getGuruClasses`** (line 125-148):
   - Cache key: `report:guru-classes:${guruId || 'all'}`
   - Category: `'schedules'` (teacher schedules, 2h TTL)
   - TTL: use category default

2. **`getAttendanceSummary`** (line 154-188):
   - Cache key: `report:attendance-summary:${startDate}:${endDate}:${effectiveGuruId || 'all'}:${kelas_id || 'all'}`
   - Category: `'attendance'`, TTL: `300`
   - Note: compute `effectiveGuruId = isAdmin ? null : guruId` before cache key (already exists at line 174+ pattern, but may need to move before cache check)

3. **`getJadwalPertemuan`** (line 194-282):
   - Cache key: `report:jadwal-pertemuan:${kelas_id}:${startDate}:${endDate}:${effectiveGuruId || 'all'}`
   - Category: `'schedules'`, TTL: use category default
   - Note: Wrap the entire `ExportService.getJadwalPertemuanData(...)` call AND the date iteration loop (lines 227-262), since the full response including `pertemuanDates` is deterministic for given params.

4. **`getLaporanKehadiranSiswa`** (line 288-352):
   - Cache key: `report:laporan-kehadiran:${kelas_id}:${startDate}:${endDate}:${effectiveGuruId || 'all'}`
   - Category: `'attendance'`, TTL: `300`
   - Cache the ENTIRE processed `result` array (after the Map/reduce processing at lines 320-344), since processing is deterministic.

**QA**: 
- Verify all 4 handlers have `wasCached` tracking
- Verify `grep -c "getOrSet" server/controllers/guruReportsController.js` returns 0
- Verify `grep -c "wasCached" server/controllers/guruReportsController.js` returns >= 6 (all 6 handlers)

---

#### Task 3.3: Migrate 9 `getOrSet` calls in `exportController.js`

**File**: `server/controllers/exportController.js`

**What to do**: For EACH of the 9 `getOrSet` calls (lines 762, 863, 1091, 1183, 1298, 1486, 1686, 2010, 2074):

1. Replace `getOrSet(cacheKey, fetchFn, category, ttl)` with the explicit pattern:
```javascript
let data;
let wasCached = false;

if (cacheSystem) {
    const cached = await cacheSystem.get(cacheKey, category);
    if (cached !== null) {
        data = cached;
        wasCached = true;
    } else {
        data = await fetchFn();
        await cacheSystem.set(cacheKey, data, category, ttl);
    }
} else {
    data = await fetchFn();
}
```

2. Preserve the EXACT same cache key, category, and TTL that the `getOrSet` call was using.
3. Add `cached: wasCached` to the nearest success log for each handler.

**IMPORTANT**: Line 1183 uses `cacheSystemSmkn13` (a different variable) — verify this is the same `globalThis.cacheSystem` object or a different instance. If it's the same, use `cacheSystem` consistently.

**QA**:
- Verify `grep -c "getOrSet" server/controllers/exportController.js` returns 0
- Verify `grep -c "wasCached" server/controllers/exportController.js` returns >= 9
- Run `npm run build` — passes
- LSP diagnostics: 0 errors

---

#### Task 3.4: Migrate 1 `getOrSet` call in `siswaController.js`

**File**: `server/controllers/siswaController.js`, line 254

**What to do**:
Replace the `getOrSet` call with explicit get/set pattern:
1. Preserve the existing cache key and category (`students`).
2. Add `wasCached` boolean.
3. Update the success log to include `cached: wasCached`.

**QA**:
- Verify `grep -c "getOrSet" server/controllers/siswaController.js` returns 0
- Verify `wasCached` is present

---

## Final Verification Wave

After ALL tasks are complete, run:

1. **LSP Diagnostics**: Check all modified files for 0 errors:
   - `server/controllers/absensiController.js`
   - `server/controllers/reportsController.js`
   - `server/controllers/guruReportsController.js`
   - `server/controllers/exportController.js`
   - `server/controllers/siswaController.js`
   - `server/services/ExportService.js`

2. **Build**: `npm run build` — must pass

3. **Pattern Verification**:
   - `grep -c "getOrSet" server/controllers/` should return 0 across ALL controller files
   - `grep -c "COUNT(DISTINCT CONCAT" server/services/ExportService.js` should return 0
   - `grep -c "wasCached" server/controllers/reportsController.js` should return >= 14

4. **Test Suite**: `npm test` — all tests pass

## Execution Order

**Tahap 0** → **Tahap 1** → **Tahap 2** → **Tahap 3**

Tahap 0 MUST complete first — adding caching without invalidation is worse than no caching. Tahap 1 and 2 can technically run in parallel on different files, but sequential is safer. Tahap 3 is independent cleanup.

<!-- TASKS_END -->
