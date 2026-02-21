-- =====================================================
-- SEED: jam_pelajaran
-- Table: Master jam pelajaran per hari
-- Run: docker exec -i absenta13-mysql mysql -u root -p absenta13 < seed_jam_pelajaran.sql
-- =====================================================

-- Clear existing data (optional, uncomment if needed)
-- TRUNCATE TABLE jam_pelajaran;

-- Define constants to avoid duplicate literals
SET @TA = '2025/2026';
SET @PEL = 'pelajaran';
SET @IST = 'istirahat';
SET @PEM = 'pembiasaan';
SET @SEN = 'Senin';
SET @SEL = 'Selasa';
SET @RAB = 'Rabu';
SET @KAM = 'Kamis';
SET @JUM = 'Jumat';

-- Insert jam_pelajaran data for 2025/2026
INSERT INTO `jam_pelajaran` (`id`, `hari`, `jam_ke`, `jam_mulai`, `jam_selesai`, `durasi_menit`, `jenis`, `label`, `tahun_ajaran`, `created_at`, `updated_at`) VALUES
-- SENIN (12 slots: 1 pembiasaan + 9 pelajaran + 2 istirahat)
(1, @SEN, 0, '06:30:00', '07:15:00', 45, @PEM, 'Upacara/Apel', @TA, NOW(), NOW()),
(2, @SEN, 1, '07:15:00', '08:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(3, @SEN, 2, '08:00:00', '08:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(4, @SEN, 3, '08:45:00', '09:30:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(5, @SEN, 4, '09:30:00', '10:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(6, @SEN, 5, '10:15:00', '10:30:00', 15, @IST, 'Istirahat 1', @TA, NOW(), NOW()),
(7, @SEN, 6, '10:30:00', '11:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(8, @SEN, 7, '11:15:00', '12:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(9, @SEN, 8, '12:00:00', '12:45:00', 45, @IST, 'Istirahat 2', @TA, NOW(), NOW()),
(10, @SEN, 9, '12:45:00', '13:30:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(11, @SEN, 10, '13:30:00', '14:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(12, @SEN, 11, '14:15:00', '15:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),

-- SELASA (12 slots: 1 pembiasaan + 9 pelajaran + 2 istirahat)
(13, @SEL, 0, '06:30:00', '07:00:00', 30, @PEM, 'Tadarus', @TA, NOW(), NOW()),
(14, @SEL, 1, '07:00:00', '07:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(15, @SEL, 2, '07:45:00', '08:30:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(16, @SEL, 3, '08:30:00', '09:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(17, @SEL, 4, '09:15:00', '10:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(18, @SEL, 5, '10:00:00', '10:15:00', 15, @IST, 'Istirahat 1', @TA, NOW(), NOW()),
(19, @SEL, 6, '10:15:00', '11:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(20, @SEL, 7, '11:00:00', '11:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(21, @SEL, 8, '11:45:00', '12:30:00', 45, @IST, 'Istirahat 2', @TA, NOW(), NOW()),
(22, @SEL, 9, '12:30:00', '13:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(23, @SEL, 10, '13:15:00', '14:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(24, @SEL, 11, '14:00:00', '14:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),

-- RABU (12 slots: 1 pembiasaan + 9 pelajaran + 2 istirahat)
(25, @RAB, 0, '06:30:00', '07:00:00', 30, @PEM, 'Sholat Dhuha', @TA, NOW(), NOW()),
(26, @RAB, 1, '07:00:00', '07:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(27, @RAB, 2, '07:45:00', '08:30:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(28, @RAB, 3, '08:30:00', '09:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(29, @RAB, 4, '09:15:00', '10:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(30, @RAB, 5, '10:00:00', '10:15:00', 15, @IST, 'Istirahat 1', @TA, NOW(), NOW()),
(31, @RAB, 6, '10:15:00', '11:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(32, @RAB, 7, '11:00:00', '11:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(33, @RAB, 8, '11:45:00', '12:30:00', 45, @IST, 'Istirahat 2', @TA, NOW(), NOW()),
(34, @RAB, 9, '12:30:00', '13:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(35, @RAB, 10, '13:15:00', '14:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(36, @RAB, 11, '14:00:00', '14:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),

-- KAMIS (12 slots: 1 pembiasaan + 9 pelajaran + 2 istirahat)
(37, @KAM, 0, '06:30:00', '07:00:00', 30, @PEM, 'Literasi', @TA, NOW(), NOW()),
(38, @KAM, 1, '07:00:00', '07:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(39, @KAM, 2, '07:45:00', '08:30:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(40, @KAM, 3, '08:30:00', '09:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(41, @KAM, 4, '09:15:00', '10:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(42, @KAM, 5, '10:00:00', '10:15:00', 15, @IST, 'Istirahat 1', @TA, NOW(), NOW()),
(43, @KAM, 6, '10:15:00', '11:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(44, @KAM, 7, '11:00:00', '11:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(45, @KAM, 8, '11:45:00', '12:30:00', 45, @IST, 'Istirahat 2', @TA, NOW(), NOW()),
(46, @KAM, 9, '12:30:00', '13:15:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(47, @KAM, 10, '13:15:00', '14:00:00', 45, @PEL, NULL, @TA, NOW(), NOW()),
(48, @KAM, 11, '14:00:00', '14:45:00', 45, @PEL, NULL, @TA, NOW(), NOW()),

-- JUMAT (10 slots: 1 pembiasaan + 7 pelajaran + 2 istirahat, jam lebih pendek)
(49, @JUM, 0, '06:30:00', '07:00:00', 30, @PEM, 'Jumat Bersih', @TA, NOW(), NOW()),
(50, @JUM, 1, '07:00:00', '07:35:00', 35, @PEL, NULL, @TA, NOW(), NOW()),
(51, @JUM, 2, '07:35:00', '08:10:00', 35, @PEL, NULL, @TA, NOW(), NOW()),
(52, @JUM, 3, '08:10:00', '08:45:00', 35, @PEL, NULL, @TA, NOW(), NOW()),
(53, @JUM, 4, '08:45:00', '09:20:00', 35, @PEL, NULL, @TA, NOW(), NOW()),
(54, @JUM, 5, '09:20:00', '09:35:00', 15, @IST, 'Istirahat 1', @TA, NOW(), NOW()),
(55, @JUM, 6, '09:35:00', '10:10:00', 35, @PEL, NULL, @TA, NOW(), NOW()),
(56, @JUM, 7, '10:10:00', '10:45:00', 35, @PEL, NULL, @TA, NOW(), NOW()),
(57, @JUM, 8, '10:45:00', '12:30:00', 105, @IST, 'Sholat Jumat', @TA, NOW(), NOW()),
(58, @JUM, 9, '12:30:00', '13:05:00', 35, @PEL, NULL, @TA, NOW(), NOW()),
(59, @JUM, 10, '13:05:00', '13:40:00', 35, @PEL, NULL, @TA, NOW(), NOW())

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
ORDER BY FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu') ASC;
