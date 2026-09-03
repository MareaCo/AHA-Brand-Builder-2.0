import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { router as clientsRouter } from "./routes/clients.js";
import { router as dashboardRouter } from "./routes/dashboard.js";
import { router as sessionsRouter } from "./routes/sessions.js";
import { router as filesRouter } from "./routes/files.js";
import { stagesRouter } from "./routes/stages.js";
import { deliverablesRouter } from "./routes/deliverables.js";
import { exportRouter } from "./routes/export.js";
import { router as googleReviewsRouter } from "./routes/googleReviews.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.use("/api/clients", clientsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api", filesRouter);
app.use("/api", stagesRouter);
app.use("/api", deliverablesRouter);
app.use("/api", exportRouter);
app.use("/api/google-reviews", googleReviewsRouter);

app.use("/exports", express.static(path.resolve(process.env.EXPORT_DIR || "./exports")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Error interno del servidor." });
});

app.listen(PORT, () => {
  console.log(`AHA Brand Builder backend escuchando en http://localhost:${PORT}`);
});
