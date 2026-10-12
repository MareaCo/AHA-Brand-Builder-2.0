// node migration/final-deliverable/__tests__/consolidatedContent.test.mjs

import assert from "node:assert/strict";
import {
  extractValidatedFields,
  buildConsolidatedContent,
  consolidatedContentIsReady,
  AHA_FALLBACK_BRANDING,
} from "../consolidatedContent.js";

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${label}`);
}

check("extractValidatedFields incluye un campo simple validado", () => {
  const stageDoc = {
    fields: {
      que_es: { label: "¿Qué es?", value: "La llanta que sí dura.", status: "validado_por_usuario" },
    },
  };
  const fields = extractValidatedFields(stageDoc);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].value, "La llanta que sí dura.");
});

check("extractValidatedFields excluye un campo simple todavía propuesto_por_ia", () => {
  const stageDoc = {
    fields: {
      que_no_es: { label: "¿Qué no es?", value: "Borrador sin validar.", status: "propuesto_por_ia" },
    },
  };
  assert.equal(extractValidatedFields(stageDoc).length, 0);
});

check("extractValidatedFields incluye un campo editado_por_usuario (no solo validado_por_usuario)", () => {
  const stageDoc = {
    fields: {
      verdad: { label: "Verdad", value: "Texto editado a mano.", status: "editado_por_usuario" },
    },
  };
  assert.equal(extractValidatedFields(stageDoc).length, 1);
});

check("extractValidatedFields (pilares): solo entran los elementos cerrados, nunca la lista completa de golpe", () => {
  const stageDoc = {
    fields: {
      pilares: {
        label: "Pilares de la propuesta de valor",
        status: "propuesto_por_ia", // agregado todavía abierto — igual deben entrar los 2 ya cerrados
        value: [
          { atributo: "Durabilidad real", materializacion: "Garantía de 5 años.", status: "validado_por_usuario" },
          { atributo: "Servicio en ruta", materializacion: "Auxilio 24/7.", status: "editado_por_usuario" },
          { atributo: "Precio justo", materializacion: "Sin sobrecostos ocultos.", status: "propuesto_por_ia" },
        ],
      },
    },
  };
  const fields = extractValidatedFields(stageDoc);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].value.length, 2, "el 3er pilar (propuesto_por_ia) no debe entrar al entregable");
  assert.ok(!("status" in fields[0].value[0]), "el status interno no debe filtrarse al contenido final");
});

check("buildConsolidatedContent arma las etapas en orden y deja afuera las que no tienen nada validado", () => {
  const content = buildConsolidatedContent({
    client: { name: "Autollantas Nutibara" },
    brand: { name: "Autollantas Nutibara" },
    session: { id: "session-1" },
    stageDataByNumber: {
      1: { fields: { que_es: { label: "¿Qué es?", value: "x", status: "validado_por_usuario" } } },
      2: { fields: { verdad: { label: "Verdad", value: "y", status: "propuesto_por_ia" } } }, // nada cerrado -> se excluye
      7: { fields: { esencia: { label: "Esencia", value: "Tranquilidad.", status: "editado_por_usuario" } } },
    },
  });
  const numbers = content.stages.map((s) => s.number);
  assert.deepEqual(numbers, [1, 7], "la Etapa 2 (sin nada validado) no debe aparecer, y el orden debe respetarse");
});

check("buildConsolidatedContent usa la plantilla neutra de AHA cuando la marca no tiene logo/colores propios", () => {
  const content = buildConsolidatedContent({
    client: { name: "Kansha" },
    brand: { name: "Kansha" }, // sin logoUrl/primaryColor/secondaryColor
    session: { id: "session-2" },
    stageDataByNumber: {},
  });
  assert.deepEqual(content.branding, AHA_FALLBACK_BRANDING);
});

check("buildConsolidatedContent respeta el logo/colores propios de la marca cuando sí existen", () => {
  const content = buildConsolidatedContent({
    client: { name: "Kansha" },
    brand: { name: "Kansha", logoUrl: "gs://bucket/kansha-logo.png", primaryColor: "#1a1a1a", secondaryColor: "#ffcc00" },
    session: { id: "session-2" },
    stageDataByNumber: {},
  });
  assert.equal(content.branding.logoUrl, "gs://bucket/kansha-logo.png");
  assert.equal(content.branding.primaryColor, "#1a1a1a");
});

check("buildConsolidatedContent incluye el manifiesto solo con la variante ya elegida (nunca las 3 juntas)", () => {
  const content = buildConsolidatedContent({
    client: { name: "Kansha" },
    brand: { name: "Kansha" },
    session: { id: "session-2" },
    stageDataByNumber: {},
    manifesto: { tone: "directa", label: "Directa", text: "Nosotros no vendemos llantas." },
  });
  assert.equal(content.manifesto.tone, "directa");
  assert.equal(content.manifesto.text, "Nosotros no vendemos llantas.");
});

check("consolidatedContentIsReady es falso cuando no hay ninguna etapa ni manifiesto", () => {
  const empty = buildConsolidatedContent({ stageDataByNumber: {} });
  assert.equal(consolidatedContentIsReady(empty), false);
});

check("consolidatedContentIsReady es verdadero con al menos una etapa con contenido", () => {
  const withOne = buildConsolidatedContent({
    stageDataByNumber: { 1: { fields: { que_es: { label: "x", value: "y", status: "validado_por_usuario" } } } },
  });
  assert.equal(consolidatedContentIsReady(withOne), true);
});

console.log(`\n${passed} pruebas pasaron.`);
