import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";

interface IntakeFilterResult {
  indianStatusViolation: boolean;
  redFlag: boolean;
  troRecommended: boolean;
  nfrRecommended: boolean;
  violations: string[];
  doctrinesTriggered: string[];
  canonicalPosture: string;
  redBannerMessage: string | null;
}

interface LawReference {
  type: "federal" | "tribal" | "doctrine";
  title: string;
  citation: string;
  excerpt: string;
  relevanceReason: string;
}

interface IntakeAgentReport {
  summary: string;
  riskLevel: "low" | "moderate" | "elevated" | "critical" | "emergency";
  intakeFlags: IntakeFilterResult;
  doctrinesApplied: string[];
  lawRefs: LawReference[];
  recommendedActions: string[];
  recommendedInstruments: string[];
  factSummary: string;
  officerNotes: string;
  nfrRecommended: boolean;
  troRecommended: boolean;
  aiConfidence: number;
  processedAt: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-300",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-300",
  elevated: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
  emergency: "bg-red-200 text-red-900 border-red-500 font-bold",
};

const LAW_TYPE_COLORS: Record<string, string> = {
  federal: "bg-blue-700",
  tribal: "bg-amber-700",
  doctrine: "bg-green-700",
};

function makeToken(user: unknown) { return btoa(JSON.stringify(user)); }

export default function IntakeAiPage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [actorType, setActorType] = useState("__all__");
  const [landStatus, setLandStatus] = useState("__all__");
  const [childInvolved, setChildInvolved] = useState("__none__");
  const [report, setReport] = useState<IntakeAgentReport | null>(null);

  const analyze = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/intake/ai", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${makeToken(user)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          context: {
            actorType: actorType !== "__all__" ? actorType : undefined,
            landStatus: landStatus !== "__all__" ? landStatus : undefined,
            childInvolved: childInvolved === "yes" ? true : childInvolved === "no" ? false : undefined,
          },
        }),
      });
      if (!r.ok) throw new Error("AI intake analysis failed");
      return r.json() as Promise<IntakeAgentReport>;
    },
    onSuccess: (data) => setReport(data),
  });

  return (
    <div data-testid="page-intake-ai">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">AI Intake Review</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered intake analysis — detects red flags, ICWA violations, jurisdictional conflicts, and TRO/NFR triggers using the Law Library
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Submit for AI Analysis</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="intake-text">Intake Text / Case Description</Label>
            <Textarea
              id="intake-text"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste complaint text, case summary, welfare request, recorder submission, or any case description for AI intake analysis…"
              className="mt-1 font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Actor Type</Label>
              <Select value={actorType} onValueChange={setActorType}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Any actor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any actor</SelectItem>
                  <SelectItem value="federal">Federal</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="tribal">Tribal</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Land Status</Label>
              <Select value={landStatus} onValueChange={setLandStatus}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Any status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any status</SelectItem>
                  <SelectItem value="trust">Trust</SelectItem>
                  <SelectItem value="allotment">Allotment</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Child Involved?</Label>
              <Select value={childInvolved} onValueChange={setChildInvolved}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Unknown" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unknown</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => analyze.mutate()}
            disabled={analyze.isPending || text.trim().length < 10}
            className="w-full"
          >
            {analyze.isPending ? "Analyzing…" : "Run AI Intake Analysis"}
          </Button>
          {analyze.isError && (
            <p className="text-sm text-destructive">Analysis failed. Please try again.</p>
          )}
        </CardContent>
      </Card>

      {analyze.isPending && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className={`rounded-lg border-2 p-4 ${RISK_COLORS[report.riskLevel]}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold uppercase">Risk Level: {report.riskLevel}</span>
                <span className="ml-3 text-sm opacity-75">Confidence: {report.aiConfidence}%</span>
              </div>
              <div className="flex gap-2">
                {report.troRecommended && <Badge className="bg-red-700 text-white">TRO Recommended</Badge>}
                {report.nfrRecommended && <Badge className="bg-orange-700 text-white">NFR Recommended</Badge>}
                {report.intakeFlags.indianStatusViolation && <Badge className="bg-red-900 text-white">Indian Status Violation</Badge>}
              </div>
            </div>
            <p className="mt-2 text-sm">{report.summary}</p>
          </div>

          {report.intakeFlags.redBannerMessage && (
            <div className="rounded-lg border border-red-400 bg-red-50 p-4">
              <p className="text-red-800 font-semibold text-sm">{report.intakeFlags.redBannerMessage}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Violations Detected</CardTitle></CardHeader>
              <CardContent>
                {report.intakeFlags.violations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No violations detected.</p>
                ) : (
                  <ul className="space-y-1">
                    {report.intakeFlags.violations.map((v, i) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-1">
                        <span className="mt-0.5">⚑</span> {v}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Officer Notes</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">{report.officerNotes}</pre>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recommended Actions</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-1 list-decimal list-inside">
                {report.recommendedActions.map((a, i) => (
                  <li key={i} className="text-sm">{a}</li>
                ))}
              </ol>
              {report.recommendedInstruments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">Instruments:</span>
                  {report.recommendedInstruments.map((inst) => (
                    <Badge key={inst} variant="outline" className="text-xs">{inst}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Applicable Law References ({report.lawRefs.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.lawRefs.map((ref, i) => (
                  <div key={i} className="border rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${LAW_TYPE_COLORS[ref.type]} text-white text-xs`}>{ref.type}</Badge>
                      <span className="font-semibold text-sm">{ref.title}</span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{ref.citation}</p>
                    <p className="text-xs mt-1 text-muted-foreground">{ref.relevanceReason}</p>
                    <p className="text-xs mt-1 text-foreground border-l-2 border-muted pl-2">{ref.excerpt}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Doctrines Applied ({report.doctrinesApplied.length})</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {report.doctrinesApplied.map((d, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span>•</span> {d}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Fact Summary</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{report.factSummary}</pre>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Analysis completed: {new Date(report.processedAt).toLocaleString()} · AI Confidence: {report.aiConfidence}%
          </p>
        </div>
      )}
    </div>
  );
}
