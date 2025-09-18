CREATE TABLE reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    id_trayecto BIGINT UNSIGNED  NOT NULL,
    username VARCHAR(255) NOT NULL,
    FOREIGN KEY (id_trayecto) REFERENCES trayectos(id),
    FOREIGN KEY (username) REFERENCES users(username),
    UNIQUE KEY unique_reserva (id_trayecto, username)
);