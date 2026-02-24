CREATE TABLE IF NOT EXISTS `admin_activity_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `admin_id` INT NOT NULL,
  `admin_name` VARCHAR(100) NOT NULL,
  `action` VARCHAR(50) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, LOGIN, EXPORT',
  `target` VARCHAR(50) NOT NULL COMMENT 'Table or Entity name',
  `target_id` INT DEFAULT NULL COMMENT 'ID of the affected entity',
  `details` JSON DEFAULT NULL COMMENT 'Snapshot of changed data',
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_admin_id` (`admin_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
