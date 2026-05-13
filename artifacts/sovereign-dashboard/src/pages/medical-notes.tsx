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

const NOTE_TYPES = [
  { value: "general", label: "General Visit Note" },
  { value: "wellness", label: "Wellness Check" },
  { value: "emergency", label: "Emergency Visit" },
  { value: "follow_up", label: "Follow-Up Note" },
  { value: "referral", label: "Referral Note" },
  { value: "prescription", label: "Prescription Record" },
  { value: "diagnostic", label: "Diagnostic Report" },
  { value: "mental_health", label: "Mental Health Note" },
];

const PROTECTION_STYLES: Record<string, string> = {
  standard: "bg-green-100 text-green-800",
  elevated: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

interface MembershipData {
  membershipVerified: boolean;
  delegatedAuthorities: { medicalNotes: string; memberType: string; allAuthorities: boolean };
  protectionLevel: string;
  identityTags: string[];
  lineageSummary: string;
  familyGroup: string;
  message?: string;
}

export default function MedicalNotesPage() {
  const { toast } = useToast();

  const [noteType, setNoteType] = useState("general");
  const [patientName, setPatientName] = useState("");
  const [forDependent, setForDependent] = useState(false);
  const [dependentName, setDependentName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [clinicalFindings, setClinicalFindings] = useState("");
  const [plan, setPlan] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [generatedNote, setGeneratedNote] = useState<string | null>(null);
  const [generatedMeta, setGeneratedMeta] = useState<Record<string, unknown> | null>(null);

  const { data: membership, isLoading: membershipLoading } = useQuery<MembershipData>({
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
          noteType,
          patientName: patientName || undefined,
          forDependent,
          dependentName: forDependent ? dependentName : undefined,
          chiefComplaint: chiefComplaint || undefined,
          clinicalFindings: clinicalFindings || undefined,
          plan: plan || undefined,
          noteContent: noteContent || undefined,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to generate note");
      }
      return r.json();
    },
    onSuccess: (data) => {
      setGeneratedNote(data.note as string);
      setGeneratedMeta(data as Record<string, unknown>);
      toast({ title: "Medical Note Generated", description: `${MEDICAL_CENTER} — note created successfully.` });
    },
    onError: (err) => {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    },
  });

  const canCreate = membership?.delegatedAuthorities?.medicalNotes !== "none";
  const canCreateForDependents = membership?.delegatedAuthorities?.medicalNotes === "self_and_dependents" || membership?.delegatedAuthorities?.allAuthorities;

  if (membershipLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div data-testid="page-medical-notes">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Medical Notes</h1>
        <p className="text-muted-foreground mt-1">{MEDICAL_CENTER} — Office of the Chief Justice & Trustee</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {!canCreate && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="pt-4">
                <p className="text-red-800 font-semibold">Medical Note Authority Required</p>
                <p className="text-sm text-red-700 mt-1">
                  You must complete membership verification and have lineage records confirmed to generate medical notes.
                  Visit Family Tree &amp; Lineage to import your lineage records.
                </p>
              </CardContent>
            </Card>
          )}

          {membership && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Identity Context</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={PROTECTION_STYLES[membership.protectionLevel] ?? ""}>
                      {membership.protectionLevel?.toUpperCase()} Protection
                    </Badge>
                    <Badge variant={membership.membershipVerified ? "default" : "secondary"} className="text-xs">
                      {membership.membershipVerified ? "Membership Verified" : "Unverified"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{membership.lineageSummary}</p>
                {membership.identityTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {membership.identityTags.slice(0, 6).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className={!canCreate ? "opacity-60 pointer-events-none" : ""}>
            <CardHeader>
              <CardTitle className="text-base">Generate Medical Note — {MEDICAL_CENTER}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Note Type</Label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value)}
                    className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground"
                  >
                    {NOTE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Patient Name <span className="text-xs text-muted-foreground">(leave blank to use your legal name)</span></Label>
                  <Input
                    className="mt-1"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Patient full name"
                  />
                </div>
              </div>

              {canCreateForDependents && (
                <div className="flex items-center gap-3 p-3 rounded-md border bg-secondary/30">
                  <input
                    type="checkbox"
                    id="for-dependent"
                    className="w-4 h-4"
                    checked={forDependent}
                    onChange={(e) => setForDependent(e.target.checked)}
                  />
                  <label htmlFor="for-dependent" className="text-sm cursor-pointer">
                    This note is for a dependent / minor in my care
                  </label>
                </div>
              )}

              {forDependent && (
                <div>
                  <Label>Dependent's Name <span className="text-destructive">*</span></Label>
                  <Input
                    className="mt-1"
                    value={dependentName}
                    onChange={(e) => setDependentName(e.target.value)}
                    placeholder="Full name of the dependent or minor"
                  />
                </div>
              )}

              <div>
                <Label>Chief Complaint</Label>
                <Input
                  className="mt-1"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Primary reason for visit or concern"
                />
              </div>

              <div>
                <Label>Clinical Findings</Label>
                <Textarea
                  className="mt-1"
                  value={clinicalFindings}
                  onChange={(e) => setClinicalFindings(e.target.value)}
                  placeholder="Observations, vital signs, examination findings…"
                  rows={3}
                />
              </div>

              <div>
                <Label>Plan / Recommendations</Label>
                <Textarea
                  className="mt-1"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder="Treatment plan, referrals, follow-up schedule…"
                  rows={3}
                />
              </div>

              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  className="mt-1"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Any additional clinical information, social context, or notes…"
                  rows={3}
                />
              </div>

              <Button
                onClick={() => createNote.mutate()}
                disabled={createNote.isPending || (!chiefComplaint && !noteContent)}
                className="w-full"
              >
                {createNote.isPending ? "Generating…" : `Generate Medical Note — ${MEDICAL_CENTER}`}
              </Button>
            </CardContent>
          </Card>

          {generatedNote && generatedMeta && (
            <div className="space-y-4">
              <Card className="border-green-300">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base text-green-700">Note Generated</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="text-xs">{(generatedMeta.noteType as string)?.replace(/_/g, " ").toUpperCase()}</Badge>
                      <Badge className={`${PROTECTION_STYLES[(generatedMeta.protectionLevel as string)] ?? ""} text-xs`}>
                        {(generatedMeta.protectionLevel as string)?.toUpperCase()} Protection
                      </Badge>
                      {!!generatedMeta.icwaEligible && (
                        <Badge className="bg-blue-700 text-white text-xs">ICWA</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono bg-muted p-4 rounded-md whitespace-pre-wrap overflow-auto max-h-[500px]">
                    {generatedNote}
                  </pre>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([generatedNote], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `medical-note-${Date.now()}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download Note
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setGeneratedNote(null);
                        setGeneratedMeta(null);
                        setChiefComplaint("");
                        setClinicalFindings("");
                        setPlan("");
                        setNoteContent("");
                        setPatientName("");
                        setDependentName("");
                        setForDependent(false);
                      }}
                    >
                      New Note
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {!!generatedMeta.whatNext && (() => {
                const wn = generatedMeta.whatNext as { immediate: string[]; next: string[]; protected: string[] };
                return wn.immediate.length + wn.next.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">What Now / What Next</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {wn.immediate.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Immediate</p>
                          <ul className="space-y-1">
                            {wn.immediate.map((s, i) => <li key={i} className="text-sm flex gap-2"><span className="text-primary">→</span>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {wn.next.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Next Steps</p>
                          <ul className="space-y-1">
                            {wn.next.map((s, i) => <li key={i} className="text-sm flex gap-2 text-muted-foreground"><span>•</span>{s}</li>)}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null;
              })()}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <WhatNextPanel compact />
        </div>
      </div>
    </div>
  );
}
