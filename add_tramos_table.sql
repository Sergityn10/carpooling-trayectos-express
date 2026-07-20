CREATE TABLE IF NOT EXISTS `tramos` (
  `id` VARCHAR(36) NOT NULL,
  `id_trayecto` VARCHAR(36) NOT NULL,
  `lat` DOUBLE NOT NULL,
  `lng` DOUBLE NOT NULL,
  `address` TEXT NOT NULL,
  `step_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_tramos_trayecto` (`id_trayecto`),
  INDEX `idx_tramos_coords` (`lat`, `lng`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
