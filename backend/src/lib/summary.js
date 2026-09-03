import { getStage } from "./stageDefinitions.js";

// Construye un resumen legible de todo lo validado hasta ahora, para inyectarlo
// como contexto en el system prompt (accumulated_stage_summary) y para el panel
// lateral "Lo que hemos construido hasta ahora".
export function buildAccumulatedSummary(stageDataRows) {
  const sorted = [...stageDataRows].sort((a, b) => a.stageNumber - b.stageNumber);
  const parts = [];

  for (const row of sorted) {
    const stage = getStage(row.stageNumber);
    if (!stage) continue;
    let content;
    try {
      content = JSON.parse(row.content || "{}");
    } catch {
      content = {};
    }
    const fields = content.fields || {};
    const validatedEntries = Object.entries(fields).filter(
      ([, f]) => f && (f.status === "validado_por_usuario" || f.status === "editado_por_usuario")
    );
    if (validatedEntries.length === 0) continue;

    const lines = validatedEntries.map(([key, f]) => {
      const label = f.label || key;
      const value = typeof f.value === "string" ? f.value : JSON.stringify(f.value);
      return `  - ${label}: ${value}`;
    });
    parts.push(`Etapa ${row.stageNumber} — ${stage.name}:\n${lines.join("\n")}`);
  }

  return parts.length > 0 ? parts.join("\n\n") : "Todavía no hay etapas validadas.";
}

export function buildFilesSummary(files) {
  if (!files || files.length === 0) return "No se han cargado insumos todavía.";
  return files
    .map((f) => `- ${f.filename} (${f.fileType}): ${f.extractedSummary || "sin resumen aún"}`)
    .join("\n");
}

export function getStageContent(stageDataRow) {
  if (!stageDataRow) return { fields: {}, meta: {} };
  try {
    const parsed = JSON.parse(stageDataRow.content || "{}");
    return { fields: parsed.fields || {}, meta: parsed.meta || {} };
  } catch {
    return { fields: {}, meta: {} };
  }
}

export function stageIsComplete(stage, stageDataRow) {
  if (!stage || stage.fields.length === 0) return true;
  const { fields } = getStageContent(stageDataRow);
  return stage.fields.every((f) => {
    const entry = fields[f.key];
    return entry && (entry.status === "validado_por_usuario" || entry.status === "editado_por_usuario");
  });
}
