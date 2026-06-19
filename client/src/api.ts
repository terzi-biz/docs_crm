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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Сталася помилка");
  }
  if (res.status === 204) return null;
  return res.json();
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

  generateContract: (objectId: string | number) =>
    request(`/documents/${objectId}/contract`, { method: "POST" }),
  generateEstimateDoc: (objectId: string | number) =>
    request(`/documents/${objectId}/estimate`, { method: "POST" }),
  generateInvoice: (objectId: string | number, kind: string) =>
    request(`/documents/${objectId}/invoice`, { method: "POST", body: JSON.stringify({ kind }) }),
  generatePackage: (objectId: string | number) =>
    request(`/documents/${objectId}/package`, { method: "POST" }),
  downloadUrl: (docId: number, format: "docx" | "pdf") =>
    `/api/documents/${docId}/download/${format}`,
};
