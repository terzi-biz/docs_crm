# TERZI Docs CRM — Project Summary

## Architecture

Monorepo with two npm workspaces:

- `server/` — Express + SQLite (better-sqlite3) REST API, JWT auth,
  DOCX/PDF document generation, estimate parsing + AI fallback.
- `client/` — React 19 + TypeScript + Tailwind CSS v4 (Vite), TERZI
  navy/white/gold theme.

Core entity is the **object** (`objects` table) — one per construction
job, keyed by `contract_number` (= `keycrm_deal_number`). Objects move
through a 10-step status lifecycle (`server/src/services/statusWorkflow.js`),
advanced automatically and forward-only — a manually advanced status is
never regressed by an automatic trigger.

## Frontend pages

- `Login` — auth.
- `Dashboard` — stat cards (total/by-status counts via `GET /objects/stats`),
  filters (status, manager, work type, date range, free-text search),
  object table.
- `ObjectForm` — create/edit object fields, payment scenario.
- `ObjectDetail` — object card with `StatusStepper`, the
  "Автоматична обробка кошторису" block (`EstimateReview.tsx`, despite the
  filename it now renders the full upload/processing/edit/confirm flow),
  "Пакет документів TERZI" generation buttons (gated), document history
  table.
- `components/StatusStepper.tsx` — shared 10-step visual workflow,
  reused by `ObjectDetail` and the `STATUSES` list in `Dashboard`.

## Backend endpoints

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/objects`, `GET /api/objects/stats`, `GET/PUT /api/objects/:id`,
  `PATCH /api/objects/:id/status`
- `POST /api/estimates/:objectId/upload` — parse (+ AI fallback) and store a
  new estimate row.
- `PUT /api/estimates/:id` — save manual corrections (blocked once `confirmed`).
- `POST /api/estimates/:id/confirm` — lock the estimate, advance object status.
- `POST /api/documents/:objectId/contract|estimate|invoice|package` — generate
  DOCX (+ PDF if LibreOffice succeeds); `estimate`/`package` require a
  `confirmed` estimate.
- `GET /api/documents/:id/download/:format`
- `GET/POST /api/work-types`

## Parser logic (`server/src/services/estimateParser.js`)

Layout-agnostic heuristic parser, since the two foremen produce
differently structured files:

1. Scan rows for a "МАТЕРІАЛИ"/"РОБОТИ" section marker.
2. Within a section, any row with ≥2 numeric cells is a line item; the
   last 1–3 numeric cells are interpreted as quantity/price/sum (price is
   derived from sum÷quantity when only two numbers are present, lowering
   that row's confidence to 0.7).
3. A row matching a totals keyword ("разом", "всього", "сума", …) ends the
   section — but only if it also has a numeric cell, so a column header
   like "Назва | Од. | Кількість | Ціна | Сума" isn't mistaken for the
   end-of-section total.
4. Cell classification uses a strict numeric-format check (`isNumericCell`)
   rather than digit-stripping, so a name like "Цемент М500" isn't
   misread as a number.
5. `parser_confidence` is the average per-item confidence (0 if no items
   found at all — a strong signal the layout wasn't understood).
6. PDF: scanned/image PDFs are detected (extracted text < 20 chars) and
   short-circuited with a warning rather than attempting to parse garbage.

Supports XLSX/XLS (`xlsx`), PDF (`pdf-parse`), DOCX/DOC (`mammoth`).

## AI analyzer logic (`server/src/services/aiEstimateAnalyzer.js`)

Only invoked when the parser's confidence is below 0.6 (`AI_CONFIDENCE_THRESHOLD`
in `routes/estimates.js`) and `AI_ENABLED=true` with a valid provider/key.
Sends the raw extracted text to OpenAI or Anthropic with a strict prompt
(never invent prices/quantities, only structure existing data). The
response is validated against a `zod` schema (`AiResultSchema`); malformed
JSON throws and the app falls back to the deterministic parser's result
with a notice. Both the AI path and the plain-parser path are funneled
through the same `normalizeAndRecalculate()` so sums/totals/warnings are
computed identically regardless of data source.

## Document generator (`server/src/services/docGenerator.js`)

Renders `contract.docx` / `estimate.docx` / `invoice.docx` templates
(`server/src/templates/`) via `docxtemplater`, fills in object + estimate
data (including `manager_name`/`notes`), then attempts a `soffice
--headless` DOCX→PDF conversion. The conversion explicitly checks
`fs.existsSync(outputPath)` afterward (LibreOffice can report success
without producing a file in sandboxed environments) — on failure the DOCX
is still saved and `pdfPath` is `null`; nothing crashes.

## Database

`objects`, `estimates`, `documents`, `users`, `work_types` tables in
SQLite, with lightweight `ALTER TABLE`-based migrations
(`ensureColumn()` in `server/src/db/index.js`) so the schema can evolve
without a migration framework. Estimate statuses: `uploaded → parsed |
pending_review → confirmed` (or `failed`).

## Current limitations

- No OCR — scanned/image PDFs cannot be parsed; user must supply an
  Excel/DOCX file or a text-based PDF.
- PDF generation depends on a working LibreOffice install; in
  environments without one, only DOCX is produced.
- No ZIP-download endpoint for the full document package yet (manager
  downloads contract/estimate/invoice individually).
- "Акт виконаних робіт" document type is referenced in the UI taxonomy
  but has no generator yet.
- AI analyzer calls OpenAI/Anthropic via raw `fetch`, no retry/backoff.

## Next steps

- ZIP packaging for "Скачати весь пакет".
- Акт виконаних робіт generator + template.
- KeyCRM v2 integration (`server/src/services/keycrm.js`, not yet built):
  push generated documents back to the KeyCRM deal as comments/attachments.
- OCR fallback for scanned PDFs (e.g. via an external OCR API) if needed.
