import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();
const url = process.env.DB_URL || process.env.LIBSQL_URL || 'file:./carpooling.db';
const authToken = process.env.DB_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
const client = createClient({ url, authToken });

const initDatabase = async () => {
    await client.execute('PRAGMA foreign_keys = ON');
    const statements = [
        `CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            img_perfil TEXT,
            name TEXT,
            nombre TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS trayectos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origen TEXT NOT NULL,
            destino TEXT NOT NULL,
            hora TEXT NOT NULL,
            plazas INTEGER NOT NULL,
            conductor TEXT NOT NULL,
            disponible INTEGER NOT NULL,
            precio REAL NOT NULL,
            origen_lat REAL,
            origen_lng REAL,
            destino_lat REAL,
            destino_lng REAL,
            routeIndex INTEGER,
            FOREIGN KEY (conductor) REFERENCES users(username),
            UNIQUE(conductor, hora)
        )`,
        `CREATE TABLE IF NOT EXISTS reservas (
            id_reserva INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            id_trayecto INTEGER NOT NULL,
            status TEXT NOT NULL,
            stripe_checkout_session_id TEXT,
            FOREIGN KEY (username) REFERENCES users(username),
            FOREIGN KEY (id_trayecto) REFERENCES trayectos(id),
            UNIQUE(username, id_trayecto)
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
        `CREATE TABLE IF NOT EXISTS accounts (
            username TEXT PRIMARY KEY,
            stripe_account_id TEXT,
            FOREIGN KEY(username) REFERENCES users(username)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_trayectos_origen ON trayectos(origen_lat, origen_lng)`,
        `CREATE INDEX IF NOT EXISTS idx_trayectos_destino ON trayectos(destino_lat, destino_lng)`,
        `CREATE INDEX IF NOT EXISTS idx_trayectos_hora ON trayectos(hora)`,
        `CREATE INDEX IF NOT EXISTS idx_reservas_trayecto ON reservas(id_trayecto)`
    ];
    for (const sql of statements) {
        await client.execute(sql);
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
                if (plainRows.length > 0) {
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