import { generateText } from "../anthropicClient.js";
import { buildAccumulatedSummary } from "./summary.js";

const SYSTEM = `Eres un auditor de estrategia de marca de AHA Consulting. Vas a revisar TODO lo que se
ha validado hasta ahora en un proceso de Brand Builder — territorio de marca, insight,
concepto, propósito, target, propuesta de valor, y lo que exista de la pirámide — y
detectar si hay contradicciones genuinas entre etapas. Por ejemplo: un target que no
encaja con el insight, un beneficio que contradice el territorio ("qué no es"), un pilar
de propuesta de valor que no se sostiene en el propósito o la definición del negocio, una
personalidad o arquetipo que no calza con el tono del insight, etc. Revisa TODAS las
etapas presentes, no solo un subconjunto.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta forma:
{ "coherente": boolean, "alertas": [ "texto de alerta 1", ... ] }
Si no encuentras ninguna inconsistencia real, devuelve coherente: true y alertas: [].
Sé exigente pero justo: solo señala contradicciones genuinas, no diferencias de matiz ni
cosas que simplemente todavía no se han construido.`;

// Revisa todo lo validado hasta ahora (funciona en cualquier etapa, no solo desde que
// existe la Pirámide) buscando contradicciones reales entre etapas. A diferencia de una
// versión anterior de este chequeo, NUNCA falla "hacia coherente": si la llamada falla
// por cualquier razón, devuelve coherente: null (desconocido) para que la interfaz lo
// distinga claramente de un chequeo real que sí pasó.
export async function runCoherenceCheck(stageDataRows) {
  const summary = buildAccumulatedSummary(stageDataRows);

  if (summary === "Todavía no hay etapas validadas.") {
    return { coherente: true, alertas: [] };
  }

  const prompt = `Todo lo validado hasta ahora:\n\n${summary}`;

  try {
    const raw = await generateText({ system: SYSTEM, prompt, maxTokens: 700 });
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      coherente: Boolean(parsed.coherente),
      alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
    };
  } catch (err) {
    return {
      coherente: null,
      alertas: [],
      error: `No se pudo verificar la coherencia automáticamente (${err.message}). Esto no significa que esté bien — solo que no se pudo revisar.`,
    };
  }
}
