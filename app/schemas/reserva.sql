CREATE TABLE reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    id_trayecto BIGINT UNSIGNED  NOT NULL,
    username VARCHAR(255) NOT NULL,
    status ENUM('pending', 'completed', 'canceled') DEFAULT 'pending',
    stripe_checkout_session_id VARCHAR(255) DEFAULT NULL,
    stripe_payment_intent_id VARCHAR(255) DEFAULT NULL,
    stripe_payment_intent_status VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (id_trayecto) REFERENCES trayectos(id),
    FOREIGN KEY (username) REFERENCES users(username),
    UNIQUE KEY unique_reserva (id_trayecto, username)
);

ALTER TABLE carpooling.reservas 
ADD COLUMN stripe_payment_intent_status VARCHAR(255) DEFAULT NULL,
ADD COLUMN status ENUM('pending', 'completed', 'canceled') NOT NULL DEFAULT 'pending',
ADD COLUMN stripe_checkout_session_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN stripe_payment_intent_id VARCHAR(255) DEFAULT NULL;