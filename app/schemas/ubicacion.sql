CREATE TABLE IF NOT EXISTS ubicaciones (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     lat REAL NOT NULL,
     lng REAL NOT NULL,
     display_name TEXT NOT NULL,
     address TEXT NOT NULL,
     city TEXT,
     province TEXT,
     country TEXT,
     postal_code TEXT,
     type TEXT,
     username TEXT NOT NULL,
     FOREIGN KEY(username) REFERENCES users(username),
     UNIQUE(username, address),
     CONSTRAINT chk_lat CHECK (lat >= -90 AND lat <= 90),
     CONSTRAINT chk_lng CHECK (lng >= -180 AND lng <= 180)
 );

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