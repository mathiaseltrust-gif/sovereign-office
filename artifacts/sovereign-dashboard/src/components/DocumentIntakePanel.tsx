import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Feather, ShieldAlert, X,
  MapPin, Scale, Landmark, FolderCheck, ArrowRight,
  FileBadge2, Tag, Building2,
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

interface ClassifyResult {
  source: "ai" | "rule";
  documentType: string;
  documentTypeLabel: string;
  confidence: "high" | "medium" | "low";
  extractedFields: {
    parcelId?: string | null;
    propertyAddress?: string | null;
    taxYear?: string | null;
    ownerOnRecord?: string | null;
    petitioner?: string | null;
    filingBody?: string | null;
    county?: string | null;
    state?: string | null;
    reliefRequested?: string | null;
    tribalEntity?: string | null;
    federalCitationsFound?: string[];
    amounts?: string[];
    dates?: string[];
  };
  signalType: string | null;
  routingTargets: string[];
  filename: string;
}

interface ApplyResult {
  success: boolean;
  documentType: string;
  label: string;
  created: {
    parcel?: { action: string; id: number; parcelId: string; tribalRef?: string };
    encumbrance?: { id: number };
    courtDocument?: { id: number; tribalRef: string };
    nfrSignal?: { signalType: string };
  };
}

const RISK_COLOR: Record<string, string> = {
  critical:  "bg-red-700",
  elevated:  "bg-orange-600",
  moderate:  "bg-yellow-600",
  low:       "bg-emerald-700",
  emergency: "bg-red-900",
};

const RISK_LABEL: Record<string, string> = {
  critical:  "Critical — Office Review Required",
  elevated:  "Elevated — Potential Violation",
  moderate:  "Moderate — Review Recommended",
  low:       "Low — No Immediate Concern",
  emergency: "Emergency — Immediate Action Required",
};

const ROUTING_ICONS: Record<string, React.ReactNode> = {
  land_parcel:       <MapPin className="w-3 h-3" />,
  court_document:    <Scale className="w-3 h-3" />,
  nfr_investigation: <ShieldAlert className="w-3 h-3" />,
  encumbrance:       <Landmark className="w-3 h-3" />,
};

const ROUTING_LABELS: Record<string, string> = {
  land_parcel:       "Land Parcel Record",
  court_document:    "Court Document",
  nfr_investigation: "NFR Investigation",
  encumbrance:       "Land Encumbrance",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   "text-emerald-400",
  medium: "text-amber-400",
  low:    "text-red-400/70",
};

function riskLevel(report: IntakeReport): string {
  return (report.riskLevel ?? report.tier ?? "low").toLowerCase();
}

