import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, Clock, Shield, IdCard, X, ScanLine, ExternalLink, AlertCircle, Upload, CheckCircle2, ChevronRight, Bell } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/trust-dashboard$/, "");

function getToken() {
  return localStorage.getItem("trust_auth_token") ?? "";
}

async function fetchMembers(): Promise<Member[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/users`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchMemberIdDoc(userId: number): Promise<IdDocResponse> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/admin/id-document/${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  entraId?: string;
  idDocumentType?: string | null;
  idDocumentUploadedAt?: string | null;
  idJurisdictionCode?: string | null;
}

interface IdDocResponse {
  hasIdDocument: boolean;
  idDocumentType?: string | null;
  idDocumentUploadedAt?: string | null;
  idJurisdictionCode?: string | null;
  signedFrontUrl?: string | null;
  signedBackUrl?: string | null;
  canViewImages: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  chief_justice: "Chief Justice & Trustee",
  trustee: "Trustee",
  officer: "Officer",
  medical_provider: "Medical Provider",
  elder: "Elder",
  community_elder: "Community Elder",
  family_elder: "Family Elder",
  grandparent_elder: "Grandparent Elder",
  adult: "Member (Adult)",
  minor: "Member (Minor)",
  visitor_media: "Visitor / Media",
  member: "Member",
  admin: "Administrator",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  dl: "Driver's License",
  state_id: "State ID",
  passport: "Passport",
  tribal_id: "Tribal ID",
  unknown: "ID Document",
};

function IdDocModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [docData, setDocData] = useState<IdDocResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMemberIdDoc(member.id)
      .then((data) => { if (!cancelled) setDocData(data); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [member.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border">
          <IdCard className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">ID Document — {member.name}</p>
            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-4">Loading ID document data…</p>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {docData && !loading && (
            <>
              {!docData.hasIdDocument ? (
                <p className="text-sm text-muted-foreground text-center py-4">No ID document on file for this member.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Document Type</p>
                      <p className="text-sm font-medium text-foreground">{DOC_TYPE_LABELS[docData.idDocumentType ?? ""] ?? docData.idDocumentType ?? "—"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Jurisdiction</p>
                      <p className="text-sm font-medium text-foreground">{docData.idJurisdictionCode || "—"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Uploaded</p>
                      <p className="text-sm font-medium text-foreground">
                        {docData.idDocumentUploadedAt ? new Date(String(docData.idDocumentUploadedAt)).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>

                  {docData.canViewImages ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-foreground">Scanned Images (Trustee Access)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {docData.signedFrontUrl ? (
                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Front</p>
                            <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
                              <img
                                src={docData.signedFrontUrl}
                                alt="ID front"
                                className="w-full object-contain max-h-40"
                              />
                            </div>
                            <a
                              href={docData.signedFrontUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-primary underline underline-offset-2"
                            >
                              <ExternalLink className="w-3 h-3" /> Open full size
                            </a>
                          </div>
                        ) : (
                          <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
                            Front image not available
                          </div>
                        )}

                        {docData.signedBackUrl ? (
                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Back</p>
                            <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
                              <img
                                src={docData.signedBackUrl}
                                alt="ID back"
                                className="w-full object-contain max-h-40"
                              />
                            </div>
                            <a
                              href={docData.signedBackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-primary underline underline-offset-2"
                            >
                              <ExternalLink className="w-3 h-3" /> Open full size
                            </a>
                          </div>
                        ) : (
                          <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
                            Back image not available
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
                      Image viewing requires Trustee role. Document metadata is visible to Officers.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ExtractedFields {
  documentType?: string;
  issuingJurisdictionCode?: string;
  fullName?: string;
  dateOfBirth?: string;
  idNumber?: string;
  fullAddress?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  extractionMethod?: string;
  confidenceScore?: number;
  [key: string]: unknown;
}

type ScanStep = "choose" | "upload" | "extracting" | "review" | "confirming" | "done" | "notify_sent";

function AdminScanModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [step, setStep] = useState<ScanStep>("choose");
  const [docType, setDocType] = useState<"auto" | "dl" | "passport" | "tribal">("auto");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [jurisdictionAdvisory, setJurisdictionAdvisory] = useState<{ hasAdvisory: boolean; message: string | null } | null>(null);
  const [addressChoice, setAddressChoice] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifySending, setNotifySending] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const handleExtract = async () => {
    if (!frontFile && !backFile) { setError("Please attach at least one side of the ID."); return; }
    setError(null);
    setStep("extracting");
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("docType", docType);
      if (frontFile) formData.append("front", frontFile);
      if (backFile) formData.append("back", backFile);

      const res = await fetch(`${API_BASE}/api/admin/id-document/extract/${member.id}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json().catch(() => ({})) as { fields?: ExtractedFields; scanSessionId?: string; jurisdictionAdvisory?: { hasAdvisory: boolean; message: string | null }; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setFields(data.fields ?? null);
      setScanSessionId(data.scanSessionId ?? null);
      setJurisdictionAdvisory(data.jurisdictionAdvisory ?? null);
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
      setStep("upload");
    }
  };

  const handleConfirm = async () => {
    if (!fields || !scanSessionId) return;
    if (fields.fullAddress && addressChoice === null) { setError("Please indicate whether to update the member's address."); return; }
    setError(null);
    setStep("confirming");
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/admin/id-document/confirm/${member.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fields, scanSessionId, idDocumentType: fields.documentType, idJurisdictionCode: fields.issuingJurisdictionCode, updateVault: addressChoice === "yes" }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStep("done");
    } catch (e) {
      setError((e as Error).message);
      setStep("review");
    }
  };

  const handleSendNotification = async () => {
    setNotifySending(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/admin/id-document/request-scan/${member.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNotifyMessage(data.message ?? "Notification sent.");
      setStep("notify_sent");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setNotifySending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border shrink-0">
          <ScanLine className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">ID Scan — {member.name}</p>
            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="px-5 py-5 space-y-4">

            {/* ── Step: choose ── */}
            {step === "choose" && (
              <>
                <p className="text-xs text-muted-foreground">Choose how to process this member's government ID.</p>
                <button
                  onClick={() => setStep("upload")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                >
                  <Upload className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Upload & scan now</p>
                    <p className="text-xs text-muted-foreground">Officer uploads the member's ID photo to extract and confirm identity on their behalf.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </button>
                <button
                  onClick={handleSendNotification}
                  disabled={notifySending}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-left disabled:opacity-60"
                >
                  <Bell className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{notifySending ? "Sending…" : "Notify member to upload"}</p>
                    <p className="text-xs text-muted-foreground">Send a prompt to the member's Sovereign Dashboard asking them to upload their own ID.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </button>
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                  </div>
                )}
              </>
            )}

            {/* ── Step: upload ── */}
            {step === "upload" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Document Type</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as typeof docType)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="dl">Driver's License</option>
                    <option value="passport">Passport</option>
                    <option value="tribal">Tribal ID</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Front of ID</label>
                    <div
                      onClick={() => frontRef.current?.click()}
                      className="h-24 rounded-lg border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      {frontFile ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <p className="text-[10px] text-green-700 font-medium text-center px-1 truncate w-full text-center">{frontFile.name}</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <p className="text-[10px] text-muted-foreground">Click to attach</p>
                        </>
                      )}
                    </div>
                    <input ref={frontRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Back of ID <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <div
                      onClick={() => backRef.current?.click()}
                      className="h-24 rounded-lg border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      {backFile ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <p className="text-[10px] text-green-700 font-medium text-center px-1 truncate w-full text-center">{backFile.name}</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <p className="text-[10px] text-muted-foreground">Click to attach</p>
                        </>
                      )}
                    </div>
                    <input ref={backRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setBackFile(e.target.files?.[0] ?? null)} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Accepted: JPG, PNG, WEBP, HEIC, or single-page PDF. For driver's licenses, attaching the back enables barcode (PDF417) decode.</p>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={handleExtract} disabled={!frontFile && !backFile} className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    Extract ID Data
                  </button>
                  <button onClick={() => { setStep("choose"); setError(null); }} className="h-9 px-4 rounded-lg border border-border bg-muted/40 text-sm font-medium text-foreground hover:bg-muted/70 transition-colors">
                    Back
                  </button>
                </div>
              </>
            )}

            {/* ── Step: extracting ── */}
            {step === "extracting" && (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Extracting identity data…</p>
                <p className="text-[10px] text-muted-foreground">Attempting barcode decode then vision OCR</p>
              </div>
            )}

            {/* ── Step: review ── */}
            {step === "review" && fields && (
              <>
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-green-300 bg-green-50">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-800">
                    Extraction complete via <span className="font-semibold">{fields.extractionMethod ?? "OCR"}</span>
                    {typeof fields.confidenceScore === "number" && ` (${Math.round(fields.confidenceScore * 100)}% confidence)`}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Extracted Fields</p>
                  <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border">
                    {[
                      ["Document Type", DOC_TYPE_LABELS[fields.documentType ?? ""] ?? fields.documentType],
                      ["Jurisdiction", fields.issuingJurisdictionCode],
                      ["Full Name", fields.fullName],
                      ["Date of Birth", fields.dateOfBirth],
                      ["ID Number", fields.idNumber],
                      ["Address", fields.fullAddress],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={String(label)} className="grid grid-cols-5 px-3 py-2 gap-2">
                        <span className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground col-span-2">{label}</span>
                        <span className="text-xs text-foreground col-span-3 break-words">{String(value ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {jurisdictionAdvisory?.hasAdvisory && jurisdictionAdvisory.message && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{jurisdictionAdvisory.message}</p>
                  </div>
                )}

                {fields.fullAddress && (
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                    <p className="text-xs font-semibold text-foreground">Update member's primary address on file?</p>
                    <p className="text-[10px] text-muted-foreground">{fields.fullAddress}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAddressChoice("yes")}
                        className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${addressChoice === "yes" ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-foreground hover:bg-muted/50"}`}
                      >
                        Yes, update
                      </button>
                      <button
                        onClick={() => setAddressChoice("no")}
                        className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${addressChoice === "no" ? "bg-muted text-foreground border-foreground/30" : "border-border bg-background text-foreground hover:bg-muted/50"}`}
                      >
                        No, keep existing
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    disabled={!!fields.fullAddress && addressChoice === null}
                    className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Confirm & Save ID for {member.name}
                  </button>
                  <button onClick={() => { setStep("upload"); setError(null); }} className="h-9 px-4 rounded-lg border border-border bg-muted/40 text-sm font-medium text-foreground hover:bg-muted/70 transition-colors">
                    Re-upload
                  </button>
                </div>
              </>
            )}

            {/* ── Step: confirming ── */}
            {step === "confirming" && (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Saving ID record…</p>
              </div>
            )}

            {/* ── Step: done ── */}
            {step === "done" && (
              <>
                <div className="p-4 rounded-xl border border-green-300 bg-green-50 flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                  <p className="text-sm font-semibold text-green-900">ID saved successfully</p>
                  <p className="text-xs text-green-800">Government ID for <strong>{member.name}</strong> has been extracted, verified, and recorded in the secure vault.</p>
                </div>
                <button onClick={onClose} className="w-full h-9 rounded-lg border border-border bg-muted/40 text-sm font-medium text-foreground hover:bg-muted/70 transition-colors">
                  Done
                </button>
              </>
            )}

            {/* ── Step: notify_sent ── */}
            {step === "notify_sent" && (
              <>
                <div className="p-4 rounded-xl border border-green-300 bg-green-50 flex flex-col items-center gap-2 text-center">
                  <Bell className="w-7 h-7 text-green-600" />
                  <p className="text-sm font-semibold text-green-900">Notification sent</p>
                  <p className="text-xs text-green-800">{notifyMessage}</p>
                </div>
                <button onClick={onClose} className="w-full h-9 rounded-lg border border-border bg-muted/40 text-sm font-medium text-foreground hover:bg-muted/70 transition-colors">
                  Done
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  onViewId,
  onInitiateScan,
}: {
  member: Member;
  onViewId: (m: Member) => void;
  onInitiateScan: (m: Member) => void;
}) {
  const initials = member.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <div className="px-5 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors">
      <div className="w-9 h-9 rounded-full bg-sidebar flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-sidebar-foreground">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          {ROLE_LABELS[member.role] ?? member.role}
        </span>
        {member.entraId ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Verified</span>
        ) : (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
        )}

        {member.idDocumentType ? (
          <button
            onClick={() => onViewId(member)}
            className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium border border-emerald-200 hover:bg-emerald-200 transition-colors cursor-pointer"
          >
            <IdCard className="w-3 h-3" />
            ID on file · {DOC_TYPE_LABELS[member.idDocumentType] ?? member.idDocumentType}
            {member.idDocumentUploadedAt && (
              <span className="opacity-70">· {new Date(member.idDocumentUploadedAt).toLocaleDateString()}</span>
            )}
          </button>
        ) : (
          <button
            onClick={() => onInitiateScan(member)}
            className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium border border-border hover:bg-muted/80 transition-colors cursor-pointer"
          >
            <ScanLine className="w-3 h-3" />
            No ID — Initiate scan
          </button>
        )}
      </div>
    </div>
  );
}

export default function Members() {
  const { data, isLoading, error } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: fetchMembers,
  });

  const [idViewMember, setIdViewMember] = useState<Member | null>(null);
  const [scanMember, setScanMember] = useState<Member | null>(null);

  const members = data ?? [];
  const verified = members.filter((m) => m.entraId);
  const pending = members.filter((m) => !m.entraId);
  const withId = members.filter((m) => m.idDocumentType);

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Member Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tribal membership records and role assignments.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Members</p>
              <p className="text-xl font-bold text-foreground">{members.length}</p>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entra Verified</p>
              <p className="text-xl font-bold text-foreground">{verified.length}</p>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Verification</p>
              <p className="text-xl font-bold text-foreground">{pending.length}</p>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <IdCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ID on File</p>
              <p className="text-xl font-bold text-foreground">{withId.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">All Members</h2>
          </div>

          {isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading members...</div>
          )}

          {error && (
            <div className="p-8 text-center text-sm text-destructive">
              Could not load members. Check API connection.
            </div>
          )}

          {!isLoading && !error && members.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No members found.</div>
          )}

          {!isLoading && members.length > 0 && (
            <div className="divide-y divide-border">
              {members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  onViewId={setIdViewMember}
                  onInitiateScan={setScanMember}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {idViewMember && (
        <IdDocModal member={idViewMember} onClose={() => setIdViewMember(null)} />
      )}
      {scanMember && (
        <AdminScanModal member={scanMember} onClose={() => setScanMember(null)} />
      )}
    </Layout>
  );
}
