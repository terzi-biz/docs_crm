import XLSX from "xlsx";
import fs from "fs";

// Two foremen produce estimates in different layouts, so this parser uses
// heuristics rather than assuming a fixed table shape: it scans rows for a
// "МАТЕРІАЛИ" / "РОБОТИ" section marker, then treats any row with a numeric
// quantity+price (or quantity+sum) as a line item until the next section or
// a "разом/всього/итого" total row. If the result looks unreliable
// (low confidence), the caller falls back to the AI analyzer.

const MATERIAL_MARKERS = ["матеріал", "материал", "materials"];
const WORK_MARKERS = ["робот", "работ", "послуг", "вартість робіт", "стоимость работ", "work", "services"];
const TOTAL_MARKERS = ["разом", "всього", "итого", "сума", "загальн"];

function isMarkerRow(text, markers) {
  const t = text.toLowerCase();
  return markers.some((m) => t.includes(m));
}

// Strict check for "this cell IS a number", used to classify cells (e.g. to
// tell a name like "Цемент М500" apart from an actual quantity/price cell).
// Unlike toNumber() below, it doesn't strip arbitrary characters first, so
// text containing digits isn't mistaken for a numeric cell.
function isNumericCell(v) {
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "number") return true;
  const trimmed = String(v).trim().replace(/\s/g, "").replace(/,/g, ".");
  return /^-?\d+(\.\d+)?$/.test(trimmed);
}

function toNumber(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return v;
  if (!isNumericCell(v)) return null;
  const cleaned = String(v).replace(/\s/g, "").replace(/,/g, ".").replace(/[^\d.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function rowToArray(row) {
  return Array.isArray(row) ? row : Object.values(row);
}

function parseSection(rows, startIdx, category) {
  const items = [];
  let i = startIdx;
  let position = 1;
  for (; i < rows.length; i++) {
    const cells = rowToArray(rows[i]).map((c) => (c === undefined ? "" : c));
    const rowText = cells.join(" ").trim();
    if (!rowText) continue;
    if (isMarkerRow(rowText, MATERIAL_MARKERS) || isMarkerRow(rowText, WORK_MARKERS)) break;
    const numbers = cells.map(toNumber);
    const numericCells = numbers.filter((n) => n !== null);
    // A genuine "totals" row has a number on it (the total amount). A column
    // header row like "Назва | Од. | Кількість | Ціна | Сума" matches the
    // TOTAL_MARKERS keyword "сума" but has no numbers, so it must not be
    // mistaken for the end of the section.
    if (isMarkerRow(rowText, TOTAL_MARKERS) && numericCells.length > 0) {
      i++;
      break;
    }
    if (numericCells.length === 0) continue;
    if (numericCells.length < 2) continue; // need at least qty + price/sum

    const nameCell = cells.find((c) => typeof c === "string" && c.trim().length > 1 && toNumber(c) === null);
    if (!nameCell) continue;

    // Heuristic: last numeric = sum, second-to-last numeric = price, before that = quantity
    const lastThree = numericCells.slice(-3);
    let quantity = null, price = null, sum = null;
    let priceWasDerived = false;
    if (lastThree.length === 3) [quantity, price, sum] = lastThree;
    else if (lastThree.length === 2) {
      [quantity, sum] = lastThree;
      price = quantity ? sum / quantity : sum;
      priceWasDerived = true;
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
      quantity: round2(quantity ?? 0),
      price: round2(price ?? 0),
      sum: round2(sum ?? 0),
      category,
      confidence: priceWasDerived ? 0.7 : 0.9,
      source_text: rowText,
    });
  }
  return { items, nextIdx: i };
}

function buildResult(materials, works, rawText) {
  const materials_total = round2(materials.reduce((s, m) => s + m.sum, 0));
  const works_total = round2(works.reduce((s, w) => s + w.sum, 0));
  const allItems = [...materials, ...works];
  const avgConfidence = allItems.length
    ? allItems.reduce((s, i) => s + i.confidence, 0) / allItems.length
    : 0;
  // No items found at all is a strong signal the parser failed to understand the layout.
  const parser_confidence = allItems.length === 0 ? 0 : round2(avgConfidence);

  return {
    materials,
    works,
    materials_total,
    works_total,
    grand_total: round2(materials_total + works_total),
    parser_confidence,
    warnings: [],
    raw_text: rawText,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function allSheetRows(wb) {
  // Estimates sometimes split materials and works across separate sheets,
  // so every sheet is scanned, not just the first.
  const rows = [];
  for (const name of wb.SheetNames) {
    const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
    if (rows.length) rows.push([]); // blank separator row between sheets
    rows.push(...sheetRows);
  }
  return rows;
}

export function parseXlsxEstimate(filePath) {
  const wb = XLSX.readFile(filePath);
  return parseRows(allSheetRows(wb));
}

export function parseCsvEstimate(filePath) {
  // Read as UTF-8 text explicitly — XLSX.readFile() defaults to a binary/Latin-1
  // codepage for CSV, which mangles Cyrillic text (mojibake).
  const text = fs.readFileSync(filePath, "utf8");
  const wb = XLSX.read(text, { type: "string", raw: true });
  return parseRows(allSheetRows(wb));
}

function parseRows(rows) {
  const rawText = rows.map((r) => rowToArray(r).join(" | ")).join("\n");
  const { materials, works } = scanSections(rows);
  return buildResult(materials, works, rawText);
}

export async function parsePdfEstimate(filePath) {
  const pdfParse = (await import("pdf-parse")).default;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  const lines = data.text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.join("").trim().length < 20) {
    // Almost no extractable text — this is very likely a scanned image PDF.
    return {
      ...buildResult([], [], data.text),
      parser_confidence: 0,
      warnings: ["PDF виглядає як скан/зображення. Текст не розпізнано."],
    };
  }

  const rows = lines.map((line) => line.split(/\s{2,}|\t/).filter(Boolean));
  const { materials, works } = scanSections(rows);
  return buildResult(materials, works, data.text);
}

export async function parseDocxEstimate(filePath) {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = lines.map((line) => line.split(/\s{2,}|\t|\|/).filter(Boolean));
  const { materials, works } = scanSections(rows);
  return buildResult(materials, works, text);
}

function scanSections(rows) {
  let materials = [];
  let works = [];
  for (let i = 0; i < rows.length; i++) {
    const rowText = rowToArray(rows[i]).join(" ").trim();
    if (!rowText) continue;
    if (isMarkerRow(rowText, MATERIAL_MARKERS)) {
      const { items, nextIdx } = parseSection(rows, i + 1, "materials");
      materials = materials.concat(items);
      i = nextIdx - 1;
    } else if (isMarkerRow(rowText, WORK_MARKERS)) {
      const { items, nextIdx } = parseSection(rows, i + 1, "works");
      works = works.concat(items);
      i = nextIdx - 1;
    }
  }
  if (materials.length === 0 && works.length === 0) {
    const { items } = parseSection(rows, 0, "works");
    works = items;
  }
  materials.forEach((m, idx) => (m.position = idx + 1));
  works.forEach((w, idx) => (w.position = idx + 1));
  return { materials, works };
}

export async function parseEstimateFile(filePath, originalName) {
  const ext = originalName.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xls") return parseXlsxEstimate(filePath);
  if (ext === "csv") return parseCsvEstimate(filePath);
  if (ext === "pdf") return parsePdfEstimate(filePath);
  if (ext === "docx" || ext === "doc") return parseDocxEstimate(filePath);
  throw new Error("Непідтримуваний формат файлу: " + ext);
}
