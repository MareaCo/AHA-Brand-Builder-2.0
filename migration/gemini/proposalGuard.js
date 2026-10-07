// Lógica pura (sin SDK de Gemini, sin base de datos) para decidir si una llamada a
// record_proposal debe rechazarse porque el campo ya está cerrado por el usuario.
// Puerto directo de la guarda de bloqueo que ya existe en backend/src/anthropicClient.js
// (la constante LOCKED_STATUSES y el chequeo `if (!isListField && existing && LOCKED...)`).
//
// Por qué existe esta excepción para campos tipo "list": un campo como "pilares" se
// construye elemento por elemento a lo largo de varios turnos. Si se bloqueara todo el
// campo en cuanto el usuario valida el primer elemento, la IA nunca podría seguir
// registrando los siguientes — ese fue un bug real en producción. La protección real
// para campos tipo lista no vive aquí: vive en el merge por posición de
// migration/firestore/listFieldLogic.js, que preserva cada elemento ya validado sin
// importar qué reenvíe la IA.

export const LOCKED_STATUSES = new Set(["validado_por_usuario", "editado_por_usuario"]);

/**
 * @param {string} fieldKey - la clave del campo que la IA intenta registrar (field_key).
 * @param {Record<string, {status: string, value: any}>} fieldsState - el estado actual
 *   de los campos de la etapa (snapshot vivo dentro del turno, igual que `fieldsState` en
 *   anthropicClient.js).
 * @param {Array<{key: string, type?: string}>} stageFieldDefs - stage.fields de la etapa
 *   actual (de stageDefinitions.js), para saber si fieldKey es de tipo "list".
 * @returns {{ rejected: boolean, reason?: string }}
 */
export function checkProposal(fieldKey, fieldsState, stageFieldDefs) {
  const fieldDef = stageFieldDefs.find((f) => f.key === fieldKey);
  const isListField = fieldDef?.type === "list";
  const existing = fieldsState[fieldKey];

  if (!isListField && existing && LOCKED_STATUSES.has(existing.status)) {
    const shownValue = typeof existing.value === "string" ? existing.value : JSON.stringify(existing.value);
    return {
      rejected: true,
      reason: `Rechazado: el campo "${fieldKey}" ya fue cerrado por el usuario (valor actual: "${shownValue}"). No lo repitas ni lo reemplaces — el usuario no pidió cambiarlo en su último mensaje. Continúa con el siguiente campo o paso pendiente.`,
    };
  }

  return { rejected: false };
}
