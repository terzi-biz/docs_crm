import { db } from "../db/index.js";

// Ordered object lifecycle. Index order matters: advanceStatus() only moves
// an object forward, so a manager who jumps ahead (e.g. manually marks
// "Договір підписано") never gets bumped backwards by a later automatic step.
export const STATUSES = [
  "Новий об'єкт",
  "Дані заповнені",
  "Кошторис завантажено",
  "Кошторис розпізнано",
  "Кошторис перевірено",
  "Документи створено",
  "Надіслано клієнту",
  "Договір підписано",
  "Оплачено",
  "Закрито",
];

export function statusIndex(status) {
  return STATUSES.indexOf(status);
}

/** Move the object forward to `status` unless it's already further along. */
export function advanceStatus(objectId, status) {
  const targetIdx = statusIndex(status);
  if (targetIdx === -1) return;
  const current = db.prepare("SELECT status FROM objects WHERE id = ?").get(objectId);
  if (!current) return;
  if (statusIndex(current.status) >= targetIdx) return;
  db.prepare("UPDATE objects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    objectId
  );
}
