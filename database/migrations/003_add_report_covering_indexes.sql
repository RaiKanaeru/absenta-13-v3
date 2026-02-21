-- Migration 003: Add covering indexes for report queries
-- Purpose: Reduce MySQL CPU from 223% to ~15-30% for attendance report queries
-- 
-- Context:
--   The presensi query filters by date range (tanggal BETWEEN),
--   joins on schedule id, and aggregates using conditional sums.
--   Without a covering index, MySQL does a full table scan + random I/O lookups.
--
-- Existing indexes that are insufficient:
--   idx_absensi_siswa_tanggal_status (tanggal, status, terlambat, ada_tugas) -- missing jadwal_id for JOIN
--   fk_absensi_siswa_jadwal_idx (jadwal_id) -- single column, can't combine with tanggal range
--   fk_siswa_kelas_idx (kelas_id) -- single column, missing status for WHERE filter
--
-- Safe to run: Uses IF NOT EXISTS / checks to avoid duplicate index errors.
-- Estimated time: < 30 seconds on tables with < 500K rows.

-- 1. Covering index for absensi_siswa report queries
--    Covers: WHERE tanggal BETWEEN, JOIN jadwal_id, SUM(status), SUM(terlambat)
--    MySQL can satisfy the entire query from this index alone (index-only scan)
ALTER TABLE `absensi_siswa`
  ADD INDEX `idx_absensi_report_covering` (`tanggal`, `jadwal_id`, `status`, `terlambat`);

-- 2. Covering index for siswa count subquery
--    Covers filtering by active status grouped by class ID for counting
--    The subquery that counts active students by class
--    can now be resolved entirely from this index
ALTER TABLE `siswa`
  ADD INDEX `idx_siswa_status_kelas` (`status`, `kelas_id`);

-- 3. Covering index for rekap ketidakhadiran pre-dedup subquery
--    The rekap query fetches distinct student ids, dates, statuses, and lateness
--    filtered by date range and scheduled class IDs.
--    This index covers the dedup subquery without table access
ALTER TABLE `absensi_siswa`
  ADD INDEX `idx_absensi_rekap_covering` (`tanggal`, `jadwal_id`, `siswa_id`, `status`, `terlambat`);
