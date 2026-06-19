import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "data.sqlite");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('administrator','manager')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keycrm_deal_number TEXT NOT NULL UNIQUE,
  contract_number TEXT NOT NULL,
  contract_date TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  client_passport TEXT,
  object_address TEXT NOT NULL,
  object_area REAL,
  work_type TEXT,
  screed_thickness TEXT,
  work_duration TEXT,
  manager_name TEXT,
  notes TEXT,
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('advance_final','full')) DEFAULT 'advance_final',
  advance_payment REAL DEFAULT 0,
  final_payment REAL DEFAULT 0,
  full_payment_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Новий об''єкт',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  source_filename TEXT,
  raw_text TEXT,
  raw_json TEXT,
  materials_json TEXT NOT NULL DEFAULT '[]',
  works_json TEXT NOT NULL DEFAULT '[]',
  materials_total REAL DEFAULT 0,
  works_total REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  parser_confidence REAL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT,
  confirmed_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('contract','estimate','invoice')),
  invoice_kind TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  docx_path TEXT,
  pdf_path TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// --- Lightweight migrations for columns added after initial release ---
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("estimates", "raw_text", "raw_text TEXT");
ensureColumn("estimates", "raw_json", "raw_json TEXT");
ensureColumn("estimates", "parser_confidence", "parser_confidence REAL DEFAULT 0");
ensureColumn("estimates", "warnings_json", "warnings_json TEXT NOT NULL DEFAULT '[]'");
ensureColumn("estimates", "confirmed_at", "confirmed_at TEXT");
ensureColumn("estimates", "confirmed_by", "confirmed_by INTEGER REFERENCES users(id)");
ensureColumn("documents", "created_by", "created_by INTEGER REFERENCES users(id)");

// Seed default work types
const workTypeCount = db.prepare("SELECT COUNT(*) c FROM work_types").get().c;
if (workTypeCount === 0) {
  const insert = db.prepare("INSERT INTO work_types (name) VALUES (?)");
  ["Полусуха стяжка", "ПВХ покрівля", "Рубероїдна покрівля", "Комбінований об'єкт"].forEach((n) =>
    insert.run(n)
  );
}

// Seed default users (3 managers + 1 admin) if none exist
const userCount = db.prepare("SELECT COUNT(*) c FROM users").get().c;
if (userCount === 0) {
  const insert = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)"
  );
  const defaultHash = bcrypt.hashSync("changeme123", 10);
  insert.run("Administrator", "admin@terzi.biz", defaultHash, "administrator");
  insert.run("Менеджер 1", "manager1@terzi.biz", defaultHash, "manager");
  insert.run("Менеджер 2", "manager2@terzi.biz", defaultHash, "manager");
  insert.run("Менеджер 3", "manager3@terzi.biz", defaultHash, "manager");
}
