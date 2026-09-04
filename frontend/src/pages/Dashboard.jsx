import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

function Toggle({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "rounded-full px-3 py-1 font-medium transition-colors",
            value === opt.value ? "bg-aha-navy text-white" : "text-slate-500 hover:text-aha-navy",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [clientMode, setClientMode] = useState("new"); // 'existing' | 'new'
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [brandMode, setBrandMode] = useState("new");
  const [brandId, setBrandId] = useState("");
  const [newBrandName, setNewBrandName] = useState("");

  function refresh() {
    setLoading(true);
    api.dashboard().then((data) => {
      setClients(data);
      setLoading(false);
      if (data.length > 0 && !clientId) {
        setClientMode((m) => (m === "new" && data.length > 0 ? "existing" : m));
        setClientId(data[0].id);
      }
    });
  }

  useEffect(refresh, []);

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
  const brandsForClient = selectedClient?.brands || [];

  useEffect(() => {
    if (clientMode === "existing" && brandsForClient.length === 0) {
      setBrandMode("new");
    } else if (clientMode === "existing" && brandsForClient.length > 0 && !brandId) {
      setBrandMode("existing");
      setBrandId(brandsForClient[0].id);
    }
  }, [clientMode, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStart(e) {
    e.preventDefault();
    setError(null);

    const wantsNewClient = clientMode === "new" || clients.length === 0;
    if (wantsNewClient && !newClientName.trim()) return setError("Escribe el nombre del cliente.");
    if (!wantsNewClient && !clientId) return setError("Selecciona un cliente.");

    const wantsNewBrand = brandMode === "new" || brandsForClient.length === 0;
    if (wantsNewBrand && !newBrandName.trim()) return setError("Escribe el nombre de la marca.");
    if (!wantsNewBrand && !brandId) return setError("Selecciona una marca.");

    setCreating(true);
    try {
      let finalClientId = clientId;
      if (wantsNewClient) {
        const client = await api.createClient({ name: newClientName.trim() });
        finalClientId = client.id;
      }

      let finalBrandId = brandId;
      if (wantsNewBrand) {
        const brand = await api.createBrand(finalClientId, { name: newBrandName.trim() });
        finalBrandId = brand.id;
      }

      const session = await api.createSession(finalBrandId);
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-aha-navy">AHA Brand Builder</h1>
        <p className="text-sm text-slate-500">Amplifica · Humaniza · Activa</p>
      </header>

      <form onSubmit={handleStart} className="card mb-8 p-5">
        <h2 className="mb-4 text-base font-bold text-aha-navy">Iniciar un Brand Builder</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Cliente</label>
              {clients.length > 0 && (
                <Toggle
                  value={clientMode}
                  onChange={(v) => {
                    setClientMode(v);
                    setBrandMode("new");
                    setBrandId("");
                  }}
                  options={[
                    { value: "existing", label: "Existente" },
                    { value: "new", label: "Nuevo" },
                  ]}
                />
              )}
            </div>
            {clientMode === "existing" && clients.length > 0 ? (
              <select
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-aha-periwinkle focus:outline-none"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setBrandId("");
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-aha-periwinkle focus:outline-none"
                placeholder="Nombre del cliente..."
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Marca</label>
              {clientMode === "existing" && brandsForClient.length > 0 && (
                <Toggle
                  value={brandMode}
                  onChange={setBrandMode}
                  options={[
                    { value: "existing", label: "Existente" },
                    { value: "new", label: "Nueva" },
                  ]}
                />
              )}
            </div>
            {brandMode === "existing" && clientMode === "existing" && brandsForClient.length > 0 ? (
              <select
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-aha-periwinkle focus:outline-none"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              >
                {brandsForClient.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-aha-periwinkle focus:outline-none"
                placeholder="Nombre de la marca..."
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
              />
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <button type="submit" className="btn-primary mt-4 w-full justify-center" disabled={creating}>
          {creating ? "Creando..." : "▶ Crear e iniciar sesión de Brand Builder"}
        </button>
      </form>

      {loading && <p className="text-sm text-slate-400">Cargando...</p>}

      {!loading && clients.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
            Sesiones existentes
          </h2>
          <div className="space-y-6">
            {clients.map((client) => (
              <div key={client.id} className="card p-5">
                <h3 className="text-lg font-semibold text-aha-navy">{client.name}</h3>
                <div className="mt-3 space-y-3 pl-4 border-l-2 border-aha-lime/50">
                  {client.brands.map((brand) => (
                    <div key={brand.id} className="rounded-xl bg-aha-pale/30 p-3">
                      <h4 className="font-medium text-slate-700">{brand.name}</h4>
                      {brand.sessions.length === 0 && (
                        <p className="mt-1 text-xs text-slate-400">Todavía no hay sesiones para esta marca.</p>
                      )}
                      <ul className="mt-2 space-y-1.5">
                        {brand.sessions.map((session) => (
                          <li key={session.id}>
                            <button
                              onClick={() => navigate(`/sessions/${session.id}`)}
                              className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-xs hover:bg-aha-pale"
                            >
                              <span className={session.status === "completado" ? "text-green-700 font-medium" : "text-slate-600"}>
                                {session.status === "completado" ? "✓ Completado" : session.progressLabel}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(session.updatedAt).toLocaleDateString("es-CO")}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {client.brands.length === 0 && (
                    <p className="text-xs text-slate-400">Todavía no hay marcas para este cliente.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
