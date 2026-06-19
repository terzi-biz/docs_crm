const TOKEN_KEY = "docs_crm_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Сесія закінчилась. Увійдіть знову.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Сталася помилка");
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Fetches a protected file with the auth header and triggers a browser download,
 * instead of relying on a plain <a href> (which can't carry the Bearer token and
 * surfaces the API's raw JSON error page on failure). */
async function downloadFile(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Сесія закінчилась. Увійдіть знову.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Не вдалося завантажити файл");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request("/auth/me"),

  workTypes: () => request("/work-types"),
  addWorkType: (name: string) =>
    request("/work-types", { method: "POST", body: JSON.stringify({ name }) }),

  listObjects: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/objects${qs ? "?" + qs : ""}`);
  },
  objectStats: () => request("/objects/stats"),
  getObject: (id: string | number) => request(`/objects/${id}`),
  createObject: (data: any) => request("/objects", { method: "POST", body: JSON.stringify(data) }),
  updateObject: (id: string | number, data: any) =>
    request(`/objects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  setStatus: (id: string | number, status: string) =>
    request(`/objects/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  uploadEstimate: (objectId: string | number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(`/estimates/${objectId}/upload`, { method: "POST", body: fd });
  },
  updateEstimate: (id: string | number, data: any) =>
    request(`/estimates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  confirmEstimate: (id: string | number) =>
    request(`/estimates/${id}/confirm`, { method: "POST" }),

  latestEstimate: (objectId: string | number) =>
    request(`/estimates/object/${objectId}/latest`).catch(() => null),
  reanalyzeEstimate: (id: string | number) =>
    request(`/estimates/${id}/reanalyze`, { method: "POST" }),

  generateDocument: (objectId: string | number, type: string) =>
    request(`/documents/${objectId}/generate`, { method: "POST", body: JSON.stringify({ type }) }),
  generatePackage: (objectId: string | number) =>
    request(`/documents/${objectId}/generate-package`, { method: "POST" }),
  listDocuments: (objectId: string | number) => request(`/documents/object/${objectId}`),
  downloadDocument: (docId: number, format: "docx" | "pdf", filename: string) =>
    downloadFile(`/documents/${docId}/download/${format}`, filename),

  listTemplates: () => request("/templates"),
  uploadTemplate: (data: { type: string; name: string; is_active: boolean; file: File }) => {
    const fd = new FormData();
    fd.append("type", data.type);
    fd.append("name", data.name);
    fd.append("is_active", String(data.is_active));
    fd.append("file", data.file);
    return request("/templates/upload", { method: "POST", body: fd });
  },
  patchTemplate: (id: number, data: any) =>
    request(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTemplate: (id: number) => request(`/templates/${id}`, { method: "DELETE" }),
  downloadTemplate: (id: number, filename: string) =>
    downloadFile(`/templates/${id}/download`, filename),
  validateTemplate: (id: number) => request(`/templates/${id}/validate`, { method: "POST" }),
  activateTemplate: (id: number) => request(`/templates/${id}/activate`, { method: "POST" }),

  listCustomFields: () => request("/custom-fields"),
  createCustomField: (data: any) =>
    request("/custom-fields", { method: "POST", body: JSON.stringify(data) }),
  updateCustomField: (id: number, data: any) =>
    request(`/custom-fields/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCustomField: (id: number) => request(`/custom-fields/${id}`, { method: "DELETE" }),
  listVariables: () => request("/variables"),
};
