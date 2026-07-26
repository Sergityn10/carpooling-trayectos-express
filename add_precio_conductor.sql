-- Add precio_conductor column to trayectos table
ALTER TABLE trayectos ADD COLUMN precio_conductor FLOAT NOT NULL DEFAULT 0 AFTER precio;
