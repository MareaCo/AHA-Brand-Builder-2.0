// El schema de function calling de Gemini (ver functionDeclarations.js) declara "value"
// como STRING simple — a diferencia de la tool de Claude, Gemini no soporta de forma
// confiable un parámetro "este campo puede ser string U objeto/array" (anyOf) en su
// esquema de funciones. La salida: para campos tipo "list", se le pide a la IA que
// mande el array como texto JSON (ej. '[{"atributo":"...","materializacion":"..."}]'),
// y aquí se interpreta ese texto de vuelta a un array real.
//
// Esto es, a propósito, DEFENSIVO: si la IA no manda JSON válido (se le olvida, o manda
// el formato narrado "**Pilar 1 — ...**"), esta función no revienta — devuelve el string
// tal cual, y la reparación real de texto mal formado ya la hace
// migration/firestore/listFieldLogic.js -> normalizeListValue() más abajo en la cadena.

/**
 * @param {string} rawValue - el string que vino en los args de la función de Gemini.
 * @returns {string | Array<{atributo: string, materializacion: string}>}
 */
export function parseProposalValue(rawValue) {
  if (typeof rawValue !== "string") return rawValue;
  const trimmed = rawValue.trim();
  if (!trimmed.startsWith("[")) return rawValue;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    return rawValue;
  } catch {
    // No era JSON válido a pesar de empezar con "[" — se deja como string; el
    // normalizeListValue de más abajo en la cadena todavía puede rescatar el contenido.
    return rawValue;
  }
}
