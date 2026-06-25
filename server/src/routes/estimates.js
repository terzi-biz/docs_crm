import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { parseEstimateFile } from "../services/estimateParser.js";
import { analyzeWithAi, normalizeAndRecalculate, isAiEnabled, aiConfigError } from "../services/aiEstimateAnalyzer.js";
import { advanceStatus } from "../services/statusWorkflow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 20 * 1024 * 1024 } });

const router = express.Router();

const AI_CONFIDENCE_THRESHOLD = 0.6;
const STORED_FILES_DIR = path.join(__dirname, "..", "..", "documents", "_estimate-sources");
fs.mkdirSync(STORED_FILES_DIR, { recursive: true });

/** Parses + (optionally) AI-analyzes a raw estimate file and returns the
 * normalized result plus bookkeeping info (warnings, whether AI was used). */
async function analyzeEstimateFile(filePath, originalName) {
  const parsed = await parseEstimateFile(filePath, originalName);
  let result = normalizeAndRecalculate(parsed);
  let usedAi = false;
  let aiNotice = null;

  const lowConfidence = parsed.parser_confidence < AI_CONFIDENCE_THRESHOLD;
  if (lowConfidence) {
    if (isAiEnabled()) {
      const configError = aiConfigError();
      if (configError) {
        aiNotice = configError;
      } else {
        try {
          result = await analyzeWithAi(parsed.raw_text || "");
          usedAi = true;
        } catch (aiError) {
          aiNotice = "AI-аналіз не вдався: " + aiError.message + ". Використано базовий парсер.";
        }
      }
    } else {
      aiNotice = "AI-анализ отключён. Используется базовый парсер.";
    }
  }

  const warnings = [...result.warnings];
  if (aiNotice) warnings.push(aiNotice);
  if (result.materials.length === 0 && result.works.length === 0) {
    warnings.push(
      "Не удалось автоматически распознать смету. Загрузите другой файл, повторите распознавание или добавьте строки вручную."
    );
  }

  const status = warnings.length > 0 || result.parser_confidence < AI_CONFIDENCE_THRESHOLD
    ? "pending_review"
    : "parsed";

  return { parsed, result, usedAi, warnings, status };
}

