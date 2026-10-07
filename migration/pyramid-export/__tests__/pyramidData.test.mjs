// node migration/pyramid-export/__tests__/pyramidData.test.mjs
import assert from "node:assert/strict";
import { buildPyramidData, pyramidIsReady } from "../pyramidData.js";

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${label}`);
}

// Simula documentos de la colección `stageData` de Firestore: content ya es un objeto
// nativo (nunca un string JSON) — esa es la diferencia clave respecto al original SQLite.
const mockRows = [
  { stageNumber: 2, content: { fields: { insight_consolidado: { value: "Insight de prueba", status: "validado_por_usuario" } } } },
  { stageNumber: 3, content: { fields: {
    rtb: { value: "RTB de prueba", status: "validado_por_usuario" },
    beneficios_racionales: { value: "Beneficio racional", status: "validado_por_usuario" },
    beneficios_emocionales: { value: "Beneficio emocional", status: "validado_por_usuario" },
    concepto_completo: { value: "Concepto completo", status: "validado_por_usuario" },
  } } },
  { stageNumber: 4, content: { fields: {
    por_que: { value: "El porqué", status: "validado_por_usuario" },
    definicion_negocio: { value: "Definición del negocio", status: "validado_por_usuario" },
  } } },
  { stageNumber: 5, content: { fields: { perfil_target: { value: "Target de prueba", status: "validado_por_usuario" } } } },
  { stageNumber: 6, content: { fields: { pilares: { value: [{ atributo: "Confianza" }], status: "validado_por_usuario" } } } },
  { stageNumber: 7, content: { fields: {
    entorno_competitivo: { value: "Entorno", status: "validado_por_usuario" },
    asociaciones_marca: { value: "Asociaciones", status: "validado_por_usuario" },
    personalidad: { value: "Personalidad", status: "validado_por_usuario" },
    esencia: { value: "Esencia", status: "validado_por_usuario" },
    arquetipo_dominante: { value: "El Sabio", status: "validado_por_usuario" },
    arquetipo_secundario: { value: "El Explorador", status: "validado_por_usuario" },
    territorio_comunicacion: { value: "Territorio", status: "validado_por_usuario" },
  } } },
];

check("buildPyramidData consolida cada celda desde la etapa correcta", () => {
  const data = buildPyramidData(mockRows);
  assert.equal(data.base.insight, "Insight de prueba");
  assert.equal(data.base.target, "Target de prueba");
  assert.equal(data.medio.razones_para_creer, "RTB de prueba");
  assert.equal(data.alto.proposito, "El porqué");
  assert.equal(data.cuspide.esencia, "Esencia");
  assert.equal(data.aparte.territorio_marca, "Territorio");
  assert.deepEqual(data.meta.pilares, [{ atributo: "Confianza" }]);
});

check("buildPyramidData devuelve null (no revienta) cuando falta una etapa completa", () => {
  const rowsSinEtapa5 = mockRows.filter((r) => r.stageNumber !== 5);
  const data = buildPyramidData(rowsSinEtapa5);
  assert.equal(data.base.target, null);
});

check("pyramidIsReady es true cuando todos los campos de la Etapa 7 están validados o editados", () => {
  const stage7Definition = {
    fields: [
      { key: "entorno_competitivo" }, { key: "asociaciones_marca" }, { key: "personalidad" },
      { key: "esencia" }, { key: "arquetipo_dominante" }, { key: "arquetipo_secundario" },
      { key: "territorio_comunicacion" },
    ],
  };
  assert.equal(pyramidIsReady(mockRows, stage7Definition), true);
});

check("pyramidIsReady es false si algún campo de la Etapa 7 todavía no se valida", () => {
  const rowsConPendiente = mockRows.map((r) =>
    r.stageNumber === 7
      ? { ...r, content: { fields: { ...r.content.fields, esencia: { value: "Esencia", status: "propuesto_por_ia" } } } }
      : r
  );
  const stage7Definition = { fields: [{ key: "esencia" }] };
  assert.equal(pyramidIsReady(rowsConPendiente, stage7Definition), false);
});

console.log(`\n${passed} pruebas pasaron.`);
