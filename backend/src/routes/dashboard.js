import { Router } from "express";
import { prisma } from "../db.js";
import { TOTAL_STAGES } from "../lib/stageDefinitions.js";

export const router = Router();

// Vista jerárquica: clientes -> marcas -> sesiones, con progreso por sesión.
router.get("/", async (req, res) => {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      brands: {
        orderBy: { createdAt: "desc" },
        include: {
          sessions: {
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
  });

  const result = clients.map((client) => ({
    ...client,
    brands: client.brands.map((brand) => ({
      ...brand,
      sessions: brand.sessions.map((session) => ({
        ...session,
        totalStages: TOTAL_STAGES,
        progressLabel: `Etapa ${session.currentStage} de ${TOTAL_STAGES - 1}`,
      })),
    })),
  }));

  res.json(result);
});
