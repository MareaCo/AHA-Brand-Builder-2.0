# Sprint 4 — Diagramas (Pirámide y Propuesta de Valor) + exportación a PDF

Este sprint cubre los 3 entregables gráficos: el diagrama de Pirámide de Marca, el
diagrama de Propuesta de Valor, y la exportación final a PDF con los 3 entregables
(Pirámide, Propuesta de Valor, Manifiesto).

## 1. Los diagramas en sí: ya cubiertos por el Sprint 3, sin cambios

`PyramidCanvas.jsx` y `PropuestaValorDiagram.jsx` son componentes de React puros — no
tienen ninguna dependencia de Claude, de Prisma, ni de SQLite. Las 3 decisiones de diseño
más importantes (trapecio con texto anclado abajo, Esencia como título aparte, bloques
clickeables) ya están documentadas en `migration/ui/README.md`, puntos 5, 6 y 7. No hay
nada nuevo que portar aquí — en AI Studio, reconstrúyelos leyendo esos mismos archivos
como referencia.

## 2. Lo que SÍ cambia: de dónde vienen los datos que alimentan esos diagramas

`buildPyramidData()` (el que decide qué campo de qué etapa va en qué celda de la
pirámide) es lógica 100% de negocio, sin nada de base de datos — pero hay **un detalle
real que sí cambia** al pasar de SQLite a Firestore:

- En SQLite/Prisma, el contenido de cada etapa se guarda como un **string JSON** en la
  columna `content`, así que hay que hacer `JSON.parse(row.content)` antes de leerlo.
- En Firestore, cada documento de la colección `stageData` guarda `content` como un
  **mapa/objeto nativo** — nunca hay que parsear nada, y si lo intentas sobre un objeto ya
  nativo, revienta.

`pyramidData.js` de esta carpeta ya tiene ese ajuste hecho — es el único cambio real
respecto al original (`backend/src/lib/pyramidData.js`). Todo lo demás (qué campo de qué
etapa) es idéntico. **Probado** con datos simulados con la forma exacta de un documento
de Firestore — ver `__tests__/`.

## 3. La síntesis con IA ("condensar para el one-pager")

`pyramidSynthesis.js` de esta carpeta es el equivalente con Gemini del archivo
`backend/src/lib/pyramidSynthesis.js` (que usa Claude). El prompt del sistema — ya afinado
para que las frases queden cortas y no se invente contenido nuevo — se copió exactamente
igual; solo cambia la llamada al modelo (`ai.models.generateContent` de `@google/genai`
en vez del cliente de Anthropic). **No probado contra la API real de Gemini** (sin clave
en este entorno) — antes de confiar en él, pruébalo con una pirámide real y compara el
JSON resultante contra el de la versión actual con Claude.

## 4. Exportación a PDF: qué se mantiene igual y qué necesita moverse

Así funciona hoy (`frontend/src/pages/ClosingPage.jsx` + `backend/src/routes/export.js`):

