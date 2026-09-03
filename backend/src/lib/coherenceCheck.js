import { generateText } from "../anthropicClient.js";
import { buildPyramidData } from "./pyramidData.js";

const SYSTEM = `Eres un auditor de estrategia de marca de AHA Consulting. Vas a revisar la Pirámide
de Marca que se acaba de construir y detectar si hay contradicciones internas entre el
insight, los beneficios, el propósito, la personalidad y el arquetipo propuesto.
Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta forma:
{ "coherente": boolean, "alertas": [ "texto de alerta 1", ... ] }
Si no encuentras ninguna inconsistencia real, devuelve coherente: true y alertas: [].
Sé exigente pero justo: solo señala contradicciones genuinas, no diferencias de matiz.`;

export async function runCoherenceCheck(stageDataRows) {
  const pyramid = buildPyramidData(stageDataRows);
  const prompt = `Pirámide de marca consolidada:\n${JSON.stringify(pyramid, null, 2)}`;

  try {
    const raw = await generateText({ system: SYSTEM, prompt, maxTokens: 600 });
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      coherente: Boolean(parsed.coherente),
      alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
    };
  } catch (err) {
    return {
      coherente: true,
      alertas: [],
      error: `No se pudo ejecutar el chequeo de coherencia automáticamente (${err.message}).`,
    };
  }
}
