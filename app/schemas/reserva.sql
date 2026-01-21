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
CREATE TABLE reservas (
    -- 1. Clave primaria con autoincremento
    id_reserva INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 2. Tipos de datos INTEGER
    id_trayecto INTEGER NOT NULL,
    
    -- 3. Tipos de datos TEXT
    username TEXT NOT NULL,
    
    -- 4. Tipo ENUM sustituido por TEXT y restricción CHECK
    status TEXT NOT NULL DEFAULT 'pending',
    
    -- -- 5. Campos de Stripe como TEXT
    -- stripe_checkout_session_id TEXT DEFAULT NULL,
    -- stripe_payment_intent_id TEXT DEFAULT NULL,
    -- stripe_payment_intent_status TEXT DEFAULT NULL,
    
    -- 6. Claves foráneas
    FOREIGN KEY (id_trayecto) REFERENCES trayectos(id),
    FOREIGN KEY (username) REFERENCES users(username),
    
    -- 7. Restricción UNIQUE
    UNIQUE (id_trayecto, username),
    .

    -- Restricción CHECK para simular el ENUM
    CONSTRAINT chk_reserva_status CHECK (
        status IN ('pending', 'completed', 'canceled')
    )
);

ALTER TABLE carpooling.reservas 
ADD COLUMN stripe_payment_intent_status VARCHAR(255) DEFAULT NULL,
ADD COLUMN status ENUM('pending', 'completed', 'canceled') NOT NULL DEFAULT 'pending',
ADD COLUMN stripe_checkout_session_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN stripe_payment_intent_id VARCHAR(255) DEFAULT NULL;