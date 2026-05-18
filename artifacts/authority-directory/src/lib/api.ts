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
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

export interface JurisdictionData {
  states: Array<{ code: string; name: string }>;
  counties: Array<{ stateCode: string; name: string }>;
}

export interface Agency {
  id: number;
  name: string;
  acronym: string | null;
  govtLevel: string;
  stateCode: string | null;
  county: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  services: string[];
  matterTypes: string[];
  notes: string | null;
}

export interface MatterType {
  id: number;
  code: string;
  label: string;
  category: string;
  description: string | null;
  primaryAuthority: string | null;
  federalStatutes: string[];
  tribalRights: string[];
  routingAgencies: string[];
  documentRequirements: string[];
  timelineDays: number | null;
  sovereigntyImpact: string | null;
}

export interface LegalAuthority {
  id: number;
  citation: string;
  title: string;
  authorityType: string;
  jurisdiction: string | null;
  summary: string | null;
  doctrineCategory: string | null;
  applicableMatterTypes: string[];
  sovereigntyBasis: string | null;
  effectiveDate: string | null;
  notes: string | null;
}

export interface IntakeExtraction {
  id: number;
  documentSnippet: string;
  detectedMatterTypes: string[];
  suggestedAgencies: string[];
  jurisdictionHints: string[];
  keyEntities: string[];
  urgencyLevel: string;
  sovereigntyFlags: string[];
  routingRecommendations: string[];
  summary: string | null;
  rawExtraction: unknown;
  createdAt: string;
}

export interface AnalyzeInput {
  documentText: string;
  stateCode?: string;
  county?: string;
}

export const api = {
  getJurisdiction: () =>
    request<JurisdictionData>("/api/authority/jurisdiction"),

  getAgencies: (params: { govtLevel?: string; stateCode?: string; county?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (params.govtLevel) sp.set("govtLevel", params.govtLevel);
    if (params.stateCode) sp.set("stateCode", params.stateCode);
    if (params.county) sp.set("county", params.county);
    if (params.q) sp.set("q", params.q);
    return request<Agency[]>(`/api/authority/agencies?${sp.toString()}`);
  },

  getMatters: () =>
    request<MatterType[]>("/api/authority/matters"),

  getLegalMap: () =>
    request<LegalAuthority[]>("/api/authority/legal-map"),

  analyzeIntake: (body: AnalyzeInput) =>
    request<IntakeExtraction>("/api/authority/intake/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getIntake: (id: number) =>
    request<IntakeExtraction>(`/api/authority/intake/${id}`),
};
