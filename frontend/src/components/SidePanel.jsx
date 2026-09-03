import { useState } from "react";

function renderValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ? item : Object.values(item).filter(Boolean).join(" — ")
      )
      .join("; ");
  }
  return JSON.stringify(value);
}

export default function SidePanel({ session, onReopen }) {
  const [collapsed, setCollapsed] = useState(false);
  const stagesWithContent = (session?.stageData || []).filter(
    (s) => Object.keys(s.content?.fields || {}).length > 0
  );

  return (
    <aside
      className={[
        "shrink-0 border-l border-slate-100 bg-white/70 transition-all",
        collapsed ? "w-10" : "w-80",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-3 py-3 text-left text-xs font-semibold text-aha-navy hover:bg-aha-pale/60"
      >
        {collapsed ? "»" : "« Lo que hemos construido hasta ahora"}
      </button>
      {!collapsed && (
        <div className="max-h-[75vh] overflow-y-auto px-3 pb-4 space-y-4">
          {stagesWithContent.length === 0 && (
            <p className="text-xs text-slate-400">
              Todavía no hay nada validado. Aquí irás viendo, etapa por etapa, todo lo que construyas.
            </p>
          )}
          {stagesWithContent.map((stage) => {
            const stageDef = session.stages.find((s) => s.number === stage.stageNumber);
            const entries = Object.entries(stage.content.fields || {});
            if (entries.length === 0) return null;
            return (
              <div key={stage.stageNumber} className="rounded-xl bg-aha-pale/50 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-aha-navy">
                    Etapa {stage.stageNumber} — {stageDef?.name || stage.stageName}
                  </h4>
                  <button
                    type="button"
                    onClick={() => onReopen(stage.stageNumber)}
                    className="text-[10px] text-aha-periwinkle hover:underline"
                  >
                    reabrir
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {entries.map(([key, f]) => (
                    <li key={key} className="text-[11px] leading-snug">
                      <span className="font-semibold text-slate-600">{f.label}: </span>
                      <span
                        className={
                          f.status === "propuesto_por_ia" ? "text-slate-400 italic" : "text-slate-700"
                        }
                      >
                        {renderValue(f.value) || "—"}
                      </span>
                      {f.status === "propuesto_por_ia" && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] text-amber-700">
                          sin validar
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
