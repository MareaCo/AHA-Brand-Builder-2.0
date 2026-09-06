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

// Red de seguridad: los campos tipo "list" (por ejemplo "pilares") deberían llegar
// como array de objetos { atributo, materializacion } — el schema de la herramienta ya
// lo pide así, pero un modelo puede igual mandar todo como un solo string (por ejemplo
// "1. Pilar 1 — ... 2. Pilar 2 — ..."). En vez de guardar eso como un único elemento
// gigante, se intenta partir por los marcadores numerados en varios elementos — no es
// perfecto, pero es muchísimo mejor que perder los demás pilares.
function normalizeListValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return value;

  const parts = value
    .split(/(?:^|\s)\d+\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [{ atributo: value.trim(), materializacion: "" }];
  return parts.map((part) => ({ atributo: part, materializacion: "" }));
}

export async function applyProposals(sessionId, stageNumber, proposals) {
  const row = await getOrCreateStageData(sessionId, stageNumber);
  const content = parseContent(row);
  const stage = getStage(stageNumber);
  const listKeys = new Set((stage?.fields || []).filter((f) => f.type === "list").map((f) => f.key));

  for (const p of proposals) {
    content.fields[p.field_key] = {
      label: p.field_label,
      value: listKeys.has(p.field_key) ? normalizeListValue(p.value) : p.value,
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
