// node migration/data-migration/__tests__/transformToFirestore.test.mjs
//
// El fixture sample-export.json NO es un mock escrito a mano: es la salida real de
// exportFromSqlite.js corriendo contra una base de datos SQLite de prueba sembrada con
// Prisma (ver migration/data-migration/README.md) — incluye a propósito el caso
// delicado real: la Etapa 6 ("pilares") con solo 2 de los 3 elementos mínimos, pero con
// el status agregado y el status de la etapa completa guardados como
// "validado_por_usuario" (un dato "pegado"/desactualizado, el mismo patrón de bug que
// motivó el Sprint 1).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  transformClient,
  transformBrand,
  transformSession,
  transformStageDataRow,
  transformFile,
  transformDeliverable,
  transformMessage,
  transformSessionTree,
} from "../transformToFirestore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures/sample-export.json"), "utf-8"));

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${label}`);
}

check("transformClient usa el id real como parte del path y convierte createdAt a Date", () => {
  const r = transformClient(fixture.client);
  assert.equal(r.path, "clients/client-autollantas");
  assert.ok(r.data.createdAt instanceof Date);
  assert.equal(r.data.name, "Autollantas Nutibara");
  assert.equal(r.data.id, undefined);
});

check("transformBrand anida bajo el cliente y no repite clientId dentro del documento", () => {
  const r = transformBrand(fixture.brand);
  assert.equal(r.path, "clients/client-autollantas/brands/brand-nutibara");
  assert.equal(r.data.clientId, undefined);
});

check("transformSession anida bajo la marca y no repite brandId dentro del documento", () => {
  const r = transformSession(fixture.session, fixture.brand.id);
  assert.equal(r.path, "brands/brand-nutibara/sessions/session-autollantas-nutibara");
  assert.equal(r.data.brandId, undefined);
  assert.equal(r.data.currentStage, 8);
});

check("transformStageDataRow (Etapa 2, campo simple): content ya no es un string, es un objeto", () => {
  const row2 = fixture.stageData.find((s) => s.stageNumber === 2);
  const r = transformStageDataRow(row2, fixture.session.id);
  assert.equal(r.path, "sessions/session-autollantas-nutibara/stageData/2");
  assert.equal(typeof r.data.fields, "object");
  assert.equal(r.data.fields.insight_consolidado.value, "Los dueños de carro no confían en que les digan la verdad sobre lo que realmente necesitan.");
  assert.equal(r.data.status, "validado_por_usuario");
});

check("transformStageDataRow (Etapa 6, pilares incompletos): el status agregado ya NO está pegado, se recalcula a propuesto_por_ia", () => {
  const row6 = fixture.stageData.find((s) => s.stageNumber === 6);
  const r = transformStageDataRow(row6, fixture.session.id);
  assert.equal(r.data.fields.pilares.value.length, 2, "los 2 pilares existentes se preservan, no se inventan ni se pierden");
  assert.equal(
    r.data.fields.pilares.status,
    "propuesto_por_ia",
    "con minItems=3 y solo 2 elementos, el campo NO puede quedar validado, aunque SQLite lo tuviera guardado así"
  );
  assert.equal(
    r.data.status,
    "propuesto_por_ia",
    "el status de la etapa completa debe reflejar que pilares todavía no está realmente cerrado"
  );
});

check("transformStageDataRow (Etapa 7, todos los campos validados): status de etapa queda validado_por_usuario", () => {
  const row7 = fixture.stageData.find((s) => s.stageNumber === 7);
  const r = transformStageDataRow(row7, fixture.session.id);
  assert.equal(r.data.status, "validado_por_usuario");
  assert.equal(r.data.fields.esencia.value, "Tranquilidad sobre ruedas.");
});

check("transformFile preserva extractedText/extractedSummary y quita sessionId", () => {
  const r = transformFile(fixture.files[0], fixture.session.id);
  assert.equal(r.path, `sessions/session-autollantas-nutibara/files/${fixture.files[0].id}`);
  assert.equal(r.data.sessionId, undefined);
  assert.ok(r.data.extractedText.startsWith("Autollantas Nutibara"));
});

check("transformDeliverable deja `content` como string JSON tal cual (no lo desempaca)", () => {
  const r = transformDeliverable(fixture.deliverables[0], fixture.session.id);
  assert.equal(typeof r.data.content, "string");
  assert.ok("base" in JSON.parse(r.data.content), "sigue siendo JSON válido, solo que no se transforma a objeto");
});

check("transformMessage SÍ desempaca `meta` (a diferencia de deliverables) porque el código que lo lee espera un objeto", () => {
  const withProposals = transformMessage(fixture.messages[0], fixture.session.id);
  assert.deepEqual(withProposals.data.meta, { proposals: [{ field_key: "pilares" }], citations: [] });

  const hidden = transformMessage(fixture.messages[1], fixture.session.id);
  assert.equal(hidden.data.meta.hidden, true, "el mensaje oculto de auto-arranque se preserva con su bandera, no se pierde ni se muestra distinto");
});

check("transformSessionTree devuelve una operación por cada fila real del export (3 etapas + 1 archivo + 1 entregable + 2 mensajes + client/brand/session)", () => {
  const ops = transformSessionTree(fixture);
  assert.equal(ops.length, 3 + 3 + 1 + 1 + 2);
  const paths = ops.map((o) => o.path);
  assert.ok(paths.includes("sessions/session-autollantas-nutibara/stageData/6"));
  assert.ok(paths.includes(`sessions/session-autollantas-nutibara/messages/${fixture.messages[1].id}`));
});

console.log(`\n${passed} pruebas pasaron.`);
