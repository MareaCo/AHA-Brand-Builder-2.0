import { prisma } from "../db.js";
import { getStage } from "./stageDefinitions.js";

export function parseContent(row) {
  if (!row) return { fields: {}, meta: {} };
  try {
    const parsed = JSON.parse(row.content || "{}");
    return { fields: parsed.fields || {}, meta: parsed.meta || {} };
  } catch {
    return { fields: {}, meta: {} };
  }
}

export async function getOrCreateStageData(sessionId, stageNumber) {
  const stage = getStage(stageNumber);
  const existing = await prisma.stageData.findUnique({
    where: { sessionId_stageNumber: { sessionId, stageNumber } },
  });
  if (existing) return existing;

  return prisma.stageData.create({
    data: {
      sessionId,
      stageNumber,
      stageName: stage?.name || `Etapa ${stageNumber}`,
      content: JSON.stringify({ fields: {}, meta: {} }),
      status: "borrador",
    },
  });
}

export async function applyProposals(sessionId, stageNumber, proposals) {
  const row = await getOrCreateStageData(sessionId, stageNumber);
  const content = parseContent(row);

  for (const p of proposals) {
    content.fields[p.field_key] = {
      label: p.field_label,
      value: p.value,
      status: "propuesto_por_ia",
      rationale: p.rationale || null,
    };
  }

  return prisma.stageData.update({
    where: { id: row.id },
    data: { content: JSON.stringify(content), status: "propuesto_por_ia" },
  });
}

export async function applyMetaUpdates(sessionId, stageNumber, metaUpdates) {
  const row = await getOrCreateStageData(sessionId, stageNumber);
  const content = parseContent(row);

  for (const m of metaUpdates) {
    content.meta = { ...content.meta, ...m };
  }

  return prisma.stageData.update({
    where: { id: row.id },
    data: { content: JSON.stringify(content) },
  });
}

export async function setFieldStatus(sessionId, stageNumber, fieldKey, { value, label, status }) {
  const row = await getOrCreateStageData(sessionId, stageNumber);
  const content = parseContent(row);
  const existing = content.fields[fieldKey] || {};

  content.fields[fieldKey] = {
    label: label || existing.label || fieldKey,
    value: value !== undefined ? value : existing.value,
    status,
    rationale: existing.rationale || null,
  };

  return prisma.stageData.update({
    where: { id: row.id },
    data: { content: JSON.stringify(content) },
  });
}
