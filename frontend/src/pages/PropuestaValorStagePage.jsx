import ChatStage from "../components/ChatStage.jsx";

const SLOTS = [
  { x: 15, y: 68 },
  { x: 38, y: 88 },
  { x: 62, y: 88 },
  { x: 85, y: 68 },
];

function fieldValue(stageData, stageNumber, fieldKey) {
  const row = stageData.find((s) => s.stageNumber === stageNumber);
  return row?.content?.fields?.[fieldKey]?.value ?? null;
}

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
function normalizePilares(raw) {
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

          {/* Centro: Definición del Negocio */}
          <div
            className="absolute flex h-36 w-36 -translate-x-1/2 flex-col items-center justify-center rounded-full bg-aha-navy p-3 text-center shadow-md"
            style={{ left: "50%", top: "5%", zIndex: 1 }}
          >
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/60">Definición del negocio</span>
            <span className="mt-1 text-[11px] leading-tight text-white">{truncate(definicionNegocio, 90)}</span>
          </div>

          {/* Target */}
          <div
            className="absolute flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-aha-pale p-2 text-center shadow"
            style={{ left: "85%", top: "38%", zIndex: 1 }}
          >
            <span className="text-[8px] font-bold uppercase tracking-wide text-aha-navy/60">Target</span>
            <span className="mt-0.5 text-[9px] leading-tight text-aha-navy">{truncate(target, 60)}</span>
          </div>

          {/* Pilares */}
          {pilares.map((pilar, i) => {
            const slot = SLOTS[i];
            const colors = ["bg-aha-lime", "bg-aha-periwinkle", "bg-aha-lime", "bg-aha-periwinkle"];
            const textColor = i % 2 === 0 ? "text-aha-navy" : "text-white";
            return (
              <div
                key={i}
                className={`absolute flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full ${colors[i]} p-2 text-center shadow`}
                style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: 1 }}
              >
                <span className={`text-[8px] font-bold uppercase tracking-wide ${textColor} opacity-70`}>
                  Pilar {i + 1}
                </span>
                <span className={`mt-0.5 text-[9px] font-medium leading-tight ${textColor}`}>
                  {truncate(pilar.atributo, 50)}
                </span>
              </div>
            );
          })}

          {pilares.length === 0 && (
            <p className="absolute inset-x-0 bottom-4 text-center text-xs text-slate-400">
              Todavía no hay pilares definidos — construyelos con el asistente de la derecha.
            </p>
          )}
        </div>

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
        <ChatStage
          session={session}
          stageNumber={6}
          stageDef={stageDef}
          compact
          onFieldsChanged={onFieldsChanged}
        />
      </div>
    </div>
  );
}
