import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();
const url =
  process.env.DB_URL || process.env.LIBSQL_URL || "file:./carpooling.db";
const authToken = process.env.DB_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
const client = createClient({ url, authToken });
let lastTrayectoStatusRefreshMs = 0;
const TRAYECTO_STATUS_REFRESH_MIN_INTERVAL_MS = 1000;

const initDatabase = async () => {
  await client.execute("PRAGMA foreign_keys = ON");
  const statements = [
    `CREATE TABLE IF NOT EXISTS trayectos (
    -- 1. Clave primaria SERIAL se convierte a INTEGER PRIMARY KEY AUTOINCREMENT
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 2. Cadenas de texto
    origen TEXT NOT NULL,
    destino TEXT NOT NULL,
    
    -- 3. TIMESTAMP se convierte a TEXT (formato ISO 8601) o INTEGER (UNIX Epoch)
    hora TEXT NOT NULL,
    
    -- 4. Tipos INTEGER
    plazas INTEGER NOT NULL,
    disponible INTEGER NOT NULL,
    
    -- 5. Tipos numéricos para precios y coordenadas
    precio REAL NOT NULL,
    conductor INTEGER NOT NULL,
    routeIndex INTEGER NULL DEFAULT 0,
    
    -- 6. ENUM simulado con TEXT y DEFAULT
    status TEXT NOT NULL DEFAULT 'programado',
    
    -- 7. DECIMAL se convierte a REAL
    origen_lat REAL NULL,
    origen_lng REAL NULL,
    destino_lat REAL NULL,
    destino_lng REAL NULL,
    
    notified_15min INTEGER NOT NULL DEFAULT 0,
    
    -- 8. Clave Foránea
    FOREIGN KEY (conductor) REFERENCES users(id) ON DELETE CASCADE,
    
    -- 9. Restricción CHECK
    CONSTRAINT chk_plazas CHECK (plazas >= 1 AND plazas <= 4),
    
    -- 10. Restricción CHECK para simular el ENUM 'status'
    CONSTRAINT chk_trayecto_status CHECK (
        status IN ('en curso', 'programado', 'finalizado', 'cancelado')
    )
);`,
    `CREATE TABLE IF NOT EXISTS reservas (
            id_reserva INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            id_trayecto INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            stripe_checkout_session_id TEXT,
            stripe_payment_intent_id TEXT,
            stripe_payment_intent_status TEXT,
            trip_outcome TEXT NOT NULL DEFAULT 'pending',
            trip_outcome_reason TEXT,
            trip_outcome_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (id_trayecto) REFERENCES trayectos(id) ON DELETE CASCADE,
            UNIQUE(user_id, id_trayecto),
            CONSTRAINT chk_reserva_status CHECK (
                status IN ('pending', 'completed', 'canceled')
            ),
            CONSTRAINT chk_reserva_trip_outcome CHECK (
                trip_outcome IN ('pending', 'success', 'issue')
            )
        )`,
    `ALTER TABLE reservas ADD COLUMN stripe_checkout_session_id TEXT`,
    `ALTER TABLE reservas ADD COLUMN stripe_payment_intent_id TEXT`,
    `ALTER TABLE reservas ADD COLUMN stripe_payment_intent_status TEXT`,
    `ALTER TABLE reservas ADD COLUMN trip_outcome TEXT NOT NULL DEFAULT 'pending'`,
    `ALTER TABLE reservas ADD COLUMN trip_outcome_reason TEXT`,
    `ALTER TABLE reservas ADD COLUMN trip_outcome_at TEXT`,
    `CREATE TABLE IF NOT EXISTS comments (
     id_comment INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id_commentator TEXT NOT NULL,
     user_id_trayect TEXT NOT NULL,
     id_trayecto INTEGER NOT NULL,
     opinion TEXT,
     rating INTEGER,
     FOREIGN KEY(user_id_commentator) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY(user_id_trayect) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY(id_trayecto) REFERENCES trayectos(id) ON DELETE CASCADE,
     UNIQUE(user_id_commentator, id_trayecto),
     CONSTRAINT chk_opinion_rating CHECK (rating >= 1 AND rating <= 10)
 );
`,
    `CREATE TABLE IF NOT EXISTS ubicaciones (
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
            user_id INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, address)
        )`,
    `CREATE TRIGGER IF NOT EXISTS trg_reservas_after_delete_completed
            AFTER DELETE ON reservas
            WHEN OLD.status = 'completed'
        BEGIN
            UPDATE trayectos
            SET disponible = disponible + 1
            WHERE id = OLD.id_trayecto;
        END;`,
    `CREATE INDEX IF NOT EXISTS idx_trayectos_origen ON trayectos(origen_lat, origen_lng)`,
    `CREATE INDEX IF NOT EXISTS idx_trayectos_destino ON trayectos(destino_lat, destino_lng)`,
    `CREATE INDEX IF NOT EXISTS idx_trayectos_hora ON trayectos(hora)`,
    `CREATE INDEX IF NOT EXISTS idx_reservas_trayecto ON reservas(id_trayecto)`,
    `CREATE INDEX IF NOT EXISTS idx_reservas_stripe_checkout_session ON reservas(stripe_checkout_session_id)`,
    // `CREATE INDEX IF NOT EXISTS idx_pagos_checkout_session ON pagos(stripe_checkout_session_id)`,
    // `CREATE INDEX IF NOT EXISTS idx_pagos_payment_intent ON pagos(stripe_payment_intent_id)`,
    `CREATE TABLE IF NOT EXISTS preference_definitions (
            pref_key TEXT PRIMARY KEY,
            value_type TEXT NOT NULL,
            default_value TEXT NOT NULL,
            enum_values TEXT,
            description TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            CONSTRAINT chk_pref_value_type CHECK (value_type IN ('boolean', 'number', 'text', 'enum'))
        )`,
    `CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INTEGER NOT NULL,
            pref_key TEXT NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, pref_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (pref_key) REFERENCES preference_definitions(pref_key) ON DELETE CASCADE
        )`,
    `CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_preferences_pref_key ON user_preferences(pref_key)`,
    `INSERT OR IGNORE INTO preference_definitions (pref_key, value_type, default_value, enum_values, description) VALUES
        ('smoking_allowed', 'boolean', '0', NULL, 'Permite fumar durante el viaje'),
        ('pets_allowed', 'boolean', '0', NULL, 'Permite mascotas durante el viaje'),
        ('music', 'boolean', '1', NULL, 'Música durante el viaje'),
        ('talk_level', 'enum', 'normal', '["silencio","normal","charla"]', 'Nivel de conversación'),
        ('temperature', 'enum', 'templado', '["frio","templado","calor"]', 'Temperatura preferida'),
        ('luggage_size', 'enum', 'medio', '["pequeno","medio","grande"]', 'Tamaño de equipaje admitido'),
        ('stops_allowed', 'boolean', '0', NULL, 'Permite paradas durante el viaje'),
        ('max_detour_km', 'number', '0', NULL, 'Desvío máximo aceptado (km)')`,

    `CREATE TABLE IF NOT EXISTS frequents_routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            createdAt TEXT NOT NULL DEFAULT (datetime('now')),
            updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
            user_id TEXT NOT NULL,
            name TEXT,
            originAddress TEXT NOT NULL,
            originLat REAL NOT NULL,
            originLng REAL NOT NULL,
            destAddress TEXT NOT NULL,
            destLat REAL NOT NULL,
            destLng REAL NOT NULL,
            role TEXT NOT NULL DEFAULT 'DRIVER',
            seats INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CHECK (role IN ('PASSENGER', 'DRIVER')),
            CHECK (seats >= 1)
        )`,

    `CREATE INDEX IF NOT EXISTS idx_frequents_routes_user_id ON frequents_routes(user_id)`,
  ];
  for (const sql of statements) {
    try {
      await client.execute(sql);
    } catch (e) {
      const msg = String(e?.message || "");
      if (/duplicate column name/i.test(msg)) continue;
      throw e;
    }
  }
};

