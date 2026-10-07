// node migration/gemini/__tests__/parseProposalValue.test.mjs
import assert from "node:assert/strict";
import { parseProposalValue } from "../parseProposalValue.js";

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${label}`);
}

check("un string normal (campo simple) se deja tal cual", () => {
  assert.equal(parseProposalValue("Es un centro de diagnóstico de alta precisión."), "Es un centro de diagnóstico de alta precisión.");
});
check("un array JSON válido se convierte en array real", () => {
  const result = parseProposalValue('[{"atributo":"Confianza","materializacion":"50 años"}]');
  assert.ok(Array.isArray(result));
  assert.equal(result[0].atributo, "Confianza");
});
check("JSON mal formado que empieza con [ no revienta, se deja como string", () => {
  const raw = "[esto no es JSON válido";
  assert.equal(parseProposalValue(raw), raw);
});
check("el formato narrado por la IA (no es JSON) se deja como string para que normalizeListValue lo rescate después", () => {
  const raw = "**Pilar 1 — Confianza** *\"materialización\"*";
  assert.equal(parseProposalValue(raw), raw);
});
check("un valor que no es string (ya viene como array/objeto) se devuelve sin tocar", () => {
  const arr = [{ atributo: "x", materializacion: "y" }];
  assert.equal(parseProposalValue(arr), arr);
});

console.log(`\n${passed} pruebas pasaron.`);
