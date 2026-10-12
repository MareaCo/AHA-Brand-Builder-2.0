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

### Aclaración explícita (pedida por Catalina tras revisar los mockups): el texto va COMPLETO, nunca resumido

El valor de cada campo (`stageData/{N}.fields.{key}.value`) se usa **tal cual está
guardado en la barra lateral derecha — íntegro, sin acortar, sin resumir, sin reescribir**.
Esto es distinto de "elegir qué campos entran" (sección 1, ya resuelto): una vez un campo
SÍ entra, su contenido no se toca.

- **Nunca** generar una versión corta o "resumen ejecutivo" del valor de un campo al
  momento de exportar — ni con una llamada a Gemini, ni recortando el string, ni con
  `…` al final. Si el valor validado es largo, el campo ocupa el espacio que necesite.
- **Nunca** leer `messages` (la sección central del chat) para completar, parafrasear o
  "mejorar" lo que ya hay en `fields.{key}.value` — ese valor, tal como quedó
  `validado_por_usuario` o `editado_por_usuario`, es la única fuente de verdad.
- El DISEÑO (no el contenido) es lo que debe adaptarse al texto, nunca al revés: una
  tarjeta crece de alto si el texto es largo, una página de PDF agrega una página
  adicional si no cabe, una slide del PPT no comprime la letra por debajo de lo legible
  — el texto validado nunca se trunca para que quepa en un layout fijo.
- Los mockups de diseño en `https://claude.ai/artifact/1v7vvnJ4swkRDRZwxSqFDY` (HTML),
  `https://claude.ai/artifact/K3oH5LKm87gzgeC3KLnC6A` (PPT) y
  `https://claude.ai/artifact/U4cQeiso99nxArjoApfB5C` (PDF) usan texto de EJEMPLO corto a
  propósito, solo para definir el estilo — no asumir que el contenido real siempre será
  así de breve; `buildConsolidatedContent()` nunca decide cuánto texto cabe, solo cuáles
  campos entran.

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

### 3.1. Extracción automática desde la página web (añadido tras construir lo anterior)

Pedido de Catalina al ver el panel ya construido: que la página web de la marca sea el
**primer insumo** de la Etapa 0, y que de ahí se extraigan automáticamente tanto el logo
como los colores — en vez de depender solo de subirlos a mano.

Regla que se mantiene igual que en el resto de la metodología, y que es la razón de ser
de este sub-apartado: **nunca se guarda nada en `brands/{brandId}` sin que la persona lo
valide**. El análisis de la página web PROPONE un logo y 2 colores candidatos — mismo
patrón `propuesto_por_ia` → `validado_por_usuario`/`editado_por_usuario` que ya usa el
resto de la app — la persona los ve, los acepta tal cual o los ajusta, y solo ENTONCES se
guardan. Un logo mal detectado o un color de baja confianza en un documento para un CEO es
justamente el tipo de error que este patrón ya existe para evitar en toda la app.

Cómo se extrae (orden de preferencia, nunca inventar si no hay confianza razonable):

- **Logo**: (a) `<meta property="og:image">`, (b) el favicon/`apple-touch-icon` de mayor
  resolución, (c) la primera imagen dentro del `<header>` de la página cuyo nombre/clase/
  `alt` contenga "logo". Si ninguna se encuentra con confianza, el campo queda vacío para
  completarlo a mano — nunca se fuerza una imagen que no sea claramente el logo.
- **Colores**: el color de fondo dominante del encabezado o de los botones principales del
  sitio (leyendo las reglas CSS más repetidas, o promediando los píxeles del logo/header).
  Igual que con el logo: sin confianza razonable, el campo queda vacío, nunca se inventa
  un color genérico.

Dónde vive esto en la UI ya construida: el botón "Analizar Presencia Web" (Etapa 0,
bloque "3. Página web", hoy deshabilitado/placeholder) — al activarse, los resultados
(logo + colores candidatos) aparecen como propuesta editable directamente en los bloques
"1. Logo de marca" y "Paleta de marca" que ya existen, nunca como un campo ni un paso
aparte. Una vez la persona los confirma o ajusta, se guardan en `brands/{brandId}` con el
mismo esquema de siempre (`logoUrl`/`primaryColor`/`secondaryColor`) — el entregable final
(sección 4) no cambia en nada, sigue leyendo esos mismos 3 campos sin saber si llegaron ahí
a mano o por análisis automático de la web.

