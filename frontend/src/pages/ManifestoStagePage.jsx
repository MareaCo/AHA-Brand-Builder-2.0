import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function ManifestoStagePage({ session }) {
  const [variants, setVariants] = useState(null);
  const [activeTone, setActiveTone] = useState("poetica");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [videoScript, setVideoScript] = useState(null);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    api.getManifesto(session.id).then((res) => {
      if (res.variants) {
        setVariants(res.variants);
        setActiveTone(res.variants[0]?.tone || "poetica");
      }
    });
  }, [session.id]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateManifesto(session.id);
      setVariants(res.variants);
      setActiveTone(res.variants[0]?.tone || "poetica");
      setShowScript(false);
      setVideoScript(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const current = variants?.find((v) => v.tone === activeTone);

  async function toggleScript() {
    if (showScript) {
      setShowScript(false);
      return;
    }
    if (!videoScript && current) {
      const res = await api.videoScript(session.id, current.text);
      setVideoScript(res.script);
    }
    setShowScript(true);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-aha-navy">Manifiesto de Marca</h2>
          <p className="text-sm text-slate-500">
            Una sola historia emocional — nunca una lista de puntos. Lista para leerse en voz alta.
          </p>
        </div>
        <button className="btn-primary" onClick={generate} disabled={generating}>
          {generating ? "Escribiendo..." : variants ? "Regenerar" : "Generar manifiesto"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {!variants && !generating && (
        <p className="rounded-2xl bg-white/70 p-6 text-sm text-slate-500">
          Cuando estés listo, genera el manifiesto: recorreremos todo lo construido en las etapas
          anteriores y lo convertiremos en una sola historia con alma, en 3 tonos distintos.
        </p>
      )}

      {variants && (
        <>
          <div className="mb-4 flex gap-2">
            {variants.map((v) => (
              <button
                key={v.tone}
                onClick={() => {
                  setActiveTone(v.tone);
                  setShowScript(false);
                  setVideoScript(null);
                }}
                className={
                  v.tone === activeTone
                    ? "btn-primary !rounded-full !px-4 !py-1.5 text-xs"
                    : "btn-secondary !rounded-full !px-4 !py-1.5 text-xs"
                }
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="card p-6">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
              {showScript ? videoScript : current?.text}
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <button className="btn-secondary" onClick={toggleScript}>
              {showScript ? "Ver como texto" : "Formatear como guion de video"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
