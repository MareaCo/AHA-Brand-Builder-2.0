import { Router } from "express";
import { prisma } from "../db.js";
import { STAGES, TOTAL_STAGES, getStage } from "../lib/stageDefinitions.js";
import { stageIsComplete } from "../lib/summary.js";
import { runCoherenceCheck } from "../lib/coherenceCheck.js";

export const router = Router();

function parseStageRow(row) {
  let content = { fields: {}, meta: {} };
  try {
    const parsed = JSON.parse(row.content || "{}");
    content = { fields: parsed.fields || {}, meta: parsed.meta || {} };
  } catch {
    // deja el default
  }
  return { ...row, content };
}

async function serializeSession(session) {
  const [stageData, files] = await Promise.all([
    prisma.stageData.findMany({ where: { sessionId: session.id }, orderBy: { stageNumber: "asc" } }),
    prisma.uploadedFile.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const parsedStageData = stageData.map(parseStageRow);
  const byNumber = {};
  for (const row of stageData) byNumber[row.stageNumber] = row;

  const stages = STAGES.map((stage) => ({
    number: stage.number,
    key: stage.key,
    name: stage.name,
    shortGoal: stage.shortGoal,
    fields: stage.fields,
    complete: stageIsComplete(stage, byNumber[stage.number]),
  }));

  return {
    ...session,
    totalStages: TOTAL_STAGES,
    stages,
    stageData: parsedStageData,
    files,
  };
}

router.get("/", async (req, res) => {
  const { brandId } = req.query;
  const sessions = await prisma.session.findMany({
    where: brandId ? { brandId } : undefined,
    orderBy: { updatedAt: "desc" },
  });
  res.json(sessions);
});

router.post("/", async (req, res) => {
  const { brandId } = req.body;
  if (!brandId) return res.status(400).json({ error: "brandId es obligatorio." });
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return res.status(404).json({ error: "Marca no encontrada." });

  const session = await prisma.session.create({ data: { brandId, currentStage: 0 } });
  res.status(201).json(await serializeSession(session));
});

router.get("/:id", async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) return res.status(404).json({ error: "Sesión no encontrada." });
  res.json(await serializeSession(session));
});

// Avanza a la siguiente etapa si la actual ya está completa (todos los campos
// validados o editados por el usuario). Nunca fuerza el avance automático.
router.post("/:id/advance", async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) return res.status(404).json({ error: "Sesión no encontrada." });

  const currentStage = getStage(session.currentStage);
  const stageDataRow = await prisma.stageData.findUnique({
    where: { sessionId_stageNumber: { sessionId: session.id, stageNumber: session.currentStage } },
  });

  if (!stageIsComplete(currentStage, stageDataRow)) {
    return res.status(400).json({ error: "Todavía hay campos sin validar en esta etapa." });
  }

  const nextStage = Math.min(session.currentStage + 1, TOTAL_STAGES - 1);
  const status = nextStage === TOTAL_STAGES - 1 && session.currentStage === TOTAL_STAGES - 1 ? "completado" : session.status;
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { currentStage: nextStage, status },
  });

  // Chequeo de coherencia automático contra todo lo validado hasta ahora — nunca bloquea
  // el avance (la etapa ya quedó marcada como completa arriba), solo advierte. Si la
  // llamada falla, coherente queda en null (no se asume que está bien).
  let coherence = null;
  const stageDataRows = await prisma.stageData.findMany({ where: { sessionId: session.id } });
  try {
    coherence = await runCoherenceCheck(stageDataRows);
  } catch (err) {
    coherence = { coherente: null, alertas: [], error: err.message };
  }

  res.json({ ...(await serializeSession(updated)), coherence });
});

// Reabrir una etapa anterior para editarla (retroceder libremente).
router.post("/:id/reopen/:stageNumber", async (req, res) => {
  const stageNumber = Number(req.params.stageNumber);
  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) return res.status(404).json({ error: "Sesión no encontrada." });
  if (stageNumber < 0 || stageNumber > session.currentStage) {
    return res.status(400).json({ error: "Solo puedes reabrir etapas ya alcanzadas." });
  }
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { currentStage: stageNumber, status: "en_progreso" },
  });
  res.json(await serializeSession(updated));
});

router.post("/:id/complete", async (req, res) => {
  const updated = await prisma.session.update({
    where: { id: req.params.id },
    data: { status: "completado" },
  });
  res.json(await serializeSession(updated));
});

export { serializeSession };
