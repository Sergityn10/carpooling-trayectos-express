CREATE TABLE IF NOT EXISTS `cae_reports` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `total_kwh` DOUBLE NOT NULL DEFAULT 0,
  `total_eur` DOUBLE NOT NULL DEFAULT 0,
  `total_caes` INT NOT NULL DEFAULT 0,
  `file_url` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_cae_reports_status` (`status`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `info_caes` ADD COLUMN `report_id` VARCHAR(36) NULL;
ALTER TABLE `info_caes` ADD INDEX `idx_infocaes_report` (`report_id`);
