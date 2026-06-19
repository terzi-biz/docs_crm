import XLSX from "xlsx";
import fs from "fs";

// Two foremen produce estimates in different layouts, so this parser uses
// heuristics rather than assuming a fixed table shape: it scans rows for a
// "МАТЕРІАЛИ" / "РОБОТИ" section marker, then treats any row with a numeric
// quantity+price (or quantity+sum) as a line item until the next section or
// a "разом/всього/итого" total row.

const MATERIAL_MARKERS = ["матеріал", "материал"];
const WORK_MARKERS = ["робот", "работ", "послуг"];
const TOTAL_MARKERS = ["разом", "всього", "итого", "сума", "загальн"];

function isMarkerRow(text, markers) {
  const t = text.toLowerCase();
  return markers.some((m) => t.includes(m));
}

function toNumber(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/\s/g, "").replace(/,/g, ".").replace(/[^\d.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function rowToArray(row) {
  return Array.isArray(row) ? row : Object.values(row);
}

function parseSection(rows, startIdx) {
  const items = [];
  let i = startIdx;
  let position = 1;
  for (; i < rows.length; i++) {
    const cells = rowToArray(rows[i]).map((c) => (c === undefined ? "" : c));
    const rowText = cells.join(" ").trim();
    if (!rowText) continue;
    if (isMarkerRow(rowText, MATERIAL_MARKERS) || isMarkerRow(rowText, WORK_MARKERS)) break;
    if (isMarkerRow(rowText, TOTAL_MARKERS)) {
      i++;
      break;
    }
    const numbers = cells.map(toNumber);
    const numericCells = numbers.filter((n) => n !== null);
    if (numericCells.length < 2) continue; // need at least qty + price/sum

    const nameCell = cells.find((c) => typeof c === "string" && c.trim().length > 1 && toNumber(c) === null);
    if (!nameCell) continue;

    // Heuristic: last numeric = sum, second-to-last numeric = price, before that = quantity
    const lastThree = numericCells.slice(-3);
    let quantity = null, price = null, sum = null;
    if (lastThree.length === 3) [quantity, price, sum] = lastThree;
    else if (lastThree.length === 2) {
      [quantity, sum] = lastThree;
      price = quantity ? sum / quantity : sum;
    } else if (lastThree.length === 1) {
      sum = lastThree[0];
      quantity = 1;
      price = sum;
    }

    const unitCell = cells.find(
      (c) => typeof c === "string" && c.trim().length > 0 && c.trim().length <= 12 && toNumber(c) === null && c !== nameCell
    );

    items.push({
      position: position++,
      name: String(nameCell).trim(),
      unit: unitCell ? String(unitCell).trim() : "",
      quantity: quantity ?? 0,
      price: Math.round((price ?? 0) * 100) / 100,
      sum: Math.round((sum ?? 0) * 100) / 100,
    });
  }
  return { items, nextIdx: i };
}

export function parseXlsxEstimate(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let materials = [];
  let works = [];

  for (let i = 0; i < rows.length; i++) {
    const rowText = rowToArray(rows[i]).join(" ").trim();
    if (!rowText) continue;
    if (isMarkerRow(rowText, MATERIAL_MARKERS) && materials.length === 0) {
      const { items, nextIdx } = parseSection(rows, i + 1);
      materials = items;
      i = nextIdx - 1;
    } else if (isMarkerRow(rowText, WORK_MARKERS) && works.length === 0) {
      const { items, nextIdx } = parseSection(rows, i + 1);
      works = items;
      i = nextIdx - 1;
    }
  }

  // Fallback: no explicit section markers found — treat the whole sheet as works
  if (materials.length === 0 && works.length === 0) {
    const { items } = parseSection(rows, 0);
    works = items;
  }

  return buildResult(materials, works);
}

export async function parsePdfEstimate(filePath) {
  const pdfParse = (await import("pdf-parse")).default;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  const lines = data.text.split("\n").map((l) => l.trim()).filter(Boolean);

  const rows = lines.map((line) => line.split(/\s{2,}|\t/).filter(Boolean));

  let materials = [];
  let works = [];
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].join(" ");
    if (isMarkerRow(rowText, MATERIAL_MARKERS) && materials.length === 0) {
      const { items, nextIdx } = parseSection(rows, i + 1);
      materials = items;
      i = nextIdx - 1;
    } else if (isMarkerRow(rowText, WORK_MARKERS) && works.length === 0) {
      const { items, nextIdx } = parseSection(rows, i + 1);
      works = items;
      i = nextIdx - 1;
    }
  }

  if (materials.length === 0 && works.length === 0) {
    const { items } = parseSection(rows, 0);
    works = items;
  }

  return buildResult(materials, works);
}

function buildResult(materials, works) {
  const materials_total = round2(materials.reduce((s, m) => s + m.sum, 0));
  const works_total = round2(works.reduce((s, w) => s + w.sum, 0));
  return {
    materials,
    works,
    materials_total,
    works_total,
    grand_total: round2(materials_total + works_total),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function parseEstimateFile(filePath, originalName) {
  const ext = originalName.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xls") return parseXlsxEstimate(filePath);
  if (ext === "pdf") return parsePdfEstimate(filePath);
  throw new Error("Unsupported estimate file format: " + ext);
}
