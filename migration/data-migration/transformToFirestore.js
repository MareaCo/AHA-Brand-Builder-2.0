// Sprint 5 — paso 2: transforma el JSON exportado de SQLite (ver exportFromSqlite.js) a
// la forma exacta de documentos de Firestore descrita en migration/firestore/schema.md.
//
// Lógica pura — sin SDK de Firestore, sin conexión a ninguna base de datos — por eso se
// puede probar completamente en este entorno. Reutiliza (sin duplicar) dos piezas ya
// validadas en sprints anteriores:
//   - getStage() de backend/src/lib/stageDefinitions.js, para saber qué campos son tipo
//     "list" y su minItems.
//   - normalizeListValue()/computeListAggregateStatus() de
//     migration/firestore/listFieldLogic.js, para reparar campos tipo lista que hayan
//     quedado en el formato narrado viejo o con un status agregado "pegado".
//
// POR QUÉ NO SE PUEDE COPIAR EL JSON TAL CUAL (el hallazgo real de este sprint):
//
// 1. `StageData.content` en SQLite es un STRING JSON — en Firestore, `fields` y `meta`
//    deben guardarse como objetos nativos (ver la nota de este mismo problema en
//    migration/pyramid-export/README.md, que lo encontró primero para la Pirámide).
// 2. `Message.meta` también es un string JSON en SQLite — mismo tratamiento.
// 3. El status agregado de un campo tipo lista (como "pilares") y el status del
//    `StageData` completo pueden estar DESACTUALIZADOS en los datos reales — el backend
//    actual nunca los recalcula de forma centralizada, así que pueden quedar en
//    "validado_por_usuario" de una versión anterior aunque hoy, con las reglas vigentes
//    (ej. minItems), ese campo ya no califique como completo. Migrar ese valor tal cual
//    arrastraría ese bug a Firestore. Por eso este archivo SIEMPRE recalcula ambos
//    status desde los datos reales, nunca copia la columna `status` de SQLite.

import { getStage } from "../../backend/src/lib/stageDefinitions.js";
import { normalizeListValue, computeListAggregateStatus, LOCKED_STATUSES } from "../firestore/listFieldLogic.js";

function safeJsonParse(raw, fallback) {
  if (raw == null) return fallback;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function transformClient(client) {
  const { id, ...data } = client;
  return { path: `clients/${id}`, id, data: { ...data, createdAt: new Date(data.createdAt) } };
}

export function transformBrand(brand) {
  const { id, clientId, ...data } = brand;
  return {
    path: `clients/${clientId}/brands/${id}`,
    id,
    data: { ...data, createdAt: new Date(data.createdAt) },
  };
}

export function transformSession(session, brandId) {
  const { id, brandId: _omit, ...data } = session;
  return {
    path: `brands/${brandId}/sessions/${id}`,
    id,
    data: { ...data, createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt) },
  };
}

// Recalcula el status agregado de una ETAPA completa a partir de sus campos ya
// normalizados — nunca se confía en la columna `status` de SQLite (ver nota arriba).
function computeStageStatus(fields, stageFieldDefs) {
  if (!stageFieldDefs || stageFieldDefs.length === 0) return "borrador";
  const entries = stageFieldDefs.map((f) => fields[f.key]);
  if (entries.every((f) => f && LOCKED_STATUSES.has(f.status))) return "validado_por_usuario";
  if (entries.some((f) => f && f.status && f.status !== "sin_definir")) return "propuesto_por_ia";
  return "borrador";
}

export function transformStageDataRow(stageDataRow, sessionId) {
  const stage = getStage(stageDataRow.stageNumber);
  const content = safeJsonParse(stageDataRow.content, {});
  const rawFields = content.fields || {};

  const fields = {};
  for (const fieldDef of stage?.fields || []) {
    const raw = rawFields[fieldDef.key];
    if (!raw) continue;

    if (fieldDef.type === "list") {
      const items = normalizeListValue(raw.value).map((item) => ({
        atributo: item.atributo ?? "",
        materializacion: item.materializacion ?? "",
        status: item.status || "propuesto_por_ia",
      }));
      fields[fieldDef.key] = {
        label: raw.label || fieldDef.label,
        value: items,
        status: computeListAggregateStatus(items, fieldDef.minItems || 1),
        rationale: raw.rationale ?? null,
      };
    } else {
      fields[fieldDef.key] = {
        label: raw.label || fieldDef.label,
        value: raw.value ?? null,
        status: raw.status || "sin_definir",
        rationale: raw.rationale ?? null,
      };
    }
  }

  // Cualquier campo presente en los datos reales pero ya no declarado en
  // stageDefinitions.js (una etapa vieja, un campo renombrado) se preserva tal cual en
  // vez de perderse silenciosamente — solo que no participa en el cálculo de status.
  for (const [key, raw] of Object.entries(rawFields)) {
    if (!fields[key]) fields[key] = raw;
  }

  return {
    path: `sessions/${sessionId}/stageData/${String(stageDataRow.stageNumber)}`,
    id: String(stageDataRow.stageNumber),
    data: {
      stageName: stageDataRow.stageName,
      status: computeStageStatus(fields, stage?.fields),
      fields,
      meta: content.meta || {},
      updatedAt: new Date(stageDataRow.updatedAt),
    },
  };
}

export function transformFile(file, sessionId) {
  const { id, sessionId: _omit, ...data } = file;
  return {
    path: `sessions/${sessionId}/files/${id}`,
    id,
    data: { ...data, createdAt: new Date(data.createdAt) },
  };
}

export function transformDeliverable(deliverable, sessionId) {
  // `content` se deja como string JSON serializado tal cual — igual que hoy en SQLite,
  // por decisión explícita documentada en migration/firestore/schema.md (no hay que
  // "desempacarlo" como con stageData.content).
  const { id, sessionId: _omit, ...data } = deliverable;
  return {
    path: `sessions/${sessionId}/deliverables/${id}`,
    id,
    data: { ...data, createdAt: new Date(data.createdAt) },
  };
}

export function transformMessage(message, sessionId) {
  const { id, sessionId: _omit, meta, ...data } = message;
  return {
    path: `sessions/${sessionId}/messages/${id}`,
    id,
    data: { ...data, meta: safeJsonParse(meta, null), createdAt: new Date(data.createdAt) },
  };
}

// Orquestador: toma el JSON completo que produjo exportFromSqlite.js y devuelve una
// lista plana de operaciones de escritura { path, id, data }, lista para pasarle a
// importToFirestore.js (o para revisar a mano antes de confiar en ella).
export function transformSessionTree(exportedJson) {
  const { client, brand, session, stageData, files, deliverables, messages } = exportedJson;

  const ops = [transformClient(client), transformBrand(brand), transformSession(session, brand.id)];

  for (const row of stageData) ops.push(transformStageDataRow(row, session.id));
  for (const file of files) ops.push(transformFile(file, session.id));
  for (const deliverable of deliverables) ops.push(transformDeliverable(deliverable, session.id));
  for (const message of messages) ops.push(transformMessage(message, session.id));

  return ops;
}
