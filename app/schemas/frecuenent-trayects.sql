PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS frequents_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),

  user_id TEXT NOT NULL,
  name TEXT, -- máximo 50 recomendado a nivel app (SQLite no fuerza VARCHAR)

  originAddress TEXT NOT NULL,
  originLat REAL NOT NULL,
  originLng REAL NOT NULL,

  destAddress TEXT NOT NULL,
  destLat REAL NOT NULL,
  destLng REAL NOT NULL,

--   daysOfWeek TEXT NOT NULL,  -- JSON string, ej: "[1,2,3,4,5]"
--   defaultTime TEXT,          -- ej: "18:00"

  role TEXT NOT NULL DEFAULT 'DRIVER',
  seats INTEGER NOT NULL DEFAULT 1,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  CHECK (role IN ('PASSENGER', 'DRIVER')),
  CHECK (seats >= 1)
);

CREATE INDEX IF NOT EXISTS idx_FrequentRoute_userId ON FrequentRoute(userId);