const getConnection = async () => {
  return {
    query: async (sql, params = []) => {
      try {
        const rs = await client.execute({ sql, args: params });
        const toPlain = (rs) => {
          const cols = rs.columns?.map((c) => c.name) ?? [];
          if (!rs.rows) return [];
          return rs.rows.map((row) => {
            if (typeof row?.get === "function" && cols.length) {
              const obj = {};
              for (const name of cols) obj[name] = row.get(name);
              return obj;
            }
            return row;
          });
        };
        const plainRows = toPlain(rs);
        const firstWord = String(sql ?? "")
          .trim()
          .split(/\s+/)[0]
          ?.toUpperCase();
        const isRowReturning =
          firstWord === "SELECT" ||
          firstWord === "WITH" ||
          firstWord === "PRAGMA";
        if (plainRows.length > 0 || isRowReturning) {
          return [plainRows];
        }
        const header = {
          affectedRows: rs.rowsAffected ?? 0,
          insertId:
            rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : undefined,
        };
        return [header];
      } catch (e) {
        const msg = String(e?.message || "");
        if (/FOREIGN KEY constraint failed/i.test(msg))
          e.code = "ER_NO_REFERENCED_ROW_2";
        else if (
          /UNIQUE constraint failed/i.test(msg) ||
          /SQLITE_CONSTRAINT_UNIQUE/i.test(msg) ||
          /constraint.*unique/i.test(msg)
        )
          e.code = "ER_DUP_ENTRY";
        throw e;
      }
    },
  };
};
export const database = { getConnection };
export { initDatabase };
