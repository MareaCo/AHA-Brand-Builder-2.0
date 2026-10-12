# Sprint 7 — Entregable final consolidado (las 8 etapas) en PDF / PPT / HTML

Entregable: una vez las 8 etapas quedan completas, que el cliente final (Presidentes,
CEOs, Gerentes de Área) reciba UN documento de estrategia de marca consolidado — no un
export plano de la conversación, sino una pieza de diseño profesional, descargable en los
formatos que la persona elija (PDF, PPT, HTML — pudiendo elegir más de uno a la vez), y
personalizable con el logo y los colores de cada marca.

## La regla que gobierna todo este sprint (pedida explícitamente por Catalina)

> "el contenido de cualquiera de los formatos de salida, deben ser los resúmenes ya
> validados (Columna derecha) no debe contener partes de los chats ni interpretaciones
> adicionales"

En código, esto se traduce en una sola decisión de arquitectura: **los 3 formatos nunca
leen `stageData`/`messages` por su cuenta — todos consumen la misma salida de una única
función, `buildConsolidatedContent()`** (ver `consolidatedContent.js` de esta carpeta).
Así es estructuralmente imposible que, por ejemplo, el PPT muestre algo que el HTML no
muestra, o que alguien "mejore" un formato agregándole una síntesis nueva generada al
vuelo. Si un campo no está en `validado_por_usuario` o `editado_por_usuario`, no existe
para el entregable — punto.

Esto reutiliza el mismo criterio que ya usa hoy el PDF de cierre existente
(`backend/src/routes/export.js`, línea de filtro
`f.status === "validado_por_usuario" || f.status === "editado_por_usuario"`) y el mismo
`LOCKED_STATUSES` de `migration/firestore/listFieldLogic.js` — no es un criterio nuevo,
es extender el que ya está probado en producción a las 8 etapas completas en vez de solo
al resumen ejecutivo corto que arma ese endpoint hoy.

## 1. Qué contenido entra, etapa por etapa (y qué NO entra)

| Etapa | Entra al entregable | De dónde sale |
|---|---|---|
| 0 — Insumos | **No entra nunca** | Es material de trabajo interno, no estrategia validada |
| 1 — Territorio de Marca | `que_es`, `que_no_es` | `stageData/1.fields` |
| 2 — Insight de Marca | `insight_consolidado` únicamente (NO `verdad`/`necesidad`/`friccion` por separado — esos son pasos intermedios de construcción, el insight consolidado ya los integra) | `stageData/2.fields` |
| 3 — Concepto de Marca | `beneficios_racionales`, `beneficios_emocionales`, `rtb`, `concepto_completo` | `stageData/3.fields` |
| 4 — Propósito y Definición del Negocio | `por_que`, `como`, `que`, `definicion_negocio` | `stageData/4.fields` |
| 5 — Definición del Target | `perfil_target` | `stageData/5.fields` |
| 6 — Propuesta de Valor | `pilares` (solo los elementos con su `status` individual cerrado — ver nota abajo) | `stageData/6.fields` |
| 7 — Pirámide de Marca | Imagen de la pirámide ya renderizada (misma captura `html2canvas` que ya usa el PDF actual) + los 7 campos de esta etapa como texto de apoyo | `deliverables` (tipo `piramide`) + `stageData/7.fields` |
| 8 — Manifiesto de Marca | El texto de la variante de tono que la persona tenía seleccionada en pantalla al generar el entregable (poética / directa / provocadora — nunca las 3 juntas) | `deliverables` (tipo `manifiesto`) |

Nota sobre `pilares` (Etapa 6): es un campo tipo lista donde cada elemento tiene su
**propio** `status` (ver `migration/firestore/schema.md`). El `status` agregado del campo
completo puede seguir en `propuesto_por_ia` mientras falta cerrar un pilar — eso NO debe
excluir del entregable los pilares que la persona sí validó. `extractValidatedFields()` en
`consolidatedContent.js` ya maneja esto correctamente (probado, ver `__tests__/`).

