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

const LOCKED_STATUSES = new Set(["validado_por_usuario", "editado_por_usuario"]);

// Un campo tipo "list" se construye elemento por elemento a lo largo de varios turnos
// (cada llamada de la IA reenvía el array COMPLETO, per las instrucciones de la etapa).
// Si el usuario ya validó/editó un elemento puntual, ese elemento no se debe perder ni
// sobreescribir aunque la IA vuelva a mandar el array entero — se fusiona por posición,
// preservando los elementos ya cerrados y aceptando los nuevos/pendientes.
function mergeListItems(existingItems, incomingItems) {
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingItems) ? incomingItems : [];
  const merged = [];
  const maxLen = Math.max(existing.length, incoming.length);
  for (let i = 0; i < maxLen; i++) {
    const existingItem = existing[i];
    if (existingItem && LOCKED_STATUSES.has(existingItem.status)) {
      merged.push(existingItem);
    } else if (incoming[i]) {
      merged.push({ ...incoming[i], status: "propuesto_por_ia" });
    } else if (existingItem) {
      merged.push(existingItem);
    }
  }
  return merged;
}

// El campo (a nivel agregado) solo se considera cerrado cuando TODOS sus elementos lo
// están Y hay al menos "minItems" — así el checklist que ve la IA y el gate de
// "Continuar" no se destraban con, por ejemplo, un solo pilar validado de los 3-4
// que pide la etapa.
function computeListAggregateStatus(items, minItems = 1) {
  if (!items || items.length < minItems) return "propuesto_por_ia";
  return items.every((it) => it && LOCKED_STATUSES.has(it.status)) ? "validado_por_usuario" : "propuesto_por_ia";
}

export async function applyProposals(sessionId, stageNumber, proposals) {
  const row = await getOrCreateStageData(sessionId, stageNumber);
  const content = parseContent(row);
  const stage = getStage(stageNumber);
  const listFieldDefs = new Map((stage?.fields || []).filter((f) => f.type === "list").map((f) => [f.key, f]));

  for (const p of proposals) {
    const listFieldDef = listFieldDefs.get(p.field_key);
    if (listFieldDef) {
      const incomingItems = normalizeListValue(p.value);
      const mergedItems = mergeListItems(content.fields[p.field_key]?.value, incomingItems);
      content.fields[p.field_key] = {
        label: p.field_label,
        value: mergedItems,
        status: computeListAggregateStatus(mergedItems, listFieldDef.minItems),
        rationale: p.rationale || null,
      };
    } else {
      content.fields[p.field_key] = {
        label: p.field_label,
        value: p.value,
        status: "propuesto_por_ia",
        rationale: p.rationale || null,
      };
    }
  }

  return prisma.stageData.update({
    where: { id: row.id },
    data: { content: JSON.stringify(content), status: "propuesto_por_ia" },
  });
}

// Valida o edita UN elemento puntual de un campo tipo "list" (por ejemplo, el Pilar 2
// dentro de "pilares"), sin tocar los demás elementos del array.
export async function setListItemStatus(sessionId, stageNumber, fieldKey, itemIndex, { value, status }) {
  const row = await getOrCreateStageData(sessionId, stageNumber);
  const content = parseContent(row);
  const field = content.fields[fieldKey];
  if (!field || !Array.isArray(field.value) || !field.value[itemIndex]) {
    throw new Error("No hay una propuesta para ese elemento todavía.");
  }

  const stage = getStage(stageNumber);
  const fieldDef = stage?.fields?.find((f) => f.key === fieldKey);

  const items = [...field.value];
  items[itemIndex] = { ...items[itemIndex], ...(value || {}), status };
  content.fields[fieldKey] = { ...field, value: items, status: computeListAggregateStatus(items, fieldDef?.minItems) };

  return prisma.stageData.update({
    where: { id: row.id },
    data: { content: JSON.stringify(content) },
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
