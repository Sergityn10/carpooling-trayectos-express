CREATE TABLE IF NOT EXISTS comments (
     id_comment INTEGER PRIMARY KEY AUTOINCREMENT,
     username_commentator TEXT NOT NULL,
     username_trayect TEXT NOT NULL,
     id_trayecto INTEGER NOT NULL,
     opinion TEXT,
     rating INTEGER,
     FOREIGN KEY(username_commentator) REFERENCES users(username),
     FOREIGN KEY(username_trayect) REFERENCES users(username),
     FOREIGN KEY(id_trayecto) REFERENCES trayectos(id),
     UNIQUE(username_commentator, id_trayecto),
     CONSTRAINT chk_opinion_rating CHECK (rating >= 1 AND rating <= 10)
 );

 --MYSQL
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