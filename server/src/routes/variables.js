import express from "express";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { SYSTEM_VARIABLES, SYSTEM_LOOPS } from "../services/systemVariables.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const customFields = db
    .prepare("SELECT * FROM custom_fields WHERE is_active = 1 ORDER BY group_name, sort_order, id")
    .all()
    .map((f) => ({
      key: f.key,
      description: f.label,
      example: f.placeholder || "",
      group: f.group_name,
      custom: true,
    }));

  res.json({
    system: SYSTEM_VARIABLES,
    loops: SYSTEM_LOOPS,
    custom: customFields,
  });
});

export default router;
