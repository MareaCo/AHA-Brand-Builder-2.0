# Sprint 2 — Motor de conversación con Gemini

**✅ Validado en producción**, contra la API real de Gemini, con la sesión real de
Autollantas Nutibara — no solo con pruebas simuladas. El diseño de esta carpeta incluye
dos correcciones que surgieron de esa validación y que no estaban en la primera versión;
están documentadas abajo y marcadas en el código con comentarios.

Entregable del Sprint 2: portar el "cerebro" de la app (el prompt base, las 9 etapas,
la herramienta que registra propuestas, y la guarda que protege campos ya validados) de
Claude a Gemini.

## Las 2 correcciones que sí fueron necesarias (encontradas probando con datos reales)

1. **Rechazo genérico de claves inválidas.** El esquema de la función restringe
   `field_key` con `enum`, pero eso solo protege la ruta de function calling — el parser
   de respaldo de texto libre no pasa por ese esquema, y en una prueba real propuso una
   clave inventada (`perfil_demografico_psicografico` en vez de `perfil_target`) que se
   guardó sin que nadie la rechazara. `proposalGuard.js` ahora valida `fieldKey` contra la
   lista real de claves de la etapa en TODOS los casos, sin excepción — ver la prueba
   "rechaza una clave que no existe en la etapa" en `__tests__/`.

2. **Sin palabras clave en el código para detectar si el usuario pidió un cambio.** La
   primera idea (buscar "ajustar", "revisar", "modificar" en el texto del usuario) daba
   falsos positivos. La solución validada: se agrega un parámetro booleano explícito
   `user_requested_change` a la misma llamada de `record_proposal` — el MODELO decide, por
   el contexto completo de la conversación, si el usuario pidió explícitamente cambiar un
   campo ya cerrado, y lo expresa ahí. El código nunca escanea texto, solo lee ese booleano
   ya decidido por Gemini. Ver `functionDeclarations.js` y las pruebas de
   `user_requested_change` en `__tests__/`.

## Decisión de diseño más importante: búsqueda web + function calling no van en la misma llamada

Investigué esto antes de escribir el código porque varias etapas (0, 3, 5, 6, 7) usan
búsqueda web Y necesitan registrar propuestas en el mismo turno — con Claude, ambas
herramientas conviven en una sola llamada sin problema. Con Gemini, la documentación de
Vertex AI dice explícitamente que **no se puede combinar `googleSearch` con herramientas
que no son de búsqueda (como function calling) en la misma petición** — aunque hay
anuncios más recientes de Google (marzo 2026) sobre combinarlas en los modelos Gemini 3.
Como no pude confirmar esto de forma 100% consistente entre fuentes, `conversationEngine.js`
usa el camino seguro que funciona en cualquier caso: **dos llamadas por turno** en las
etapas con búsqueda — una primera solo para buscar (con `googleSearch`), y una segunda
con los resultados ya como contexto de texto, usando `record_proposal` normalmente.

Si confirmas (probándolo con tu clave real) que tu modelo sí soporta combinar ambas
herramientas en una sola llamada, se puede simplificar a una sola pasada — pero el
código actual funciona de cualquier forma, solo con una llamada extra.

## Archivos

| Archivo | Qué es |
|---|---|
| `functionDeclarations.js` | El equivalente de la tool `record_proposal` de Claude, en formato Gemini. Como Gemini no soporta bien el "este campo puede ser string o array" que sí soporta Claude, el valor siempre se declara como texto — para campos tipo lista, la IA lo manda como JSON dentro del string. |
| `parseProposalValue.js` | Interpreta ese string de vuelta a un array real cuando corresponde. **Probada** — ver `__tests__/`. |
| `proposalGuard.js` | La guarda que rechaza propuestas para campos ya validados o con clave inválida — con la misma excepción para campos tipo lista que ya tiene la versión de Claude (nunca bloquear "pilares" a nivel de campo completo), y con el parámetro `user_requested_change` que decide el modelo en vez de buscar palabras clave en el código. **Probada y validada en producción**. |
| `conversationEngine.js` | El motor completo: arma el prompt (reutilizando `stageDefinitions.js` y `systemPrompt.js` del backend actual tal cual, sin duplicarlos), hace la(s) llamada(s) a Gemini, procesa las funciones que la IA quiera llamar, y aplica la guarda. |
| `__tests__/` | Pruebas automatizadas de la lógica pura (sin necesitar ninguna clave de API). |

