import { forwardRef, useState } from "react";

// Aplana cualquier objeto anidado (por ejemplo el perfil de Target de la Etapa 5, que
// llega como { segmento_primario: { demografia, psicografia, ... }, ... }) a un texto
// legible, en vez de mostrar el JSON crudo con llaves y comillas dentro de la pirámide.
function flattenToText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flattenToText).filter(Boolean).join(". ");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([k]) => k !== "status")
      .map(([, v]) => flattenToText(v))
      .filter(Boolean)
      .join(". ");
  }
  return String(value);
}

function renderValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : Object.entries(item)
              .filter(([k]) => k !== "status")
              .map(([, v]) => v)
              .filter(Boolean)
              .join(" — ")
      )
      .join(" · ");
  }
  return flattenToText(value);
}

// Cada celda de la pirámide vive dentro de una banda con forma de trapecio (clip-path).
// Si el texto es largo, la banda crece en altura y el borde inclinado del trapecio
// termina cortando las palabras por los lados — por eso el contenido visible se limita
// aquí; el valor completo sigue disponible al hacer click para editar (o al pasar el
// mouse, vía el atributo title).
function truncate(text, max) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
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

function Cell({ label, value, editable, onSave, dark, maxChars = 90, sourceStage }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const fullText = renderValue(value);
  const isTruncated = fullText && fullText.length > maxChars;

  // Al abrirla: si es editable, es la caja de edición de siempre; si no, es una vista de
  // solo lectura con el texto completo — así CUALQUIER bloque de la pirámide se puede
  // leer entero (el objetivo de que funcione como un one-pager real), aunque solo los
  // campos nuevos de esta etapa se puedan editar aquí mismo.
  if (open) {
    return (
      <div className="flex flex-1 flex-col gap-1 rounded-lg bg-white p-2 text-left shadow-inner" onClick={(e) => e.stopPropagation()}>
        <span className="text-[9px] font-bold uppercase text-slate-400">{label}</span>
        {editable ? (
          <>
            <textarea
              className="w-full rounded border border-slate-200 p-1 text-[11px] text-slate-800"
              rows={4}
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
                  setOpen(false);
                }}
              >
                Guardar
              </button>
              <button type="button" className="btn-ghost !px-2 !py-0.5 text-[10px]" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="max-h-40 overflow-y-auto whitespace-pre-line text-[11px] leading-snug text-slate-800">
              {fullText || "—"}
            </p>
            {sourceStage && (
              <p className="text-[10px] italic text-slate-400">
                Viene de la Etapa {sourceStage} — para cambiarlo, reábrela desde el panel "Lo que hemos construido".
              </p>
            )}
            <button type="button" className="btn-ghost self-start !px-2 !py-0.5 text-[10px]" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setDraft(fullText);
        setOpen(true);
      }}
      className={[
        // justify-end: el trapezoide se angosta hacia ARRIBA de cada banda, así que el
        // contenido se ancla abajo (el borde más ancho) para alejarlo de la zona que el
        // clip-path recorta.
        "flex flex-1 cursor-pointer flex-col items-center justify-end gap-0.5 overflow-hidden px-1 py-1.5 text-center hover:opacity-80",
      ].join(" ")}
      title={isTruncated ? "Click para ver completo" : editable ? "Click para editar" : undefined}
    >
      <span className={["text-[9px] font-bold uppercase tracking-wide", dark ? "text-white/70" : "text-aha-navy/60"].join(" ")}>
        {label}
      </span>
      <span className={["line-clamp-3 text-[11px] font-medium leading-tight", dark ? "text-white" : "text-aha-navy"].join(" ")}>
        {truncate(fullText, maxChars)}
      </span>
    </div>
  );
}

