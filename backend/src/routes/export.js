import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "../db.js";
import { buildAccumulatedSummary } from "../lib/summary.js";
import { getStage, STAGES } from "../lib/stageDefinitions.js";

export const router = Router();

const EXPORT_DIR = process.env.EXPORT_DIR || "./exports";
await fs.mkdir(EXPORT_DIR, { recursive: true });

const NAVY = rgb(0x28 / 255, 0x20 / 255, 0x72 / 255);
const LIME = rgb(0xb3 / 255, 0xde / 255, 0x4a / 255);
const TEXT = rgb(0.12, 0.12, 0.16);

function wrapText(text, font, size, maxWidth) {
  const words = (text || "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Genera el PDF final con ambos entregables: la Pirámide (como imagen recibida
// del canvas del frontend) y el Manifiesto (texto narrativo), más un resumen
// ejecutivo de las 9 etapas.
router.post("/sessions/:sessionId/export/final", async (req, res) => {
  const { sessionId } = req.params;
  const { pyramidImageBase64, manifestoText, manifestoTone } = req.body;

  const [session, stageDataRows] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId }, include: { brand: { include: { client: true } } } }),
    prisma.stageData.findMany({ where: { sessionId } }),
  ]);
  if (!session) return res.status(404).json({ error: "Sesión no encontrada." });

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;

  // Portada
  const cover = pdfDoc.addPage([pageWidth, pageHeight]);
  cover.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: NAVY });
  cover.drawRectangle({ x: 0, y: pageHeight / 2 - 4, width: pageWidth, height: 8, color: LIME });
  cover.drawText("AHA Brand Builder", {
    x: margin,
    y: pageHeight / 2 + 60,
    size: 28,
    font: bold,
    color: rgb(1, 1, 1),
  });
  cover.drawText(session.brand?.name || "Marca", {
    x: margin,
    y: pageHeight / 2 + 20,
    size: 18,
    font,
    color: LIME,
  });
  cover.drawText(session.brand?.client?.name || "", {
    x: margin,
    y: pageHeight / 2 - 4,
    size: 12,
    font,
    color: rgb(0.85, 0.85, 0.95),
  });
  cover.drawText("Estrategia de Marca — Pirámide y Manifiesto", {
    x: margin,
    y: pageHeight / 2 - 40,
    size: 12,
    font,
    color: rgb(0.85, 0.85, 0.95),
  });

  // Resumen ejecutivo
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  page.drawText("Resumen ejecutivo", { x: margin, y, size: 20, font: bold, color: NAVY });
  y -= 30;

  const byNumber = {};
  for (const row of stageDataRows) byNumber[row.stageNumber] = row;

  for (const stage of STAGES) {
    if (stage.number === 0) continue;
    const row = byNumber[stage.number];
    let content = { fields: {} };
    try {
      content = JSON.parse(row?.content || "{}");
    } catch {
      content = { fields: {} };
    }
    const entries = Object.entries(content.fields || {}).filter(
      ([, f]) => f.status === "validado_por_usuario" || f.status === "editado_por_usuario"
    );
    if (entries.length === 0) continue;

    if (y < 120) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    page.drawText(`Etapa ${stage.number} — ${stage.name}`, { x: margin, y, size: 13, font: bold, color: NAVY });
    y -= 18;

    for (const [, f] of entries) {
      const label = f.label || "";
      const value = typeof f.value === "string" ? f.value : JSON.stringify(f.value);
      const lines = wrapText(`${label}: ${value}`, font, 10, pageWidth - margin * 2);
      for (const line of lines) {
        if (y < 60) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size: 10, font, color: TEXT });
        y -= 14;
      }
      y -= 4;
    }
    y -= 10;
  }

  // Pirámide (imagen)
  if (pyramidImageBase64) {
    const base64Data = pyramidImageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Buffer.from(base64Data, "base64");
    const isPng = pyramidImageBase64.includes("image/png");
    const image = isPng ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
    const pyramidPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pyramidPage.drawText("Pirámide de Marca", { x: margin, y: pageHeight - margin, size: 20, font: bold, color: NAVY });
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2 - 40;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const w = image.width * scale;
    const h = image.height * scale;
    pyramidPage.drawImage(image, {
      x: (pageWidth - w) / 2,
      y: (pageHeight - h) / 2 - 20,
      width: w,
      height: h,
    });
  }

  // Manifiesto (texto)
  if (manifestoText) {
    let mPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let my = pageHeight - margin;
    mPage.drawText("Manifiesto de Marca", { x: margin, y: my, size: 20, font: bold, color: NAVY });
    my -= 16;
    if (manifestoTone) {
      mPage.drawText(`Tono: ${manifestoTone}`, { x: margin, y: my, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
      my -= 24;
    } else {
      my -= 12;
    }
    const paragraphs = manifestoText.split(/\n+/);
    for (const paragraph of paragraphs) {
      const lines = wrapText(paragraph, font, 12, pageWidth - margin * 2);
      for (const line of lines) {
        if (my < 60) {
          mPage = pdfDoc.addPage([pageWidth, pageHeight]);
          my = pageHeight - margin;
        }
        mPage.drawText(line, { x: margin, y: my, size: 12, font, color: TEXT });
        my -= 18;
      }
      my -= 10;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const filename = `${sessionId}-${Date.now()}.pdf`;
  await fs.writeFile(path.join(EXPORT_DIR, filename), pdfBytes);

  await prisma.deliverable.create({
    data: {
      sessionId,
      type: "export_final",
      content: JSON.stringify({ filename }),
      format: "pdf",
      version: 1,
    },
  });

  res.status(201).json({ downloadUrl: `/exports/${filename}` });
});

export { router as exportRouter };
