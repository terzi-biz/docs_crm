import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { execFile } from "child_process";
import { db } from "../db/index.js";
import { amountToWordsUA } from "./numberToWords.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const DOCUMENTS_DIR = path.join(__dirname, "..", "..", "documents");

// Fallback templates shipped with the app, used only until an administrator
// uploads a real one in "Шаблони документів" (templates table).
const BUNDLED_TEMPLATE_FILES = {
  contract: "contract.docx",
  estimate: "estimate.docx",
  invoice: "invoice.docx",
};

const MONTHS_UA = [
  "Січня", "Лютого", "Березня", "Квітня", "Травня", "Червня",
  "Липня", "Серпня", "Вересня", "Жовтня", "Листопада", "Грудня",
];

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateParts(isoDate) {
  const d = new Date(isoDate);
  return {
    contract_day: String(d.getDate()).padStart(2, "0"),
    contract_month: MONTHS_UA[d.getMonth()],
    contract_year: d.getFullYear(),
  };
}

export function objectDir(obj) {
  const year = new Date(obj.contract_date).getFullYear();
  return path.join(DOCUMENTS_DIR, String(year), String(obj.contract_number));
}

/** Returns { filePath, templateId } — the active uploaded template for `type`,
 * or the bundled built-in one if the admin hasn't uploaded a replacement yet. */
export function resolveTemplate(type) {
  const row = db
    .prepare("SELECT * FROM templates WHERE type = ? AND is_active = 1 ORDER BY version DESC LIMIT 1")
    .get(type);
  if (row && fs.existsSync(row.file_path)) {
    return { filePath: row.file_path, templateId: row.id };
  }
  const bundled = BUNDLED_TEMPLATE_FILES[type];
  if (bundled) {
    return { filePath: path.join(BUNDLED_TEMPLATES_DIR, bundled), templateId: null };
  }
  throw new Error(
    "Для цього типу документа не вибрано активний шаблон. Завантажте шаблон у розділі 'Шаблони документів'."
  );
}

function renderTemplate(templatePath, data) {
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer" });
}

