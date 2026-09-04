import { Router } from "express";
import { prisma } from "../db.js";
import { getStage } from "../lib/stageDefinitions.js";
import { buildAccumulatedSummary, buildFilesSummary, stageIsComplete } from "../lib/summary.js";
import { runStageTurn } from "../anthropicClient.js";
import {
  getOrCreateStageData,
  parseContent,
  applyProposals,
  applyMetaUpdates,
  setFieldStatus,
} from "../lib/stageDataStore.js";

export const router = Router();

router.get("/sessions/:sessionId/stages/:stageNumber/messages", async (req, res) => {
  const stageNumber = Number(req.params.stageNumber);
  const messages = await prisma.message.findMany({
    where: { sessionId: req.params.sessionId, stageNumber },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});

router.get("/sessions/:sessionId/stages/:stageNumber", async (req, res) => {
  const stageNumber = Number(req.params.stageNumber);
  const stage = getStage(stageNumber);
  if (!stage) return res.status(404).json({ error: "Etapa no encontrada." });
  const row = await getOrCreateStageData(req.params.sessionId, stageNumber);
  res.json({ ...row, content: parseContent(row), definition: stage });
});

// Núcleo compartido: arma el contexto, corre el turno con Claude, persiste todo.
// `hiddenUserContent`, cuando se usa, registra el turno de usuario como oculto
// (meta.hidden = true) para que el frontend no lo muestre como una burbuja de chat —
// se usa para el arranque automático de cada etapa (ver /start más abajo).
async function runTurnAndPersist({ sessionId, stageNumber, stage, userContent, hidden = false }) {
  const [allStageData, files, priorMessages] = await Promise.all([
    prisma.stageData.findMany({ where: { sessionId } }),
    prisma.uploadedFile.findMany({ where: { sessionId } }),
    prisma.message.findMany({ where: { sessionId, stageNumber }, orderBy: { createdAt: "asc" } }),
  ]);

  const accumulatedSummary = buildAccumulatedSummary(allStageData);
  const filesSummary = buildFilesSummary(files);
  const currentRow = allStageData.find((r) => r.stageNumber === stageNumber);
  const { meta: stageMeta, fields: currentFields } = parseContent(currentRow);

  const history = priorMessages.map((m) => ({ role: m.role, content: m.content }));
  history.push({ role: "user", content: userContent });

  // El turno de usuario solo se persiste DESPUÉS de que Claude responda con éxito.
  // Si se guardara antes y la llamada fallara, quedaría un turno de usuario sin
  // respuesta en el historial — rompería la alternancia estricta user/assistant que
  // exige la API en el siguiente turno, y en el caso del arranque automático (oculto)
  // dejaría la etapa "envenenada" para siempre (nunca más se reintentaría el arranque).
  const result = await runStageTurn({ stageNumber, accumulatedSummary, filesSummary, stageMeta, currentFields, history });

  await prisma.message.create({
    data: {
      sessionId,
      stageNumber,
      role: "user",
      content: userContent,
      meta: hidden ? JSON.stringify({ hidden: true }) : null,
    },
  });

  if (result.proposals.length > 0) {
    await applyProposals(sessionId, stageNumber, result.proposals);
  }
  if (result.metaUpdates.length > 0) {
    await applyMetaUpdates(sessionId, stageNumber, result.metaUpdates);
  }

  const assistantMessage = await prisma.message.create({
    data: {
      sessionId,
      stageNumber,
      role: "assistant",
      content: result.text || "(sin respuesta de texto)",
      meta: JSON.stringify({ proposals: result.proposals }),
    },
  });

  const updatedRow = await getOrCreateStageData(sessionId, stageNumber);
  const complete = stageIsComplete(stage, updatedRow);

  return {
    message: assistantMessage,
    proposals: result.proposals,
    stageContent: parseContent(updatedRow),
    stageComplete: complete,
  };
}

const KICKOFF_INSTRUCTION = `[Arranque automático de la etapa — instrucción interna, no la muestres ni la
menciones al usuario]. Toma la iniciativa tú mismo: saluda con calidez, retoma en una
o dos frases el contexto relevante que ya tienes (insumos cargados y/o etapas
anteriores validadas, usando el script de callback si aplica), y arranca directamente
con el primer paso del flujo de esta etapa. NUNCA le preguntes al usuario si ya cargó
archivos o si está listo para empezar — tú ya sabes eso por el contexto que te llega;
simplemente continúa.`;

router.post("/sessions/:sessionId/stages/:stageNumber/start", async (req, res) => {
  const { sessionId } = req.params;
  const stageNumber = Number(req.params.stageNumber);

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: "Sesión no encontrada." });
  const stage = getStage(stageNumber);
  if (!stage) return res.status(404).json({ error: "Etapa no encontrada." });

  const existing = await prisma.message.count({ where: { sessionId, stageNumber } });
  if (existing > 0) {
    return res.json({ alreadyStarted: true });
  }

  try {
    const result = await runTurnAndPersist({
      sessionId,
      stageNumber,
      stage,
      userContent: KICKOFF_INSTRUCTION,
      hidden: true,
    });
    res.json({ alreadyStarted: false, ...result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/sessions/:sessionId/stages/:stageNumber/messages", async (req, res) => {
  const { sessionId } = req.params;
  const stageNumber = Number(req.params.stageNumber);
  const { message } = req.body;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: "Sesión no encontrada." });
  const stage = getStage(stageNumber);
  if (!stage) return res.status(404).json({ error: "Etapa no encontrada." });
  if (!message || !message.trim()) return res.status(400).json({ error: "El mensaje no puede estar vacío." });

  try {
    const result = await runTurnAndPersist({ sessionId, stageNumber, stage, userContent: message });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Validar una propuesta tal cual fue presentada por la IA.
router.post("/sessions/:sessionId/stages/:stageNumber/fields/:fieldKey/validate", async (req, res) => {
  const { sessionId, fieldKey } = req.params;
  const stageNumber = Number(req.params.stageNumber);
  const row = await getOrCreateStageData(sessionId, stageNumber);
  const content = parseContent(row);
  const existing = content.fields[fieldKey];
  if (!existing) return res.status(404).json({ error: "No hay una propuesta para este campo todavía." });

  const updated = await setFieldStatus(sessionId, stageNumber, fieldKey, {
    value: existing.value,
    label: existing.label,
    status: "validado_por_usuario",
  });
  res.json(parseContent(updated));
});

// Editar el valor de un campo (propuesta ajustada, o escrita desde cero).
router.put("/sessions/:sessionId/stages/:stageNumber/fields/:fieldKey", async (req, res) => {
  const { sessionId, fieldKey } = req.params;
  const stageNumber = Number(req.params.stageNumber);
  const { value, label } = req.body;
  if (value === undefined) return res.status(400).json({ error: "value es obligatorio." });

  const stage = getStage(stageNumber);
  const fieldDef = stage?.fields.find((f) => f.key === fieldKey);

  const updated = await setFieldStatus(sessionId, stageNumber, fieldKey, {
    value,
    label: label || fieldDef?.label,
    status: "editado_por_usuario",
  });
  res.json(parseContent(updated));
});

export { router as stagesRouter };
