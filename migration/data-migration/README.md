# Sprint 5 — Migración de los clientes reales (Autollantas Nutibara, Kansha, y los que
# sigan) a Firestore

Entregable: exportar TODOS los clientes/marcas/sesiones ya construidos con Claude +
SQLite, y pasarlos a la estructura de Firestore del Sprint 1 — sin perder nada de lo ya
validado, y de una sola vez (no cliente por cliente).

## Los 3 pasos, y qué tan probado está cada uno

| Paso | Archivo | Qué tan probado |
|---|---|---|
| 1. Exportar de SQLite | `exportFromSqlite.js` | **Probado de verdad**: corrí este archivo (con `--all`, el mismo modo que vas a usar) contra una base de datos SQLite real con 2 clientes distintos (uno con 2 sesiones bajo la misma marca), sembrada con Prisma — no contra datos simulados a mano. |
| 2. Transformar al formato de Firestore | `transformToFirestore.js` | **Probado de verdad**, con la salida REAL del paso 1 como fixture (`__tests__/fixtures/sample-export.json` y `sample-export-all.json`) — 13/13 pruebas pasan. |
| 3. Importar a Firestore | `importToFirestore.js` | **No probado** — necesita una credencial real de Firebase (cuenta de servicio) que no existe en este entorno. La lógica es simple (lotes de `batch.commit()`) porque ya se apoya en el paso 2, que sí está probado. |

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

## El hallazgo real al migrar VARIOS clientes a la vez: no duplicar cliente/marca

Si un cliente tiene más de una sesión bajo la misma marca (como Autollantas Nutibara en
la prueba real), el documento `clients/{id}` y `brands/{id}` de ese cliente saldría
repetido una vez por cada sesión. Firestore no permite escribir dos veces al mismo
documento dentro de un solo lote (`batch`) — así que `transformAll()` (la función que usa
`exportFromSqlite.js --all`) quita los duplicados por `path` antes de entregar la lista de
escrituras. La prueba "transformAll NO duplica el documento de cliente/marca..." en
`__tests__/` reproduce este caso exacto con datos reales de 2 clientes.

## Otros 2 cambios de formato (ya veníamos viendo este patrón desde el Sprint 4)

- `StageData.content` y `Message.meta` son strings JSON en SQLite — en Firestore pasan a
  ser objetos nativos. `Deliverable.content`, en cambio, se deja como string tal cual (es
  una decisión explícita, ver `migration/firestore/schema.md`) — no todo se desempaca
  igual, por eso hay una prueba específica para cada caso.
- Las fechas (`createdAt`, `updatedAt`) se convierten a objetos `Date` de JavaScript —
  el SDK de Firebase Admin las guarda automáticamente como Timestamp de Firestore.

## Si un cliente tiene varias versiones/iteraciones guardadas

Si al exportar con `--all` aparece un mismo cliente repetido con nombres como
"Autollantas Nutibara", "Autollantas Nutibara V2", "Autollantas Nutibara V3" (versiones
de prueba o iteraciones, no clientes distintos), usa `listExportedSessions.js` para ver
cuál sesión es la más reciente de cada una antes de decidir qué migrar:

```bash
node migration/data-migration/listExportedSessions.js todos-los-clientes.json
```

Esto imprime una tabla (cliente / marca / sessionId / estado / etapa / última
actualización) ordenada de más reciente a más antigua, para identificar la sesión real de
cada cliente por fecha, no por el nombre. Con el `sessionId` correcto en mano, exporta
solo esa sesión puntual (ver la sección de abajo) en vez de usar `--all`.

## Cómo migrar TODOS los clientes reales de Catalina (Autollantas, Kansha, y los que sigan)

Corre estos comandos desde la carpeta raíz del proyecto (`AHA-Brand-Builder-2.0`) — no
hace falta entrar a ninguna subcarpeta antes:

```bash
# 1. Exportar TODOS los clientes/marcas/sesiones reales de una sola vez.
node migration/data-migration/exportFromSqlite.js --all > todos-los-clientes.json

# 2. Revisar el archivo todos-los-clientes.json a simple vista — confirma que aparecen
#    Autollantas Nutibara Y Kansha, con sus campos esperados (insight, pilares,
#    pirámide), antes de seguir.

# 3. Importar a Firestore (necesita la credencial de la cuenta de servicio de Firebase,
#    descargada desde la consola de Firebase → Configuración del proyecto → Cuentas de
#    servicio).
cd migration/data-migration
npm install firebase-admin
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/tu-credencial.json \
  node importToFirestore.js ../../todos-los-clientes.json
```

