import Anthropic from "@anthropic-ai/sdk";
import { getStage } from "./lib/stageDefinitions.js";
import {
  buildSystemPrompt,
  buildRecordProposalTool,
  UPDATE_STAGE_META_TOOL,
  getWebSearchTool,
} from "./lib/systemPrompt.js";

const LOCKED_STATUSES = new Set(["validado_por_usuario", "editado_por_usuario"]);

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// Extrae, de forma defensiva, las búsquedas web que el modelo haya hecho en un turno
// (query + resultados con título/url) para poder mostrárselas al usuario — la API no
// documenta un shape 100% estable para esto, así que cualquier campo inesperado se
// ignora en vez de romper el turno.
function extractCitations(content) {
  const citations = [];
  const queryById = {};
  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search" && block.input?.query) {
      queryById[block.id] = block.input.query;
    }
  }
  for (const block of content) {
    if (block.type !== "web_search_tool_result") continue;
    const query = queryById[block.tool_use_id] || null;
    const items = Array.isArray(block.content) ? block.content : [];
    const results = items
      .filter((r) => r && (r.url || r.title))
      .map((r) => ({ title: r.title || r.url, url: r.url || null }))
      .slice(0, 5);
    if (query || results.length > 0) citations.push({ query, results });
  }
  return citations;
}

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY no está configurada. Agrégala en backend/.env para poder conversar con el Brand Builder."
    );
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Ejecuta un turno de conversación para una etapa dada, incluyendo el loop de
// tool-use (record_proposal, update_stage_meta, y opcionalmente web_search).
// Devuelve { text, proposals: [{field_key, field_label, value, rationale}], metaUpdates: [{...}], rawStopReason }
export async function runStageTurn({
  stageNumber,
  accumulatedSummary,
  filesSummary,
  stageMeta,
  currentFields,
  history,
}) {
  const stage = getStage(stageNumber);
  const system = buildSystemPrompt({ stageNumber, accumulatedSummary, filesSummary, stageMeta, currentFields });

  const tools = [UPDATE_STAGE_META_TOOL];
  if (stage?.fields?.length > 0) tools.push(buildRecordProposalTool(stage));
  if (stage?.webSearchAllowed) tools.push(getWebSearchTool());

  const messages = [...history];
  // Copia local del estado de los campos: se actualiza en vivo dentro del loop para
  // que una propuesta aceptada bloquee inmediatamente otro intento sobre la misma
  // clave más adelante en el mismo turno, y para poder rechazar (con un tool_result
  // correctivo) cualquier intento de reescribir un campo que el usuario ya cerró.
  const fieldsState = { ...(currentFields || {}) };

  const proposals = [];
  const metaUpdates = [];
  const citations = [];
  let finalText = "";
  let stopReason = null;

  const anthropic = getClient();
  let loopGuard = 0;

  while (loopGuard < 6) {
    loopGuard += 1;
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      tools,
      messages,
    });

    stopReason = response.stop_reason;
    const textParts = response.content.filter((b) => b.type === "text").map((b) => b.text);
    if (textParts.length > 0) finalText += (finalText ? "\n\n" : "") + textParts.join("\n\n");
    citations.push(...extractCitations(response.content));

    const toolUses = response.content.filter((b) => b.type === "tool_use");

    if (toolUses.length === 0 || stopReason !== "tool_use") {
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const toolUse of toolUses) {
      if (toolUse.name === "record_proposal") {
        const { field_key, field_label, value, rationale } = toolUse.input;
        const existing = fieldsState[field_key];
        // Los campos tipo "list" (por ejemplo "pilares") se construyen elemento por
        // elemento a lo largo de varios turnos — el usuario puede validar el primer
        // elemento mientras la IA sigue proponiendo los siguientes. Bloquear todo el
        // campo en cuanto un elemento queda cerrado impediría terminar de construirlo,
        // así que aquí siempre se deja pasar; la protección real (no perder ni
        // sobreescribir un elemento ya validado) ocurre al fusionar en applyProposals.
        const isListField = stage?.fields?.find((f) => f.key === field_key)?.type === "list";

        if (!isListField && existing && LOCKED_STATUSES.has(existing.status)) {
          const shownValue = typeof existing.value === "string" ? existing.value : JSON.stringify(existing.value);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            is_error: true,
            content: `Rechazado: el campo "${field_key}" ya fue cerrado por el usuario (valor actual: "${shownValue}"). No lo repitas ni lo reemplaces — el usuario no pidió cambiarlo en su último mensaje. Continúa con el siguiente campo o paso pendiente.`,
          });
          continue;
        }

        proposals.push({ field_key, field_label, value, rationale: rationale || null });
        fieldsState[field_key] = { label: field_label, value, status: "propuesto_por_ia", rationale: rationale || null };
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "Propuesta registrada y mostrada al usuario para validar, editar, o escribir desde cero.",
        });
      } else if (toolUse.name === "update_stage_meta") {
        metaUpdates.push(toolUse.input.meta || {});
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "Estado de avance actualizado.",
        });
      } else {
        // web_search y otras server tools ya devuelven su resultado dentro del mismo
        // response.content (bloques tipo web_search_tool_result) y no requieren tool_result manual.
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    } else {
      break;
    }
  }

  return { text: finalText.trim(), proposals, metaUpdates, citations, stopReason };
}

// Usado para generar una propuesta directa fuera del flujo de chat (por ejemplo,
// resumen de un archivo cargado, o generación del manifiesto/pirámide).
export async function generateText({ system, prompt, maxTokens = 2000 }) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

export async function generateTextWithDocument({ system, prompt, base64, mediaType, isImage, maxTokens = 1500 }) {
  const anthropic = getClient();
  const contentBlock = isImage
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }
    : { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } };

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: "user",
        content: [contentBlock, { type: "text", text: prompt }],
      },
    ],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

export { MODEL };
