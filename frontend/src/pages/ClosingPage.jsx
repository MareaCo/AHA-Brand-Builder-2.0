import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { api } from "../api.js";
import PyramidCanvas from "../components/PyramidCanvas.jsx";

export default function ClosingPage({ session }) {
  const [pyramid, setPyramid] = useState(null);
  const [synthesized, setSynthesized] = useState(null);
  const [manifesto, setManifesto] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.getPyramid(session.id).then((r) => {
      setPyramid(r.data);
      setSynthesized(r.synthesized);
    });
    api.getManifesto(session.id).then((r) => setManifesto(r.variants));
  }, [session.id]);

  async function generateFinalPdf() {
    setExporting(true);
    setDownloadUrl(null);
    try {
      let pyramidImageBase64 = null;
      if (canvasRef.current) {
        const canvas = await html2canvas(canvasRef.current, { backgroundColor: "#ffffff", scale: 2 });
        pyramidImageBase64 = canvas.toDataURL("image/png");
      }
      const chosen = manifesto?.[0];
      const res = await api.exportFinal(session.id, {
        pyramidImageBase64,
        manifestoText: chosen?.text || "",
        manifestoTone: chosen?.label || "",
      });
      setDownloadUrl(res.downloadUrl);
      await api.completeSession(session.id);
    } finally {
      setExporting(false);
    }
  }

  const validatedStages = (session.stageData || []).filter(
    (s) => Object.keys(s.content?.fields || {}).length > 0
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-bold text-aha-navy">¡Listo! Este es el resumen de tu marca</h2>
      <p className="mt-1 text-sm text-slate-500">
        Recorrimos las 9 etapas de la metodología AHA. Aquí está todo lo que construimos juntos.
      </p>

      <div className="mt-6 space-y-4">
        {validatedStages.map((stage) => (
          <div key={stage.stageNumber} className="card p-4">
            <h3 className="text-sm font-bold text-aha-navy">
              Etapa {stage.stageNumber} — {stage.stageName}
            </h3>
            <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
              {Object.entries(stage.content.fields).map(([key, f]) => (
                <li key={key}>
                  <span className="font-medium">{f.label}: </span>
                  {typeof f.value === "string" ? f.value : JSON.stringify(f.value)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {pyramid && (
        <div className="mt-8">
          <h3 className="mb-2 text-lg font-semibold text-aha-navy">Pirámide de Marca</h3>
          <PyramidCanvas ref={canvasRef} data={pyramid} synthesized={synthesized} editableKeys={[]} onEditField={() => {}} />
        </div>
      )}

      {manifesto && (
        <div className="mt-8">
          <h3 className="mb-2 text-lg font-semibold text-aha-navy">Manifiesto de Marca</h3>
          <p className="whitespace-pre-line rounded-2xl bg-white p-5 text-sm leading-relaxed shadow-sm">
            {manifesto[0]?.text}
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col items-start gap-3">
        <button className="btn-primary" onClick={generateFinalPdf} disabled={exporting}>
          {exporting ? "Generando PDF..." : "Descargar entregables (PDF)"}
        </button>
        {downloadUrl && (
          <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn-accent">
            Abrir PDF final
          </a>
        )}
      </div>
    </div>
  );
}
