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
