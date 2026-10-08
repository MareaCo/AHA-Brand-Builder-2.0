// Sprint 5 — paso 1: exportar una sesión completa (cliente, marca, sesión, etapas,
// archivos, entregables, mensajes) desde la base de datos SQLite real de la app actual,
// a un único archivo JSON.
//
// Se ejecuta DESDE backend/ (necesita el cliente de Prisma ya generado ahí) contra la
// base de datos real, nunca contra una copia — es un export de solo lectura, no borra ni
// modifica nada:
//
//   cd backend
//   node ../migration/data-migration/exportFromSqlite.js <sessionId> > sesion-exportada.json
//
// <sessionId> es el id de la fila en la tabla `sessions` (lo puedes ver en Prisma Studio
// con `npx prisma studio`, o en la URL de la app mientras trabajas esa sesión).
//
// PROBADO en este entorno contra una base de datos SQLite de prueba sembrada con datos
// representativos (incluyendo los casos difíciles: un pilar todavía en formato narrado
// viejo, y un status agregado "pegado" de versiones anteriores) — ver README.md, sección
// de verificación. No se probó contra la base de datos real de producción porque esta
// vive solo en la máquina de Catalina, no en este entorno.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function exportSession(sessionId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      brand: { include: { client: true } },
      stageData: true,
      files: true,
      deliverables: true,
      messages: true,
    },
  });

  if (!session) {
    throw new Error(`No existe ninguna sesión con id "${sessionId}".`);
  }

  const { brand, stageData, files, deliverables, messages, ...sessionFields } = session;
  const { client, ...brandFields } = brand;

  return {
    client,
    brand: brandFields,
    session: sessionFields,
    stageData,
    files,
    deliverables,
    messages,
  };
}

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("Uso: node exportFromSqlite.js <sessionId> > archivo.json");
  process.exit(1);
}

exportSession(sessionId)
  .then((data) => console.log(JSON.stringify(data, null, 2)))
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
