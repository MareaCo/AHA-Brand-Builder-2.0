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
// Uso (acepta tanto el export de una sola sesión como el de --all con varios clientes):
//   cd migration/data-migration
//   npm install firebase-admin   (una sola vez)
//   GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/tu-credencial.json \
//     node importToFirestore.js todos-los-clientes.json
//
// Donde el archivo .json es el que produjo exportFromSqlite.js (con --all o con un
// sessionId puntual — este script detecta cuál de los dos es).
//
// Por qué se escribe en lotes (batch) y no documento por documento: Firestore permite
// hasta 500 escrituras por lote, y un lote es atómico (si una escritura falla dentro de
// ese lote, ninguna de ese lote se aplica) — más seguro que escribir una por una y
// quedar con datos a medias si algo truena a mitad de camino. Se dividen las operaciones
// en lotes de 400 (con margen bajo el límite de 500) para que esto funcione igual con una
// sola sesión o con todos los clientes reales de una sola vez.

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { transformSessionTree, transformAll } from "./transformToFirestore.js";

const BATCH_SIZE = 400;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

const exportedFilePath = process.argv[2];
if (!exportedFilePath) {
  console.error("Uso: node importToFirestore.js <archivo-exportado.json>");
  process.exit(1);
}

const exportedJson = JSON.parse(readFileSync(exportedFilePath, "utf-8"));

// --all produce un array (una entrada por sesión); un export puntual produce un solo
// objeto con { client, brand, session, ... }.
const ops = Array.isArray(exportedJson) ? transformAll(exportedJson) : transformSessionTree(exportedJson);

initializeApp();
const db = getFirestore();

console.log(`Escribiendo ${ops.length} documentos en Firestore...`);
for (const op of ops) console.log(`  - ${op.path}`);

for (const group of chunk(ops, BATCH_SIZE)) {
  const batch = db.batch();
  for (const op of group) batch.set(db.doc(op.path), op.data);
  await batch.commit();
}

console.log("\nListo. Verifica en la consola de Firebase que cada sesión aparezca completa.");
