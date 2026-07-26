const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'vestot.db');

// Ensure the directory for the database file exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better read concurrency
db.pragma('journal_mode = WAL');

// Enable foreign key constraint enforcement
db.pragma('foreign_keys = ON');

// Apply schema migration on first run
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    posek TEXT NOT NULL DEFAULT 'rama',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cycle_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    start_rd INTEGER NOT NULL,
    start_heb_year INTEGER NOT NULL,
    start_heb_month INTEGER NOT NULL,
    start_heb_day INTEGER NOT NULL,
    onah TEXT NOT NULL CHECK (onah IN ('day', 'night')),
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS veset_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source_record_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('haflagah', 'hachodesh', 'onah_beinonit')),
    date TEXT NOT NULL,
    date_rd INTEGER NOT NULL,
    heb_year INTEGER NOT NULL,
    heb_month INTEGER NOT NULL,
    heb_day INTEGER NOT NULL,
    onah TEXT NOT NULL CHECK (onah IN ('day', 'night')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_record_id) REFERENCES cycle_records(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_cycle_records_user ON cycle_records(user_id, start_rd);
  CREATE INDEX IF NOT EXISTS idx_veset_dates_user ON veset_dates(user_id, date_rd);
`);

// Migration: add halachic settings columns to users table
try {
  db.exec(`ALTER TABLE users ADD COLUMN onah_beinonit_31 INTEGER NOT NULL DEFAULT 1`);
} catch(e) {} // column may already exist
try {
  db.exec(`ALTER TABLE users ADD COLUMN or_zarua INTEGER NOT NULL DEFAULT 1`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN haflagah_shlishit INTEGER NOT NULL DEFAULT 1`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN hachodesh_overflow INTEGER NOT NULL DEFAULT 0`);
} catch(e) {}

// Migration: add api_key column to users table
try {
  db.exec(`ALTER TABLE users ADD COLUMN api_key TEXT`);
} catch(e) {} // column may already exist
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key) WHERE api_key IS NOT NULL`);
} catch(e) {}

// Migration: recreate veset_dates without restrictive CHECK on type, add is_or_zarua column
const hasOldCheck = db.prepare("SELECT sql FROM sqlite_master WHERE name='veset_dates'").get();
if (hasOldCheck && hasOldCheck.sql && hasOldCheck.sql.includes("CHECK (type IN ('haflagah', 'hachodesh', 'onah_beinonit'))")) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS veset_dates_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      source_record_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      date_rd INTEGER NOT NULL,
      heb_year INTEGER NOT NULL,
      heb_month INTEGER NOT NULL,
      heb_day INTEGER NOT NULL,
      onah TEXT NOT NULL CHECK (onah IN ('day', 'night')),
      is_or_zarua INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (source_record_id) REFERENCES cycle_records(id) ON DELETE CASCADE
    );
    INSERT INTO veset_dates_new (id, user_id, source_record_id, type, date, date_rd, heb_year, heb_month, heb_day, onah, is_or_zarua)
      SELECT id, user_id, source_record_id, type, date, date_rd, heb_year, heb_month, heb_day, onah, 0 FROM veset_dates;
    DROP TABLE veset_dates;
    ALTER TABLE veset_dates_new RENAME TO veset_dates;
    CREATE INDEX IF NOT EXISTS idx_veset_dates_user ON veset_dates(user_id, date_rd);
  `);
} else {
  // If table already migrated, just ensure is_or_zarua column exists
  try {
    db.exec(`ALTER TABLE veset_dates ADD COLUMN is_or_zarua INTEGER NOT NULL DEFAULT 0`);
  } catch(e) {}
}

module.exports = db;
