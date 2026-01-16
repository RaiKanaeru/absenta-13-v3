-- ============================================================
-- MIGRATION: Schedule Management Enhancement
-- Version: 1.0
-- Date: 2026-01-16
-- Description: Add tables for jam_pelajaran, guru_availability, 
--              app_settings, and modify guru for system entities
-- ============================================================

-- Pastikan mode SQL mengizinkan insert id = 0
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ============================================================
-- 1. ALTER TABLE `guru` - Add is_system_entity column
-- ============================================================
ALTER TABLE guru
ADD COLUMN IF NOT EXISTS is_system_entity TINYINT(1) NOT NULL DEFAULT 0
COMMENT 'True untuk entitas sistem (MANDIRI, WALI KELAS, dll)';

-- ============================================================
-- 2. CREATE TABLE `jam_pelajaran` - Durasi jam per hari
-- ============================================================
CREATE TABLE IF NOT EXISTS jam_pelajaran (
  id INT PRIMARY KEY AUTO_INCREMENT,
  hari ENUM('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu') NOT NULL,
  jam_ke TINYINT NOT NULL COMMENT '0 = Pembiasaan pagi, 1-12 = Jam pelajaran',
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  durasi_menit INT NOT NULL DEFAULT 45,
  jenis ENUM('pelajaran','istirahat','pembiasaan') NOT NULL DEFAULT 'pelajaran',
  label VARCHAR(50) DEFAULT NULL COMMENT 'Label khusus: Upacara, Tadarus, dll',
  tahun_ajaran VARCHAR(9) NOT NULL DEFAULT '2025/2026',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Compound index untuk performa lookup
  INDEX idx_jam_pelajaran_lookup (hari, jam_ke),
  UNIQUE KEY unique_hari_jam_tahun (hari, jam_ke, tahun_ajaran)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Master jam pelajaran per hari dengan durasi variabel';

-- ============================================================
-- 3. CREATE TABLE `guru_availability` - Ketersediaan guru per hari
-- ============================================================
CREATE TABLE IF NOT EXISTS guru_availability (
  id INT PRIMARY KEY AUTO_INCREMENT,
  guru_id INT NOT NULL,
  hari ENUM('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu') NOT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=ADA, 0=TIDAK ADA',
  keterangan TEXT DEFAULT NULL,
  tahun_ajaran VARCHAR(9) NOT NULL DEFAULT '2025/2026',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Unique constraint agar tidak ada duplikat
  UNIQUE KEY unique_guru_hari (guru_id, hari, tahun_ajaran),
  
  -- Foreign key ke guru
  CONSTRAINT fk_availability_guru FOREIGN KEY (guru_id) 
    REFERENCES guru(id_guru) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Ketersediaan guru per hari (dari MASTER GURU HARIAN)';

-- ============================================================
-- 4. CREATE TABLE `app_settings` - Config dinamis
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value JSON NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Konfigurasi aplikasi per tahun ajaran';

-- ============================================================
-- 5. CREATE TABLE `ruang_mapel_binding` - Lab terikat mapel
-- ============================================================
CREATE TABLE IF NOT EXISTS ruang_mapel_binding (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ruang_id INT NOT NULL,
  mapel_id INT NOT NULL,
  is_exclusive TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=Wajib di ruang ini',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_ruang_mapel (ruang_id, mapel_id),
  CONSTRAINT fk_binding_ruang FOREIGN KEY (ruang_id) 
    REFERENCES ruang_kelas(id_ruang) ON DELETE CASCADE,
  CONSTRAINT fk_binding_mapel FOREIGN KEY (mapel_id) 
    REFERENCES mapel(id_mapel) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Binding ruang khusus ke mapel tertentu (Lab)';

-- ============================================================
-- VERIFIKASI: Tampilkan tabel yang dibuat
-- ============================================================
SHOW TABLES LIKE 'jam_pelajaran';
SHOW TABLES LIKE 'guru_availability';
SHOW TABLES LIKE 'app_settings';
SHOW TABLES LIKE 'ruang_mapel_binding';

SELECT 'Migration completed successfully!' AS status;
