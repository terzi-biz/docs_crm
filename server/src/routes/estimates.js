import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { parseEstimateFile } from "../services/estimateParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 20 * 1024 * 1024 } });

const router = express.Router();

router.post("/:objectId/upload", requireAuth, upload.single("file"), async (req, res) => {
  const obj = db.prepare("SELECT * FROM objects WHERE id = ?").get(req.params.objectId);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  if (!req.file) return res.status(400).json({ error: "Файл не завантажено" });

  try {
    const parsed = await parseEstimateFile(req.file.path, req.file.originalname);
    const result = db
      .prepare(
        `INSERT INTO estimates (object_id, source_filename, materials_json, works_json, materials_total, works_total, grand_total, status)
         VALUES (?,?,?,?,?,?,?, 'pending_review')`
      )
      .run(
        obj.id,
        req.file.originalname,
        JSON.stringify(parsed.materials),
        JSON.stringify(parsed.works),
        parsed.materials_total,
        parsed.works_total,
        parsed.grand_total
      );
    const estimate = db.prepare("SELECT * FROM estimates WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(estimate);
  } catch (e) {
    res.status(400).json({ error: "Не вдалося обробити кошторис: " + e.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

router.get("/:id", requireAuth, (req, res) => {
  const e = db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id);
  if (!e) return res.status(404).json({ error: "Не знайдено" });
  res.json(e);
});

router.put("/:id", requireAuth, (req, res) => {
  const { materials, works, status } = req.body;
  const existing = db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Не знайдено" });

  const materials_total = round2((materials || JSON.parse(existing.materials_json)).reduce((s, m) => s + Number(m.sum || 0), 0));
  const works_total = round2((works || JSON.parse(existing.works_json)).reduce((s, w) => s + Number(w.sum || 0), 0));

  db.prepare(
    `UPDATE estimates SET materials_json = ?, works_json = ?, materials_total = ?, works_total = ?, grand_total = ?, status = ? WHERE id = ?`
  ).run(
    JSON.stringify(materials || JSON.parse(existing.materials_json)),
    JSON.stringify(works || JSON.parse(existing.works_json)),
    materials_total,
    works_total,
    round2(materials_total + works_total),
    status || existing.status,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id));
});

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default router;
