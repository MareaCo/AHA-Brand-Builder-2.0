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

export default function FileUpload({ sessionId, files, onFilesChanged }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const uploadFiles = useCallback(
    async (fileList) => {
      setError(null);
      setUploading(true);
      try {
        for (const file of Array.from(fileList)) {
          // eslint-disable-next-line no-await-in-loop
          await api.uploadFile(sessionId, file);
        }
        const updated = await api.listFiles(sessionId);
        onFilesChanged(updated);
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    },
    [sessionId, onFilesChanged]
  );

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
          {uploading ? "Analizando insumos..." : "Arrastra tus archivos aquí, o haz click para elegirlos"}
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
          {files.length === 0 && <p className="text-xs text-slate-400">Todavía no has cargado ningún archivo.</p>}
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="card p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">{f.filename}</span>
                  <button
                    type="button"
                    className="text-red-500 hover:underline"
                    onClick={async () => {
                      await api.deleteFile(sessionId, f.id);
                      onFilesChanged(files.filter((x) => x.id !== f.id));
                    }}
                  >
                    quitar
                  </button>
                </div>
                <p className="mt-1 text-slate-500">{f.extractedSummary || "Analizando..."}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
