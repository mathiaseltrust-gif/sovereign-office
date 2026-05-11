import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface BoardMember {
  id: number;
  memberName: string;
  memberRole: string;
  startDate: string | null;
  createdAt: string;
}

interface BizDocument {
  id: number;
  filename: string;
  uploadedAt: string;
  uploadedBy: string | null;
}

interface WhatNextStep {
  step: number;
  action: string;
  agency: string;
  contact: string;
  timeframe: string;
}

interface AgencyContact {
  name: string;
  contact: string;
  purpose: string;
  url?: string;
}

interface BusinessConcept {
  id: number;
  title: string;
  description: string;
  structure: string;
  status: string;
  aiSummary: string | null;
  suggestedStructures: unknown[];
  protections: string[];
  agenciesToContact: AgencyContact[];
  planOutline: Record<string, string>;
  modelCanvas: Record<string, string>;
  provisions: string[];
  whatNextSteps: WhatNextStep[];
  boardMembers: BoardMember[];
  documents: BizDocument[];
  createdAt: string;
  updatedAt: string;
}

function statusBadge(status: string) {
  switch (status) {
    case "draft": return <Badge variant="secondary">Draft</Badge>;
    case "submitted": return <Badge>Submitted</Badge>;
    case "active": return <Badge className="bg-green-600 text-white">Active</Badge>;
    case "archived": return <Badge variant="outline">Archived</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function PlanTab({ concept }: { concept: BusinessConcept }) {
  const plan = concept.planOutline ?? {};
  const planKeys = Object.keys(plan);
  if (planKeys.length === 0) return <p className="text-sm text-muted-foreground">No plan outline yet.</p>;
  return (
    <div className="space-y-4">
      {planKeys.map((key) => (
        <div key={key}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </h3>
          <p className="text-sm">{plan[key]}</p>
        </div>
      ))}
    </div>
  );
}

function ModelTab({ concept }: { concept: BusinessConcept }) {
  const model = concept.modelCanvas ?? {};
  const keys = Object.keys(model);
  if (keys.length === 0) return <p className="text-sm text-muted-foreground">No model canvas yet.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {keys.map((key) => (
        <Card key={key} className="bg-muted/20">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm">{model[key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProvisionsTab({ concept }: { concept: BusinessConcept }) {
  return (
    <div className="space-y-6">
      {concept.protections.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Sovereign Protections</h3>
          <ul className="space-y-2">
            {concept.protections.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-0.5 shrink-0">🛡️</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {concept.provisions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Charter Provisions</h3>
          <ul className="space-y-2">
            {concept.provisions.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-amber-600 mt-0.5 shrink-0">§</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {concept.protections.length === 0 && concept.provisions.length === 0 && (
        <p className="text-sm text-muted-foreground">No provisions recorded.</p>
      )}
    </div>
  );
}

function WhatNextTab({ concept }: { concept: BusinessConcept }) {
  const steps = concept.whatNextSteps ?? [];
  if (steps.length === 0) return <p className="text-sm text-muted-foreground">No activation steps yet.</p>;
  return (
    <div className="space-y-4">
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/20">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
            {s.step}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{s.action}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              <span className="text-xs text-muted-foreground">📍 {s.agency}</span>
              <span className="text-xs text-muted-foreground">📞 {s.contact}</span>
              <span className="text-xs text-primary font-medium">⏱ {s.timeframe}</span>
            </div>
          </div>
        </div>
      ))}
      {concept.agenciesToContact.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Agency Contacts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {concept.agenciesToContact.map((a, i) => (
              <div key={i} className="p-3 rounded-lg border text-xs">
                <p className="font-semibold">{a.name}</p>
                <p className="text-muted-foreground mt-0.5">{a.purpose}</p>
                <p className="text-primary mt-0.5">{a.contact}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BoardTab({ concept, onBoardUpdated }: { concept: BusinessConcept; onBoardUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ memberName: "", memberRole: "", startDate: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function addMember() {
    if (!form.memberName || !form.memberRole) {
      toast({ title: "Name and role are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/business/concepts/${concept.id}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      setForm({ memberName: "", memberRole: "", startDate: "" });
      onBoardUpdated();
      toast({ title: "Board member added" });
    } catch {
      toast({ title: "Failed to add board member", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(memberId: number) {
    try {
      await fetch(`/api/business/concepts/${concept.id}/board/${memberId}`, { method: "DELETE" });
      onBoardUpdated();
      toast({ title: "Board member removed" });
    } catch {
      toast({ title: "Failed to remove board member", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Board Members & Delegated Authority</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Add Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Board Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Member Name *</Label>
                <Input placeholder="Full name" value={form.memberName} onChange={(e) => setForm((f) => ({ ...f, memberName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Role / Title *</Label>
                <Input placeholder="e.g. Chief Executive Officer, Board Secretary" value={form.memberRole} onChange={(e) => setForm((f) => ({ ...f, memberRole: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="mt-1" />
              </div>
              <Button onClick={addMember} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Add Board Member"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {concept.boardMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No board members assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {concept.boardMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">{m.memberName}</p>
                <p className="text-xs text-muted-foreground">{m.memberRole}{m.startDate ? ` · Since ${new Date(m.startDate).toLocaleDateString()}` : ""}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => removeMember(m.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ concept, onDocUpdated }: { concept: BusinessConcept; onDocUpdated: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|png|jpg|jpeg)$/i)) {
      toast({ title: "Only PDF, Word, and image files are allowed", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File must be under 20 MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(10);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

      setProgress(40);
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Failed to upload file");

      setProgress(80);
      const docRes = await fetch(`/api/business/concepts/${concept.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, fileKey: objectPath }),
      });
      if (!docRes.ok) throw new Error("Failed to record document");

      setProgress(100);
      onDocUpdated();
      toast({ title: `${file.name} uploaded successfully` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          Upload PDFs, Word documents, or images associated with this concept (charters, BIA applications, agreements). Max 20 MB per file.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? `Uploading… ${progress}%` : "Upload Document"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileChange}
          />
          {uploading && (
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {concept.documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {concept.documents.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <span className="text-xl">
                {d.filename.match(/\.(png|jpg|jpeg)$/i) ? "🖼️" : "📄"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.filename}</p>
                <p className="text-xs text-muted-foreground">
                  Uploaded {new Date(d.uploadedAt).toLocaleDateString()}
                  {d.uploadedBy ? ` by ${d.uploadedBy}` : ""}
                </p>
              </div>
              {(d as BizDocument & { fileKey?: string }).fileKey && (
                <a
                  href={`/api/storage/objects/${(d as BizDocument & { fileKey?: string }).fileKey?.replace(/^\/objects\//, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline shrink-0"
                >
                  Download
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BusinessConceptDetail({ params }: { params: { id: string } }) {
  const [concept, setConcept] = useState<BusinessConcept | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const conceptId = params.id;

  async function load() {
    try {
      const res = await fetch(`/api/business/concepts/${conceptId}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as BusinessConcept;
      setConcept(data);
    } catch {
      toast({ title: "Failed to load concept", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [conceptId]);

  async function submitForValidation() {
    if (!concept) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/business/concepts/${concept.id}/submit-validation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      toast({ title: "Submitted for validation — AI intake review initiated" });
      load();
    } catch {
      toast({ title: "Submission failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!concept) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Concept not found.</p>
        <Button variant="link" onClick={() => navigate("/business-canvas")}>Back to Business Canvas</Button>
      </div>
    );
  }

  return (
    <div data-testid="page-business-concept-detail" className="max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/business-canvas")} className="mb-2 -ml-2">
            ← Business Canvas
          </Button>
          <h1 className="text-2xl font-serif font-bold">{concept.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {statusBadge(concept.status)}
            {concept.structure && (
              <Badge variant="outline" className="text-xs">{concept.structure}</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Updated {new Date(concept.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        {concept.status === "draft" && (
          <Button
            onClick={submitForValidation}
            disabled={submitting}
            className="shrink-0"
          >
            {submitting ? "Submitting..." : "Submit for Validation"}
          </Button>
        )}
      </div>

      {concept.aiSummary && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-primary mb-1">AI Summary</p>
            <p className="text-sm">{concept.aiSummary}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="plan">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="provisions">Provisions</TabsTrigger>
          <TabsTrigger value="whatnext">What Next</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="m365">M365 / Copilot</TabsTrigger>
        </TabsList>

        <TabsContent value="plan">
          <Card><CardContent className="pt-6"><PlanTab concept={concept} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="model">
          <Card><CardContent className="pt-6"><ModelTab concept={concept} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="provisions">
          <Card><CardContent className="pt-6"><ProvisionsTab concept={concept} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="whatnext">
          <Card><CardContent className="pt-6"><WhatNextTab concept={concept} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="board">
          <Card><CardContent className="pt-6"><BoardTab concept={concept} onBoardUpdated={load} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card><CardContent className="pt-6"><DocumentsTab concept={concept} onDocUpdated={load} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="m365">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center py-16">
              <div className="text-5xl mb-4">🔷</div>
              <h3 className="text-lg font-semibold mb-2">Microsoft 365 & Copilot Integration</h3>
              <Badge variant="outline" className="mb-3">Coming Soon</Badge>
              <p className="text-sm text-muted-foreground max-w-md">
                Future integration will allow you to sync this business concept with Microsoft SharePoint for document management, use Microsoft Copilot for AI-assisted drafting, and connect to Microsoft Teams for board collaboration.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                <div className="p-3 border rounded-lg">
                  <div className="text-2xl mb-1">📁</div>
                  <p>SharePoint Document Library</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-2xl mb-1">🤖</div>
                  <p>Copilot AI Drafting</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-2xl mb-1">👥</div>
                  <p>Teams Collaboration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
