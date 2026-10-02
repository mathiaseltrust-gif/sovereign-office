import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth, roleLandingPath, getCurrentBearerToken } from "@/components/auth-provider";
import { SovereignIntakeGuard } from "@/components/SovereignIntakeGuard";

interface MatchResult {
  matchType: "exact" | "family_name" | "parent_only" | "none";
  matchedNodeId: number | null;
  membershipStatus: "verified" | "pending";
  protectionLevel: "descendant" | "pending";
  inheritedFlags: {
    icwaEligible: boolean;
    welfareEligible: boolean;
    trustBeneficiary: boolean;
  };
}

export default function OnboardingLineagePage() {
  const [, setLocation] = useLocation();
  const { activeRole, setFirstLoginFlag, setLineagePendingFlag } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [parentName, setParentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [guardCleared, setGuardCleared] = useState(false);

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const apiBase = base.replace(/\/sovereign-dashboard$/, "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !familyName.trim()) {
      toast({ title: "Required fields missing", description: "Please enter your full legal name and family/clan name.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/lineage/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCurrentBearerToken()}`,
        },
        body: JSON.stringify({ fullName: fullName.trim(), familyName: familyName.trim(), parentName: parentName.trim() || undefined }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Lineage match failed.");
      }

      const data = await res.json() as MatchResult;
      setFirstLoginFlag(false);
      if (data.membershipStatus === "pending") {
        setLineagePendingFlag(true);
      }
      setResult(data);
    } catch (err) {
      toast({ title: "Something went wrong", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (result?.membershipStatus === "pending") {
      setLocation("/onboarding/pending");
    } else {
      setLocation(roleLandingPath(activeRole));
    }
  }

  if (result) {
    const candidateFound = result.matchType !== "none";
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="text-4xl mb-3">⏳</div>
            <CardTitle className="text-xl font-serif">
              {candidateFound ? "Lineage Match Found — Review Required" : "Lineage Submitted for Review"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {candidateFound
                ? "The Office found a possible match in the lineage record. The match has been routed for human review before membership status is changed."
                : "No automatic match was confirmed. Your information has been routed for human lineage review."}
            </p>
            {(result.inheritedFlags.icwaEligible || result.inheritedFlags.welfareEligible || result.inheritedFlags.trustBeneficiary) && (
              <div className="bg-muted rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Record Flags for Reviewer
                </p>
                {result.inheritedFlags.icwaEligible && <p className="text-sm">• ICWA-related lineage flag present</p>}
                {result.inheritedFlags.welfareEligible && <p className="text-sm">• Welfare-related lineage flag present</p>}
                {result.inheritedFlags.trustBeneficiary && <p className="text-sm">• Trust-beneficiary lineage flag present</p>}
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Automated matching is a routing aid only. Membership verification and any external legal or program eligibility are determined separately through the applicable review process.
            </p>
            <Button className="w-full" onClick={handleContinue}>
              View Pending Status
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-lg w-full space-y-4">
      {!guardCleared && (
        <SovereignIntakeGuard
          intakeType="lineage"
          onClear={() => setGuardCleared(true)}
        />
      )}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl font-serif">Lineage Verification</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Provide your name information so the Office can compare it with existing family-lineage records.
            A possible match is routed for human review before membership status is changed.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Legal Name <span className="text-destructive">*</span></Label>
              <Input
                id="fullName"
                placeholder="e.g. Mary Jane Running Bear"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Enter your name exactly as it appears on legal documents.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="familyName">Family / Clan Name <span className="text-destructive">*</span></Label>
              <Input
                id="familyName"
                placeholder="e.g. Running Bear"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Your family surname or clan name.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentName">Parent's Full Name <span className="text-muted-foreground text-xs">(optional but recommended)</span></Label>
              <Input
                id="parentName"
                placeholder="e.g. John Running Bear"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Providing a parent's name improves matching accuracy.</p>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Checking lineage records…" : "Submit for Lineage Review"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Your information is used solely to verify your lineage against tribal records.
            Date of birth is not required or collected.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