## Cómo verificar esto antes de confiar en él

```bash
node migration/gemini/__tests__/proposalGuard.test.mjs       # 8/8 deben pasar
node migration/gemini/__tests__/parseProposalValue.test.mjs  # 5/5 deben pasar
```

`conversationEngine.js` en sí se escribió sin poder ejecutarlo contra la API real en este
entorno (sin clave) — pero su lógica (la guarda `checkProposal` y el parámetro
`user_requested_change`) ya fue validada en producción por la implementación real hecha
en AI Studio, contra la sesión real de Autollantas Nutibara, con los 2 ajustes descritos
arriba.

## Cómo aplicarlo dentro de Google AI Studio

Igual que con el Sprint 1: pégale esto al asistente de Build en el chat de tu app,
adjuntando o pegando el contenido de los 4 archivos de código de esta carpeta:

```
Necesito que implementes el motor de conversación de la app usando la API de Gemini
(function calling), siguiendo exactamente este diseño ya revisado y probado:

1. El prompt del sistema se arma igual para las 9 etapas: una base de reglas fijas
   (tono, siempre proponer antes de preguntar, nunca generar contenido de otra etapa,
   etc. — están completas en el documento de metodología, sección 4) + las instrucciones
   específicas de la etapa actual + un checklist del estado de cada campo.

2. La herramienta "record_proposal" se declara con function calling: field_key
   restringido por enum a las claves válidas de esa etapa (nunca debe poder inventar una
   clave nueva), field_label, value (como texto — para campos tipo lista, pídele a la IA
   que mande el valor como un array en formato JSON dentro del string), y rationale
   opcional.

3. CRÍTICO — guarda de bloqueo: antes de aceptar una llamada a record_proposal, revisa
   si ese campo ya está "validado_por_usuario" o "editado_por_usuario". Si lo está Y el
   campo NO es de tipo lista Y el modelo no marcó "user_requested_change: true", rechaza
   la llamada con un mensaje explicando que el campo ya está cerrado. Si el campo SÍ es
   de tipo lista (como "pilares"), NUNCA lo rechaces a nivel de campo completo — la
   protección ahí vive en la fusión por posición que ya implementamos en el Sprint 1
   (cada elemento preserva su propio estado). IMPORTANTE: para decidir si el usuario
   pidió un cambio, NUNCA busques palabras clave sueltas ("ajustar", "revisar", etc.) en
   el texto del usuario desde el código — eso da falsos positivos. En vez de eso, agrega
   un parámetro booleano "user_requested_change" a la función record_proposal, y pídele
   al modelo que lo marque en true únicamente cuando interprete, por el contexto completo
   de la conversación, que el usuario pidió explícitamente modificar un campo ya cerrado.

4. También rechaza de forma genérica cualquier field_key que no esté en la lista de
   claves válidas de la etapa actual — esto debe aplicar siempre, incluso si la propuesta
   llega por un camino de respaldo en texto libre en vez de function calling (ese fue un
   bug real: el camino de respaldo no pasaba por la misma validación).

5. Para las etapas que necesitan búsqueda web (0, 3, 5, 6, 7), si tu integración no
   permite combinar la herramienta de búsqueda de Google con function calling en la
   misma llamada, haz dos llamadas: una primera solo de búsqueda, y pasa el resultado
   como contexto de texto en la segunda llamada, donde sí usas record_proposal.

Te adjunto el código de referencia ya escrito y revisado (functionDeclarations.js,
parseProposalValue.js, proposalGuard.js, conversationEngine.js) — úsalo como base,
ajustándolo a la estructura de tu proyecto.
```
