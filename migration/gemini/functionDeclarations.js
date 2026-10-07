// Declaraciones de funciones (function calling) para Gemini — equivalente de
// buildRecordProposalTool() y UPDATE_STAGE_META_TOOL en backend/src/lib/systemPrompt.js,
// pero en el formato de esquema que acepta el SDK de Gemini (@google/genai), que es un
// subconjunto de OpenAPI 3.0 y NO soporta "anyOf" de forma confiable como sí lo hace la
// tool de Claude.
//
// Por eso "value" aquí es SIEMPRE tipo STRING — para los campos tipo "list" (hoy, solo
// "pilares"), se le pide a la IA que mande el array como texto JSON. Ver
// parseProposalValue.js para cómo se interpreta eso de vuelta a un array real, con un
// respaldo si la IA no manda JSON válido.
//
// Requiere: npm install @google/genai
import { Type } from "@google/genai";

export function buildRecordProposalDeclaration(stage) {
  const keys = stage.fields.map((f) => f.key);
  const listFields = stage.fields.filter((f) => f.type === "list").map((f) => f.key);

  const valueDescription =
    listFields.length > 0
      ? `El contenido propuesto. Para los campos ${listFields.join(
          ", "
        )}, DEBE ser un texto JSON que represente un array de objetos {"atributo": "...", "materializacion": "..."} — por ejemplo: '[{"atributo":"Confianza","materializacion":"50 años de historia"}]'. Para los demás campos, es simplemente el texto de la propuesta.`
      : "El contenido propuesto, como texto simple.";

  return {
    name: "record_proposal",
    description:
      "Registra una propuesta formal y estructurada para un campo específico de la etapa actual, para que el usuario la pueda validar, editar, o descartar y escribir desde cero. Úsala SOLO cuando tengas una propuesta concreta y final para uno de los campos válidos de esta etapa — nunca para un borrador exploratorio o una opción entre varias.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        field_key: {
          type: Type.STRING,
          enum: keys,
          description: `La clave EXACTA del campo al que corresponde esta propuesta. Las únicas claves válidas en esta etapa son: ${keys.join(", ")}. Nunca uses una clave distinta a estas.`,
        },
        field_label: {
          type: Type.STRING,
          description: "Etiqueta legible del campo, por ejemplo 'Qué es tu marca' o 'Insight consolidado'.",
        },
        value: { type: Type.STRING, description: valueDescription },
        rationale: {
          type: Type.STRING,
          description: "Justificación breve de por qué propones esto.",
        },
      },
      required: ["field_key", "field_label", "value"],
    },
  };
}

export const UPDATE_STAGE_META_DECLARATION = {
  name: "update_stage_meta",
  description:
    "Actualiza el estado interno de avance dentro del flujo de la etapa actual (por ejemplo, en qué paso del flujo de 7 pasos del Insight vas). No se muestra directamente al usuario.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      // Gemini no soporta un tipo "objeto libre" (equivalente a {} sin properties
      // declaradas) tan bien como Claude — se pide como texto JSON por el mismo motivo
      // que "value" en record_proposal.
      meta_json: {
        type: Type.STRING,
        description: 'Texto JSON con el estado de avance, por ejemplo \'{"insight_step": 3}\'.',
      },
    },
    required: ["meta_json"],
  },
};

// Herramienta de búsqueda nativa de Gemini (grounding con Google Search) — equivalente
// de getWebSearchTool() en systemPrompt.js. IMPORTANTE: ver conversationEngine.js y el
// README de esta carpeta — combinar esta herramienta con function calling en la MISMA
// llamada no está soportado de forma confiable en todos los modelos/endpoints de Gemini
// (depende de si usas Gemini 3 vía la API directa, o Vertex AI). El motor de conversación
// de esta carpeta resuelve esto haciendo DOS llamadas en las etapas que necesitan ambas
// cosas: una de búsqueda, y una de function calling con los resultados ya como contexto.
export const GOOGLE_SEARCH_TOOL = { googleSearch: {} };
