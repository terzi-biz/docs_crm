import express from "express";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const FIELDS = [
  "keycrm_deal_number",
  "contract_date",
  "client_name",
  "client_phone",
  "client_email",
  "client_passport",
  "object_address",
  "object_area",
  "work_type",
  "screed_thickness",
  "work_duration",
  "manager_name",
  "notes",
  "payment_mode",
  "advance_payment",
  "final_payment",
  "full_payment_amount",
];

export const STATUSES = [
  "Новий",
  "Документи підготовлені",
  "Рахунок виставлений",
  "Договір підписаний",
  "Роботи виконані",
  "Закритий",
];

function computeTotal(body) {
  if (body.payment_mode === "full") {
    return Number(body.full_payment_amount) || 0;
  }
  return (Number(body.advance_payment) || 0) + (Number(body.final_payment) || 0);
}

function validate(body) {
  if (!body.keycrm_deal_number?.toString().trim()) return "Номер сделки KeyCRM обов'язковий";
  if (!body.client_name?.trim()) return "ПІБ клієнта обов'язкове";
  if (!body.object_address?.trim()) return "Адреса об'єкту обов'язкова";
  if (!body.contract_date) return "Дата договору обов'язкова";
  if (!["advance_final", "full"].includes(body.payment_mode)) return "Невірний режим оплати";
  return null;
}

router.get("/", requireAuth, (req, res) => {
  const { q, manager, status, dateFrom, dateTo } = req.query;
  let sql = "SELECT * FROM objects WHERE 1=1";
  const params = [];
  if (q) {
    sql += ` AND (contract_number LIKE ? OR keycrm_deal_number LIKE ? OR client_name LIKE ? OR client_phone LIKE ? OR object_address LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (manager) {
    sql += " AND manager_name = ?";
    params.push(manager);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (dateFrom) {
    sql += " AND contract_date >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += " AND contract_date <= ?";
    params.push(dateTo);
  }
  sql += " ORDER BY created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

router.get("/:id", requireAuth, (req, res) => {
  const obj = db.prepare("SELECT * FROM objects WHERE id = ?").get(req.params.id);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  const estimates = db
    .prepare("SELECT * FROM estimates WHERE object_id = ? ORDER BY created_at DESC")
    .all(obj.id);
  const documents = db
    .prepare("SELECT * FROM documents WHERE object_id = ? ORDER BY created_at DESC")
    .all(obj.id);
  res.json({ ...obj, estimates, documents });
});

router.post("/", requireAuth, (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });

  const contract_number = String(req.body.keycrm_deal_number).trim();
  const total_amount = computeTotal(req.body);

  try {
    const result = db
      .prepare(
        `INSERT INTO objects (${FIELDS.join(",")}, contract_number, total_amount, created_by)
         VALUES (${FIELDS.map(() => "?").join(",")}, ?, ?, ?)`
      )
      .run(
        ...FIELDS.map((f) => req.body[f] ?? null),
        contract_number,
        total_amount,
        req.user.id
      );
    const created = db.prepare("SELECT * FROM objects WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Об'єкт з таким номером сделки KeyCRM вже існує" });
    }
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM objects WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Об'єкт не знайдено" });

  const merged = { ...existing, ...req.body };
  const error = validate(merged);
  if (error) return res.status(400).json({ error });

  const contract_number = String(merged.keycrm_deal_number).trim();
  const total_amount = computeTotal(merged);

  db.prepare(
    `UPDATE objects SET ${FIELDS.map((f) => `${f} = ?`).join(",")}, contract_number = ?, total_amount = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(...FIELDS.map((f) => merged[f] ?? null), contract_number, total_amount, req.params.id);

  res.json(db.prepare("SELECT * FROM objects WHERE id = ?").get(req.params.id));
});

router.patch("/:id/status", requireAuth, (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Невірний статус" });
  db.prepare("UPDATE objects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM objects WHERE id = ?").get(req.params.id));
});

export default router;
