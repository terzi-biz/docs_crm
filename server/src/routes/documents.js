import express from "express";
import fs from "fs";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import {
  generateContract,
  generateEstimate,
  generateInvoice,
  generateAct,
  generateCommercialOffer,
} from "../services/docGenerator.js";
import { advanceStatus } from "../services/statusWorkflow.js";

const router = express.Router();

const TITLES = {
  contract: "Договір",
  estimate: "Кошторис",
  invoice_advance: "Рахунок на аванс",
  invoice_final: "Рахунок на остаток",
  invoice_full: "Рахунок на 100%",
  act: "Акт виконаних робіт",
  commercial_offer: "Комерційна пропозиція",
};

function getObject(id) {
  return db.prepare("SELECT * FROM objects WHERE id = ?").get(id);
}

function getConfirmedEstimate(objectId) {
  return db
    .prepare("SELECT * FROM estimates WHERE object_id = ? AND status = 'confirmed' ORDER BY created_at DESC LIMIT 1")
    .get(objectId);
}

function estimateDataFromRow(row) {
  return {
    materials: JSON.parse(row.materials_json),
    works: JSON.parse(row.works_json),
    materials_total: row.materials_total,
    works_total: row.works_total,
    grand_total: row.grand_total,
  };
}

function canGenerate(obj, type) {
  if (type === "contract") {
    if (!obj.client_name || !obj.object_address || !obj.contract_date || !obj.work_type) {
      return "Для договору потрібно заповнити клієнта, адресу, дату договору та вид робіт.";
    }
  }
  if (type === "estimate") {
    if (!getConfirmedEstimate(obj.id)) return "Спочатку завантажте та підтвердіть кошторис.";
  }
  if (type.startsWith("invoice_")) {
    if (!obj.total_amount || !obj.payment_mode) return "Заповніть суму та тип оплати перед створенням рахунку.";
  }
  if (type === "act") {
    if (obj.status !== "Роботи виконані" && obj.status !== "Закрито") {
      return "Акт можна створити лише після того, як роботи виконані.";
    }
  }
  return null;
}

/** Runs the actual docx/pdf generation for one document `type` and saves the record. */
async function generateOne(obj, type, userId) {
  let paths;
  let invoiceKind = null;

  if (type === "contract") {
    paths = await generateContract(obj);
  } else if (type === "estimate") {
    const estimateRow = getConfirmedEstimate(obj.id);
    paths = await generateEstimate(obj, estimateDataFromRow(estimateRow));
  } else if (type.startsWith("invoice_")) {
    invoiceKind = type.split("_")[1]; // advance | final | full
    paths = await generateInvoice(obj, invoiceKind, obj.contract_number);
  } else if (type === "act") {
    paths = await generateAct(obj);
  } else if (type === "commercial_offer") {
    paths = await generateCommercialOffer(obj);
  } else {
    throw new Error("Невідомий тип документа: " + type);
  }

  const dbType = type.startsWith("invoice_") ? "invoice" : type;
  const lastVersion = db
    .prepare("SELECT MAX(version) v FROM documents WHERE object_id = ? AND type = ? AND invoice_kind IS ?")
    .get(obj.id, dbType, invoiceKind).v;
  const version = (lastVersion || 0) + 1;

  const result = db
    .prepare(
      `INSERT INTO documents (object_id, template_id, type, invoice_kind, title, version, docx_path, pdf_path, status, warnings_json, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      obj.id,
      paths.templateId || null,
      dbType,
      invoiceKind,
      TITLES[type] || dbType,
      version,
      paths.docxPath,
      paths.pdfPath,
      paths.pdfPath ? "created" : "created_no_pdf",
      JSON.stringify(paths.warnings || []),
      userId
    );

  advanceStatus(obj.id, "Документи створено");
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(result.lastInsertRowid);
}

router.post("/:objectId/generate", requireAuth, async (req, res) => {
  const obj = getObject(req.params.objectId);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  const { type } = req.body;
  if (!type || !TITLES[type]) return res.status(400).json({ error: "Невірний тип документа" });

  const blockReason = canGenerate(obj, type);
  if (blockReason) return res.status(400).json({ error: blockReason });

  try {
    const record = await generateOne(obj, type, req.user.id);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:objectId/generate-package", requireAuth, async (req, res) => {
  const obj = getObject(req.params.objectId);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  if (!getConfirmedEstimate(obj.id)) {
    return res.status(400).json({ error: "Спочатку завантажте та підтвердіть кошторис." });
  }
  const contractIssue = canGenerate(obj, "contract");
  if (contractIssue) return res.status(400).json({ error: contractIssue });

  const invoiceType =
    obj.payment_mode === "full" ? "invoice_full" : "invoice_advance";

  try {
    const contract = await generateOne(obj, "contract", req.user.id);
    const estimate = await generateOne(obj, "estimate", req.user.id);
    const invoice = await generateOne(obj, invoiceType, req.user.id);
    res.status(201).json({ contract, estimate, invoice });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/object/:objectId", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT documents.*, users.name as created_by_name FROM documents
       LEFT JOIN users ON users.id = documents.created_by
       WHERE object_id = ? ORDER BY documents.created_at DESC`
    )
    .all(req.params.objectId);
  res.json(rows);
});

router.get("/:id/download/:format", requireAuth, (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Документ не знайдено" });
  const filePath = req.params.format === "pdf" ? doc.pdf_path : doc.docx_path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Файл не знайдено на сервері" });
  }
  res.download(filePath);
});

export default router;
