import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import { db } from "../db/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { SYSTEM_VARIABLES, RECOMMENDED_VARIABLES } from "../services/systemVariables.js";

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

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function extractPlaceholders(docxPath) {
  const content = fs.readFileSync(docxPath, "binary");
  const zip = new PizZip(content);
  const xml = zip.file("word/document.xml")?.asText() || "";
  // Strip XML tags so a {tag} split across separate <w:t> runs still reads as one token.
  const plainText = xml.replace(/<[^>]+>/g, "");
  const simpleVars = new Set();
  for (const m of plainText.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) simpleVars.add(m[1]);
  const loops = new Set();
  for (const m of plainText.matchAll(/\{#([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) loops.add(m[1]);
  return { vars: [...simpleVars], loops: [...loops] };
}

router.post("/:id/validate", requireAuth, requireAdmin, (req, res) => {
  const tpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!tpl || !fs.existsSync(tpl.file_path)) {
    return res.status(404).json({ error: "Файл шаблону не знайдено" });
  }

  let extracted;
  try {
    extracted = extractPlaceholders(tpl.file_path);
  } catch (e) {
    return res.status(400).json({ error: "Не вдалося прочитати DOCX-файл: " + e.message });
  }

  const knownKeys = new Set([
    ...SYSTEM_VARIABLES.map((v) => v.key),
    ...db.prepare("SELECT key FROM custom_fields WHERE is_active = 1").all().map((f) => f.key),
    ...["position", "name", "unit", "quantity", "price", "sum"],
  ]);

  const found = extracted.vars;
  const unknown = found
    .filter((v) => !knownKeys.has(v))
    .map((v) => {
      let bestMatch = null;
      let bestDist = Infinity;
      for (const k of knownKeys) {
        const d = levenshtein(v, k);
        if (d < bestDist) {
          bestDist = d;
          bestMatch = k;
        }
      }
      const suggestion = bestDist <= 2 ? bestMatch : null;
      return {
        variable: v,
        message: suggestion
          ? `Невідома переменна {${v}}. Можливо, ви мали на увазі {${suggestion}}.`
          : `Невідома переменна {${v}}. Створіть її в розділі 'Переменные и поля' або виправте помилку.`,
        suggestion,
      };
    });

  const recommended = RECOMMENDED_VARIABLES[tpl.type] || [];
  const missingRecommended = recommended.filter((v) => !found.includes(v));

  res.json({
    found,
    loops: extracted.loops,
    unknown,
    missingRecommended,
  });
});

router.post("/:id/activate", requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Шаблон не знайдено" });
  db.prepare("UPDATE templates SET is_active = 0 WHERE type = ?").run(existing.type);
  db.prepare("UPDATE templates SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json(db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id));
});

router.get("/:id/download", requireAuth, (req, res) => {
  const tpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!tpl || !fs.existsSync(tpl.file_path)) {
    return res.status(404).json({ error: "Файл шаблону не знайдено" });
  }
  res.download(tpl.file_path, `${tpl.name}.docx`);
});

export default router;
