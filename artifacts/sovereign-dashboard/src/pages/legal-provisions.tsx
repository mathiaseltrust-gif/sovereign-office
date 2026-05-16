import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, ChevronDown, ChevronUp, Plus, ToggleLeft, ToggleRight, Trash2, Edit2, X, Check, Scale } from "lucide-react";

interface LegalProvision {
  id: number;
  title: string;
  category: string;
  purpose: string;
  content: string;
  keyStatutes: string[];
  companionCategories: string[];
  status: "active" | "draft" | "archived";
  issuedAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  federal_indian_definitions: "Federal Indian Definitions",
  trust_responsibility: "Trust Responsibility",
  land_and_territory: "Land & Territory",
  family_and_kinship: "Family & Kinship",
  health_rights: "Health Rights",
  tribal_governance: "Tribal Governance",
  civil_liberties: "Civil Liberties",
  cultural_continuity: "Cultural Continuity",
  administrative_review: "Administrative Review",
  notice_and_remedy: "Notice & Remedy",
  jurisdiction_mapping: "Jurisdiction Mapping",
  treaty_and_historical_rights: "Treaty & Historical Rights",
  protected_status_review: "Protected Status Review",
  community_stewardship: "Community Stewardship",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  draft: "bg-amber-100 text-amber-800 border-amber-200",
  archived: "bg-gray-100 text-gray-600 border-gray-200",
};

