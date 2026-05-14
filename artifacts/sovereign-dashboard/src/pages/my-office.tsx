import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Printer, Shield, AlertTriangle, BookOpen, ChevronRight, Archive, Lock, Key, Eye, EyeOff, ShieldCheck, ShieldAlert, UserCheck, Trash2 } from "lucide-react";

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
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatStampDate(d: Date): string {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")} ${d.getFullYear()}`;
}

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

// ── Official Stamp (exact match to physical stamp) ─────────────────────────────
function OfficialStamp({ date }: { date: string }) {
  return (
    <div
      className="inline-block text-center select-none"
      style={{
        border: "2.5px solid #1a3a6e",
        borderRadius: "2px",
        padding: "6px 14px 8px",
        minWidth: "190px",
        background: "#fff",
        fontFamily: "'Times New Roman', serif",
      }}
    >
      <div style={{ fontSize: "8px", letterSpacing: "1.2px", color: "#1a3a6e", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.3 }}>
        By Order of the
      </div>
      <div style={{ fontSize: "7.5px", letterSpacing: "0.8px", color: "#1a3a6e", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.4, marginBottom: "4px" }}>
        Mathias El Tribe Supreme Court
      </div>
      <div style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "2px", color: "#111", lineHeight: 1.1, fontFamily: "monospace", margin: "2px 0 4px" }}>
        {date}
      </div>
      <div style={{ width: "80%", borderTop: "1px solid #1a3a6e", margin: "4px auto" }} />
      <div style={{ fontSize: "7.5px", letterSpacing: "0.8px", color: "#1a3a6e", fontWeight: 600, textTransform: "uppercase", lineHeight: 1.4 }}>
        Office of the
      </div>
      <div style={{ fontSize: "7.5px", letterSpacing: "0.8px", color: "#1a3a6e", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.4 }}>
        Chief Justice &amp; Trustee
      </div>
    </div>
  );
}

