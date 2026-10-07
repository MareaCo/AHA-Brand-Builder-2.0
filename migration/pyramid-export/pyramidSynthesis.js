// Síntesis de la Pirámide para el one-pager gráfico — equivalente de
// backend/src/lib/pyramidSynthesis.js, usando Gemini en vez de Claude.
//
// El prompt del sistema es IDÉNTICO al original (es la parte ya probada y afinada: frases
// cortas, no inventar contenido, responder solo JSON). Lo único que cambia es la llamada
// al modelo.
//
// AVISO: igual que conversationEngine.js del Sprint 2, este archivo NO se ha probado
// contra la API real de Gemini en este entorno (no hay clave disponible aquí). Antes de
// confiar en él en producción, pruébalo con una clave real y compara el JSON resultante
// contra el de la versión actual con Claude para la misma pirámide.
//
// Requiere: npm install @google/genai

import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3-pro-preview";

const SYSTEM = `Eres el Brand Builder de AHA Consulting. Vas a condensar el contenido ya construido de
una Pirámide de Marca en frases MUY cortas (máximo 8-10 palabras cada una) para que
quepan como texto de un one-pager gráfico — el equipo de mercadeo lo va a usar como
referencia visual, así que cada celda debe leerse de un vistazo, no como un párrafo.

No inventes contenido nuevo: solo sintetiza lo que ya está ahí, conservando la esencia
de lo que dice. Si un campo llega vacío (null), déjalo como null.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta forma
exacta (mismas claves, valores en string corto o null):
{
  "entorno_competitivo": "...", "target": "...", "asociaciones_marca": "...", "insight": "...",
  "razones_para_creer": "...", "personalidad": "...", "beneficios_racionales": "...", "beneficios_emocionales": "...",
  "proposito": "...", "esencia": "...",
  "arquetipo_dominante": "...", "arquetipo_secundario": "...", "territorio_marca": "..."
}`;

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está configurada. Consíguela en Google AI Studio.");
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export async function synthesizePyramidCopy(pyramidData) {
  const flat = {
    ...pyramidData.base,
    ...pyramidData.medio,
    ...pyramidData.alto,
    ...pyramidData.cuspide,
    ...pyramidData.aparte,
  };

  const prompt = `Contenido actual de la pirámide:\n${JSON.stringify(flat, null, 2)}`;

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction: SYSTEM },
  });

  const raw = response.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") || "";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    base: {
      entorno_competitivo: parsed.entorno_competitivo ?? null,
      target: parsed.target ?? null,
      asociaciones_marca: parsed.asociaciones_marca ?? null,
      insight: parsed.insight ?? null,
    },
    medio: {
      razones_para_creer: parsed.razones_para_creer ?? null,
      personalidad: parsed.personalidad ?? null,
      beneficios_racionales: parsed.beneficios_racionales ?? null,
      beneficios_emocionales: parsed.beneficios_emocionales ?? null,
    },
    alto: { proposito: parsed.proposito ?? null },
    cuspide: { esencia: parsed.esencia ?? null },
    aparte: {
      arquetipo_dominante: parsed.arquetipo_dominante ?? null,
      arquetipo_secundario: parsed.arquetipo_secundario ?? null,
      territorio_marca: parsed.territorio_marca ?? null,
    },
  };
}
