# Sprint 6 — Pruebas del flujo completo y despliegue final

Este sprint es distinto a los anteriores: no hay código nuevo que escribir, porque no hay
nada más que portar — es la lista de verificación para probar la app ya reconstruida en
AI Studio de punta a punta, y la guía para publicarla en una URL de uso diario, sin
Terminal, sin `npm run dev`.

No se puede ejecutar nada de esto en este entorno (no hay acceso a tu proyecto real de AI
Studio/Firebase) — esto es una guía para que TÚ la seas quien la ejecute, con tu app real.

## Parte 1 — Lista de verificación, etapa por etapa

Cada punto de esta lista corresponde a un bug real que encontramos y corregimos durante
este proyecto — no son casos hipotéticos, son los que de verdad fallaron antes. Pruébalos
con una marca de prueba (no con la sesión real todavía) para no arriesgar esos datos.

**Etapa 0 — Insumos**
- [ ] Subir un PDF o Word real. Debe aparecer un resumen extraído, no quedarse "pensando" para siempre.
- [ ] La etapa nunca debe verse como un formulario vacío — siempre debe iniciar con la IA proponiendo algo o guiando, nunca con una pregunta en blanco esperando.

**Etapa 1 — Territorio de Marca** (`que_es`, `que_no_es`)
- [ ] La IA propone primero, nunca pregunta en blanco.
- [ ] Al escribir una observación sobre la propuesta, la IA debe responder — confirma que no se quede "pensando" sin hacer nada (este fue un bug real).

**Etapa 2 — Insight de Marca** (`verdad`, `necesidad`, `friccion`, `insight_consolidado`)
- [ ] Los 4 campos se registran, no solo el consolidado final — si solo se guarda `insight_consolidado`, la etapa nunca podrá marcarse como completa (depende de los 4).

**Etapa 3 — Concepto de Marca** (con búsqueda web)
- [ ] Las respuestas que usaron búsqueda muestran el enlace "🔍 ver fuentes consultadas" con citas reales, no vacío.
- [ ] Los 4 campos (beneficios racionales, emocionales, RTB, concepto completo) se registran con sus claves exactas.

**Etapa 4 — Propósito y Definición del Negocio**
- [ ] `por_que`, `como`, `que` se registran, y `definicion_negocio` se sintetiza automáticamente a partir de los tres.

**Etapa 5 — Target** (con búsqueda web)
- [ ] El campo se guarda bajo la clave exacta `perfil_target` — **nunca** bajo una variante como `perfil_demografico_psicografico` (este fue un bug crítico real, ver Sprint 2). Verifícalo abriendo la base de Firestore, no solo mirando la pantalla.

**Etapa 6 — Propuesta de Valor / Pilares** (campo tipo lista, mínimo 3)
- [ ] Cada pilar se valida con sus propios botones — validar el Pilar 1 **no debe bloquear** que la IA siga proponiendo el Pilar 2 y 3 (el bug original que motivó todo el Sprint 1).
- [ ] La etapa no se marca completa hasta tener al menos 3 pilares, todos validados o editados.

**Etapa 7 — Pirámide de Marca** (7 campos)
- [ ] Los botones de Validar/Editar/Ajustar aparecen para CADA campo a medida que la IA los propone, uno a la vez — no deben quedarse sin aparecer (bug real reportado).
- [ ] "Asociaciones de marca" se explica y se propone con la definición correcta (no confundirlo con personalidad ni con arquetipos).
- [ ] Si pides un cambio sobre un campo ya validado (ej. "ajústame el territorio de comunicación"), la IA lo entiende por el contexto y permite el cambio — sin que el código esté buscando la palabra "ajustar" en tu mensaje (ver Sprint 2, `user_requested_change`).

**Etapa 8 — Manifiesto de Marca**
- [ ] Se generan las 3 variantes de tono (poética, directa, provocadora) y se pueden leer completas.

**Cierre y entregables**
- [ ] La Pirámide se ve como bandas trapezoidales apiladas, nunca como rectángulos o tarjetas sueltas — y el texto de cada banda está anclado al borde ANCHO (abajo), nunca cortado contra el borde inclinado (bug real de geometría, Sprint 3/4).
- [ ] La "Esencia" se muestra como título aparte, fuera del triángulo.
- [ ] Cualquier bloque de la pirámide (incluidos los heredados de otras etapas) se puede abrir para leer el texto completo.
- [ ] El diagrama de Propuesta de Valor muestra el círculo central, el target, y los pilares conectados.
- [ ] El botón "Descargar entregables" genera un PDF real, descargable, con la portada en azul marino/verde lima, el resumen ejecutivo, la imagen de la pirámide, y el manifiesto — ábrelo y revísalo completo, no solo confirmes que descargó algo.

