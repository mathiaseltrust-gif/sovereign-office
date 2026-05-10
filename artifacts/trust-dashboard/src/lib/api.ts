const API_BASE = "/api";

export function getAuthToken(): string | null {
  return localStorage.getItem("trust_auth_token");
}

export function setAuthSession(user: { id: string; email: string; name: string; roles: string[] }) {
  const token = btoa(JSON.stringify(user));
  localStorage.setItem("trust_auth_token", token);
  localStorage.setItem("trust_auth_user", JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem("trust_auth_token");
  localStorage.removeItem("trust_auth_user");
}

export function getAuthUser(): { id: string; email: string; name: string; roles: string[] } | null {
  const raw = localStorage.getItem("trust_auth_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface TrustInstrument {
  id: number;
  title: string;
  instrumentType: string;
  content?: string;
  landJson?: Record<string, unknown>;
  partiesJson?: Record<string, unknown>;
  provisionsJson?: unknown[];
  recorderMetadata?: Record<string, unknown>;
  trusteeNotes?: string;
  status: string;
  jurisdiction?: string;
  state?: string;
  county?: string;
  landClassification?: string;
  pdfUrl?: string;
  validationErrors?: unknown[];
  versionHistory?: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface TrustFiling {
  id: number;
  instrumentId: number;
  county: string;
  state: string;
  filingStatus: string;
  filingNumber?: string;
  documentType?: string;
  trustStatus?: string;
  landClassification?: string;
  notes?: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  recorderResponse?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstrumentPayload {
  type?: string;
  title?: string;
  parties?: string[];
  landDescription?: string;
  jurisdiction?: string;
  indianLandProtection?: boolean;
  trustStatus?: boolean;
  federalPreemption?: boolean;
  tribalJurisdiction?: boolean;
  trusteeNotes?: string;
  templateKey?: string;
  templateVariables?: { key: string; value: string }[];
  state?: string;
  recorderMetadata?: {
    county?: string;
    state?: string;
    documentType?: string;
    apn?: string;
    returnAddress?: string;
    requiresNotary?: boolean;
    landClassification?: string;
  };
}

export interface CreateInstrumentResult {
  instrument: TrustInstrument;
  validation: { errors: string[]; warnings: string[]; valid: boolean };
  stateIntel: unknown;
  landClassification: string;
  pdf: { pages: number; checksum: string; generatedAt: string; downloadUrl: string };
}

export const api = {
  instruments: {
    list: () => apiFetch<TrustInstrument[]>("/trust/instruments"),
    get: (id: number) => apiFetch<TrustInstrument>(`/trust/instruments/${id}`),
    create: (payload: CreateInstrumentPayload) =>
      apiFetch<CreateInstrumentResult>("/trust/instruments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    generatePdf: (id: number) =>
      apiFetch<{ success: boolean; pages: number; checksum: string; downloadUrl: string }>(
        `/trust/instruments/${id}/generate-pdf`,
        { method: "POST", body: "{}" },
      ),
    file: (id: number, payload: { county: string; state: string; documentType?: string; notes?: string }) =>
      apiFetch<TrustFiling>(`/trust/instruments/${id}/file`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    submit: (id: number, payload: { county?: string; state?: string }) =>
      apiFetch<{ filing: TrustFiling; message: string }>(`/trust/instruments/${id}/submit`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    filings: (id: number) => apiFetch<TrustFiling[]>(`/trust/instruments/${id}/filings`),
    templates: () => apiFetch<{ templates: string[] }>("/trust/instruments/templates"),
  },

  filings: {
    list: () => apiFetch<TrustFiling[]>("/trust/filings"),
    get: (id: number) => apiFetch<TrustFiling>(`/trust/filings/${id}`),
    accept: (id: number, filingNumber?: string) =>
      apiFetch<TrustFiling>(`/trust/filings/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ filingNumber }),
      }),
    reject: (id: number, reason?: string) =>
      apiFetch<TrustFiling>(`/trust/filings/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    update: (id: number, payload: Partial<{ filingStatus: string; filingNumber: string; recorderResponse: object; notes: string }>) =>
      apiFetch<TrustFiling>(`/trust/filings/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  },

  downloadPdf: async (path: string, filename: string) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`PDF download failed: HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
