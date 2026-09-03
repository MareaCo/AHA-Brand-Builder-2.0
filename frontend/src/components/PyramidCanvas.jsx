import { forwardRef, useState } from "react";

function renderValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : Object.values(item).filter(Boolean).join(" — ")))
      .join(" · ");
  }
  return JSON.stringify(value);
}

function Block({ label, value, editable, onSave, tone = "light" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(renderValue(value));

  const toneClasses = {
    light: "bg-white/90 text-aha-navy",
    navy: "bg-aha-navy text-white",
    periwinkle: "bg-aha-periwinkle text-white",
    lime: "bg-aha-lime text-aha-navy",
    pale: "bg-aha-pale text-aha-navy",
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 rounded-lg bg-white p-2 shadow-inner">
        <span className="text-[9px] font-bold uppercase text-slate-400">{label}</span>
        <textarea
          className="w-full rounded border border-slate-200 p-1 text-[11px]"
          rows={3}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex gap-1">
          <button
            type="button"
            className="btn-primary !px-2 !py-0.5 text-[10px]"
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            Guardar
          </button>
          <button type="button" className="btn-ghost !px-2 !py-0.5 text-[10px]" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (!editable) return;
        setDraft(renderValue(value));
        setEditing(true);
      }}
      className={[
        "flex flex-col gap-0.5 rounded-lg p-2 text-center",
        toneClasses[tone],
        editable ? "cursor-pointer hover:ring-2 hover:ring-aha-periwinkle" : "",
      ].join(" ")}
      title={editable ? "Click para editar" : undefined}
    >
      <span className="text-[9px] font-bold uppercase opacity-70">{label}</span>
      <span className="text-[11px] leading-tight whitespace-pre-line">{renderValue(value) || "—"}</span>
    </div>
  );
}

const PyramidCanvas = forwardRef(function PyramidCanvas({ data, editableKeys, onEditField }, ref) {
  const editable = (key) => editableKeys?.includes(key);

  return (
    <div ref={ref} className="rounded-3xl bg-gradient-to-b from-aha-navy/5 to-white p-6">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
        <div className="w-1/3">
          <Block
            label="Esencia"
            value={data.cuspide.esencia}
            tone="navy"
            editable={editable("esencia")}
            onSave={(v) => onEditField("esencia", v, "Esencia")}
          />
        </div>

        <div className="w-2/3">
          <Block
            label="Propósito"
            value={data.alto.proposito}
            tone="periwinkle"
            editable={false}
          />
        </div>

        <div className="grid w-full grid-cols-3 gap-2">
          <Block
            label="RTB"
            value={data.medio.razones_para_creer}
            editable={false}
          />
          <Block
            label="Personalidad"
            value={data.medio.personalidad}
            editable={editable("personalidad")}
            onSave={(v) => onEditField("personalidad", v, "Personalidad")}
          />
          <Block
            label="Beneficio racional"
            value={data.medio.beneficios_racionales}
            editable={false}
          />
        </div>
        <div className="w-1/3">
          <Block label="Beneficio emocional" value={data.medio.beneficios_emocionales} editable={false} />
        </div>

        <div className="grid w-full grid-cols-4 gap-2">
          <Block label="Entorno competitivo" value={data.base.entorno_competitivo} tone="pale"
            editable={editable("entorno_competitivo")}
            onSave={(v) => onEditField("entorno_competitivo", v, "Entorno competitivo")}
          />
          <Block label="Target" value={data.base.target} tone="pale" editable={false} />
          <Block
            label="Asociaciones de marca"
            value={data.base.asociaciones_marca}
            tone="pale"
            editable={editable("asociaciones_marca")}
            onSave={(v) => onEditField("asociaciones_marca", v, "Asociaciones de marca")}
          />
          <Block label="Insight" value={data.base.insight} tone="pale" editable={false} />
        </div>

        <div className="mt-4 grid w-full grid-cols-2 gap-2 border-t border-dashed border-slate-200 pt-4">
          <Block
            label="Arquetipo dominante / secundario"
            value={[data.aparte.arquetipo_dominante, data.aparte.arquetipo_secundario].filter(Boolean).join(" / ")}
            tone="lime"
            editable={editable("arquetipo_dominante")}
            onSave={(v) => {
              const [dominante, secundario] = v.split("/").map((s) => s.trim());
              onEditField("arquetipo_dominante", dominante || v, "Arquetipo dominante");
              if (secundario) onEditField("arquetipo_secundario", secundario, "Arquetipo secundario");
            }}
          />
          <Block label="Territorio de marca" value={data.aparte.territorio_marca} tone="lime" editable={false} />
        </div>
      </div>
    </div>
  );
});

export default PyramidCanvas;
