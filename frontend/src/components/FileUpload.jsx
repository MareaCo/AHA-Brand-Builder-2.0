import { useCallback, useRef, useState } from "react";
import { api } from "../api.js";

const CHECKLIST = [
  "Historia de la marca / origen de la idea",
  "Portafolio de productos/servicios",
  "Principales clientes/consumidores (y diferencias por línea)",
  "Canales de venta, precios frente a competencia, competencia principal, ventas anuales aprox.",
  "Estudios de consumidor, conversaciones con clientes, data de participación de mercado",
  "Toolkits de marca previos, capturas de redes sociales, reportes de analítica",
];

function FailedBadge() {
  return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">revisar</span>;
}

function FileCard({ file, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const isAnalyzing = file.extractedSummary === "Analizando...";
  const isFailed = file.extractedSummary?.startsWith("No se pudo analizar");
  const summary = file.extractedSummary || "";
  const isLong = summary.length > 220;

  return (
    <li className="card p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isAnalyzing ? (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-aha-periwinkle border-t-transparent" />
          ) : isFailed ? (
            <span className="shrink-0 text-amber-500">⚠</span>
          ) : (
            <span className="shrink-0 text-green-600">✓</span>
          )}
          <span className="truncate font-medium text-slate-700" title={file.filename}>
            {file.filename}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isFailed && <FailedBadge />}
          {!isAnalyzing && (
            <button type="button" className="text-red-500 hover:underline" onClick={() => onRemove(file)}>
              quitar
            </button>
          )}
        </div>
      </div>

      {isAnalyzing ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-aha-periwinkle/15">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-aha-periwinkle/60" />
        </div>
      ) : (
        <>
          <p className={["mt-1.5 text-slate-500", !expanded && "line-clamp-5"].filter(Boolean).join(" ")}>
            {summary}
          </p>
          {isLong && (
            <button
              type="button"
              className="mt-1 text-[10px] font-medium text-aha-periwinkle hover:underline"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "ver menos" : "ver todo"}
            </button>
          )}
          {file.previewUrl && (
            <a
              href={file.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[10px] font-medium text-aha-navy underline decoration-aha-lime decoration-2 underline-offset-2"
            >
              Previsualizar archivo
            </a>
          )}
        </>
      )}
    </li>
  );
}

export default function FileUpload({ sessionId, files, onFilesChanged }) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState([]); // [{tempId, filename}]
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const uploadFiles = useCallback(
    async (fileList) => {
      setError(null);
      const incoming = Array.from(fileList).map((file) => ({
        tempId: `${Date.now()}-${Math.random()}`,
        filename: file.name,
        file,
      }));
      setPending((p) => [...incoming, ...p]);

      for (const item of incoming) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const uploaded = await api.uploadFile(sessionId, item.file);
          onFilesChanged((current) => (Array.isArray(current) ? [...current, uploaded] : [uploaded]));
        } catch (err) {
          setError(`${item.filename}: ${err.message}`);
        } finally {
          setPending((p) => p.filter((x) => x.tempId !== item.tempId));
        }
      }
    },
    [sessionId, onFilesChanged]
  );

  async function handleRemove(file) {
    await api.deleteFile(sessionId, file.id);
    onFilesChanged((current) => (Array.isArray(current) ? current.filter((x) => x.id !== file.id) : []));
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          dragOver ? "border-aha-lime bg-aha-lime/10" : "border-aha-navy/20 bg-white hover:border-aha-periwinkle",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.md,.png,.jpg,.jpeg"
          onChange={(e) => e.target.files?.length && uploadFiles(e.target.files)}
        />
        <p className="text-sm font-medium text-aha-navy">
          Arrastra tus archivos aquí, o haz click para elegirlos
        </p>
        <p className="mt-1 text-xs text-slate-400">PDF, DOCX, XLSX, TXT, PNG o JPG</p>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-aha-navy">
            Insumos que ayudan mucho (si los tienes)
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-aha-lime">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-aha-navy">Archivos cargados</h4>
          {files.length === 0 && pending.length === 0 && (
            <p className="text-xs text-slate-400">Todavía no has cargado ningún archivo.</p>
          )}
          <ul className="space-y-2">
            {pending.map((p) => (
              <FileCard key={p.tempId} file={{ id: p.tempId, filename: p.filename, extractedSummary: "Analizando..." }} onRemove={() => {}} />
            ))}
            {files.map((f) => (
              <FileCard key={f.id} file={f} onRemove={handleRemove} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
