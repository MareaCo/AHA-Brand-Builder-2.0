// Pruebas puras (sin Firestore) para la lógica de campos tipo "list". Correr con:
//   node migration/firestore/__tests__/listFieldLogic.test.mjs
// Reproduce el bug real que ocurrió en producción: validar el primer pilar bloqueaba
// (o perdía) los siguientes.

import assert from "node:assert/strict";
import { normalizeListValue, mergeListItems, computeListAggregateStatus } from "../listFieldLogic.js";

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${label}`);
}

console.log("normalizeListValue");
check("pasa un array tal cual", () => {
  const arr = [{ atributo: "x", materializacion: "y" }];
  assert.equal(normalizeListValue(arr), arr);
});
check("separa el formato narrado por la IA (**Pilar N — ...** \"...\")", () => {
  const text =
    '**Pilar 1 — Confianza respaldada por 50 años** *"Te decimos exactamente qué tiene tu vehículo."* ' +
    '**Pilar 2 — La serviteca con mayor preferencia** *"El 37% de los conductores nos elige."*';
  const result = normalizeListValue(text);
  assert.equal(result.length, 2);
  assert.equal(result[0].atributo, "Confianza respaldada por 50 años");
  assert.equal(result[0].materializacion, "Te decimos exactamente qué tiene tu vehículo.");
  assert.equal(result[1].atributo, "La serviteca con mayor preferencia");
});
check("separa el formato numerado clásico (1. ... 2. ...)", () => {
  const result = normalizeListValue("1. Pilar uno con su texto 2. Pilar dos con su texto 3. Pilar tres con su texto");
  assert.equal(result.length, 3);
});
check("un string sin marcadores queda como un solo elemento", () => {
  const result = normalizeListValue("Solo un pilar sin marcadores");
  assert.equal(result.length, 1);
  assert.equal(result[0].atributo, "Solo un pilar sin marcadores");
});

console.log("mergeListItems + computeListAggregateStatus (escenario completo del bug real)");
check("validar el pilar 1 no bloquea que la IA registre los pilares 2 y 3", () => {
  // 1. La IA propone el pilar 1 solo.
  let items = mergeListItems(undefined, normalizeListValue([{ atributo: "Confianza", materializacion: "50 años" }]));
  assert.equal(items.length, 1);
  assert.equal(computeListAggregateStatus(items, 3), "propuesto_por_ia");

  // 2. El usuario valida el pilar 1 (acción de la interfaz, fuera de merge).
  items = items.map((it, i) => (i === 0 ? { ...it, status: "validado_por_usuario" } : it));
  assert.equal(computeListAggregateStatus(items, 3), "propuesto_por_ia", "con 1 de 3 no debería marcarse completo");

  // 3. La IA reenvía el ARRAY COMPLETO con los 3 pilares (incluyendo, por error, un
  //    intento de "reescribir" el pilar 1 ya validado).
  const incoming = normalizeListValue([
    { atributo: "Confianza REESCRITA (no debería pasar)", materializacion: "x" },
    { atributo: "Servitecas #1", materializacion: "Dato del estudio" },
    { atributo: "Técnicos que saben", materializacion: "No siguen instrucciones" },
  ]);
  items = mergeListItems(items, incoming);

  assert.equal(items.length, 3, "deben quedar los 3 pilares");
  assert.equal(items[0].atributo, "Confianza", "el pilar validado nunca se sobreescribe");
  assert.equal(items[0].status, "validado_por_usuario");
  assert.equal(items[1].atributo, "Servitecas #1", "el pilar 2 sí se guarda");
  assert.equal(items[1].status, "propuesto_por_ia");
  assert.equal(items[2].atributo, "Técnicos que saben", "el pilar 3 sí se guarda");
  assert.equal(computeListAggregateStatus(items, 3), "propuesto_por_ia", "2 y 3 todavía no están validados");

  // 4. El usuario valida los pilares 2 y 3.
  items = items.map((it, i) => (i >= 1 ? { ...it, status: "validado_por_usuario" } : it));
  assert.equal(computeListAggregateStatus(items, 3), "validado_por_usuario", "con los 3 validados sí se completa");
});

console.log(`\n${passed} pruebas pasaron.`);
