CREATE TABLE ubicaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lat DECIMAL(9,6) CHECK (lat BETWEEN -90 AND 90) NOT NULL,
    lng DECIMAL(9,6) CHECK (lng BETWEEN -180 AND 180) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    address VARCHAR(500) NOT NULL UNIQUE,
    city VARCHAR(100),
    province VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(100),
    type VARCHAR(100),
    username VARCHAR(100) NOT NULL
);

ALTER TABLE ubicaciones ADD CONSTRAINT unique_address_username UNIQUE (address, username);

ALTER TABLE ubicaciones 
MODIFY COLUMN username VARCHAR(500) NOT NULL;