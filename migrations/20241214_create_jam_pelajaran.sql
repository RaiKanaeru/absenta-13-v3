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
    SELECT 1 AS jam_ke, '06:30:00' AS jam_mulai, '07:15:00' AS jam_selesai, NULL AS keterangan
    UNION ALL SELECT 2, '07:15:00', '08:00:00', NULL
    UNION ALL SELECT 3, '08:00:00', '08:45:00', NULL
    UNION ALL SELECT 4, '08:45:00', '09:30:00', NULL
    UNION ALL SELECT 5, '09:45:00', '10:30:00', 'Setelah Istirahat 1'
    UNION ALL SELECT 6, '10:30:00', '11:15:00', NULL
    UNION ALL SELECT 7, '11:15:00', '12:00:00', NULL
    UNION ALL SELECT 8, '12:00:00', '12:45:00', NULL
    UNION ALL SELECT 9, '13:00:00', '13:45:00', 'Setelah Istirahat 2'
    UNION ALL SELECT 10, '13:45:00', '14:30:00', NULL
) j
WHERE k.status = 'aktif'
ON DUPLICATE KEY UPDATE 
    jam_mulai = VALUES(jam_mulai),
    jam_selesai = VALUES(jam_selesai);
