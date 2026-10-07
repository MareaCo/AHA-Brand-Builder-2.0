# Sprint 3 — Interfaz, conectada a Firestore

A diferencia de los Sprints 1 y 2, aquí no se escribe código nuevo desde cero: la
interfaz **ya existe y está probada en la versión actual** de la app (la que corre hoy
con Claude + SQLite). Este sprint es un inventario de qué pantallas hay, el archivo
exacto donde vive cada una, y — lo más importante — las decisiones de diseño que costaron
varias rondas de prueba y error corregir, para que no se repitan los mismos errores al
reconstruirla en AI Studio.

## Inventario de pantallas (archivos reales del repositorio)

| Pantalla | Archivo | Qué hace |
|---|---|---|
| Dashboard / inicio | `frontend/src/pages/Dashboard.jsx` | Crear o retomar cliente → marca → sesión. |
| Flujo conversacional (Etapas 0-6) | `frontend/src/pages/SessionWorkspace.jsx` + `frontend/src/components/ChatStage.jsx` | El chat con tarjetas de propuesta. |
| Tarjeta de propuesta (campo simple y campo tipo lista) | `frontend/src/components/ProposalCard.jsx` | Validar / Editar / Escribir desde cero. |
| Panel "Lo que hemos construido hasta ahora" | `frontend/src/components/SidePanel.jsx` | Resumen en vivo de todas las etapas, con "reabrir". |
| Subida de insumos | `frontend/src/components/FileUpload.jsx` | Etapa 0. |
| Propuesta de Valor (diagrama) | `frontend/src/pages/PropuestaValorStagePage.jsx` + `frontend/src/components/PropuestaValorDiagram.jsx` | Los círculos conectados. |
| Pirámide de Marca (diagrama) | `frontend/src/pages/PyramidStagePage.jsx` + `frontend/src/components/PyramidCanvas.jsx` | El one-pager gráfico. |
| Manifiesto | `frontend/src/pages/ManifestoStagePage.jsx` | Las 3 variantes de tono. |
| Cierre / resumen final | `frontend/src/pages/ClosingPage.jsx` | Los 3 entregables juntos + exportar PDF. |
| Manejo de errores sin pantalla en blanco | `frontend/src/components/ErrorBoundary.jsx` | Envuelve cada etapa por separado. |

## Decisiones de diseño que NO se deben perder (cada una costó un bug real en producción)

