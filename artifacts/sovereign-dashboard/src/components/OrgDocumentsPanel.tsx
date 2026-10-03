import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken, useAuth } from "@/components/auth-provider";
import { CheckCircle2 } from "lucide-react";

interface OrgProfile {
  orgId: string;
  ein: string | null;
  legalName: string | null;
  exemptType: string | null;
  notes: string | null;
  updatedAt?: string;
}

interface OrgDocument {
  id: number;
  orgId: string;
  docType: string;
  label: string;
  filename: string;
  fileKey: string | null;
  description: string | null;
  uploadedAt: string;
  documentRef?: string | null;
}

interface CanonicalAssociation {
  id: number;
  entity_type: string;
  entity_id: string;
  relationship_type: string;
  confidence: string;
  resolution_method: string;
  status: string;
}

interface CanonicalAssociationDetail {
  document: {
    documentRef: string;
    classification: string | null;
    verificationState: string;
    sensitivityLevel: string;
  };
  summary: {
    total: number;
    active: number;
    proposed: number;
    unresolved: number;
    rejected: number;
    reviewRequired: boolean;
  };
  associations: CanonicalAssociation[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  ein_letter: "EIN / Entity ID Letter",
  tax_exempt_cert: "Tax-Exempt Determination Letter",
  "527_reg": "§ 527 Political Organization Filing",
  "501c3_cert": "501(c)(3) Determination Letter",
  tribal_license: "Tribal Business License",
  articles: "Tribal Charter / Articles of Organization",
  charter: "Board Charter / Governance Instrument",
  appointment: "Trustee Appointment / Credential",
  conflict: "Conflict of Interest Disclosure",
  minutes: "Board Meeting Minutes",
  resolution: "Board Resolution",
  report: "Board / Fiduciary Report",
  evidence: "Board Matter Evidence",
  general: "Organizational Document",
};

const DOC_TYPE_CONTEXT: Record<string, string[]> = {
  ein_letter: [
    "Open tribal and business bank accounts",
    "Required for federal grant applications",
    "Used for tax-exempt purchases and vendor agreements",
    "Needed for payroll and IRS filings",
  ],
  tax_exempt_cert: [
    "Proof of IRS-recognized tax-exempt status",
    "Required for 501(c)(3) or § 527 contributions",
    "Foundation and institutional grant eligibility",
    "Property tax exemption in some jurisdictions",
  ],
  "527_reg": [
    "Establishes NIAC as a recognized political committee",
    "Required for receiving and making political contributions",
    "Basis for annual Form 8872 reporting",
    "Proof of independent political standing",
  ],
  "501c3_cert": [
    "Confirms tax-deductible donation eligibility for donors",
    "Foundation grant eligibility",
    "Federal and state contract preference qualification",
  ],
  tribal_license: [
    "Issued under tribal sovereign authority",
    "Required for IEE set-aside contracting",
    "Basis for sovereign business operations",
    "Recognized under 25 C.F.R. § 140.3",
  ],
  articles: [
    "Foundational governance document",
    "Required for bank accounts and institutional agreements",
    "Proof of organizational authority and structure",
  ],
  charter: [
    "Defines Board authority, structure, scope, and governance procedures",
    "Preserves the institutional basis for trustee action",
  ],
  appointment: [
    "Documents trustee appointment, office, term, or delegated authority",
    "Supports access and accountability records",
  ],
  conflict: [
    "Documents disclosed interests and recusal requirements",
    "Preserves the Board's conflict-management record",
  ],
  minutes: [
    "Preserves deliberations, attendance, actions, and follow-up items",
    "Provides the permanent record of a Board meeting",
  ],
  resolution: [
    "Records a formal Board action or directive",
    "Supports implementation and later audit",
  ],
  report: [
    "Documents fiduciary, compliance, program, or stewardship findings",
    "Supports Board review and institutional continuity",
  ],
  evidence: [
    "Supports a Board Matter, directive, response, or closure determination",
    "Preserves the evidence relied upon by the Board",
  ],
  general: [
    "Supporting documentation for organizational record",
  ],
};

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getCurrentBearerToken();
  const r = await fetch(path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(err.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

const ELEVATED_ROLES = ["trustee", "officer", "sovereign_admin"];

function CanonicalLinks({ documentRef }: { documentRef: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery<CanonicalAssociationDetail>({
    queryKey: ["canonical-document-associations", documentRef],
    queryFn: () => apiFetch(`/api/documents/registry/${encodeURIComponent(documentRef)}/associations`),
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <div className="pt-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-[10px]"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide links" : "Linked records"}
        {data && !open ? ` · ${data.summary.active}` : ""}
      </Button>

      {open && (
        <div className="mt-1.5 rounded border bg-muted/20 p-2 space-y-1.5">
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : error ? (
            <p className="text-[10px] text-muted-foreground">
              Relationship details are restricted for this document.
            </p>
          ) : data ? (
            <>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[9px]">
                  {data.summary.active} active link{data.summary.active === 1 ? "" : "s"}
                </Badge>
                {data.summary.reviewRequired && (
                  <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">
                    review required
                  </Badge>
                )}
                {data.document.sensitivityLevel === "protected" && (
                  <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">
                    protected
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {data.associations
                  .filter((association) => association.status === "active")
                  .map((association) => (
                    <div
                      key={association.id}
                      className="flex items-center justify-between gap-2 text-[10px]"
                    >
                      <span className="truncate text-muted-foreground">
                        {association.entity_type.replace(/_/g, " ")} · {association.relationship_type.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[120px]">
                        {association.entity_id}
                      </span>
                    </div>
                  ))}
              </div>
              <p className="text-[9px] text-muted-foreground">
                One stored original · relationships supplied by the canonical Office ledger.
              </p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface Props {
  orgId: string;
  orgName: string;
  defaultExpanded?: boolean;
}

export function OrgDocumentsPanel({ orgId, orgName, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editingEin, setEditingEin] = useState(false);
  const [einInput, setEinInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadDocType, setUploadDocType] = useState<string>("general");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showLinkExisting, setShowLinkExisting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeRole } = useAuth();

  const isElevated = ELEVATED_ROLES.includes(activeRole);

  const profileKey = ["org-profile", orgId];
  const docsKey = ["org-documents", orgId];
  const catalogKey = ["org-document-catalog"];

  const { data: profile, isLoading: profileLoading } = useQuery<OrgProfile>({
    queryKey: profileKey,
    queryFn: () => apiFetch(`/api/org/${orgId}/profile`),
    enabled: expanded && isElevated,
  });

  const { data: docs, isLoading: docsLoading } = useQuery<OrgDocument[]>({
    queryKey: docsKey,
    queryFn: () => apiFetch(`/api/org/${orgId}/documents`),
    enabled: expanded && isElevated,
  });

  const { data: catalogDocs = [], isLoading: catalogLoading } = useQuery<OrgDocument[]>({
    queryKey: catalogKey,
    queryFn: () => apiFetch("/api/org/_documents/catalog"),
    enabled: expanded && isElevated && showLinkExisting,
    staleTime: 30_000,
  });

  const linkableDocs = catalogDocs.filter((doc) => doc.orgId !== orgId);

  const patchProfile = useMutation({
    mutationFn: (data: Partial<OrgProfile>) =>
      apiFetch(`/api/org/${orgId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKey });
      setEditingEin(false);
      toast({ title: "Saved to Office Records", description: `${orgName} entity ID was saved successfully.` });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: number) =>
      apiFetch(`/api/org/${orgId}/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKey });
      toast({ title: "Document removed" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const linkExisting = useMutation({
    mutationFn: (sourceDocumentId: number) =>
      apiFetch(`/api/org/${orgId}/documents/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceDocumentId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKey });
      queryClient.invalidateQueries({ queryKey: catalogKey });
      setShowLinkExisting(false);
      toast({ title: "Existing document linked", description: `The document is now part of ${orgName} without uploading another copy.` });
    },
    onError: (e: Error) => toast({ title: "Link failed", description: e.message, variant: "destructive" }),
  });

  const handleUpload = async (file: File) => {
    if (!uploadLabel.trim()) {
      toast({ title: "Label required", description: "Enter a label for this document.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const token = getCurrentBearerToken();

      const { uploadURL, objectPath } = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      }).then((r) => r.json());

      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      const saved = await apiFetch(`/api/org/${orgId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileKey: objectPath,
          label: uploadLabel,
          docType: uploadDocType,
        }),
      }) as OrgDocument;

      queryClient.invalidateQueries({ queryKey: docsKey });
      setShowUploadForm(false);
      setUploadLabel("");
      setUploadDocType("general");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Saved to Office Records", description: saved.documentRef ? `${file.name} is stored once as ${saved.documentRef} and linked to ${orgName}.` : `${file.name} is now stored in ${orgName}.` });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!isElevated) return null;

  return (
    <Card className="border-zinc-200">
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{orgName}</p><CardTitle className="text-sm uppercase tracking-widest">Entity ID &amp; Organization Documents</CardTitle></div>
          <div className="flex items-center gap-2">
            {(profile?.ein || (docs && docs.length > 0)) && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Saved to Office Records
              </span>
            )}
            <span className="text-xs text-muted-foreground">{expanded ? "▲ collapse" : "▼ expand"}</span>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5">
          {profileLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Entity / Organization ID
              </Label>
              <p className="text-[11px] text-muted-foreground -mt-1">
                EIN, tribal entity number, charter number, IEE registration, or federal recognition number.
              </p>
              {editingEin && isElevated ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={einInput}
                    onChange={(e) => setEinInput(e.target.value)}
                    placeholder="e.g. 85-1234567 or MET-IEE-001"
                    className="font-mono text-sm h-8 max-w-[220px]"
                  />
                  <Button size="sm" className="h-8 text-xs" onClick={() => patchProfile.mutate({ ein: einInput })} disabled={patchProfile.isPending}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingEin(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm bg-muted px-3 py-1.5 rounded border">
                    {profile?.ein ?? <span className="text-muted-foreground italic">Not on file</span>}
                  </span>
                  {profile?.ein && (
                    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                  {isElevated && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => { setEinInput(profile?.ein ?? ""); setEditingEin(true); }}
                    >
                      {profile?.ein ? "Edit" : "Add ID"}
                    </Button>
                  )}
                </div>
              )}
              {profile?.ein && (
                <p className="text-xs text-muted-foreground">
                  Saved in Sovereign Office{profile.updatedAt ? ` · last updated ${new Date(profile.updatedAt).toLocaleString()}` : ""} — used for bank accounts, grant applications, vendor agreements, and federal program access.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Exempt Status &amp; Organization Documents
              </Label>
              {isElevated && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setShowUploadForm((v) => !v); setShowLinkExisting(false); }}
                  >
                    {showUploadForm ? "Cancel" : "+ Upload Document"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setShowLinkExisting((v) => !v); setShowUploadForm(false); }}
                  >
                    {showLinkExisting ? "Close Existing" : "Link Existing"}
                  </Button>
                </div>
              )}
            </div>

            {showLinkExisting && isElevated && (
              <div className="p-3 rounded-md border bg-muted/30 space-y-2">
                <div>
                  <p className="text-xs font-semibold">Link a document already stored in another organization record</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">This reuses the existing stored file instead of uploading a duplicate.</p>
                </div>
                {catalogLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : linkableDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No other uploaded organization documents are available to link.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {linkableDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 rounded border bg-background p-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{doc.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {doc.orgId.replace(/_/g, " ")} · {doc.filename}
                          </p>
                          {doc.documentRef && (
                            <p className="text-[9px] text-emerald-700/70 font-mono truncate">
                              {doc.documentRef} · canonical
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          disabled={linkExisting.isPending}
                          onClick={() => linkExisting.mutate(doc.id)}
                        >
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showUploadForm && isElevated && (
              <div className="p-3 rounded-md border bg-muted/30 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Document Label</Label>
                    <Input
                      value={uploadLabel}
                      onChange={(e) => setUploadLabel(e.target.value)}
                      placeholder="e.g. Tribal Charter 2024 or EIN Letter"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Document Type</Label>
                    <Select value={uploadDocType} onValueChange={setUploadDocType}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Select File (PDF, PNG, JPG, DOC)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="text-sm"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    disabled={uploading}
                  />
                  {selectedFile && (
                    <p className="text-[11px] text-muted-foreground mt-1">Selected: {selectedFile.name}</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={uploading || !selectedFile || !uploadLabel.trim()}
                    onClick={() => selectedFile && handleUpload(selectedFile)}
                  >
                    {uploading ? "Saving…" : <><CheckCircle2 className="h-3.5 w-3.5" /> Save Document</>}
                  </Button>
                </div>
              </div>
            )}

            {docsLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : !docs || docs.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                No documents uploaded yet.{isElevated ? " Upload charter, entity ID letters, or exempt status documents above." : ""}
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="rounded-md border p-3 space-y-2 bg-background">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{doc.label}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-300 bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Saved
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.filename} · saved {new Date(doc.uploadedAt).toLocaleString()}</p>
                        {doc.documentRef && (
                          <>
                            <p className="text-[10px] font-mono text-emerald-700 mt-1">
                              {doc.documentRef} · canonical Office record
                            </p>
                            <CanonicalLinks documentRef={doc.documentRef} />
                          </>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {doc.fileKey && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              const token = getCurrentBearerToken();
                              fetch(`/api/org/${orgId}/documents/${doc.id}/download`, {
                                headers: { Authorization: `Bearer ${token}` },
                              }).then((r) => r.blob()).then((blob) => {
                                window.open(URL.createObjectURL(blob));
                              });
                            }}
                          >
                            Open
                          </Button>
                        )}
                        {isElevated && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => deleteDoc.mutate(doc.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                    {DOC_TYPE_CONTEXT[doc.docType] && (
                      <div className="bg-muted/40 rounded p-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">This document is used for:</p>
                        <ul className="space-y-0.5">
                          {DOC_TYPE_CONTEXT[doc.docType].map((use) => (
                            <li key={use} className="text-xs text-muted-foreground flex gap-1.5">
                              <span className="text-green-600 shrink-0">✓</span>
                              {use}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
