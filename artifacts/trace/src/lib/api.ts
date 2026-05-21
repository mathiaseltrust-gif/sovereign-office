import { getAuthHeaders } from "./auth";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    const err = new ApiError(res.status, text);
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }
    throw err;
  }
  return res.json() as Promise<T>;
}

export interface TraceMatter {
  id: number;
  createdBy: number;
  assignedTo: number | null;
  title: string;
  description: string;
  sourceType: string;
  sourceRef: string | null;
  matterType: string;
  niacReviewType: string | null;
  status: string;
  riskLevel: string;
  niacPathway: boolean;
  intakeLinkId: number | null;
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TraceStats {
  total: number;
  pendingAnalysis: number;
  criticalRisk: number;
  niacFlagged: number;
}

export interface TraceAnalysis {
  id: number;
  matterId: number;
  version: number;
  requiredProcedure: string | null;
  actualConduct: string | null;
  proceduralGaps: string[] | null;
  authorityMap: {
    statutes: string[];
    regulations: string[];
    treaties: string[];
    guidance: string[];
  } | null;
  oversightMap: {
    agencies: string[];
    pathways: string[];
    triggers: string[];
  } | null;
  riskScore: number | null;
  escalationRecs: string[] | null;
  createdAt: string;
}

export interface TraceDraft {
  id: number;
  matterId: number;
  draftType: string;
  content: string;
  approved: boolean;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface TraceAccessUser {
  userId: number;
  email: string;
  name: string;
  role: string;
  profileId: number | null;
  traceAccess: boolean | null;
}

export const api = {
  getMatters: (params?: { status?: string; matterType?: string; riskLevel?: string; niac?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.matterType) sp.set("matterType", params.matterType);
    if (params?.riskLevel) sp.set("riskLevel", params.riskLevel);
    if (params?.niac) sp.set("niac", "true");
    return request<{ total: number; matters: TraceMatter[]; stats: TraceStats }>(
      `/api/trace/matters?${sp.toString()}`
    );
  },

  getMatter: (id: number) =>
    request<TraceMatter>(`/api/trace/matters/${id}`),

  createMatter: (body: {
    title: string;
    description: string;
    sourceType?: string;
    matterType?: string;
    niacReviewType?: string;
    riskLevel?: string;
    niacPathway?: boolean;
    deadlineAt?: string;
    assignedTo?: number;
  }) =>
    request<TraceMatter>("/api/trace/matters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateMatter: (id: number, body: Partial<{
    title: string;
    description: string;
    status: string;
    riskLevel: string;
    matterType: string;
    niacReviewType: string | null;
    niacPathway: boolean;
    assignedTo: number | null;
    deadlineAt: string | null;
  }>) =>
    request<TraceMatter>(`/api/trace/matters/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  analyzeMatter: (id: number) =>
    request<{ analysis: TraceAnalysis; riskScore: number; newRiskLevel: string }>(
      `/api/trace/matters/${id}/analyze`,
      { method: "POST", body: JSON.stringify({}) }
    ),

  getReport: (id: number) =>
    request<{ matter: TraceMatter; analyses: TraceAnalysis[] }>(
      `/api/trace/matters/${id}/report`
    ),

  generateDraft: (id: number, draftType: string) =>
    request<TraceDraft>(`/api/trace/matters/${id}/draft`, {
      method: "POST",
      body: JSON.stringify({ draftType }),
    }),

  getDrafts: (id: number) =>
    request<{ drafts: TraceDraft[] }>(`/api/trace/matters/${id}/drafts`),

  approveDraft: (matterId: number, draftId: number) =>
    request<TraceDraft>(`/api/trace/matters/${matterId}/drafts/${draftId}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  uploadMatter: (formData: FormData) =>
    fetch("/api/trace/matters/upload", {
      method: "POST",
      headers: { ...getAuthHeaders() },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const err = new ApiError(res.status, text);
        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent("auth:session-expired"));
        }
        throw err;
      }
      return res.json() as Promise<TraceMatter>;
    }),

  uploadMatterText: (body: {
    title: string;
    extractedText: string;
    sourceRef?: string;
    matterType?: string;
    niacReviewType?: string;
    niacPathway?: boolean;
    deadlineAt?: string;
  }) =>
    request<TraceMatter>("/api/trace/matters/upload", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getAccessUsers: () =>
    request<{ users: TraceAccessUser[] }>("/api/trace/access"),

  setAccess: (userId: number, grant: boolean) =>
    request<{ success: boolean; userId: number; traceAccess: boolean }>(
      `/api/trace/access/${userId}`,
      { method: "POST", body: JSON.stringify({ grant }) }
    ),
};
