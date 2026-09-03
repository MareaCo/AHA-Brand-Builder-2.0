# AHA Brand Builder

Herramienta conversacional, potenciada por la API de Claude, que guía a un cliente de
AHA Consulting a través de las 9 etapas (0-8) de la metodología AHA Brand Builder y
entrega dos piezas finales: la **Pirámide de Marca** (gráfica) y el **Manifiesto de
Marca** (narrativo).

Alcance de esta versión (Nivel 0/1 — MVP): análisis de archivos cargados por el usuario,
búsqueda web pública, y generación de texto/gráficos con Claude. No incluye integraciones
con Meta/Instagram/TikTok ni datos de Nielsen/Kantar — quedan para una fase 2.

## Stack

- **Backend**: Node.js + Express + Prisma (SQLite por defecto) + Anthropic SDK.
- **Frontend**: React + Vite + Tailwind CSS.

## Cómo correrlo localmente

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edita .env y agrega tu ANTHROPIC_API_KEY (obligatoria para conversar con el Brand Builder)
npm install
npx prisma db push
npm run dev
```

El backend queda escuchando en `http://localhost:4000`. `GET /api/health` confirma si
`ANTHROPIC_API_KEY` está configurada.

Variables de entorno (`backend/.env`):

| Variable | Obligatoria | Descripción |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sí | Clave de la API de Anthropic (Claude). |
| `DATABASE_URL` | Sí | Por defecto `file:./dev.db` (SQLite). |
| `GOOGLE_PLACES_API_KEY` | No | Habilita traer reseñas públicas de Google Business como insumo de la Etapa 2. |
| `PORT` | No | Puerto del backend (default 4000). |
| `UPLOAD_DIR` | No | Carpeta donde se guardan los insumos cargados. |
| `EXPORT_DIR` | No | Carpeta donde se guardan los PDFs exportados. |
| `CORS_ORIGIN` | No | Origen permitido para CORS (default `http://localhost:5173`). |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. El dev server de Vite hace proxy de `/api` y `/exports`
hacia el backend en el puerto 4000.

## Estructura

```
backend/
  prisma/schema.prisma      # clients, brands, sessions, stage_data, uploaded_files, deliverables, messages
  src/
    index.js                # servidor Express
    anthropicClient.js       # wrapper de la API de Claude (tool-use loop)
    lib/
      stageDefinitions.js    # contenido completo de las 9 etapas (metodología AHA)
      systemPrompt.js        # construcción del system prompt + herramientas de Claude
      stageDataStore.js       # persistencia de propuestas/campos por etapa
      fileExtract.js          # análisis de archivos cargados (PDF/DOCX/XLSX/TXT/imágenes)
      pyramidData.js           # consolidación de la Pirámide de Marca
      manifesto.js              # generación de variantes de tono del Manifiesto
      coherenceCheck.js          # chequeo de coherencia antes de cerrar la Etapa 7
    routes/                      # endpoints REST

frontend/
  src/
    pages/                      # Dashboard, SessionWorkspace, Pyramid, Manifesto, Closing
    components/                 # ProgressBar, SidePanel, ChatStage, ProposalCard, FileUpload, PyramidCanvas
```

## Notas de producto

- La continuidad entre sesiones vive 100% en la base de datos (tabla `stage_data` y
  `messages`), nunca depende de la memoria nativa de Claude.
- Cada etapa sigue el patrón "proponer primero → Validar / Editar / Escribir desde cero",
  nunca fuerza a la persona a partir de una hoja en blanco si hay contexto disponible.
- La Etapa 2 (Insight) sigue un flujo estricto de 7 pasos — es la etapa más importante de
  la metodología.
- La Etapa 7 (Pirámide) es un entregable gráfico; la Etapa 8 (Manifiesto) es una sola
  historia narrativa emocional — ninguna de las dos se genera como texto plano/bullets.
