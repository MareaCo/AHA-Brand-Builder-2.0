// Capa de acceso a datos de "StageData" sobre Firestore — equivalente directo de
// backend/src/lib/stageDataStore.js (que usa Prisma/SQLite), misma forma de función por
// función, para que el motor de conversación (Sprint 2) no tenga que cambiar casi nada
// al llamarla.
//
// Requiere: npm install firebase-admin
// Inicialización del cliente (una sola vez, en el punto de entrada de la app):
//
//   import { initializeApp, applicationDefault } from "firebase-admin/app";
//   import { getFirestore } from "firebase-admin/firestore";
//   initializeApp({ credential: applicationDefault() });
//   export const db = getFirestore();
//
// AVISO: este archivo se escribió y se revisó con cuidado, pero este entorno no tiene
// credenciales de Google Cloud para correrlo contra una instancia real de Firestore — a
// diferencia de listFieldLogic.js (que sí se probó de punta a punta, ver __tests__/),
// esta capa de I/O no se ha ejecutado todavía. Antes de usarla en producción, pruébala
// contra el emulador de Firestore (`firebase emulators:start --only firestore`) con un
// par de sesiones de ejemplo.

import { FieldValue } from "firebase-admin/firestore";
import { normalizeListValue, mergeListItems, computeListAggregateStatus } from "./listFieldLogic.js";

// Las mismas 9 etapas de stageDefinitions.js deben importarse aquí tal cual (no se
// repiten en este archivo) — este módulo solo necesita, de cada etapa, su lista de
// `fields` (para saber cuáles son tipo "list" y su `minItems`).
// import { getStage } from "./stageDefinitions.js"; // copiar ese archivo sin cambios

export function stageDataRef(db, sessionId, stageNumber) {
  return db.collection("sessions").doc(sessionId).collection("stageData").doc(String(stageNumber));
}

export async function getOrCreateStageData(db, sessionId, stageNumber, stageName) {
  const ref = stageDataRef(db, sessionId, stageNumber);
  const snap = await ref.get();
  if (snap.exists) return { ref, data: snap.data() };

  const initial = { stageName, status: "borrador", fields: {}, meta: {} };
  await ref.set(initial);
  return { ref, data: initial };
}

// Aplica las propuestas que devolvió un turno del motor de conversación (una por cada
// field_key que la IA registró en ese turno). Para campos tipo "list", fusiona por
// posición en vez de sobreescribir (ver migration/firestore/listFieldLogic.js).
export async function applyProposals(db, sessionId, stageNumber, stageName, stageFieldDefs, proposals) {
  const { ref, data } = await getOrCreateStageData(db, sessionId, stageNumber, stageName);
  const fields = { ...(data.fields || {}) };
  const listFieldDefs = new Map(stageFieldDefs.filter((f) => f.type === "list").map((f) => [f.key, f]));

  for (const p of proposals) {
    const listFieldDef = listFieldDefs.get(p.field_key);
    if (listFieldDef) {
      const incomingItems = normalizeListValue(p.value);
      const mergedItems = mergeListItems(fields[p.field_key]?.value, incomingItems);
      fields[p.field_key] = {
        label: p.field_label,
        value: mergedItems,
        status: computeListAggregateStatus(mergedItems, listFieldDef.minItems),
        rationale: p.rationale || null,
      };
    } else {
      fields[p.field_key] = {
        label: p.field_label,
        value: p.value,
        status: "propuesto_por_ia",
        rationale: p.rationale || null,
      };
    }
  }

  await ref.update({ fields, status: "propuesto_por_ia", updatedAt: FieldValue.serverTimestamp() });
  return { ref, data: { ...data, fields } };
}

// Valida o edita UN elemento puntual de un campo tipo "list" (por ejemplo, el Pilar 2
// dentro de "pilares"), sin tocar los demás elementos del array. Usa una transacción
// para evitar una condición de carrera si dos pestañas editan el mismo campo a la vez.
export async function setListItemStatus(db, sessionId, stageNumber, fieldKey, itemIndex, { value, status }, fieldDef) {
  const ref = stageDataRef(db, sessionId, stageNumber);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const field = (data.fields || {})[fieldKey];
    if (!field || !Array.isArray(field.value) || !field.value[itemIndex]) {
      throw new Error("No hay una propuesta para ese elemento todavía.");
    }

    const items = [...field.value];
    items[itemIndex] = { ...items[itemIndex], ...(value || {}), status };
    const updatedField = { ...field, value: items, status: computeListAggregateStatus(items, fieldDef?.minItems) };

    tx.update(ref, { [`fields.${fieldKey}`]: updatedField, updatedAt: FieldValue.serverTimestamp() });
    return updatedField;
  });
}

// Validar/editar un campo COMPLETO (flujo de respaldo "completar manualmente", y los
// campos que no son tipo "list"). Para un campo tipo "list" cuyo valor todavía no sea un
// array (por ejemplo, quedó como string por una edición anterior a este diseño), esto
// también lo vuelve a partir en elementos en vez de guardarlo como un bloque de texto.
export async function setFieldStatus(db, sessionId, stageNumber, fieldKey, { value, label, status }, fieldDef) {
  const ref = stageDataRef(db, sessionId, stageNumber);
  const snap = await ref.get();
  const data = snap.data() || {};
  const existing = (data.fields || {})[fieldKey] || {};

  let newValue = value !== undefined ? value : existing.value;
  let newStatus = status;

  if (fieldDef?.type === "list") {
    const items = normalizeListValue(newValue).map((item) => ({ ...item, status }));
    newValue = items;
    newStatus = computeListAggregateStatus(items, fieldDef.minItems);
  }

  const updatedField = {
    label: label || existing.label || fieldKey,
    value: newValue,
    status: newStatus,
    rationale: existing.rationale || null,
  };

  await ref.update({ [`fields.${fieldKey}`]: updatedField, updatedAt: FieldValue.serverTimestamp() });
  return updatedField;
}

// Equivalente de stageIsComplete(stage, stageDataRow) de summary.js — true cuando TODOS
// los campos propios de la etapa están validados/editados.
export function stageIsComplete(stageFieldDefs, fields) {
  if (!stageFieldDefs || stageFieldDefs.length === 0) return true;
  return stageFieldDefs.every((f) => {
    const entry = fields?.[f.key];
    return entry && (entry.status === "validado_por_usuario" || entry.status === "editado_por_usuario");
  });
}
