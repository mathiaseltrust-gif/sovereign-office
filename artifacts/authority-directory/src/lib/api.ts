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
    // Centralized 401 signal — App.tsx listens and shows full-page expired notice
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }
    throw err;
  }
  return res.json() as Promise<T>;
}

// ─── Jurisdiction ─────────────────────────────────────────────────────────────

export interface JurisdictionState {
  stateCode: string;
  stateName: string;
}

export interface JurisdictionRow {
  id: number;
  country: string;
  stateCode: string;
  stateName: string;
  county: string | null;
  city: string | null;
  fipsCode: string | null;
  tribalLandCode: string | null;
  parcelOrApnReference: string | null;
  tribalLandFlag: boolean;
  jurisdictionFlags: string[];
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface JurisdictionStatesResponse {
  mode: "states";
  count: number;
  results: JurisdictionState[];
}

export interface JurisdictionCountiesResponse {
  mode: "counties";
  state: string;
  count: number;
  results: JurisdictionRow[];
}

// ─── Agency ───────────────────────────────────────────────────────────────────

export interface Agency {
  id: number;
  agencyName: string;
  agencyType: string;
  governmentLevel: string;
  stateCode: string | null;
  county: string | null;
  city: string | null;
  mailingAddress: string | null;
  physicalAddress: string | null;
  parentAgency: string | null;
  oversightAgency: string | null;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  sourceUrl: string | null;
  lastVerifiedDate: string | null;
  confidenceScore: number;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Matter Routing ───────────────────────────────────────────────────────────

export interface MatterRoutingRule {
  id: number;
  matterType: string;
  matterLabel: string;
  primaryEntityType: string;
  oversightEntityType: string | null;
  requiredNoticeTemplate: string | null;
  escalationTemplate: string | null;
  legalFlagGroup: string[];
  primaryRecipientNote: string | null;
  oversightRecipientNote: string | null;
  escalationPath: string | null;
  tribalLawApplicable: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Legal Map ────────────────────────────────────────────────────────────────

export interface LegalMapEntry {
  id: number;
  issueType: string;
  authorityName: string;
  federalAuthority: string | null;
  stateAuthority: string | null;
  tribalAuthority: string | null;
  cfrReference: string | null;
  uscReference: string | null;
  caseLawReference: string | null;
  appliesWhen: string | null;
  warningOrLimit: string | null;
  templateLanguageSnippet: string | null;
  reviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Intake ───────────────────────────────────────────────────────────────────

export interface RoutingRecipient {
  id?: number;
  name: string;
  mailingAddress?: string | null;
  phone?: string | null;
  contact?: string | null;
  website?: string | null;
}

export interface RoutingLegalAuthority {
  authorityName: string;
  uscReference: string | null;
  cfrReference: string | null;
  caseLawReference: string | null;
  warningOrLimit: string | null;
  templateSnippet: string | null;
}

export interface RoutingRecommendation {
  matterType: string;
  actionType: string;
  primaryRecipient: RoutingRecipient | null;
  oversightRecipient: RoutingRecipient | null;
  ccList: string[];
  legalFlagSummary: string[];
  suggestedTemplateKey: string | null;
  escalationPath: string | null;
  tribalLawApplicable: string | null;
  legalAuthorities: RoutingLegalAuthority[];
  suggestedPendingReview: true;
  disclaimer: string;
}

export interface IntakeAnalysisResult {
  id: number | null;
  extractionSource: string;
  detectedEntityName: string | null;
  detectedAddress: string | null;
  detectedDeadline: string | null;
  detectedAccountOrReferenceNumber: string | null;
  detectedMatterType: string;
  detectedActionType: string;
  detectedState: string | null;
  detectedCounty: string | null;
  detectedApn: string | null;
  tribalLandFlag: boolean;
  icwaFlag: boolean;
  indianLawFlag: boolean;
  trustLandFlag: boolean;
  federalReviewFlag: boolean;
  legalFlags: string[];
  routingRecommendation: RoutingRecommendation;
  suggestedPendingReview: true;
}

export interface CaseFile {
  id: number;
  caseNumber: string;
  caseType: string;
  jurisdictionLevel: string;
  matterType: string | null;
  title: string;
  status: string;
  linkedDocumentType: string | null;
  linkedDocumentId: number | null;
  linkedDocumentRef: string | null;
  assignedOfficerId: number | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedMember {
  id: number;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  birthYear: number | null;
  locationAddress: string | null;
  membershipStatus: string | null;
  tribalEnrollmentNumber: string | null;
  isDeceased: boolean | null;
  contactEmail: string | null;
}

export interface LinkedPipelineRecord {
  id: number;
  fileNumber: string | null;
  matterType: string | null;
  riskLevel: string | null;
  status: string | null;
  generatedSummary: string | null;
  templateTitle: string | null;
  createdAt: string;
}

export interface LinkedProtectiveOrder {
  id: number;
  caseNumber: string | null;
  title: string;
  status: string;
  namedRespondents: string[];
  legalBases: string[];
  issuedDate: string | null;
  expiresDate: string | null;
  court: string | null;
  summary: string | null;
}

export interface LinkedNfrDocument {
  id: number;
  tribalRef: string | null;
  triggeringEntity: string | null;
  urgencyScore: number | null;
  status: string;
  protectionCategory: string | null;
  createdAt: string;
}

export interface LinkedComplaint {
  id: number;
  text: string;
  classification: string | null;
  status: string;
  tribalRef: string | null;
  createdAt: string;
}

export interface CaseNumberHistoryEntry {
  id: number;
  formerCaseNumber: string;
  newCaseNumber: string;
  reclassifiedAt: string;
  reason: string | null;
  amendmentType: string | null;
  notes: string | null;
}

export interface CaseFileDetail {
  caseFile: CaseFile;
  redirected: boolean;
  formerNumber: string | null;
  numberHistory: CaseNumberHistoryEntry[];
  linkedMember: LinkedMember | null;
  linkedPipelineRecord: LinkedPipelineRecord | null;
  protectiveOrders: LinkedProtectiveOrder[];
  nfrDocuments: LinkedNfrDocument[];
  complaints: LinkedComplaint[];
  nfrInvestigationCount: number;
  relatedCaseFiles: CaseFile[];
}

export interface ContextHints {
  state?: string;
  county?: string;
  matterType?: string;
}

export const api = {
  getStates: () =>
    request<JurisdictionStatesResponse>("/api/authority/jurisdiction"),

  getCounties: (stateCode: string) =>
    request<JurisdictionCountiesResponse>(
      `/api/authority/jurisdiction?state=${encodeURIComponent(stateCode)}`
    ),

  // At least one param must be non-empty
  getAgencies: (params: {
    state?: string;
    county?: string;
    city?: string;
    level?: string;
    q?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.level) sp.set("level", params.level);
    if (params.state) sp.set("state", params.state);
    if (params.county) sp.set("county", params.county);
    if (params.city) sp.set("city", params.city);
    if (params.q) sp.set("q", params.q);
    return request<{ count: number; results: Agency[] }>(
      `/api/authority/agencies?${sp.toString()}`
    );
  },

  getMatters: (matterType?: string) => {
    const sp = new URLSearchParams();
    if (matterType) sp.set("matterType", matterType);
    return request<{ count: number; rules: MatterRoutingRule[] }>(
      `/api/authority/matters?${sp.toString()}`
    );
  },

  getLegalMap: (params?: { q?: string; issueType?: string }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.issueType) sp.set("issueType", params.issueType);
    return request<{ count: number; maps: LegalMapEntry[] }>(
      `/api/authority/legal-map?${sp.toString()}`
    );
  },

