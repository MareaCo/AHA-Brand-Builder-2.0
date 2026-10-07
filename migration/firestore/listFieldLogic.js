// Lógica pura (sin dependencias de base de datos) para campos tipo "list" de una etapa
// (hoy, solo "pilares" en la Etapa 6). Esta es la pieza más delicada del sistema: un
// campo tipo lista se construye elemento por elemento a lo largo de varios turnos, pero
// el usuario puede validar un elemento mientras la IA sigue proponiendo los siguientes.
// Si no se maneja con cuidado, validar el primer elemento bloquea (o pierde) los demás —
// esto pasó realmente en producción y se corrigió con el patrón de abajo.
//
// Estas funciones son deliberadamente independientes de Firestore/Prisma/cualquier motor
// de IA: son fáciles de probar solas (ver __tests__/listFieldLogic.test.mjs) y se pueden
// usar igual desde un backend de Firestore o desde el propio entorno de Google AI Studio.

export const LOCKED_STATUSES = new Set(["validado_por_usuario", "editado_por_usuario"]);

// Red de seguridad: un campo tipo "list" debería llegar desde la IA como array de
// objetos { atributo, materializacion } — el schema de la function-calling ya lo pide
// así, pero un modelo (o un pegado manual del usuario) puede mandar todo como un solo
// string, con marcadores numerados ("1. Pilar 1 — ...") o con el formato que usa la IA
// al narrar los pilares en el chat ("**Pilar 1 — ...** *"...""). En vez de guardar eso
// como un único elemento gigante, se parte por esos marcadores en varios elementos,
// separando el atributo (antes de las comillas) de su materialización (dentro de las
// comillas) cuando existen.
export function normalizeListValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return value;

  const splitPattern = /(?:\*\*\s*)?(?:pilar\s+)?\d+\s*[.\-—:]\s*(?:\*\*\s*)?/gi;
  const parts = value
    .split(splitPattern)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [{ atributo: value.trim(), materializacion: "" }];

  return parts.map((part) => {
    const clean = part.replace(/\*\*/g, "").trim();
    const quoteMatch = clean.match(/["“”]([^"“”]+)["“”]/);
    if (quoteMatch) {
      const atributo = clean.slice(0, quoteMatch.index).replace(/[*\s]+$/, "").trim();
      return { atributo: atributo || clean, materializacion: quoteMatch[1].trim() };
    }
    return { atributo: clean, materializacion: "" };
  });
}

// Un campo tipo "list" se construye elemento por elemento (cada llamada de la IA reenvía
// el array COMPLETO, por instrucción del prompt de la etapa). Si el usuario ya
// validó/editó un elemento puntual, ese elemento NO se debe perder ni sobreescribir
// aunque la IA vuelva a mandar el array entero — se fusiona por posición, preservando
// los elementos ya cerrados y aceptando los nuevos/pendientes.
export function mergeListItems(existingItems, incomingItems) {
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingItems) ? incomingItems : [];
  const merged = [];
  const maxLen = Math.max(existing.length, incoming.length);
  for (let i = 0; i < maxLen; i++) {
    const existingItem = existing[i];
    if (existingItem && LOCKED_STATUSES.has(existingItem.status)) {
      merged.push(existingItem);
    } else if (incoming[i]) {
      merged.push({ ...incoming[i], status: "propuesto_por_ia" });
    } else if (existingItem) {
      merged.push(existingItem);
    }
  }
  return merged;
}

// El campo (a nivel agregado) solo se considera cerrado cuando TODOS sus elementos lo
// están Y hay al menos "minItems" — así el checklist que ve la IA y el gate de
// "Continuar" no se destraban con, por ejemplo, un solo pilar validado de los 3-4 que
// pide la etapa.
export function computeListAggregateStatus(items, minItems = 1) {
  if (!items || items.length < minItems) return "propuesto_por_ia";
  return items.every((it) => it && LOCKED_STATUSES.has(it.status)) ? "validado_por_usuario" : "propuesto_por_ia";
}
