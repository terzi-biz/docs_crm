import express from "express";
import { db } from "../db/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { SYSTEM_VARIABLES } from "../services/systemVariables.js";

const router = express.Router();

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const GROUPS = ["client", "object", "payment", "document", "estimate", "custom"];
const TYPES = ["text", "textarea", "number", "date", "phone", "email", "select", "checkbox"];

function validate(body, existingId) {
  if (!body.key || !KEY_RE.test(body.key)) {
    return "Ключ повинен бути латиницею в нижньому регістрі, починатись з букви, без пробілів (напр. client_full_name)";
  }
  if (SYSTEM_VARIABLES.some((v) => v.key === body.key)) {
    return `Ключ "${body.key}" вже використовується як системна переменна`;
  }
  const collision = db
    .prepare("SELECT id FROM custom_fields WHERE key = ? AND id != ?")
    .get(body.key, existingId || -1);
  if (collision) return `Поле з ключем "${body.key}" вже існує`;
  if (!body.label || !body.label.trim()) return "Вкажіть назву поля";
  if (!GROUPS.includes(body.group_name)) return "Невірна група поля";
  if (!TYPES.includes(body.field_type)) return "Невірний тип поля";
  return null;
}

router.get("/", requireAuth, (req, res) => {
  res.json(db.prepare("SELECT * FROM custom_fields ORDER BY group_name, sort_order, id").all());
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });

  const result = db
    .prepare(
      `INSERT INTO custom_fields (key, label, group_name, field_type, required, placeholder, help_text, validation_rule, options_json, is_active, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      req.body.key,
      req.body.label.trim(),
      req.body.group_name,
      req.body.field_type,
      req.body.required ? 1 : 0,
      req.body.placeholder || null,
      req.body.help_text || null,
      req.body.validation_rule || null,
      req.body.options_json || null,
      req.body.is_active === false ? 0 : 1,
      req.body.sort_order || 0
    );
  res.status(201).json(db.prepare("SELECT * FROM custom_fields WHERE id = ?").get(result.lastInsertRowid));
});

router.patch("/:id", requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM custom_fields WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Поле не знайдено" });

  const merged = { ...existing, ...req.body };
  const error = validate(merged, existing.id);
  if (error) return res.status(400).json({ error });

  db.prepare(
    `UPDATE custom_fields SET key=?, label=?, group_name=?, field_type=?, required=?, placeholder=?, help_text=?, validation_rule=?, options_json=?, is_active=?, sort_order=?, updated_at=datetime('now')
     WHERE id = ?`
  ).run(
    merged.key,
    merged.label,
    merged.group_name,
    merged.field_type,
    merged.required ? 1 : 0,
    merged.placeholder || null,
    merged.help_text || null,
    merged.validation_rule || null,
    merged.options_json || null,
    merged.is_active ? 1 : 0,
    merged.sort_order || 0,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM custom_fields WHERE id = ?").get(req.params.id));
});

router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM custom_fields WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Поле не знайдено" });
  db.prepare("UPDATE custom_fields SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