1. El frontend toma una **captura de pantalla** del diagrama de la Pirámide ya renderizado
   con `html2canvas` (el usuario nunca ve este paso, es automático al apretar "Descargar
   entregables").
2. Esa imagen (como base64) se manda junto con el texto del Manifiesto elegido a un
   endpoint del backend.
3. El backend arma el PDF con la librería `pdf-lib`: portada, resumen ejecutivo (itera las
   etapas y solo incluye campos ya validados o editados), la imagen de la Pirámide como
   página completa, y el texto del Manifiesto. Devuelve un link de descarga.

**Lo que se mantiene igual en AI Studio:** el paso 1 (`html2canvas`) no tiene nada que ver
con el backend — es pura captura del DOM en el navegador, funciona idéntico sin importar
dónde esté la base de datos.

**Lo que necesita moverse:** el paso 3 (armar el PDF con `pdf-lib`) hoy vive en un
endpoint de Express. En una app generada por AI Studio con backend de Firebase, el lugar
natural para esa misma lógica es una **Cloud Function** (HTTPS callable) — `pdf-lib` es
una librería de Node pura, corre igual de bien ahí sin cambios de lógica, solo cambia
dónde vive el archivo generado (en vez de guardarlo en un disco local con `EXPORT_DIR`,
subirlo a **Firebase Storage** y devolver su URL de descarga).

Los colores y el layout del PDF (portada azul marino `#282072`, acentos en verde lima
`#b3de4a`, resumen ejecutivo con texto envuelto por ancho de página) deben copiarse
exactamente de `backend/src/routes/export.js` — son decisiones de marca ya aprobadas, no
hay que rediseñarlas.

## Archivos

| Archivo | Qué es |
|---|---|
| `pyramidData.js` | Consolidación de datos de la pirámide, adaptada a la forma nativa de documentos de Firestore. **Probada**. |
| `pyramidSynthesis.js` | La llamada de IA que condensa el contenido para el one-pager, con Gemini. No probada contra la API real (sin clave). |
| `__tests__/` | Pruebas automatizadas de `pyramidData.js`. |

## Cómo verificar esto antes de confiar en él

```bash
node migration/pyramid-export/__tests__/pyramidData.test.mjs   # 4/4 deben pasar
```

## Cómo aplicarlo dentro de Google AI Studio

Pégale esto al asistente de Build, adjuntando el contenido de `pyramidData.js` y
`pyramidSynthesis.js` de esta carpeta como referencia:

```
Ahora necesito los 3 entregables gráficos, conectados a Firestore:

1. Diagrama de Propuesta de Valor: un círculo central "Definición del negocio", un
   círculo "Target", y hasta 4 círculos "Pilar N" conectados con líneas punteadas. Esto
   ya se construyó en el sprint de interfaz — si ya lo tienes, no lo repitas, solo
   conéctalo a los datos reales.

2. Diagrama de Pirámide de Marca: bandas trapezoidales apiladas (más angostas arriba)
   formando un triángulo. El texto de cada banda se alinea hacia el borde MÁS ANCHO
   (abajo) — si el texto se alinea arriba, se corta contra el borde inclinado. La
   "Esencia" va como título aparte ENCIMA de la pirámide, nunca adentro de la punta.
   Cada celda consolida datos de distintas etapas: entorno competitivo, target y
   asociaciones de marca + insight en la base; razones para creer, personalidad y
   beneficios en el medio; el propósito ("por qué") arriba; la esencia en la cúspide;
   arquetipo dominante, arquetipo secundario y territorio de comunicación en una nota
   aparte. Te adjunto pyramidData.js con el mapeo exacto de qué campo de qué etapa va en
   cada celda — IMPORTANTE: en Firestore, el campo "content" de cada documento de
   stageData ya es un objeto nativo, nunca hagas JSON.parse() sobre él (eso es un string
   solo en la versión antigua con SQLite).

3. Antes de mostrar la pirámide, usa Gemini para condensar el contenido en frases cortas
   (máximo 8-10 palabras) que quepan en cada celda del one-pager — sin inventar
   contenido nuevo, solo sintetizando lo que ya existe. Te adjunto el prompt exacto ya
   probado en pyramidSynthesis.js.

4. Exportación final a PDF: un botón "Descargar entregables" que (a) toma una captura del
   diagrama de la Pirámide ya renderizado en el navegador, (b) manda esa imagen junto con
   el texto del Manifiesto elegido a una Cloud Function, (c) esa función arma un PDF con
   portada (azul marino #282072 con acentos verde lima #b3de4a), resumen ejecutivo con
   los campos ya validados de cada etapa, la imagen de la pirámide a página completa, y el
   texto del manifiesto — y sube el PDF resultante a Firebase Storage, devolviendo su URL
   de descarga. Te adjunto export.js de la versión actual (usa la librería pdf-lib) como
   referencia exacta del layout y los colores — pórtalo a una Cloud Function tal cual,
   cambiando solo dónde se guarda el archivo (Storage en vez de disco local).

Constrúyelo y muéstrame cómo quedó cada entregable, incluyendo el PDF final descargado.
```
