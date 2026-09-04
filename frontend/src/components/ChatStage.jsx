import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import ProposalCard from "./ProposalCard.jsx";

const INSIGHT_STEPS = [
  "Contextualizar",
  "Verdades candidatas",
  "Elegir la verdad",
  "Necesidad",
  "Fricción",
  "Consolidar",
  "Validar",
];

function isHidden(message) {
  try {
    return Boolean(JSON.parse(message.meta || "{}").hidden);
  } catch {
    return false;
  }
}

export default function ChatStage({
  session,
  stageNumber,
  stageDef,
  onFieldsChanged,
  compact = false,
  canAdvance = false,
  advancing = false,
  onAdvance,
  advanceLabel = "Continuar a la siguiente etapa →",
}) {
  const [messages, setMessages] = useState([]);
  const [fields, setFields] = useState({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoaded(false);
      let msgs = await api.getMessages(session.id, stageNumber);
      const stage = await api.getStage(session.id, stageNumber);
      if (cancelled) return;

      if (msgs.length === 0) {
        setStarting(true);
        try {
          const result = await api.startStage(session.id, stageNumber);
          if (cancelled) return;
          if (!result.alreadyStarted) {
            setFields(result.stageContent?.fields || {});
            onFieldsChanged?.(result.stageComplete);
          }
          msgs = await api.getMessages(session.id, stageNumber);
        } catch (err) {
          if (!cancelled) setError(err.message);
        } finally {
          if (!cancelled) setStarting(false);
        }
      } else {
        setFields(stage.content.fields || {});
      }

      if (!cancelled) {
        setMessages(msgs);
        setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session.id, stageNumber]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    const tempId = `tmp-${Date.now()}`;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text, id: tempId }]);
    setSending(true);
    try {
      const result = await api.sendMessage(session.id, stageNumber, text);
      setMessages((m) => [...m, result.message]);
      setFields(result.stageContent.fields || {});
      onFieldsChanged?.(result.stageComplete);
    } catch (err) {
      setError(err.message);
      setMessages((m) => m.filter((x) => x.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  async function handleValidate(fieldKey) {
    const updated = await api.validateField(session.id, stageNumber, fieldKey);
    setFields(updated.fields);
    onFieldsChanged?.(stageComplete(updated.fields));
  }

  async function handleEdit(fieldKey, value, label) {
    const updated = await api.editField(session.id, stageNumber, fieldKey, value, label);
    setFields(updated.fields);
    onFieldsChanged?.(stageComplete(updated.fields));
  }

  function stageComplete(currentFields) {
    if (!stageDef?.fields?.length) return true;
    return stageDef.fields.every((f) => {
      const entry = currentFields[f.key];
      return entry && (entry.status === "validado_por_usuario" || entry.status === "editado_por_usuario");
    });
  }

  const visibleMessages = messages.filter((m) => !isHidden(m));

  // Solo se muestran como tarjeta los campos que la IA ya propuso (o que el usuario
  // ya completó) — así la etapa se siente como una conversación que va construyendo
  // cosas, no como un formulario en blanco esperando ser llenado.
  const proposedFieldEntries = Object.entries(fields);
  const pendingFieldDefs = (stageDef?.fields || []).filter((f) => !fields[f.key]);

  return (
    <div className={compact ? "flex flex-col h-[420px]" : "flex flex-col"}>
      {stageNumber === 2 && !compact && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {INSIGHT_STEPS.map((label, i) => (
            <span
              key={label}
              className="rounded-full bg-aha-pale px-2.5 py-1 text-[10px] font-medium text-aha-navy"
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
      )}

      <div
        className={
          compact
            ? "flex-1 overflow-y-auto rounded-2xl bg-white/60 p-4 space-y-3"
            : "rounded-2xl bg-white/60 p-4 space-y-3"
        }
      >
        {(!loaded || starting) && (
          <p className="text-sm text-slate-400">
            {starting ? "Preparando esta etapa..." : "Cargando conversación..."}
          </p>
        )}
        {visibleMessages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={[
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line",
                m.role === "user" ? "bg-aha-navy text-white" : "bg-aha-pale/70 text-slate-800",
              ].join(" ")}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loaded && !starting && proposedFieldEntries.length > 0 && (
          <div className="space-y-2 pt-2">
            {proposedFieldEntries.map(([key, field]) => (
              <ProposalCard key={key} fieldKey={key} field={field} onValidate={handleValidate} onEdit={handleEdit} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {loaded && !starting && pendingFieldDefs.length > 0 && (
        <div className="mt-3">
          {!showManual ? (
            <button
              type="button"
              className="text-[11px] text-slate-400 hover:text-aha-periwinkle hover:underline"
              onClick={() => setShowManual(true)}
            >
              ¿La conversación no está avanzando? Completa tú misma lo que falte →
            </button>
          ) : (
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Completar manualmente</span>
                <button type="button" className="text-[11px] text-slate-400 hover:underline" onClick={() => setShowManual(false)}>
                  ocultar
                </button>
              </div>
              {pendingFieldDefs.map((f) => (
                <ProposalCard
                  key={f.key}
                  fieldKey={f.key}
                  field={{ label: f.label, value: "", status: "sin_definir" }}
                  onValidate={handleValidate}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {canAdvance && onAdvance && (
        <button
          type="button"
          className="btn-primary mt-3 w-full justify-center"
          onClick={onAdvance}
          disabled={advancing}
        >
          {advancing ? "Avanzando..." : advanceLabel}
        </button>
      )}

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-aha-periwinkle focus:outline-none"
          placeholder="Escribe tu respuesta..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="btn-primary" disabled={sending || !input.trim()}>
          {sending ? "Pensando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
