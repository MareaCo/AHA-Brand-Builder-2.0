const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    let error = `Error ${res.status}`;
    try {
      const body = await res.json();
      error = body.error || error;
    } catch {
      // sin cuerpo JSON
    }
    throw new Error(error);
  }
  if (res.status === 204) return null;
  return res.json();
}

function get(path) {
  return fetch(`${BASE}${path}`).then(handle);
}
function post(path, body) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }).then(handle);
}
function put(path, body) {
  return fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }).then(handle);
}
function del(path) {
  return fetch(`${BASE}${path}`, { method: "DELETE" }).then(handle);
}

export const api = {
  health: () => get("/health"),

  dashboard: () => get("/dashboard"),

  createClient: (data) => post("/clients", data),
  createBrand: (clientId, data) => post(`/clients/${clientId}/brands`, data),

  createSession: (brandId) => post("/sessions", { brandId }),
  getSession: (id) => get(`/sessions/${id}`),
  advanceSession: (id) => post(`/sessions/${id}/advance`),
  reopenStage: (id, stageNumber) => post(`/sessions/${id}/reopen/${stageNumber}`),
  completeSession: (id) => post(`/sessions/${id}/complete`),

  listFiles: (sessionId) => get(`/sessions/${sessionId}/files`),
  uploadFile: (sessionId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${BASE}/sessions/${sessionId}/files`, { method: "POST", body: formData }).then(handle);
  },
  deleteFile: (sessionId, fileId) => del(`/sessions/${sessionId}/files/${fileId}`),

  getStage: (sessionId, stageNumber) => get(`/sessions/${sessionId}/stages/${stageNumber}`),
  getMessages: (sessionId, stageNumber) => get(`/sessions/${sessionId}/stages/${stageNumber}/messages`),
  startStage: (sessionId, stageNumber) => post(`/sessions/${sessionId}/stages/${stageNumber}/start`),
  sendMessage: (sessionId, stageNumber, message) =>
    post(`/sessions/${sessionId}/stages/${stageNumber}/messages`, { message }),
  validateField: (sessionId, stageNumber, fieldKey) =>
    post(`/sessions/${sessionId}/stages/${stageNumber}/fields/${fieldKey}/validate`),
  editField: (sessionId, stageNumber, fieldKey, value, label) =>
    put(`/sessions/${sessionId}/stages/${stageNumber}/fields/${fieldKey}`, { value, label }),

  getPyramid: (sessionId) => get(`/sessions/${sessionId}/pyramid`),
  editPyramidField: (sessionId, fieldKey, value, label) =>
    put(`/sessions/${sessionId}/pyramid/fields/${fieldKey}`, { value, label }),
  coherenceCheck: (sessionId) => post(`/sessions/${sessionId}/pyramid/coherence-check`),
  exportPyramid: (sessionId) => post(`/sessions/${sessionId}/pyramid/export`),

  getManifesto: (sessionId) => get(`/sessions/${sessionId}/manifesto`),
  generateManifesto: (sessionId) => post(`/sessions/${sessionId}/manifesto/generate`),
  videoScript: (sessionId, text) => post(`/sessions/${sessionId}/manifesto/video-script`, { text }),

  exportFinal: (sessionId, payload) => post(`/sessions/${sessionId}/export/final`, payload),

  googleReviews: (query) => get(`/google-reviews?query=${encodeURIComponent(query)}`),
};
