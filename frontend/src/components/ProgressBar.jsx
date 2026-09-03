const STAGE_LABELS = [
  "Insumos",
  "Territorio",
  "Insight",
  "Concepto",
  "Propósito",
  "Target",
  "Prop. de Valor",
  "Pirámide",
  "Manifiesto",
];

export default function ProgressBar({ currentStage, viewStage, onSelect }) {
  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex items-center gap-1 min-w-max px-1 py-2">
        {STAGE_LABELS.map((label, i) => {
          const reached = i <= currentStage;
          const isActive = i === viewStage;
          return (
            <li key={i} className="flex items-center gap-1">
              <button
                type="button"
                disabled={!reached}
                onClick={() => reached && onSelect(i)}
                className={[
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-aha-navy text-white"
                    : reached
                    ? "bg-aha-lime/40 text-aha-navy hover:bg-aha-lime/70 cursor-pointer"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed",
                ].join(" ")}
                title={reached ? `Ir a Etapa ${i}: ${label}` : `Etapa ${i} aún no alcanzada`}
              >
                <span
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                    isActive ? "bg-white text-aha-navy" : "bg-white/70 text-aha-navy",
                  ].join(" ")}
                >
                  {i}
                </span>
                {label}
              </button>
              {i < STAGE_LABELS.length - 1 && <span className="h-px w-4 bg-slate-200" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
