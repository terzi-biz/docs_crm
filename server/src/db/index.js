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
  template_id INTEGER REFERENCES templates(id),
  type TEXT NOT NULL CHECK(type IN ('contract','estimate','invoice','act','commercial_offer')),
  invoice_kind TEXT,
  title TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  docx_path TEXT,
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('contract','estimate','invoice','act','commercial_offer')),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  group_name TEXT NOT NULL CHECK(group_name IN ('client','object','payment','document','estimate','custom')),
  field_type TEXT NOT NULL CHECK(field_type IN ('text','textarea','number','date','phone','email','select','checkbox')),
  required INTEGER NOT NULL DEFAULT 0,
  placeholder TEXT,
  help_text TEXT,
  validation_rule TEXT,
  options_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS object_custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  custom_field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(object_id, custom_field_id)
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
ensureColumn("documents", "template_id", "template_id INTEGER REFERENCES templates(id)");
ensureColumn("documents", "title", "title TEXT");
ensureColumn("documents", "status", "status TEXT NOT NULL DEFAULT 'created'");
ensureColumn("documents", "warnings_json", "warnings_json TEXT NOT NULL DEFAULT '[]'");
ensureColumn("estimates", "source_file_path", "source_file_path TEXT");
ensureColumn("estimates", "version", "version INTEGER NOT NULL DEFAULT 1");
ensureColumn("estimates", "is_active", "is_active INTEGER NOT NULL DEFAULT 1");

// The documents.type CHECK constraint predates 'act'/'commercial_offer'. SQLite
// can't ALTER a CHECK constraint in place, so rebuild the table if it's stale.
const documentsCheckSql = db
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'")
  .get().sql;
if (documentsCheckSql && !documentsCheckSql.includes("'act'")) {
  db.exec(`
    ALTER TABLE documents RENAME TO documents_old;
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      template_id INTEGER REFERENCES templates(id),
      type TEXT NOT NULL CHECK(type IN ('contract','estimate','invoice','act','commercial_offer')),
      invoice_kind TEXT,
      title TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      docx_path TEXT,
      pdf_path TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      warnings_json TEXT NOT NULL DEFAULT '[]',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO documents (id, object_id, template_id, type, invoice_kind, title, version, docx_path, pdf_path, status, warnings_json, created_by, created_at)
      SELECT id, object_id, template_id, type, invoice_kind, title, version, docx_path, pdf_path, status, warnings_json, created_by, created_at FROM documents_old;
    DROP TABLE documents_old;
  `);
}

// Backfill version/is_active for estimates created before those columns existed:
// each object's most recent estimate (by id) becomes the active one.
db.exec(`
  UPDATE estimates SET is_active = 0 WHERE id NOT IN (
    SELECT MAX(id) FROM estimates GROUP BY object_id
  );
`);

// Seed starter custom fields (Part 5 of the spec) if none exist yet
const customFieldCount = db.prepare("SELECT COUNT(*) c FROM custom_fields").get().c;
if (customFieldCount === 0) {
  const insertField = db.prepare(
    `INSERT INTO custom_fields (key, label, group_name, field_type, required, placeholder, help_text, sort_order)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  const starters = [
    ["client_full_name", "ФІО клієнта", "client", "text", 0, "Іваненко Іван Іванович", "", 1],
    ["client_ipn", "ІПН клієнта", "client", "text", 0, "1234567890", "", 2],
    ["client_edrpou", "ЄДРПОУ клієнта", "client", "text", 0, "12345678", "", 3],
    ["client_legal_address", "Юридична адреса клієнта", "client", "textarea", 0, "м. Київ, вул. ...", "", 4],
    ["client_director", "Директор клієнта", "client", "text", 0, "Іваненко І.І.", "", 5],
    ["client_position", "Посада підписанта", "client", "text", 0, "Директор", "", 6],
    ["client_bank_details", "Банківські реквізити клієнта", "client", "textarea", 0, "IBAN, банк, МФО", "", 7],
    ["object_cadastral_number", "Кадастровий номер об'єкту", "object", "text", 0, "1234567890:01:001:0001", "", 8],
    ["document_basis", "Підстава документа", "document", "text", 0, "Договір №...", "", 9],
    ["document_comment", "Коментар до документа", "document", "textarea", 0, "", "", 10],
  ];
  starters.forEach(([key, label, group_name, field_type, required, placeholder, help_text, sort_order]) =>
    insertField.run(key, label, group_name, field_type, required, placeholder, help_text, sort_order)
  );
}

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
