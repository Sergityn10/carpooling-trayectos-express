import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();
const url = process.env.DB_URL || process.env.LIBSQL_URL || 'file:./carpooling.db';
const authToken = process.env.DB_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
const client = createClient({ url, authToken });
let lastTrayectoStatusRefreshMs = 0;
const TRAYECTO_STATUS_REFRESH_MIN_INTERVAL_MS = 1000;



const initDatabase = async () => {
    await client.execute('PRAGMA foreign_keys = ON');
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
    conductor TEXT NOT NULL,
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
    FOREIGN KEY (conductor) REFERENCES users(username),
    
    -- 9. Restricción CHECK
    CONSTRAINT chk_plazas CHECK (plazas >= 1 AND plazas <= 4),
    
    -- 10. Restricción CHECK para simular el ENUM 'status'
    CONSTRAINT chk_trayecto_status CHECK (
        status IN ('en curso', 'programado', 'finalizado', 'cancelado')
    )
);`,
        `CREATE TABLE IF NOT EXISTS reservas (
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
        )`,
        `CREATE TABLE IF NOT EXISTS comments (
            id_comment INTEGER PRIMARY KEY AUTOINCREMENT,
            username_commentator TEXT NOT NULL,
            username_trayect TEXT NOT NULL,
            id_trayecto INTEGER NOT NULL,
            opinion TEXT,
            rating INTEGER,
            FOREIGN KEY(username_commentator) REFERENCES users(username),
            FOREIGN KEY(username_trayect) REFERENCES users(username),
            FOREIGN KEY(id_trayecto) REFERENCES trayectos(id),
            UNIQUE(username_commentator, id_trayecto)
        )`,
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
            username TEXT NOT NULL,
            FOREIGN KEY(username) REFERENCES users(username),
            UNIQUE(username, address)
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
        `CREATE INDEX IF NOT EXISTS idx_reservas_trayecto ON reservas(id_trayecto)`
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
                    const cols = rs.columns?.map(c => c.name) ?? [];
                    if (!rs.rows) return [];
                    return rs.rows.map((row) => {
                        if (typeof row?.get === 'function' && cols.length) {
                            const obj = {};
                            for (const name of cols) obj[name] = row.get(name);
                            return obj;
                        }
                        return row;
                    });
                };
                const plainRows = toPlain(rs);
                const firstWord = String(sql ?? '').trim().split(/\s+/)[0]?.toUpperCase();
                const isRowReturning = firstWord === 'SELECT' || firstWord === 'WITH' || firstWord === 'PRAGMA';
                if (plainRows.length > 0 || isRowReturning) {
                    return [plainRows];
                }
                const header = {
                    affectedRows: rs.rowsAffected ?? 0,
                    insertId: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : undefined,
                };
                return [header];
            } catch (e) {
                const msg = String(e?.message || '');
                if (/FOREIGN KEY constraint failed/i.test(msg)) e.code = 'ER_NO_REFERENCED_ROW_2';
                else if (/UNIQUE constraint failed/i.test(msg) || /SQLITE_CONSTRAINT_UNIQUE/i.test(msg) || /constraint.*unique/i.test(msg)) e.code = 'ER_DUP_ENTRY';
                throw e;
            }
        }
    };
};
export const database = { getConnection };
export { initDatabase };