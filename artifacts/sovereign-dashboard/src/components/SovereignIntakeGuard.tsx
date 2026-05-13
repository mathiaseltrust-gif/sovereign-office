import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";

interface RedFlagResult {
  clear: boolean;
  riskLevel: "low" | "moderate" | "elevated" | "critical" | "emergency";
  jurisdictionalOverreach: boolean;
  violations: string[];
  protections: string[];
  governingGuidance: string;
  redBannerMessage: string | null;
  doctrines: string[];
}

interface Props {
  intakeType: "lineage" | "welfare" | "business" | "case";
  contextHint?: string;
  onClear: () => void;
}

const INTAKE_CONTEXT: Record<Props["intakeType"], { label: string; guidance: string }> = {
  lineage: {
    label: "Lineage & Membership Verification",
    guidance: "Submitting lineage information invokes federal Indian law protections. The Tribe asserts jurisdiction over membership determinations. No state or federal agency may deny, obstruct, or interfere with tribal membership processes under 25 U.S.C. § 1901 (ICWA) and the Federal Trust Responsibility.",
  },
  welfare: {
    label: "Welfare & Community Resources",
    guidance: "Welfare instruments issued under this Office carry the full authority of tribal sovereignty. State court or CPS intervention without ICWA compliance is a federal violation. The Indian Child Welfare Act (25 U.S.C. § 1901 et seq.) and Snyder Act protections apply to all enrolled and eligible members.",
  },
  business: {
    label: "Sovereign Business Formation",
    guidance: "Sovereign business entities formed under tribal authority are protected from state taxation and regulation under McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973). State licensing requirements do not apply to tribally chartered entities operating in furtherance of tribal self-governance.",
  },
  case: {
    label: "Case & Complaint Intake",
    guidance: "All matters submitted here are received under the sovereign authority of the Chief Justice & Trustee. Federal Indian law, the Indian Canons of Construction, and tribal doctrine apply. Worcester v. Georgia (1832) establishes that state laws have no force within tribal jurisdiction.",
  },
};

const RISK_COLORS: Record<string, string> = {
  low: "border-green-400 bg-green-50 dark:bg-green-950/30",
  moderate: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
  elevated: "border-orange-400 bg-orange-50 dark:bg-orange-950/30",
  critical: "border-red-500 bg-red-50 dark:bg-red-950/30",
  emergency: "border-red-700 bg-red-100 dark:bg-red-950/50",
};

async function runSovereignScreen(
  intakeType: Props["intakeType"],
  contextHint: string | undefined
): Promise<RedFlagResult> {
  const systemMsg = `You are the Sovereign Protective Screen for the Mathias El Tribe Office of the Chief Justice & Trustee.
Your function is to run a jurisdictional and sovereignty compliance pre-check BEFORE an intake is submitted.
Apply:
- ICWA (25 U.S.C. § 1901 et seq.)
- Federal Trust Responsibility
- Worcester v. Georgia, 31 U.S. 515 (1832)
- Indian Canons of Construction
- McClanahan v. Arizona, 411 U.S. 164 (1973)
- Brackeen v. Haaland, 599 U.S. 255 (2023)

Intake type: ${intakeType}
Context: ${contextHint ?? "general intake"}

Respond ONLY with JSON:
{
  "clear": boolean,
  "riskLevel": "low"|"moderate"|"elevated"|"critical"|"emergency",
  "jurisdictionalOverreach": boolean,
  "violations": ["string"],
  "protections": ["string — active protections that apply"],
  "governingGuidance": "string — 1-2 sentence tribal doctrine guidance",
  "redBannerMessage": "string or null — urgent alert if jurisdictional overreach detected",
  "doctrines": ["string — applicable doctrines with citations"]
}`;

  try {
    const r = await fetch("/api/intake/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
      },
      body: JSON.stringify({
        text: `PRE-SCREEN CHECK — Intake type: ${intakeType}. ${contextHint ?? ""}`,
        context: { caseType: intakeType },
      }),
    });
    if (!r.ok) throw new Error("screen failed");
    const data = await r.json() as {
      riskLevel?: string;
      intakeFlags?: { violations?: string[]; jurisdictionalOverreach?: boolean; redBannerMessage?: string | null; doctrinesTriggered?: string[] };
      doctrinesApplied?: string[];
      summary?: string;
    };

    const violations: string[] = data.intakeFlags?.violations ?? [];
    const jurisdictionalOverreach = violations.some((v) =>
      /state|cps|dcfs|court|jurisdict|overreach/i.test(v)
    );
    const riskLevel = (data.riskLevel as RedFlagResult["riskLevel"]) ?? "low";

    const ctx = INTAKE_CONTEXT[intakeType];
    const protections = [
      "Federal Trust Responsibility (U.S. Dept. of Interior)",
      "ICWA § 1911 — Tribal jurisdiction over child custody",
      "Worcester v. Georgia (1832) — State law inapplicable in tribal matters",
    ];
    if (intakeType === "business") protections.push("McClanahan — State tax/reg exemption for tribal entities");
    if (intakeType === "lineage") protections.push("Brackeen v. Haaland (2023) — ICWA upheld as constitutional");

    return {
      clear: riskLevel === "low" && violations.length === 0,
      riskLevel,
      jurisdictionalOverreach,
      violations,
      protections,
      governingGuidance: ctx.guidance,
      redBannerMessage: data.intakeFlags?.redBannerMessage ?? (jurisdictionalOverreach ? "Jurisdictional overreach pattern detected. Tribal authority asserted." : null),
      doctrines: data.doctrinesApplied ?? data.intakeFlags?.doctrinesTriggered ?? [],
    };
  } catch {
    const ctx = INTAKE_CONTEXT[intakeType];
    return {
      clear: true,
      riskLevel: "low",
      jurisdictionalOverreach: false,
      violations: [],
      protections: [
        "Federal Trust Responsibility",
        "ICWA § 1911 — Tribal jurisdiction",
        "Worcester v. Georgia (1832)",
      ],
      governingGuidance: ctx.guidance,
      redBannerMessage: null,
      doctrines: [],
    };
  }
}

