-- 2. El Catálogo (El "Menú" de opciones disponibles)
CREATE TABLE IF NOT EXISTS preference_definitions (
    pref_key TEXT PRIMARY KEY,
    value_type TEXT NOT NULL,
    default_value TEXT NOT NULL,
    enum_values TEXT,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_pref_value_type CHECK (value_type IN ('boolean', 'number', 'text', 'enum'))
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT NOT NULL,
    pref_key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, pref_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pref_key) REFERENCES preference_definitions(pref_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

INSERT OR IGNORE INTO preference_definitions (pref_key, value_type, default_value, enum_values, description) VALUES
('smoking_allowed', 'boolean', '0', NULL, 'Permite fumar durante el viaje'),
('pets_allowed', 'boolean', '0', NULL, 'Permite mascotas durante el viaje'),
('music', 'boolean', '1', NULL, 'Música durante el viaje'),
('talk_level', 'enum', 'normal', '["silencio","normal","charla"]', 'Nivel de conversación'),
('temperature', 'enum', 'templado', '["frio","templado","calor"]', 'Temperatura preferida'),
('luggage_size', 'enum', 'medio', '["pequeno","medio","grande"]', 'Tamaño de equipaje admitido'),
('stops_allowed', 'boolean', '0', NULL, 'Permite paradas durante el viaje'),
('max_detour_km', 'number', '0', NULL, 'Desvío máximo aceptado (km)');