import { Router } from "express";
import { prisma } from "../db.js";

export const router = Router();

router.get("/", async (req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  res.json(clients);
});

router.post("/", async (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: "El nombre del cliente es obligatorio." });
  const client = await prisma.client.create({ data: { name, email: email || null } });
  res.status(201).json(client);
});

router.get("/:clientId/brands", async (req, res) => {
  const brands = await prisma.brand.findMany({
    where: { clientId: req.params.clientId },
    orderBy: { createdAt: "desc" },
  });
  res.json(brands);
});

router.post("/:clientId/brands", async (req, res) => {
  const { name, industry } = req.body;
  if (!name) return res.status(400).json({ error: "El nombre de la marca es obligatorio." });
  const brand = await prisma.brand.create({
    data: { name, industry: industry || null, clientId: req.params.clientId },
  });
  res.status(201).json(brand);
});
