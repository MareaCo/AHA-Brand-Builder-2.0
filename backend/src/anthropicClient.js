import Anthropic from "@anthropic-ai/sdk";
import { getStage } from "./lib/stageDefinitions.js";
import {
  buildSystemPrompt,
  RECORD_PROPOSAL_TOOL,
  UPDATE_STAGE_META_TOOL,
  getWebSearchTool,
} from "./lib/systemPrompt.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

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
export async function runStageTurn({ stageNumber, accumulatedSummary, filesSummary, stageMeta, history }) {
  const stage = getStage(stageNumber);
  const system = buildSystemPrompt({ stageNumber, accumulatedSummary, filesSummary, stageMeta });

  const tools = [RECORD_PROPOSAL_TOOL, UPDATE_STAGE_META_TOOL];
  if (stage?.webSearchAllowed) tools.push(getWebSearchTool());

  const messages = [...history];

  const proposals = [];
  const metaUpdates = [];
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

    const toolUses = response.content.filter((b) => b.type === "tool_use");

    if (toolUses.length === 0 || stopReason !== "tool_use") {
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const toolUse of toolUses) {
      if (toolUse.name === "record_proposal") {
        proposals.push({
          field_key: toolUse.input.field_key,
          field_label: toolUse.input.field_label,
          value: toolUse.input.value,
          rationale: toolUse.input.rationale || null,
        });
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

  return { text: finalText.trim(), proposals, metaUpdates, stopReason };
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

export async function generateTextWithDocument({ system, prompt, base64, mediaType, isImage }) {
  const anthropic = getClient();
  const contentBlock = isImage
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }
    : { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } };

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
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
