// Sprint 5 — paso 1: exportar sesiones completas (cliente, marca, sesión, etapas,
// archivos, entregables, mensajes) desde la base de datos SQLite real de la app actual,
// a un único archivo JSON.
//
// Se corre desde CUALQUIER carpeta (no es necesario hacer `cd backend` primero) contra
// la base de datos real, nunca contra una copia — es un export de solo lectura, no borra
// ni modifica nada:
//
//   node migration/data-migration/exportFromSqlite.js --all > todos-los-clientes.json
//   node migration/data-migration/exportFromSqlite.js <sessionId> > una-sesion.json
//
// --all exporta TODOS los clientes/marcas/sesiones reales que existan en la base de
// datos (por ejemplo, Autollantas Nutibara y Kansha al mismo tiempo) — produce un array
// con un árbol completo por cada sesión. <sessionId> exporta solo una sesión puntual (el
// id de la fila en la tabla `sessions`, visible en Prisma Studio con `npx prisma studio`).
//
// Por qué esto no es un simple `import { PrismaClient } from "@prisma/client"`: este
// archivo vive en migration/data-migration/, pero el cliente de Prisma ya generado solo
// existe en backend/node_modules/ — Node busca node_modules subiendo desde la carpeta del
// archivo que hace el import, nunca en una carpeta hermana, así que un import normal aquí
// nunca lo encuentra (sin importar desde dónde se corra el comando). Por eso se resuelve
// a mano, apuntando directo a esa carpeta.
//
// PROBADO en este entorno contra una base de datos SQLite de prueba sembrada con datos
// representativos de 2 clientes distintos (incluyendo los casos difíciles: un pilar
// todavía en formato narrado viejo, y un status agregado "pegado" de versiones
// anteriores), ejecutando el comando literal de arriba — ver README.md, sección de
// verificación. No se probó contra la base de datos real de producción porque esta vive
// solo en la máquina de Catalina, no en este entorno.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const requireFromBackend = createRequire(join(__dirname, "../../backend/package.json"));
const { PrismaClient } = requireFromBackend("@prisma/client");

// Sin pasar ninguna opción: Prisma Client resuelve DATABASE_URL (y la ruta del archivo
// .db, si es relativa) igual que siempre lo ha hecho para la app actual — relativo a la
// carpeta del propio schema.prisma, no a la carpeta desde donde se corre este script.
const prisma = new PrismaClient();

const SESSION_INCLUDE = {
  brand: { include: { client: true } },
  stageData: true,
  files: true,
  deliverables: true,
  messages: true,
};

function shapeSession(session) {
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

export async function exportSession(sessionId) {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: SESSION_INCLUDE });
  if (!session) {
    throw new Error(`No existe ninguna sesión con id "${sessionId}".`);
  }
  return shapeSession(session);
}

// Exporta TODAS las sesiones de TODOS los clientes/marcas existentes — un árbol completo
// por sesión, en un array. Si un cliente tiene varias marcas, o una marca tiene varias
// sesiones, cada una sale como su propia entrada (transformToFirestore.js se encarga de
// no duplicar el documento de cliente/marca si varias sesiones lo comparten).
export async function exportAllSessions() {
  const sessions = await prisma.session.findMany({ include: SESSION_INCLUDE });
  return sessions.map(shapeSession);
}

const arg = process.argv[2];
if (!arg) {
  console.error("Uso: node exportFromSqlite.js --all > archivo.json");
  console.error("  o: node exportFromSqlite.js <sessionId> > archivo.json");
  process.exit(1);
}

const exportPromise = arg === "--all" ? exportAllSessions() : exportSession(arg);

exportPromise
  .then((data) => console.log(JSON.stringify(data, null, 2)))
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
