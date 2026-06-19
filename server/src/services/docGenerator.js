import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { execFile } from "child_process";
import { amountToWordsUA } from "./numberToWords.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const DOCUMENTS_DIR = path.join(__dirname, "..", "..", "documents");

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

function renderTemplate(templateName, data) {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
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

function baseData(obj) {
  const { contract_day, contract_month, contract_year } = dateParts(obj.contract_date);
  const isAdvance = obj.payment_mode === "advance_final";
  return {
    contract_number: obj.contract_number,
    contract_day,
    contract_month,
    contract_year,
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
    total_amount: fmtMoney(obj.total_amount),
    total_amount_words: amountToWordsUA(obj.total_amount),
    is_advance: isAdvance,
    is_full: !isAdvance,
    advance_payment: fmtMoney(obj.advance_payment),
    final_payment: fmtMoney(obj.final_payment),
    full_payment_amount: fmtMoney(obj.full_payment_amount),
  };
}

export async function generateContract(obj) {
  const buffer = renderTemplate("contract.docx", baseData(obj));
  return writeDocAndPdf(obj, "contract", buffer);
}

export async function generateEstimate(obj, estimate) {
  const data = {
    ...baseData(obj),
    materials: estimate.materials.map((m) => ({
      ...m,
      price: fmtMoney(m.price),
      sum: fmtMoney(m.sum),
    })),
    works: estimate.works.map((w) => ({
      ...w,
      price: fmtMoney(w.price),
      sum: fmtMoney(w.sum),
    })),
    materials_total: fmtMoney(estimate.materials_total),
    works_total: fmtMoney(estimate.works_total),
    grand_total: fmtMoney(estimate.grand_total),
    payment_label:
      obj.payment_mode === "full"
        ? "ОПЛАТА ПО КОШТОРИСУ — 100%:"
        : "ОПЛАТА ПО КОШТОРИСУ — АВАНС / ОСТАТОК:",
    payment_amount:
      obj.payment_mode === "full" ? fmtMoney(obj.full_payment_amount) : fmtMoney(obj.total_amount),
  };
  const buffer = renderTemplate("estimate.docx", data);
  return writeDocAndPdf(obj, "estimate", buffer);
}

export async function generateInvoice(obj, invoiceKind, invoiceNumber) {
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
  const buffer = renderTemplate("invoice.docx", data);
  return writeDocAndPdf(obj, "invoice", buffer, invoiceKind);
}

async function writeDocAndPdf(obj, type, buffer, invoiceKind) {
  const dir = objectDir(obj);
  fs.mkdirSync(dir, { recursive: true });
  const suffix = invoiceKind ? `_${invoiceKind}` : "";
  const ts = Date.now();
  const docxName = `${type}${suffix}_${ts}.docx`;
  const docxPath = path.join(dir, docxName);
  fs.writeFileSync(docxPath, buffer);

  let pdfPath = null;
  try {
    pdfPath = await convertToPdf(docxPath, dir);
  } catch (e) {
    console.error("PDF conversion failed:", e.message);
  }

  return { docxPath, pdfPath };
}
