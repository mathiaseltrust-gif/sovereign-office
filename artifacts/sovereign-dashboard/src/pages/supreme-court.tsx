import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useListComplaints, useListFilings, useListNfrs, useListCalendarEvents } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";
import { useAuth } from "@/components/auth-provider";

const STATUTES = [
  { code: "25 U.S.C. § 1302", title: "Indian Civil Rights Act" },
  { code: "25 U.S.C. § 1901", title: "Indian Child Welfare Act" },
  { code: "28 U.S.C. § 1360", title: "State Jurisdiction Limits" },
  { code: "25 U.S.C. § 233", title: "Tribal Court Jurisdiction" },
];

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-300",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-300",
  elevated: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
  emergency: "bg-red-200 text-red-900 border-red-500",
};

interface IntakeOption {
  label: string;
  action: string;
  endpoint?: string;
  description: string;
}

interface IntakeForm {
  form_code: string;
  form_name: string;
  form_type: string;
  recommended: boolean;
}

interface QuickIntakeResult {
  summary: string;
  riskLevel: string;
  troRecommended: boolean;
  nfrRecommended: boolean;
  aiConfidence: number;
  extracted?: {
    parties: { names: string[]; agencies: string[] };
    issues: string[];
    jurisdiction: string;
    state: string;
    form_type: string;
  };
  recap?: {
    facts: string[];
    parties: string[];
    jurisdiction: { state: string; type: string; description: string };
    legal: { citation: string; title: string; relevance: string }[];
    recommended_action: string;
    protective_summary: string;
  };
  options?: IntakeOption[];
  forms?: IntakeForm[];
  recommendedActions: string[];
  recommendedInstruments: string[];
}