  analyzeIntake: (documentText: string, contextHints?: ContextHints) =>
    request<IntakeAnalysisResult>("/api/authority/intake/analyze", {
      method: "POST",
      body: JSON.stringify({ documentText, contextHints }),
    }),

  getIntake: (id: number) =>
    request<IntakeAnalysisResult>(`/api/authority/intake/${id}`),

  getCaseFiles: (params?: {
    caseType?: string;
    jurisdictionLevel?: string;
    status?: string;
    matterType?: string;
    q?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.caseType)         sp.set("caseType", params.caseType);
    if (params?.jurisdictionLevel) sp.set("jurisdictionLevel", params.jurisdictionLevel);
    if (params?.status)           sp.set("status", params.status);
    if (params?.matterType)       sp.set("matterType", params.matterType);
    if (params?.q)                sp.set("q", params.q);
    return request<{ total: number; cases: CaseFile[] }>(
      `/api/case-files?${sp.toString()}`
    );
  },

  getCaseFile: (caseNumber: string) =>
    request<CaseFile>(`/api/case-files/${encodeURIComponent(caseNumber)}`),

  getCaseFileDetail: (caseNumber: string) =>
    request<CaseFileDetail>(`/api/case-files/${encodeURIComponent(caseNumber)}/detail`),

  updateCaseFileStatus: (id: number, status: string, notes?: string) =>
    request<CaseFile>(`/api/case-files/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),

  reclassifyCaseFile: (
    currentCaseNumber: string,
    opts: { newCaseNumber: string; reason: string; amendmentType?: string; notes?: string },
  ) =>
    request<{ success: boolean; formerCaseNumber: string; caseFile: CaseFile }>(
      `/api/case-files/${encodeURIComponent(currentCaseNumber)}/reclassify`,
      {
        method: "PATCH",
        body: JSON.stringify(opts),
      },
    ),
};
