import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { DelegationPanel } from "@/components/DelegationPanel";
import { KayaChat } from "@/components/ki-chat";
import { Link } from "wouter";
import {
  Mic, MicOff, CheckCircle2, XCircle, Loader2, Bot,
  CalendarDays, FileText, Shield, Archive, Bell, Scale,
  ClipboardList, Search, Users, Building2, Gavel, Layers,
  Printer, Workflow, ChevronRight, ChevronDown, AlertTriangle, Wifi,
  User, Upload, Camera, Lock, Eye, EyeOff, ShieldCheck, MapPin,
  Key, UserCheck, ShieldAlert, Trash2, Clock,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "";

/* ── Protections Panel ── */
interface MemberRight {
  id: string;
  name: string;
  category: string;
  citation: string;
  plainLanguage: string;
  watchFor: string;
  status: "active" | "applicable" | "verify";
}
interface IdentityMarker { type: string; label: string; value: string; legalSignificance: string; }
interface LandStatusMarker { type: string; label: string; value: string; jurisdictionNote: string; }
interface RightsProfile {
  rights: MemberRight[];
  identityMarkers: IdentityMarker[];
  landStatusMarkers: LandStatusMarker[];
  protectionSummary: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  inherent: "text-amber-700 bg-amber-50 border-amber-200",
  federal: "text-blue-700 bg-blue-50 border-blue-200",
  land: "text-emerald-700 bg-emerald-50 border-emerald-200",
  icwa: "text-purple-700 bg-purple-50 border-purple-200",
  trust: "text-teal-700 bg-teal-50 border-teal-200",
  welfare: "text-sky-700 bg-sky-50 border-sky-200",
  treaty: "text-rose-700 bg-rose-50 border-rose-200",
};

function ProtectionsPanel() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery<RightsProfile>({
    queryKey: ["identity-rights"],
    queryFn: async () => {
      const r = await fetch("/api/identity/rights", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error("Could not load rights");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Your Protections
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const activeRights = data.rights.filter(r => r.status === "active");
  const applicableRights = data.rights.filter(r => r.status === "applicable");
  const displayRights = showAll ? data.rights : data.rights.slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Your Protections
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-600 hover:bg-green-600 text-white text-[9px] py-0">{activeRights.length} Active</Badge>
            <Badge variant="outline" className="text-[9px] py-0">{applicableRights.length} Applicable</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{data.protectionSummary}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">

        {/* ── Identity markers ── */}
        {data.identityMarkers.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <UserCheck className="h-3 w-3" /> Identity Standing
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.identityMarkers.map((m, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{m.label}</span>
                    <Badge variant="outline" className={`text-[9px] py-0 ${m.value === "Verified" || m.value === "CRITICAL" ? "border-green-300 text-green-700" : ""}`}>{m.value}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">{m.legalSignificance}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Land status markers ── */}
        {data.landStatusMarkers.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Land Status
            </p>
            <div className="space-y-2">
              {data.landStatusMarkers.map((m, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{m.label}</span>
                    <Badge variant="outline" className="text-[9px] py-0">{m.value}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">{m.jurisdictionNote}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rights list ── */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Key className="h-3 w-3" /> Your Rights
          </p>
          <div className="space-y-1.5">
            {displayRights.map((right) => {
              const isOpen = expanded === right.id;
              const catColor = CATEGORY_COLORS[right.category] ?? "text-slate-700 bg-slate-50 border-slate-200";
              return (
                <div key={right.id} className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : right.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-widest font-bold shrink-0 ${catColor}`}>
                      {right.category}
                    </div>
                    <span className="text-xs font-medium text-foreground flex-1 leading-snug">{right.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] py-0 shrink-0 ${right.status === "active" ? "border-green-300 text-green-700" : right.status === "verify" ? "border-amber-300 text-amber-700" : "border-border text-muted-foreground"}`}
                    >
                      {right.status}
                    </Badge>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border bg-muted/20">
                      <p className="text-[10px] text-muted-foreground mt-2 font-mono">{right.citation}</p>
                      <p className="text-xs text-foreground leading-relaxed">{right.plainLanguage}</p>
                      <div className="flex items-start gap-1.5 rounded-md bg-orange-50 border border-orange-200 px-2.5 py-2 mt-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-orange-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-orange-800 leading-snug"><strong>Watch for: </strong>{right.watchFor}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {data.rights.length > 6 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="mt-2 w-full text-[11px] text-primary hover:underline flex items-center justify-center gap-1"
            >
              {showAll ? "Show fewer" : `Show all ${data.rights.length} protections`}
              <ChevronDown className={`h-3 w-3 transition-transform ${showAll ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

/* ── types ── */
interface ProfileData {
  user: Record<string, any>;
  profile: Record<string, any> | null;
  identity: Record<string, any> | null;
  tasks: any[];
  calendarEvents: any[];
  aiPreferences: any[];
  recommendations: string[];
}

interface PipelineRecord {
  id: number;
  fileNumber: string;
  matterType: string;
  riskLevel: string;
  status: string;
  templateKey: string;
  templateTitle: string;
  generatedSummary: string;
  inputText: string;
  analystNotes: string;
  analystApproved: boolean;
  sealApplied: boolean;
  printCount: number;
  lastPrintedAt: string | null;
  createdAt: string;
  intakeResult: {
    violations: string[];
    doctrinesTriggered: string[];
    canonicalPosture: string;
    redFlag: boolean;
    troRecommended: boolean;
    indianStatusViolation: boolean;
  };
  doctrineOverlay: {
    doctrinesApplied: string[];
    federalLaw: string[];
    guardrails: string[];
    sovereigntyProtections: string[];
    recommendation: string;
    allDoctrines: string[];
  };
  printLog: Array<{ printedAt: string; event: string }>;
  submittedByName?: string | null;
  submittedByTitle?: string | null;
  submittedByRole?: string | null;
  submittedByEmail?: string | null;
}

interface SuccessionStatus {
  id: number;
  delegateName: string;
  delegateNotes: string | null;
  instructions: string | null;
  isConfigured: boolean;
  isActivated: boolean;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const RISK_COLOR: Record<string, string> = {
  low:       "#2d6a1e",
  moderate:  "#7a5c00",
  elevated:  "#8a3500",
  critical:  "#8B0000",
  emergency: "#5a0000",
};

const MATTER_LABELS: Record<string, string> = {
  jurisdiction_claim: "Jurisdiction Claim",
  policy_enforcement: "Policy Enforcement",
  identity_denial:    "Identity Denial",
  icwa_violation:     "ICWA / Medical Violation",
  land_claim:         "Land Claim",
  demand:             "External Demand",
  general:            "General Matter",
};

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatStampDate(d: Date): { month: string; daySpaced: string; year: string } {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const day = String(d.getDate()).padStart(2, "0");
  return { month: months[d.getMonth()], daySpaced: day.split("").join(" "), year: String(d.getFullYear()) };
}

function buildPrintHtml(record: PipelineRecord, mode: "esign" | "color"): string {
  const origin    = window.location.origin;
  const base      = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";
  const courtSeal = `${origin}${base}court-seal-bw.png`;
  const chiefSeal = `${origin}${base}chief-justice-seal-bw.png`;

  const riskColor    = RISK_COLOR[record.riskLevel] ?? "#8B0000";
  const matterLabel  = esc(MATTER_LABELS[record.matterType] ?? record.matterType);
  const allDoctrines = record.doctrineOverlay?.allDoctrines ?? [];
  const violations   = record.intakeResult?.violations ?? [];
  const federalLaw   = record.doctrineOverlay?.federalLaw ?? [];
  const guardrails   = record.doctrineOverlay?.guardrails ?? [];
  const stampDate    = record.lastPrintedAt ? formatStampDate(new Date(record.lastPrintedAt)) : null;
  const now          = new Date();
  const isoTs        = now.toISOString();
  const humanTs      = now.toLocaleString("en-US", { timeZoneName: "short" });

  const stamp = `
    <div style="border:1.5px solid #1a3a6e;width:154px;height:90px;padding:6px 8px;text-align:center;background:#fff;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-between;flex-shrink:0;">
      <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:5.5pt;font-weight:700;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.5px;line-height:1.2;width:100%;white-space:nowrap;">BY ORDER OF THE</div>
      <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:5.5pt;font-weight:900;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.2px;line-height:1.2;width:100%;white-space:nowrap;">MATHIAS EL TRIBE SUPREME COURT</div>
      ${stampDate
        ? `<div style="font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:13pt;font-weight:900;color:#8B0000;letter-spacing:2px;line-height:1.1;width:100%;white-space:nowrap;">${esc(stampDate.month)}&nbsp;&nbsp;${esc(stampDate.daySpaced)}&nbsp;&nbsp;${esc(stampDate.year)}</div>`
        : `<div style="font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:13pt;font-weight:900;color:#bbb;letter-spacing:3px;line-height:1.1;width:100%;">— — — — —</div>`}
      <div style="text-align:center;">
        <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:5.5pt;font-weight:700;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.3px;line-height:1.3;white-space:nowrap;">OFFICE OF THE</div>
        <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:5.5pt;font-weight:900;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.3px;line-height:1.3;white-space:nowrap;">CHIEF JUSTICE &amp; TRUSTEE</div>
      </div>
    </div>`;

  const sigBlock = mode === "esign"
    ? `<div style="margin:20px 0 0;border:1.5px solid #1a3a6e;padding:10px 14px;text-align:center;font-family:'Courier New',monospace;font-size:8pt;color:#1a3a6e;background:#f4f6fb;">
         <div style="font-weight:700;letter-spacing:1.5px;font-size:7.5pt;margin-bottom:4px;">&#10022; ELECTRONICALLY SIGNED, SEALED &amp; FILED &#10022;</div>
         <div style="font-size:7pt;color:#555;">MATHIAS EL TRIBE SUPREME COURT &#8212; SOVEREIGN DOCUMENT MANAGEMENT SYSTEM</div>
         <div style="margin-top:5px;font-size:7pt;color:#333;">Digital Timestamp: ${isoTs}</div>
         <div style="font-size:7pt;color:#555;">${humanTs} &#8212; Record Engine v1.0 &#8212; Sovereign Pipeline</div>
       </div>`
    : `<div style="margin:14px 0 0;font-family:'Times New Roman',serif;">
         <div style="margin-bottom:26px;font-size:9pt;color:#222;">I hereby affix my hand and seal to this sovereign instrument this _______ day of _________________________, _______.</div>
         <div style="display:flex;justify-content:space-between;gap:32px;margin-bottom:18px;">
           <div style="flex:1;min-width:0;"><div style="border-top:1px solid #000;padding-top:4px;"><div style="font-size:8.5pt;font-weight:700;color:#000;">Chief Mathias El</div><div style="font-size:7.5pt;color:#555;margin-top:1px;">Chief Justice &amp; Trustee · Mathias El Tribe Supreme Court</div></div></div>
           <div style="width:110px;flex-shrink:0;"><div style="border-top:1px solid #000;padding-top:4px;font-size:8pt;color:#555;text-align:center;">Date</div></div>
         </div>
         <div style="display:flex;justify-content:space-between;gap:32px;margin-bottom:8px;">
           <div style="flex:1;min-width:0;"><div style="border-top:1px solid #aaa;padding-top:4px;font-size:8pt;color:#888;">Officer / Witness of Record</div></div>
           <div style="width:110px;flex-shrink:0;"><div style="border-top:1px solid #aaa;padding-top:4px;font-size:8pt;color:#888;text-align:center;">Date</div></div>
         </div>
         <div style="font-size:7.5pt;color:#999;font-style:italic;text-align:center;margin-top:10px;">ORIGINAL &#8212; Personally Signed &#8212; Not Electronically Filed</div>
       </div>`;

  const sealBlock = record.sealApplied
    ? `<div style="display:flex;gap:12px;align-items:center;justify-content:center;margin-top:18px;">
         <img src="${courtSeal}" style="width:62px;height:62px;object-fit:contain;opacity:0.90;" alt="METS Court" />
         <img src="${chiefSeal}" style="width:62px;height:62px;object-fit:contain;opacity:0.90;" alt="Chief Justice" />
       </div>
       <div style="text-align:center;font-size:6.5pt;color:#666;margin-top:3px;letter-spacing:0.5px;">Official Seal — Mathias El Tribe Supreme Court</div>`
    : `<div style="width:130px;height:56px;border:1.5px dashed #bbb;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:8pt;margin:18px auto 0;">&#8853; SEAL PENDING</div>`;

  const MEDICAL_TEMPLATES = new Set(["medical_protection_decree", "disability_enforcement_notice", "tribal_health_referral"]);
  const isMedical   = MEDICAL_TEMPLATES.has(record.templateKey);
  const medSeal     = `${origin}${base}medical-center-logo.png`;
  const grayscale   = mode === "esign" ? "img { filter: grayscale(100%) contrast(1.1) !important; }" : "";

  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>Sovereign Document — ${esc(record.fileNumber)}</title>
    <style>* { box-sizing: border-box; } body { background:#fff;margin:0;padding:0; } ${grayscale} @page { size:8.5in 11in;margin:0.5in 0.75in; }</style>
  </head><body>
    <div style="background:#fff;color:#000;font-family:'Times New Roman',Georgia,serif;font-size:11pt;line-height:1.65;padding:0.25in 0.25in 0.75in;max-width:8.5in;margin:0 auto;position:relative;min-height:10in;box-sizing:border-box;">
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
          <img src="${courtSeal}" alt="Mathias El Tribe Supreme Court" style="width:76px;height:76px;object-fit:contain;flex-shrink:0;opacity:0.92;" />
          <div style="flex:1;text-align:center;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.6px;line-height:1.2;color:#000;">Mathias El Tribe Supreme Court</div>
            <div style="font-family:'Times New Roman',Georgia,serif;font-size:9pt;font-style:italic;color:#444;margin:3px 0;">&ldquo;Whatever we do, it has to make sense.&rdquo;</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:7.5pt;color:#555;">mmccaster@MathiasElTribe.org &nbsp;&middot;&nbsp; www.mathiaseltribe.org/supreme-court</div>
          </div>
          <img src="${chiefSeal}" alt="Office of the Chief Justice and Trustee" style="width:76px;height:76px;object-fit:contain;flex-shrink:0;opacity:0.92;" />
        </div>
        <div style="border-top:2.5px solid #1a3a6e;margin-bottom:2px;"></div>
        <div style="border-top:0.5px solid #1a3a6e;margin-bottom:4px;"></div>
        <div style="text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#1a3a6e;">Office of the Chief Justice &amp; Trustee</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:16px;">
        <div style="flex:1;min-width:0;font-family:'Times New Roman',Georgia,serif;">
          <div style="display:flex;align-items:baseline;gap:18px;margin-bottom:3px;">
            <div style="font-size:10.5pt;font-weight:900;">Doc. No.&nbsp;<span style="font-family:'Courier New',monospace;font-size:10pt;">${esc(record.fileNumber)}</span></div>
            <div style="font-size:8pt;font-weight:700;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.6px;border:1px solid #1a3a6e;padding:1px 6px;">Type of Filing: ${matterLabel}</div>
          </div>
          ${record.submittedByName ? `<div style="font-size:8.5pt;color:#333;margin-bottom:5px;"><span style="font-weight:700;">Member:</span> ${esc(record.submittedByName)}${record.submittedByTitle ? ` &nbsp;&middot;&nbsp; <span style="font-style:italic;">${esc(record.submittedByTitle)}</span>` : ""}${record.submittedByEmail ? ` &nbsp;&middot;&nbsp; ${esc(record.submittedByEmail)}` : ""}</div>` : ""}
          <div style="font-size:9.5pt;font-weight:600;margin-bottom:2px;">IN RE: ${esc(record.templateTitle)}</div>
          <div style="font-size:9pt;color:#444;font-style:italic;line-height:1.5;">Pursuant to Treaty Authority, Tribal Constitution, Federal Indian Law, and Sovereign Jurisdiction</div>
          ${(record.intakeResult?.troRecommended || record.intakeResult?.redFlag) ? `<div style="margin-top:8px;display:inline-block;border:1.5px solid ${riskColor};padding:3px 10px;font-size:7.5pt;font-weight:700;color:${riskColor};letter-spacing:0.8px;text-transform:uppercase;">&#9876; ${record.intakeResult.troRecommended ? "TRO RECOMMENDED — Immediate Action Required" : "Red Flag — Sovereign Response Required"}</div>` : ""}
        </div>
        <div style="flex-shrink:0;">${stamp}</div>
      </div>
      <div style="margin-bottom:14px;">
        <div style="font-size:13pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;font-family:'Times New Roman',Georgia,serif;">${esc(record.templateTitle)}</div>
        <div style="font-size:8pt;color:#444;">Risk Level: <strong style="color:${riskColor};">${record.riskLevel.toUpperCase()}</strong> &nbsp;&middot;&nbsp; Official Seal: <strong>${record.sealApplied ? "AFFIXED" : "PENDING"}</strong></div>
      </div>
      <hr style="border-top:1px solid #000;margin-bottom:13px;" />
      <div style="margin-bottom:15px;"><div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">I. TRIGGERING MATTER — INCOMING COMMUNICATION</div><div style="font-size:9.5pt;background:#f8f8f8;border:1px solid #ddd;padding:9px 13px;font-style:italic;line-height:1.7;">${esc(record.inputText)}</div></div>
      <div style="margin-bottom:15px;"><div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">II. SOVEREIGN POSTURE DETERMINATION</div><div style="font-size:9.5pt;font-weight:700;color:${riskColor};margin-bottom:7px;">${esc(record.intakeResult?.canonicalPosture ?? "Sovereign enforcement posture engaged.")}</div>${violations.length > 0 ? `<div style="font-size:8pt;font-weight:700;margin-bottom:3px;">Violations Detected:</div>${violations.map((v, i) => `<div style="font-size:9pt;padding-left:14px;margin-bottom:2px;">${i+1}. ${esc(v)}</div>`).join("")}` : ""}</div>
      <div style="margin-bottom:15px;"><div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">III. DOCTRINES ENGAGED</div>${allDoctrines.map(d => `<div style="font-size:9pt;padding-left:14px;margin-bottom:2px;">&bull; ${esc(d)}</div>`).join("") || `<div style="font-size:9pt;color:#888;padding-left:14px;font-style:italic;">No specific doctrines enumerated.</div>`}</div>
      ${federalLaw.length > 0 ? `<div style="margin-bottom:15px;"><div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">IV. FEDERAL LAW APPLIED</div>${federalLaw.map(l => `<div style="font-size:9pt;padding-left:14px;margin-bottom:2px;">&bull; ${esc(l)}</div>`).join("")}</div>` : ""}
      <div style="margin-bottom:15px;"><div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">V. ANALYST REVIEW</div><div style="font-size:9pt;font-style:italic;padding-left:14px;">${esc(record.analystNotes ?? "Auto-approved by Sovereign AI Analyst.")}</div></div>
      <div style="margin-bottom:18px;border:1.5px solid #8B0000;padding:12px 14px;background:#fff8f8;"><div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#8B0000;margin-bottom:6px;">VI. DECREE &amp; ORDER</div><div style="font-size:9.5pt;margin-bottom:8px;font-weight:700;">TEMPLATE ENGAGED: ${esc(record.templateTitle)}</div><div style="font-size:9pt;margin-bottom:8px;">${esc(record.doctrineOverlay?.recommendation ?? "Sovereign enforcement response required.")}</div>${guardrails.length > 0 ? `<div style="font-size:8pt;font-weight:700;margin-bottom:3px;">Sovereignty Guardrails:</div>${guardrails.map(g => `<div style="font-size:9pt;padding-left:12px;margin-bottom:2px;">&#8861; ${esc(g)}</div>`).join("")}` : ""}</div>
      <div style="margin-bottom:18px;"><div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">VII. RECORD ENGINE — FILE LOG</div><div style="font-size:9pt;line-height:1.8;">File Number Assigned: <strong>${esc(record.fileNumber)}</strong><br/>Status: <strong>${esc(record.status?.replace(/_/g," ").toUpperCase())}</strong><br/>Record Created: ${new Date(record.createdAt).toLocaleString()}<br/>${record.lastPrintedAt ? `Last Sealed &amp; Printed: ${new Date(record.lastPrintedAt).toLocaleString()}<br/>` : ""}Print Count: <strong>${record.printCount}</strong><br/>Official Seal Applied: <strong>${record.sealApplied ? "YES — SEAL AFFIXED" : "PENDING"}</strong></div></div>
      <hr style="border-top:1.5px solid #000;margin-bottom:16px;" />
      ${sigBlock}
      ${sealBlock}
      ${isMedical ? `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;padding-top:12px;border-top:0.75px solid #c8d8f0;"><img src="${medSeal}" style="width:54px;height:54px;object-fit:contain;opacity:0.92;" alt="Mathias El Tribe Medical Center" /><div style="text-align:center;"><div style="font-family:Arial,Helvetica,sans-serif;font-size:7pt;font-weight:900;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.6px;line-height:1.3;">Mathias El Tribe Medical Center</div><div style="font-family:'Times New Roman',Georgia,serif;font-size:6.5pt;color:#555;font-style:italic;margin-top:1px;">In Conjunction With the Supreme Court</div></div><img src="${medSeal}" style="width:54px;height:54px;object-fit:contain;opacity:0.92;" alt="Mathias El Tribe Medical Center" /></div>` : ""}
      <div style="position:absolute;bottom:0.45in;left:1in;right:1in;border-top:0.75px solid #bbb;padding-top:5px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:6.5pt;color:#777;">File No. ${esc(record.fileNumber)} &nbsp;&middot;&nbsp; CONFIDENTIAL SOVEREIGN INSTRUMENT</div><div style="font-size:6.5pt;color:#777;font-weight:700;">Page 1 of 1</div><div style="font-size:6.5pt;color:#777;">Mathias El Tribe Supreme Court</div></div></div>
    </div>
    <script>window.onload=function(){var imgs=document.querySelectorAll('img');var done=0;var total=imgs.length;function tryPrint(){done++;if(done>=total)setTimeout(function(){window.print();},280);}if(total===0){setTimeout(function(){window.print();},400);return;}imgs.forEach(function(i){if(i.complete){tryPrint();}else{i.onload=i.onerror=tryPrint;}});setTimeout(function(){window.print();},2800);};<\/script>
  </body></html>`;
}

/* ── voice input hook ── */
function useVoiceMic(onTranscript: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      if (t) onTranscript(t);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}

/* ── voice mic button ── */
function VoiceMicBtn({ onTranscript }: { onTranscript: (t: string) => void }) {
  const { supported, listening, start, stop } = useVoiceMic(onTranscript);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? "Stop listening" : "Speak your answer"}
      className={`ml-1.5 p-1.5 rounded-full transition-all shrink-0 ${
        listening
          ? "bg-red-100 text-red-600 animate-pulse ring-2 ring-red-300"
          : "text-muted-foreground hover:text-primary hover:bg-muted"
      }`}
    >
      {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ── ai-guided intake field ── */
interface IntakeFieldProps {
  question: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}
function IntakeField({ question, label, value, onChange, placeholder, multiline }: IntakeFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5 text-[11px] text-primary/70 italic leading-snug">
        <Bot className="h-3 w-3 mt-0.5 shrink-0 text-primary/50" />
        <span>{question}</span>
      </div>
      <div className="flex items-start gap-1">
        <Label className="sr-only">{label}</Label>
        {multiline ? (
          <Textarea
            className="text-sm min-h-[72px] resize-none"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? label}
          />
        ) : (
          <Input
            className="text-sm h-9"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? label}
          />
        )}
        <VoiceMicBtn onTranscript={(t) => onChange(value ? `${value} ${t}` : t)} />
      </div>
    </div>
  );
}

/* ── smoke check bar ── */
function SmokeCheckBar() {
  const { data, isLoading } = useQuery({
    queryKey: ["smoke-check"],
    queryFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const h = { Authorization: `Bearer ${token}` };
      const [verifyRes, calRes] = await Promise.allSettled([
        fetch("/api/membership/verify", { headers: h }),
        fetch("/api/calendar", { headers: h }),
      ]);
      const verify = verifyRes.status === "fulfilled" && verifyRes.value.ok
        ? await verifyRes.value.json().catch(() => null)
        : null;
      const calOk = calRes.status === "fulfilled" && calRes.value.ok;
      return {
        entraOk: verify?.entraVerified ?? false,
        memberOk: verify?.membershipVerified ?? false,
        calendarOk: calOk,
        aiOk: verify !== null,
      };
    },
    staleTime: 2 * 60_000,
    retry: false,
  });

  const Dot = ({ ok, label }: { ok: boolean | undefined; label: string }) => (
    <div className="flex items-center gap-1 text-[10px]">
      {isLoading
        ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        : ok
          ? <CheckCircle2 className="h-3 w-3 text-green-500" />
          : <XCircle className="h-3 w-3 text-red-400" />
      }
      <span className={`font-medium uppercase tracking-widest ${ok ? "text-green-700" : "text-red-500"}`}>{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-4 flex-wrap px-3 py-2 rounded-lg bg-muted/50 border border-border text-[10px]">
      <Wifi className="h-3 w-3 text-muted-foreground shrink-0" />
      <Dot ok={data?.aiOk} label="AI" />
      <Dot ok={data?.entraOk} label="Entra" />
      <Dot ok={data?.calendarOk} label="Calendar" />
      <Dot ok={data?.memberOk} label="Member Verify" />
      {!isLoading && (!data?.entraOk || !data?.calendarOk) && (
        <span className="text-amber-600 text-[10px]">
          <AlertTriangle className="h-3 w-3 inline mr-0.5" />
          Some services may need attention
        </span>
      )}
    </div>
  );
}

/* ── chief quick links ── */
const CHIEF_LINKS = [
  { label: "Sovereign Pipeline", href: "/sovereign-pipeline", icon: Workflow, color: "text-[#8B0000]" },
  { label: "AI Intake", href: "/intake-ai", icon: Bot, color: "text-purple-700" },
  { label: "Court Filings", href: "/filings", icon: Gavel, color: "text-amber-700" },
  { label: "Official Docs", href: "/official-documents", icon: Printer, color: "text-slate-700" },
  { label: "Instruments", href: "/instruments", icon: Scale, color: "text-emerald-700" },
  { label: "Court Docs", href: "/documents", icon: FileText, color: "text-blue-700" },
  { label: "NFR", href: "/nfr", icon: Shield, color: "text-red-700" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, color: "text-sky-700" },
  { label: "Notifications", href: "/notifications", icon: Bell, color: "text-orange-700" },
  { label: "Tasks", href: "/tasks", icon: ClipboardList, color: "text-teal-700" },
  { label: "Tribal Trust", href: "/tribal-trust", icon: Building2, color: "text-stone-700" },
  { label: "Tribal ID", href: "/tribal-id", icon: Layers, color: "text-indigo-700" },
  { label: "Members", href: "/admin", icon: Users, color: "text-slate-600" },
  { label: "Classify", href: "/classify", icon: Search, color: "text-cyan-700" },
];

function ChiefQuickLinks() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-widest">Chief Office — Quick Access</CardTitle>
        <p className="text-xs text-muted-foreground">All tools available to the Office of the Chief Justice.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {CHIEF_LINKS.map(({ label, href, icon: Icon, color }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/60 transition-all cursor-pointer group text-center">
                <Icon className={`h-5 w-5 ${color} group-hover:scale-110 transition-transform`} />
                <span className="text-[10px] font-medium text-foreground leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── notification preferences ── */
const NOTIFICATION_CHANNELS = [
  { key: "familyGovernance", label: "Family Governance" },
  { key: "welfareUpdates", label: "Welfare Updates" },
  { key: "trustInstruments", label: "Trust Instruments" },
  { key: "recorderFilings", label: "Recorder Filings" },
  { key: "courtHearings", label: "Court Hearings" },
  { key: "tribalAnnouncements", label: "Tribal Announcements" },
  { key: "email", label: "Email" },
  { key: "push", label: "Push" },
];

/* ── ai intake questions ── */
const INTAKE_QUESTIONS = [
  {
    key: "legalName",
    label: "Legal Name",
    question: "What is your full legal name exactly as it should appear in court documents, trust filings, and official captions?",
    placeholder: "Full legal name",
  },
  {
    key: "preferredName",
    label: "Preferred Name",
    question: "How would you like to be addressed within the dashboard — your preferred or display name?",
    placeholder: "Preferred or display name",
  },
  {
    key: "tribalName",
    label: "Tribal / Ceremonial Name",
    question: "Do you have a tribal or ceremonial name you'd like on file with the court?",
    placeholder: "Tribal or ceremonial name",
  },
  {
    key: "nickname",
    label: "Nickname",
    question: "Do you go by any informal name or nickname within the community?",
    placeholder: "Informal name",
  },
  {
    key: "title",
    label: "Title",
    question: "What is your official title or honorific — for example, Chief Justice, Honorable, Trustee, or Elder?",
    placeholder: "e.g. Chief Justice, Elder",
  },
  {
    key: "familyGroup",
    label: "Family / Clan Group",
    question: "What family or clan group are you part of within the Mathias El Tribe?",
    placeholder: "Family or clan group",
  },
  {
    key: "mailingAddress",
    label: "Mailing Address",
    question: "What is your mailing address? This will appear on official documents, trust instruments, and filings.",
    placeholder: "Street, City, State, ZIP",
  },
  {
    key: "apn",
    label: "APN (Assessor's Parcel Number)",
    question: "What is the Assessor's Parcel Number for your primary land? This is used in trust instruments, LEN confirmations, and land status filings.",
    placeholder: "e.g. 123-456-789-000",
  },
  {
    key: "bio",
    label: "Background",
    question: "Can you briefly describe your role and connection to the tribe? This personalizes your court documents and welfare filings.",
    placeholder: "Brief role or background",
    multiline: true,
  },
  {
    key: "preferredJurisdiction",
    label: "Preferred Jurisdiction",
    question: "Which tribal court district or jurisdiction do you primarily operate within?",
    placeholder: "e.g. Tribal Court, District 1",
  },
];

/* ═══════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════ */
export default function ProfilePage() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const isChief = activeRole === "trustee";
  const isOfficeHolder = ["trustee", "officer", "sovereign_admin"].includes(activeRole);

  // ── UI accordion state ──
  const [identityOpen, setIdentityOpen] = useState(true);
  const [vaultSectionOpen, setVaultSectionOpen] = useState(false);
  const [successionOpen, setSuccessionOpen] = useState(false);
  const [printingId, setPrintingId] = useState<number | null>(null);

  // ── Succession planning form state ──
  const [succVaultName, setSuccVaultName] = useState("");
  const [succVaultNotes, setSuccVaultNotes] = useState("");
  const [succVaultInstructions, setSuccVaultInstructions] = useState("");
  const [succVaultPasscode, setSuccVaultPasscode] = useState("");
  const [succVaultPasscode2, setSuccVaultPasscode2] = useState("");
  const [showSuccPasscode, setShowSuccPasscode] = useState(false);
  const [succActivateCode, setSuccActivateCode] = useState("");
  const [succActivateName, setSuccActivateName] = useState("");
  const [showSuccActivate, setShowSuccActivate] = useState(false);

  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /* photo state */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* vault state — we never store actual values client-side after save */
  const [vaultHas, setVaultHas] = useState({ dob: false, address: false, email: false, ssn: false });
  const [vaultFields, setVaultFields] = useState({ dateOfBirth: "", address: "", preferredContact: "email", contactEmail: "", ssn: "" });
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [vaultRevealFields, setVaultRevealFields] = useState({ dateOfBirth: false, address: false, contactEmail: false, ssn: false });

  /* field state */
  const [fields, setFields] = useState({
    legalName: "",
    preferredName: "",
    tribalName: "",
    nickname: "",
    title: "",
    familyGroup: "",
    mailingAddress: "",
    apn: "",
    bio: "",
    preferredJurisdiction: "",
  });
  const [landStatus, setLandStatus] = useState("");
  const [hasRecordedInstrument, setHasRecordedInstrument] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

  /* notifications count */
  const { data: notifications } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });
  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n: any) => !n.readAt).length
    : 0;

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const r = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        });
        if (r.ok) {
          const d: ProfileData = await r.json();
          setData(d);
          const p = d.profile ?? {};
          setFields({
            legalName: p.legalName ?? "",
            preferredName: p.preferredName ?? "",
            tribalName: p.tribalName ?? "",
            nickname: p.nickname ?? "",
            title: p.title ?? "",
            familyGroup: p.familyGroup ?? "",
            mailingAddress: p.mailingAddress ?? "",
            apn: p.apn ?? "",
            bio: p.bio ?? "",
            preferredJurisdiction: p.preferredJurisdiction ?? "",
          });
          setLandStatus(p.landStatus ?? "");
          setHasRecordedInstrument(p.hasRecordedInstrument ?? false);
          setNotifPrefs((p.notificationPreferences as Record<string, boolean>) ?? {});
          if ((d.identity as any)?.profilePhoto) {
            setPhotoUrl((d.identity as any).profilePhoto);
          } else {
            /* profilePhoto lives in familyLineage — gateway surfaces it */
            const gr = await fetch("/api/identity/gateway", {
              headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
            }).catch(() => null);
            if (gr?.ok) {
              const gd = await gr.json().catch(() => null);
              if (gd?.profilePhoto) setPhotoUrl(gd.profilePhoto);
            }
          }
        }

        /* load vault presence (never returns actual values) */
        const vr = await fetch("/api/user/vault", {
          headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        });
        if (vr.ok) {
          const vd = await vr.json();
          setVaultHas({ dob: vd.hasDob, address: vd.hasAddress, email: vd.hasEmail, ssn: vd.hasSsn });
          if (vd.preferredContact) {
            setVaultFields((prev) => ({ ...prev, preferredContact: vd.preferredContact }));
          }
        }
      } catch {
        toast({ title: "Error", description: "Could not load profile.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setField = (key: keyof typeof fields) => (val: string) =>
    setFields((prev) => ({ ...prev, [key]: val }));

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose a photo under 8 MB.", variant: "destructive" });
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const r = await fetch("/api/identity/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: formData,
      });
      if (r.ok) {
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
        reader.readAsDataURL(file);
        toast({ title: "Photo saved", description: "Your profile photo has been updated in the database." });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Upload failed", description: err.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error uploading photo.", variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleVaultSave = async () => {
    if (!vaultFields.contactEmail && !vaultHas.email) {
      toast({ title: "Email required", description: "A contact email address is required in the vault.", variant: "destructive" });
      return;
    }
    setIsSavingVault(true);
    try {
      const body: Record<string, string> = {
        preferredContact: vaultFields.preferredContact,
      };
      if (vaultFields.dateOfBirth.trim()) body.dateOfBirth = vaultFields.dateOfBirth.trim();
      if (vaultFields.address.trim()) body.address = vaultFields.address.trim();
      if (vaultFields.contactEmail.trim()) body.contactEmail = vaultFields.contactEmail.trim();
      if (vaultFields.ssn.trim()) body.ssn = vaultFields.ssn.trim();

      const r = await fetch("/api/user/vault", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const vd = await r.json();
        setVaultHas({ dob: vd.hasDob, address: vd.hasAddress, email: vd.hasEmail, ssn: vd.hasSsn });
        setVaultFields((prev) => ({ ...prev, dateOfBirth: "", address: "", contactEmail: "", ssn: "" }));
        setVaultRevealFields({ dateOfBirth: false, address: false, contactEmail: false, ssn: false });
        toast({ title: "Vault saved", description: "Your personal information has been securely stored." });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Save failed", description: err.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error saving vault.", variant: "destructive" });
    } finally {
      setIsSavingVault(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...fields, landStatus, hasRecordedInstrument, notificationPreferences: notifPrefs }),
      });
      if (r.ok) {
        toast({ title: "Saved", description: "Your identity has been updated." });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Save failed", description: err.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Pipeline records (office holders only) ──
  const { data: records = [], isLoading: pipelineLoading } = useQuery<PipelineRecord[]>({
    queryKey: ["hub-pipeline-records"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sovereign/pipeline`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 30_000,
    enabled: isOfficeHolder,
  });

  async function printRecord(rec: PipelineRecord, mode: "esign" | "color") {
    setPrintingId(rec.id);
    try {
      const r = await fetch(`${API}/api/sovereign/pipeline/${rec.id}/print`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error("Print failed");
      const d = await r.json();
      const updated = { ...rec, lastPrintedAt: new Date().toISOString(), printCount: (rec.printCount ?? 0) + 1 };
      const html = buildPrintHtml(updated, mode);
      const blob = new Blob([html], { type: "text/html; charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const w = window.open(blobUrl, "_blank", "width=1000,height=820");
      if (w) setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
      else { URL.revokeObjectURL(blobUrl); alert("Pop-up blocked — please allow pop-ups."); }
      toast({ title: `Sealed — ${d.fileNumber}`, description: "Print event logged." });
    } catch (e: any) {
      toast({ title: "Print failed", description: e.message, variant: "destructive" });
    } finally {
      setPrintingId(null);
    }
  }

  // ── Succession vault ──
  const { data: successionStatus, isLoading: successionLoading, refetch: refetchSuccession } = useQuery<SuccessionStatus | null>({
    queryKey: ["hub-succession-vault"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sovereign/succession/status`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (r.status === 404 || r.status === 204) return null;
      if (!r.ok) return null;
      return r.json();
    },
    enabled: isOfficeHolder,
  });

  const createSuccession = useMutation({
    mutationFn: async (payload: { delegateName: string; delegateNotes?: string; passcode: string; instructions?: string }) => {
      const r = await fetch(`${API}/api/sovereign/succession`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Succession Secured", description: "Provision saved with private passcode." });
      setSuccVaultPasscode(""); setSuccVaultPasscode2(""); refetchSuccession();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeSuccession = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/api/sovereign/succession`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error("Failed to revoke");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Provision Revoked" });
      setSuccVaultName(""); setSuccVaultNotes(""); setSuccVaultInstructions(""); refetchSuccession();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const activateSuccession = useMutation({
    mutationFn: async (payload: { passcode: string; activatedByEntry: string }) => {
      const r = await fetch(`${API}/api/sovereign/succession/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Activation failed"); }
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: "Succession Activated", description: d.message, duration: 8000 });
      setSuccActivateCode(""); setSuccActivateName(""); refetchSuccession();
    },
    onError: (err: Error) => toast({ title: "Activation Failed", description: err.message, variant: "destructive" }),
  });

  /* auto-detected tags */
  const profile = data?.profile ?? {};
  const autoTags: { label: string; type: string }[] = [];
  if (Array.isArray(profile.jurisdictionTags))
    profile.jurisdictionTags.forEach((t: string) => autoTags.push({ label: t, type: "jurisdiction" }));
  if (Array.isArray(profile.welfareTags))
    profile.welfareTags.forEach((t: string) => autoTags.push({ label: t, type: "welfare" }));

  /* completion */
  const requiredKeys: (keyof typeof fields)[] = ["legalName", "tribalName", "familyGroup", "bio", "preferredJurisdiction"];
  const missing = requiredKeys.filter((k) => !fields[k]?.trim());
  const completionPct = Math.round(((requiredKeys.length - missing.length) / requiredKeys.length) * 100);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-8 w-full" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div data-testid="page-profile" className="space-y-4 max-w-4xl">

      {/* ── Header ── */}
      {isChief ? (
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <img src={`${import.meta.env.BASE_URL}supreme-court-seal-color.png`} className="w-14 h-14 object-contain drop-shadow shrink-0" alt="Mathias El Tribe Supreme Court" />
          {/* Member photo — center */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full border-2 border-primary/30 overflow-hidden bg-muted flex items-center justify-center shadow-md">
              {photoUrl
                ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                : <User className="h-7 w-7 text-muted-foreground" />
              }
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" title="Authority Active" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mathias El Tribe</p>
            <h1 className="font-serif text-xl font-bold text-foreground leading-tight">Office &amp; Identity Hub</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Chief Justice &amp; Trustee · Supreme Court · Sovereign Administration</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge className="bg-green-600 hover:bg-green-600 text-white text-[9px] uppercase tracking-widest py-0">● Authority Active</Badge>
              {unreadCount > 0 && (
                <Link href="/notifications">
                  <Badge variant="outline" className="text-[9px] text-orange-700 border-orange-300 cursor-pointer py-0">
                    <Bell className="h-2.5 w-2.5 mr-1" />{unreadCount} Unread
                  </Badge>
                </Link>
              )}
            </div>
          </div>
          <img src={`${import.meta.env.BASE_URL}chief-justice-seal.png`} className="w-14 h-14 object-contain drop-shadow shrink-0" alt="Chief Justice" />
        </div>
      ) : (
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <div className="w-14 h-14 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
            {photoUrl
              ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
              : <User className="h-6 w-6 text-muted-foreground" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-serif font-bold text-foreground">Profile &amp; Identity</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Unified identity across welfare instruments, trust filings, and court captions.</p>
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <Bell className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                <p className="text-xs text-orange-800">You have <strong>{unreadCount}</strong> unread notification{unreadCount !== 1 ? "s" : ""}.</p>
                <Link href="/notifications">
                  <span className="text-xs text-primary underline cursor-pointer">View</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Smoke check ── */}
      <SmokeCheckBar />

      {/* ── KAYA — primary AI interface (top) ── */}
      <KayaChat
        memberPhoto={photoUrl}
        memberName={fields.legalName || undefined}
        pendingTasks={data?.tasks?.filter((t: any) => t.status !== "completed" && t.status !== "done").length}
        unreadNotifications={unreadCount}
      />

      {/* ── Your Protections — identity standing, land status, rights ── */}
      <ProtectionsPanel />

      {/* ── Pipeline Records — compact indicators, office holders only ── */}
      {isOfficeHolder && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
                <Archive className="h-3.5 w-3.5 text-primary" /> Pipeline Records
              </CardTitle>
              <Link href="/sovereign-pipeline">
                <span className="text-[10px] text-primary hover:underline font-medium cursor-pointer">+ New Intake</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-4">
            {pipelineLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
            ) : records.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No pipeline records yet. Use the Intake Pipeline to generate sealed documents.</p>
            ) : (
              <div className="divide-y">
                {records.slice(0, 8).map((rec: PipelineRecord) => {
                  const rc = RISK_COLOR[rec.riskLevel] ?? "#8B0000";
                  return (
                    <div key={rec.id} className="flex items-center gap-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="font-mono text-[9px] text-muted-foreground">{rec.fileNumber}</span>
                          {rec.sealApplied && <span className="text-[8px] bg-green-100 text-green-700 border border-green-200 px-1 rounded font-bold">SEALED</span>}
                          <span className="text-[9px] font-semibold px-1.5 rounded-full border" style={{ color: rc, borderColor: rc + "44", background: rc + "0d" }}>{rec.riskLevel}</span>
                        </div>
                        <p className="text-xs font-medium truncate">{rec.templateTitle || MATTER_LABELS[rec.matterType] || rec.matterType}</p>
                      </div>
                      <span className="text-[9px] text-muted-foreground shrink-0 hidden sm:block">
                        <Clock className="h-2.5 w-2.5 inline mr-0.5" />{new Date(rec.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[#1C2B4B] gap-1" onClick={() => printRecord(rec, "esign")} disabled={printingId === rec.id} title="ePrint & eSign">
                          <Printer className="h-3 w-3" /><span className="text-[10px] hidden sm:inline">ePrint</span>
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 border-[#8B0000]/40 text-[#8B0000]" onClick={() => printRecord(rec, "color")} disabled={printingId === rec.id} title="Print & Sign (color)">
                          <Printer className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {records.length > 8 && (
                  <p className="text-[10px] text-muted-foreground pt-2 pb-0.5 text-center">
                    {records.length - 8} more — <Link href="/sovereign-pipeline"><span className="text-primary hover:underline cursor-pointer">view all</span></Link>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions — chief only ── */}
      {isChief && <ChiefQuickLinks />}

      {/* ── Succession Planning — office holders only, collapsible ── */}
      {isOfficeHolder && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setSuccessionOpen(v => !v)}
            className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold">Succession Planning</span>
            <Badge variant="outline" className="text-[9px] uppercase tracking-wider py-0">Private</Badge>
            {successionStatus?.isActivated && <Badge className="bg-amber-600 text-white text-[9px] py-0">Active</Badge>}
            {successionStatus && !successionStatus.isActivated && <Badge variant="secondary" className="text-[9px] text-green-700 bg-green-100 py-0">Secured</Badge>}
            <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200 ${successionOpen ? "rotate-180" : ""}`} />
          </button>
          {successionOpen && (
            <div className="px-4 pb-6 pt-2 space-y-4 border-t border-border">
              <p className="text-sm text-muted-foreground">Pre-designate a trusted successor and set a private passcode. The designated trustee enters the passcode to activate authority succession if you become unable to serve.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeRole === "trustee" && (
                  <Card className="border-[#1C2B4B]/20">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5" /> Succession Provision
                        </CardTitle>
                        {successionStatus && !successionStatus.isActivated && (
                          <Badge variant="secondary" className="text-[9px] text-green-700 bg-green-100 gap-1 py-0">
                            <ShieldCheck className="h-3 w-3" /> Configured
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {successionLoading ? (
                        <Skeleton className="h-16" />
                      ) : successionStatus?.isActivated ? (
                        <div className="flex items-start gap-2 text-amber-700 text-sm">
                          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>Succession has been activated. Authority provisions are in effect.</span>
                        </div>
                      ) : successionStatus ? (
                        <div className="space-y-3">
                          <div className="text-sm space-y-1">
                            <div className="font-medium">{successionStatus.delegateName}</div>
                            {successionStatus.delegateNotes && <div className="text-xs text-muted-foreground">{successionStatus.delegateNotes}</div>}
                            {successionStatus.instructions && <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mt-1">{successionStatus.instructions}</div>}
                            <div className="text-[9px] text-muted-foreground/70 mt-2">Configured {new Date(successionStatus.createdAt).toLocaleDateString()}</div>
                          </div>
                          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/5" onClick={() => revokeSuccession.mutate()} disabled={revokeSuccession.isPending}>
                            <Trash2 className="h-3 w-3" />{revokeSuccession.isPending ? "Revoking…" : "Revoke Provision"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div><Label className="text-xs">Designated Trustee Name</Label><Input className="mt-1 text-sm" value={succVaultName} onChange={e => setSuccVaultName(e.target.value)} placeholder="Full name" /></div>
                          <div><Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label><Input className="mt-1 text-sm" value={succVaultNotes} onChange={e => setSuccVaultNotes(e.target.value)} placeholder="Role or contact info" /></div>
                          <div><Label className="text-xs">Instructions upon activation</Label><textarea className="mt-1 w-full text-sm border border-input rounded-md p-2 min-h-[56px] bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" value={succVaultInstructions} onChange={e => setSuccVaultInstructions(e.target.value)} placeholder="What should happen if activated?" /></div>
                          <div>
                            <Label className="text-xs">Private Passcode <span className="text-muted-foreground">(min. 8 chars)</span></Label>
                            <div className="relative mt-1">
                              <Input type={showSuccPasscode ? "text" : "password"} className="text-sm pr-9" value={succVaultPasscode} onChange={e => setSuccVaultPasscode(e.target.value)} placeholder="Create a private passcode" />
                              <button type="button" className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowSuccPasscode(v => !v)}>
                                {showSuccPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div><Label className="text-xs">Confirm Passcode</Label><Input type="password" className="mt-1 text-sm" value={succVaultPasscode2} onChange={e => setSuccVaultPasscode2(e.target.value)} placeholder="Re-enter to confirm" /></div>
                          {succVaultPasscode && succVaultPasscode2 && succVaultPasscode !== succVaultPasscode2 && <p className="text-xs text-destructive">Passcodes do not match.</p>}
                          <Button className="w-full gap-2 bg-[#1C2B4B] hover:bg-[#0f1b30] text-white" disabled={createSuccession.isPending || !succVaultName.trim() || !succVaultPasscode.trim() || succVaultPasscode !== succVaultPasscode2 || succVaultPasscode.length < 8} onClick={() => createSuccession.mutate({ delegateName: succVaultName, delegateNotes: succVaultNotes || undefined, passcode: succVaultPasscode, instructions: succVaultInstructions || undefined })}>
                            <Key className="h-4 w-4" />{createSuccession.isPending ? "Securing…" : "Secure Succession Provision"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                <Card className="border-amber-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Emergency Succession Activation
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">For use only when the Chief Justice cannot function in their role.</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {successionStatus?.isActivated ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                          <ShieldCheck className="h-4 w-4 shrink-0" />
                          Succession active as of {successionStatus.activatedAt ? new Date(successionStatus.activatedAt).toLocaleString() : "recently"}.
                        </div>
                        {successionStatus.instructions && <p className="text-xs text-muted-foreground border-l-2 border-amber-300 pl-2">{successionStatus.instructions}</p>}
                      </div>
                    ) : !showSuccActivate ? (
                      <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/40 text-amber-700 hover:bg-amber-50" onClick={() => setShowSuccActivate(true)}>
                        <Key className="h-3 w-3" /> Enter Activation Passcode
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div><Label className="text-xs">Your Name <span className="text-muted-foreground">(recorded in log)</span></Label><Input className="mt-1 text-sm" value={succActivateName} onChange={e => setSuccActivateName(e.target.value)} placeholder="Your full name" /></div>
                        <div><Label className="text-xs">Vault Passcode</Label><Input type="password" className="mt-1 text-sm" value={succActivateCode} onChange={e => setSuccActivateCode(e.target.value)} placeholder="Enter the private passcode" /></div>
                        <div className="flex items-center gap-2">
                          <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" disabled={activateSuccession.isPending || !succActivateCode.trim() || !succActivateName.trim()} onClick={() => activateSuccession.mutate({ passcode: succActivateCode, activatedByEntry: succActivateName })}>
                            <ShieldAlert className="h-4 w-4" />{activateSuccession.isPending ? "Activating…" : "Activate Succession"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setShowSuccActivate(false); setSuccActivateCode(""); setSuccActivateName(""); }}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Identity & Profile — collapsible ── */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setIdentityOpen(v => !v)}
          className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
        >
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold">Identity &amp; Profile</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${completionPct < 100 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{completionPct}%</span>
          {completionPct < 100 && <span className="text-[10px] text-amber-600 hidden sm:inline">Incomplete — tap to fill in</span>}
          <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200 ${identityOpen ? "rotate-180" : ""}`} />
        </button>
        {identityOpen && (
        <div className="px-4 pb-6 pt-2 space-y-5 border-t border-border">

      {/* ── Profile Photo ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Profile Photo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Stored in the database alongside your identity record. Used on your Tribal ID card and official documents.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Photo preview */}
            <div
              className="relative w-24 h-24 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center cursor-pointer group shrink-0"
              onClick={() => photoInputRef.current?.click()}
              title="Click to change photo"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                {isUploadingPhoto
                  ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                  : <Upload className="h-5 w-5 text-white" />
                }
              </div>
            </div>

            {/* Instructions + button */}
            <div className="space-y-2">
              <p className="text-sm text-foreground font-medium">
                {photoUrl ? "Photo on file" : "No photo uploaded yet"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click the photo or the button below to upload. Accepted formats: JPG, PNG, WebP. Max 8 MB.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
                className="h-8 text-xs"
              >
                {isUploadingPhoto ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5 mr-1.5" /> {photoUrl ? "Change Photo" : "Upload Photo"}</>
                )}
              </Button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </CardContent>
      </Card>

      {/* ── AI-guided intake form ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Identity Intake
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Answer each question below — type or use the microphone to speak your answer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-muted rounded-full">
                <div
                  className={`h-1.5 rounded-full transition-all ${completionPct < 100 ? "bg-amber-400" : "bg-green-500"}`}
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${completionPct < 100 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                {completionPct}%
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {INTAKE_QUESTIONS.map((q) => (
              <div key={q.key} className={q.multiline ? "md:col-span-2" : ""}>
                <IntakeField
                  question={q.question}
                  label={q.label}
                  value={fields[q.key as keyof typeof fields]}
                  onChange={setField(q.key as keyof typeof fields)}
                  placeholder={q.placeholder}
                  multiline={q.multiline}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Auto-detected tags + resolved identity ── */}
      {(autoTags.length > 0 || data?.identity) && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {autoTags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Detected from activity</p>
                <div className="flex flex-wrap gap-1.5">
                  {autoTags.map((tag, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className={`text-[11px] ${
                        tag.type === "jurisdiction" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        tag.type === "welfare" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                        "bg-green-50 text-green-700 border border-green-200"
                      }`}
                    >
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {data?.identity && (
              <div className="flex flex-wrap gap-3">
                {(data.identity as any).displayName && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Display</span>
                    <Badge variant="secondary" className="text-xs">{(data.identity as any).displayName}</Badge>
                  </div>
                )}
                {(data.identity as any).courtCaption && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Caption</span>
                    <Badge variant="outline" className="text-xs">{(data.identity as any).courtCaption}</Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Land & Property ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Land &amp; Property Status
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Used in trust instruments, LEN confirmations, BIA land status filings, and recorded documents.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider">Land Status</Label>
              <Select value={landStatus || "__none__"} onValueChange={v => setLandStatus(v === "__none__" ? "" : v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select land status…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not specified</SelectItem>
                  <SelectItem value="trust">Indian Trust Land (25 U.S.C. § 5108)</SelectItem>
                  <SelectItem value="allotment">Allotment (restricted fee)</SelectItem>
                  <SelectItem value="fee">Fee Simple</SelectItem>
                  <SelectItem value="restricted">Restricted Indian Land</SelectItem>
                  <SelectItem value="none">No land interest on file</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Classification auto-populates trust instruments and LEN documents.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apn-field" className="text-xs font-semibold uppercase tracking-wider">APN (Assessor's Parcel Number)</Label>
              <Input
                id="apn-field"
                value={fields.apn}
                onChange={e => setFields(f => ({ ...f, apn: e.target.value }))}
                placeholder="e.g. 123-456-789-000"
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Auto-fills trust deeds, recorder filings, and property instruments.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mailing-address-field" className="text-xs font-semibold uppercase tracking-wider">Mailing Address</Label>
            <Input
              id="mailing-address-field"
              value={fields.mailingAddress}
              onChange={e => setFields(f => ({ ...f, mailingAddress: e.target.value }))}
              placeholder="Street, City, State, ZIP"
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Appears on court filings, trust instruments, and official correspondence.</p>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary"
              checked={hasRecordedInstrument}
              onChange={e => setHasRecordedInstrument(e.target.checked)}
            />
            <div>
              <span className="text-sm font-medium">Recorded instrument on file</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Check if a deed, allotment, or trust document has been recorded with the county recorder or BIA.</p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* ── Notification preferences ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest">Notification Preferences</CardTitle>
          <p className="text-xs text-muted-foreground">Red flag and TRO alerts are always delivered.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {NOTIFICATION_CHANNELS.map((ch) => (
              <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={notifPrefs[ch.key] ?? true}
                  onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [ch.key]: e.target.checked }))}
                />
                <span className="text-sm">{ch.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Save ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={isSaving} className="min-w-[140px]">
          {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Identity"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Identity propagates to PDFs, court captions, welfare instruments, and ICWA notices automatically.
        </p>
      </div>

        </div>
        )}
      </div>

      {/* ── Personal Information Vault — collapsible ── */}
      <div className="border-2 border-[#1C2B4B]/20 rounded-lg overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30">
        <button
          onClick={() => setVaultSectionOpen(v => !v)}
          className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-slate-100/60 transition-colors"
        >
          <Lock className="h-4 w-4 text-[#1C2B4B] shrink-0" />
          <span className="text-sm font-semibold">Personal Information Vault</span>
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <div className="flex items-center gap-1.5 ml-1 flex-wrap">
            {[{ label: "DOB", has: vaultHas.dob }, { label: "Address", has: vaultHas.address }, { label: "Email", has: vaultHas.email }, { label: "SSN", has: vaultHas.ssn }].map(({ label, has }) => (
              <span key={label} className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${has ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                {has ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}{label}
              </span>
            ))}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200 ${vaultSectionOpen ? "rotate-180" : ""}`} />
        </button>
        {vaultSectionOpen && (
        <div className="border-t border-[#1C2B4B]/15">
      <Card className="border-0 shadow-none rounded-none bg-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#1C2B4B]/6 border border-[#1C2B4B]/15">
            <Shield className="h-4 w-4 text-[#1C2B4B] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#1C2B4B]/80 leading-relaxed">
              All information is <strong>encrypted and confidential</strong>. Only accessed for administrative processes, emergencies, or official document generation. Fields are never shown in cleartext — even while typing.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#1C2B4B]/6 border border-[#1C2B4B]/15">
            <Shield className="h-4 w-4 text-[#1C2B4B] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#1C2B4B]/80 leading-relaxed">
              To update a field, type the new value and click <strong>Save Vault</strong>. Leaving a field blank keeps the existing stored value. What you type is hidden for your protection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Date of Birth
                {vaultHas.dob && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </Label>
              <p className="text-[10px] text-muted-foreground">Enter MM/DD/YYYY — stored encrypted, never shown.</p>
              <div className="relative">
                <Input
                  type={vaultRevealFields.dateOfBirth ? "text" : "password"}
                  placeholder={vaultHas.dob ? "•••••••••• (on file — type to update)" : "MM/DD/YYYY"}
                  value={vaultFields.dateOfBirth}
                  onChange={(e) => setVaultFields((p) => ({ ...p, dateOfBirth: e.target.value }))}
                  className="text-sm h-9 pr-9 font-mono"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setVaultRevealFields((p) => ({ ...p, dateOfBirth: !p.dateOfBirth }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={vaultRevealFields.dateOfBirth ? "Hide" : "Reveal while typing"}
                >
                  {vaultRevealFields.dateOfBirth ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Preferred Contact Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Preferred Contact Method</Label>
              <p className="text-[10px] text-muted-foreground">How should officials reach you in administrative matters?</p>
              <select
                value={vaultFields.preferredContact}
                onChange={(e) => setVaultFields((p) => ({ ...p, preferredContact: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="mail">Postal Mail</option>
                <option value="in-person">In Person</option>
              </select>
            </div>

            {/* Contact Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Contact Email <span className="text-red-500">*</span>
                {vaultHas.email && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </Label>
              <p className="text-[10px] text-muted-foreground">Required. Used for official correspondence only.</p>
              <div className="relative">
                <Input
                  type={vaultRevealFields.contactEmail ? "text" : "password"}
                  placeholder={vaultHas.email ? "•••••••••• (on file — type to update)" : "you@example.com"}
                  value={vaultFields.contactEmail}
                  onChange={(e) => setVaultFields((p) => ({ ...p, contactEmail: e.target.value }))}
                  className="text-sm h-9 pr-9 font-mono"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setVaultRevealFields((p) => ({ ...p, contactEmail: !p.contactEmail }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={vaultRevealFields.contactEmail ? "Hide" : "Reveal while typing"}
                >
                  {vaultRevealFields.contactEmail ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* SSN */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Social Security Number
                {vaultHas.ssn && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </Label>
              <p className="text-[10px] text-muted-foreground">Optional. Stored encrypted. Used only in certified administrative situations.</p>
              <div className="relative">
                <Input
                  type={vaultRevealFields.ssn ? "text" : "password"}
                  placeholder={vaultHas.ssn ? "••••••••• (on file — type to update)" : "9 digits, no dashes"}
                  value={vaultFields.ssn}
                  onChange={(e) => setVaultFields((p) => ({ ...p, ssn: e.target.value }))}
                  className="text-sm h-9 pr-9 font-mono"
                  autoComplete="off"
                  maxLength={11}
                />
                <button
                  type="button"
                  onClick={() => setVaultRevealFields((p) => ({ ...p, ssn: !p.ssn }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={vaultRevealFields.ssn ? "Hide" : "Reveal while typing"}
                >
                  {vaultRevealFields.ssn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Address — full width */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Mailing / Home Address
                {vaultHas.address && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </Label>
              <p className="text-[10px] text-muted-foreground">Full address including city, state, and ZIP. Stored encrypted — hidden while typing.</p>
              <div className="relative">
                <Input
                  type={vaultRevealFields.address ? "text" : "password"}
                  placeholder={vaultHas.address ? "•••••••••• (on file — type to update)" : "Street, City, State, ZIP"}
                  value={vaultFields.address}
                  onChange={(e) => setVaultFields((p) => ({ ...p, address: e.target.value }))}
                  className="text-sm h-9 pr-9 font-mono"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setVaultRevealFields((p) => ({ ...p, address: !p.address }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={vaultRevealFields.address ? "Hide" : "Reveal while typing"}
                >
                  {vaultRevealFields.address ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

          </div>

          {/* Save vault */}
          <div className="flex items-center gap-3 pt-1 border-t border-[#1C2B4B]/10">
            <Button
              onClick={handleVaultSave}
              disabled={isSavingVault}
              className="bg-[#1C2B4B] hover:bg-[#2a3d6e] text-white min-w-[140px]"
            >
              {isSavingVault
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                : <><Lock className="h-4 w-4 mr-2" /> Save Vault</>
              }
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Data is encrypted at rest. Access is logged and restricted to authorized administrative processes only.
            </p>
          </div>
        </CardContent>
      </Card>
        </div>
        )}
      </div>

      {/* ── Delegation panel ── */}
      {user?.roles && user.roles.some((r: string) =>
        ["officer", "trustee", "admin", "sovereign_admin", "chief_justice", "elder"].includes(r)
      ) && <DelegationPanel />}

      {/* ── AI recommendations ── */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">AI Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
