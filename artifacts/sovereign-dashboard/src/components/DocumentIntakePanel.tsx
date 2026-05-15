import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Feather, ShieldAlert, X,
} from "lucide-react";

interface IntakeReport {
  riskLevel?: string;
  tier?: string;
  violations?: string[];
  doctrinesTriggered?: string[];
  summary?: string;
  factSummary?: string;
  recommendation?: string;
  canonicalPosture?: string;
  redFlag?: boolean;
  troRecommended?: boolean;
  indianStatusViolation?: boolean;
}

const RISK_COLOR: Record<string, string> = {
  critical: "bg-red-700",
  elevated: "bg-orange-600",
  moderate: "bg-yellow-600",
  low: "bg-emerald-700",
  emergency: "bg-red-900",
};

const RISK_LABEL: Record<string, string> = {
  critical: "Critical — Office Review Required",
  elevated: "Elevated — Potential Violation",
  moderate: "Moderate — Review Recommended",
  low: "Low — No Immediate Concern",
  emergency: "Emergency — Immediate Action Required",
};

function riskLevel(report: IntakeReport): string {
  return (report.riskLevel ?? report.tier ?? "low").toLowerCase();
}

export function DocumentIntakePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [intakeReport, setIntakeReport] = useState<IntakeReport | null>(null);
  const [kayaExplanation, setKayaExplanation] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "uploading" | "analyzing" | "kaya" | "done">("idle");

  const authHeader = { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };

  function clearState() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedText(null);
    setIntakeReport(null);
    setKayaExplanation(null);
    setStep("idle");
  }

  async function processFile(file: File) {
    clearState();
    setSelectedFile(file);

    // Create local preview URL for PDF display
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);

    try {
      // Step 1: Extract text
      setStep("uploading");
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/intake/upload", {
        method: "POST",
        headers: authHeader,
        body: formData,
      });
      if (!uploadRes.ok) {
        const e = await uploadRes.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Failed to extract document text");
      }
      const uploadData = await uploadRes.json();
      const text: string = uploadData.text ?? "";
      setExtractedText(text);

      if (!text.trim()) {
        toast({ title: "Could not read document", description: "No readable text was found.", variant: "destructive" });
        setStep("idle");
        return;
      }

      // Step 2: Run intake analysis
      setStep("analyzing");
      const intakeRes = await fetch("/api/intake", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!intakeRes.ok) {
        const e = await intakeRes.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Intake analysis failed");
      }
      const report: IntakeReport = await intakeRes.json();
      setIntakeReport(report);

      // Step 3: Kaya explains the findings
      setStep("kaya");
      const reviewRes = await fetch("/api/kaya/review", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          riskLevel: riskLevel(report),
          violations: report.violations ?? [],
          doctrines: report.doctrinesTriggered ?? [],
          summary: report.summary ?? report.factSummary ?? "",
          recommendation: report.recommendation ?? "",
          canonicalPosture: report.canonicalPosture ?? "",
          redFlag: report.redFlag ?? false,
          troRecommended: report.troRecommended ?? false,
        }),
      });
      if (!reviewRes.ok) {
        throw new Error("COMPANION review unavailable");
      }
      const reviewData = await reviewRes.json();
      setKayaExplanation(reviewData.reply ?? "");
      qc.invalidateQueries({ queryKey: ["kaya-history"] });
      setStep("done");
    } catch (err) {
      toast({ title: "Review error", description: (err as Error).message, variant: "destructive" });
      setStep("idle");
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    processFile(files[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  const risk = intakeReport ? riskLevel(intakeReport) : null;
  const isPdf = selectedFile?.type === "application/pdf" || selectedFile?.name.endsWith(".pdf");

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(160deg, #080d14 0%, #030608 100%)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #0d2040 0%, #1a3a6b 100%)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <ShieldAlert className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Document Review</p>
            <p className="text-[9px] tracking-[0.18em] text-white/40 uppercase mt-0.5">
              Sovereign Intake · COMPANION explains findings
            </p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-white/30 hover:text-white/70 transition-colors p-1"
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {collapsed && (
        <div className="px-4 py-2 text-[11px] text-white/25 italic">
          Upload a document for sovereign intake review — COMPANION will explain what she finds.
        </div>
      )}

      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Dropzone */}
          {step === "idle" && !selectedFile && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="rounded-lg border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-8 gap-2 transition-all"
              style={{
                borderColor: dragOver ? "rgba(100,149,237,0.5)" : "rgba(255,255,255,0.1)",
                background: dragOver ? "rgba(100,149,237,0.06)" : "rgba(255,255,255,0.02)",
              }}
            >
              <Upload className="w-7 h-7 text-white/25" />
              <p className="text-sm text-white/50 font-medium">Drop a document here or click to browse</p>
              <p className="text-[11px] text-white/25">PDF · DOC · DOCX · TXT · Images · CSV — up to 20 MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp"
            onChange={e => handleFiles(e.target.files)}
          />

          {/* Processing states */}
          {(step === "uploading" || step === "analyzing" || step === "kaya") && (
            <div className="rounded-lg px-4 py-5 flex flex-col items-center gap-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Loader2 className="w-6 h-6 text-blue-400/70 animate-spin" />
              <p className="text-sm text-white/60">
                {step === "uploading" && `Reading ${selectedFile?.name}…`}
                {step === "analyzing" && "Running sovereign intake analysis…"}
                {step === "kaya" && "COMPANION is reviewing the findings…"}
              </p>
            </div>
          )}

          {/* Document preview + results */}
          {step === "done" && selectedFile && (
            <div className="space-y-3">
              {/* File header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-white/50" />
                  <p className="text-sm text-white/70 font-medium truncate max-w-xs">{selectedFile.name}</p>
                  {risk && (
                    <Badge className={`${RISK_COLOR[risk] ?? "bg-slate-600"} text-white text-[10px] px-2`}>
                      {risk.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <button onClick={clearState} className="text-white/25 hover:text-white/60 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* PDF Viewer */}
              {isPdf && previewUrl && (
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-[9px] tracking-[0.15em] text-white/30 uppercase px-2 py-1"
                    style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    Document Preview
                  </p>
                  <iframe
                    src={previewUrl}
                    className="w-full"
                    style={{ height: 380, border: "none" }}
                    title="Document preview"
                  />
                </div>
              )}

              {/* Violations found */}
              {intakeReport && (intakeReport.violations?.length ?? 0) > 0 && (
                <div className="rounded-lg px-3 py-2.5 space-y-1.5"
                  style={{ background: "rgba(180,40,0,0.1)", border: "1px solid rgba(180,40,0,0.2)" }}>
                  <p className="text-[9px] tracking-[0.15em] text-red-400/80 uppercase font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Violations Detected
                  </p>
                  {intakeReport.violations!.map((v, i) => (
                    <p key={i} className="text-[11px] text-white/65">• {v}</p>
                  ))}
                </div>
              )}

              {/* COMPANION's explanation */}
              {kayaExplanation && (
                <div className="rounded-xl px-3.5 py-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Feather className="w-3.5 h-3.5 text-amber-400/70" />
                    <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold">COMPANION — Document Review</p>
                  </div>
                  <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{kayaExplanation}</p>
                </div>
              )}

              {/* No violations found */}
              {intakeReport && !intakeReport.redFlag && (intakeReport.violations?.length ?? 0) === 0 && (
                <div className="rounded-lg px-3 py-2 flex items-center gap-2"
                  style={{ background: "rgba(0,120,40,0.1)", border: "1px solid rgba(0,150,50,0.2)" }}>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400/70 flex-shrink-0" />
                  <p className="text-[11px] text-white/55">No immediate violations flagged. COMPANION's notes are saved in your chat.</p>
                </div>
              )}

              {/* Review another */}
              <button
                onClick={clearState}
                className="text-[11px] text-white/30 hover:text-white/60 transition-colors mt-1"
              >
                + Review another document
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
