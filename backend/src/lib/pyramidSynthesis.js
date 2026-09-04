import { generateText } from "../anthropicClient.js";

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

export async function synthesizePyramidCopy(pyramidData) {
  const flat = {
    ...pyramidData.base,
    ...pyramidData.medio,
    ...pyramidData.alto,
    ...pyramidData.cuspide,
    ...pyramidData.aparte,
  };

  const prompt = `Contenido actual de la pirámide:\n${JSON.stringify(flat, null, 2)}`;

  const raw = await generateText({ system: SYSTEM, prompt, maxTokens: 600 });
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
