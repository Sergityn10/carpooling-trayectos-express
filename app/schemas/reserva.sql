CREATE TABLE IF NOT EXISTS reservas (
     id_reserva INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL,
     id_trayecto INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     FOREIGN KEY (username) REFERENCES users(username),
     FOREIGN KEY (id_trayecto) REFERENCES trayectos(id),
     UNIQUE(username, id_trayecto),
     CONSTRAINT chk_reserva_status CHECK (
         status IN ('pending', 'completed', 'canceled')
     )
 );

 CREATE TRIGGER IF NOT EXISTS trg_reservas_after_delete_completed
     AFTER DELETE ON reservas
     WHEN OLD.status = 'completed'
 BEGIN
     UPDATE trayectos
     SET disponible = disponible + 1
     WHERE id = OLD.id_trayecto;
 END;

 CREATE INDEX IF NOT EXISTS idx_reservas_trayecto ON reservas(id_trayecto);

 --MYSQL
CREATE TABLE IF NOT EXISTS reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    id_trayecto INT NOT NULL,
    status ENUM('pending', 'completed', 'canceled') NOT NULL DEFAULT 'pending',
    
    -- Restricciones de Relación
    CONSTRAINT fk_reserva_user 
        FOREIGN KEY (username) REFERENCES users(username)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_reserva_trayecto 
        FOREIGN KEY (id_trayecto) REFERENCES trayectos(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Unicidad: un usuario no puede reservar dos veces el mismo trayecto
    UNIQUE KEY uk_user_trayecto (username, id_trayecto)
) ENGINE=InnoDB;

-- Índice de optimización
CREATE INDEX idx_reservas_trayecto ON reservas(id_trayecto);

-- TRIGGER para actualizar plazas disponibles
DELIMITER //

CREATE TRIGGER trg_reservas_after_delete_completed
AFTER DELETE ON reservas
FOR EACH ROW
BEGIN
    IF OLD.status = 'completed' THEN
        UPDATE trayectos
        SET disponible = disponible + 1
        WHERE id = OLD.id_trayecto;
    END IF;
END //

DELIMITER ;