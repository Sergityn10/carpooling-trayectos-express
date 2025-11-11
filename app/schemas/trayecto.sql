-- La propiedad "fecha" acepta valores en formato de fecha estándar SQL (YYYY-MM-DD), por ejemplo: '2024-06-01'. No se permiten otros formatos como DD/MM/YYYY o MM-DD-YYYY.
CREATE TABLE trayectos (
    id SERIAL PRIMARY KEY,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    hora TIMESTAMP NOT NULL,
    plazas INT NOT NULL CHECK (plazas BETWEEN 1 AND 4),
    disponible INT NOT NULL,
    precio FLOAT NOT NULL,
    conductor VARCHAR(50) NOT NULL,
    routeIndex INT NULL DEFAULT 0,
    status ENUM("en curso", "programado", "finalizado", "cancelado") NOT NULL DEFAULT "programado",
    origen_lat DECIMAL(10, 8) NULL,
    origen_lng DECIMAL(11, 8) NULL,
    destino_lat DECIMAL(10, 8) NULL,
    destino_lng DECIMAL(11, 8) NULL,
    FOREIGN KEY (conductor) REFERENCES users(username)
);

ALTER TABLE trayectos ADD COLUMN disponible INT;
ALTER TABLE trayectos ADD COLUMN routeIndex INT NULL DEFAULT 0;
ALTER TABLE trayectos ADD COLUMN status ENUM("en curso", "programado", "finalizado", "cancelado") NOT NULL DEFAULT "programado";

ALTER TABLE trayectos
MODIFY precio FLOAT;


CREATE OR REPLACE FUNCTION set_disponible_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la columna 'disponible' es nula, le asignamos el valor de 'plazas'
  IF NEW.disponible IS NULL THEN
    NEW.disponible = NEW.plazas;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Luego, asociamos la función a la tabla con un trigger BEFORE INSERT
CREATE TRIGGER set_disponible_before_insert
BEFORE INSERT ON trayectos
FOR EACH ROW
EXECUTE FUNCTION set_disponible_on_insert();

-- Paso 1: Añadir columnas de Latitud y Longitud para Origen
ALTER TABLE trayectos
ADD COLUMN origen_lat DECIMAL(10, 8) NULL,
ADD COLUMN origen_lng DECIMAL(11, 8) NULL;

-- Paso 2: Añadir columnas de Latitud y Longitud para Destino
ALTER TABLE trayectos
ADD COLUMN destino_lat DECIMAL(10, 8) NULL,
ADD COLUMN destino_lng DECIMAL(11, 8) NULL;

-- Nota: Estas columnas deben ser llenadas con coordenadas al CREAR un trayecto.