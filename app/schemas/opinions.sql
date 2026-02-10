CREATE TABLE IF NOT EXISTS comments (
     id_comment INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id_commentator TEXT NOT NULL,
     user_id_trayect TEXT NOT NULL,
     id_trayecto INTEGER NOT NULL,
     opinion TEXT,
     rating INTEGER,
     FOREIGN KEY(user_id_commentator) REFERENCES users(id),
     FOREIGN KEY(user_id_trayect) REFERENCES users(id),
     FOREIGN KEY(id_trayecto) REFERENCES trayectos(id),
     UNIQUE(user_id_commentator, id_trayecto),
     CONSTRAINT chk_opinion_rating CHECK (rating >= 1 AND rating <= 10)
 );

 --MYSQL
 CREATE TABLE comments (
    id_comment INT AUTO_INCREMENT PRIMARY KEY,
    id_trayecto BIGINT UNSIGNED NOT NULL,
    user_id_commentator VARCHAR(50) NOT NULL,
    user_id_trayect VARCHAR(50) NOT NULL,
    opinion VARCHAR(1024) NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    CONSTRAINT chk_opinion_rating CHECK (rating BETWEEN 1 AND 10),
    FOREIGN KEY (id_trayecto) REFERENCES trayectos(id),
    FOREIGN KEY (user_id_commentator) REFERENCES users(id),
    FOREIGN KEY (user_id_trayect) REFERENCES users(id),
    UNIQUE KEY unique_opinion (id_trayecto, user_id_commentator)
);