## 4. Los 3 formatos de salida

El usuario elige con checkboxes cuáles formatos quiere (puede marcar varios a la vez) y
un solo botón "Generar entregable" dispara la generación de todos los marcados. Los 3
formatos consumen exactamente la misma estructura que devuelve `buildConsolidatedContent()`
— nunca leen la base de datos cada uno por su cuenta.

### HTML — experiencia navegable en el navegador (no un scroll plano)

Un único archivo `.html` autocontenido (sin dependencias externas) — pero no es una página
que se desplaza de arriba a abajo: es una **experiencia por pantallas**, una etapa a la
vez, pensada para presentarse en vivo o recorrerse sola. Catalina pidió construir esto
siempre a partir de la siguiente plantilla de prompt (uso ya probado por ella para decks en
vivo), **con un solo ajuste no negociable**: el límite de "~45 palabras por slide" de la
plantilla original NO aplica aquí — cada pantalla lleva el texto COMPLETO y validado de su
campo (ver la aclaración de la sección anterior), nunca acortado. Todo lo demás de la
plantilla sí aplica tal cual:

```
Convierte mi presentación en una experiencia en vivo en el navegador, un solo
archivo HTML autocontenido (sin dependencias externas), a partir de este
contenido: [el resultado de buildConsolidatedContent() para esta sesión — portada,
las etapas 1 a 7 ya validadas, y la variante de manifiesto elegida].

Contexto: la presento en vivo ante Presidentes, CEOs y Gerentes de Área, o se la
dejo para que la recorran solos. IMPORTANTE — a diferencia de un pitch deck normal,
NO hay límite de palabras por pantalla: cada pantalla debe mostrar el texto COMPLETO
y ya validado de ese campo, tal como quedó en la columna derecha de la app — nunca
una versión resumida a ~45 palabras. Una pantalla, un campo (o un grupo pequeño de
campos de la misma etapa) — eso sí se mantiene.

Identidad visual: los colores de marca ya resueltos (logoUrl, primaryColor,
secondaryColor de brands/{brandId}, con el respaldo de AHA #282072/#b3de4a cuando
no existen) y la tipografía Public Sans en todo el documento — ver sección 2
(sistema de diseño) de este mismo documento.

Efectos de vida ("wow"):
* Quiero profundidad y movimiento tipo Three.js, PERO elige tú la técnica más
  liviana que logre el efecto (CSS, SVG animado, canvas 2D, WebGL solo si es
  imprescindible). Prioriza que el archivo pese poco y cargue instantáneo.
* Regla de oro: cada animación debe SIGNIFICAR algo del argumento (la pirámide se
  arma nivel por nivel de abajo hacia arriba, un pilar aparece al validarse, el
  manifiesto se revela como cierre) — nada de partículas decorativas porque sí.
* Los momentos importantes los dispara la persona con un clic/tecla, nunca se
  reproducen solos al entrar a la pantalla.

Navegación: flecha derecha/clic/tap avanza, izquierda/swipe retrocede, F pantalla
completa, B pantalla en negro. Indicador discreto de en qué etapa va (ej. "4 / 9").
En celular vertical, pedir girar el dispositivo.

Calidad: texto legible a 4 metros en un proyector con luz (contraste de al menos
50% sobre el fondo en todo texto con significado). Verifica el resultado
renderizando capturas de cada pantalla y corrigiendo lo que se desborde o choque
— con texto completo y no acortado, una etapa larga puede necesitar más de una
pantalla; que el diseño lo resuelva (una segunda pantalla "4b"), nunca que el
texto se trunque.

Entrega: el archivo HTML + una versión PDF estática como documento para dejar
(este PDF estático es el mismo formato PDF descrito más abajo, no uno nuevo).
```

Tres reglas de proceso que van siempre con este prompt (pedidas por Catalina, ya
probadas por ella en otros decks):

