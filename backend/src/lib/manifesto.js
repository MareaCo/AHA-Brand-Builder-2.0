import { generateText } from "../anthropicClient.js";
import { buildAccumulatedSummary } from "./summary.js";
import { buildPyramidData } from "./pyramidData.js";

const TONES = [
  {
    key: "poetica",
    label: "Poética",
    instruction: "Tono poético: metafórico, sensorial, con ritmo casi de verso libre, que emocione sin gritar.",
  },
  {
    key: "directa",
    label: "Directa",
    instruction: "Tono directo: frases cortas y contundentes, sin adornos innecesarios, que se sienta como una declaración firme.",
  },
  {
    key: "provocadora",
    label: "Provocadora",
    instruction: "Tono provocador: reta al lector, cuestiona el status quo de la categoría, incomoda un poco antes de inspirar.",
  },
];

const MANIFESTO_SYSTEM = `Eres el Brand Builder de AHA Consulting. Vas a escribir el Manifiesto de Marca: una
sola historia narrativa y emocional, lista para usarse incluso como guion de video.
Nunca lo escribas como lista de bullets ni como texto corporativo plano — es una pieza
narrativa con alma. Tono "tú" al pensar el proceso, pero el manifiesto en sí habla en
primera persona plural de la marca ("Nosotros...").

Usa como plantilla de partida — no como camisa de fuerza — frases del estilo:
"Nosotros pensamos... / sentimos... / rechazamos... / nunca... / siempre... / amamos... /
somos... / nos comportamos... / queremos... / creemos... / sabemos... / Porque nosotros..."

No inventes datos de producto que no estén en el contexto de la marca. Responde SOLO con
el texto del manifiesto, sin encabezados ni explicaciones adicionales.`;

export async function generateManifestoVariant({ stageDataRows, toneKey }) {
  const tone = TONES.find((t) => t.key === toneKey) || TONES[0];
  const summary = buildAccumulatedSummary(stageDataRows);
  const pyramid = buildPyramidData(stageDataRows);

  const prompt = `Toda la estrategia de marca construida hasta ahora:

${summary}

Pirámide de marca consolidada:
${JSON.stringify(pyramid, null, 2)}

Escribe el Manifiesto de Marca completo en ${tone.instruction}`;

  const text = await generateText({ system: MANIFESTO_SYSTEM, prompt, maxTokens: 900 });
  return { tone: tone.key, label: tone.label, text };
}

export async function generateAllManifestoVariants(stageDataRows) {
  const variants = [];
  for (const tone of TONES) {
    // secuencial para no saturar rate limits del API con llamadas en paralelo
    // eslint-disable-next-line no-await-in-loop
    const variant = await generateManifestoVariant({ stageDataRows, toneKey: tone.key });
    variants.push(variant);
  }
  return variants;
}

export function formatAsVideoScript(text) {
  const sentences = text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences
    .map((s, i) => {
      const pause = /[.!?]$/.test(s) ? "[pausa]" : "[respira]";
      return `${String(i + 1).padStart(2, "0")}. ${s} ${pause}`;
    })
    .join("\n");
}

export const MANIFESTO_TONES = TONES;
