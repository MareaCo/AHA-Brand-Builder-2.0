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

// Insets (% del ancho del trapezoide) de arriba/abajo por nivel, de la base (0)
// a la cúspide (5) — cada banda se angosta hacia arriba y su borde superior
// coincide con el borde inferior de la banda de encima, dibujando la silueta
// continua de una pirámide.
const LEVEL_INSETS = [
  { top: 4, bottom: 0 }, // 0 — base (entorno | target | asociaciones)
  { top: 9, bottom: 4 }, // 1 — insight
  { top: 16, bottom: 9 }, // 2 — RTB | personalidad
  { top: 25, bottom: 16 }, // 3 — beneficios racional | emocional
  { top: 37, bottom: 25 }, // 4 — propósito
  { top: 50, bottom: 37 }, // 5 — esencia (apex, triángulo)
];

function clipPathFor(level) {
  const { top, bottom } = LEVEL_INSETS[level];
  return `polygon(${top}% 0%, ${100 - top}% 0%, ${100 - bottom}% 100%, ${bottom}% 100%)`;
}

const TONE_BG = {
  navy: "#282072",
  periwinkle: "#5e67d3",
  blue: "#8b93e0",
  lime: "#b3de4a",
  pale: "#e3f2b8",
};

function Cell({ label, value, editable, onSave, dark }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <div className="flex flex-1 flex-col gap-1 rounded-lg bg-white p-2 shadow-inner" onClick={(e) => e.stopPropagation()}>
        <span className="text-[9px] font-bold uppercase text-slate-400">{label}</span>
        <textarea
          className="w-full rounded border border-slate-200 p-1 text-[11px] text-slate-800"
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
        "flex flex-1 flex-col items-center gap-0.5 px-2 py-1.5 text-center",
        editable ? "cursor-pointer hover:opacity-80" : "",
      ].join(" ")}
      title={editable ? "Click para editar" : undefined}
    >
      <span className={["text-[9px] font-bold uppercase tracking-wide", dark ? "text-white/70" : "text-aha-navy/60"].join(" ")}>
        {label}
      </span>
      <span className={["text-[11px] font-medium leading-tight", dark ? "text-white" : "text-aha-navy"].join(" ")}>
        {renderValue(value) || "—"}
      </span>
    </div>
  );
}

function Band({ level, tone, dividers = true, children }) {
  return (
    <div
      className="flex w-full"
      style={{ clipPath: clipPathFor(level), backgroundColor: TONE_BG[tone], minHeight: level === 5 ? 64 : 56 }}
    >
      {children.map((child, i) => (
        <div
          key={i}
          className={dividers && i > 0 ? "flex flex-1 border-l border-dashed border-white/40" : "flex flex-1"}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

const PyramidCanvas = forwardRef(function PyramidCanvas({ data, synthesized, editableKeys, onEditField }, ref) {
  const editable = (key) => editableKeys?.includes(key);
  const v = (key, group) => (synthesized?.[group]?.[key] ?? data[group]?.[key]) ?? null;

  return (
    <div ref={ref} className="rounded-3xl bg-white p-6">
      <div className="mx-auto flex max-w-2xl gap-4">
        <div className="flex flex-1 flex-col gap-[2px]">
          <Band level={5} tone="navy" dividers={false}>
            {[
              <Cell
                key="esencia"
                label="Esencia"
                value={v("esencia", "cuspide")}
                dark
                editable={editable("esencia")}
                onSave={(val) => onEditField("esencia", val, "Esencia")}
              />,
            ]}
          </Band>

          <Band level={4} tone="periwinkle" dividers={false}>
            {[<Cell key="proposito" label="Propósito" value={v("proposito", "alto")} dark editable={false} />]}
          </Band>

          <Band level={3} tone="blue" dividers>
            {[
              <Cell key="br" label="Beneficio racional" value={v("beneficios_racionales", "medio")} dark editable={false} />,
              <Cell key="be" label="Beneficio emocional" value={v("beneficios_emocionales", "medio")} dark editable={false} />,
            ]}
          </Band>

          <Band level={2} tone="periwinkle" dividers>
            {[
              <Cell key="rtb" label="Atributos diferenciales" value={v("razones_para_creer", "medio")} dark editable={false} />,
              <Cell
                key="personalidad"
                label="Personalidad"
                value={v("personalidad", "medio")}
                dark
                editable={editable("personalidad")}
                onSave={(val) => onEditField("personalidad", val, "Personalidad")}
              />,
            ]}
          </Band>

          <Band level={1} tone="lime" dividers={false}>
            {[<Cell key="insight" label="Insight" value={v("insight", "base")} editable={false} />]}
          </Band>

          <Band level={0} tone="pale" dividers>
            {[
              <Cell
                key="entorno"
                label="Entorno competitivo"
                value={v("entorno_competitivo", "base")}
                editable={editable("entorno_competitivo")}
                onSave={(val) => onEditField("entorno_competitivo", val, "Entorno competitivo")}
              />,
              <Cell key="target" label="★ Target" value={v("target", "base")} editable={false} />,
              <Cell
                key="asociaciones"
                label="Asociaciones de marca"
                value={v("asociaciones_marca", "base")}
                editable={editable("asociaciones_marca")}
                onSave={(val) => onEditField("asociaciones_marca", val, "Asociaciones de marca")}
              />,
            ]}
          </Band>
        </div>

        <div className="w-40 shrink-0 space-y-3">
          <div
            className="cursor-pointer rounded-xl bg-aha-lime/20 p-3 text-center hover:bg-aha-lime/30"
            onClick={() => {
              const v1 = prompt("Arquetipo dominante:", data.aparte.arquetipo_dominante || "");
              if (v1 != null) onEditField("arquetipo_dominante", v1, "Arquetipo dominante");
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-aha-navy/60">Arquetipo dominante</p>
            <p className="mt-0.5 text-xs font-semibold text-aha-navy">{data.aparte.arquetipo_dominante || "—"}</p>
          </div>
          <div
            className="cursor-pointer rounded-xl bg-aha-lime/10 p-3 text-center hover:bg-aha-lime/20"
            onClick={() => {
              const v2 = prompt("Arquetipo secundario:", data.aparte.arquetipo_secundario || "");
              if (v2 != null) onEditField("arquetipo_secundario", v2, "Arquetipo secundario");
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-aha-navy/60">Arquetipo secundario</p>
            <p className="mt-0.5 text-xs font-semibold text-aha-navy">{data.aparte.arquetipo_secundario || "—"}</p>
          </div>
          <div
            className="cursor-pointer rounded-xl bg-aha-pale p-3 text-center hover:bg-aha-pale/70"
            onClick={() => {
              const v3 = prompt("Territorio de comunicación:", data.aparte.territorio_marca || "");
              if (v3 != null) onEditField("territorio_comunicacion", v3, "Territorio de comunicación");
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-aha-navy/60">Territorio de comunicación</p>
            <p className="mt-0.5 text-xs font-medium text-aha-navy">{data.aparte.territorio_marca || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PyramidCanvas;
