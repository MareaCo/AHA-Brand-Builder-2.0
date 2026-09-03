import { Router } from "express";
import { prisma } from "../db.js";
import { buildPyramidData, pyramidIsReady } from "../lib/pyramidData.js";
import { runCoherenceCheck } from "../lib/coherenceCheck.js";
import { generateAllManifestoVariants, formatAsVideoScript, MANIFESTO_TONES } from "../lib/manifesto.js";
import { setFieldStatus } from "../lib/stageDataStore.js";
import { getStage } from "../lib/stageDefinitions.js";

export const router = Router();

router.get("/sessions/:sessionId/pyramid", async (req, res) => {
  const stageDataRows = await prisma.stageData.findMany({ where: { sessionId: req.params.sessionId } });
  res.json({
    data: buildPyramidData(stageDataRows),
    ready: pyramidIsReady(stageDataRows),
    stage7Fields: getStage(7).fields,
  });
});

router.put("/sessions/:sessionId/pyramid/fields/:fieldKey", async (req, res) => {
  const { sessionId, fieldKey } = req.params;
  const { value, label } = req.body;
  if (value === undefined) return res.status(400).json({ error: "value es obligatorio." });
  const fieldDef = getStage(7).fields.find((f) => f.key === fieldKey);
  if (!fieldDef) return res.status(400).json({ error: "Ese campo no pertenece a la Pirámide (Etapa 7)." });

  await setFieldStatus(sessionId, 7, fieldKey, { value, label: label || fieldDef.label, status: "editado_por_usuario" });
  const stageDataRows = await prisma.stageData.findMany({ where: { sessionId } });
  res.json({ data: buildPyramidData(stageDataRows), ready: pyramidIsReady(stageDataRows) });
});

router.post("/sessions/:sessionId/pyramid/coherence-check", async (req, res) => {
  const stageDataRows = await prisma.stageData.findMany({ where: { sessionId: req.params.sessionId } });
  const result = await runCoherenceCheck(stageDataRows);
  res.json(result);
});

router.post("/sessions/:sessionId/pyramid/export", async (req, res) => {
  const { sessionId } = req.params;
  const stageDataRows = await prisma.stageData.findMany({ where: { sessionId } });
  const data = buildPyramidData(stageDataRows);
  const latest = await prisma.deliverable.findFirst({
    where: { sessionId, type: "piramide" },
    orderBy: { version: "desc" },
  });
  const deliverable = await prisma.deliverable.create({
    data: {
      sessionId,
      type: "piramide",
      content: JSON.stringify(data),
      format: "svg",
      version: (latest?.version || 0) + 1,
    },
  });
  res.status(201).json(deliverable);
});

router.get("/sessions/:sessionId/manifesto", async (req, res) => {
  const latest = await prisma.deliverable.findFirst({
    where: { sessionId: req.params.sessionId, type: "manifiesto" },
    orderBy: { version: "desc" },
  });
  if (!latest) return res.json({ variants: null, tones: MANIFESTO_TONES });
  res.json({ variants: JSON.parse(latest.content), tones: MANIFESTO_TONES, version: latest.version });
});

router.post("/sessions/:sessionId/manifesto/generate", async (req, res) => {
  const { sessionId } = req.params;
  const stageDataRows = await prisma.stageData.findMany({ where: { sessionId } });

  let variants;
  try {
    variants = await generateAllManifestoVariants(stageDataRows);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  const latest = await prisma.deliverable.findFirst({
    where: { sessionId, type: "manifiesto" },
    orderBy: { version: "desc" },
  });
  const deliverable = await prisma.deliverable.create({
    data: {
      sessionId,
      type: "manifiesto",
      content: JSON.stringify(variants),
      format: "text",
      version: (latest?.version || 0) + 1,
    },
  });

  res.status(201).json({ variants, version: deliverable.version });
});

router.post("/sessions/:sessionId/manifesto/video-script", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text es obligatorio." });
  res.json({ script: formatAsVideoScript(text) });
});

export { router as deliverablesRouter };
