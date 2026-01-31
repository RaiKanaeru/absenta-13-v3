-- =====================================================
-- SEED: jam_pelajaran
-- Table: Master jam pelajaran per hari
-- Run: docker exec -i absenta13-mysql mysql -u root -p absenta13 < seed_jam_pelajaran.sql
-- =====================================================

-- Clear existing data (optional, uncomment if needed)
-- TRUNCATE TABLE jam_pelajaran;

-- Insert jam_pelajaran data for 2025/2026
INSERT INTO `jam_pelajaran` (`id`, `hari`, `jam_ke`, `jam_mulai`, `jam_selesai`, `durasi_menit`, `jenis`, `label`, `tahun_ajaran`, `created_at`, `updated_at`) VALUES
-- SENIN (12 slots: 1 pembiasaan + 9 pelajaran + 2 istirahat)
(1, 'Senin', 0, '06:30:00', '07:15:00', 45, 'pembiasaan', 'Upacara/Apel', '2025/2026', NOW(), NOW()),
(2, 'Senin', 1, '07:15:00', '08:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(3, 'Senin', 2, '08:00:00', '08:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(4, 'Senin', 3, '08:45:00', '09:30:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(5, 'Senin', 4, '09:30:00', '10:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(6, 'Senin', 5, '10:15:00', '10:30:00', 15, 'istirahat', 'Istirahat 1', '2025/2026', NOW(), NOW()),
(7, 'Senin', 6, '10:30:00', '11:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(8, 'Senin', 7, '11:15:00', '12:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(9, 'Senin', 8, '12:00:00', '12:45:00', 45, 'istirahat', 'Istirahat 2', '2025/2026', NOW(), NOW()),
(10, 'Senin', 9, '12:45:00', '13:30:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(11, 'Senin', 10, '13:30:00', '14:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(12, 'Senin', 11, '14:15:00', '15:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),

-- SELASA (12 slots: 1 pembiasaan + 9 pelajaran + 2 istirahat)
(13, 'Selasa', 0, '06:30:00', '07:00:00', 30, 'pembiasaan', 'Tadarus', '2025/2026', NOW(), NOW()),
(14, 'Selasa', 1, '07:00:00', '07:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(15, 'Selasa', 2, '07:45:00', '08:30:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(16, 'Selasa', 3, '08:30:00', '09:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(17, 'Selasa', 4, '09:15:00', '10:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(18, 'Selasa', 5, '10:00:00', '10:15:00', 15, 'istirahat', 'Istirahat 1', '2025/2026', NOW(), NOW()),
(19, 'Selasa', 6, '10:15:00', '11:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(20, 'Selasa', 7, '11:00:00', '11:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(21, 'Selasa', 8, '11:45:00', '12:30:00', 45, 'istirahat', 'Istirahat 2', '2025/2026', NOW(), NOW()),
(22, 'Selasa', 9, '12:30:00', '13:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(23, 'Selasa', 10, '13:15:00', '14:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(24, 'Selasa', 11, '14:00:00', '14:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),

-- RABU (12 slots: 1 pembiasaan + 9 pelajaran + 2 istirahat)
(25, 'Rabu', 0, '06:30:00', '07:00:00', 30, 'pembiasaan', 'Sholat Dhuha', '2025/2026', NOW(), NOW()),
(26, 'Rabu', 1, '07:00:00', '07:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(27, 'Rabu', 2, '07:45:00', '08:30:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(28, 'Rabu', 3, '08:30:00', '09:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(29, 'Rabu', 4, '09:15:00', '10:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(30, 'Rabu', 5, '10:00:00', '10:15:00', 15, 'istirahat', 'Istirahat 1', '2025/2026', NOW(), NOW()),
(31, 'Rabu', 6, '10:15:00', '11:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(32, 'Rabu', 7, '11:00:00', '11:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(33, 'Rabu', 8, '11:45:00', '12:30:00', 45, 'istirahat', 'Istirahat 2', '2025/2026', NOW(), NOW()),
(34, 'Rabu', 9, '12:30:00', '13:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(35, 'Rabu', 10, '13:15:00', '14:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(36, 'Rabu', 11, '14:00:00', '14:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),

-- KAMIS (12 slots: 1 pembiasaan + 9 pelajaran + 2 istirahat)
(37, 'Kamis', 0, '06:30:00', '07:00:00', 30, 'pembiasaan', 'Literasi', '2025/2026', NOW(), NOW()),
(38, 'Kamis', 1, '07:00:00', '07:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(39, 'Kamis', 2, '07:45:00', '08:30:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(40, 'Kamis', 3, '08:30:00', '09:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(41, 'Kamis', 4, '09:15:00', '10:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(42, 'Kamis', 5, '10:00:00', '10:15:00', 15, 'istirahat', 'Istirahat 1', '2025/2026', NOW(), NOW()),
(43, 'Kamis', 6, '10:15:00', '11:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(44, 'Kamis', 7, '11:00:00', '11:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(45, 'Kamis', 8, '11:45:00', '12:30:00', 45, 'istirahat', 'Istirahat 2', '2025/2026', NOW(), NOW()),
(46, 'Kamis', 9, '12:30:00', '13:15:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(47, 'Kamis', 10, '13:15:00', '14:00:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(48, 'Kamis', 11, '14:00:00', '14:45:00', 45, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),

-- JUMAT (10 slots: 1 pembiasaan + 7 pelajaran + 2 istirahat, jam lebih pendek)
(49, 'Jumat', 0, '06:30:00', '07:00:00', 30, 'pembiasaan', 'Jumat Bersih', '2025/2026', NOW(), NOW()),
(50, 'Jumat', 1, '07:00:00', '07:35:00', 35, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(51, 'Jumat', 2, '07:35:00', '08:10:00', 35, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(52, 'Jumat', 3, '08:10:00', '08:45:00', 35, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(53, 'Jumat', 4, '08:45:00', '09:20:00', 35, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(54, 'Jumat', 5, '09:20:00', '09:35:00', 15, 'istirahat', 'Istirahat 1', '2025/2026', NOW(), NOW()),
(55, 'Jumat', 6, '09:35:00', '10:10:00', 35, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(56, 'Jumat', 7, '10:10:00', '10:45:00', 35, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(57, 'Jumat', 8, '10:45:00', '12:30:00', 105, 'istirahat', 'Sholat Jumat', '2025/2026', NOW(), NOW()),
(58, 'Jumat', 9, '12:30:00', '13:05:00', 35, 'pelajaran', NULL, '2025/2026', NOW(), NOW()),
(59, 'Jumat', 10, '13:05:00', '13:40:00', 35, 'pelajaran', NULL, '2025/2026', NOW(), NOW())

ON DUPLICATE KEY UPDATE
    jam_mulai = VALUES(jam_mulai),
    jam_selesai = VALUES(jam_selesai),
    durasi_menit = VALUES(durasi_menit),
    jenis = VALUES(jenis),
    label = VALUES(label),
    updated_at = NOW();

-- Verify
SELECT 
    hari, 
    COUNT(*) as total_slots,
    SUM(CASE WHEN jenis = 'pelajaran' THEN 1 ELSE 0 END) as pelajaran,
    SUM(CASE WHEN jenis = 'istirahat' THEN 1 ELSE 0 END) as istirahat,
    SUM(CASE WHEN jenis = 'pembiasaan' THEN 1 ELSE 0 END) as pembiasaan
FROM jam_pelajaran 
GROUP BY hari 
ORDER BY FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu');
