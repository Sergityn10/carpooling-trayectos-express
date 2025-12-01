CREATE TABLE cars (
    id_car INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    matricula VARCHAR(20) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    color VARCHAR(50) NULL,
    tipo_combustible enum('Diesel', 'Gasolina', 'Electrico', "Hibrido") NOT NULL,
    year SMALLINT UNSIGNED NOT NULL,
    tipo VARCHAR(50) NOT NULL
);

CREATE TABLE cars (
    -- 1. Clave primaria con autoincremento
    id_car INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 2. Tipos de datos TEXT
    matricula TEXT NOT NULL,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    color TEXT NULL,
    
    -- 3. Tipo ENUM sustituido por TEXT y restricción CHECK
    tipo_combustible TEXT NOT NULL,
    
    -- 4. Tipos INTEGER
    year INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    
    -- Restricción CHECK para simular el ENUM
    CONSTRAINT chk_combustible CHECK (
        tipo_combustible IN ('Diesel', 'Gasolina', 'Electrico', 'Hibrido')
    )
);