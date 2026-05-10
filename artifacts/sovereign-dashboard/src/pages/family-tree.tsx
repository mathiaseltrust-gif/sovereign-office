import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

type Tab = "upload-photo" | "upload-csv" | "view-lineage" | "edit-ancestors" | "knowledge-of-self";

interface LineageRecord {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  birthYear?: number;
  deathYear?: number;
  gender?: string;
  tribalNation?: string;
  tribalEnrollmentNumber?: string;
  notes?: string;
  isDeceased?: boolean;
  generationalPosition?: number;
  lineageTags?: string[];
  icwaEligible?: boolean;
  welfareEligible?: boolean;
  trustBeneficiary?: boolean;
  sourceType?: string;
  linkedProfileUserId?: number;
  createdAt?: string;
}

interface LineageData {
  lineage: LineageRecord[];
  narratives: Array<{
    id: number;
    title?: string;
    content?: string;
    lineageTags?: string[];
    ancestorChain?: string[];
    familyGroup?: string;
    generationalDepth?: number;
    protectionLevel?: string;
    benefitEligibility?: Record<string, boolean>;
    icwaEligible?: boolean;
    welfareEligible?: boolean;
    trustInheritance?: boolean;
    identityTags?: string[];
  }>;
}

interface KnowledgeOfSelf {
  narratives: LineageData["narratives"];
  linkedAncestors: LineageRecord[];
  records: Array<{
    id: number;
    recordType: string;
    recordSource?: string;
    documentContent?: string;
    verificationStatus?: string;
    icwaRelevant?: boolean;
    trustRelevant?: boolean;
    welfareRelevant?: boolean;
    createdAt?: string;
  }>;
}

function makeToken(user: unknown) { return btoa(JSON.stringify(user)); }

const TAB_LABELS: Record<Tab, string> = {
  "upload-photo": "Upload Photo",
  "upload-csv": "Upload CSV",
  "view-lineage": "View Lineage",
  "edit-ancestors": "Edit Ancestors",
  "knowledge-of-self": "Knowledge-of-Self Links",
};

const PROTECTION_COLORS: Record<string, string> = {
  standard: "bg-green-100 text-green-800",
  elevated: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function FamilyTreePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("view-lineage");
  const token = makeToken(user);

  const { data: lineageData, isLoading: lineageLoading } = useQuery<LineageData>({
    queryKey: ["family-tree"],
    queryFn: async () => {
      const r = await fetch("/api/family-tree", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load lineage");
      return r.json();
    },
  });

  const { data: kosData, isLoading: kosLoading } = useQuery<KnowledgeOfSelf>({
    queryKey: ["family-tree-kos"],
    queryFn: async () => {
      const r = await fetch("/api/family-tree/knowledge-of-self", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load knowledge-of-self");
      return r.json();
    },
  });

  return (
    <div data-testid="page-family-tree">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Family Tree &amp; Lineage</h1>
        <p className="text-muted-foreground mt-1">
          Import, document, and manage family lineage — integrated with Knowledge-of-Self and identity verification
        </p>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap border-b pb-3">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            ].join(" ")}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "upload-photo" && (
        <PhotoUploadTab token={token} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["family-tree"] }); toast({ title: "Photo uploaded", description: "Use Edit Ancestors to extract names and dates." }); }} />
      )}
      {activeTab === "upload-csv" && (
        <CsvUploadTab token={token} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["family-tree"] }); queryClient.invalidateQueries({ queryKey: ["family-tree-kos"] }); toast({ title: "Lineage imported", description: "Family tree data has been stored and linked to your identity." }); }} />
      )}
      {activeTab === "view-lineage" && (
        <ViewLineageTab lineageData={lineageData} isLoading={lineageLoading} />
      )}
      {activeTab === "edit-ancestors" && (
        <EditAncestorsTab token={token} lineageData={lineageData} isLoading={lineageLoading} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["family-tree"] }); toast({ title: "Ancestor saved" }); }} />
      )}
      {activeTab === "knowledge-of-self" && (
        <KnowledgeOfSelfTab token={token} kosData={kosData} lineageData={lineageData} isLoading={kosLoading} onLink={() => { queryClient.invalidateQueries({ queryKey: ["family-tree-kos"] }); toast({ title: "Identity link created" }); }} />
      )}
    </div>
  );
}

