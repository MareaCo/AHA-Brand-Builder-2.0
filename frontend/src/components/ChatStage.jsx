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
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    Promise.all([api.getMessages(session.id, stageNumber), api.getStage(session.id, stageNumber)]).then(
      ([msgs, stage]) => {
        if (cancelled) return;
        setMessages(msgs);
        setFields(stage.content.fields || {});
        setLoaded(true);
      }
    );
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

  return (
    <div className={compact ? "flex flex-col h-[420px]" : "flex flex-col h-full"}>
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

      <div className="flex-1 overflow-y-auto rounded-2xl bg-white/60 p-4 space-y-3">
        {!loaded && <p className="text-sm text-slate-400">Cargando conversación...</p>}
        {loaded && messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Escribe algo para comenzar esta etapa, o cuéntale al Brand Builder que ya cargaste insumos.
          </p>
        )}
        {messages.map((m) => (
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

        {Object.entries(fields).length > 0 && (
          <div className="space-y-2 pt-2">
            {Object.entries(fields).map(([key, field]) => (
              <ProposalCard key={key} fieldKey={key} field={field} onValidate={handleValidate} onEdit={handleEdit} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

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
