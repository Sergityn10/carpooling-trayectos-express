CREATE TABLE IF NOT EXISTS trayectos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     origen TEXT NOT NULL,
     destino TEXT NOT NULL,
     hora TEXT NOT NULL,
     plazas INTEGER NOT NULL,
     disponible INTEGER NOT NULL,
     precio REAL NOT NULL,
     conductor TEXT NOT NULL,
     routeIndex INTEGER NULL DEFAULT 0,
     status TEXT NOT NULL DEFAULT 'programado',
     origen_lat REAL NULL,
     origen_lng REAL NULL,
     destino_lat REAL NULL,
     destino_lng REAL NULL,
     notified_15min INTEGER NOT NULL DEFAULT 0,
     FOREIGN KEY (conductor) REFERENCES users(username),
     CONSTRAINT chk_plazas CHECK (plazas >= 1 AND plazas <= 4),
     CONSTRAINT chk_trayecto_status CHECK (
         status IN ('en curso', 'programado', 'finalizado', 'cancelado')
     )
 );

 CREATE INDEX IF NOT EXISTS idx_trayectos_origen ON trayectos(origen_lat, origen_lng);
 CREATE INDEX IF NOT EXISTS idx_trayectos_destino ON trayectos(destino_lat, destino_lng);
 CREATE INDEX IF NOT EXISTS idx_trayectos_hora ON trayectos(hora);

--mysql
CREATE TABLE IF NOT EXISTS trayectos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    origen VARCHAR(255) NOT NULL,
    destino VARCHAR(255) NOT NULL,
    hora DATETIME NOT NULL, -- Cambiado de TEXT a DATETIME para mejor manejo temporal
    plazas INT NOT NULL,
    disponible INT NOT NULL,
    precio DECIMAL(10, 2) NOT NULL, -- DECIMAL es más preciso para dinero que REAL
    conductor VARCHAR(100) NOT NULL,
    routeIndex INT NULL DEFAULT 0,
    status ENUM('en curso', 'programado', 'finalizado', 'cancelado') NOT NULL DEFAULT 'programado',
    origen_lat DECIMAL(10, 8) NULL,
    origen_lng DECIMAL(11, 8) NULL,
    destino_lat DECIMAL(10, 8) NULL,
    destino_lng DECIMAL(11, 8) NULL,
    notified_15min TINYINT(1) NOT NULL DEFAULT 0,
    
    -- Relaciones
    CONSTRAINT fk_trayecto_conductor 
        FOREIGN KEY (conductor) REFERENCES users(username)
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Validaciones
    CONSTRAINT chk_plazas CHECK (plazas >= 1 AND plazas <= 4)
) ENGINE=InnoDB;

-- Índices espaciales y de búsqueda
CREATE INDEX idx_trayectos_origen_coords ON trayectos(origen_lat, origen_lng);
CREATE INDEX idx_trayectos_destino_coords ON trayectos(destino_lat, destino_lng);
CREATE INDEX idx_trayectos_hora ON trayectos(hora);