function PhotoUploadTab({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("No file selected");
      const form = new FormData();
      form.append("file", file);
      if (notes) form.append("notes", notes);
      const r = await fetch("/api/family-tree/upload-photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Upload failed");
      return r.json();
    },
    onSuccess: (data) => { setResult(data); onSuccess(); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Upload Family Tree Photo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
            <p className="text-muted-foreground mb-3">Upload a photo or scan of a family tree, genealogy chart, or ancestral document</p>
            <p className="text-xs text-muted-foreground mb-4">Supported: JPG, PNG, WebP (max 20MB)</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" id="photo-upload" />
            <label htmlFor="photo-upload" className="cursor-pointer inline-flex items-center px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
              Choose Photo
            </label>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Family name, approximate time period, location, or other context about the photo…" rows={3} className="mt-1" />
          </div>
          <Button onClick={() => upload.mutate()} disabled={upload.isPending} className="w-full">
            {upload.isPending ? "Uploading…" : "Upload Photo"}
          </Button>
          {upload.isError && <p className="text-sm text-destructive">{(upload.error as Error).message}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base text-green-700">Photo Received</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{result.message as string}</p>
            <div className="bg-muted rounded-md p-3">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2">Next Steps</p>
              <ol className="space-y-1">
                {(result.instructions as string[]).map((step, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{i + 1}. {step}</li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CsvUploadTab({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("No file selected");
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/family-tree/upload-csv", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Upload failed");
      return r.json();
    },
    onSuccess: (data) => { setResult(data); onSuccess(); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload CSV Lineage Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-md p-4">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2">Required CSV Format</p>
            <code className="text-xs block whitespace-pre-wrap text-muted-foreground">{`name,birth_year,death_year,gender,tribal_nation,parent_names,spouse_names,notes
"Mary McCaster",1882,1945,female,"Choctaw Nation","John McCaster;Sarah Richards","",""
"John McCaster Sr.",1850,1920,male,"Choctaw Nation","","","Elder and landowner"
"Thomas McCaster",1905,1978,male,"","Mary McCaster;Henry Brooks","Jane Wilson",""`}</code>
          </div>
          <p className="text-xs text-muted-foreground">
            — <strong>parent_names</strong>: semicolon-separated list of parent full names as they appear in the CSV<br />
            — <strong>spouse_names</strong>: semicolon-separated spouse names<br />
            — <strong>birth_year</strong> / <strong>death_year</strong>: 4-digit years (leave blank if unknown)
          </p>
          <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
            <p className="text-muted-foreground mb-3">Select your CSV file</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer inline-flex items-center px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
              Choose CSV File
            </label>
          </div>
          <Button onClick={() => upload.mutate()} disabled={upload.isPending} className="w-full">
            {upload.isPending ? "Importing…" : "Import Lineage from CSV"}
          </Button>
          {upload.isError && <p className="text-sm text-destructive">{(upload.error as Error).message}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card className="border-green-300 bg-green-50">
            <CardContent className="pt-4">
              <p className="text-green-800 font-semibold">{result.message as string}</p>
            </CardContent>
          </Card>

          {result.summary && (() => {
            const s = result.summary as Record<string, unknown>;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Lineage Summary</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Persons</span><span className="font-medium">{s.totalPersons as number}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Generations</span><span className="font-medium">{s.generations as number}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tribal Nations</span><span className="font-medium">{(s.tribalNations as string[]).join(", ") || "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Family Groups</span><span className="font-medium">{(s.familyGroups as string[]).join(", ") || "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Protection Level</span>
                      <Badge className={PROTECTION_COLORS[s.protectionLevel as string] ?? ""}>{s.protectionLevel as string}</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Eligibility</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {[["ICWA", s.icwaEligible], ["Tribal Welfare", (s.benefitEligibility as Record<string, boolean>)?.tribalWelfare], ["Trust Beneficiary", s.trustInheritance], ["Ancestral Land Rights", (s.benefitEligibility as Record<string, boolean>)?.ancestralLandRights]].map(([label, val]) => (
                      <div key={label as string} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label as string}</span>
                        <Badge variant={val ? "default" : "secondary"} className="text-xs">{val ? "Eligible" : "Not Determined"}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {result.identityTags && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Identity Tags Generated</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(result.identityTags as string[]).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ViewLineageTab({ lineageData, isLoading }: { lineageData?: LineageData; isLoading: boolean }) {
  if (isLoading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const lineage = lineageData?.lineage ?? [];
  const narratives = lineageData?.narratives ?? [];

  if (lineage.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No lineage records yet. Use Upload CSV or Upload Photo to import your family tree.</p>
        </CardContent>
      </Card>
    );
  }

  const byGeneration = lineage.reduce<Record<number, LineageRecord[]>>((acc, person) => {
    const gen = person.generationalPosition ?? 0;
    if (!acc[gen]) acc[gen] = [];
    acc[gen].push(person);
    return acc;
  }, {});

  const tribalNations = [...new Set(lineage.flatMap((l) => l.tribalNation ? [l.tribalNation] : []))];
  const allTags = [...new Set(lineage.flatMap((l) => Array.isArray(l.lineageTags) ? l.lineageTags as string[] : []))];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Total Records", lineage.length],
          ["Tribal Nations", tribalNations.length || "—"],
          ["Narratives", narratives.length],
          ["Generations", Object.keys(byGeneration).length],
        ].map(([label, val]) => (
          <Card key={label as string}>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-serif font-bold">{val}</div></CardContent>
          </Card>
        ))}
      </div>

      {allTags.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Lineage Tags</CardTitle></CardHeader>
          <CardContent><div className="flex flex-wrap gap-2">{allTags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}</div></CardContent>
        </Card>
      )}

      {narratives.length > 0 && narratives.map((n) => (
        <Card key={n.id} className="border-l-4 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{n.title ?? "Lineage Narrative"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {n.ancestorChain && n.ancestorChain.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Ancestor Chain</p>
                <div className="flex flex-wrap gap-1">
                  {n.ancestorChain.map((a, i) => <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>)}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {n.protectionLevel && <div className="flex gap-2"><span className="text-muted-foreground">Protection:</span><Badge className={`${PROTECTION_COLORS[n.protectionLevel]} text-xs`}>{n.protectionLevel}</Badge></div>}
              {n.icwaEligible !== undefined && <div className="flex gap-2"><span className="text-muted-foreground">ICWA:</span><Badge variant={n.icwaEligible ? "default" : "secondary"} className="text-xs">{n.icwaEligible ? "Eligible" : "N/A"}</Badge></div>}
              {n.trustInheritance !== undefined && <div className="flex gap-2"><span className="text-muted-foreground">Trust:</span><Badge variant={n.trustInheritance ? "default" : "secondary"} className="text-xs">{n.trustInheritance ? "Beneficiary" : "N/A"}</Badge></div>}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">All Lineage Records ({lineage.length})</p>
        {lineage.map((person) => (
          <Card key={person.id}>
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{person.fullName}</span>
                    {person.isDeceased && <Badge variant="secondary" className="text-xs">Deceased</Badge>}
                    {person.icwaEligible && <Badge className="bg-blue-700 text-white text-xs">ICWA</Badge>}
                    {person.trustBeneficiary && <Badge className="bg-amber-700 text-white text-xs">Trust</Badge>}
                    {person.sourceType && <Badge variant="outline" className="text-xs capitalize">{person.sourceType}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-x-3">
                    {person.birthYear && <span>b. {person.birthYear}</span>}
                    {person.deathYear && <span>d. {person.deathYear}</span>}
                    {person.tribalNation && <span>· {person.tribalNation}</span>}
                    {person.gender && <span>· {person.gender}</span>}
                    {person.generationalPosition !== undefined && <span>· Gen {person.generationalPosition}</span>}
                  </div>
                  {person.notes && <p className="text-xs text-muted-foreground mt-1 italic">{person.notes}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EditAncestorsTab({ token, lineageData, isLoading, onSuccess }: { token: string; lineageData?: LineageData; isLoading: boolean; onSuccess: () => void }) {
  const [form, setForm] = useState({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", generationalPosition: "0" });
  const [editId, setEditId] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        fullName: form.fullName,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        birthYear: form.birthYear ? parseInt(form.birthYear, 10) : undefined,
        deathYear: form.deathYear ? parseInt(form.deathYear, 10) : undefined,
        gender: form.gender || undefined,
        tribalNation: form.tribalNation || undefined,
        tribalEnrollmentNumber: form.tribalEnrollmentNumber || undefined,
        notes: form.notes || undefined,
        generationalPosition: parseInt(form.generationalPosition, 10) || 0,
      };

      if (editId !== null) {
        const r = await fetch(`/api/family-tree/${editId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "Update failed");
        return r.json();
      } else {
        const r = await fetch("/api/family-tree/manual", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "Create failed");
        return r.json();
      }
    },
    onSuccess: () => {
      setForm({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", generationalPosition: "0" });
      setEditId(null);
      onSuccess();
    },
  });

  function loadForEdit(person: LineageRecord) {
    setEditId(person.id);
    setForm({
      fullName: person.fullName ?? "",
      firstName: person.firstName ?? "",
      lastName: person.lastName ?? "",
      birthYear: person.birthYear?.toString() ?? "",
      deathYear: person.deathYear?.toString() ?? "",
      gender: person.gender ?? "",
      tribalNation: person.tribalNation ?? "",
      tribalEnrollmentNumber: person.tribalEnrollmentNumber ?? "",
      notes: person.notes ?? "",
      generationalPosition: person.generationalPosition?.toString() ?? "0",
    });
  }

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editId !== null ? `Editing Ancestor #${editId}` : "Add New Ancestor"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input className="mt-1" value={form.fullName} onChange={f("fullName")} placeholder="Full name as it appears in records" />
            </div>
            <div>
              <Label>First Name</Label>
              <Input className="mt-1" value={form.firstName} onChange={f("firstName")} placeholder="Given name" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input className="mt-1" value={form.lastName} onChange={f("lastName")} placeholder="Family name" />
            </div>
            <div>
              <Label>Gender</Label>
              <select value={form.gender} onChange={f("gender")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Birth Year</Label>
              <Input className="mt-1" value={form.birthYear} onChange={f("birthYear")} placeholder="e.g. 1882" type="number" />
            </div>
            <div>
              <Label>Death Year</Label>
              <Input className="mt-1" value={form.deathYear} onChange={f("deathYear")} placeholder="e.g. 1945 (blank if living)" type="number" />
            </div>
            <div>
              <Label>Generational Position</Label>
              <Input className="mt-1" value={form.generationalPosition} onChange={f("generationalPosition")} placeholder="0 = oldest ancestor" type="number" />
            </div>
            <div>
              <Label>Tribal Nation</Label>
              <Input className="mt-1" value={form.tribalNation} onChange={f("tribalNation")} placeholder="e.g. Choctaw Nation" />
            </div>
            <div>
              <Label>Enrollment Number</Label>
              <Input className="mt-1" value={form.tribalEnrollmentNumber} onChange={f("tribalEnrollmentNumber")} placeholder="Tribal enrollment number" />
            </div>
            <div className="md:col-span-3">
              <Label>Notes</Label>
              <Textarea className="mt-1" value={form.notes} onChange={f("notes")} placeholder="Role, relationships, place of origin, any relevant history…" rows={3} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.fullName}>
              {saveMutation.isPending ? "Saving…" : editId !== null ? "Update Ancestor" : "Add Ancestor"}
            </Button>
            {editId !== null && (
              <Button variant="outline" onClick={() => { setEditId(null); setForm({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", generationalPosition: "0" }); }}>
                Cancel Edit
              </Button>
            )}
          </div>
          {saveMutation.isError && <p className="text-sm text-destructive">{(saveMutation.error as Error).message}</p>}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (lineageData?.lineage ?? []).length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Existing Ancestors (click to edit)</p>
          <div className="space-y-2">
            {(lineageData?.lineage ?? []).map((person) => (
              <Card key={person.id} className={`cursor-pointer hover:border-primary transition-colors ${editId === person.id ? "border-primary ring-1 ring-primary" : ""}`} onClick={() => loadForEdit(person)}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{person.fullName}</span>
                    <span className="text-xs text-muted-foreground ml-3">
                      {person.birthYear ? `b. ${person.birthYear}` : ""}{person.deathYear ? ` – d. ${person.deathYear}` : ""}
                      {person.tribalNation ? ` · ${person.tribalNation}` : ""}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{person.sourceType ?? "manual"}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeOfSelfTab({ token, kosData, lineageData, isLoading, onLink }: { token: string; kosData?: KnowledgeOfSelf; lineageData?: LineageData; isLoading: boolean; onLink: () => void }) {
  const [selectedLineageId, setSelectedLineageId] = useState<number | "">("");

  const linkMutation = useMutation({
    mutationFn: async (lineageId: number) => {
      const r = await fetch(`/api/family-tree/${lineageId}/link-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Link failed");
      return r.json();
    },
    onSuccess: onLink,
  });

  if (isLoading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const narratives = kosData?.narratives ?? [];
  const linkedAncestors = kosData?.linkedAncestors ?? [];
  const records = kosData?.records ?? [];
  const allLineage = lineageData?.lineage ?? [];

  return (
    <div className="space-y-6">
      {narratives.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Identity Narratives ({narratives.length})</p>
          {narratives.map((n) => (
            <Card key={n.id} className="border-l-4 border-amber-500">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{n.title ?? "Lineage Narrative"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {n.familyGroup && <p className="text-sm"><span className="text-muted-foreground">Family Group: </span>{n.familyGroup}</p>}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Generational Depth: </span>{n.generationalDepth ?? 0}</div>
                  <div><span className="text-muted-foreground">Protection: </span><Badge className={`${PROTECTION_COLORS[n.protectionLevel ?? "standard"]} text-xs`}>{n.protectionLevel ?? "standard"}</Badge></div>
                  <div><span className="text-muted-foreground">ICWA: </span><Badge variant={n.icwaEligible ? "default" : "secondary"} className="text-xs">{n.icwaEligible ? "Eligible" : "N/A"}</Badge></div>
                  <div><span className="text-muted-foreground">Trust: </span><Badge variant={n.trustInheritance ? "default" : "secondary"} className="text-xs">{n.trustInheritance ? "Beneficiary" : "N/A"}</Badge></div>
                  <div><span className="text-muted-foreground">Welfare: </span><Badge variant={n.welfareEligible ? "default" : "secondary"} className="text-xs">{n.welfareEligible ? "Eligible" : "N/A"}</Badge></div>
                </div>
                {n.ancestorChain && n.ancestorChain.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Ancestor Chain</p>
                    <div className="flex flex-wrap gap-1">{n.ancestorChain.map((a, i) => <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>)}</div>
                  </div>
                )}
                {n.identityTags && n.identityTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">{n.identityTags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}</div>
                )}
                {n.benefitEligibility && Object.keys(n.benefitEligibility).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Benefit Eligibility</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(n.benefitEligibility).filter(([, v]) => v).map(([k]) => (
                        <Badge key={k} className="bg-green-700 text-white text-xs capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {linkedAncestors.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Linked Ancestors ({linkedAncestors.length})</p>
          <div className="space-y-2">
            {linkedAncestors.map((a) => (
              <Card key={a.id}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <span className="font-medium text-sm">{a.fullName}</span>
                    {a.tribalNation && <span className="text-xs text-muted-foreground ml-2">· {a.tribalNation}</span>}
                  </div>
                  <Badge className="bg-green-700 text-white text-xs">Linked</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {allLineage.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Link Ancestor to Your Identity Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Linking creates an identity record connecting your user profile to this ancestor, supporting ICWA verification, welfare eligibility, and trust inheritance claims.</p>
            <div>
              <Label>Select Ancestor</Label>
              <select value={selectedLineageId} onChange={(e) => setSelectedLineageId(e.target.value ? parseInt(e.target.value, 10) : "")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="">Select an ancestor to link…</option>
                {allLineage.map((l) => (
                  <option key={l.id} value={l.id}>{l.fullName}{l.birthYear ? ` (b. ${l.birthYear})` : ""}</option>
                ))}
              </select>
            </div>
            <Button onClick={() => { if (selectedLineageId) linkMutation.mutate(selectedLineageId as number); }} disabled={!selectedLineageId || linkMutation.isPending}>
              {linkMutation.isPending ? "Linking…" : "Link to My Identity Profile"}
            </Button>
            {linkMutation.isError && <p className="text-sm text-destructive">{(linkMutation.error as Error).message}</p>}
            {linkMutation.isSuccess && <p className="text-sm text-green-700">Ancestor linked to your identity profile.</p>}
          </CardContent>
        </Card>
      )}

      {records.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Ancestral Records ({records.length})</p>
          <div className="space-y-2">
            {records.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs capitalize">{rec.recordType}</Badge>
                    <Badge variant={rec.verificationStatus === "verified" ? "default" : "secondary"} className="text-xs">{rec.verificationStatus}</Badge>
                  </div>
                  {rec.documentContent && <p className="text-xs text-muted-foreground mt-1">{rec.documentContent}</p>}
                  <div className="flex gap-2 mt-2">
                    {rec.icwaRelevant && <Badge className="bg-blue-700 text-white text-xs">ICWA</Badge>}
                    {rec.trustRelevant && <Badge className="bg-amber-700 text-white text-xs">Trust</Badge>}
                    {rec.welfareRelevant && <Badge className="bg-green-700 text-white text-xs">Welfare</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {narratives.length === 0 && linkedAncestors.length === 0 && records.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No Knowledge-of-Self links yet. Import lineage data via CSV or photo, then link ancestors to your identity profile here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
