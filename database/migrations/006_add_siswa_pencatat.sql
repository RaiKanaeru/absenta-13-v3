-- Migration: Add siswa_pencatat_id to absensi_siswa
-- Purpose: Allow tracking when a student (piket) takes attendance on behalf of absent teacher
-- Date: 2024-12-19

-- Add siswa_pencatat_id column
ALTER TABLE `absensi_siswa`
ADD COLUMN `siswa_pencatat_id` INT(11) NULL 
    COMMENT 'ID siswa piket yang mencatat absensi (jika guru tidak hadir)'
    AFTER `guru_pengabsen_id`;

-- Add pencatat_type to clearly identify who took attendance
ALTER TABLE `absensi_siswa`
ADD COLUMN `pencatat_type` ENUM('guru', 'siswa') NOT NULL DEFAULT 'guru'
    COMMENT 'Siapa yang mencatat: guru atau siswa (piket)'
    AFTER `siswa_pencatat_id`;

-- Add index for better query performance
CREATE INDEX `idx_absensi_siswa_pencatat` ON `absensi_siswa` (`siswa_pencatat_id`);
CREATE INDEX `idx_absensi_siswa_pencatat_type` ON `absensi_siswa` (`pencatat_type`);

-- Update existing records to have pencatat_type = 'guru' (already done by DEFAULT)
