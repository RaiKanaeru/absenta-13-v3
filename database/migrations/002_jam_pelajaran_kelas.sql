-- ============================================================
-- MIGRATION: Per-Class Schedule Slots
-- Version: 1.0
-- Date: 2026-02-05
-- Description: Add jam_pelajaran_kelas for class-specific slots
-- ============================================================

CREATE TABLE IF NOT EXISTS jam_pelajaran_kelas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  kelas_id INT NOT NULL,
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

  UNIQUE KEY unique_kelas_hari_jam_tahun (kelas_id, hari, jam_ke, tahun_ajaran),
  INDEX idx_jam_pelajaran_kelas_lookup (kelas_id, hari, jam_ke),
  CONSTRAINT fk_jam_pelajaran_kelas_kelas FOREIGN KEY (kelas_id)
    REFERENCES kelas(id_kelas) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Master jam pelajaran per kelas dengan durasi variabel';
