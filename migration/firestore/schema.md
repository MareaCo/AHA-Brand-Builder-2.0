# Esquema de Firestore — AHA Brand Builder

Traducción del modelo relacional actual (Prisma/SQLite, ver `backend/prisma/schema.prisma`)
a colecciones de Firestore. Usa subcolecciones anidadas bajo cada sesión — es la forma
natural de modelar "todo lo que pertenece a esta marca/sesión" en Firestore, y hace que
borrar una sesión complete (con sus etapas, archivos, mensajes) sea una sola operación
por árbol.

```
clients/{clientId}
  name: string
  email: string | null
  createdAt: timestamp

clients/{clientId}/brands/{brandId}
  name: string
  industry: string | null
  createdAt: timestamp

  // o, si prefieres no anidar bajo client, una colección de nivel superior
  // brands/{brandId} con un campo clientId — cualquiera de las dos funciona
  // igual de bien en Firestore; anidar hace más simple la regla de seguridad
  // "solo el dueño de este cliente puede ver sus marcas".

brands/{brandId}/sessions/{sessionId}
  status: "en_progreso" | "completado"
  currentStage: number        // 0..8
  createdAt: timestamp
  updatedAt: timestamp

sessions/{sessionId}/stageData/{stageNumber}     // stageNumber como string: "0".."8"
  stageName: string
  status: "borrador" | "propuesto_por_ia" | "validado_por_usuario" | "editado_por_usuario"
  fields: {
    [fieldKey: string]: {
      label: string
      value: string | object | Array<{ atributo, materializacion, status }>
      status: "sin_definir" | "propuesto_por_ia" | "validado_por_usuario" | "editado_por_usuario"
      rationale: string | null
    }
  }
  meta: object                // estado interno de avance (ej. paso del flujo de Insight)
  updatedAt: timestamp

sessions/{sessionId}/files/{fileId}
  filename: string
  fileType: string
  storagePath: string          // ruta en Cloud Storage for Firebase, NO el archivo en sí
  extractedSummary: string | null
  extractedText: string | null
  createdAt: timestamp

sessions/{sessionId}/deliverables/{deliverableId}
  type: "piramide" | "piramide_sintesis" | "manifiesto"
  content: string               // JSON serializado, igual que hoy
  format: "svg" | "text"
  version: number
  createdAt: timestamp

sessions/{sessionId}/messages/{messageId}
  stageNumber: number
  role: "user" | "assistant"
  content: string
  meta: object | null           // { hidden?: boolean, proposals?: [...], citations?: [...] }
  createdAt: timestamp
```

## Por qué un campo tipo "list" guarda `status` en CADA elemento

`fields.pilares.value` es un array de objetos `{ atributo, materializacion, status }` —
noten que cada elemento tiene su propio `status`, no solo el campo. Esto es intencional
(ver `migration/firestore/listFieldLogic.js`): el usuario valida los pilares uno por uno,
y la IA puede seguir proponiendo los pendientes sin que eso afecte a los ya cerrados. El
`status` del campo completo (`fields.pilares.status`) es un valor **agregado**, calculado
por `computeListAggregateStatus()` — nunca se escribe a mano.

## Índices compuestos necesarios

Firestore pide un índice compuesto para cualquier consulta que ordene por un campo
distinto al que filtra. La única consulta de este tipo en la app es "los mensajes de una
etapa, en orden":

```json
{
  "indexes": [
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "stageNumber", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

(Ver `firestore.indexes.json` en esta misma carpeta — listo para `firebase deploy --only firestore:indexes`.)

## Archivos subidos van a Cloud Storage, no a Firestore

`UploadedFile.storagePath` en el modelo actual ya apunta a una ruta en disco — en la
versión de Firestore, esa misma idea de "ruta" apunta a un objeto en **Cloud Storage for
Firebase** (`gs://<bucket>/sessions/{sessionId}/files/{fileId}`). Firestore nunca debe
guardar el contenido binario del archivo directamente (límite de 1 MiB por documento).
