-- Migration: Create attendance_settings table
-- Run this migration to add configurable attendance settings
-- Date: 2024-12-18

-- Create settings table
CREATE TABLE IF NOT EXISTS attendance_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default values
INSERT INTO attendance_settings (setting_key, setting_value, description) VALUES
('enable_late_detection', 'false', 'Aktifkan deteksi terlambat berdasarkan jam masuk'),
('default_start_time', '07:00', 'Jam masuk default (format HH:MM)'),
('late_tolerance_minutes', '15', 'Toleransi keterlambatan dalam menit'),
('alpha_voids_day', 'true', 'Jika ada 1 jam Alpa, gugurkan seluruh kehadiran hari itu')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_setting_key ON attendance_settings(setting_key);
