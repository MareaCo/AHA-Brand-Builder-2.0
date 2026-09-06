const SLOTS = [
  { x: 15, y: 68 },
  { x: 38, y: 88 },
  { x: 62, y: 88 },
  { x: 85, y: 68 },
];

// Convierte cualquier valor a un texto seguro para renderizar — nunca deja pasar un
// objeto/array crudo a JSX (eso hace que React reviente toda la página sin aviso).
function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function truncate(value, max = 70) {
  const text = asText(value);
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

// El modelo controla libremente la forma de "pilares" (no hay schema estricto del lado
// de la API) — puede llegar como array de objetos, un objeto suelto, strings, o con
// entradas nulas/mal formadas si se editó a mano. Esto normaliza CUALQUIER forma a algo
// seguro de renderizar, para que un dato inesperado nunca vuelva a dejar la página en blanco.
export function normalizePilares(raw) {
  let list;
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") list = [raw];
  else if (typeof raw === "string" && raw.trim()) list = [raw];
  else return [];

  return list
    .filter((item) => item != null)
    .slice(0, 4)
    .map((item) => {
      if (typeof item === "string") return { atributo: item, materializacion: "" };
      if (typeof item !== "object") return { atributo: asText(item), materializacion: "" };
      const atributo = item.atributo ?? item.nombre ?? item.titulo ?? "";
      const materializacion = item.materializacion ?? item.descripcion ?? item.como_se_materializa ?? "";
      return { atributo: asText(atributo), materializacion: asText(materializacion) };
    });
}

export default function PropuestaValorDiagram({ definicionNegocio, target, pilaresRaw }) {
  const pilares = normalizePilares(pilaresRaw);

  return (
    <div className="relative mx-auto rounded-3xl bg-white p-4" style={{ height: 420 }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 0 }}>
        <line x1="50%" y1="28%" x2="85%" y2="38%" stroke="#282072" strokeDasharray="4 4" strokeWidth="1.5" />
        {pilares.map((_, i) => (
          <line
            key={i}
            x1="50%"
            y1="28%"
            x2={`${SLOTS[i].x}%`}
            y2={`${SLOTS[i].y - 10}%`}
            stroke="#282072"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div
        className="absolute flex h-40 w-40 -translate-x-1/2 flex-col items-center justify-center rounded-full bg-aha-navy p-3 text-center shadow-md"
        style={{ left: "50%", top: "5%", zIndex: 1 }}
      >
        <span className="text-[8px] font-bold uppercase tracking-wide text-white/60">Definición del negocio</span>
        <span className="mt-1 line-clamp-4 text-[10px] leading-snug text-white">{truncate(definicionNegocio, 110)}</span>
      </div>

      <div
        className="absolute flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-aha-pale p-2 text-center shadow"
        style={{ left: "85%", top: "38%", zIndex: 1 }}
      >
        <span className="text-[8px] font-bold uppercase tracking-wide text-aha-navy/60">Target</span>
        <span className="mt-0.5 line-clamp-4 text-[9px] leading-snug text-aha-navy">{truncate(target, 70)}</span>
      </div>

      {pilares.map((pilar, i) => {
        const slot = SLOTS[i];
        const colors = ["bg-aha-lime", "bg-aha-periwinkle", "bg-aha-lime", "bg-aha-periwinkle"];
        const textColor = i % 2 === 0 ? "text-aha-navy" : "text-white";
        return (
          <div
            key={i}
            className={`absolute flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full ${colors[i]} p-2.5 text-center shadow`}
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: 1 }}
          >
            <span className={`text-[8px] font-bold uppercase tracking-wide ${textColor} opacity-70`}>Pilar {i + 1}</span>
            <span className={`mt-0.5 line-clamp-4 text-[9px] font-medium leading-snug ${textColor}`}>
              {truncate(pilar.atributo, 60)}
            </span>
          </div>
        );
      })}

      {pilares.length === 0 && (
        <p className="absolute inset-x-0 bottom-4 text-center text-xs text-slate-400">
          Todavía no hay pilares definidos.
        </p>
      )}
    </div>
  );
}
