import { getStage } from "./stageDefinitions.js";
import { getStageContent } from "./summary.js";

function fieldValue(stageDataByNumber, stageNumber, fieldKey) {
  const row = stageDataByNumber[stageNumber];
  const { fields } = getStageContent(row);
  return fields[fieldKey]?.value ?? null;
}

// Consolida el contenido de todas las etapas en la estructura exacta de la
// Pirámide de Marca (sección 6.7 del brief), lista para renderizar como gráfico.
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

export function pyramidIsReady(stageDataRows) {
  const stage7 = getStage(7);
  const byNumber = {};
  for (const row of stageDataRows) byNumber[row.stageNumber] = row;
  const { fields } = getStageContent(byNumber[7]);
  return stage7.fields.every((f) => {
    const entry = fields[f.key];
    return entry && (entry.status === "validado_por_usuario" || entry.status === "editado_por_usuario");
  });
}
