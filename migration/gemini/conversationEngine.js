// Motor de conversación con Gemini — equivalente de runStageTurn() en
// backend/src/anthropicClient.js, pero para la API de Gemini.
//
// Reutiliza SIN DUPLICAR la metodología ya validada:
//   - getStage()          de ../../backend/src/lib/stageDefinitions.js
//   - buildSystemPrompt()  de ../../backend/src/lib/systemPrompt.js
// (ambos son texto/lógica pura, sin nada específico de Claude — funcionan igual aquí).
//
// AVISO IMPORTANTE (ver también README.md de esta carpeta): este archivo no se ha
// ejecutado contra la API real de Gemini en este entorno — no hay clave de API
// disponible aquí. Se escribió con cuidado siguiendo la documentación oficial del SDK
// @google/genai, pero antes de confiar en él en producción, pruébalo con una clave real
// en un par de etapas (una sin búsqueda web, como la Etapa 1, y una con búsqueda, como
// la Etapa 5) y compara el comportamiento contra la versión actual con Claude.
//
// Requiere: npm install @google/genai

import { GoogleGenAI } from "@google/genai";
import { getStage } from "../../backend/src/lib/stageDefinitions.js";
import { buildSystemPrompt } from "../../backend/src/lib/systemPrompt.js";
import { buildRecordProposalDeclaration, UPDATE_STAGE_META_DECLARATION, GOOGLE_SEARCH_TOOL } from "./functionDeclarations.js";
import { checkProposal } from "./proposalGuard.js";
import { parseProposalValue } from "./parseProposalValue.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3-pro-preview";

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está configurada. Consíguela en Google AI Studio.");
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Paso 1, solo para etapas con webSearchAllowed: una llamada de solo-búsqueda (nunca
// mezclada con function calling, ver el aviso en functionDeclarations.js sobre por qué).
// Devuelve el texto de lo que encontró Gemini (para pasarlo como contexto al paso 2) y
// las citas, en el mismo formato { query, results: [{title, url}] } que ya usa la app.
async function runGroundingPass({ systemInstruction, history }) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: history,
    config: {
      systemInstruction,
      tools: [GOOGLE_SEARCH_TOOL],
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") || "";

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const citations = groundingChunks
    .filter((c) => c.web?.uri)
    .map((c) => ({ query: null, results: [{ title: c.web.title || c.web.uri, url: c.web.uri }] }));

  return { text, citations };
}

// Paso 2 (o único paso, en etapas sin búsqueda): el loop normal de function calling,
// equivalente al while(loopGuard < 6) de runStageTurn() en anthropicClient.js.
export async function runStageTurn({ stageNumber, accumulatedSummary, filesSummary, stageMeta, currentFields, history }) {
  const stage = getStage(stageNumber);
  const baseSystemInstruction = buildSystemPrompt({ stageNumber, accumulatedSummary, filesSummary, stageMeta, currentFields });

  let groundingNote = "";
  let citations = [];
  if (stage?.webSearchAllowed) {
    const grounding = await runGroundingPass({ systemInstruction: baseSystemInstruction, history });
    citations = grounding.citations;
    if (grounding.text) {
      groundingNote = `\n\nResultado de tu búsqueda web para este turno (ya la hiciste, no la repitas — úsala como base de tu propuesta):\n${grounding.text}`;
    }
  }

  const systemInstruction = baseSystemInstruction + groundingNote;
  const tools = [{ functionDeclarations: [buildRecordProposalDeclaration(stage), UPDATE_STAGE_META_DECLARATION] }];

  const messages = [...history];
  const fieldsState = { ...(currentFields || {}) };

  const proposals = [];
  const metaUpdates = [];
  let finalText = "";
  let stopReason = null;

  const ai = getClient();
  let loopGuard = 0;

  while (loopGuard < 6) {
    loopGuard += 1;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: messages,
      config: { systemInstruction, tools },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const textParts = parts.filter((p) => p.text).map((p) => p.text);
    if (textParts.length > 0) finalText += (finalText ? "\n\n" : "") + textParts.join("\n\n");

    const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
    stopReason = functionCalls.length > 0 ? "function_call" : "stop";

    if (functionCalls.length === 0) break;

    messages.push({ role: "model", parts });

    const functionResponseParts = [];
    for (const call of functionCalls) {
      if (call.name === "record_proposal") {
        const { field_key, field_label, rationale } = call.args;
        const value = parseProposalValue(call.args.value);

        const guard = checkProposal(field_key, fieldsState, stage.fields);
        if (guard.rejected) {
          functionResponseParts.push({
            functionResponse: { name: call.name, response: { result: guard.reason, error: true } },
          });
          continue;
        }

        proposals.push({ field_key, field_label, value, rationale: rationale || null });
        fieldsState[field_key] = { label: field_label, value, status: "propuesto_por_ia", rationale: rationale || null };
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { result: "Propuesta registrada y mostrada al usuario para validar, editar, o escribir desde cero." },
          },
        });
      } else if (call.name === "update_stage_meta") {
        try {
          metaUpdates.push(JSON.parse(call.args.meta_json || "{}"));
        } catch {
          metaUpdates.push({});
        }
        functionResponseParts.push({
          functionResponse: { name: call.name, response: { result: "Estado de avance actualizado." } },
        });
      }
    }

    if (functionResponseParts.length > 0) {
      messages.push({ role: "user", parts: functionResponseParts });
    } else {
      break;
    }
  }

  return { text: finalText.trim(), proposals, metaUpdates, citations, stopReason };
}