Por diseño, el entregable **omite** `verdad`/`necesidad`/`friccion` de la Etapa 2 y deja
solo `insight_consolidado`: son construcción paso a paso pensada para el chat, no para un
documento ejecutivo — mostrarlas por separado sería justamente el tipo de "parte del chat"
que Catalina pidió excluir. Si más adelante se decide mostrarlas también, es un cambio de
una sola línea en `DELIVERABLE_STAGE_ORDER`/`STAGE_LABELS`, no de arquitectura.

## 2. Sistema de diseño (audiencia: Presidentes, CEOs, Gerentes de Área)

Esta audiencia lee pocos documentos de estrategia por semana, pero los lee con atención —
el diseño debe transmitir autoridad y claridad, no "presentación de agencia creativa".
Principios concretos:

- **Portada + un tema por página/sección** — nunca un muro de texto. Cada etapa validada
  ocupa su propia página/slide con un encabezado claro (número + nombre de la etapa).
- **Tipografía**: una sola familia sans-serif profesional (ya usada en la app:
  system-ui/Helvetica vía `pdf-lib`), jerarquía de 3 tamaños máximo (título de etapa,
  label de campo, valor del campo) — nunca más de 3 tamaños en una misma página.
- **Paleta**: color de marca (o el fallback de AHA) como acento — navy `#282072` y lime
  `#b3de4a`, las mismas de `backend/src/routes/export.js`, ya aprobadas — nunca más de 2
  colores de acento por página, el resto en texto neutro (`rgb(0.12, 0.12, 0.16)`, el
  mismo `TEXT` que ya usa ese archivo) y blanco/gris muy claro de fondo.
- **La Pirámide de Marca y el diagrama de Propuesta de Valor son protagonistas** — página
  completa, sin texto compitiendo al lado, igual que ya hace el PDF actual.
- **El Manifiesto cierra el documento** — es la pieza más emocional, va al final como
  remate, nunca mezclado entre etapas analíticas.
- **Portada con logo de marca** (o sin logo si la marca no tiene uno configurado — nunca
  un placeholder genérico tipo "LOGO AQUÍ", eso se ve poco profesional frente a un CEO;
  mejor solo el nombre de la marca en tipografía grande sobre el color de marca).

## 3. Personalización por marca: logo y colores

Decisión (confirmada con Catalina): el logo y los colores se configuran **una sola vez
por marca** — no hay que volver a subirlos cada vez que se genera un entregable — y se
guardan directamente en el documento `brands/{brandId}` de Firestore (ver
`migration/firestore/schema.md`), como 3 campos nuevos:

```
clients/{clientId}/brands/{brandId}
  name: string
  industry: string | null
  createdAt: timestamp
  logoUrl: string | null        // NUEVO — ruta en Cloud Storage for Firebase, igual
                                 // patrón que UploadedFile.storagePath (nunca el binario
                                 // directo en Firestore)
  primaryColor: string | null    // NUEVO — hex, ej. "#1a1a1a"
  secondaryColor: string | null  // NUEVO — hex, ej. "#ffcc00"
```

Si una marca no tiene estos 3 campos configurados (o están en `null`), el entregable usa
la **plantilla neutra de AHA** como respaldo automático — nunca falla ni deja huecos
visuales: `primaryColor = "#282072"`, `secondaryColor = "#b3de4a"`, sin logo en portada
(ver `AHA_FALLBACK_BRANDING` en `consolidatedContent.js`, ya probado). Esto significa que
el entregable funciona perfectamente desde el primer día para Autollantas Nutibara y
Kansha aunque nadie haya configurado todavía su logo/colores — la personalización es un
plus que se añade cuando el equipo de AHA lo configure, nunca un bloqueante.

Dónde se configura: un panel sencillo en la pantalla de la marca (nombre + industria ya
existen ahí) con 2 selectores de color y un cargador de imagen para el logo — sube el
archivo a Cloud Storage for Firebase y guarda la URL resultante en `brands/{brandId}`.

## 4. Los 3 formatos de salida

