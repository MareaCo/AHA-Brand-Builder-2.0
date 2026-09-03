import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../db.js";
import { extractAndSummarize } from "../lib/fileExtract.js";

export const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set([".pdf", ".docx", ".xlsx", ".xls", ".txt", ".csv", ".md", ".png", ".jpg", ".jpeg"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`Tipo de archivo no soportado: ${ext}`));
    }
    cb(null, true);
  },
});

router.get("/sessions/:sessionId/files", async (req, res) => {
  const files = await prisma.uploadedFile.findMany({
    where: { sessionId: req.params.sessionId },
    orderBy: { createdAt: "asc" },
  });
  res.json(files);
});

router.post("/sessions/:sessionId/files", upload.single("file"), async (req, res) => {
  const { sessionId } = req.params;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: "Sesión no encontrada." });
  if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo." });

  const fileType = path.extname(req.file.originalname).replace(".", "").toLowerCase();

  const record = await prisma.uploadedFile.create({
    data: {
      sessionId,
      filename: req.file.originalname,
      fileType,
      storagePath: req.file.path,
      extractedSummary: "Analizando...",
    },
  });

  try {
    const { extractedText, summary } = await extractAndSummarize({
      absolutePath: req.file.path,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    const updated = await prisma.uploadedFile.update({
      where: { id: record.id },
      data: { extractedSummary: summary, extractedText },
    });
    return res.status(201).json(updated);
  } catch (err) {
    const updated = await prisma.uploadedFile.update({
      where: { id: record.id },
      data: { extractedSummary: `No se pudo analizar automáticamente: ${err.message}` },
    });
    return res.status(201).json(updated);
  }
});

router.delete("/sessions/:sessionId/files/:fileId", async (req, res) => {
  const file = await prisma.uploadedFile.findUnique({ where: { id: req.params.fileId } });
  if (!file || file.sessionId !== req.params.sessionId) {
    return res.status(404).json({ error: "Archivo no encontrado." });
  }
  await prisma.uploadedFile.delete({ where: { id: file.id } });
  fs.promises.unlink(file.storagePath).catch(() => {});
  res.status(204).end();
});