**Verificaciones que cruzan todas las etapas**
- [ ] Nunca se ve un objeto JSON crudo en pantalla (`{"segmento_primario":...}`) — todo texto se muestra legible.
- [ ] El panel lateral "Lo que hemos construido hasta ahora" refleja TODAS las etapas en vivo, con su botón "reabrir" funcionando.
- [ ] El chequeo de coherencia muestra 3 estados posibles (coherente / hay alertas / no se pudo verificar) — nunca asume "✓ coherente" si la verificación falla.
- [ ] Intentar registrar una clave de campo que no existe en esa etapa se rechaza (puedes pedirle al asistente de AI Studio que simule esto a propósito para confirmarlo).

## Parte 2 — Probar con tu sesión real migrada

Antes de dar por cerrado este sprint, repite esto con la sesión real de Autollantas
Nutibara ya migrada (Sprint 5):

- [ ] Abre esa sesión en la app nueva y confirma que las 9 etapas muestran exactamente lo
      que ya habías validado — nada vacío, nada distinto a lo que recuerdas haber
      aprobado en la versión anterior.
- [ ] Genera la Pirámide, la Propuesta de Valor y el PDF final con esos datos reales, y
      compáralos con los que ya tenías de la versión con Claude — deben contar la misma
      historia de marca, aunque el texto exacto pueda variar un poco por ser un modelo
      distinto.

## Parte 3 — Publicar la app para uso diario (sin Terminal)

Esto se hace desde la interfaz de Google AI Studio / consola de Firebase, con clics, no
con comandos. Los nombres exactos de botones pueden variar según la versión de AI Studio
que tengas — si algo no coincide exactamente, busca la opción equivalente de "publicar" o
"desplegar" en esa misma pantalla.

1. **Revisa las credenciales antes de publicar.** La clave de la API de Gemini y la
   configuración de Firebase deben estar guardadas como variables de entorno / secretos
   del proyecto en AI Studio — nunca escritas directamente en el código. Pídele al
   asistente de Build que te confirme esto si no estás segura.

2. **Revisa las reglas de seguridad de Firestore.** Las reglas de `migration/firestore/firestore.rules`
   (del Sprint 1) deben estar desplegadas en tu proyecto REAL de Firebase, no solo en un
   entorno de prueba — una regla abierta ("cualquiera puede leer/escribir") deja tus datos
   de clientes expuestos a cualquiera con el link.

3. **Publica/despliega desde AI Studio.** La función de "Build" de AI Studio tiene una
   opción para publicar la app a un entorno real (normalmente a Cloud Run o a Firebase
   Hosting) — úsala en vez de dejarla solo en modo de vista previa/borrador.

4. **Prueba la URL final en una ventana de incógnito** (sin tu sesión de Google
   abierta) — así confirmas que cualquiera con el link puede entrar sin necesitar tu
   cuenta de desarrolladora, y que no quedó ninguna pantalla de "modo de prueba".

5. **Guarda esa URL como favorito** — ese es tu único punto de entrada diario a partir de
   ahora. No necesitas abrir una Terminal, no necesitas correr `npm run dev` — eso solo
   era necesario con la versión anterior corriendo en tu propia máquina.

## Cómo aplicarlo dentro de Google AI Studio

Pégale esto al asistente de Build cuando ya tengas la app completa de los Sprints 1-5 y
quieras dejarla lista para uso diario:

```
Ya terminé de construir y conectar todas las piezas de la app (base de datos, motor de
conversación, interfaz, diagramas y exportación a PDF). Ahora necesito dejarla lista para
uso diario, no solo en vista previa:

1. Confirma que la clave de la API de Gemini y la configuración de Firebase están
   guardadas como variables de entorno / secretos del proyecto, nunca escritas
   directamente en el código fuente.

2. Confirma que las reglas de seguridad de Firestore de mi proyecto (adjunto
   firestore.rules) ya están desplegadas en mi proyecto REAL de Firebase, no solo en un
   entorno de prueba.

3. Publica/despliega la app a un entorno real (Cloud Run o Firebase Hosting) y dame la
   URL final.

4. Confirma que esa URL funciona para cualquiera con el link, sin necesitar iniciar
   sesión con mi cuenta de desarrolladora.

Dame la URL final y confírmame estos 4 puntos uno por uno.
```

Cuando tengas la URL final y hayas corrido la lista de verificación de la Parte 1 y la
Parte 2 de este documento, el proyecto de migración queda completo.
