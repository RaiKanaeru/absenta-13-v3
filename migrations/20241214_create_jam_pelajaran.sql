-- Migration: Create jam_pelajaran table for dynamic time slots per class
-- Date: 2025-12-14
-- Description: Allows each class to have different time slots for jam pelajaran

-- Create table for jam pelajaran configuration per kelas
CREATE TABLE IF NOT EXISTS `jam_pelajaran` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kelas_id` int(11) NOT NULL COMMENT 'Relasi ke kelas.id_kelas',
  `jam_ke` int(11) NOT NULL COMMENT 'Nomor jam pelajaran (1-10)',
  `jam_mulai` time NOT NULL COMMENT 'Waktu mulai jam pelajaran',
  `jam_selesai` time NOT NULL COMMENT 'Waktu selesai jam pelajaran',
  `keterangan` varchar(100) DEFAULT NULL COMMENT 'Keterangan opsional (misal: Istirahat)',
  `status` enum('aktif','tidak_aktif') NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kelas_jam` (`kelas_id`, `jam_ke`),
  KEY `idx_kelas_id` (`kelas_id`),
  CONSTRAINT `fk_jam_pelajaran_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Konfigurasi jam pelajaran per kelas';

-- Define time constants to avoid duplicate literals
SET @t_0630 = '06:30:00';
SET @t_0715 = '07:15:00';
SET @t_0800 = '08:00:00';
SET @t_0845 = '08:45:00';
SET @t_0930 = '09:30:00';
SET @t_0945 = '09:45:00';
SET @t_1030 = '10:30:00';
SET @t_1115 = '11:15:00';
SET @t_1200 = '12:00:00';
SET @t_1245 = '12:45:00';
SET @t_1300 = '13:00:00';
SET @t_1345 = '13:45:00';
SET @t_1430 = '14:30:00';
SET @ket_ist1 = 'Setelah Istirahat 1';
SET @ket_ist2 = 'Setelah Istirahat 2';

-- Insert default jam pelajaran for all existing classes
-- Using standard 10 jam pelajaran template
INSERT INTO `jam_pelajaran` (`kelas_id`, `jam_ke`, `jam_mulai`, `jam_selesai`, `keterangan`)
SELECT 
    k.id_kelas,
    j.jam_ke,
    j.jam_mulai,
    j.jam_selesai,
    j.keterangan
FROM `kelas` k
CROSS JOIN (
    SELECT 1 AS jam_ke, @t_0630 AS jam_mulai, @t_0715 AS jam_selesai, NULL AS keterangan
    UNION ALL SELECT 2, @t_0715, @t_0800, NULL
    UNION ALL SELECT 3, @t_0800, @t_0845, NULL
    UNION ALL SELECT 4, @t_0845, @t_0930, NULL
    UNION ALL SELECT 5, @t_0945, @t_1030, @ket_ist1
    UNION ALL SELECT 6, @t_1030, @t_1115, NULL
    UNION ALL SELECT 7, @t_1115, @t_1200, NULL
    UNION ALL SELECT 8, @t_1200, @t_1245, NULL
    UNION ALL SELECT 9, @t_1300, @t_1345, @ket_ist2
    UNION ALL SELECT 10, @t_1345, @t_1430, NULL
) j
WHERE k.status = 'aktif'
ON DUPLICATE KEY UPDATE 
    jam_mulai = VALUES(jam_mulai),
    jam_selesai = VALUES(jam_selesai);