1. **Propuesta primero, nunca pregunta en blanco.** Cada campo se muestra como una
   tarjeta con Validar/Editar/Escribir desde cero — nunca un formulario vacío esperando
   ser llenado. Hay un toggle opcional, oculto por defecto ("¿La conversación no está
   avanzando? Completa tú misma lo que falte →"), para no sentir la etapa como un
   formulario.

2. **Campos tipo lista (pilares) se validan uno por uno**, cada elemento con sus propios
   botones — no un solo botón para todo el campo. Ver `ProposalCard.jsx`, el modo
   `isList`.

3. **Auto-arranque de cada etapa.** Al entrar a una etapa sin mensajes todavía, se manda
   un mensaje de usuario OCULTO instruyendo a la IA a tomar la iniciativa — el usuario
   nunca ve ese mensaje, solo la respuesta de la IA ya arrancando. Nunca debe aparecer
   una etapa vacía esperando que el usuario escriba primero.

4. **Fuentes de búsqueda web visibles.** Cada respuesta que usó búsqueda muestra un
   enlace discreto "🔍 ver fuentes consultadas" que despliega las citas. Esto es lo que
   le da credibilidad a una propuesta que dice "investigué a tu competencia".

5. **La Pirámide es un trapecio, no un rectángulo — y el texto se ancla ABAJO de cada
   banda, nunca arriba.** El trapecio se angosta hacia arriba; si el texto se alinea
   arriba (el comportamiento por defecto de cualquier librería), las palabras se cortan
   contra el borde inclinado. Cada banda necesita padding horizontal calculado a partir
   de su punto más angosto. Ver `PyramidCanvas.jsx`, la función `Band` y la clase
   `justify-end` en `Cell`.

6. **La "Esencia" (la cúspide) se muestra como título AFUERA del triángulo, no adentro.**
   La punta del triángulo es geométricamente demasiado angosta para contener texto
   legible sin cortarlo, sin importar qué tanto se ajuste el padding.

7. **Cualquier bloque de la Pirámide se puede abrir para leer el texto completo** (no
   solo los campos editables) — los heredados de otras etapas se abren en modo lectura
   con una nota de en qué etapa reabrir para cambiarlos. Esto es lo que hace que
   funcione como un one-pager real, no una vista recortada.

8. **Nunca mostrar un objeto JSON crudo en pantalla.** Cualquier valor que pueda llegar
   como objeto anidado (el perfil de Target, por ejemplo) se aplana a texto legible antes
   de mostrarse — mostrarlo crudo (`{"segmento_primario":...}`) es ilegible y en algún
   momento también causó que la pantalla se rompiera por completo (React no acepta un
   objeto como hijo directo).

9. **Chequeo de coherencia: nunca asumir que está bien si falla.** Si la llamada de
   verificación falla, el estado es "no se pudo verificar" (gris), nunca "✓ coherente"
   por defecto.

10. **El chat crece con el contenido** (scroll de la página completa), no es una caja de
    altura fija — un insight o una propuesta larga no debe quedar encerrada en un
    recuadro pequeño con su propio scroll interno.

## Cómo aplicarlo en AI Studio

Pégale esto al asistente de Build (puedes además copiar y pegar el contenido de los
archivos de la tabla de arriba si quieres que lo tome como referencia literal):

```
Ahora necesito que construyas la interfaz completa, conectada a las colecciones de
Firestore del Sprint 1 y al motor de conversación del Sprint 2. Son estas pantallas:

1. Dashboard: crear o retomar cliente → marca → sesión, en un solo flujo claro.
2. Flujo conversacional de las Etapas 0 a 6: un chat donde cada campo que la IA propone
   aparece como una tarjeta con tres acciones — Validar, Editar, Escribir desde cero.
   Nunca debe verse como un formulario en blanco. Incluye un toggle opcional, oculto por
   defecto, que diga "¿La conversación no está avanzando? Completa tú misma lo que
   falte →" por si el usuario necesita llenar algo a mano.
3. Para el campo "pilares" (Etapa 6, tipo lista): cada pilar se muestra como su propia
   tarjeta con sus propios botones de Validar/Editar — nunca un solo botón para todos los
   pilares juntos.
4. Al entrar a una etapa que todavía no tiene mensajes, el sistema debe mandar
   automáticamente un mensaje "oculto" (que el usuario nunca ve) pidiéndole a la IA que
   tome la iniciativa y arranque la conversación — el usuario nunca debe ver una etapa
   vacía esperando que escriba primero.
5. Cualquier respuesta que haya usado búsqueda web debe mostrar un enlace discreto "🔍
   ver fuentes consultadas" con las citas.
6. Propuesta de Valor: un diagrama con un círculo central "Definición del negocio", un
   círculo "Target", y hasta 4 círculos "Pilar N" conectados con líneas punteadas.
7. Pirámide de Marca: IMPORTANTE — dibújala como bandas trapezoidales (más angostas
   arriba) apiladas formando un triángulo, nunca como rectángulos o tarjetas sueltas. El
   texto de cada banda debe alinearse hacia el borde MÁS ANCHO (abajo), nunca arriba —
   si lo alineas arriba, el texto se corta visualmente contra el borde inclinado del
   trapecio. La "Esencia" (el nivel más alto) se muestra como un título aparte ENCIMA de
   toda la pirámide, nunca adentro del triángulo de la punta — es geométricamente
   demasiado angosto para contener texto legible. Cualquier bloque de la pirámide
   (incluidos los heredados de otras etapas, no solo los nuevos) se debe poder abrir con
   un click para leer el texto completo.
8. Manifiesto: muestra las 3 variantes de tono generadas (poética, directa,
   provocadora).
9. Pantalla de cierre: los 3 entregables (Pirámide, Propuesta de Valor, Manifiesto)
   juntos, con opción de exportar a PDF.
10. Un panel lateral "Lo que hemos construido hasta ahora" que muestre en vivo el
    contenido de TODAS las etapas (no solo la actual), con un botón "reabrir" por etapa.
11. Nunca muestres un valor que sea un objeto JSON crudo en pantalla — conviértelo
    siempre a texto legible antes de renderizarlo.
12. El chequeo de coherencia debe tener 3 estados posibles: coherente, hay alertas, o "no
    se pudo verificar" (nunca asumir que está bien si la verificación falla).

Constrúyelo y muéstrame cómo quedó cada pantalla.
```