El usuario elige con checkboxes cuáles formatos quiere (puede marcar varios a la vez) y
un solo botón "Generar entregable" dispara la generación de todos los marcados. Los 3
formatos consumen exactamente la misma estructura que devuelve `buildConsolidatedContent()`
— nunca leen la base de datos cada uno por su cuenta.

### HTML — la base autocontenida

Un único archivo `.html` con los estilos embebidos (sin dependencias externas) — es el
formato más simple y sirve además como base visual de referencia para los otros dos. Se
genera recorriendo `content.stages` y pintando una sección por etapa, la imagen de la
pirámide, y el manifiesto al final. Útil para compartir por link o verlo directo en el
navegador sin descargar nada.

### PDF — reutiliza el patrón ya probado en producción

Misma librería y mismo flujo que ya funciona hoy (`backend/src/routes/export.js` +
`migration/pyramid-export/README.md`, sección 4): `pdf-lib` en una Cloud Function,
`html2canvas` en el navegador para capturar la Pirámide ya renderizada, portada con los
colores de marca (o el fallback de AHA), resumen por etapa con texto envuelto por ancho
de página, imagen de la pirámide a página completa, manifiesto al final. La única
diferencia real respecto al PDF que ya existe: en vez de iterar `STAGES` completo con un
resumen corto, itera `content.stages` (ya filtrado por `buildConsolidatedContent()`,
las 7 etapas completas) y agrega una portada con logo/colores de marca cuando existen.

### PPT — nuevo, vía `pptxgenjs`

No existe hoy ningún export a PPT en la app — se construye desde cero con la librería
`pptxgenjs` (Node, corre igual en una Cloud Function que `pdf-lib`). Estructura de slides,
1:1 con las secciones del PDF para que ambos formatos cuenten la misma historia:

1. Portada (logo/nombre de marca sobre `primaryColor`, acento `secondaryColor`).
2. Una slide por etapa validada (`content.stages`), título + campos como texto limpio
   (nunca un bloque de párrafo largo pegado — usar bullets cortos cuando el valor del
   campo lo permita, mismo criterio editorial que ya aplica el Manifiesto: claridad antes
   que densidad).
3. Slide de Pirámide de Marca (imagen a slide completo).
4. Slide de Propuesta de Valor (diagrama, si está disponible como imagen igual que la
   pirámide).
5. Slide final de Manifiesto, con la variante de tono elegida.

`pptxgenjs` permite fijar colores de marca por slide (`pptx.theme`) y además **exportar el
mismo archivo como PDF** si se quisiera simplificar a futuro — pero por ahora se mantiene
`pdf-lib` para el PDF porque ya está probado en producción con el layout exacto aprobado;
no hay razón para migrarlo solo por tener una sola librería.

## 5. Dónde vive la lógica, y qué ya está escrito y probado en este sprint

| Pieza | Archivo | Qué tan probado |
|---|---|---|
| Selección del contenido validado (las 8 etapas) | `consolidatedContent.js` | **Probado de verdad** — 10/10 pruebas en `__tests__/`, cubre campos simples, campos tipo lista con elementos mixtos (algunos cerrados, otros no), fallback de marca vs. marca personalizada, y el caso "nada validado todavía". |
| Generación de HTML | — (a escribir en AI Studio) | No escrito — es nuevo en este sprint, ver sección 4 |
| Generación de PDF | — (a portar desde `backend/src/routes/export.js`) | El patrón base YA está probado en producción; lo nuevo es que itere `content.stages` en vez de `STAGES` y use branding por marca |
| Generación de PPT | — (a escribir en AI Studio con `pptxgenjs`) | No escrito — es nuevo en este sprint |
| Campos de branding en `brands/{brandId}` | — (3 campos nuevos en Firestore, sin migración de datos necesaria: se leen con `?? AHA_FALLBACK_BRANDING` cuando no existen) | N/A, es solo schema |

## Cómo verificar esto antes de confiar en él

```bash
node migration/final-deliverable/__tests__/consolidatedContent.test.mjs   # 10/10 deben pasar
```

## Cómo aplicarlo dentro de Google AI Studio

Pégale esto al asistente de Build, adjuntando `consolidatedContent.js` de esta carpeta
como referencia:

