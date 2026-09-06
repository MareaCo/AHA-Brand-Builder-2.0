import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import ProgressBar from "../components/ProgressBar.jsx";
import SidePanel from "../components/SidePanel.jsx";
import FileUpload from "../components/FileUpload.jsx";
import ChatStage from "../components/ChatStage.jsx";
import PyramidStagePage from "./PyramidStagePage.jsx";
import PropuestaValorStagePage from "./PropuestaValorStagePage.jsx";
import ManifestoStagePage from "./ManifestoStagePage.jsx";
import ClosingPage from "./ClosingPage.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";

const SPECIAL_STAGE_KEYS = ["insumos", "piramide", "propuesta_valor", "manifiesto"];

export default function SessionWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [viewStage, setViewStage] = useState(null);
  const [files, setFiles] = useState([]);
  const [stageComplete, setStageComplete] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [showClosing, setShowClosing] = useState(false);
  const [error, setError] = useState(null);
  const [coherenceWarning, setCoherenceWarning] = useState(null);

  const refresh = useCallback(async () => {
    const data = await api.getSession(id);
    setSession(data);
    setFiles(data.files);
    setViewStage((prev) => (prev === null ? data.currentStage : prev));
    return data;
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (session && viewStage != null) {
      const stageDef = session.stages.find((s) => s.number === viewStage);
      setStageComplete(Boolean(stageDef?.complete));
    }
  }, [session, viewStage]);

  // El panel lateral y las vistas gráficas (Pirámide, Propuesta de Valor) leen
  // session.stageData, que solo se recarga con refresh(). Sin esto, se ven
  // desactualizados mientras se chatea (solo se actualizaba el flag de completitud).
  function syncAfterFieldsChanged(complete) {
    setStageComplete(complete);
    refresh();
  }

  if (!session || viewStage === null) {
    return <div className="p-10 text-sm text-slate-400">Cargando sesión...</div>;
  }

  if (showClosing) {
    return (
      <Shell session={session} viewStage={viewStage} onSelect={setViewStage} onReopen={reopen} navigate={navigate}>
        <ClosingPage session={session} />
      </Shell>
    );
  }

  const stageDef = session.stages.find((s) => s.number === viewStage);

  async function reopen(stageNumber) {
    setError(null);
    try {
      const updated = await api.reopenStage(id, stageNumber);
      setSession(updated);
      setViewStage(stageNumber);
      setShowClosing(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function advance() {
    setAdvancing(true);
    setError(null);
    setCoherenceWarning(null);
    try {
      const updated = await api.advanceSession(id);
      setSession(updated);
      if (viewStage === session.currentStage) {
        setViewStage(updated.currentStage);
      }
      if (updated.coherence?.coherente === false && updated.coherence.alertas?.length > 0) {
        setCoherenceWarning(updated.coherence.alertas);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAdvancing(false);
    }
  }

  const isLastStage = viewStage === 8;
  const canAdvance = viewStage === session.currentStage && stageComplete && !isLastStage;
  const canFinish = viewStage === 8 && session.currentStage === 8 && stageComplete;

  return (
    <Shell session={session} viewStage={viewStage} onSelect={setViewStage} onReopen={reopen} navigate={navigate}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-aha-navy">
            Etapa {stageDef.number} — {stageDef.name}
          </h2>
          <p className="text-sm text-slate-500">{stageDef.shortGoal}</p>
        </div>
        <div className="flex gap-2">
          {canAdvance && (
            <button className="btn-primary" onClick={advance} disabled={advancing}>
              {advancing ? "Avanzando..." : "Continuar a la siguiente etapa →"}
            </button>
          )}
          {canFinish && (
            <button className="btn-accent" onClick={() => setShowClosing(true)}>
              Ver resumen final →
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {coherenceWarning && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">
              ⚠ El chequeo de coherencia automático encontró posibles contradicciones con etapas anteriores:
            </span>
            <button type="button" className="text-amber-600 hover:underline" onClick={() => setCoherenceWarning(null)}>
              descartar
            </button>
          </div>
          <ul className="list-disc pl-4">
            {coherenceWarning.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <ErrorBoundary key={viewStage}>
        {stageDef.key === "insumos" && (
          <div>
            <FileUpload sessionId={id} files={files} onFilesChanged={setFiles} />
            <div className="mt-6">
              <ChatStage
                session={session}
                stageNumber={0}
                stageDef={stageDef}
                onFieldsChanged={() => syncAfterFieldsChanged(true)}
                canAdvance={canAdvance}
                advancing={advancing}
                onAdvance={advance}
                advanceLabel="Continuar a la Etapa 1 →"
              />
            </div>
          </div>
        )}

        {stageDef.key === "piramide" && (
          <PyramidStagePage
            session={session}
            stageDef={stageDef}
            onFieldsChanged={(ready) => syncAfterFieldsChanged(Boolean(ready))}
          />
        )}

        {stageDef.key === "propuesta_valor" && (
          <PropuestaValorStagePage
            session={session}
            stageDef={stageDef}
            onFieldsChanged={(complete) => syncAfterFieldsChanged(complete)}
          />
        )}

        {stageDef.key === "manifiesto" && <ManifestoStagePage session={session} />}

        {!SPECIAL_STAGE_KEYS.includes(stageDef.key) && (
          <ChatStage
            session={session}
            stageNumber={viewStage}
            stageDef={stageDef}
            onFieldsChanged={(complete) => syncAfterFieldsChanged(complete)}
            canAdvance={canAdvance}
            advancing={advancing}
            onAdvance={advance}
          />
        )}
      </ErrorBoundary>
    </Shell>
  );
}

function Shell({ session, viewStage, onSelect, onReopen, navigate, children }) {
  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-slate-100 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-sm font-bold text-aha-navy">
            AHA Brand Builder
          </button>
          <span className="text-xs text-slate-400">
            {session.status === "completado" ? "Completado" : `Etapa ${session.currentStage} de 8`}
          </span>
        </div>
        <ProgressBar currentStage={session.currentStage} viewStage={viewStage} onSelect={onSelect} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        <SidePanel session={session} onReopen={onReopen} />
      </div>
    </div>
  );
}
