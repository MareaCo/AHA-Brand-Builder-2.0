// Sprint 7 — paso 1: construir el CONTENIDO del entregable final consolidado (las 8
// etapas), a partir de los documentos ya existentes en Firestore — sin tocar ningún dato,
// solo seleccionar y dar forma a lo que ya está validado.
//
// Regla NO negociable (pedida explícitamente por Catalina): el entregable final nunca
// debe contener fragmentos del chat ni "interpretaciones" generadas al momento de
// exportar — solo los valores que la persona ya validó o editó en la columna derecha de
// cada etapa. Este archivo es, a propósito, el ÚNICO lugar donde se decide qué entra al
// entregable: los 3 formatos (HTML, PDF, PPT) deben consumir la MISMA salida de
// buildConsolidatedContent(), nunca leer stageData/mensajes por su cuenta — así no hay
// forma de que un formato muestre algo que otro no muestra.
//
// Reutiliza LOCKED_STATUSES de migration/firestore/listFieldLogic.js (el mismo criterio
// que ya usa el gate de "Continuar" y el PDF actual de export.js) en vez de inventar un
// segundo criterio de "qué cuenta como validado".

import { LOCKED_STATUSES } from "../firestore/listFieldLogic.js";

// Etapas que entran al entregable, en el orden de LECTURA de la historia de marca ya
// cerrada (coincide con el orden en que se construyen en el chat, 1→7). La Etapa 0
// (Insumos) nunca entra — es material de trabajo interno, no estrategia validada. La
// Etapa 8 (Manifiesto) tampoco tiene fields propios (ver stageDefinitions.js) — entra por
// separado, desde el deliverable "manifiesto", no desde stageData.
export const DELIVERABLE_STAGE_ORDER = [1, 2, 3, 4, 5, 6, 7];

const STAGE_LABELS = {
  1: "Territorio de Marca",
  2: "Insight de Marca",
  3: "Concepto de Marca",
  4: "Propósito de Marca y Definición del Negocio",
  5: "Definición del Target",
  6: "Propuesta de Valor",
  7: "Pirámide de Marca",
};

// Plantilla neutra de AHA — se usa cuando la marca todavía no configuró su propio logo o
// colores (ver README.md, sección "Personalización por marca").
export const AHA_FALLBACK_BRANDING = {
  logoUrl: null,
  primaryColor: "#282072",
  secondaryColor: "#b3de4a",
};

function isClosed(status) {
  return LOCKED_STATUSES.has(status);
}

// Un campo simple (string/objeto) entra completo si su propio status está cerrado. Un
// campo tipo lista (hoy, "pilares" de la Etapa 6) entra SOLO con los elementos que estén
// cerrados individualmente — nunca se asume que toda la lista está lista solo porque
// alguno de sus elementos lo esté, ni se excluye completa porque el status AGREGADO
// (computeListAggregateStatus) siga en "propuesto_por_ia" mientras faltan elementos: ver
// migration/firestore/listFieldLogic.js, el agregado y el cierre por elemento son dos
// cosas distintas a propósito.
export function extractValidatedFields(stageDataDoc) {
  const fields = stageDataDoc?.fields || {};
  const result = [];

  for (const [key, field] of Object.entries(fields)) {
    if (!field) continue;

    if (Array.isArray(field.value)) {
      const closedItems = field.value
        .filter((item) => item && isClosed(item.status))
        .map(({ status, ...rest }) => rest);
      if (closedItems.length > 0) {
        result.push({ key, label: field.label, value: closedItems });
      }
      continue;
    }

    if (isClosed(field.status)) {
      result.push({ key, label: field.label, value: field.value });
    }
  }

  return result;
}

// Punto de entrada único. Recibe los documentos ya leídos de Firestore (nunca lee la
// base de datos por su cuenta) y devuelve una estructura plana, ya filtrada, lista para
// que cualquiera de los 3 renderizadores (HTML/PDF/PPT) la recorra igual.
export function buildConsolidatedContent({
  client,
  brand,
  session,
  stageDataByNumber,
  pyramidImageBase64,
  manifesto,
}) {
  const stages = DELIVERABLE_STAGE_ORDER.map((number) => ({
    number,
    name: STAGE_LABELS[number],
    fields: extractValidatedFields(stageDataByNumber?.[number]),
  })).filter((stage) => stage.fields.length > 0);

  return {
    meta: {
      clientName: client?.name || "",
      brandName: brand?.name || "",
      sessionId: session?.id || null,
      generatedAt: new Date().toISOString(),
    },
    branding: {
      logoUrl: brand?.logoUrl ?? AHA_FALLBACK_BRANDING.logoUrl,
      primaryColor: brand?.primaryColor || AHA_FALLBACK_BRANDING.primaryColor,
      secondaryColor: brand?.secondaryColor || AHA_FALLBACK_BRANDING.secondaryColor,
    },
    stages,
    pyramidImageBase64: pyramidImageBase64 || null,
    // manifesto: { tone: "directa", label: "Directa", text: "..." } — la variante que la
    // persona tenía seleccionada en la pantalla del Manifiesto al generar el entregable
    // (mismo mecanismo ya usado hoy por ClosingPage.jsx/export.js, no es un campo nuevo).
    manifesto: manifesto ? { tone: manifesto.tone, label: manifesto.label, text: manifesto.text } : null,
  };
}

// Verifica que el entregable tenga AL MENOS algo real que mostrar, antes de generar
// cualquier archivo — evita entregar un PDF/PPT/HTML vacío si todavía no hay nada
// validado en ninguna etapa.
export function consolidatedContentIsReady(content) {
  return (content?.stages?.length || 0) > 0 || !!content?.manifesto;
}
