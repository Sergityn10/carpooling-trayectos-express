-- La propiedad "fecha" acepta valores en formato de fecha estándar SQL (YYYY-MM-DD), por ejemplo: '2024-06-01'. No se permiten otros formatos como DD/MM/YYYY o MM-DD-YYYY.
CREATE TABLE trayectos (
    id SERIAL PRIMARY KEY,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    hora TIMESTAMP NOT NULL,
    plazas INT NOT NULL CHECK (plazas BETWEEN 1 AND 4),
    disponible INT NOT NULL,
    conductor_id INT NOT NULL,
    FOREIGN KEY (conductor_id) REFERENCES users(id)
);

ALTER TABLE trayectos ADD COLUMN disponible INT;

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