// ── Full Official Document ─────────────────────────────────────────────────────
function OfficialDocument({ record }: { record: PipelineRecord }) {
  const stampDate = formatStampDate(
    record.lastPrintedAt ? new Date(record.lastPrintedAt) : new Date(record.createdAt)
  );
  const riskColor = RISK_COLOR[record.riskLevel] ?? "#8B0000";
  const allDoctrines = record.doctrineOverlay?.allDoctrines ?? [];
  const violations   = record.intakeResult?.violations ?? [];
  const federalLaw   = record.doctrineOverlay?.federalLaw ?? [];
  const guardrails   = record.doctrineOverlay?.guardrails ?? [];

  return (
    <div
      id="official-document"
      style={{
        background: "#fff",
        color: "#000",
        fontFamily: "'Times New Roman', Georgia, serif",
        fontSize: "11pt",
        lineHeight: "1.65",
        padding: "0.85in 1in 0.85in",
        maxWidth: "8.5in",
        margin: "0 auto",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* ── LETTERHEAD ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
        <img
          src={`${BASE}tribal-seal.png`}
          alt="Mathias El Tribe"
          style={{ width: "60px", height: "60px", objectFit: "contain" }}
        />
        <div style={{ flex: 1, textAlign: "center", padding: "0 16px" }}>
          <div style={{ fontSize: "9pt", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, color: "#8B0000" }}>
            Mathias El Tribe
          </div>
          <div style={{ fontSize: "8pt", letterSpacing: "2px", textTransform: "uppercase", color: "#555", marginBottom: "2px" }}>
            Sovereign Office — Supreme Court
          </div>
          <div style={{ fontSize: "7pt", color: "#777" }}>
            Office of the Chief Justice &amp; Trustee — In Sovereign Trustee Capacity
          </div>
        </div>
        <OfficialStamp date={stampDate} />
      </div>

      <hr style={{ borderTop: "2.5px solid #000", marginBottom: "8px" }} />
      <hr style={{ borderTop: "1px solid #000", marginBottom: "20px" }} />

      {/* ── DOCUMENT TITLE ── */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "13pt", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.5px", color: "#8B0000", marginBottom: "6px" }}>
          {record.templateTitle}
        </div>
        <div style={{ fontSize: "9pt", color: "#333", letterSpacing: "1px" }}>
          Case File No.: <strong>{record.fileNumber}</strong> &nbsp;|&nbsp;
          Classification: <strong>{MATTER_LABELS[record.matterType] ?? record.matterType}</strong> &nbsp;|&nbsp;
          Risk Level: <strong style={{ color: riskColor }}>{record.riskLevel.toUpperCase()}</strong>
        </div>
        {(record.intakeResult?.troRecommended || record.intakeResult?.redFlag) && (
          <div style={{ marginTop: "8px", display: "inline-block", border: `2px solid ${riskColor}`, padding: "4px 14px", fontSize: "8.5pt", fontWeight: 700, color: riskColor, letterSpacing: "1px", textTransform: "uppercase" }}>
            {record.intakeResult.troRecommended ? "⚑ TRO Recommended — Immediate Action Required" : "⚑ Red Flag — Sovereign Response Required"}
          </div>
        )}
      </div>

      <hr style={{ borderTop: "1px solid #000", marginBottom: "16px" }} />

      {/* ── TRIGGERING MATTER ── */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "8.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1a3a6e", marginBottom: "6px" }}>
          I. TRIGGERING MATTER — INCOMING COMMUNICATION
        </div>
        <div style={{ fontSize: "9.5pt", background: "#f8f8f8", border: "1px solid #ccc", padding: "10px 14px", fontStyle: "italic", lineHeight: 1.7 }}>
          {record.inputText}
        </div>
      </div>

      {/* ── SOVEREIGN POSTURE ── */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "8.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1a3a6e", marginBottom: "6px" }}>
          II. SOVEREIGN POSTURE DETERMINATION (INTAKE ENGINE)
        </div>
        <div style={{ fontSize: "9.5pt", fontWeight: 700, color: riskColor, marginBottom: "8px" }}>
          {record.intakeResult?.canonicalPosture ?? "Sovereign enforcement posture engaged."}
        </div>
        {violations.length > 0 && (
          <>
            <div style={{ fontSize: "8.5pt", fontWeight: 700, marginBottom: "4px" }}>Violations Detected:</div>
            {violations.map((v, i) => (
              <div key={i} style={{ fontSize: "9pt", paddingLeft: "16px", marginBottom: "3px" }}>
                {i + 1}. {v}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── DOCTRINES ENGAGED ── */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "8.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1a3a6e", marginBottom: "6px" }}>
          III. DOCTRINES ENGAGED (DOCTRINE ENGINE)
        </div>
        {allDoctrines.length > 0 && allDoctrines.map((d, i) => (
          <div key={i} style={{ fontSize: "9pt", paddingLeft: "16px", marginBottom: "3px" }}>• {d}</div>
        ))}
      </div>

      {/* ── FEDERAL LAW APPLIED ── */}
      {federalLaw.length > 0 && (
        <div style={{ marginBottom: "18px" }}>
          <div style={{ fontSize: "8.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1a3a6e", marginBottom: "6px" }}>
            IV. FEDERAL LAW APPLIED
          </div>
          {federalLaw.map((l, i) => (
            <div key={i} style={{ fontSize: "9pt", paddingLeft: "16px", marginBottom: "3px" }}>• {l}</div>
          ))}
        </div>
      )}

      {/* ── ANALYST REVIEW ── */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "8.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1a3a6e", marginBottom: "6px" }}>
          V. ANALYST REVIEW (AI SOVEREIGN ANALYST)
        </div>
        <div style={{ fontSize: "9pt", fontStyle: "italic", paddingLeft: "16px" }}>
          {record.analystNotes ?? "Auto-approved by Sovereign AI Analyst."}
        </div>
      </div>

      {/* ── DECREE / ORDERED ── */}
      <div style={{ marginBottom: "22px", border: "1.5px solid #8B0000", padding: "14px 16px", background: "#fff8f8" }}>
        <div style={{ fontSize: "8.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#8B0000", marginBottom: "8px" }}>
          VI. DECREE &amp; ORDER
        </div>
        <div style={{ fontSize: "9.5pt", marginBottom: "10px", fontWeight: 700 }}>
          TEMPLATE ENGAGED: {record.templateTitle}
        </div>
        <div style={{ fontSize: "9pt", marginBottom: "10px" }}>
          {record.doctrineOverlay?.recommendation ?? "Sovereign enforcement response required. Serve on all relevant parties."}
        </div>
        {guardrails.length > 0 && (
          <>
            <div style={{ fontSize: "8.5pt", fontWeight: 700, marginBottom: "4px" }}>Sovereignty Guardrails:</div>
            {guardrails.map((g, i) => (
              <div key={i} style={{ fontSize: "9pt", paddingLeft: "14px", marginBottom: "2px" }}>⊛ {g}</div>
            ))}
          </>
        )}
      </div>

      {/* ── RECORD ENGINE LOG ── */}
      <div style={{ marginBottom: "22px" }}>
        <div style={{ fontSize: "8.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#1a3a6e", marginBottom: "6px" }}>
          VII. RECORD ENGINE — FILE LOG
        </div>
        <div style={{ fontSize: "9pt" }}>
          File Number Assigned: <strong>{record.fileNumber}</strong><br />
          Status: <strong>{record.status?.replace("_", " ").toUpperCase()}</strong><br />
          Record Created: {new Date(record.createdAt).toLocaleString()}<br />
          {record.lastPrintedAt && <>Last Sealed &amp; Printed: {new Date(record.lastPrintedAt).toLocaleString()}<br /></>}
          Print Count: <strong>{record.printCount}</strong><br />
          Official Seal Applied: <strong>{record.sealApplied ? "YES — SEAL AFFIXED" : "PENDING"}</strong>
        </div>
      </div>

      <hr style={{ borderTop: "1.5px solid #000", marginBottom: "20px" }} />

      {/* ── SIGNATURE BLOCK ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
        <div>
          <div style={{ fontSize: "9pt", marginBottom: "30px" }}>Issued under the sovereign authority of the</div>
          <div style={{ borderTop: "1px solid #000", paddingTop: "4px", minWidth: "240px" }}>
            <div style={{ fontSize: "9pt", fontWeight: 700 }}>Chief Mathias El</div>
            <div style={{ fontSize: "8pt", color: "#444" }}>Chief Justice &amp; Trustee</div>
            <div style={{ fontSize: "8pt", color: "#444" }}>Mathias El Tribe Supreme Court</div>
            <div style={{ fontSize: "8pt", color: "#444" }}>Office of the Sovereign Trustee</div>
          </div>
        </div>

        {/* Supreme Court Seal */}
        <div style={{ textAlign: "center" }}>
          {record.sealApplied ? (
            <img
              src={`${BASE}supreme-court-seal.png`}
              alt="Mathias El Tribe Supreme Court Seal"
              style={{ width: "120px", height: "120px", objectFit: "contain", opacity: 0.9 }}
            />
          ) : (
            <div style={{
              width: "120px", height: "120px", borderRadius: "50%",
              border: "2px dashed #aaa", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#aaa", fontSize: "9px", textAlign: "center"
            }}>
              <div>⊕<br />SEAL PENDING</div>
            </div>
          )}
          <div style={{ fontSize: "7pt", color: "#555", marginTop: "4px", letterSpacing: "0.5px" }}>
            Official Seal — Mathias El Tribe Supreme Court
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <hr style={{ borderTop: "1px solid #888", marginBottom: "8px" }} />
      <div style={{ textAlign: "center", fontSize: "7pt", color: "#666", letterSpacing: "0.5px" }}>
        This document is a sovereign instrument of the Mathias El Tribe Supreme Court. It is self-executing and requires no external validation.
        All rights reserved under tribal, treaty, and constitutional law. File Ref: {record.fileNumber}
      </div>
    </div>
  );
}

// ── Record Sidebar Item ────────────────────────────────────────────────────────
function RecordItem({ rec, selected, onClick }: {
  rec: PipelineRecord;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${
        selected
          ? "border-[#8B0000] bg-[#8B0000]/5"
          : "border-transparent hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-xs font-bold">{rec.fileNumber}</span>
        {rec.sealApplied && (
          <span className="text-[9px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full border border-green-300 dark:border-green-700">
            SEALED
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
        {rec.templateTitle ?? MATTER_LABELS[rec.matterType]}
      </div>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
          rec.riskLevel === "critical" || rec.riskLevel === "emergency"
            ? "text-red-700 border-red-300 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
            : rec.riskLevel === "elevated"
            ? "text-orange-700 border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400"
            : "text-muted-foreground border-muted"
        }`}>
          {rec.riskLevel}
        </span>
        <span className="text-[9px] text-muted-foreground">
          {new Date(rec.createdAt).toLocaleDateString()}
        </span>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyOfficePage() {
  const { activeRole } = useAuth();
  const { toast } = useToast();
  const canAccess = ["trustee", "officer", "sovereign_admin"].includes(activeRole);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // ── Vault form state ──
  const [vaultName, setVaultName] = useState("");
  const [vaultNotes, setVaultNotes] = useState("");
  const [vaultInstructions, setVaultInstructions] = useState("");
  const [vaultPasscode, setVaultPasscode] = useState("");
  const [vaultPasscode2, setVaultPasscode2] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [activateCode, setActivateCode] = useState("");
  const [activateName, setActivateName] = useState("");
  const [showActivate, setShowActivate] = useState(false);

  const { data: records = [], isLoading } = useQuery<PipelineRecord[]>({
    queryKey: ["my-office-records"],
    queryFn: async () => {
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/pipeline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to load records");
      return r.json();
    },
    staleTime: 30_000,
    enabled: canAccess,
  });

  const { data: selected, isLoading: loadingSelected } = useQuery<PipelineRecord>({
    queryKey: ["my-office-record", selectedId ?? records[0]?.id],
    queryFn: async () => {
      const id = selectedId ?? records[0]?.id;
      if (!id) throw new Error("No record");
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/pipeline/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to load record");
      return r.json();
    },
    staleTime: 30_000,
    enabled: canAccess && (selectedId !== null || records.length > 0),
  });

  // ── Print-window generator ────────────────────────────────────────────────
  function printDocument(mode: "esign" | "color") {
    const docEl = document.getElementById("official-document");
    if (!docEl) { alert("Document not found — select a record first."); return; }

    // Clone + make all image srcs absolute so the popup window can load them
    const clone = docEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("img").forEach(img => {
      const src = img.getAttribute("src") ?? "";
      if (!src.startsWith("http") && !src.startsWith("data:")) {
        img.setAttribute("src", src.startsWith("/")
          ? `${window.location.origin}${src}`
          : `${window.location.origin}${import.meta.env.BASE_URL}${src.replace(/^\.?\/?/, "")}`
        );
      }
    });

    const isEsign = mode === "esign";
    const ts = new Date();
    const isoTs = ts.toISOString();
    const humanTs = ts.toLocaleString("en-US", { timeZoneName: "short" });

    const bottomBlock = isEsign
      ? `<div style="margin:24px 0 0;border:1.5px solid #1a3a6e;padding:12px 16px;text-align:center;font-family:'Courier New',monospace;font-size:8.5pt;color:#1a3a6e;background:#f4f6fb;">
           <div style="font-weight:700;letter-spacing:1.5px;font-size:8pt;margin-bottom:4px;">&#10022; ELECTRONICALLY SIGNED, SEALED &amp; FILED &#10022;</div>
           <div style="font-size:7.5pt;color:#555;">MATHIAS EL TRIBE SUPREME COURT &#8212; SOVEREIGN DOCUMENT MANAGEMENT SYSTEM</div>
           <div style="margin-top:6px;font-size:7.5pt;color:#333;">Digital Timestamp: ${isoTs}</div>
           <div style="font-size:7.5pt;color:#555;">${humanTs} &#8212; Record Engine v1.0 &#8212; Sovereign Pipeline</div>
         </div>`
      : `<div style="margin:32px 0 0;font-family:'Times New Roman',serif;">
           <div style="margin-bottom:36px;font-size:9.5pt;color:#222;">
             I hereby affix my hand and seal to this sovereign instrument this _______ day of _____________, _______.
           </div>
           <div style="display:flex;justify-content:space-between;gap:40px;margin-bottom:16px;">
             <div style="flex:1;border-top:1px solid #000;padding-top:5px;font-size:8pt;color:#444;text-align:center;">
               Signature of Chief Justice &amp; Trustee
             </div>
             <div style="width:140px;border-top:1px solid #000;padding-top:5px;font-size:8pt;color:#444;text-align:center;">Date</div>
           </div>
           <div style="font-size:8pt;color:#555;font-style:italic;text-align:center;margin-top:8px;">
             ORIGINAL &#8212; Personally Signed &#8212; Not Electronically Filed
           </div>
         </div>`;

    const fullHtml = `<!DOCTYPE html><html lang="en"><head>
      <meta charset="utf-8">
      <title>Sovereign Document &#8212; ${isEsign ? "ePrint / eSign &amp; File" : "Print &amp; Sign (Color)"}</title>
      <style>
        * { box-sizing: border-box; }
        body { background: white; margin: 0; padding: 0; }
        ${isEsign ? "img { filter: grayscale(100%) contrast(1.12) !important; }" : ""}
        @page { size: 8.5in 11in; margin: 0; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      ${clone.outerHTML}
      ${bottomBlock}
      <script>window.onload=function(){setTimeout(function(){window.print();},700);};<\/script>
    </body></html>`;

    const w = window.open("", "_blank", "width=980,height=800");
    if (w) { w.document.open(); w.document.write(fullHtml); w.document.close(); }
    else { alert("Pop-up blocked — please allow pop-ups for this site to open the print window."); }
  }

  const printSeal = useMutation({
    mutationFn: async ({ id, mode }: { id: number; mode: "esign" | "color" }) => {
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/pipeline/${id}/print`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Print failed");
      return { ...(await r.json()), mode };
    },
    onSuccess: (data) => {
      toast({ title: `Sealed — ${data.fileNumber}`, description: `Print event #${data.printCount} logged. Opening print window…` });
      setTimeout(() => printDocument(data.mode as "esign" | "color"), 300);
    },
    onError: (err: Error) => {
      toast({ title: "Print failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Vault queries & mutations ─────────────────────────────────────────────
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

  const { data: vaultStatus, isLoading: vaultLoading, refetch: refetchVault } = useQuery<VaultStatus | null>({
    queryKey: ["succession-vault"],
    queryFn: async () => {
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/succession/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 404 || r.status === 204) return null;
      if (!r.ok) return null;
      return r.json();
    },
    enabled: canAccess,
  });

  const createVault = useMutation({
    mutationFn: async (payload: { delegateName: string; delegateNotes?: string; passcode: string; instructions?: string }) => {
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/succession`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Failed to configure vault"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Pre-Delegation Vault Configured", description: "Succession provisions are now in place." });
      setVaultPasscode(""); setVaultPasscode2(""); refetchVault();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeVault = useMutation({
    mutationFn: async () => {
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/succession`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to revoke vault");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Vault Revoked", description: "Pre-delegation provisions have been cleared." });
      setVaultName(""); setVaultNotes(""); setVaultInstructions("");
      refetchVault();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const activateVault = useMutation({
    mutationFn: async (payload: { passcode: string; activatedByEntry: string }) => {
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/succession/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">My Office — Chief Office Only</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Access to the Sovereign Office document vault is restricted to the Chief Justice and authorized officers.
        </p>
      </div>
    );
  }

  const activeRecord = selected ?? (records.length > 0 ? undefined : null);

  return (
    <div className="flex flex-col h-full" data-testid="page-my-office">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
            <Archive className="h-6 w-6 text-[#8B0000]" />
            My Office — Sovereign Document Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sealed pipeline documents issued by the Mathias El Tribe Supreme Court
          </p>
        </div>
        {selected && (
          <div className="flex items-center gap-2 flex-wrap">
            {selected.intakeResult?.troRecommended && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" /> TRO Eligible
              </Badge>
            )}
            <Button
              onClick={() => printSeal.mutate({ id: selected.id, mode: "esign" })}
              disabled={printSeal.isPending}
              className="gap-2 bg-[#1C2B4B] hover:bg-[#0f1b30] text-white"
              title="B&W stencil seal + electronic timestamp — files automatically"
            >
              <Printer className="h-4 w-4" />
              {printSeal.isPending ? "Sealing…" : "ePrint, eSign & File"}
            </Button>
            <Button
              onClick={() => printSeal.mutate({ id: selected.id, mode: "color" })}
              disabled={printSeal.isPending}
              variant="outline"
              className="gap-2 border-[#8B0000] text-[#8B0000] hover:bg-[#8B0000]/5"
              title="Full color — blank signature line for personal signing"
            >
              <Printer className="h-4 w-4" />
              Print & Sign
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* ── Sidebar — record list ── */}
        <div className="w-56 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Pipeline Records
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center px-2">
              No pipeline records yet.<br />Run the Sovereign Pipeline to generate documents.
            </div>
          ) : (
            <div className="space-y-1">
              {records.map(rec => (
                <RecordItem
                  key={rec.id}
                  rec={rec}
                  selected={(selectedId ?? records[0]?.id) === rec.id}
                  onClick={() => setSelectedId(rec.id)}
                />
              ))}
            </div>
          )}

          {/* Engine legend */}
          <div className="mt-6 pt-4 border-t space-y-1.5">
            {[
              { icon: Shield,   label: "6-Engine Pipeline" },
              { icon: BookOpen, label: "Template Applied" },
              { icon: Archive,  label: "Record Sealed" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Icon className="h-3 w-3 shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main — document view ── */}
        <div className="flex-1 min-w-0">
          {!selected && !isLoading && records.length === 0 && (
            <Card className="flex flex-col items-center justify-center h-64 text-center p-8">
              <Archive className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No sealed documents yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Run the Sovereign Pipeline to generate and seal documents here.
              </p>
            </Card>
          )}

          {loadingSelected && (
            <div className="animate-pulse space-y-4">
              <div className="h-24 bg-muted/40 rounded" />
              <div className="h-48 bg-muted/40 rounded" />
              <div className="h-32 bg-muted/40 rounded" />
            </div>
          )}

          {selected && !loadingSelected && (
            <div className="rounded-lg border border-gray-300 shadow-lg overflow-hidden print:border-none print:shadow-none">
              <OfficialDocument record={selected} />
            </div>
          )}
        </div>
      </div>

      {/* ── Pre-Delegation Vault ─────────────────────────────────────────────── */}
      <div className="mt-8 border-t pt-6 print:hidden space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
          <h2 className="text-base font-serif font-semibold">Pre-Delegation Vault</h2>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Private Safety Mechanism</Badge>
          {vaultStatus?.isActivated && (
            <Badge className="bg-amber-600 text-white text-[10px] uppercase tracking-wider">Succession Active</Badge>
          )}
          {vaultStatus && !vaultStatus.isActivated && (
            <Badge variant="secondary" className="text-[10px] text-green-700 bg-green-100">Vault Secured</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Pre-designate a trusted successor and set a private passcode. This is a private safety mechanism,
          completely separate from all regular delegation systems. If you become unable to function in your role,
          the designated trustee enters the passcode to activate authority succession.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
          {/* ── Setup (trustee / Chief Justice only) ── */}
          {activeRole === "trustee" && (
            <Card className="border-[#1C2B4B]/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                    <UserCheck className="h-4 w-4" /> Succession Provision
                  </CardTitle>
                  {vaultStatus && !vaultStatus.isActivated && (
                    <Badge variant="secondary" className="text-[10px] text-green-700 bg-green-100 gap-1">
                      <ShieldCheck className="h-3 w-3" /> Configured
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {vaultLoading ? (
                  <div className="h-16 bg-muted/40 rounded animate-pulse" />
                ) : vaultStatus?.isActivated ? (
                  <div className="flex items-start gap-2 text-amber-700 text-sm">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Succession has been activated. The designated trustee is now carrying authority.</span>
                  </div>
                ) : vaultStatus ? (
                  <div className="space-y-3">
                    <div className="text-sm space-y-1">
                      <div className="font-medium text-foreground">{vaultStatus.delegateName}</div>
                      {vaultStatus.delegateNotes && (
                        <div className="text-xs text-muted-foreground">{vaultStatus.delegateNotes}</div>
                      )}
                      {vaultStatus.instructions && (
                        <div className="mt-2 text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                          {vaultStatus.instructions}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground/70 mt-2">
                        Configured {new Date(vaultStatus.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/5"
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
                      <Input className="mt-1 text-sm" value={vaultNotes} onChange={e => setVaultNotes(e.target.value)} placeholder="Their role, relationship, or contact information" />
                    </div>
                    <div>
                      <Label className="text-xs">Instructions upon activation</Label>
                      <textarea
                        className="mt-1 w-full text-sm border rounded-md p-2 min-h-[72px] bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                        value={vaultInstructions}
                        onChange={e => setVaultInstructions(e.target.value)}
                        placeholder="What should happen if this vault is activated? What should they prioritize?"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        Private Passcode <span className="text-muted-foreground">(min. 8 characters)</span>
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          type={showPasscode ? "text" : "password"}
                          className="text-sm pr-9"
                          value={vaultPasscode}
                          onChange={e => setVaultPasscode(e.target.value)}
                          placeholder="Create a private passcode"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPasscode(v => !v)}
                        >
                          {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Confirm Passcode</Label>
                      <Input
                        type="password"
                        className="mt-1 text-sm"
                        value={vaultPasscode2}
                        onChange={e => setVaultPasscode2(e.target.value)}
                        placeholder="Re-enter passcode to confirm"
                      />
                    </div>
                    {vaultPasscode && vaultPasscode2 && vaultPasscode !== vaultPasscode2 && (
                      <p className="text-xs text-destructive">Passcodes do not match.</p>
                    )}
                    <Button
                      className="w-full gap-2 bg-[#1C2B4B] hover:bg-[#0f1b30] text-white"
                      disabled={
                        createVault.isPending ||
                        !vaultName.trim() ||
                        !vaultPasscode.trim() ||
                        vaultPasscode !== vaultPasscode2 ||
                        vaultPasscode.length < 8
                      }
                      onClick={() => createVault.mutate({
                        delegateName: vaultName,
                        delegateNotes: vaultNotes || undefined,
                        passcode: vaultPasscode,
                        instructions: vaultInstructions || undefined,
                      })}
                    >
                      <Key className="h-4 w-4" />
                      {createVault.isPending ? "Securing…" : "Secure the Vault"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Emergency Activation (any officer with the passcode) ── */}
          <Card className="border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" /> Emergency Succession Activation
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                For use only when the Chief Justice cannot function in their role.
                Enter the private passcode to activate the pre-designated succession provision.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {vaultStatus?.isActivated ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    Succession is active as of{" "}
                    {vaultStatus.activatedAt ? new Date(vaultStatus.activatedAt).toLocaleString() : "recently"}.
                  </div>
                  {vaultStatus.instructions && (
                    <p className="text-xs text-muted-foreground border-l-2 border-amber-300 pl-2">
                      {vaultStatus.instructions}
                    </p>
                  )}
                </div>
              ) : !showActivate ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-amber-500/40 text-amber-700 hover:bg-amber-50"
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

    </div>
  );
}
