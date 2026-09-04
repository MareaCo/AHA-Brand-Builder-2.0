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
sola historia narrativa y emocional, corta, lista para leerse en voz alta o usarse como
guion de video en menos de un minuto. Nunca lo escribas como lista de bullets ni como
texto corporativo plano. El manifiesto habla en primera persona plural de la marca
("Nosotros...").

Límite estricto: máximo 150 palabras, 5-7 frases en total. Esto no es negociable — un
manifiesto largo aburre y se deja de leer. Prefiere decir una sola cosa muy bien dicha
a decir diez cosas a medias.

Escríbelo como una historia con arco narrativo real — un principio que plantea la
tensión humana (el insight), un giro que muestra cómo la marca responde a esa tensión
(su propósito y diferencial), y un cierre que aterriza en una sola frase memorable. No
es una lista de afirmaciones sueltas.

Puedes usar como semilla — nunca como camisa de fuerza — frases del estilo "Nosotros
pensamos / sentimos / rechazamos / nunca / siempre / creemos / Porque nosotros...", pero
JAMÁS encadenes más de dos frases seguidas con la misma estructura anafórica (por
ejemplo, nunca tres "Nunca vamos a..." seguidos, o tres "Amamos..." seguidos) — eso sí
sería una lista disfrazada de párrafo, y sonaría repetitivo y monótono en vez de fluido.
Varía el ritmo de las frases: cortas y largas, distintas construcciones.

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

  const text = await generateText({ system: MANIFESTO_SYSTEM, prompt, maxTokens: 400 });
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