function convertToPdf(docxPath, outDir) {
  const outputPath = path.join(outDir, path.basename(docxPath, ".docx") + ".pdf");
  return new Promise((resolve, reject) => {
    execFile(
      "soffice",
      ["--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath],
      { timeout: 60000 },
      (err, stdout, stderr) => {
        // soffice sometimes exits 0 without producing the file (e.g. sandboxed
        // environments missing rendering dependencies), so verify on disk too.
        if (err || !fs.existsSync(outputPath)) {
          return reject(err || new Error(stderr || "PDF file was not produced"));
        }
        resolve(outputPath);
      }
    );
  });
}

function lineItemsTable(items) {
  if (!items.length) return "—";
  return items
    .map(
      (i) =>
        `${i.position}. ${i.name} — ${i.quantity} ${i.unit} x ${fmtMoney(i.price)} = ${fmtMoney(i.sum)} грн`
    )
    .join("\n");
}

function baseData(obj) {
  const { contract_day, contract_month, contract_year } = dateParts(obj.contract_date);
  const isAdvance = obj.payment_mode === "advance_final";
  const today = new Date();
  return {
    contract_number: obj.contract_number,
    keycrm_deal_number: obj.keycrm_deal_number,
    contract_date: obj.contract_date,
    contract_day,
    contract_month,
    contract_year,
    document_date: today.toLocaleDateString("uk-UA"),
    document_number: obj.contract_number,
    client_name: obj.client_name,
    client_phone: obj.client_phone || "",
    client_email: obj.client_email || "",
    client_passport: obj.client_passport || "",
    object_address: obj.object_address,
    object_area: obj.object_area,
    work_type: obj.work_type || "",
    screed_thickness: obj.screed_thickness || "",
    work_duration: obj.work_duration || "",
    manager_name: obj.manager_name || "",
    notes: obj.notes || "",
    payment_mode: obj.payment_mode === "full" ? "100% оплата" : "Аванс + остаточний розрахунок",
    total_amount: fmtMoney(obj.total_amount),
    total_amount_words: amountToWordsUA(obj.total_amount),
    advance_amount: fmtMoney(obj.advance_payment),
    final_amount: fmtMoney(obj.final_payment),
    full_payment_amount: fmtMoney(obj.full_payment_amount),
    is_advance: isAdvance,
    is_full: !isAdvance,
    advance_payment: fmtMoney(obj.advance_payment),
    final_payment: fmtMoney(obj.final_payment),
  };
}

export async function generateContract(obj) {
  const { filePath, templateId } = resolveTemplate("contract");
  const buffer = renderTemplate(filePath, baseData(obj));
  return writeDocAndPdf(obj, "contract", buffer, null, templateId);
}

export async function generateEstimate(obj, estimate) {
  const { filePath, templateId } = resolveTemplate("estimate");
  const materials = estimate.materials.map((m) => ({ ...m, price: fmtMoney(m.price), sum: fmtMoney(m.sum) }));
  const works = estimate.works.map((w) => ({ ...w, price: fmtMoney(w.price), sum: fmtMoney(w.sum) }));
  const data = {
    ...baseData(obj),
    materials,
    works,
    materials_table: lineItemsTable(estimate.materials),
    works_table: lineItemsTable(estimate.works),
    materials_total: fmtMoney(estimate.materials_total),
    works_total: fmtMoney(estimate.works_total),
    grand_total: fmtMoney(estimate.grand_total),
    estimate_date: new Date().toLocaleDateString("uk-UA"),
    payment_label:
      obj.payment_mode === "full"
        ? "ОПЛАТА ПО КОШТОРИСУ — 100%:"
        : "ОПЛАТА ПО КОШТОРИСУ — АВАНС / ОСТАТОК:",
    payment_amount:
      obj.payment_mode === "full" ? fmtMoney(obj.full_payment_amount) : fmtMoney(obj.total_amount),
  };
  const buffer = renderTemplate(filePath, data);
  return writeDocAndPdf(obj, "estimate", buffer, null, templateId);
}

export async function generateInvoice(obj, invoiceKind, invoiceNumber) {
  const { filePath, templateId } = resolveTemplate("invoice");
  const amount =
    invoiceKind === "advance"
      ? obj.advance_payment
      : invoiceKind === "final"
      ? obj.final_payment
      : obj.payment_mode === "full"
      ? obj.full_payment_amount
      : obj.total_amount;

  const purposeMap = {
    advance: `Авансовий платіж за послуги ${obj.work_type || "виконання робіт"}`,
    final: `Оплата остатку за послуги ${obj.work_type || "виконання робіт"}`,
    full: `Оплата (100%) за послуги ${obj.work_type || "виконання робіт"}`,
  };

  const today = new Date();
  const data = {
    ...baseData(obj),
    invoice_number: invoiceNumber,
    invoice_date: today.toLocaleDateString("uk-UA"),
    payment_purpose: purposeMap[invoiceKind] || purposeMap.full,
    work_description: obj.work_type || "Виконання робіт",
    invoice_amount: fmtMoney(amount),
    invoice_amount_words: amountToWordsUA(amount),
  };
  const buffer = renderTemplate(filePath, data);
  return writeDocAndPdf(obj, "invoice", buffer, invoiceKind, templateId);
}

export async function generateAct(obj) {
  const { filePath, templateId } = resolveTemplate("act");
  const buffer = renderTemplate(filePath, baseData(obj));
  return writeDocAndPdf(obj, "act", buffer, null, templateId);
}

export async function generateCommercialOffer(obj) {
  const { filePath, templateId } = resolveTemplate("commercial_offer");
  const buffer = renderTemplate(filePath, baseData(obj));
  return writeDocAndPdf(obj, "commercial_offer", buffer, null, templateId);
}

async function writeDocAndPdf(obj, type, buffer, invoiceKind, templateId) {
  const dir = objectDir(obj);
  fs.mkdirSync(dir, { recursive: true });
  const suffix = invoiceKind ? `_${invoiceKind}` : "";
  const ts = Date.now();
  const docxName = `${type}${suffix}_${ts}.docx`;
  const docxPath = path.join(dir, docxName);
  fs.writeFileSync(docxPath, buffer);

  let pdfPath = null;
  const warnings = [];
  try {
    pdfPath = await convertToPdf(docxPath, dir);
  } catch (e) {
    warnings.push("Не вдалося створити PDF. Доступний лише DOCX-файл.");
    console.error("PDF conversion failed:", e.message);
  }

  return { docxPath, pdfPath, templateId, warnings };
}