1. **Construir por rondas**: primero estructura y contenido (qué entra en cada pantalla,
   en qué orden), después el sistema visual (colores, tipografía, layout), y solo al
   final los efectos. Un efecto encima de una pantalla mal resuelta es maquillaje sobre
   un problema.
2. **Pedir crítica antes de entregar**: que AI Studio actúe como "la audiencia más
   escéptica" y diga qué preguntas incómodas le haría este documento a un CEO — esa
   ronda vale más que cualquier animación.
3. **El wow es un momento, no una decoración**: si un efecto no se puede explicar en una
   frase de qué significa para la estrategia de esta marca, se corta.

Mecánicas de navegación que quedan FUERA de lo que este mismo prompt puede demostrar
dentro de una herramienta de mockup/diseño (teclas globales, pantalla completa real,
swipe táctil) — son estándar en un sitio web normal sin sandbox, así que AI Studio debe
implementarlas tal cual al construir la app real, aunque el mockup de referencia
(`https://claude.ai/artifact/1v7vvnJ4swkRDRZwxSqFDY`) solo pueda demostrar la navegación
por clic/botón y el indicador de pantalla, por la misma limitación de sandbox.

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

## Cómo aplicarlo dentro de Google AI Studio (histórico — ver sección 6 para el prompt vigente)

Esta fue la primera versión del prompt de este sprint, ya superada por los ajustes de las
secciones 1 a 4 (texto completo nunca resumido, tipografía única Public Sans, HTML
convertido en experiencia navegable, PDF/PPT con las 9 páginas/slides completas). Se deja
aquí solo como registro de cómo empezó — **no la vuelvas a pegar**, usa la sección 6.

<details>
<summary>Prompt original (histórico)</summary>

```
Ahora necesito el entregable final consolidado: una vez las 8 etapas de una sesión están
completas (o incluso antes, con lo que ya esté validado), quiero poder generarlo y
descargarlo en 3 formatos — PDF, PPT, HTML — eligiendo cuáles quiero con checkboxes (puedo
marcar varios a la vez).

[...texto original con el HTML autocontenido simple de secciones, PDF con #282072/#b3de4a
fijos como ejemplo, y PPT con bullets genéricos — reemplazado por la sección 6.]
```

</details>

## 6. Prompt final de ajuste — el que se pega hoy en AI Studio

AI Studio ya tiene una primera versión construida (checkboxes de formato, los 3
generadores, el panel de marca, y la extracción automática de logo/colores desde la
página web). Esto NO es un build desde cero — es la ronda de ajuste que deja todo
alineado con lo que se definió y se probó en los mockups de diseño de esta conversación:

- `https://claude.ai/artifact/1v7vvnJ4swkRDRZwxSqFDY` — Landing HTML (experiencia
  navegable de 9 pantallas, con los 2 momentos "wow" — pirámide y pilares — armándose al
  clic)
- `https://claude.ai/artifact/K3oH5LKm87gzgeC3KLnC6A` — PPT (9 slides)
- `https://claude.ai/artifact/U4cQeiso99nxArjoApfB5C` — PDF (9 páginas)

**Antes de pegar el prompt**: toma una captura de cada uno de los 3 mockups (ábrelos,
recorre las pantallas/slides/páginas) y adjúntaselas a AI Studio junto con el texto — así
ve exactamente el diseño que hay que igualar, no solo lo que se describe en palabras.

