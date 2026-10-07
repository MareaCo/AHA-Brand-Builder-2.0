# Sprint 1 — Modelo de datos en Firestore

Esta carpeta es el entregable del Sprint 1 del plan de migración a Google AI Studio +
Firestore (ver el documento completo de metodología y plan de sprints). Contiene el
diseño de datos y la lógica de acceso a datos traducida de Prisma/SQLite a Firestore,
lista para pegar en el nuevo entorno.

## Archivos

| Archivo | Qué es |
|---|---|
| `schema.md` | Diseño completo de las colecciones de Firestore, con explicación de cada decisión. |
| `listFieldLogic.js` | Lógica pura (sin Firestore) para campos tipo "list" como `pilares`: separar texto mal formado, fusionar sin perder elementos validados, calcular el estado agregado. **Probada de punta a punta** — ver `__tests__/`. |
| `stageDataStore.js` | Capa de acceso a datos sobre Firestore (usa `listFieldLogic.js` por dentro). Equivalente función por función de `backend/src/lib/stageDataStore.js`. |
| `firestore.rules` | Reglas de seguridad por defecto — exige login (ver advertencia dentro del archivo). |
| `firestore.indexes.json` | El único índice compuesto que necesita la app (mensajes ordenados por etapa + fecha). |
| `__tests__/listFieldLogic.test.mjs` | Prueba automatizada que reproduce el bug real de producción (validar el pilar 1 bloqueaba los pilares 2 y 3) y confirma que ya no pasa. |

## Cómo verificar que esto funciona, antes de seguir con el Sprint 2

1. Correr la prueba de la lógica pura (no necesita ninguna cuenta de Google ni credenciales):
   ```bash
   node migration/firestore/__tests__/listFieldLogic.test.mjs
   ```
   Debe imprimir `5 pruebas pasaron.` al final.

2. Instalar el Firebase CLI y arrancar el emulador local de Firestore (esto SÍ hace falta
   para probar `stageDataStore.js`, porque ese archivo habla con Firestore de verdad —
   aunque sea una versión que corre en tu propia computadora, no en la nube):
   ```bash
   npm install -g firebase-tools
   firebase init emulators   # elegir solo "Firestore"
   firebase emulators:start --only firestore
   ```
   Con el emulador corriendo, cualquier código que use `firebase-admin/firestore` se
   conecta solo si defines `FIRESTORE_EMULATOR_HOST=localhost:8080` antes de arrancarlo —
   así se puede probar `applyProposals`, `setListItemStatus`, etc. sin tocar datos reales
   ni gastar cuota de Google Cloud.

## Qué falta para el Sprint 2

Este Sprint deja el **modelo de datos** listo. El Sprint 2 conecta esta capa con el
motor de conversación de Gemini: ahí es donde `applyProposals()` se llama de verdad,
alimentada por las propuestas que devuelva cada turno de la IA.
