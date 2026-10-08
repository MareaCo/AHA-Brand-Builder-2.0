// Sprint 5 — paso 3: escribe en Firestore las operaciones que produjo
// transformToFirestore.js. Este es el único de los 3 pasos que SÍ necesita
// credenciales reales (una cuenta de servicio de Firebase) — por eso no se pudo
// ejecutar en este entorno. Los pasos 1 y 2 (exportFromSqlite.js, transformToFirestore.js)
// ya están verificados contra datos reales — ver README.md.
//
// Cómo conseguir la credencial: en la consola de Firebase de tu proyecto → Configuración
// del proyecto → Cuentas de servicio → "Generar nueva clave privada" → descarga el
// archivo .json y guárdalo FUERA de este repositorio (nunca lo subas a git).
//
// Uso:
//   cd migration/data-migration
//   npm install firebase-admin   (una sola vez)
//   GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/tu-credencial.json \
//     node importToFirestore.js sesion-exportada.json
//
// Donde "sesion-exportada.json" es el archivo que produjo exportFromSqlite.js.
//
// Por qué se escribe en lotes (batch) y no documento por documento: Firestore permite
// hasta 500 escrituras por lote, y un lote es atómico (si una escritura falla, ninguna se
// aplica) — más seguro que escribir una por una y quedar con datos a medias si algo
// truena a mitad de camino. Una sesión completa de esta app (client + brand + session +
// hasta 9 stageData + archivos + entregables + mensajes) nunca se acerca a 500.

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { transformSessionTree } from "./transformToFirestore.js";

const exportedFilePath = process.argv[2];
if (!exportedFilePath) {
  console.error("Uso: node importToFirestore.js <archivo-exportado.json>");
  process.exit(1);
}

const exportedJson = JSON.parse(readFileSync(exportedFilePath, "utf-8"));
const ops = transformSessionTree(exportedJson);

initializeApp();
const db = getFirestore();

const batch = db.batch();
for (const op of ops) {
  batch.set(db.doc(op.path), op.data);
}

console.log(`Escribiendo ${ops.length} documentos en Firestore...`);
for (const op of ops) console.log(`  - ${op.path}`);

await batch.commit();

console.log("\nListo. Verifica en la consola de Firebase que la sesión aparezca completa:");
console.log(`  brands/${exportedJson.brand.id}/sessions/${exportedJson.session.id}`);
