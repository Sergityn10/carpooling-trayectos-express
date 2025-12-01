CREATE TABLE comments (
    id_comment INT AUTO_INCREMENT PRIMARY KEY,
    id_trayecto BIGINT UNSIGNED NOT NULL,
    username_commentator VARCHAR(50) NOT NULL,
    username_trayect VARCHAR(50) NOT NULL,
    opinion VARCHAR(1024) NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    CONSTRAINT chk_opinion_rating CHECK (rating BETWEEN 1 AND 10),
    FOREIGN KEY (id_trayecto) REFERENCES trayectos(id),
    FOREIGN KEY (username_commentator) REFERENCES users(username),
    FOREIGN KEY (username_trayect) REFERENCES users(username),
    UNIQUE KEY unique_opinion (id_trayecto, username_commentator)
);

CREATE TABLE comments (
    -- 1. Clave primaria con autoincremento
    id_comment INTEGER PRIMARY KEY AUTOINCREMENT, 
    
    -- 2. Tipos de datos más genéricos
    id_trayecto INTEGER NOT NULL,
    username_commentator TEXT NOT NULL,
    username_trayect TEXT NOT NULL,
    opinion TEXT NOT NULL,
    rating INTEGER NOT NULL,
    
    -- 3. Restricción CHECK
    CONSTRAINT chk_opinion_rating CHECK (rating >= 1 AND rating <= 10),
    
    -- 4. Claves foráneas (SQLite las maneja de forma diferente, pero la sintaxis es similar)
    FOREIGN KEY (id_trayecto) REFERENCES trayectos(id),
    FOREIGN KEY (username_commentator) REFERENCES users(username),
    FOREIGN KEY (username_trayect) REFERENCES users(username),
    
    -- 5. Restricción UNIQUE (el nombre se elimina o se simplifica, se puede omitir el "KEY")
    UNIQUE (id_trayecto, username_commentator)
);