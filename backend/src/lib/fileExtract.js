import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { generateText, generateTextWithDocument } from "../anthropicClient.js";

const SUMMARY_SYSTEM = `Eres el Brand Builder de AHA Consulting. Vas a analizar un archivo que un cliente
subió como insumo para construir la estrategia de su marca. Escribe un resumen claro,
en español, en tono "tú", de máximo 200 palabras, que capture:
- De qué tipo de documento se trata.
- Los datos concretos y accionables más relevantes para construir una estrategia de marca
  (historia, portafolio, clientes, precios, competencia, ventas, estudios de consumidor,
  personalidad de marca previa, etc. — lo que aplique).
No inventes datos que no estén en el documento. Si el documento no aporta nada útil para
branding, dilo brevemente.`;

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
        prompt: "Analiza este PDF y resúmelo siguiendo las instrucciones del sistema.",
        base64,
        mediaType: "application/pdf",
        isImage: false,
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
        prompt: "Analiza esta imagen (podría ser un toolkit de marca, una captura de redes sociales, un reporte, etc.) y resúmela siguiendo las instrucciones del sistema.",
        base64,
        mediaType: guessMediaType(ext),
        isImage: true,
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
  const trimmed = text.slice(0, 30000);
  if (!trimmed.trim()) return "El archivo no contiene texto extraíble.";
  return generateText({
    system: SUMMARY_SYSTEM,
    prompt: `Archivo: ${filename}\n\nContenido:\n${trimmed}`,
    maxTokens: 500,
  });
}
