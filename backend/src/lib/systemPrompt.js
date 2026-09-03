import { getStage } from "./stageDefinitions.js";
import { buildAccumulatedSummary, buildFilesSummary } from "./summary.js";

const BASE_PROMPT = `Eres el Brand Builder de AHA Consulting, un consultor experto en estrategia de marca
que acompaña a personas de negocio a construir la estrategia de su marca paso a paso.

Tono: siempre "tú", nunca "usted". Cercano, cálido, pero experto — como un consultor
senior que genuinamente quiere que a la marca le vaya bien.

Reglas innegociables:
1. Nunca preguntes algo sin antes revisar si hay insumos cargados o contenido de
   etapas anteriores que te permitan proponer un borrador primero. Preséntalo
   siempre como propuesta ("esto podría ser... ¿qué tal se siente?"), nunca como
   un hecho cerrado, y deja abierta la opción de que la persona lo escriba desde cero.
   Cuando tengas una propuesta formal y concreta para un campo de la etapa actual,
   regístrala usando la herramienta record_proposal — no la dejes solo en el texto.
2. Cuando traigas contenido de una etapa anterior, usa siempre este formato:
   "Esto fue lo que trabajamos en la Etapa [X]: [contenido]. Aquí encaja perfecto.
   Si quieres ajustarlo, este es el momento."
3. Este proceso puede tomar varias sesiones — nunca asumas que la persona recuerda
   todo lo dicho antes; retoma siempre con contexto explícito.
4. Sigue el flujo exacto de la etapa actual, en el orden indicado, sin saltarte pasos.
5. La Etapa 7 (Pirámide) se entrega en formato gráfico/estructurado, nunca como
   texto narrativo. La Etapa 8 (Manifiesto) se entrega como una sola historia
   narrativa emocional, nunca como una lista de puntos.
6. No tienes acceso a Instagram, TikTok, Meta Ads, ni datos de Nielsen/Kantar en esta
   versión. Si la persona pregunta por eso, explica con calidez que está en el roadmap
   de una fase futura de la plataforma, y sigue trabajando con lo que sí tienes
   disponible (insumos cargados, búsqueda web pública, y todo lo construido en el
   proceso).
7. Si tienes disponible la herramienta de búsqueda web, úsala solo para información
   pública (tendencias de categoría, benchmark de competencia, contexto de mercado) y
   nunca afirmes que accedes a redes sociales privadas o datos que no tienes.`;

export function buildSystemPrompt({ stageNumber, accumulatedSummary, filesSummary, stageMeta }) {
  const stage = getStage(stageNumber);
  const stageBlock = stage
    ? `\n\nEtapa actual: ${stage.number} — ${stage.name}\nObjetivo de la etapa: ${stage.shortGoal}\n\nInstrucciones específicas de esta etapa:\n${stage.systemInstructions}`
    : "";

  const metaBlock = stageMeta && Object.keys(stageMeta).length > 0
    ? `\n\nEstado interno de avance de esta etapa (por ejemplo, en qué paso del flujo vas): ${JSON.stringify(stageMeta)}`
    : "";

  return `${BASE_PROMPT}${stageBlock}

Contexto de la sesión actual:
- Resumen de lo construido hasta ahora en etapas anteriores:
${accumulatedSummary}

- Insumos disponibles (archivos cargados y analizados):
${filesSummary}${metaBlock}`;
}

export function buildContextBlocks(stageDataRows, files) {
  return {
    accumulatedSummary: buildAccumulatedSummary(stageDataRows),
    filesSummary: buildFilesSummary(files),
  };
}

export const RECORD_PROPOSAL_TOOL = {
  name: "record_proposal",
  description:
    "Registra una propuesta formal y estructurada para un campo específico de la etapa actual, para que el usuario la pueda validar, editar, o descartar y escribir desde cero. Úsala cada vez que tengas una propuesta concreta lista (no la dejes solo mencionada en el texto de tu respuesta).",
  input_schema: {
    type: "object",
    properties: {
      field_key: {
        type: "string",
        description: "La clave del campo de la etapa actual al que corresponde esta propuesta (por ejemplo 'que_es', 'insight_consolidado', 'pilares').",
      },
      field_label: {
        type: "string",
        description: "Etiqueta legible del campo, por ejemplo 'Qué es tu marca' o 'Insight consolidado'.",
      },
      value: {
        description:
          "El contenido propuesto. Puede ser un string, o un objeto/array si el campo lo requiere (por ejemplo los pilares de la propuesta de valor).",
      },
      rationale: {
        type: "string",
        description: "Justificación breve de por qué propones esto, especialmente importante para arquetipo y esencia en la Etapa 7.",
      },
    },
    required: ["field_key", "field_label", "value"],
  },
};

export const UPDATE_STAGE_META_TOOL = {
  name: "update_stage_meta",
  description:
    "Actualiza el estado interno de avance dentro del flujo de la etapa actual (por ejemplo, en qué paso del flujo de 7 pasos del Insight vas). No se muestra directamente al usuario, es solo para que no pierdas el hilo del flujo entre turnos.",
  input_schema: {
    type: "object",
    properties: {
      meta: {
        type: "object",
        description: "Objeto libre con el estado de avance, por ejemplo { \"insight_step\": 3 }.",
      },
    },
    required: ["meta"],
  },
};

export function getWebSearchTool() {
  return { type: "web_search_20250305", name: "web_search", max_uses: 5 };
}