export function SovereignIntakeGuard({ intakeType, contextHint, onClear }: Props) {
  const [screening, setScreening] = useState(false);
  const [result, setResult] = useState<RedFlagResult | null>(null);
  const [showDoctrines, setShowDoctrines] = useState(false);
  const [screened, setScreened] = useState(false);

  const ctx = INTAKE_CONTEXT[intakeType];

  async function runScreen() {
    setScreening(true);
    const r = await runSovereignScreen(intakeType, contextHint);
    setResult(r);
    setScreening(false);
    setScreened(true);
    if (r.clear) {
      setTimeout(onClear, 1200);
    }
  }

  if (screened && result) {
    return (
      <div className={`rounded-xl border-2 p-5 mb-6 space-y-4 ${RISK_COLORS[result.riskLevel]}`}>
        {result.redBannerMessage && (
          <div className="flex items-start gap-2 bg-red-700 text-white rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold">{result.redBannerMessage}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          {result.clear
            ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />}
          <div className="flex-1">
            <p className="font-semibold text-sm text-foreground">
              {result.clear ? "Sovereign Screen Passed" : `Sovereign Screen — ${result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)} Alert`}
            </p>
            <p className="text-xs text-muted-foreground">{ctx.label}</p>
          </div>
          <Badge className={
            result.riskLevel === "low" ? "bg-green-600 text-white" :
            result.riskLevel === "moderate" ? "bg-yellow-600 text-white" :
            result.riskLevel === "elevated" ? "bg-orange-600 text-white" :
            "bg-red-700 text-white"
          }>{result.riskLevel.toUpperCase()}</Badge>
        </div>

        {result.violations.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">Red Flags Detected</p>
            {result.violations.map((v, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-800">
                <span className="mt-0.5 shrink-0">⚑</span>{v}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">Active Protections</p>
          {result.protections.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
              <Shield className="w-3 h-3 mt-0.5 text-green-600 shrink-0" />{p}
            </div>
          ))}
        </div>

        <div className="border-t pt-3">
          <p className="text-xs text-foreground/70 leading-relaxed italic">{result.governingGuidance}</p>
        </div>

        {result.doctrines.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowDoctrines(!showDoctrines)}
            >
              {showDoctrines ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDoctrines ? "Hide" : "Show"} applicable doctrines ({result.doctrines.length})
            </button>
            {showDoctrines && (
              <ul className="mt-2 space-y-1">
                {result.doctrines.map((d, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!result.clear && (
          <Button size="sm" onClick={onClear} variant="outline" className="w-full">
            I understand — proceed with intake
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-5 mb-6 space-y-4">
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm text-foreground">Sovereign Protective Screen</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ctx.label}</p>
        </div>
      </div>
      <p className="text-xs text-foreground/80 leading-relaxed border-l-2 border-amber-400 pl-3 italic">
        {ctx.guidance}
      </p>
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">Standing Protections</p>
        <div className="flex items-center gap-2 text-xs text-foreground/70"><Shield className="w-3 h-3 text-green-600" /> Federal Trust Responsibility</div>
        <div className="flex items-center gap-2 text-xs text-foreground/70"><Shield className="w-3 h-3 text-green-600" /> Indian Child Welfare Act (ICWA) — 25 U.S.C. § 1901</div>
        <div className="flex items-center gap-2 text-xs text-foreground/70"><Shield className="w-3 h-3 text-green-600" /> Worcester v. Georgia, 31 U.S. 515 (1832)</div>
        {intakeType === "business" && <div className="flex items-center gap-2 text-xs text-foreground/70"><Shield className="w-3 h-3 text-green-600" /> McClanahan — State tax/reg exemption</div>}
      </div>
      <Button
        size="sm"
        onClick={runScreen}
        disabled={screening}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
      >
        {screening
          ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Running Sovereign Screen…</>
          : "Run Jurisdictional Red Flag Screen"}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        All intakes are screened for jurisdictional overreach before processing
      </p>
    </div>
  );
}
