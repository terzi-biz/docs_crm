import "dotenv/config";
import express from "express";
import cors from "cors";
import "./db/index.js";
import authRoutes from "./routes/auth.js";
import objectsRoutes from "./routes/objects.js";
import estimatesRoutes from "./routes/estimates.js";
import documentsRoutes from "./routes/documents.js";
import workTypesRoutes from "./routes/workTypes.js";
import templatesRoutes from "./routes/templates.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/objects", objectsRoutes);
app.use("/api/estimates", estimatesRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/work-types", workTypesRoutes);
app.use("/api/templates", templatesRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