```
Esta es una ronda de AJUSTE sobre lo que ya construiste para el entregable final (PDF,
PPT, HTML) — no empieces desde cero. Te adjunto capturas de los 3 mockups de diseño ya
aprobados (Landing HTML, PPT, PDF) — iguala ese diseño exactamente. 4 ajustes puntuales:

1. REGLA NO NEGOCIABLE, otra vez, porque es la más importante de todo el sprint: el texto
   de cada campo va COMPLETO — exactamente como quedó guardado en fields.{key}.value tras
   ser validado o editado en la columna derecha — nunca una versión resumida, acortada o
   reescrita, y nunca generada a partir del chat (sección central). Si el texto es largo,
   el DISEÑO se adapta (una tarjeta crece, el PDF agrega una página, una pantalla del HTML
   se divide en "4a"/"4b") — nunca se trunca el contenido validado para que quepa.

2. TIPOGRAFÍA: una sola familia en los 3 formatos — Public Sans (pesos 400/500/600/700/800
   según jerarquía) — elimina cualquier tipografía serif que hayas usado para títulos,
   como se ve en los mockups adjuntos.

3. PDF y PPT deben tener el mismo contenido COMPLETO que el HTML — portada + Etapa 1
   (Territorio) + Etapa 2 (Insight) + Etapa 3 (Concepto) + Etapa 4 (Propósito y Definición
   del Negocio) + Etapa 5 (Target) + Etapa 6 (Pilares) + Etapa 7 (Pirámide) + Manifiesto —
   las 9 páginas/slides completas, no un resumen ejecutivo corto. Los 3 formatos deben
   mostrar exactamente las mismas etapas con el mismo contenido, solo cambia el formato de
   presentación — si una etapa no tiene nada validado todavía, esa página/slide se omite
   en los 3 formatos por igual (nunca aparece en uno y en otro no).

4. El HTML deja de ser una página de scroll — se convierte en una EXPERIENCIA NAVEGABLE,
   una pantalla a la vez (ve el mockup adjunto). Reconstrúyelo así:

   Convierte el entregable en una experiencia en vivo en el navegador, un solo archivo
   HTML autocontenido (sin dependencias externas), a partir de buildConsolidatedContent()
   de la sesión: portada, las etapas 1 a 7 ya validadas, y la variante de manifiesto
   elegida.

   Contexto: se presenta en vivo ante Presidentes, CEOs y Gerentes de Área, o se deja para
   que la persona la recorra sola. IMPORTANTE — a diferencia de un pitch deck normal, NO
   hay límite de palabras por pantalla: cada pantalla muestra el texto COMPLETO y ya
   validado de ese campo (regla 1 de arriba) — nunca una versión resumida. Una pantalla,
   un campo (o un grupo pequeño de campos de la misma etapa).

   Identidad visual: logoUrl/primaryColor/secondaryColor de brands/{brandId} (respaldo de
   AHA #282072/#b3de4a cuando no existen), tipografía Public Sans en todo el documento.

   Efectos de vida ("wow"):
   - Quiero profundidad y movimiento tipo Three.js, PERO elige tú la técnica más liviana
     que logre el efecto (CSS, SVG animado, canvas 2D, WebGL solo si es imprescindible).
     Prioriza que el archivo pese poco y cargue instantáneo.
   - Regla de oro: cada animación debe SIGNIFICAR algo del argumento — la Pirámide se
     arma nivel por nivel de abajo hacia arriba (como ya se ve en el mockup adjunto), los
     Pilares se revelan uno a uno — nada de partículas decorativas porque sí.
   - Los momentos importantes los dispara la persona con un clic o una tecla, nunca se
     reproducen solos al entrar a la pantalla.

   Navegación: flecha derecha/clic/tap avanza, izquierda/swipe retrocede, F pantalla
   completa, B pantalla en negro. Indicador discreto de en qué etapa va (ej. "4 / 9"). En
   celular vertical, pide girar el dispositivo.

   Calidad: texto legible a 4 metros en un proyector con luz (contraste de al menos 50%
   sobre el fondo en todo texto con significado). Verifica renderizando capturas de cada
   pantalla y corrigiendo lo que se desborde o choque.

   Entrega: el archivo HTML + una versión PDF estática como documento para dejar (el
   mismo PDF del punto 3, no uno nuevo).

Construye esto por rondas — primero confirma que el contenido y el texto completo están
bien, después ajusta el sistema visual (Public Sans, colores de marca), y al final los
efectos de la experiencia HTML. Antes de darlo por terminado, actúa como mi audiencia más
escéptica y dime qué preguntas incómodas le haría este documento a un CEO — corrige lo que
encuentres.

Muéstrame los 3 formatos regenerados para una sesión real (Autollantas Nutibara), con las
9 etapas completas en los 3, y confírmame explícitamente que el texto de cada campo es el
valor completo sin resumir.
```
