import express from "express";
import { db } from "../db/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.json(db.prepare("SELECT * FROM work_types WHERE is_active = 1 ORDER BY name").all());
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Назва обов'язкова" });
  try {
    const result = db.prepare("INSERT INTO work_types (name) VALUES (?)").run(name.trim());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  } catch {
    res.status(409).json({ error: "Такий вид робіт вже існує" });
  }
});

router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  db.prepare("UPDATE work_types SET is_active = 0 WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
