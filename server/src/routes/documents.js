import express from "express";
import fs from "fs";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { generateContract, generateEstimate, generateInvoice } from "../services/docGenerator.js";
import { advanceStatus } from "../services/statusWorkflow.js";

const router = express.Router();

function getObject(id) {
  return db.prepare("SELECT * FROM objects WHERE id = ?").get(id);
}

function getConfirmedEstimate(objectId) {
  return db
    .prepare("SELECT * FROM estimates WHERE object_id = ? AND status = 'confirmed' ORDER BY created_at DESC LIMIT 1")
    .get(objectId);
}

function saveDocRecord(objectId, type, paths, invoiceKind, userId) {
  const lastVersion = db
    .prepare("SELECT MAX(version) v FROM documents WHERE object_id = ? AND type = ?")
    .get(objectId, type).v;
  const version = (lastVersion || 0) + 1;
  const result = db
    .prepare(
      `INSERT INTO documents (object_id, type, invoice_kind, version, docx_path, pdf_path, created_by) VALUES (?,?,?,?,?,?,?)`
    )
    .run(objectId, type, invoiceKind || null, version, paths.docxPath, paths.pdfPath, userId || null);
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(result.lastInsertRowid);
}

router.post("/:objectId/contract", requireAuth, async (req, res) => {
  const obj = getObject(req.params.objectId);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  try {
    const paths = await generateContract(obj);
    const record = saveDocRecord(obj.id, "contract", paths, null, req.user.id);
    advanceStatus(obj.id, "Документи створено");
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:objectId/estimate", requireAuth, async (req, res) => {
  const obj = getObject(req.params.objectId);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  const estimateRow = getConfirmedEstimate(obj.id);
  if (!estimateRow) return res.status(400).json({ error: "Спочатку завантажте та підтвердіть кошторис" });

  const estimate = {
    materials: JSON.parse(estimateRow.materials_json),
    works: JSON.parse(estimateRow.works_json),
    materials_total: estimateRow.materials_total,
    works_total: estimateRow.works_total,
    grand_total: estimateRow.grand_total,
  };

  try {
    const paths = await generateEstimate(obj, estimate);
    const record = saveDocRecord(obj.id, "estimate", paths, null, req.user.id);
    advanceStatus(obj.id, "Документи створено");
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:objectId/invoice", requireAuth, async (req, res) => {
  const obj = getObject(req.params.objectId);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  const kind = req.body.kind || (obj.payment_mode === "full" ? "full" : "advance");
  if (!["advance", "final", "full"].includes(kind)) {
    return res.status(400).json({ error: "Невірний тип рахунку" });
  }
  try {
    const invoiceNumber = obj.contract_number;
    const paths = await generateInvoice(obj, kind, invoiceNumber);
    const record = saveDocRecord(obj.id, "invoice", paths, kind, req.user.id);
    advanceStatus(obj.id, "Документи створено");
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:objectId/package", requireAuth, async (req, res) => {
  const obj = getObject(req.params.objectId);
  if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
  const estimateRow = getConfirmedEstimate(obj.id);
  if (!estimateRow) return res.status(400).json({ error: "Спочатку завантажте та підтвердіть кошторис" });

  try {
    const contractPaths = await generateContract(obj);
    const contractDoc = saveDocRecord(obj.id, "contract", contractPaths, null, req.user.id);

    const estimate = {
      materials: JSON.parse(estimateRow.materials_json),
      works: JSON.parse(estimateRow.works_json),
      materials_total: estimateRow.materials_total,
      works_total: estimateRow.works_total,
      grand_total: estimateRow.grand_total,
    };
    const estimatePaths = await generateEstimate(obj, estimate);
    const estimateDoc = saveDocRecord(obj.id, "estimate", estimatePaths, null, req.user.id);

    const invoiceKind = obj.payment_mode === "full" ? "full" : "advance";
    const invoicePaths = await generateInvoice(obj, invoiceKind, obj.contract_number);
    const invoiceDoc = saveDocRecord(obj.id, "invoice", invoicePaths, invoiceKind, req.user.id);

    advanceStatus(obj.id, "Документи створено");

    res.status(201).json({ contract: contractDoc, estimate: estimateDoc, invoice: invoiceDoc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
