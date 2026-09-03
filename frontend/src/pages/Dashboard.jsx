import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newClientName, setNewClientName] = useState("");
  const [newBrand, setNewBrand] = useState({}); // clientId -> name
  const navigate = useNavigate();

  function refresh() {
    setLoading(true);
    api.dashboard().then((data) => {
      setClients(data);
      setLoading(false);
    });
  }

  useEffect(refresh, []);

  async function createClient(e) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    await api.createClient({ name: newClientName.trim() });
    setNewClientName("");
    refresh();
  }

  async function createBrand(clientId) {
    const name = (newBrand[clientId] || "").trim();
    if (!name) return;
    await api.createBrand(clientId, { name });
    setNewBrand((s) => ({ ...s, [clientId]: "" }));
    refresh();
  }

  async function createSession(brandId) {
    const session = await api.createSession(brandId);
    navigate(`/sessions/${session.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aha-navy">AHA Brand Builder</h1>
          <p className="text-sm text-slate-500">Amplifica · Humaniza · Activa</p>
        </div>
      </header>

      <form onSubmit={createClient} className="card mb-8 flex gap-2 p-4">
        <input
          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-aha-periwinkle focus:outline-none"
          placeholder="Nombre del cliente nuevo..."
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          + Nuevo cliente
        </button>
      </form>

      {loading && <p className="text-sm text-slate-400">Cargando...</p>}

      <div className="space-y-6">
        {clients.map((client) => (
          <div key={client.id} className="card p-5">
            <h2 className="text-lg font-semibold text-aha-navy">{client.name}</h2>

            <div className="mt-3 space-y-4 pl-4 border-l-2 border-aha-lime/50">
              {client.brands.map((brand) => (
                <div key={brand.id}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-700">{brand.name}</h3>
                    <button className="btn-accent !px-3 !py-1 text-xs" onClick={() => createSession(brand.id)}>
                      + Nueva sesión
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {brand.sessions.map((session) => (
                      <li key={session.id}>
                        <button
                          onClick={() => navigate(`/sessions/${session.id}`)}
                          className="flex w-full items-center justify-between rounded-lg bg-aha-pale/50 px-3 py-2 text-left text-xs hover:bg-aha-pale"
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
                    {brand.sessions.length === 0 && (
                      <p className="text-xs text-slate-400">Todavía no hay sesiones para esta marca.</p>
                    )}
                  </ul>
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <input
                  className="flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs focus:border-aha-periwinkle focus:outline-none"
                  placeholder="Nombre de una nueva marca..."
                  value={newBrand[client.id] || ""}
                  onChange={(e) => setNewBrand((s) => ({ ...s, [client.id]: e.target.value }))}
                />
                <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => createBrand(client.id)}>
                  + Marca
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && clients.length === 0 && (
          <p className="text-sm text-slate-400">Todavía no hay clientes. Crea el primero arriba.</p>
        )}
      </div>
    </div>
  );
}