function QuickIntakePanel() {
  const { sessionToken } = useAuth();
  const [text, setText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [result, setResult] = useState<QuickIntakeResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStatus(`Extracting text from ${file.name}…`);
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/intake/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken ?? ""}` },
        body: form,
      });
      if (!r.ok) throw new Error("Upload failed");
      const data = await r.json() as { text: string; filename: string; page_count: number; char_count: number };
      setUploadStatus(`Extracted ${data.char_count.toLocaleString()} chars from ${data.filename} (${data.page_count} pages). Running analysis…`);
      return data.text as string;
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (intakeText: string) => {
      const r = await fetch("/api/intake/ai", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: intakeText }),
      });
      if (!r.ok) throw new Error("Analysis failed");
      return r.json() as Promise<QuickIntakeResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setUploadStatus(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadedFile(file);
    if (file) setText("");
  };

  const handleSubmit = async () => {
    setResult(null);
    if (uploadedFile) {
      const extracted = await uploadMutation.mutateAsync(uploadedFile);
      analyzeMutation.mutate(extracted);
    } else {
      analyzeMutation.mutate(text);
    }
  };

  const isLoading = uploadMutation.isPending || analyzeMutation.isPending;
  const canSubmit = !isLoading && (text.trim().length >= 10 || uploadedFile !== null);

  return (
    <Card className="border-red-200 bg-red-50/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm uppercase tracking-widest">AI Intake — Open New Matter</CardTitle>
          <Link href="/intake-ai">
            <Button size="sm" variant="ghost" className="text-xs text-primary">Full intake engine →</Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Describe the situation or upload a document. The 4-tier sovereign AI engine will extract parties, identify violations, and recommend instruments.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => { setText(e.target.value); setUploadedFile(null); }}
              placeholder="Describe the matter — parties involved, what happened, jurisdiction, child welfare concern, trust land dispute, state court action…"
              className="text-sm font-mono"
              disabled={!!uploadedFile}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
          >
            Upload PDF / Document
          </Button>
          {uploadedFile && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{uploadedFile.name}</span>
              <button
                className="text-xs text-destructive hover:underline"
                onClick={() => { setUploadedFile(null); setUploadStatus(null); if (fileRef.current) fileRef.current.value = ""; }}
              >
                Remove
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={handleFileChange} />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="ml-auto"
          >
            {isLoading ? "Analyzing…" : "Run AI Analysis"}
          </Button>
        </div>

        {uploadStatus && (
          <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">{uploadStatus}</p>
        )}

        {(uploadMutation.isError || analyzeMutation.isError) && (
          <p className="text-xs text-destructive">Analysis failed — please try again or use the full intake engine.</p>
        )}

        {isLoading && (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        )}

        {result && (
          <div className="space-y-4 pt-2 border-t">
            <div className={`rounded-lg border-2 p-3 ${RISK_COLORS[result.riskLevel] ?? "bg-muted"}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold uppercase text-sm">Risk: {result.riskLevel}</span>
                <div className="flex gap-1 flex-wrap">
                  {result.troRecommended && <Badge className="bg-red-700 text-white text-xs">TRO</Badge>}
                  {result.nfrRecommended && <Badge className="bg-orange-700 text-white text-xs">NFR</Badge>}
                  <Badge variant="outline" className="text-xs">{result.aiConfidence}% confidence</Badge>
                </div>
              </div>
              <p className="text-sm mt-1">{result.summary}</p>
            </div>

            {result.extracted && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(result.extracted.parties.names.length > 0 || result.extracted.parties.agencies.length > 0) && (
                  <div className="p-3 border rounded-md bg-background">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2">Extracted Parties</p>
                    {result.extracted.parties.names.length > 0 && (
                      <div className="mb-1">
                        <span className="text-xs text-muted-foreground">Individuals: </span>
                        <span className="text-xs">{result.extracted.parties.names.join(", ")}</span>
                      </div>
                    )}
                    {result.extracted.parties.agencies.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">Agencies: </span>
                        <span className="text-xs">{result.extracted.parties.agencies.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}

                {result.extracted.issues.length > 0 && (
                  <div className="p-3 border rounded-md bg-background">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2">Issues Identified</p>
                    <ul className="space-y-0.5">
                      {result.extracted.issues.slice(0, 5).map((issue, i) => (
                        <li key={i} className="text-xs flex items-start gap-1">
                          <span className="text-red-600 mt-0.5">⚑</span> {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result.recap && (
              <div className="space-y-3">
                {result.recap.facts.length > 0 && (
                  <div className="p-3 border rounded-md bg-background">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2">Fact Summary</p>
                    <ul className="space-y-1">
                      {result.recap.facts.slice(0, 5).map((fact, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="mt-0.5">•</span> {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 border rounded-md bg-amber-50 border-amber-200">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-amber-800">Protective Summary</p>
                  <p className="text-xs text-amber-900">{result.recap.protective_summary}</p>
                </div>

                {result.recap.jurisdiction && (
                  <div className="p-3 border rounded-md bg-background">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1">Jurisdiction</p>
                    <p className="text-xs"><span className="text-muted-foreground">Type: </span>{result.recap.jurisdiction.type}</p>
                    {result.recap.jurisdiction.state !== "Unknown" && (
                      <p className="text-xs"><span className="text-muted-foreground">State: </span>{result.recap.jurisdiction.state}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{result.recap.jurisdiction.description}</p>
                  </div>
                )}

                {result.recap.legal.length > 0 && (
                  <div className="p-3 border rounded-md bg-background">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2">Applicable Law ({result.recap.legal.length})</p>
                    <div className="space-y-1">
                      {result.recap.legal.slice(0, 4).map((ref, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs font-mono text-blue-700 shrink-0">{ref.citation}</span>
                          <span className="text-xs text-muted-foreground">{ref.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.options && result.options.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2">Recommended Actions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {result.options.slice(0, 6).map((opt, i) => (
                    opt.endpoint ? (
                      <Link key={i} href={opt.endpoint.replace("/api", "").replace("/court/nfr", "/nfr").replace("/court/welfare", "/welfare").replace("/trust/instruments", "/trust").replace("/complaints", "/complaints").replace("/documents", "/documents")}>
                        <Button size="sm" variant="outline" className="w-full text-xs text-left justify-start h-auto py-2 px-3">
                          <div>
                            <div className="font-semibold">{opt.label}</div>
                            <div className="text-muted-foreground font-normal leading-tight mt-0.5">{opt.description}</div>
                          </div>
                        </Button>
                      </Link>
                    ) : (
                      <Button key={i} size="sm" variant="outline" className="w-full text-xs text-left justify-start h-auto py-2 px-3">
                        <div>
                          <div className="font-semibold">{opt.label}</div>
                          <div className="text-muted-foreground font-normal leading-tight mt-0.5">{opt.description}</div>
                        </div>
                      </Button>
                    )
                  ))}
                </div>
              </div>
            )}

            {result.forms && result.forms.filter(f => f.recommended).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2">Recommended Forms</p>
                <div className="space-y-1">
                  {result.forms.filter(f => f.recommended).map((form, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded-md bg-background">
                      <div>
                        <span className="text-xs font-mono text-muted-foreground mr-2">{form.form_code}</span>
                        <span className="text-xs font-semibold">{form.form_name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{form.form_type}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-1">
              <Link href="/intake-ai">
                <Button size="sm" variant="default" className="text-xs">Open Full Intake Analysis</Button>
              </Link>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setResult(null); setText(""); setUploadedFile(null); setUploadStatus(null); }}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SupremeCourtPage() {
  const { data: complaints } = useListComplaints();
  const { data: filings } = useListFilings();
  const { data: nfrs } = useListNfrs();
  const { data: events } = useListCalendarEvents();

  const openComplaints = (complaints ?? []).filter((c) => c.status === "open");
  const pendingFilings = (filings ?? []).filter((f) => f.filingStatus === "pending");
  const upcomingEvents = (events ?? []).slice(0, 5);

  return (
    <div data-testid="page-supreme-court">
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-5">
            <img
              src={`${import.meta.env.BASE_URL}supreme-court-seal.png`}
              alt="The Mathias El Tribe Supreme Court"
              className="w-20 h-20 object-contain drop-shadow-md shrink-0"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Sovereign Tribal Court</p>
              <h1 className="text-3xl font-serif font-bold text-foreground">Mathias El Tribe Supreme Court</h1>
              <p className="text-muted-foreground mt-1">Office of the Chief Justice & Trustee — Full Faith and Credit</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-red-700 text-white">Tribal Court of General Jurisdiction</Badge>
            <Badge variant="outline" className="text-xs border-red-400 text-red-700">25 U.S.C. § 1302 (ICRA)</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Open Matters", value: openComplaints.length, href: "/complaints", color: "text-red-600" },
          { label: "Pending Filings", value: pendingFilings.length, href: "/filings", color: "text-amber-600" },
          { label: "NFR Documents", value: nfrs?.length ?? 0, href: "/nfr", color: "text-blue-600" },
          { label: "Court Calendar", value: upcomingEvents.length, href: "/calendar", color: "text-green-600" },
        ].map(({ label, value, href, color }) => (
          <Link key={label} href={href}>
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-serif font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          <QuickIntakePanel />

          <Card className="border-red-200 bg-red-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Court Authority & Jurisdiction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The Mathias El Tribe Supreme Court exercises exclusive sovereign jurisdiction over all matters arising under tribal law,
                trust land disputes, ICWA child welfare proceedings, member rights enforcement, and complaints against state or federal actors.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {[
                  { title: "ICWA Proceedings", desc: "Mandatory notice and intervention in all child custody matters involving enrolled members" },
                  { title: "Trust Disputes", desc: "Exclusive jurisdiction over BIA trust land, allotments, and fiduciary matters" },
                  { title: "Member Rights", desc: "Enforcement of Indian Civil Rights Act protections for all enrolled members" },
                  { title: "NFR Review", desc: "Notice of Federal Review proceedings for actions affecting tribal sovereignty" },
                ].map(({ title, desc }) => (
                  <div key={title} className="p-3 rounded-md border bg-background">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-widest">Active Matters</CardTitle>
                <Link href="/complaints">
                  <Button size="sm" variant="outline" className="text-xs">File New Matter</Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {openComplaints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open matters.</p>
                ) : openComplaints.slice(0, 5).map((c) => (
                  <Link key={c.id} href={`/complaints/${c.id}`}>
                    <div className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary">
                      <span className="text-sm truncate max-w-[180px]">{c.text?.substring(0, 50)}</span>
                      <Badge variant="destructive" className="ml-2 shrink-0 text-xs">{c.status}</Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/complaints" className="text-xs text-primary hover:underline block pt-1">All court matters →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-widest">Pending Filings</CardTitle>
                <Link href="/filings">
                  <Button size="sm" variant="outline" className="text-xs">New Filing</Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingFilings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending filings.</p>
                ) : pendingFilings.slice(0, 5).map((f) => (
                  <Link key={f.id} href={`/filings/${f.id}`}>
                    <div className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary">
                      <span className="text-sm truncate max-w-[180px]">Filing #{f.id}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 text-xs">{f.filingStatus}</Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/filings" className="text-xs text-primary hover:underline block pt-1">All filings →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest">Court Calendar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming hearings.</p>
                ) : upcomingEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm truncate max-w-[180px]">{e.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(e.date).toLocaleDateString()}</span>
                  </div>
                ))}
                <Link href="/calendar" className="text-xs text-primary hover:underline block pt-1">Full court calendar →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest">Controlling Statutes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {STATUTES.map((s) => (
                  <div key={s.code} className="py-2 border-b last:border-0">
                    <p className="text-xs font-mono text-muted-foreground">{s.code}</p>
                    <p className="text-sm">{s.title}</p>
                  </div>
                ))}
                <Link href="/law" className="text-xs text-primary hover:underline block pt-1">Full law library →</Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { href: "/complaints", label: "File Court Matter" },
                { href: "/nfr", label: "Notice of Federal Review" },
                { href: "/filings", label: "Submit Court Filing" },
                { href: "/documents", label: "Court Documents" },
                { href: "/classify", label: "Classification" },
                { href: "/law", label: "Law Library" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}>
                  <Button variant="outline" size="sm" className="w-full text-xs">{label}</Button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <WhatNextPanel compact />
        </div>
      </div>
    </div>
  );
}
