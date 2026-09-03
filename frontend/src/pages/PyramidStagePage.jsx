import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { api } from "../api.js";
import PyramidCanvas from "../components/PyramidCanvas.jsx";
import ChatStage from "../components/ChatStage.jsx";

const NEW_FIELD_KEYS = ["entorno_competitivo", "asociaciones_marca", "personalidad", "esencia", "arquetipo_dominante"];

export default function PyramidStagePage({ session, stageDef, onFieldsChanged }) {
  const [pyramid, setPyramid] = useState(null);
  const [coherence, setCoherence] = useState(null);
  const [checking, setChecking] = useState(false);
  const canvasRef = useRef(null);

  function refresh() {
    api.getPyramid(session.id).then(setPyramid);
  }

  useEffect(refresh, [session.id]);

  async function handleEditField(fieldKey, value, label) {
    const res = await api.editPyramidField(session.id, fieldKey, value, label);
    setPyramid(res);
    onFieldsChanged?.(res.ready);
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
              coherence.coherente ? "bg-aha-lime/20 text-aha-navy" : "bg-amber-50 text-amber-800"
            }`}
          >
            {coherence.coherente ? (
              <p>✓ Todo se ve coherente entre sí.</p>
            ) : (
              <ul className="list-disc pl-4">
                {coherence.alertas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
            {coherence.error && <p>{coherence.error}</p>}
          </div>
        )}

        <PyramidCanvas ref={canvasRef} data={pyramid.data} editableKeys={NEW_FIELD_KEYS} onEditField={handleEditField} />

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
          onFieldsChanged={() => {
            refresh();
            onFieldsChanged?.();
          }}
        />
      </div>
    </div>
  );
}
