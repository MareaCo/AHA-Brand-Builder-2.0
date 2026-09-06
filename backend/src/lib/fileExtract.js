import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { generateText, generateTextWithDocument } from "../anthropicClient.js";

const SUMMARY_SYSTEM = `Eres el Brand Builder de AHA Consulting. Vas a analizar EN PROFUNDIDAD un archivo que
un cliente subió como insumo para construir la estrategia de su marca. Este análisis es
la única base que las 9 etapas siguientes van a tener de este documento — no vuelven a
leerlo completo — así que tu trabajo es extraer TODO lo que sea útil, no resumirlo por
encima. Un dato que omites aquí queda perdido para todo el proceso.

NO es un resumen narrativo corto. Es una extracción estructurada y exhaustiva, en
español, tono "tú". Organízala en las secciones que apliquen (omite las que no):

- Historia de la marca / origen
- Portafolio de productos o servicios (con nombres, líneas, diferencias entre ellas)
- Clientes / consumidores (segmentos, diferencias por línea de producto)
- Canales de venta, precios (cifras concretas si existen), competencia mencionada,
  ventas o participación de mercado (cifras si existen)
- Estudios de consumidor, citas textuales de clientes, hallazgos de investigación
- Personalidad o toolkit de marca previo, tono de voz existente
- Cualquier otro dato concreto y accionable para branding que no encaje arriba

Para cada dato: conserva cifras exactas, nombres propios, citas textuales entre comillas
y matices — no los generalices ni los redondees. Prefiere una lista larga y específica a
un párrafo corto y genérico. No hay límite de longitud — sé tan extenso como el
documento lo amerite.

No inventes datos que no estén en el documento. Si el documento no aporta nada útil para
branding, dilo brevemente y no fuerces contenido de las secciones vacías.`;

function guessMediaType(ext) {
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf": "application/pdf",
  };
  return map[ext] || "application/octet-stream";
}

export async function extractAndSummarize({ absolutePath, filename, mimeType }) {
  const ext = path.extname(filename).toLowerCase();
  let extractedText = "";
  let summary = "";

  try {
    if (ext === ".pdf") {
      const buffer = await fs.readFile(absolutePath);
      const base64 = buffer.toString("base64");
      summary = await generateTextWithDocument({
        system: SUMMARY_SYSTEM,
        prompt: "Analiza este PDF a fondo siguiendo las instrucciones del sistema.",
        base64,
        mediaType: "application/pdf",
        isImage: false,
        maxTokens: 3000,
      });
      extractedText = "[Contenido de PDF analizado directamente por Claude]";
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: absolutePath });
      extractedText = result.value || "";
      summary = await summarizeText(extractedText, filename);
    } else if (ext === ".xlsx" || ext === ".xls") {
      const workbook = XLSX.readFile(absolutePath);
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        return `Hoja: ${name}\n${csv}`;
      });
      extractedText = sheets.join("\n\n").slice(0, 20000);
      summary = await summarizeText(extractedText, filename);
    } else if (ext === ".txt" || ext === ".csv" || ext === ".md") {
      extractedText = await fs.readFile(absolutePath, "utf-8");
      summary = await summarizeText(extractedText, filename);
    } else if ([".png", ".jpg", ".jpeg"].includes(ext)) {
      const buffer = await fs.readFile(absolutePath);
      const base64 = buffer.toString("base64");
      summary = await generateTextWithDocument({
        system: SUMMARY_SYSTEM,
        prompt: "Analiza esta imagen a fondo (podría ser un toolkit de marca, una captura de redes sociales, un reporte, etc.) siguiendo las instrucciones del sistema.",
        base64,
        mediaType: guessMediaType(ext),
        isImage: true,
        maxTokens: 2000,
      });
      extractedText = "[Imagen analizada directamente por Claude]";
    } else {
      summary = `Formato de archivo (${ext || mimeType}) no soportado para análisis automático todavía. El archivo quedó guardado y disponible para revisión manual.`;
    }
  } catch (err) {
    summary = `No se pudo analizar automáticamente este archivo (${err.message}). Quedó guardado igual como insumo de referencia.`;
  }

  return { extractedText: extractedText.slice(0, 100000), summary };
}

async function summarizeText(text, filename) {
  const trimmed = text.slice(0, 60000);
  if (!trimmed.trim()) return "El archivo no contiene texto extraíble.";
  return generateText({
    system: SUMMARY_SYSTEM,
    prompt: `Archivo: ${filename}\n\nContenido:\n${trimmed}`,
    maxTokens: 3000,
  });
}