type Step = "idle" | "uploading" | "analyzing" | "kaya" | "classifying" | "done";

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
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState<Step>("idle");

  const authHeader = { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };

  function clearState() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedText(null);
    setIntakeReport(null);
    setKayaExplanation(null);
    setClassifyResult(null);
    setApplyResult(null);
    setApplying(false);
    setStep("idle");
  }

  async function processFile(file: File) {
    clearState();
    setSelectedFile(file);

    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);

    try {
      // ── Step 1: Upload + extract text ──────────────────────────────────────
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
        throw new Error((e as Record<string,string>).error ?? "Failed to extract document text");
      }
      const uploadData = await uploadRes.json() as { text?: string };
      const text: string = uploadData.text ?? "";
      setExtractedText(text);

      if (!text.trim()) {
        toast({ title: "Could not read document", description: "No readable text was found.", variant: "destructive" });
        setStep("idle");
        return;
      }

      // ── Step 2: Sovereign intake analysis ──────────────────────────────────
      setStep("analyzing");
      const intakeRes = await fetch("/api/intake", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!intakeRes.ok) {
        const e = await intakeRes.json().catch(() => ({}));
        throw new Error((e as Record<string,string>).error ?? "Intake analysis failed");
      }
      const report = await intakeRes.json() as IntakeReport;
      setIntakeReport(report);

      // ── Step 3: COMPANION review ────────────────────────────────────────────
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
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json() as { reply?: string };
        setKayaExplanation(reviewData.reply ?? "");
        qc.invalidateQueries({ queryKey: ["kaya-history"] });
      }

      // ── Step 4: Classify + route ────────────────────────────────────────────
      setStep("classifying");
      const classifyRes = await fetch("/api/intake/classify-and-route", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: file.name }),
      });
      if (classifyRes.ok) {
        const cr = await classifyRes.json() as ClassifyResult;
        setClassifyResult(cr);
      }

      setStep("done");
    } catch (err) {
      toast({ title: "Review error", description: (err as Error).message, variant: "destructive" });
      setStep("idle");
    }
  }

  async function applyFiling() {
    if (!classifyResult || !extractedText) return;
    setApplying(true);
    try {
      const res = await fetch("/api/intake/apply-filing", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...classifyResult,
          text: extractedText,
          filename: selectedFile?.name,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as Record<string,string>).error ?? "Filing failed");
      }
      const result = await res.json() as ApplyResult;
      setApplyResult(result);
      qc.invalidateQueries({ queryKey: ["land-parcels"] });
      qc.invalidateQueries({ queryKey: ["court-documents"] });
      qc.invalidateQueries({ queryKey: ["active-matters"] });
      toast({ title: "Document filed", description: `${result.label} has been processed and routed.` });
    } catch (err) {
      toast({ title: "Filing error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setApplying(false);
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
            <p className="text-sm font-bold text-white leading-none">Document Review & Filing</p>
            <p className="text-[9px] tracking-[0.18em] text-white/40 uppercase mt-0.5">
              Sovereign Intake · Auto-classify · Apply to records
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
          Upload a document — the system auto-classifies it, extracts key fields, and routes it to the right records.
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
              <p className="text-[10px] text-white/20 mt-1">
                Tax notices, petitions, certificates, deeds, court orders, ICWA documents, receipts…
              </p>
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
          {(step === "uploading" || step === "analyzing" || step === "kaya" || step === "classifying") && (
            <div
              className="rounded-lg px-4 py-5 flex flex-col items-center gap-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Loader2 className="w-6 h-6 text-blue-400/70 animate-spin" />
              <p className="text-sm text-white/60">
                {step === "uploading"    && `Reading ${selectedFile?.name}…`}
                {step === "analyzing"   && "Running sovereign intake analysis…"}
                {step === "kaya"        && "COMPANION is reviewing the findings…"}
                {step === "classifying" && "Classifying document and extracting fields…"}
              </p>
              {/* Mini progress bar */}
              <div className="w-48 h-0.5 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    background: "rgba(100,149,237,0.6)",
                    width: step === "uploading" ? "20%"
                      : step === "analyzing" ? "50%"
                      : step === "kaya" ? "75%"
                      : "90%",
                  }}
                />
              </div>
            </div>
          )}

          {/* Results */}
          {step === "done" && selectedFile && (
            <div className="space-y-3">
              {/* File header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-white/50" />
                  <p className="text-sm text-white/70 font-medium truncate max-w-[200px]">{selectedFile.name}</p>
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
                    style={{ height: 320, border: "none" }}
                    title="Document preview"
                  />
                </div>
              )}

              {/* ── Classification result ─────────────────────────────────── */}
              {classifyResult && !applyResult && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(100,149,237,0.18)", background: "rgba(10,20,50,0.6)" }}
                >
                  {/* Classification header */}
                  <div
                    className="px-3 py-2 flex items-center gap-2"
                    style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(100,149,237,0.12)" }}
                  >
                    <FileBadge2 className="w-3.5 h-3.5 text-blue-400/70" />
                    <p className="text-[9px] tracking-[0.18em] text-blue-400/70 uppercase font-semibold flex-1">
                      Document Classified
                    </p>
                    <span className={`text-[9px] font-semibold uppercase ${CONFIDENCE_COLOR[classifyResult.confidence]}`}>
                      {classifyResult.confidence} confidence
                    </span>
                  </div>

                  <div className="p-3 space-y-3">
                    {/* Document type */}
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-blue-300/60 flex-shrink-0" />
                      <p className="text-sm font-semibold text-white/90">{classifyResult.documentTypeLabel}</p>
                    </div>

                    {/* Extracted fields grid */}
                    {(() => {
                      const f = classifyResult.extractedFields;
                      const fieldRows = [
                        f.parcelId        && { label: "Parcel ID",       value: f.parcelId },
                        f.propertyAddress && { label: "Property",        value: f.propertyAddress },
                        f.taxYear         && { label: "Tax Year",        value: f.taxYear },
                        f.ownerOnRecord   && { label: "Owner of Record", value: f.ownerOnRecord },
                        f.petitioner      && { label: "Petitioner",      value: f.petitioner },
                        f.filingBody      && { label: "Filed With",      value: f.filingBody },
                        f.county          && { label: "County",          value: f.county + (f.state ? `, ${f.state}` : "") },
                        f.tribalEntity    && { label: "Tribal Entity",   value: f.tribalEntity },
                        f.reliefRequested && { label: "Relief Sought",   value: f.reliefRequested },
                      ].filter(Boolean) as Array<{ label: string; value: string }>;

                      if (fieldRows.length === 0) return null;
                      return (
                        <div className="grid grid-cols-1 gap-1.5">
                          {fieldRows.map(({ label, value }) => (
                            <div key={label} className="flex items-start gap-2">
                              <span
                                className="text-[9px] tracking-widest uppercase text-white/35 font-semibold flex-shrink-0 pt-0.5"
                                style={{ minWidth: 90 }}
                              >
                                {label}
                              </span>
                              <span className="text-[11px] text-white/75 leading-tight">{value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Federal citations */}
                    {(classifyResult.extractedFields.federalCitationsFound?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[9px] tracking-widest uppercase text-white/30 font-semibold mb-1">Federal Citations Found</p>
                        <div className="space-y-0.5">
                          {classifyResult.extractedFields.federalCitationsFound!.slice(0, 4).map((c, i) => (
                            <p key={i} className="text-[10px] text-blue-300/60 font-mono leading-tight">• {c}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Routing targets */}
                    <div>
                      <p className="text-[9px] tracking-widest uppercase text-white/30 font-semibold mb-1.5">
                        Will be filed to
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {classifyResult.routingTargets.map(t => (
                          <div
                            key={t}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-white/60"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                          >
                            <span className="text-white/40">{ROUTING_ICONS[t]}</span>
                            {ROUTING_LABELS[t] ?? t}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* NFR signal */}
                    {classifyResult.signalType && (
                      <div
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                        style={{ background: "rgba(180,60,0,0.12)", border: "1px solid rgba(180,60,0,0.2)" }}
                      >
                        <AlertTriangle className="w-3 h-3 text-orange-400/70 flex-shrink-0" />
                        <p className="text-[10px] text-orange-300/70">
                          NFR signal: <span className="font-mono">{classifyResult.signalType}</span> will be triggered
                        </p>
                      </div>
                    )}

                    {/* Apply & File button */}
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      style={{
                        background: "linear-gradient(135deg, #1a3a6b 0%, #0d2040 100%)",
                        border: "1px solid rgba(100,149,237,0.3)",
                        color: "rgba(255,255,255,0.9)",
                      }}
                      onClick={applyFiling}
                      disabled={applying}
                    >
                      {applying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          Filing document…
                        </>
                      ) : (
                        <>
                          <FolderCheck className="w-3.5 h-3.5 mr-2" />
                          Apply &amp; File This Document
                          <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Apply result ──────────────────────────────────────────── */}
              {applyResult && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(0,180,80,0.2)", background: "rgba(0,40,15,0.5)" }}
                >
                  <div
                    className="px-3 py-2 flex items-center gap-2"
                    style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(0,180,80,0.12)" }}
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400/70" />
                    <p className="text-[9px] tracking-[0.18em] text-emerald-400/70 uppercase font-semibold">
                      Document Filed &amp; Routed
                    </p>
                  </div>
                  <div className="p-3 space-y-2">
                    {applyResult.created.courtDocument && (
                      <div className="flex items-center gap-2">
                        <Scale className="w-3.5 h-3.5 text-blue-400/60 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-white/55">Court Document</p>
                          <p className="text-[11px] text-white/85 font-mono">{applyResult.created.courtDocument.tribalRef}</p>
                        </div>
                      </div>
                    )}
                    {applyResult.created.parcel && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-white/55">Land Parcel — {applyResult.created.parcel.action}</p>
                          <p className="text-[11px] text-white/85">
                            Parcel {applyResult.created.parcel.parcelId}
                            {applyResult.created.parcel.tribalRef ? ` · ${applyResult.created.parcel.tribalRef}` : ""}
                          </p>
                        </div>
                      </div>
                    )}
                    {applyResult.created.encumbrance && (
                      <div className="flex items-center gap-2">
                        <Landmark className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-white/55">Encumbrance Recorded</p>
                          <p className="text-[11px] text-white/70">Marked disputed · void ab initio under federal Indian law</p>
                        </div>
                      </div>
                    )}
                    {applyResult.created.nfrSignal && (
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-orange-400/60 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-white/55">NFR Investigation Opened</p>
                          <p className="text-[11px] text-white/70 font-mono">{applyResult.created.nfrSignal.signalType}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-emerald-400/50 mt-1">
                      All records created. Check Land Records and Active Matters for details.
                    </p>
                  </div>
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