router.post("/:objectId/upload", requireAuth, upload.single("file"), async (req, res) => {
  const obj = db.prepare("SELECT * FROM objects WHERE id = ?").get(req.params.objectId);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  if (!req.file) return res.status(400).json({ error: "Файл не завантажено" });

  try {
    const { parsed, result, usedAi, warnings, status } = await analyzeEstimateFile(
      req.file.path,
      req.file.originalname
    );

    const storedName = `${obj.id}_${Date.now()}_${req.file.originalname}`;
    const storedPath = path.join(STORED_FILES_DIR, storedName);
    fs.copyFileSync(req.file.path, storedPath);

    const lastVersion = db
      .prepare("SELECT MAX(version) v FROM estimates WHERE object_id = ?")
      .get(obj.id).v;
    const version = (lastVersion || 0) + 1;
    db.prepare("UPDATE estimates SET is_active = 0 WHERE object_id = ?").run(obj.id);

    const insert = db
      .prepare(
        `INSERT INTO estimates (object_id, source_filename, source_file_path, raw_text, raw_json, materials_json, works_json, materials_total, works_total, grand_total, parser_confidence, warnings_json, status, version, is_active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
      )
      .run(
        obj.id,
        req.file.originalname,
        storedPath,
        (parsed.raw_text || "").slice(0, 100000),
        JSON.stringify({ usedAi }),
        JSON.stringify(result.materials),
        JSON.stringify(result.works),
        result.materials_total,
        result.works_total,
        result.grand_total,
        result.parser_confidence,
        JSON.stringify(warnings),
        status,
        version
      );

    advanceStatus(obj.id, "Кошторис завантажено");
    if (status === "parsed" || (result.materials.length || result.works.length)) {
      advanceStatus(obj.id, "Кошторис розпізнано");
    }

    const estimate = db.prepare("SELECT * FROM estimates WHERE id = ?").get(insert.lastInsertRowid);
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

router.get("/object/:objectId/latest", requireAuth, (req, res) => {
  const e = db
    .prepare("SELECT * FROM estimates WHERE object_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(req.params.objectId);
  if (!e) return res.status(404).json({ error: "Кошторис ще не завантажено" });
  res.json(e);
});

router.post("/:id/reanalyze", requireAuth, async (req, res) => {
  const existing = db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Не знайдено" });
  if (existing.status === "confirmed") {
    return res.status(400).json({ error: "Кошторис вже підтверджено. Завантажте новий файл для змін." });
  }
  if (!existing.source_file_path || !fs.existsSync(existing.source_file_path)) {
    return res.status(400).json({ error: "Вихідний файл сметы не знайдено для повторного аналізу." });
  }

  try {
    const { result, usedAi, warnings, status } = await analyzeEstimateFile(
      existing.source_file_path,
      existing.source_filename || "estimate"
    );

    db.prepare(
      `UPDATE estimates SET raw_json = ?, materials_json = ?, works_json = ?, materials_total = ?, works_total = ?, grand_total = ?, parser_confidence = ?, warnings_json = ?, status = ? WHERE id = ?`
    ).run(
      JSON.stringify({ usedAi }),
      JSON.stringify(result.materials),
      JSON.stringify(result.works),
      result.materials_total,
      result.works_total,
      result.grand_total,
      result.parser_confidence,
      JSON.stringify(warnings),
      status,
      req.params.id
    );

    if (status === "parsed" || result.materials.length || result.works.length) {
      advanceStatus(existing.object_id, "Кошторис розпізнано");
    }

    res.json(db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id));
  } catch (e) {
    res.status(400).json({ error: "Не вдалося повторно проаналізувати кошторис: " + e.message });
  }
});

router.put("/:id", requireAuth, (req, res) => {
  const { materials, works } = req.body;
  const existing = db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Не знайдено" });
  if (existing.status === "confirmed") {
    return res.status(400).json({ error: "Кошторис вже підтверджено. Завантажте новий файл для змін." });
  }

  const finalMaterials = (materials || JSON.parse(existing.materials_json)).map((m, idx) => ({
    ...m,
    position: idx + 1,
    sum: Math.round((Number(m.quantity) || 0) * (Number(m.price) || 0) * 100) / 100,
  }));
  const finalWorks = (works || JSON.parse(existing.works_json)).map((w, idx) => ({
    ...w,
    position: idx + 1,
    sum: Math.round((Number(w.quantity) || 0) * (Number(w.price) || 0) * 100) / 100,
  }));

  const materials_total = round2(finalMaterials.reduce((s, m) => s + m.sum, 0));
  const works_total = round2(finalWorks.reduce((s, w) => s + w.sum, 0));

  db.prepare(
    `UPDATE estimates SET materials_json = ?, works_json = ?, materials_total = ?, works_total = ?, grand_total = ?, status = 'pending_review' WHERE id = ?`
  ).run(
    JSON.stringify(finalMaterials),
    JSON.stringify(finalWorks),
    materials_total,
    works_total,
    round2(materials_total + works_total),
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id));
});

router.post("/:id/confirm", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Не знайдено" });

  const materials = JSON.parse(existing.materials_json);
  const works = JSON.parse(existing.works_json);
  if (materials.length === 0 && works.length === 0) {
    return res.status(400).json({ error: "Неможливо підтвердити порожню смету. Додайте хоча б один рядок." });
  }

  const materials_total = round2(materials.reduce((s, m) => s + Number(m.sum || 0), 0));
  const works_total = round2(works.reduce((s, w) => s + Number(w.sum || 0), 0));

  db.prepare(
    `UPDATE estimates SET materials_total = ?, works_total = ?, grand_total = ?, status = 'confirmed', confirmed_at = datetime('now'), confirmed_by = ? WHERE id = ?`
  ).run(materials_total, works_total, round2(materials_total + works_total), req.user.id, req.params.id);

  advanceStatus(existing.object_id, "Кошторис перевірено");

  res.json(db.prepare("SELECT * FROM estimates WHERE id = ?").get(req.params.id));
});

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default router;