Si en vez de todo quieres migrar solo UNA sesión puntual (por ejemplo, para probar con un
cliente nuevo antes de hacerlo con todos), reemplaza el paso 1 por:

```bash
node migration/data-migration/exportFromSqlite.js <sessionId real> > una-sesion.json
```

El id de una sesión puntual se ve en Prisma Studio (`cd backend && npx prisma studio`, en
la tabla `sessions`) — `importToFirestore.js` detecta solo, por la forma del archivo, si
le estás dando el export de `--all` (un array) o el de una sola sesión (un objeto), así
que el paso 3 es igual en ambos casos.

Nota técnica: `exportFromSqlite.js` necesita el cliente de Prisma ya generado en
`backend/node_modules/` (porque ahí es donde vive la app real), pero el archivo en sí
resuelve esa ruta solo, sin importar desde qué carpeta lo ejecutes — no hace falta hacer
`cd backend` primero (una versión anterior de esta guía lo pedía; ya no es necesario).

## Cómo verificar esto antes de confiar en él

```bash
node migration/data-migration/__tests__/transformToFirestore.test.mjs   # 13/13 deben pasar
```

## Cómo aplicarlo dentro de Google AI Studio

Esta parte no se "pega" en el chat de Build como los sprints anteriores — es un script de
migración de datos que se corre UNA SOLA VEZ, por fuera de la app, para llevar TODOS los
clientes reales (Autollantas Nutibara, Kansha, y los que sigan) a la base de Firestore
que ya conectaste en los Sprints 1-4. Pégale esto al asistente de Build solo si quieres
que te ayude a adaptar los archivos a la estructura exacta de tu proyecto en AI Studio
(por ejemplo, si tu backend vive en Cloud Functions en vez de un servidor Express local):

```
Necesito migrar los datos de TODOS los clientes reales ya construidos en la versión
anterior de la app (con SQLite) a la base de Firestore de este proyecto — no solo uno,
todos los que existan (hoy son Autollantas Nutibara y Kansha, pero puede haber más en el
futuro). Te adjunto 3 archivos ya escritos y probados:

1. exportFromSqlite.js — con la opción --all, recorre TODOS los clientes, marcas y
   sesiones de la base de datos SQLite anterior (usando Prisma) y los vuelca a un solo
   archivo JSON (un array, un árbol completo por sesión). Esto se corre una sola vez,
   fuera de tu entorno — no necesitas adaptarlo, solo correrlo donde está la base de
   datos SQLite real.

2. transformToFirestore.js — la función transformAll() transforma ese array a la
   estructura exacta de colecciones de Firestore que ya implementamos en el Sprint 1.
   Tres cosas importantes que SÍ debes mantener (están probadas, no las simplifiques):
   (a) nunca copia el status guardado en SQLite tal cual — siempre lo recalcula desde los
   datos reales de cada campo, porque encontramos casos con el status desactualizado;
   (b) algunos campos de texto en SQLite (el contenido de cada etapa, el meta de cada
   mensaje) son strings JSON que hay que convertir a objetos nativos antes de guardarlos
   en Firestore — salvo el contenido de los entregables, que se deja como string tal
   cual; (c) CRÍTICO — cuando un mismo cliente o marca tiene más de una sesión, su
   documento de cliente/marca NO debe escribirse dos veces (Firestore rechaza escribir
   al mismo documento dos veces dentro de un solo lote) — hay que quitar duplicados por
   la ruta del documento antes de escribir.

3. importToFirestore.js — escribe el resultado del paso 2 en Firestore, dividido en lotes
   de como máximo 400-500 operaciones cada uno (el límite real de Firestore es 500 por
   lote). Si tu proyecto necesita que esto corra como una Cloud Function en vez de un
   script de línea de comandos, pórtalo así, pero mantén la misma lógica: lotes atómicos,
   nunca escrituras sueltas documento por documento.

Ayúdame a adaptar estos 3 archivos a la estructura real de mi proyecto en AI Studio.
```
