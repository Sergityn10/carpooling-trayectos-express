import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const url =
  process.env.DB_URL || process.env.LIBSQL_URL || "file:./carpooling.db";
const authToken = process.env.DB_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
const client = createClient({ url, authToken });

async function tableExists(tableName) {
  const rs = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName],
  );
  return rs.rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const rs = await client.execute(`PRAGMA table_info(${tableName})`);
  return rs.rows.some((row) => row.name === columnName);
}

async function getOldColumns(tableName) {
  const rs = await client.execute(`PRAGMA table_info(${tableName})`);
  return rs.rows.map((row) => ({ name: row.name, type: row.type }));
}

async function runMigration() {
  console.log("=== Iniciando migración a UUID ===\n");
  await client.execute("PRAGMA foreign_keys = OFF");

  // Eliminar trigger que referencia trayectos antes de cualquier operación
  try {
    await client.execute(
      "DROP TRIGGER IF EXISTS trg_reservas_after_delete_completed",
    );
  } catch (e) {
    console.log("   (skip) Drop trigger inicial:", e.message);
  }

  // ── 1. Migrar trayectos ──
  console.log("1. Migrando tabla trayectos...");
  const trayectosCols = await getOldColumns("trayectos");
  const trayectoIdCol = trayectosCols.find((c) => c.name === "id");

  if (trayectoIdCol && trayectoIdCol.type.toUpperCase().includes("INTEGER")) {
    console.log(
      "   La tabla trayectos tiene ID INTEGER. Creando tabla nueva...",
    );

    // Crear tabla nueva con esquema UUID
    await client.execute(`
      CREATE TABLE IF NOT EXISTS trayectos_new (
        id TEXT PRIMARY KEY,
        origen TEXT NOT NULL,
        destino TEXT NOT NULL,
        hora TEXT NOT NULL,
        plazas INTEGER NOT NULL,
        disponible INTEGER NOT NULL,
        precio REAL NOT NULL,
        conductor TEXT NOT NULL,
        routeIndex INTEGER NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'programado',
        origen_lat REAL NULL,
        origen_lng REAL NULL,
        destino_lat REAL NULL,
        destino_lng REAL NULL,
        notified_15min INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (conductor) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_plazas CHECK (plazas >= 1 AND plazas <= 4),
        CONSTRAINT chk_trayecto_status CHECK (
            status IN ('en curso', 'programado', 'finalizado', 'cancelado')
        )
      )
    `);

    // Copiar datos generando UUIDs
    const oldTrayectos = await client.execute("SELECT * FROM trayectos");
    const trayectoIdMap = new Map(); // oldId -> newUUID

    for (const row of oldTrayectos.rows) {
      const newId = randomUUID();
      trayectoIdMap.set(String(row.id), newId);
      await client.execute({
        sql: `INSERT INTO trayectos_new (id, origen, destino, hora, plazas, disponible, precio, conductor, routeIndex, status, origen_lat, origen_lng, destino_lat, destino_lng, notified_15min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          newId,
          row.origen,
          row.destino,
          row.hora,
          row.plazas,
          row.disponible,
          row.precio,
          String(row.conductor),
          row.routeIndex ?? 0,
          row.status ?? "programado",
          row.origen_lat,
          row.origen_lng,
          row.destino_lat,
          row.destino_lng,
          row.notified_15min ?? 0,
        ],
      });
    }
    console.log(`   ${oldTrayectos.rows.length} trayectos migrados.`);

    // Eliminar trigger que referencia a trayectos antes de dropear la tabla
    try {
      await client.execute(
        "DROP TRIGGER IF EXISTS trg_reservas_after_delete_completed",
      );
    } catch (e) {
      console.log("   (skip) Drop trigger:", e.message);
    }

    // Reemplazar tabla
    await client.execute("DROP TABLE trayectos");
    await client.execute("ALTER TABLE trayectos_new RENAME TO trayectos");
    console.log("   Tabla trayectos reemplazada.\n");

    // ── 2. Migrar reservas ──
    console.log("2. Migrando tabla reservas...");
    const reservasCols = await getOldColumns("reservas");
    const reservaIdCol = reservasCols.find((c) => c.name === "id_reserva");

    if (reservaIdCol && reservaIdCol.type.toUpperCase().includes("INTEGER")) {
      console.log(
        "   La tabla reservas tiene ID INTEGER. Creando tabla nueva...",
      );

      await client.execute(`
        CREATE TABLE IF NOT EXISTS reservas_new (
          id_reserva TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          id_trayecto TEXT NOT NULL,
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
          CONSTRAINT chk_trip_outcome CHECK (
              trip_outcome IN ('pending', 'success', 'issue')
          )
        )
      `);

      const oldReservas = await client.execute("SELECT * FROM reservas");
      for (const row of oldReservas.rows) {
        const newId = randomUUID();
        const newTrayectoId =
          trayectoIdMap.get(String(row.id_trayecto)) ?? String(row.id_trayecto);
        await client.execute({
          sql: `INSERT OR IGNORE INTO reservas_new (id_reserva, user_id, id_trayecto, status, stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_intent_status, trip_outcome, trip_outcome_reason, trip_outcome_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            newId,
            String(row.user_id),
            newTrayectoId,
            row.status ?? "pending",
            row.stripe_checkout_session_id ?? null,
            row.stripe_payment_intent_id ?? null,
            row.stripe_payment_intent_status ?? null,
            row.trip_outcome ?? "pending",
            row.trip_outcome_reason ?? null,
            row.trip_outcome_at ?? null,
          ],
        });
      }
      console.log(`   ${oldReservas.rows.length} reservas migradas.`);

      await client.execute("DROP TABLE reservas");
      await client.execute("ALTER TABLE reservas_new RENAME TO reservas");
      console.log("   Tabla reservas reemplazada.\n");
    } else {
      console.log("   La tabla reservas ya usa TEXT. Saltando.\n");
    }

    // ── 3. Migrar comments ──
    console.log("3. Migrando tabla comments...");
    const commentsCols = await getOldColumns("comments");
    const commentIdCol = commentsCols.find((c) => c.name === "id_comment");

    if (commentIdCol && commentIdCol.type.toUpperCase().includes("INTEGER")) {
      console.log(
        "   La tabla comments tiene ID INTEGER. Creando tabla nueva...",
      );

      await client.execute(`
        CREATE TABLE IF NOT EXISTS comments_new (
          id_comment TEXT PRIMARY KEY,
          user_id_commentator TEXT NOT NULL,
          user_id_trayect TEXT NOT NULL,
          id_trayecto TEXT NOT NULL,
          opinion TEXT,
          rating INTEGER,
          FOREIGN KEY(user_id_commentator) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(user_id_trayect) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(id_trayecto) REFERENCES trayectos(id) ON DELETE CASCADE,
          UNIQUE(user_id_commentator, id_trayecto),
          CONSTRAINT chk_opinion_rating CHECK (rating >= 1 AND rating <= 10)
        )
      `);

      const oldComments = await client.execute("SELECT * FROM comments");
      for (const row of oldComments.rows) {
        const newId = randomUUID();
        const newTrayectoId =
          trayectoIdMap.get(String(row.id_trayecto)) ?? String(row.id_trayecto);
        await client.execute({
          sql: `INSERT OR IGNORE INTO comments_new (id_comment, user_id_commentator, user_id_trayect, id_trayecto, opinion, rating) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            newId,
            String(row.user_id_commentator),
            String(row.user_id_trayect),
            newTrayectoId,
            row.opinion ?? null,
            row.rating ?? null,
          ],
        });
      }
      console.log(`   ${oldComments.rows.length} comentarios migrados.`);

      await client.execute("DROP TABLE comments");
      await client.execute("ALTER TABLE comments_new RENAME TO comments");
      console.log("   Tabla comments reemplazada.\n");
    } else {
      console.log("   La tabla comments ya usa TEXT. Saltando.\n");
    }
  } else {
    console.log(
      "   La tabla trayectos ya usa TEXT. No se necesita migración de trayectos.\n",
    );
  }

  // ── 4. Migrar ubicaciones ──
  console.log("4. Migrando tabla ubicaciones...");
  const ubicacionesCols = await getOldColumns("ubicaciones");
  const ubicacionIdCol = ubicacionesCols.find((c) => c.name === "id");

  if (ubicacionIdCol && ubicacionIdCol.type.toUpperCase().includes("INTEGER")) {
    console.log(
      "   La tabla ubicaciones tiene ID INTEGER. Creando tabla nueva...",
    );

    await client.execute(`
      CREATE TABLE IF NOT EXISTS ubicaciones_new (
        id TEXT PRIMARY KEY,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        display_name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT,
        province TEXT,
        country TEXT,
        postal_code TEXT,
        type TEXT,
        user_id TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, address)
      )
    `);

    const oldUbicaciones = await client.execute("SELECT * FROM ubicaciones");
    for (const row of oldUbicaciones.rows) {
      const newId = randomUUID();
      await client.execute({
        sql: `INSERT OR IGNORE INTO ubicaciones_new (id, lat, lng, display_name, address, city, province, country, postal_code, type, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          newId,
          row.lat,
          row.lng,
          row.display_name,
          row.address,
          row.city ?? null,
          row.province ?? null,
          row.country ?? null,
          row.postal_code ?? null,
          row.type ?? null,
          String(row.user_id),
        ],
      });
    }
    console.log(`   ${oldUbicaciones.rows.length} ubicaciones migradas.`);

    await client.execute("DROP TABLE ubicaciones");
    await client.execute("ALTER TABLE ubicaciones_new RENAME TO ubicaciones");
    console.log("   Tabla ubicaciones reemplazada.\n");
  } else {
    console.log("   La tabla ubicaciones ya usa TEXT. Saltando.\n");
  }

  // ── 5. Migrar frequents_routes ──
  console.log("5. Migrando tabla frequents_routes...");
  const freqCols = await getOldColumns("frequents_routes");
  const freqIdCol = freqCols.find((c) => c.name === "id");

  if (freqIdCol && freqIdCol.type.toUpperCase().includes("INTEGER")) {
    console.log(
      "   La tabla frequents_routes tiene ID INTEGER. Creando tabla nueva...",
    );

    await client.execute(`
      CREATE TABLE IF NOT EXISTS frequents_routes_new (
        id TEXT PRIMARY KEY,
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
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    const oldRoutes = await client.execute("SELECT * FROM frequents_routes");
    for (const row of oldRoutes.rows) {
      const newId = randomUUID();
      await client.execute({
        sql: `INSERT OR IGNORE INTO frequents_routes_new (id, createdAt, updatedAt, user_id, name, originAddress, originLat, originLng, destAddress, destLat, destLng, role, seats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          newId,
          row.createdAt ?? new Date().toISOString(),
          row.updatedAt ?? new Date().toISOString(),
          String(row.user_id),
          row.name ?? null,
          row.originAddress,
          row.originLat,
          row.originLng,
          row.destAddress,
          row.destLat,
          row.destLng,
          row.role ?? "DRIVER",
          row.seats ?? 1,
        ],
      });
    }
    console.log(`   ${oldRoutes.rows.length} rutas frecuentes migradas.`);

    await client.execute("DROP TABLE frequents_routes");
    await client.execute(
      "ALTER TABLE frequents_routes_new RENAME TO frequents_routes",
    );
    console.log("   Tabla frequents_routes reemplazada.\n");
  } else {
    console.log("   La tabla frequents_routes ya usa TEXT. Saltando.\n");
  }

  // ── 6. Recrear índices ──
  console.log("6. Recreando índices...");
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_trayectos_origen ON trayectos(origen_lat, origen_lng)",
    "CREATE INDEX IF NOT EXISTS idx_trayectos_destino ON trayectos(destino_lat, destino_lng)",
    "CREATE INDEX IF NOT EXISTS idx_trayectos_hora ON trayectos(hora)",
    "CREATE INDEX IF NOT EXISTS idx_reservas_trayecto ON reservas(id_trayecto)",
    "CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_preferences_pref_key ON user_preferences(pref_key)",
  ];
  for (const idx of indexes) {
    try {
      await client.execute(idx);
    } catch (e) {
      console.log(`   (skip) ${idx}: ${e.message}`);
    }
  }
  console.log("   Índices recreados.\n");

  // ── 7. Recrear trigger ──
  console.log("7. Recreando trigger trg_reservas_after_delete_completed...");
  try {
    await client.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_reservas_after_delete_completed
            AFTER DELETE ON reservas
            WHEN OLD.status = 'completed'
        BEGIN
            UPDATE trayectos
            SET disponible = disponible + 1
            WHERE id = OLD.id_trayecto;
        END
    `);
    console.log("   Trigger recreado.\n");
  } catch (e) {
    console.log(`   Error recreando trigger: ${e.message}\n`);
  }

  await client.execute("PRAGMA foreign_keys = ON");
  console.log("=== Migración a UUID completada ===");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Error durante la migración:", err);
  process.exit(1);
});
