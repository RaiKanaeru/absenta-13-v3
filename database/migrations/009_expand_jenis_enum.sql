-- ============================================================
-- MIGRATION: Expand jenis ENUM for Schedule Slots
-- Version: 1.0
-- Date: 2026-02-28
-- Description: Expand jenis ENUM to include 'upacara' to align with seeder and jadwal table
-- ============================================================

-- Reason: The seeder (seedDefaultJamPelajaranData) creates slots with jenis='upacara'
-- but the ENUM definition rejects this value. The jadwal table's jenis_aktivitas 
-- already includes 'upacara', so this aligns jam_pelajaran tables with jadwal.

-- 1. Expand jam_pelajaran.jenis (global time slot template)
ALTER TABLE jam_pelajaran 
  MODIFY COLUMN jenis ENUM('pelajaran','istirahat','pembiasaan','upacara') NOT NULL DEFAULT 'pelajaran';

-- 2. Expand jam_pelajaran_kelas.jenis (per-class overrides)
ALTER TABLE jam_pelajaran_kelas 
  MODIFY COLUMN jenis ENUM('pelajaran','istirahat','pembiasaan','upacara') NOT NULL DEFAULT 'pelajaran';
