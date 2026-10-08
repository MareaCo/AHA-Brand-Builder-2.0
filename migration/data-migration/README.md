# Sprint 5 — Migración de la sesión real (Autollantas Nutibara) a Firestore

Entregable: exportar la sesión real ya construida con Claude + SQLite, y pasarla a la
estructura de Firestore del Sprint 1 — sin perder nada de lo ya validado.

## Los 3 pasos, y qué tan probado está cada uno

| Paso | Archivo | Qué tan probado |
|---|---|---|
| 1. Exportar de SQLite | `exportFromSqlite.js` | **Probado de verdad**: corrí este archivo contra una base de datos SQLite real (sembrada con Prisma, con la misma estructura exacta de la app), no contra datos simulados a mano. |
| 2. Transformar al formato de Firestore | `transformToFirestore.js` | **Probado de verdad**, con la salida REAL del paso 1 como fixture (`__tests__/fixtures/sample-export.json`) — 10/10 pruebas pasan. |
| 3. Importar a Firestore | `importToFirestore.js` | **No probado** — necesita una credencial real de Firebase (cuenta de servicio) que no existe en este entorno. La lógica es simple (un solo `batch.commit()`) porque ya se apoya en el paso 2, que sí está probado. |

## El hallazgo real de este sprint: no se puede copiar el dato tal cual

Al sembrar una base de datos de prueba con un caso realista (una etapa con 2 de los 3
pilares mínimos, pero con el status guardado como si estuviera completa — el mismo
patrón de bug que motivó los Sprints 1 y 2), el export trajo ese dato desactualizado
intacto. Si `transformToFirestore.js` lo hubiera copiado tal cual a Firestore, el bug se
habría migrado junto con los datos.

En vez de eso, `transformToFirestore.js` **recalcula** dos cosas desde los datos reales,
nunca copia la columna `status` guardada en SQLite:

1. El status agregado de cada campo tipo lista (reutilizando `computeListAggregateStatus`
   del Sprint 1).
2. El status de la etapa completa (nueva función `computeStageStatus`, que usa EXACTAMENTE
   la misma regla que ya usa el backend actual en `stageIsComplete()` — solo que ahí se
   calcula al leer, y aquí se calcula una vez al migrar).

La prueba "transformStageDataRow (Etapa 6, pilares incompletos)" en `__tests__/` reproduce
este caso exacto y confirma que, tras la migración, ese campo queda correctamente en
`propuesto_por_ia`, no en el `validado_por_usuario` desactualizado que tenía en SQLite.

## Otros 2 cambios de formato (ya veníamos viendo este patrón desde el Sprint 4)

- `StageData.content` y `Message.meta` son strings JSON en SQLite — en Firestore pasan a
  ser objetos nativos. `Deliverable.content`, en cambio, se deja como string tal cual (es
  una decisión explícita, ver `migration/firestore/schema.md`) — no todo se desempaca
  igual, por eso hay una prueba específica para cada caso.
- Las fechas (`createdAt`, `updatedAt`) se convierten a objetos `Date` de JavaScript —
  el SDK de Firebase Admin las guarda automáticamente como Timestamp de Firestore.

## Cómo migrar la sesión real de Catalina, paso a paso

```bash
# 1. Exportar la sesión real (reemplaza el id por el de la sesión real — se ve en Prisma
#    Studio: cd backend && npx prisma studio, o en la tabla `sessions`).
cd backend
node ../migration/data-migration/exportFromSqlite.js <sessionId real> > sesion-real.json

# 2. Revisar el archivo sesion-real.json a simple vista — confirma que los campos que
#    esperas ver (insight, pilares, pirámide) estén ahí antes de seguir.

# 3. Importar a Firestore (necesita la credencial de la cuenta de servicio de Firebase,
#    descargada desde la consola de Firebase → Configuración del proyecto → Cuentas de
#    servicio).
cd ../migration/data-migration
npm install firebase-admin
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/tu-credencial.json \
  node importToFirestore.js ../../backend/sesion-real.json
```

Nota sobre el paso 1: `exportFromSqlite.js` usa el cliente de Prisma ya instalado en
`backend/`, por eso el comando debe correr desde ESA carpeta (Node busca
`@prisma/client` en el `node_modules` de donde vive el archivo que lo ejecuta, no en el
de `migration/`).

## Cómo verificar esto antes de confiar en él

```bash
node migration/data-migration/__tests__/transformToFirestore.test.mjs   # 10/10 deben pasar
```

## Cómo aplicarlo dentro de Google AI Studio

Esta parte no se "pega" en el chat de Build como los sprints anteriores — es un script de
migración de datos que se corre UNA SOLA VEZ, por fuera de la app, para llevar la sesión
real de Autollantas Nutibara a la base de Firestore que ya conectaste en los Sprints 1-4.
Pégale esto al asistente de Build solo si quieres que te ayude a adaptar los archivos a la
estructura exacta de tu proyecto en AI Studio (por ejemplo, si tu backend vive en Cloud
Functions en vez de un servidor Express local):

```
Necesito migrar los datos de una sesión real ya construida en la versión anterior de la
app (con SQLite) a la base de Firestore de este proyecto. Te adjunto 3 archivos ya
escritos y probados:

1. exportFromSqlite.js — lee una sesión completa (cliente, marca, sesión, las etapas con
   sus campos, archivos subidos, entregables y mensajes) desde la base de datos SQLite
   anterior, usando Prisma, y la vuelca a un archivo JSON. Esto se corre una sola vez,
   fuera de tu entorno — no necesitas adaptarlo, solo correrlo donde está la base de
   datos SQLite real.

2. transformToFirestore.js — transforma ese JSON a la estructura exacta de colecciones
   de Firestore que ya implementamos en el Sprint 1. Dos cosas importantes que SÍ debes
   mantener (están probadas, no las simplifiques): (a) nunca copia el status guardado en
   SQLite tal cual — siempre lo recalcula desde los datos reales de cada campo, porque
   encontramos casos con el status desactualizado; (b) algunos campos de texto en SQLite
   (el contenido de cada etapa, el meta de cada mensaje) son strings JSON que hay que
   convertir a objetos nativos antes de guardarlos en Firestore — salvo el contenido de
   los entregables, que se deja como string tal cual.

3. importToFirestore.js — escribe el resultado del paso 2 en Firestore en un solo lote
   (batch). Si tu proyecto necesita que esto corra como una Cloud Function en vez de un
   script de línea de comandos, pórtalo así, pero mantén la misma lógica: un solo batch
   atómico, nunca escrituras sueltas documento por documento.

Ayúdame a adaptar estos 3 archivos a la estructura real de mi proyecto en AI Studio.
```
