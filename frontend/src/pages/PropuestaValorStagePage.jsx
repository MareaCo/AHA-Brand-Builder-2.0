import ChatStage from "../components/ChatStage.jsx";
import PropuestaValorDiagram, { normalizePilares } from "../components/PropuestaValorDiagram.jsx";

function fieldValue(stageData, stageNumber, fieldKey) {
  const row = stageData.find((s) => s.stageNumber === stageNumber);
  return row?.content?.fields?.[fieldKey]?.value ?? null;
}

export default function PropuestaValorStagePage({ session, stageDef, onFieldsChanged }) {
  const stageData = session.stageData || [];
  const definicionNegocio = fieldValue(stageData, 4, "definicion_negocio");
  const target = fieldValue(stageData, 5, "perfil_target");
  const pilaresRaw = fieldValue(stageData, 6, "pilares");
  const pilares = normalizePilares(pilaresRaw);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <h2 className="mb-3 text-xl font-bold text-aha-navy">Propuesta de Valor</h2>

        <PropuestaValorDiagram definicionNegocio={definicionNegocio} target={target} pilaresRaw={pilaresRaw} />

        {pilares.length > 0 && (
          <div className="mt-4 space-y-2">
            {pilares.map((pilar, i) => (
              <div key={i} className="card p-3 text-xs">
                <span className="font-bold text-aha-navy">{pilar.atributo}</span>
                <p className="mt-0.5 text-slate-600">{pilar.materializacion}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-aha-navy">Asistente de la Etapa 6</h3>
        <ChatStage session={session} stageNumber={6} stageDef={stageDef} compact onFieldsChanged={onFieldsChanged} />
      </div>
    </div>
  );
}