function Band({ level, tone, dividers = true, children }) {
  const { bottom } = LEVEL_INSETS[level];
  // El contenido se ancla al borde inferior de la banda (ver justify-end en Cell), así
  // que el punto más angosto que puede tocar es el inset "bottom" de esa banda — se le
  // agrega un margen de seguridad extra para que nunca roce el borde inclinado del
  // trapecio. El padding es en % del ancho de ESTA banda (no de cada celda), por eso va
  // en el contenedor de fila y no en cada Cell.
  const safePadding = `${bottom + 5}%`;
  return (
    <div
      className="flex w-full"
      style={{
        clipPath: clipPathFor(level),
        backgroundColor: TONE_BG[tone],
        minHeight: level === 5 ? 64 : 56,
        paddingLeft: safePadding,
        paddingRight: safePadding,
      }}
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

  const esenciaValue = v("esencia", "cuspide");

  return (
    <div ref={ref} className="rounded-3xl bg-white p-6">
      {/* La cúspide (Esencia) se muestra como título arriba de la pirámide, no adentro del
          triángulo — la punta es geométricamente demasiado angosta para contener texto
          legible sin que el clip-path lo corte. */}
      <button
        type="button"
        disabled={!editable("esencia")}
        onClick={() => {
          const val = prompt("Esencia de marca:", esenciaValue || "");
          if (val != null) onEditField("esencia", val, "Esencia");
        }}
        className={[
          "mx-auto mb-3 block text-center",
          editable("esencia") ? "cursor-pointer hover:opacity-80" : "cursor-default",
        ].join(" ")}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-aha-navy/50">✦ Esencia de marca</p>
        <p className="text-lg font-bold text-aha-navy">{esenciaValue || "—"}</p>
      </button>

      <div className="mx-auto flex max-w-2xl gap-4">
        <div className="flex flex-1 flex-col gap-[2px]">
          <Band level={5} tone="navy" dividers={false}>
            {[<div key="apex-spacer" className="flex-1" />]}
          </Band>

          <Band level={4} tone="periwinkle" dividers={false}>
            {[
              <Cell
                key="proposito"
                label="Propósito"
                value={v("proposito", "alto")}
                dark
                editable={false}
                maxChars={100}
                sourceStage={4}
              />,
            ]}
          </Band>

          <Band level={3} tone="blue" dividers>
            {[
              <Cell
                key="br"
                label="Beneficio racional"
                value={v("beneficios_racionales", "medio")}
                dark
                editable={false}
                maxChars={70}
                sourceStage={3}
              />,
              <Cell
                key="be"
                label="Beneficio emocional"
                value={v("beneficios_emocionales", "medio")}
                dark
                editable={false}
                maxChars={70}
                sourceStage={3}
              />,
            ]}
          </Band>

          <Band level={2} tone="periwinkle" dividers>
            {[
              <Cell
                key="rtb"
                label="Atributos diferenciales"
                value={v("razones_para_creer", "medio")}
                dark
                editable={false}
                maxChars={90}
                sourceStage={3}
              />,
              <Cell
                key="personalidad"
                label="Personalidad"
                value={v("personalidad", "medio")}
                dark
                editable={editable("personalidad")}
                onSave={(val) => onEditField("personalidad", val, "Personalidad")}
                maxChars={90}
              />,
            ]}
          </Band>

          <Band level={1} tone="lime" dividers={false}>
            {[
              <Cell
                key="insight"
                label="Insight"
                value={v("insight", "base")}
                editable={false}
                maxChars={110}
                sourceStage={2}
              />,
            ]}
          </Band>

          <Band level={0} tone="pale" dividers>
            {[
              <Cell
                key="entorno"
                label="Entorno competitivo"
                value={v("entorno_competitivo", "base")}
                editable={editable("entorno_competitivo")}
                onSave={(val) => onEditField("entorno_competitivo", val, "Entorno competitivo")}
                maxChars={70}
              />,
              <Cell
                key="target"
                label="★ Target"
                value={v("target", "base")}
                editable={false}
                maxChars={70}
                sourceStage={5}
              />,
              <Cell
                key="asociaciones"
                label="Asociaciones de marca"
                value={v("asociaciones_marca", "base")}
                editable={editable("asociaciones_marca")}
                onSave={(val) => onEditField("asociaciones_marca", val, "Asociaciones de marca")}
                maxChars={70}
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
