import { useState } from "react";

function renderValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item, i) =>
        typeof item === "string"
          ? `${i + 1}. ${item}`
          : `${i + 1}. ${Object.values(item).filter(Boolean).join(" — ")}`
      )
      .join("\n");
  }
  return JSON.stringify(value, null, 2);
}

export default function ProposalCard({ fieldKey, field, onValidate, onEdit }) {
  const [mode, setMode] = useState(null); // null | 'edit' | 'scratch'
  const [draft, setDraft] = useState(renderValue(field.value));
  const [busy, setBusy] = useState(false);

  const isPending = field.status === "propuesto_por_ia";
  const isDone = field.status === "validado_por_usuario" || field.status === "editado_por_usuario";

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={[
        "rounded-xl border p-3 text-sm",
        isDone ? "border-aha-lime bg-aha-lime/10" : "border-aha-periwinkle/30 bg-aha-periwinkle/5",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-aha-navy">{field.label}</span>
        {isDone && <span className="text-[10px] font-semibold text-green-700">✓ validado</span>}
      </div>

      {mode === null && (
        <>
          <p className="mt-1.5 whitespace-pre-line text-slate-700">{renderValue(field.value)}</p>
          {field.rationale && (
            <p className="mt-1 text-xs italic text-slate-500">Por qué lo propongo: {field.rationale}</p>
          )}
          {!isDone && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="btn-accent !px-3 !py-1 text-xs"
                onClick={() => run(() => onValidate(fieldKey))}
              >
                Validar
              </button>
              <button
                type="button"
                className="btn-secondary !px-3 !py-1 text-xs"
                onClick={() => {
                  setDraft(renderValue(field.value));
                  setMode("edit");
                }}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn-ghost !px-3 !py-1 text-xs"
                onClick={() => {
                  setDraft("");
                  setMode("scratch");
                }}
              >
                Escribir desde cero
              </button>
            </div>
          )}
          {isDone && (
            <button
              type="button"
              className="btn-ghost mt-2 !px-2 !py-0.5 text-[11px]"
              onClick={() => {
                setDraft(renderValue(field.value));
                setMode("edit");
              }}
            >
              Ajustar de nuevo
            </button>
          )}
        </>
      )}

      {(mode === "edit" || mode === "scratch") && (
        <div className="mt-2">
          <textarea
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-aha-periwinkle focus:outline-none"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={mode === "scratch" ? "Escribe tu propia versión aquí..." : undefined}
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || !draft.trim()}
              className="btn-primary !px-3 !py-1 text-xs"
              onClick={() =>
                run(async () => {
                  await onEdit(fieldKey, draft, field.label);
                  setMode(null);
                })
              }
            >
              Guardar
            </button>
            <button type="button" className="btn-ghost !px-3 !py-1 text-xs" onClick={() => setMode(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
