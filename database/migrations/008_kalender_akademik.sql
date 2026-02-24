-- Kalender Akademik Migration
-- Creates table for managing effective school days per month

CREATE TABLE IF NOT EXISTS kalender_akademik (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tahun_pelajaran VARCHAR(9) NOT NULL COMMENT 'Format: 2025/2026',
    bulan TINYINT NOT NULL COMMENT '1-12',
    tahun INT NOT NULL COMMENT 'Actual year (2025, 2026)',
    hari_efektif INT NOT NULL DEFAULT 20 COMMENT 'Number of effective school days',
    is_libur_semester BOOLEAN DEFAULT FALSE COMMENT 'Is semester break month',
    keterangan VARCHAR(255) COMMENT 'Notes/description',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_month (tahun_pelajaran, bulan, tahun),
    INDEX idx_tahun_pelajaran (tahun_pelajaran),
    INDEX idx_bulan_tahun (bulan, tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default data for 2025/2026
SET @tp = '2025/2026';
SET @y25 = 2025;
SET @y26 = 2026;

INSERT INTO kalender_akademik (tahun_pelajaran, bulan, tahun, hari_efektif, keterangan) VALUES
-- Semester Ganjil 2025/2026
(@tp, 7, @y25, 21, 'Juli - Awal Semester Ganjil'),
(@tp, 8, @y25, 21, 'Agustus'),
(@tp, 9, @y25, 21, 'September'),
(@tp, 10, @y25, 22, 'Oktober'),
(@tp, 11, @y25, 21, 'November'),
(@tp, 12, @y25, 18, 'Desember - Libur Semester Ganjil'),
-- Semester Genap 2025/2026
(@tp, 1, @y26, 21, 'Januari - Awal Semester Genap'),
(@tp, 2, @y26, 20, 'Februari'),
(@tp, 3, @y26, 22, 'Maret'),
(@tp, 4, @y26, 20, 'April'),
(@tp, 5, @y26, 20, 'Mei'),
(@tp, 6, @y26, 18, 'Juni - Libur Semester Genap')
ON DUPLICATE KEY UPDATE
    hari_efektif = VALUES(hari_efektif),
    keterangan = VALUES(keterangan);
