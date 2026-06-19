import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "templates", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 20 * 1024 * 1024 } });

const TYPES = ["contract", "estimate", "invoice", "act", "commercial_offer"];

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT templates.*, users.name as created_by_name FROM templates
       LEFT JOIN users ON users.id = templates.created_by
       ORDER BY type, version DESC`
    )
    .all();
  res.json(rows);
});

router.post("/upload", requireAuth, requireAdmin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Файл не завантажено" });
  const { type, name } = req.body;
  const isActive = req.body.is_active === "true" || req.body.is_active === "1" || req.body.is_active === undefined;

  if (!TYPES.includes(type)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "Невірний тип шаблону" });
  }
  if (!name || !name.trim()) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "Вкажіть назву шаблону" });
  }

  const ext = path.extname(req.file.originalname) || ".docx";
  const storedName = `${type}_${Date.now()}${ext}`;
  const storedPath = path.join(UPLOAD_DIR, storedName);
  fs.renameSync(req.file.path, storedPath);

  const lastVersion = db.prepare("SELECT MAX(version) v FROM templates WHERE type = ?").get(type).v;
  const version = (lastVersion || 0) + 1;

  if (isActive) {
    db.prepare("UPDATE templates SET is_active = 0 WHERE type = ?").run(type);
  }

  const result = db
    .prepare(
      `INSERT INTO templates (type, name, file_path, version, is_active, created_by) VALUES (?,?,?,?,?,?)`
    )
    .run(type, name.trim(), storedPath, version, isActive ? 1 : 0, req.user.id);

  res.status(201).json(db.prepare("SELECT * FROM templates WHERE id = ?").get(result.lastInsertRowid));
});

router.patch("/:id", requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Шаблон не знайдено" });

  if (req.body.is_active === true) {
    db.prepare("UPDATE templates SET is_active = 0 WHERE type = ?").run(existing.type);
  }

  const name = req.body.name !== undefined ? req.body.name : existing.name;
  const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active;

  db.prepare(
    "UPDATE templates SET name = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, isActive, req.params.id);

  res.json(db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id));
});

router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Шаблон не знайдено" });
  db.prepare("UPDATE templates SET is_active = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.get("/:id/download", requireAuth, (req, res) => {
  const tpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!tpl || !fs.existsSync(tpl.file_path)) {
    return res.status(404).json({ error: "Файл шаблону не знайдено" });
  }
  res.download(tpl.file_path, `${tpl.name}.docx`);
});

export default router;
