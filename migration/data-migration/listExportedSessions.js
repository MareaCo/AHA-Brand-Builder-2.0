// Herramienta de apoyo para el Sprint 5: lee un archivo que produjo
// exportFromSqlite.js (--all o de una sola sesión) y muestra una tabla legible —
// cliente, marca, id de la sesión, estado, etapa actual, última actualización —
// ordenada por fecha más reciente primero.
//
// Para qué sirve: cuando un cliente tiene varias versiones/iteraciones guardadas (por
// ejemplo "Autollantas Nutibara", "Autollantas Nutibara V2", "Autollantas Nutibara V3"),
// esto ayuda a identificar cuál es la real/más reciente antes de decidir qué sessionId
// migrar — en vez de adivinar por el nombre.
//
// Uso:
//   node migration/data-migration/listExportedSessions.js todos-los-clientes.json

import { readFileSync } from "node:fs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Uso: node listExportedSessions.js <archivo-exportado.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(filePath, "utf-8"));
const sessions = Array.isArray(data) ? data : [data];

const rows = sessions
  .map((s) => ({
    actualizada: s.session.updatedAt,
    cliente: s.client.name,
    marca: s.brand.name,
    sessionId: s.session.id,
    estado: s.session.status,
    etapaActual: s.session.currentStage,
  }))
  .sort((a, b) => new Date(b.actualizada) - new Date(a.actualizada));

console.log(`${rows.length} sesión(es) encontrada(s), de más reciente a más antigua:\n`);
for (const row of rows) {
  console.log(
    `${row.actualizada}  |  ${row.cliente} / ${row.marca}  |  sessionId: ${row.sessionId}  |  estado: ${row.estado}  |  etapa actual: ${row.etapaActual}`
  );
}