function authHeaders() {
  return { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" };
}

function ProvisionCard({ provision, onToggle, onDelete, onSave }: {
  provision: LegalProvision;
  onToggle: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  onSave: (id: number, updates: Partial<LegalProvision>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(provision.content);
  const [editPurpose, setEditPurpose] = useState(provision.purpose);

  const isActive = provision.status === "active";

  const handleSave = () => {
    onSave(provision.id, { content: editContent, purpose: editPurpose });
    setEditing(false);
  };

  return (
    <Card className={`transition-all duration-200 ${isActive ? "border-l-4 border-l-amber-700" : "border-l-4 border-l-gray-300 opacity-70"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-serif">{provision.title}</CardTitle>
              <Badge className={`text-[10px] border ${STATUS_COLORS[provision.status]}`}>
                {provision.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{provision.purpose}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs gap-1 ${isActive ? "text-emerald-700 hover:text-emerald-800" : "text-gray-400 hover:text-gray-600"}`}
              onClick={() => onToggle(provision.id, isActive ? "draft" : "active")}
              title={isActive ? "Deactivate provision" : "Activate provision"}
            >
              {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {isActive ? "Active" : "Draft"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600"
              onClick={() => { setEditing(!editing); setExpanded(true); }}
              title="Edit provision"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(provision.id)}
              title="Delete provision"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Purpose (short description)</Label>
                <Input
                  value={editPurpose}
                  onChange={e => setEditPurpose(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Educational Content (what COMPANION teaches)</Label>
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={8}
                  className="text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={handleSave}>
                  <Check className="w-3.5 h-3.5" /> Save
                </Button>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => { setEditing(false); setEditContent(provision.content); setEditPurpose(provision.purpose); }}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-md p-3">
                {provision.content}
              </div>

              {provision.keyStatutes && provision.keyStatutes.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1.5">Key Statutes & Citations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {provision.keyStatutes.map((s, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded px-2 py-0.5 font-mono">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {provision.companionCategories && provision.companionCategories.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1.5">COMPANION Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {provision.companionCategories.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function NewProvisionForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", purpose: "", content: "", keyStatutes: "", companionCategories: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/legal-provisions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: form.title,
          category: form.category || form.title.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          purpose: form.purpose,
          content: form.content,
          keyStatutes: form.keyStatutes.split("\n").map(s => s.trim()).filter(Boolean),
          companionCategories: form.companionCategories.split("\n").map(s => s.trim()).filter(Boolean),
          status: "active",
        }),
      });
      if (!r.ok) throw new Error("Failed to create provision");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Provision issued", description: "The new Office Provision is now active in COMPANION." });
      setForm({ title: "", category: "", purpose: "", content: "", keyStatutes: "", companionCategories: "" });
      setOpen(false);
      onCreated();
    },
    onError: () => toast({ title: "Error", description: "Failed to create provision.", variant: "destructive" }),
  });

  if (!open) {
    return (
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> Issue New Provision
      </Button>
    );
  }

  return (
    <Card className="border-2 border-dashed border-amber-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-serif">Issue New Office Provision</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input placeholder="e.g. Education & Employment Rights" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category Key (auto-generated if blank)</Label>
            <Input placeholder="e.g. education_employment" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Purpose (one sentence)</Label>
          <Input placeholder="Short description of what this provision teaches..." value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Educational Content (what COMPANION teaches members)</Label>
          <Textarea placeholder="Full educational content — what rights apply, what citations are relevant, what COMPANION should teach..." rows={6} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Key Statutes (one per line)</Label>
            <Textarea placeholder={"25 U.S.C. § 5304 — ISDEAA\nWorcester v. Georgia (1832)"} rows={3} value={form.keyStatutes} onChange={e => setForm(f => ({ ...f, keyStatutes: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">COMPANION Topics (one per line)</Label>
            <Textarea placeholder={"Rights Activation\nLegal Literacy\nAdministrative Review"} rows={3} value={form.companionCategories} onChange={e => setForm(f => ({ ...f, companionCategories: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button className="gap-1" onClick={() => mutation.mutate()} disabled={!form.title || !form.content || mutation.isPending}>
            <Scale className="w-4 h-4" /> {mutation.isPending ? "Issuing..." : "Issue Provision"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LegalProvisionsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "active" | "draft">("all");

  const { data: provisions, isLoading } = useQuery<LegalProvision[]>({
    queryKey: ["legal-provisions"],
    queryFn: async () => {
      const r = await fetch("/api/legal-provisions", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) throw new Error("Failed to load provisions");
      return r.json();
    },
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/legal-provisions/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Failed to update provision");
      return r.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.status === "active" ? "Provision activated" : "Provision deactivated", description: "COMPANION will reflect this change in the next conversation." });
      qc.invalidateQueries({ queryKey: ["legal-provisions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/legal-provisions/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      toast({ title: "Provision removed" });
      qc.invalidateQueries({ queryKey: ["legal-provisions"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<LegalProvision> }) => {
      const r = await fetch(`/api/legal-provisions/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Provision updated" });
      qc.invalidateQueries({ queryKey: ["legal-provisions"] });
    },
  });

  const filtered = (provisions ?? []).filter(p => filter === "all" || p.status === filter);
  const activeCount = (provisions ?? []).filter(p => p.status === "active").length;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Scale className="w-6 h-6 text-amber-700" />
          <h1 className="text-3xl font-serif font-bold text-foreground">Office Provisions</h1>
        </div>
        <p className="text-muted-foreground">
          Issued by the Office of the Chief Justice &amp; Trustee — Federal Indian law frameworks that COMPANION teaches to every member.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium">{activeCount} active provisions in COMPANION</span>
        </div>
        <div className="flex-1" />
        <p className="text-xs text-muted-foreground">
          Active provisions are injected into every COMPANION session. Draft provisions are saved but not yet taught.
        </p>
      </div>

      {/* COMPANION Safeguard Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong>Educational Safeguard:</strong> COMPANION presents these provisions as legal education — not individualized legal advice or representation.
          The framing used: <em>"These federal provisions may apply depending on your status, community relationship, eligibility, ancestry, location, or jurisdictional circumstances.
          Review and formal analysis may be appropriate."</em> This keeps guidance grounded, responsible, and credible while empowering members with knowledge.
        </p>
      </div>

      {/* Filter + New Provision */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["all", "active", "draft"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${filter === f ? "bg-white shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f === "all" ? `All (${(provisions ?? []).length})` : f === "active" ? `Active (${activeCount})` : `Draft (${(provisions ?? []).filter(p => p.status === "draft").length})`}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <NewProvisionForm onCreated={() => qc.invalidateQueries({ queryKey: ["legal-provisions"] })} />
      </div>

      {/* Provisions list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No provisions found</p>
          <p className="text-sm mt-1">Issue a new provision to add it to COMPANION's knowledge.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(provision => (
            <ProvisionCard
              key={provision.id}
              provision={provision}
              onToggle={(id, status) => toggleMutation.mutate({ id, status })}
              onDelete={(id) => deleteMutation.mutate(id)}
              onSave={(id, updates) => saveMutation.mutate({ id, updates })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
