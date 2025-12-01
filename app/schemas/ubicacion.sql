CREATE TABLE ubicaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lat DECIMAL(9,6) CHECK (lat BETWEEN -90 AND 90) NOT NULL,
    lng DECIMAL(9,6) CHECK (lng BETWEEN -180 AND 180) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100),
    province VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(100),
    type VARCHAR(100),
    username VARCHAR(500) NOT NULL,
    FOREIGN KEY (username) REFERENCES users(username),
);

CREATE TABLE ubicaciones (
    -- 1. Clave primaria con autoincremento
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 2. DECIMAL se convierte a REAL. Las restricciones CHECK son compatibles.
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    
    -- 3. Cadenas de texto
    display_name TEXT NOT NULL,
    address TEXT NOT NULL, -- Se mantiene la restricción UNIQUE
    city TEXT,
    province TEXT,
    country TEXT,
    postal_code TEXT,
    type TEXT,
    username TEXT NOT NULL,
    
    -- 4. Clave Foránea
    FOREIGN KEY (username) REFERENCES users(username),
    
    -- 5. Restricciones CHECK para la latitud y longitud
    CONSTRAINT chk_lat CHECK (lat >= -90 AND lat <= 90),
    CONSTRAINT chk_lng CHECK (lng >= -180 AND lng <= 180)
);
DROP TABLE ubicaciones;
ALTER TABLE ubicaciones ADD CONSTRAINT unique_address_username UNIQUE (address, username);

ALTER TABLE ubicaciones 
MODIFY COLUMN username VARCHAR(500) NOT NULL;