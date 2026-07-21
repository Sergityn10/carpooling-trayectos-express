SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'app_viajes' AND TABLE_NAME IN ('trayectos', 'tramos');
