import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import {
  Printer, Shield, AlertTriangle, ChevronRight, ChevronDown,
  Lock, Key, Eye, EyeOff, ShieldCheck, ShieldAlert, UserCheck,
  Trash2, FileText, Clock, CheckCircle2, BookOpen,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";
const API  = import.meta.env.VITE_API_BASE_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────────

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

interface VaultStatus {
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

// ── Constants ──────────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  low:       "#2d6a1e",
  moderate:  "#7a5c00",
  elevated:  "#8a3500",
  critical:  "#8B0000",
  emergency: "#5a0000",
};

const MATTER_LABELS: Record<string, string> = {
  jurisdiction_claim:  "Jurisdiction Claim",
  policy_enforcement:  "Policy Enforcement",
  identity_denial:     "Identity Denial",
  icwa_violation:      "ICWA / Medical Violation",
  land_claim:          "Land Claim",
  demand:              "External Demand",
  general:             "General Matter",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatStampDate(d: Date): { month: string; daySpaced: string; year: string } {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const day = String(d.getDate()).padStart(2, "0");
  return { month: months[d.getMonth()], daySpaced: day.split("").join(" "), year: String(d.getFullYear()) };
}

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Print document builder — generates complete HTML from record object ─────────
function buildPrintHtml(record: PipelineRecord, mode: "esign" | "color"): string {
  const origin  = window.location.origin;
  const base    = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";
  const courtSeal = `${origin}${base}court-seal-bw.png`;
  const chiefSeal = `${origin}${base}chief-justice-seal-bw.png`;

  const riskColor   = RISK_COLOR[record.riskLevel] ?? "#8B0000";
  const matterLabel = esc(MATTER_LABELS[record.matterType] ?? record.matterType);
  const allDoctrines = record.doctrineOverlay?.allDoctrines ?? [];
  const violations   = record.intakeResult?.violations ?? [];
  const federalLaw   = record.doctrineOverlay?.federalLaw ?? [];
  const guardrails   = record.doctrineOverlay?.guardrails ?? [];
  const stampDate    = record.lastPrintedAt ? formatStampDate(new Date(record.lastPrintedAt)) : null;
  const now          = new Date();
  const isoTs        = now.toISOString();
  const humanTs      = now.toLocaleString("en-US", { timeZoneName: "short" });

  // ── Court filing date stamp — landscape rectangle [__], approx 1.6" × 0.85" at 96 DPI = 154×82px ──
  // Matches real self-inking court date stamps: wider than tall, text stacked horizontally across the width.
  // Layout (top→bottom): header line | org name | DATE (large, red) | footer line
  const stamp = `
    <div style="border:1.5px solid #1a3a6e;width:154px;height:82px;padding:5px 8px;text-align:center;background:#fff;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;flex-shrink:0;">
      <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:5pt;font-weight:700;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.5px;line-height:1.1;width:100%;white-space:nowrap;">BY ORDER OF THE</div>
      <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:5pt;font-weight:900;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.2px;line-height:1.1;width:100%;white-space:nowrap;">MATHIAS EL TRIBE SUPREME COURT</div>
      ${stampDate
        ? `<div style="font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:13pt;font-weight:900;color:#8B0000;letter-spacing:2px;line-height:1.05;width:100%;white-space:nowrap;">${esc(stampDate.month)}&nbsp;&nbsp;${esc(stampDate.daySpaced)}&nbsp;&nbsp;${esc(stampDate.year)}</div>`
        : `<div style="font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:13pt;font-weight:900;color:#bbb;letter-spacing:3px;line-height:1.05;width:100%;">— — — — —</div>`}
      <div style="border-top:0.5px solid #1a3a6e;width:100%;margin-top:1px;padding-top:2px;font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:4.5pt;font-weight:900;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.3px;line-height:1.1;white-space:nowrap;">OFFICE OF THE CHIEF JUSTICE &amp; TRUSTEE</div>
    </div>`;

  // ── Signature block ──
  const sigBlock = mode === "esign"
    ? `<div style="margin:20px 0 0;border:1.5px solid #1a3a6e;padding:10px 14px;text-align:center;font-family:'Courier New',monospace;font-size:8pt;color:#1a3a6e;background:#f4f6fb;">
         <div style="font-weight:700;letter-spacing:1.5px;font-size:7.5pt;margin-bottom:4px;">&#10022; ELECTRONICALLY SIGNED, SEALED &amp; FILED &#10022;</div>
         <div style="font-size:7pt;color:#555;">MATHIAS EL TRIBE SUPREME COURT &#8212; SOVEREIGN DOCUMENT MANAGEMENT SYSTEM</div>
         <div style="margin-top:5px;font-size:7pt;color:#333;">Digital Timestamp: ${isoTs}</div>
         <div style="font-size:7pt;color:#555;">${humanTs} &#8212; Record Engine v1.0 &#8212; Sovereign Pipeline</div>
       </div>`
    : `<div style="margin:14px 0 0;font-family:'Times New Roman',serif;">
         <div style="margin-bottom:26px;font-size:9pt;color:#222;">
           I hereby affix my hand and seal to this sovereign instrument this _______ day of _________________________, _______.
         </div>
         <div style="display:flex;justify-content:space-between;gap:32px;margin-bottom:18px;">
           <div style="flex:1;min-width:0;">
             <div style="border-top:1px solid #000;padding-top:4px;">
               <div style="font-size:8.5pt;font-weight:700;color:#000;">Chief Mathias El</div>
               <div style="font-size:7.5pt;color:#555;margin-top:1px;">Chief Justice &amp; Trustee · Mathias El Tribe Supreme Court</div>
             </div>
           </div>
           <div style="width:110px;flex-shrink:0;">
             <div style="border-top:1px solid #000;padding-top:4px;font-size:8pt;color:#555;text-align:center;">Date</div>
           </div>
         </div>
         <div style="display:flex;justify-content:space-between;gap:32px;margin-bottom:8px;">
           <div style="flex:1;min-width:0;">
             <div style="border-top:1px solid #aaa;padding-top:4px;font-size:8pt;color:#888;">Officer / Witness of Record</div>
           </div>
           <div style="width:110px;flex-shrink:0;">
             <div style="border-top:1px solid #aaa;padding-top:4px;font-size:8pt;color:#888;text-align:center;">Date</div>
           </div>
         </div>
         <div style="font-size:7.5pt;color:#999;font-style:italic;text-align:center;margin-top:10px;">
           ORIGINAL &#8212; Personally Signed &#8212; Not Electronically Filed
         </div>
       </div>`;

  // ── Seal impressions at bottom ──
  const sealBlock = record.sealApplied
    ? `<div style="display:flex;gap:12px;align-items:flex-end;justify-content:center;margin-top:18px;">
         <img src="${courtSeal}" style="width:62px;height:62px;object-fit:contain;opacity:0.90;" alt="METS Court" />
         <img src="${chiefSeal}" style="width:62px;height:62px;object-fit:contain;opacity:0.90;margin-top:4px;" alt="Chief Justice" />
       </div>
       <div style="text-align:center;font-size:6.5pt;color:#666;margin-top:3px;letter-spacing:0.5px;">Official Seal — Mathias El Tribe Supreme Court</div>`
    : `<div style="width:130px;height:56px;border:1.5px dashed #bbb;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:8pt;margin:18px auto 0;">&#8853; SEAL PENDING</div>`;

  const grayscaleStyle = mode === "esign" ? "img { filter: grayscale(100%) contrast(1.1) !important; }" : "";

  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>Sovereign Document &#8212; ${esc(record.fileNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body { background: #fff; margin: 0; padding: 0; }
      ${grayscaleStyle}
      @page { size: 8.5in 11in; margin: 0; }
    </style>
  </head><body>
    <div style="background:#fff;color:#000;font-family:'Times New Roman',Georgia,serif;font-size:11pt;line-height:1.65;padding:0.75in 1in 1.25in;max-width:8.5in;margin:0 auto;position:relative;min-height:11in;box-sizing:border-box;">

      <!-- LETTERHEAD -->
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
          <img src="${courtSeal}" alt="Mathias El Tribe Supreme Court" style="width:76px;height:76px;object-fit:contain;flex-shrink:0;opacity:0.92;" />
          <div style="flex:1;text-align:center;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.6px;line-height:1.2;color:#000;">Mathias El Tribe Supreme Court</div>
            <div style="font-family:'Times New Roman',Georgia,serif;font-size:9pt;font-style:italic;color:#444;margin:3px 0 3px;">&ldquo;Whatever we do, it has to make sense.&rdquo;</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:7.5pt;color:#555;">mmccaster@MathiasElTribe.org &nbsp;&middot;&nbsp; www.mathiaseltribe.org/supreme-court</div>
          </div>
          <img src="${chiefSeal}" alt="Office of the Chief Justice and Trustee" style="width:76px;height:76px;object-fit:contain;flex-shrink:0;opacity:0.92;" />
        </div>
        <div style="border-top:2.5px solid #1a3a6e;margin-bottom:2px;"></div>
        <div style="border-top:0.5px solid #1a3a6e;margin-bottom:4px;"></div>
        <div style="text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#1a3a6e;">Office of the Chief Justice &amp; Trustee</div>
      </div>

      <!-- CASE CAPTION + STAMP -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:16px;">
        <div style="flex:1;min-width:0;font-family:'Times New Roman',Georgia,serif;">
          <div style="display:flex;align-items:baseline;gap:18px;margin-bottom:3px;">
            <div style="font-size:10.5pt;font-weight:900;letter-spacing:0.2px;">Doc. No.&nbsp;<span style="font-family:'Courier New',monospace;font-size:10pt;">${esc(record.fileNumber)}</span></div>
            <div style="font-size:8pt;font-weight:700;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.6px;border:1px solid #1a3a6e;padding:1px 6px;">Type of Filing: ${matterLabel}</div>
          </div>
          ${record.submittedByName
            ? `<div style="font-size:8.5pt;color:#333;margin-bottom:5px;">
                 <span style="font-weight:700;">Member:</span> ${esc(record.submittedByName)}${record.submittedByTitle ? ` &nbsp;&middot;&nbsp; <span style="font-style:italic;">${esc(record.submittedByTitle)}</span>` : ""}${record.submittedByEmail ? ` &nbsp;&middot;&nbsp; ${esc(record.submittedByEmail)}` : ""}
               </div>`
            : ""}
          <div style="font-size:9.5pt;font-weight:600;margin-bottom:2px;">IN RE: ${esc(record.templateTitle)}</div>
          <div style="font-size:9pt;color:#444;font-style:italic;line-height:1.5;">Pursuant to Treaty Authority, Tribal Constitution, Federal Indian Law, and Sovereign Jurisdiction</div>
          ${(record.intakeResult?.troRecommended || record.intakeResult?.redFlag)
            ? `<div style="margin-top:8px;display:inline-block;border:1.5px solid ${riskColor};padding:3px 10px;font-size:7.5pt;font-weight:700;color:${riskColor};letter-spacing:0.8px;text-transform:uppercase;">&#9876; ${record.intakeResult.troRecommended ? "TRO RECOMMENDED &#8212; Immediate Action Required" : "Red Flag &#8212; Sovereign Response Required"}</div>`
            : ""}
        </div>
        <div style="flex-shrink:0;">${stamp}</div>
      </div>

      <!-- DOCUMENT TITLE -->
      <div style="margin-bottom:14px;">
        <div style="font-size:13pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;font-family:'Times New Roman',Georgia,serif;">${esc(record.templateTitle)}</div>
        <div style="font-size:8pt;color:#444;">Risk Level: <strong style="color:${riskColor};">${record.riskLevel.toUpperCase()}</strong> &nbsp;&middot;&nbsp; Official Seal: <strong>${record.sealApplied ? "AFFIXED" : "PENDING"}</strong></div>
      </div>

      <hr style="border-top:1px solid #000;margin-bottom:13px;" />

      <!-- I. TRIGGERING MATTER -->
      <div style="margin-bottom:15px;">
        <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">I. TRIGGERING MATTER &#8212; INCOMING COMMUNICATION</div>
        <div style="font-size:9.5pt;background:#f8f8f8;border:1px solid #ddd;padding:9px 13px;font-style:italic;line-height:1.7;">${esc(record.inputText)}</div>
      </div>

      <!-- II. SOVEREIGN POSTURE -->
      <div style="margin-bottom:15px;">
        <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">II. SOVEREIGN POSTURE DETERMINATION</div>
        <div style="font-size:9.5pt;font-weight:700;color:${riskColor};margin-bottom:7px;">${esc(record.intakeResult?.canonicalPosture ?? "Sovereign enforcement posture engaged.")}</div>
        ${violations.length > 0
          ? `<div style="font-size:8pt;font-weight:700;margin-bottom:3px;">Violations Detected:</div>${violations.map((v, i) => `<div style="font-size:9pt;padding-left:14px;margin-bottom:2px;">${i+1}. ${esc(v)}</div>`).join("")}`
          : ""}
      </div>

      <!-- III. DOCTRINES -->
      <div style="margin-bottom:15px;">
        <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">III. DOCTRINES ENGAGED</div>
        ${allDoctrines.map(d => `<div style="font-size:9pt;padding-left:14px;margin-bottom:2px;">&bull; ${esc(d)}</div>`).join("") || `<div style="font-size:9pt;color:#888;padding-left:14px;font-style:italic;">No specific doctrines enumerated.</div>`}
      </div>

      <!-- IV. FEDERAL LAW -->
      ${federalLaw.length > 0
        ? `<div style="margin-bottom:15px;">
             <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">IV. FEDERAL LAW APPLIED</div>
             ${federalLaw.map(l => `<div style="font-size:9pt;padding-left:14px;margin-bottom:2px;">&bull; ${esc(l)}</div>`).join("")}
           </div>`
        : ""}

      <!-- V. ANALYST REVIEW -->
      <div style="margin-bottom:15px;">
        <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">V. ANALYST REVIEW</div>
        <div style="font-size:9pt;font-style:italic;padding-left:14px;">${esc(record.analystNotes ?? "Auto-approved by Sovereign AI Analyst.")}</div>
      </div>

      <!-- VI. DECREE -->
      <div style="margin-bottom:18px;border:1.5px solid #8B0000;padding:12px 14px;background:#fff8f8;">
        <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#8B0000;margin-bottom:6px;">VI. DECREE &amp; ORDER</div>
        <div style="font-size:9.5pt;margin-bottom:8px;font-weight:700;">TEMPLATE ENGAGED: ${esc(record.templateTitle)}</div>
        <div style="font-size:9pt;margin-bottom:8px;">${esc(record.doctrineOverlay?.recommendation ?? "Sovereign enforcement response required. Serve on all relevant parties.")}</div>
        ${guardrails.length > 0
          ? `<div style="font-size:8pt;font-weight:700;margin-bottom:3px;">Sovereignty Guardrails:</div>${guardrails.map(g => `<div style="font-size:9pt;padding-left:12px;margin-bottom:2px;">&#8861; ${esc(g)}</div>`).join("")}`
          : ""}
      </div>

      <!-- VII. FILE LOG -->
      <div style="margin-bottom:18px;">
        <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a3a6e;margin-bottom:5px;">VII. RECORD ENGINE &#8212; FILE LOG</div>
        <div style="font-size:9pt;line-height:1.8;">
          File Number Assigned: <strong>${esc(record.fileNumber)}</strong><br/>
          Status: <strong>${esc(record.status?.replace(/_/g, " ").toUpperCase())}</strong><br/>
          Record Created: ${new Date(record.createdAt).toLocaleString()}<br/>
          ${record.lastPrintedAt ? `Last Sealed &amp; Printed: ${new Date(record.lastPrintedAt).toLocaleString()}<br/>` : ""}
          Print Count: <strong>${record.printCount}</strong><br/>
          Official Seal Applied: <strong>${record.sealApplied ? "YES &#8212; SEAL AFFIXED" : "PENDING"}</strong>
        </div>
      </div>

      <hr style="border-top:1.5px solid #000;margin-bottom:16px;" />

      <!-- SIGNATURE BLOCK -->
      ${sigBlock}

      <!-- BOTTOM SEALS -->
      ${sealBlock}

      <!-- PAGE FOOTER -->
      <div style="position:absolute;bottom:0.45in;left:1in;right:1in;border-top:0.75px solid #bbb;padding-top:5px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:6.5pt;color:#777;letter-spacing:0.3px;">File No. ${esc(record.fileNumber)} &nbsp;&middot;&nbsp; CONFIDENTIAL SOVEREIGN INSTRUMENT</div>
          <div style="font-size:6.5pt;color:#777;font-weight:700;">Page 1 of 1</div>
          <div style="font-size:6.5pt;color:#777;">Mathias El Tribe Supreme Court</div>
        </div>
      </div>
    </div>
    <script>window.onload=function(){var imgs=document.querySelectorAll('img');var done=0;var total=imgs.length;function tryPrint(){done++;if(done>=total)setTimeout(function(){window.print();},280);}if(total===0){setTimeout(function(){window.print();},400);return;}imgs.forEach(function(i){if(i.complete){tryPrint();}else{i.onload=i.onerror=tryPrint;}});setTimeout(function(){window.print();},2800);};<\/script>
  </body></html>`;
}

// ── Record list item ───────────────────────────────────────────────────────────
function RecordItem({ rec, selected, onClick }: { rec: PipelineRecord; selected: boolean; onClick: () => void }) {
  const riskColor = RISK_COLOR[rec.riskLevel] ?? "#8B0000";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
        selected ? "border-[#1C2B4B] bg-[#1C2B4B]/5" : "border-transparent hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-mono text-[10px] font-bold text-muted-foreground">{rec.fileNumber}</span>
        {rec.sealApplied && (
          <span className="text-[8px] font-bold text-green-700 bg-green-100 px-1 py-0.5 rounded border border-green-200">SEALED</span>
        )}
      </div>
      <div className="text-xs font-medium leading-snug line-clamp-2 mb-1">{rec.templateTitle ?? MATTER_LABELS[rec.matterType]}</div>
      <div className="flex items-center gap-1.5">
        <span
          className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full border"
          style={{ color: riskColor, borderColor: riskColor + "55", background: riskColor + "11" }}
        >
          {rec.riskLevel}
        </span>
        <span className="text-[8px] text-muted-foreground">{new Date(rec.createdAt).toLocaleDateString()}</span>
      </div>
    </button>
  );
}

// ── Record summary card — shown on screen (NOT a full document render) ─────────
function RecordSummaryCard({
  record, onPrint, isPrinting,
}: { record: PipelineRecord; onPrint: (mode: "esign" | "color") => void; isPrinting: boolean }) {
  const [doctrinesOpen, setDoctrinesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const riskColor   = RISK_COLOR[record.riskLevel] ?? "#8B0000";
  const allDoctrines = record.doctrineOverlay?.allDoctrines ?? [];
  const violations   = record.intakeResult?.violations ?? [];

  return (
    <div className="space-y-4 p-5">

      {/* ── Title row ── */}
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-[#1C2B4B] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono text-xs font-bold text-muted-foreground">{record.fileNumber}</span>
            {record.sealApplied && (
              <Badge className="bg-green-700 text-white text-[9px] px-1.5 py-0">Sealed</Badge>
            )}
            {record.intakeResult?.troRecommended && (
              <Badge variant="destructive" className="text-[9px] gap-0.5 px-1.5 py-0">
                <AlertTriangle className="h-2.5 w-2.5" /> TRO
              </Badge>
            )}
          </div>
          <h3 className="font-serif text-base font-bold leading-snug">{record.templateTitle}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{MATTER_LABELS[record.matterType] ?? record.matterType}</p>
        </div>
      </div>

      {/* ── Status / risk / date strip ── */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span
          className="font-semibold px-2 py-0.5 rounded-full border"
          style={{ color: riskColor, borderColor: riskColor + "55", background: riskColor + "0d" }}
        >
          {record.riskLevel} risk
        </span>
        <Badge variant="secondary" className="text-[10px] capitalize">{record.status?.replace(/_/g, " ")}</Badge>
        <span className="text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(record.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </span>
        {record.printCount > 0 && (
          <span className="text-muted-foreground">· Printed {record.printCount}×</span>
        )}
        {record.analystApproved && (
          <span className="flex items-center gap-1 text-green-700">
            <CheckCircle2 className="h-3 w-3" /> Analyst approved
          </span>
        )}
      </div>

      {/* ── Canonical posture ── */}
      {record.intakeResult?.canonicalPosture && (
        <div className="rounded-md border px-3 py-2.5 bg-muted/30">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Sovereign Posture</p>
          <p className="text-sm font-semibold" style={{ color: riskColor }}>{record.intakeResult.canonicalPosture}</p>
        </div>
      )}

      {/* ── Violations ── */}
      {violations.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Violations Detected</p>
          <div className="space-y-1">
            {violations.map((v, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <span className="shrink-0 mt-0.5" style={{ color: riskColor }}>▸</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Decree ── */}
      {record.doctrineOverlay?.recommendation && (
        <div className="border-l-4 pl-3 py-1" style={{ borderColor: "#8B0000" }}>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Decree / Order</p>
          <p className="text-sm leading-relaxed">{record.doctrineOverlay.recommendation}</p>
        </div>
      )}

      {/* ── Doctrines (collapsible) ── */}
      {allDoctrines.length > 0 && (
        <div>
          <button
            onClick={() => setDoctrinesOpen(v => !v)}
            className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
          >
            {doctrinesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Doctrines Engaged ({allDoctrines.length})
          </button>
          {doctrinesOpen && (
            <div className="mt-2 space-y-1 pl-1">
              {allDoctrines.map((d, i) => (
                <div key={i} className="text-xs text-muted-foreground">• {d}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Record log (collapsible) ── */}
      <div>
        <button
          onClick={() => setLogOpen(v => !v)}
          className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
        >
          {logOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          File Log
        </button>
        {logOpen && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pl-1">
            <div>Template: <span className="text-foreground">{record.templateKey}</span></div>
            <div>Seal: <span className={record.sealApplied ? "text-green-700 font-medium" : "text-orange-600"}>{record.sealApplied ? "Affixed" : "Pending"}</span></div>
            <div>Print count: <span className="text-foreground">{record.printCount}</span></div>
            {record.lastPrintedAt && (
              <div className="col-span-2">Last printed: <span className="text-foreground">{new Date(record.lastPrintedAt).toLocaleString()}</span></div>
            )}
          </div>
        )}
      </div>

      {/* ── Print actions ── */}
      <div className="border-t pt-4 flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => onPrint("esign")}
          disabled={isPrinting}
          className="gap-1.5 bg-[#1C2B4B] hover:bg-[#0f1b30] text-white"
        >
          <Printer className="h-3.5 w-3.5" />
          {isPrinting ? "Preparing…" : "ePrint, eSign & File"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPrint("color")}
          disabled={isPrinting}
          className="gap-1.5 border-[#8B0000] text-[#8B0000] hover:bg-[#8B0000]/5"
        >
          <Printer className="h-3.5 w-3.5" />
          Print & Sign
        </Button>
        <p className="text-[9px] text-muted-foreground self-center">
          ePrint/eSign auto-files &amp; applies timestamp. Print &amp; Sign produces a blank signature version.
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyOfficePage() {
  const { activeRole } = useAuth();
  const { toast } = useToast();
  const canAccess = ["trustee", "officer", "sovereign_admin"].includes(activeRole);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // ── Vault form state ──
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultName, setVaultName] = useState("");
  const [vaultNotes, setVaultNotes] = useState("");
  const [vaultInstructions, setVaultInstructions] = useState("");
  const [vaultPasscode, setVaultPasscode] = useState("");
  const [vaultPasscode2, setVaultPasscode2] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [activateCode, setActivateCode] = useState("");
  const [activateName, setActivateName] = useState("");
  const [showActivate, setShowActivate] = useState(false);

  // ── Queries ──
  const { data: records = [], isLoading } = useQuery<PipelineRecord[]>({
    queryKey: ["my-office-records"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sovereign/pipeline`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error("Failed to load records");
      return r.json();
    },
    staleTime: 30_000,
    enabled: canAccess,
  });

  const activeId = selectedId ?? records[0]?.id ?? null;

  const { data: selected, isLoading: loadingSelected } = useQuery<PipelineRecord>({
    queryKey: ["my-office-record", activeId],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sovereign/pipeline/${activeId}`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error("Failed to load record");
      return r.json();
    },
    staleTime: 30_000,
    enabled: canAccess && activeId !== null,
  });

  // ── Print ──
  const printSeal = useMutation({
    mutationFn: async ({ id, mode }: { id: number; mode: "esign" | "color" }) => {
      const r = await fetch(`${API}/api/sovereign/pipeline/${id}/print`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error("Print failed");
      return { ...(await r.json()), mode };
    },
    onSuccess: (data) => {
      toast({ title: `Sealed — ${data.fileNumber}`, description: `Print event #${data.printCount} logged. Opening print window…` });
      // Re-fetch the record to get the updated lastPrintedAt, then print
      setTimeout(() => {
        if (selected) {
          const updatedRecord = { ...selected, lastPrintedAt: new Date().toISOString(), printCount: (selected.printCount ?? 0) + 1 };
          const html = buildPrintHtml(updatedRecord, data.mode as "esign" | "color");
          const blob = new Blob([html], { type: "text/html; charset=utf-8" });
          const blobUrl = URL.createObjectURL(blob);
          const w = window.open(blobUrl, "_blank", "width=1000,height=820");
          if (w) setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
          else { URL.revokeObjectURL(blobUrl); alert("Pop-up blocked — please allow pop-ups for this site."); }
        }
      }, 200);
    },
    onError: (err: Error) => toast({ title: "Print failed", description: err.message, variant: "destructive" }),
  });

  function handlePrint(mode: "esign" | "color") {
    if (!selected) return;
    printSeal.mutate({ id: selected.id, mode });
  }

  // ── Vault queries ──
  const { data: vaultStatus, isLoading: vaultLoading, refetch: refetchVault } = useQuery<VaultStatus | null>({
    queryKey: ["succession-vault"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sovereign/succession/status`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (r.status === 404 || r.status === 204) return null;
      if (!r.ok) return null;
      return r.json();
    },
    enabled: canAccess,
  });

  const createVault = useMutation({
    mutationFn: async (payload: { delegateName: string; delegateNotes?: string; passcode: string; instructions?: string }) => {
      const r = await fetch(`${API}/api/sovereign/succession`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Failed to configure"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Succession Provision Secured", description: "Your designated trustee and passcode are in place." });
      setVaultPasscode(""); setVaultPasscode2(""); refetchVault();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeVault = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/api/sovereign/succession`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error("Failed to revoke");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Provision Revoked", description: "Succession provisions have been cleared." });
      setVaultName(""); setVaultNotes(""); setVaultInstructions(""); refetchVault();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const activateVault = useMutation({
    mutationFn: async (payload: { passcode: string; activatedByEntry: string }) => {
      const r = await fetch(`${API}/api/sovereign/succession/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Activation failed"); }
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "Succession Activated", description: data.message ?? "Authority provisions are now in effect.", duration: 8000 });
      setActivateCode(""); setActivateName(""); refetchVault();
    },
    onError: (err: Error) => toast({ title: "Activation Failed", description: err.message, variant: "destructive" }),
  });

  // ── No access ──
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">My Office — Chief Office Only</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Access to the Sovereign Office is restricted to the Chief Justice and authorized officers.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="page-my-office">

      {/* ── Office header ── */}
      <div className="flex items-center gap-5 pb-5 border-b border-border">
        <img
          src={`${BASE}supreme-court-seal-color.png`}
          alt="Mathias El Tribe Supreme Court"
          style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }}
          className="drop-shadow"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Mathias El Tribe</p>
          <h1 className="font-serif text-xl font-bold text-foreground leading-tight">My Office</h1>
          <p className="text-xs text-muted-foreground">Office of the Chief Justice &amp; Trustee — Sovereign Pipeline Records</p>
        </div>
        <img
          src={`${BASE}chief-justice-seal.png`}
          alt="Chief Mathias El — Office of the Chief Justice and Trustee"
          style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }}
          className="drop-shadow"
        />
      </div>

      {/* ── Main — two columns ── */}
      <div className="flex gap-4 min-h-0">

        {/* ── Sidebar — record list ── */}
        <div className="w-52 shrink-0 flex flex-col gap-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-1">Pipeline Records</p>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : records.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center px-2">
              No pipeline records yet.<br />Run the Sovereign Pipeline to generate sealed documents.
            </div>
          ) : (
            <div className="space-y-0.5">
              {records.map(rec => (
                <RecordItem
                  key={rec.id}
                  rec={rec}
                  selected={activeId === rec.id}
                  onClick={() => setSelectedId(rec.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-auto pt-4 border-t space-y-1.5">
            {[
              { icon: Shield,   label: "6-Engine Pipeline" },
              { icon: BookOpen, label: "Template Applied" },
              { icon: Shield,   label: "Record Sealed" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-[9px] text-muted-foreground">
                <Icon className="h-3 w-3 shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main — record summary card ── */}
        <div className="flex-1 min-w-0">
          {!selected && !loadingSelected && records.length === 0 && (
            <Card className="flex flex-col items-center justify-center h-56 text-center p-8">
              <FileText className="h-9 w-9 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No sealed documents yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Run the Sovereign Pipeline to generate and seal documents.
              </p>
            </Card>
          )}

          {loadingSelected && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-16" />
                <Skeleton className="h-10" />
              </CardContent>
            </Card>
          )}

          {selected && !loadingSelected && (
            <Card className="border-border">
              <RecordSummaryCard
                record={selected}
                onPrint={handlePrint}
                isPrinting={printSeal.isPending}
              />
            </Card>
          )}
        </div>
      </div>

      {/* ── Succession Planning (formerly Pre-Delegation Vault) ── */}
      <div className="border-t">
        <button
          onClick={() => setVaultOpen(v => !v)}
          className="flex items-center gap-3 w-full text-left py-4 hover:opacity-80 transition-opacity"
        >
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          <h2 className="text-sm font-semibold">Succession Planning</h2>
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider">Private Safety Mechanism</Badge>
          {vaultStatus?.isActivated && (
            <Badge className="bg-amber-600 text-white text-[9px] uppercase tracking-wider">Succession Active</Badge>
          )}
          {vaultStatus && !vaultStatus.isActivated && (
            <Badge variant="secondary" className="text-[9px] text-green-700 bg-green-100 border-green-200">Secured</Badge>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200 ${vaultOpen ? "rotate-180" : ""}`} />
        </button>

        {vaultOpen && (
          <div className="space-y-4 pb-6">
            <p className="text-sm text-muted-foreground max-w-2xl">
              Pre-designate a trusted successor and set a private passcode. This is completely separate from
              all regular delegation systems. If you become unable to function in your role, the designated
              trustee enters the passcode to activate authority succession.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
              {/* ── Setup (trustee only) ── */}
              {activeRole === "trustee" && (
                <Card className="border-[#1C2B4B]/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5" /> Succession Provision
                      </CardTitle>
                      {vaultStatus && !vaultStatus.isActivated && (
                        <Badge variant="secondary" className="text-[9px] text-green-700 bg-green-100 gap-1">
                          <ShieldCheck className="h-3 w-3" /> Configured
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {vaultLoading ? (
                      <Skeleton className="h-16" />
                    ) : vaultStatus?.isActivated ? (
                      <div className="flex items-start gap-2 text-amber-700 text-sm">
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>Succession has been activated. The designated trustee is now carrying authority.</span>
                      </div>
                    ) : vaultStatus ? (
                      <div className="space-y-3">
                        <div className="text-sm space-y-1">
                          <div className="font-medium">{vaultStatus.delegateName}</div>
                          {vaultStatus.delegateNotes && <div className="text-xs text-muted-foreground">{vaultStatus.delegateNotes}</div>}
                          {vaultStatus.instructions && (
                            <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mt-1">{vaultStatus.instructions}</div>
                          )}
                          <div className="text-[9px] text-muted-foreground/70 mt-2">Configured {new Date(vaultStatus.createdAt).toLocaleDateString()}</div>
                        </div>
                        <Button
                          variant="outline" size="sm"
                          className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/5"
                          onClick={() => revokeVault.mutate()}
                          disabled={revokeVault.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                          {revokeVault.isPending ? "Revoking…" : "Revoke Provision"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Designated Trustee Name</Label>
                          <Input className="mt-1 text-sm" value={vaultName} onChange={e => setVaultName(e.target.value)} placeholder="Full name of your designated successor" />
                        </div>
                        <div>
                          <Label className="text-xs">Notes about this person</Label>
                          <Input className="mt-1 text-sm" value={vaultNotes} onChange={e => setVaultNotes(e.target.value)} placeholder="Role, relationship, or contact info" />
                        </div>
                        <div>
                          <Label className="text-xs">Instructions upon activation</Label>
                          <textarea
                            className="mt-1 w-full text-sm border rounded-md p-2 min-h-[64px] bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                            value={vaultInstructions}
                            onChange={e => setVaultInstructions(e.target.value)}
                            placeholder="What should happen if this succession is activated?"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Private Passcode <span className="text-muted-foreground">(min. 8 chars)</span></Label>
                          <div className="relative mt-1">
                            <Input
                              type={showPasscode ? "text" : "password"}
                              className="text-sm pr-9"
                              value={vaultPasscode}
                              onChange={e => setVaultPasscode(e.target.value)}
                              placeholder="Create a private passcode"
                            />
                            <button type="button" className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowPasscode(v => !v)}>
                              {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Confirm Passcode</Label>
                          <Input type="password" className="mt-1 text-sm" value={vaultPasscode2} onChange={e => setVaultPasscode2(e.target.value)} placeholder="Re-enter to confirm" />
                        </div>
                        {vaultPasscode && vaultPasscode2 && vaultPasscode !== vaultPasscode2 && (
                          <p className="text-xs text-destructive">Passcodes do not match.</p>
                        )}
                        <Button
                          className="w-full gap-2 bg-[#1C2B4B] hover:bg-[#0f1b30] text-white"
                          disabled={createVault.isPending || !vaultName.trim() || !vaultPasscode.trim() || vaultPasscode !== vaultPasscode2 || vaultPasscode.length < 8}
                          onClick={() => createVault.mutate({ delegateName: vaultName, delegateNotes: vaultNotes || undefined, passcode: vaultPasscode, instructions: vaultInstructions || undefined })}
                        >
                          <Key className="h-4 w-4" />
                          {createVault.isPending ? "Securing…" : "Secure Succession Provision"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Emergency Activation ── */}
              <Card className="border-amber-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Emergency Succession Activation
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">
                    For use only when the Chief Justice cannot function in their role.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vaultStatus?.isActivated ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Succession active as of{" "}
                        {vaultStatus.activatedAt ? new Date(vaultStatus.activatedAt).toLocaleString() : "recently"}.
                      </div>
                      {vaultStatus.instructions && (
                        <p className="text-xs text-muted-foreground border-l-2 border-amber-300 pl-2">{vaultStatus.instructions}</p>
                      )}
                    </div>
                  ) : !showActivate ? (
                    <Button
                      variant="outline" size="sm"
                      className="gap-1.5 border-amber-500/40 text-amber-700 hover:bg-amber-50"
                      onClick={() => setShowActivate(true)}
                    >
                      <Key className="h-3 w-3" /> Enter Activation Passcode
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Your Name <span className="text-muted-foreground">(recorded in log)</span></Label>
                        <Input className="mt-1 text-sm" value={activateName} onChange={e => setActivateName(e.target.value)} placeholder="Your full name" />
                      </div>
                      <div>
                        <Label className="text-xs">Vault Passcode</Label>
                        <Input type="password" className="mt-1 text-sm" value={activateCode} onChange={e => setActivateCode(e.target.value)} placeholder="Enter the private passcode" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                          disabled={activateVault.isPending || !activateCode.trim() || !activateName.trim()}
                          onClick={() => activateVault.mutate({ passcode: activateCode, activatedByEntry: activateName })}
                        >
                          <ShieldAlert className="h-4 w-4" />
                          {activateVault.isPending ? "Activating…" : "Activate Succession"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setShowActivate(false); setActivateCode(""); setActivateName(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
