import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { WhatNextPanel } from "@/components/WhatNextPanel";

const MEDICAL_CENTER = "Mathias El Tribe Medical Center";

const CLINICAL_NOTE_TYPES = [
  { value: "clinical", label: "Clinical Note (ICD/CPT)" },
  { value: "dependent", label: "Dependent Note" },
  { value: "general", label: "General Visit Note" },
  { value: "emergency", label: "Emergency Visit" },
  { value: "mental_health", label: "Mental Health Note" },
  { value: "referral", label: "IHS Referral" },
  { value: "prescription", label: "Prescription Record" },
  { value: "diagnostic", label: "Diagnostic Report" },
  { value: "wellness", label: "Tribal Wellness Check" },
];

const TRIBAL_AUTHORITY_RULES = [
  { rule: "IHS Jurisdiction", desc: "Indian Health Service authority under 25 U.S.C. § 1601 et seq. — tribal members entitled to IHS services" },
  { rule: "Snyder Act", desc: "25 U.S.C. § 13 — Congress authorized health and general assistance to Indians" },
  { rule: "IHCIA", desc: "Indian Health Care Improvement Act — comprehensive health services mandate" },
  { rule: "State Preemption", desc: "Tribal medical authority preempts state licensing restrictions on Indian trust land" },
  { rule: "ICWA Medical", desc: "Medical decisions for Indian children subject to ICWA tribal oversight" },
  { rule: "Tribal Court Order", desc: "Tribal court medical orders take precedence over state court orders for tribal members" },
];

interface MembershipData {
  membershipVerified: boolean;
  delegatedAuthorities: { medicalNotes: string; clinicalAuthority: boolean; memberType: string; allAuthorities: boolean };
  protectionLevel: string;
  identityTags: string[];
  lineageSummary: string;
  familyGroup: string;
}

