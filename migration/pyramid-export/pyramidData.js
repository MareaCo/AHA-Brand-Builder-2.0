// Consolidación de datos de la Pirámide de Marca — equivalente de
// backend/src/lib/pyramidData.js, adaptado para Firestore.
//
// ÚNICO CAMBIO REAL respecto al original: en SQLite/Prisma, `content` se guarda como un
// string JSON y hay que hacer `JSON.parse(row.content)` antes de leerlo (ver
// backend/src/lib/summary.js, getStageContent). En Firestore, cada documento de
// `stageData` ya guarda `content` como un mapa/objeto nativo — NO hay que parsear nada,
// y de hecho intentar `JSON.parse()` sobre un objeto ya nativo revienta. Por eso
// `getStageContent` aquí es más simple que el original: solo lee `row.content` directo.
//
// El resto de la lógica (qué campo de qué etapa va en qué celda de la pirámide) es
// IDÉNTICA al original — es lógica de negocio pura, no tiene nada que ver con la base de
// datos. Ver stageDefinitions.js (sección 6.7 del brief de metodología) para el porqué de
// cada mapeo.

function getStageContent(stageDataRow) {
  if (!stageDataRow) return { fields: {}, meta: {} };
  const content = stageDataRow.content || {};
  return { fields: content.fields || {}, meta: content.meta || {} };
}

function fieldValue(stageDataByNumber, stageNumber, fieldKey) {
  const row = stageDataByNumber[stageNumber];
  const { fields } = getStageContent(row);
  return fields[fieldKey]?.value ?? null;
}

// stageDataRows: array de documentos de la colección `stageData` de Firestore, cada uno
// con { stageNumber, content: { fields: {...}, meta: {...} } }.
export function buildPyramidData(stageDataRows) {
  const byNumber = {};
  for (const row of stageDataRows) byNumber[row.stageNumber] = row;

  const stage7 = getStageContent(byNumber[7]);
  const f7 = stage7.fields;

  return {
    base: {
      entorno_competitivo: f7.entorno_competitivo?.value ?? null,
      target: fieldValue(byNumber, 5, "perfil_target"),
      asociaciones_marca: f7.asociaciones_marca?.value ?? null,
      insight: fieldValue(byNumber, 2, "insight_consolidado"),
    },
    medio: {
      razones_para_creer: fieldValue(byNumber, 3, "rtb"),
      personalidad: f7.personalidad?.value ?? null,
      beneficios_racionales: fieldValue(byNumber, 3, "beneficios_racionales"),
      beneficios_emocionales: fieldValue(byNumber, 3, "beneficios_emocionales"),
    },
    alto: {
      proposito: fieldValue(byNumber, 4, "por_que"),
    },
    cuspide: {
      esencia: f7.esencia?.value ?? null,
    },
    aparte: {
      arquetipo_dominante: f7.arquetipo_dominante?.value ?? null,
      arquetipo_secundario: f7.arquetipo_secundario?.value ?? null,
      territorio_marca: f7.territorio_comunicacion?.value ?? null,
    },
    meta: {
      concepto: fieldValue(byNumber, 3, "concepto_completo"),
      definicion_negocio: fieldValue(byNumber, 4, "definicion_negocio"),
      pilares: fieldValue(byNumber, 6, "pilares"),
    },
  };
}

// Las claves de los campos de la Etapa 7 (entorno_competitivo, asociaciones_marca,
// personalidad, esencia, arquetipo_dominante, arquetipo_secundario,
// territorio_comunicacion) deben coincidir EXACTAMENTE con stage.fields en
// stageDefinitions.js para esa etapa — es la misma lista enum que usa la guarda de
// record_proposal del Sprint 2. Si cambias una clave en un lado, cámbiala en el otro.
export function pyramidIsReady(stageDataRows, stage7Definition) {
  const byNumber = {};
  for (const row of stageDataRows) byNumber[row.stageNumber] = row;
  const { fields } = getStageContent(byNumber[7]);
  return stage7Definition.fields.every((f) => {
    const entry = fields[f.key];
    return entry && (entry.status === "validado_por_usuario" || entry.status === "editado_por_usuario");
  });
}
