// node migration/gemini/__tests__/proposalGuard.test.mjs
import assert from "node:assert/strict";
import { checkProposal } from "../proposalGuard.js";

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${label}`);
}

const STAGE1_FIELDS = [
  { key: "que_es", label: "¿Qué es?" },
  { key: "que_no_es", label: "¿Qué no es?" },
];
const STAGE6_FIELDS = [{ key: "pilares", label: "Pilares", type: "list", minItems: 3 }];

console.log("checkProposal — campos normales (no-lista)");
check("permite registrar un campo sin estado previo", () => {
  const r = checkProposal("que_es", {}, STAGE1_FIELDS);
  assert.equal(r.rejected, false);
});
check("permite registrar un campo propuesto_por_ia (todavía no cerrado)", () => {
  const r = checkProposal("que_es", { que_es: { status: "propuesto_por_ia", value: "x" } }, STAGE1_FIELDS);
  assert.equal(r.rejected, false);
});
check("rechaza un campo ya validado_por_usuario", () => {
  const r = checkProposal("que_es", { que_es: { status: "validado_por_usuario", value: "x" } }, STAGE1_FIELDS);
  assert.equal(r.rejected, true);
  assert.match(r.reason, /ya fue cerrado por el usuario/);
});
check("rechaza un campo ya editado_por_usuario", () => {
  const r = checkProposal("que_es", { que_es: { status: "editado_por_usuario", value: "x" } }, STAGE1_FIELDS);
  assert.equal(r.rejected, true);
});

console.log("checkProposal — campos tipo lista (ej. pilares): NUNCA se bloquean a nivel de campo");
check("un campo tipo lista nunca se rechaza a nivel de campo, aunque su status agregado sea validado_por_usuario", () => {
  // Este es exactamente el bug real: el campo "pilares" quedaba con status agregado
  // "validado_por_usuario" apenas el primer (y único) elemento se validaba, y el guard
  // viejo bloqueaba cualquier intento posterior de la IA de agregar el pilar 2 y 3.
  const r = checkProposal("pilares", { pilares: { status: "validado_por_usuario", value: [] } }, STAGE6_FIELDS);
  assert.equal(r.rejected, false, "un campo tipo list jamás se bloquea aquí — la protección real vive en el merge por posición");
});

console.log("checkProposal — claves inválidas (el bug real encontrado en la prueba de la Etapa 5)");
check("rechaza una clave que no existe en la etapa, aunque no esté bloqueada", () => {
  // Esto es lo que debió pasar cuando el parser de respaldo de texto libre propuso
  // "perfil_demografico_psicografico" en vez de la clave real "perfil_target".
  const r = checkProposal("perfil_demografico_psicografico", {}, [{ key: "perfil_target" }]);
  assert.equal(r.rejected, true);
  assert.match(r.reason, /no es una clave válida/);
});

console.log("checkProposal — user_requested_change (reemplaza la detección por palabras clave)");
check("un campo bloqueado sigue rechazándose si el modelo no marcó user_requested_change", () => {
  const r = checkProposal("que_es", { que_es: { status: "validado_por_usuario", value: "x" } }, STAGE1_FIELDS, false);
  assert.equal(r.rejected, true);
});
check("un campo bloqueado se permite SOLO si el modelo marcó user_requested_change: true", () => {
  const r = checkProposal("que_es", { que_es: { status: "validado_por_usuario", value: "x" } }, STAGE1_FIELDS, true);
  assert.equal(r.rejected, false);
});

console.log(`\n${passed} pruebas pasaron.`);