export default function MedicalProviderDashboard() {
  const { toast } = useToast();

  const [noteType, setNoteType] = useState("clinical");
  const [patientName, setPatientName] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [cptCode, setCptCode] = useState("");
  const [forDependent, setForDependent] = useState(false);
  const [dependentName, setDependentName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [clinicalFindings, setClinicalFindings] = useState("");
  const [plan, setPlan] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [generatedNote, setGeneratedNote] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "authority" | "tasks">("create");

  const { data: membership, isLoading } = useQuery<MembershipData>({
    queryKey: ["membership-verify"],
    queryFn: async () => {
      const r = await fetch("/api/membership/verify", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const createNote = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/medical/notes/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          noteType, patientName: patientName || undefined, forDependent,
          dependentName: forDependent ? dependentName : undefined,
          chiefComplaint: chiefComplaint || undefined,
          clinicalFindings: clinicalFindings ? `ICD: ${icdCode || "N/A"} | CPT: ${cptCode || "N/A"}\n\n${clinicalFindings}` : undefined,
          plan: plan || undefined, noteContent: noteContent || undefined,
        }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error ?? "Failed"); }
      return r.json();
    },
    onSuccess: (data) => {
      setGeneratedNote(data.note as string);
      toast({ title: "Clinical Note Generated", description: `${MEDICAL_CENTER} — note created.` });
    },
    onError: (err) => toast({ title: "Error", description: (err as Error).message, variant: "destructive" }),
  });

  const isClinical = membership?.delegatedAuthorities?.clinicalAuthority || membership?.delegatedAuthorities?.allAuthorities;

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div data-testid="page-medical-provider" className="space-y-6">
      <div className="mb-4">
        <h1 className="text-3xl font-serif font-bold text-foreground">Medical Provider Dashboard</h1>
        <p className="text-muted-foreground mt-1">{MEDICAL_CENTER} — Tribal Medical Authority</p>
      </div>

      {/* Provider credentials header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Clinical Authority", val: isClinical, color: isClinical ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800" },
          { label: "ICD/CPT Authority", val: isClinical, color: isClinical ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800" },
          { label: "Dependent Notes", val: membership?.delegatedAuthorities?.medicalNotes === "clinical_provider" || membership?.delegatedAuthorities?.allAuthorities, color: "bg-blue-100 text-blue-800" },
          { label: "Tribal Jurisdiction", val: true, color: "bg-amber-100 text-amber-800" },
        ].map(({ label, val, color }) => (
          <Card key={label} className="text-center">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
              <Badge className={`${color} text-xs`}>{val ? "Active" : "Restricted"}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 border-b pb-0">
        {(["create", "authority", "tasks"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "create" ? "Create Note" : tab === "authority" ? "Authority Rules" : "Medical Tasks"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab === "create" && (
            <div className="space-y-6">
              {!isClinical && (
                <Card className="border-red-300 bg-red-50">
                  <CardContent className="pt-4">
                    <p className="text-red-800 font-semibold">Clinical Note Authority Required</p>
                    <p className="text-sm text-red-700 mt-1">Medical provider role required. Contact the Chief Justice & Trustee to verify credentials.</p>
                  </CardContent>
                </Card>
              )}
              <Card className={!isClinical ? "opacity-60 pointer-events-none" : ""}>
                <CardHeader>
                  <CardTitle className="text-base">Create Clinical Note — {MEDICAL_CENTER}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Note Type</Label>
                      <select value={noteType} onChange={(e) => setNoteType(e.target.value)}
                        className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                        {CLINICAL_NOTE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Patient Name</Label>
                      <Input className="mt-1" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient full name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>ICD Code <span className="text-xs text-muted-foreground">(diagnosis)</span></Label>
                      <Input className="mt-1" value={icdCode} onChange={(e) => setIcdCode(e.target.value)} placeholder="e.g. Z00.00" />
                    </div>
                    <div>
                      <Label>CPT Code <span className="text-xs text-muted-foreground">(procedure)</span></Label>
                      <Input className="mt-1" value={cptCode} onChange={(e) => setCptCode(e.target.value)} placeholder="e.g. 99213" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-md border bg-secondary/30">
                    <input type="checkbox" id="dep" className="w-4 h-4" checked={forDependent} onChange={(e) => setForDependent(e.target.checked)} />
                    <label htmlFor="dep" className="text-sm cursor-pointer">This note is for a dependent / minor in my care</label>
                  </div>
                  {forDependent && (
                    <div>
                      <Label>Dependent's Name</Label>
                      <Input className="mt-1" value={dependentName} onChange={(e) => setDependentName(e.target.value)} placeholder="Full name of the dependent or minor" />
                    </div>
                  )}
                  <div>
                    <Label>Chief Complaint</Label>
                    <Input className="mt-1" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder="Primary reason for visit or concern" />
                  </div>
                  <div>
                    <Label>Clinical Findings</Label>
                    <Textarea className="mt-1" value={clinicalFindings} onChange={(e) => setClinicalFindings(e.target.value)} placeholder="Observations, vital signs, examination findings…" rows={3} />
                  </div>
                  <div>
                    <Label>Plan / Recommendations</Label>
                    <Textarea className="mt-1" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Treatment plan, referrals, IHS referral, follow-up schedule…" rows={3} />
                  </div>
                  <div>
                    <Label>Additional Clinical Notes</Label>
                    <Textarea className="mt-1" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Social context, tribal considerations, additional clinical information…" rows={3} />
                  </div>
                  <Button onClick={() => createNote.mutate()} disabled={createNote.isPending || (!chiefComplaint && !noteContent)} className="w-full">
                    {createNote.isPending ? "Generating…" : `Generate Clinical Note — ${MEDICAL_CENTER}`}
                  </Button>
                </CardContent>
              </Card>
              {generatedNote && (
                <Card className="border-green-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-green-700">Clinical Note Generated</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs font-mono bg-muted p-4 rounded-md whitespace-pre-wrap overflow-auto max-h-96">{generatedNote}</pre>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        const blob = new Blob([generatedNote], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = `clinical-note-${Date.now()}.txt`; a.click();
                        URL.revokeObjectURL(url);
                      }}>Download Note</Button>
                      <Button size="sm" variant="outline" onClick={() => { setGeneratedNote(null); setChiefComplaint(""); setClinicalFindings(""); setPlan(""); setNoteContent(""); setPatientName(""); setIcdCode(""); setCptCode(""); }}>New Note</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "authority" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest">Tribal Medical Authority Rules</CardTitle>
                  <p className="text-xs text-muted-foreground">Federal statutes and tribal jurisdiction governing medical services for Mathias El Tribe members.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {TRIBAL_AUTHORITY_RULES.map((r) => (
                    <div key={r.rule} className="border-b last:border-0 pb-3 last:pb-0">
                      <p className="text-sm font-semibold text-foreground">{r.rule}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest">Medical Center Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">No pending medical center notifications.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "tasks" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest">Medical Center Tasks</CardTitle>
                <p className="text-xs text-muted-foreground">Pending tasks assigned to medical providers at the Mathias El Tribe Medical Center.</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No pending medical tasks.</p>
                <div className="mt-4 space-y-2">
                  {["Review pending patient history requests", "Verify medical credential with Chief Justice", "Complete IHS referral documentation"].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-sm text-muted-foreground py-2 border-b last:border-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
                      {t}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <WhatNextPanel compact />
        </div>
      </div>
    </div>
  );
}
