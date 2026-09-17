import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { api } from "../api.js";
import PyramidCanvas from "../components/PyramidCanvas.jsx";
import ChatStage from "../components/ChatStage.jsx";

const NEW_FIELD_KEYS = [
  "entorno_competitivo",
  "asociaciones_marca",
  "personalidad",
  "esencia",
  "arquetipo_dominante",
  "arquetipo_secundario",
  "territorio_comunicacion",
];

export default function PyramidStagePage({ session, stageDef, onFieldsChanged }) {
  const [pyramid, setPyramid] = useState(null);
  const [coherence, setCoherence] = useState(null);
  const [checking, setChecking] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const canvasRef = useRef(null);

  async function refresh() {
    const data = await api.getPyramid(session.id);
    setPyramid(data);
    return data;
  }

  useEffect(() => {
    refresh();
  }, [session.id]);

  async function handleEditField(fieldKey, value, label) {
    const res = await api.editPyramidField(session.id, fieldKey, value, label);
    setPyramid(res);
    onFieldsChanged?.(res.ready);
  }

  async function synthesize() {
    setSynthesizing(true);
    try {
      const res = await api.synthesizePyramid(session.id);
      setPyramid((p) => ({ ...p, synthesized: res.synthesized }));
    } finally {
      setSynthesizing(false);
    }
  }

  async function runCoherenceCheck() {
    setChecking(true);
    setCoherence(null);
    try {
      const res = await api.coherenceCheck(session.id);
      setCoherence(res);
    } finally {
      setChecking(false);
    }
  }

  async function exportImage() {
    if (!canvasRef.current) return;
    const canvas = await html2canvas(canvasRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = `piramide-${session.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    await api.exportPyramid(session.id);
  }

  if (!pyramid) return <p className="text-sm text-slate-400">Cargando pirámide...</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-aha-navy">Pirámide de Marca</h2>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={synthesize} disabled={synthesizing}>
              {synthesizing ? "Sintetizando..." : "✦ Sintetizar para one-pager"}
            </button>
            <button className="btn-secondary text-xs" onClick={runCoherenceCheck} disabled={checking}>
              {checking ? "Revisando..." : "Chequeo de coherencia"}
            </button>
            <button className="btn-accent text-xs" onClick={exportImage}>
              Exportar como imagen
            </button>
          </div>
        </div>

        {coherence && (
          <div
            className={`mb-3 rounded-xl p-3 text-xs ${
              coherence.coherente === true
                ? "bg-aha-lime/20 text-aha-navy"
                : coherence.coherente === false
                ? "bg-amber-50 text-amber-800"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {coherence.coherente === true && <p>✓ Todo se ve coherente entre sí.</p>}
            {coherence.coherente === false && (
              <ul className="list-disc pl-4">
                {coherence.alertas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
            {coherence.coherente === null && <p>⚠ No se pudo verificar la coherencia — no asumas que está bien.</p>}
            {coherence.error && <p className="mt-1 italic">{coherence.error}</p>}
          </div>
        )}

        <PyramidCanvas
          ref={canvasRef}
          data={pyramid.data}
          synthesized={pyramid.synthesized}
          editableKeys={NEW_FIELD_KEYS}
          onEditField={handleEditField}
        />
        {pyramid.synthesized && (
          <p className="mt-2 text-[11px] text-slate-400">
            Mostrando la versión sintetizada para el one-pager. Editar cualquier campo la invalida.
          </p>
        )}

        {!pyramid.ready && (
          <p className="mt-3 text-xs text-slate-500">
            Todavía faltan campos por completar. Usa el asistente a la derecha para que te proponga los que
            falten, o haz click directo sobre los bloques nuevos de la pirámide para editarlos.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-aha-navy">Asistente de la Etapa 7</h3>
        <ChatStage
          session={session}
          stageNumber={7}
          stageDef={stageDef}
          compact
          onFieldsChanged={async () => {
            const data = await refresh();
            onFieldsChanged?.(data.ready);
          }}
        />
      </div>
    </div>
  );
}
