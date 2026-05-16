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

interface OrgProfile {
  orgId: string;
  ein: string | null;
  legalName: string | null;
  exemptType: string | null;
  notes: string | null;
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
}

const DOC_TYPE_LABELS: Record<string, string> = {
  ein_letter: "EIN / Entity ID Letter",
  tax_exempt_cert: "Tax-Exempt Determination Letter",
  "527_reg": "§ 527 Political Organization Filing",
  "501c3_cert": "501(c)(3) Determination Letter",
  tribal_license: "Tribal Business License",
  articles: "Tribal Charter / Articles of Organization",
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeRole } = useAuth();

  const isElevated = ELEVATED_ROLES.includes(activeRole);

  const profileKey = ["org-profile", orgId];
  const docsKey = ["org-documents", orgId];

  const { data: profile, isLoading: profileLoading } = useQuery<OrgProfile>({
    queryKey: profileKey,
    queryFn: () => apiFetch(`/api/org/${orgId}/profile`),
    enabled: expanded,
  });

  const { data: docs, isLoading: docsLoading } = useQuery<OrgDocument[]>({
    queryKey: docsKey,
    queryFn: () => apiFetch(`/api/org/${orgId}/documents`),
    enabled: expanded,
  });

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
      toast({ title: "Profile updated" });
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

      await apiFetch(`/api/org/${orgId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileKey: objectPath,
          label: uploadLabel,
          docType: uploadDocType,
        }),
      });

      queryClient.invalidateQueries({ queryKey: docsKey });
      setShowUploadForm(false);
      setUploadLabel("");
      setUploadDocType("general");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Document uploaded", description: `${file.name} added to ${orgName}.` });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-zinc-200">
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-widest">Entity ID &amp; Organization Documents</CardTitle>
          <span className="text-xs text-muted-foreground">{expanded ? "▲ collapse" : "▼ expand"}</span>
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
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm bg-muted px-3 py-1.5 rounded border">
                    {profile?.ein ?? <span className="text-muted-foreground italic">Not on file</span>}
                  </span>
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
                  On file — used for bank accounts, grant applications, vendor agreements, and federal program access.
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
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowUploadForm((v) => !v)}
                >
                  {showUploadForm ? "Cancel" : "+ Upload Document"}
                </Button>
              )}
            </div>

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
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                    disabled={uploading}
                  />
                </div>
                {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
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
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.filename} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
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