```
Ahora necesito el entregable final consolidado: una vez las 8 etapas de una sesión están
completas (o incluso antes, con lo que ya esté validado), quiero poder generarlo y
descargarlo en 3 formatos — PDF, PPT, HTML — eligiendo cuáles quiero con checkboxes (puedo
marcar varios a la vez).

Regla más importante de todo este sprint, no negociable: el contenido de los 3 formatos
debe ser EXCLUSIVAMENTE lo que ya está validado o editado por el usuario en cada etapa —
nunca partes del chat, nunca una síntesis o interpretación nueva generada al momento de
exportar. Para garantizar esto estructuralmente, los 3 formatos deben consumir la MISMA
función de selección de contenido, nunca leer stageData/messages cada uno por su cuenta.

Te adjunto consolidatedContent.js ya escrito y probado (10/10 tests) con esa función:
buildConsolidatedContent() recibe los documentos ya leídos de Firestore (client, brand,
session, un mapa stageDataByNumber con las etapas 1 a 7, la imagen de la pirámide en
base64, y el manifiesto con la variante de tono ya elegida) y devuelve una sola
estructura plana ya filtrada — con los campos de cada etapa, en orden, solo los que
tienen status "validado_por_usuario" o "editado_por_usuario" (para el campo "pilares",
que es una lista, solo entran los elementos individuales que ya están cerrados, aunque el
status agregado del campo completo todavía no lo esté — esto es intencional, está
probado, no lo cambies). Pórtala tal cual a una Cloud Function o a donde viva la lógica
de tu backend — es lógica pura, sin dependencias de Firestore directamente.

Con esa misma estructura, construye los 3 generadores:

1. HTML: un único archivo autocontenido (estilos embebidos, sin dependencias externas),
   una sección por etapa validada, la imagen de la pirámide, y el manifiesto al final.

2. PDF: reutiliza exactamente el patrón de backend/src/routes/export.js (te lo adjunto
   también) — misma librería (pdf-lib), misma captura de la pirámide con html2canvas ya
   renderizada en el navegador, portada con los colores de marca (azul marino #282072 y
   verde lima #b3de4a como respaldo si la marca no tiene colores propios configurados),
   resumen por etapa con texto envuelto por ancho de página. La diferencia: en vez de
   iterar todas las etapas con un resumen corto, itera las etapas ya filtradas que te
   entrega buildConsolidatedContent() (el contenido completo de las 7 etapas con algo
   validado), y usa el logo/colores de la marca cuando existan.

3. PPT: nuevo, con la librería pptxgenjs — portada (logo/nombre de marca), una slide por
   etapa validada con el título y los campos como bullets cortos y claros (nunca un
   párrafo largo pegado en una sola caja de texto), slide de la Pirámide a página
   completa, slide de la Propuesta de Valor, y slide final del Manifiesto. Aplica los
   mismos colores de marca (o el respaldo de AHA) al tema de la presentación.

Además, necesito 3 campos nuevos en el documento brands/{brandId} de Firestore: logoUrl
(string, URL del logo subido a Firebase Storage), primaryColor y secondaryColor (strings
hex). Agrega un panel sencillo en la pantalla de edición de la marca para configurarlos —
un selector de color para cada uno y un cargador de imagen para el logo. Cuando una marca
no tiene estos campos configurados (o son null), los 3 formatos deben usar
automáticamente el respaldo de AHA (#282072 / #b3de4a, sin logo en portada) — nunca deben
fallar ni dejar espacios vacíos por la falta de esta configuración.

La audiencia de este documento son Presidentes, CEOs y Gerentes de Área — el diseño debe
sentirse profesional y potente: una idea por página/slide, máximo 3 tamaños de tipografía,
máximo 2 colores de acento por página, la Pirámide y la Propuesta de Valor como páginas
protagonistas sin texto compitiendo al lado, y el Manifiesto como cierre emocional al
final del documento.

Constrúyelo y muéstrame los 3 formatos generados para una sesión real (Autollantas
Nutibara o Kansha), incluyendo los 3 archivos descargados.
```
