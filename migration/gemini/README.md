# Sprint 2 — Motor de conversación con Gemini

Entregable del Sprint 2: portar el "cerebro" de la app (el prompt base, las 9 etapas,
la herramienta que registra propuestas, y la guarda que protege campos ya validados) de
Claude a Gemini.

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
| `proposalGuard.js` | La guarda que rechaza propuestas para campos ya validados — con la misma excepción para campos tipo lista que ya tiene la versión de Claude (nunca bloquear "pilares" a nivel de campo completo). **Probada**. |
| `conversationEngine.js` | El motor completo: arma el prompt (reutilizando `stageDefinitions.js` y `systemPrompt.js` del backend actual tal cual, sin duplicarlos), hace la(s) llamada(s) a Gemini, procesa las funciones que la IA quiera llamar, y aplica la guarda. |
| `__tests__/` | Pruebas automatizadas de la lógica pura (sin necesitar ninguna clave de API). |

## Cómo verificar esto antes de confiar en él

```bash
node migration/gemini/__tests__/proposalGuard.test.mjs       # 5/5 deben pasar
node migration/gemini/__tests__/parseProposalValue.test.mjs  # 5/5 deben pasar
```

`conversationEngine.js` en sí **no se ha probado contra la API real de Gemini** (este
entorno no tiene una clave) — antes de usarlo en producción, pruébalo con una clave real
en al menos dos etapas: una sin búsqueda web (ej. Etapa 1) y una con búsqueda (ej. Etapa
5), y compara que el comportamiento sea fiel al de la versión actual con Claude.

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
   campo NO es de tipo lista, rechaza la llamada con un mensaje explicando que el campo
   ya está cerrado. Si el campo SÍ es de tipo lista (como "pilares"), NUNCA lo rechaces a
   nivel de campo completo — la protección ahí vive en la fusión por posición que ya
   implementamos en el Sprint 1 (cada elemento preserva su propio estado).

4. Para las etapas que necesitan búsqueda web (0, 3, 5, 6, 7), si tu integración no
   permite combinar la herramienta de búsqueda de Google con function calling en la
   misma llamada, haz dos llamadas: una primera solo de búsqueda, y pasa el resultado
   como contexto de texto en la segunda llamada, donde sí usas record_proposal.

Te adjunto el código de referencia ya escrito y revisado (functionDeclarations.js,
parseProposalValue.js, proposalGuard.js, conversationEngine.js) — úsalo como base,
ajustándolo a la estructura de tu proyecto.
```
