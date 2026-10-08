// Lógica pura (sin SDK de Gemini, sin base de datos) para decidir si una llamada a
// record_proposal debe rechazarse porque el campo ya está cerrado por el usuario, o
// porque la clave no es válida para esta etapa. Puerto directo de la guarda de bloqueo
// que ya existe en backend/src/anthropicClient.js (la constante LOCKED_STATUSES y el
// chequeo `if (!isListField && existing && LOCKED...)`), VALIDADO en producción contra la
// API real de Gemini (ver migration/gemini/README.md, sección de validación del Sprint 2)
// con dos correcciones que sí fueron necesarias y que no estaban en la primera versión:
//
// 1. Rechazo genérico de claves inválidas. No alcanza con que el esquema de la función
//    restrinja field_key con `enum` — el parser de respaldo de texto libre (el que se usa
//    cuando el modelo responde en texto en vez de llamar a la función) no pasa por ese
//    esquema, y en una prueba real propuso una clave inventada
//    ("perfil_demografico_psicografico") que nunca debió aceptarse. Por eso aquí también
//    se valida fieldKey contra la lista real de claves de la etapa, sin excepción.
//
// 2. SIN palabras clave en el código para decidir si el usuario pidió un cambio. La
//    primera versión de este archivo (y de la implementada en AI Studio) intentaba
//    detectar frases como "ajustar" o "revisar" buscándolas en el texto del usuario —
//    eso daba falsos positivos. La solución validada: se le pide al modelo que decida
//    él mismo, por el contexto completo de la conversación, y que lo exprese con un
//    parámetro booleano explícito en la misma llamada a record_proposal
//    (`user_requested_change`, ver functionDeclarations.js). El código nunca escanea
//    texto — solo lee ese booleano ya decidido por el modelo.
//
// Por qué existe la excepción para campos tipo "list": un campo como "pilares" se
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
 *   actual (de stageDefinitions.js), para saber si fieldKey es de tipo "list" y validar
 *   que la clave exista.
 * @param {boolean} [userRequestedChange] - lo decide el modelo (no el código), a partir
 *   del parámetro `user_requested_change` que Gemini manda en la misma llamada a
 *   record_proposal cuando interpreta, por contexto, que el usuario pidió explícitamente
 *   modificar un campo ya cerrado.
 * @returns {{ rejected: boolean, reason?: string }}
 */
export function checkProposal(fieldKey, fieldsState, stageFieldDefs, userRequestedChange = false) {
  const validKeys = stageFieldDefs.map((f) => f.key);
  if (!validKeys.includes(fieldKey)) {
    return {
      rejected: true,
      reason: `Rechazado: "${fieldKey}" no es una clave válida para esta etapa. Las únicas claves válidas son: ${validKeys.join(", ")}.`,
    };
  }

  const fieldDef = stageFieldDefs.find((f) => f.key === fieldKey);
  const isListField = fieldDef?.type === "list";
  const existing = fieldsState[fieldKey];

  if (!isListField && existing && LOCKED_STATUSES.has(existing.status) && !userRequestedChange) {
    const shownValue = typeof existing.value === "string" ? existing.value : JSON.stringify(existing.value);
    return {
      rejected: true,
      reason: `Rechazado: el campo "${fieldKey}" ya fue cerrado por el usuario (valor actual: "${shownValue}"). No lo repitas ni lo reemplaces — el usuario no pidió cambiarlo en su último mensaje. Continúa con el siguiente campo o paso pendiente.`,
    };
  }

  return { rejected: false };
}
