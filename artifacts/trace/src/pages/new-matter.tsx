import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { FilePlus2, Upload, AlertCircle, Loader2, Flag } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MATTER_TYPES = [
  { value: "apa_review",        label: "APA Review" },
  { value: "cfr_review",        label: "CFR Review" },
  { value: "niac_review",       label: "NIAC Review" },
  { value: "indigenous_rights", label: "Indigenous Rights" },
  { value: "oversight_trigger", label: "Oversight Trigger" },
  { value: "general",           label: "General" },
];

const SOURCE_TYPES = [
  { value: "manual",      label: "Manual Entry" },
  { value: "email",       label: "Email Intake" },
  { value: "intake_link", label: "Intake Link" },
];

const RISK_LEVELS = [
  { value: "low",      label: "Low" },
  { value: "medium",   label: "Medium" },
  { value: "high",     label: "High" },
  { value: "critical", label: "Critical" },
];

const NIAC_REVIEW_TYPES = [
  { value: "",                    label: "— Select review type —" },
  { value: "Informational",       label: "Informational" },
  { value: "Procedural",          label: "Procedural" },
  { value: "Oversight",           label: "Oversight" },
  { value: "Tribal-Court-Related",label: "Tribal Court Related" },
  { value: "NIAC-Political",      label: "NIAC Political" },
  { value: "Document-Assistance", label: "Document Assistance" },
  { value: "Federal-Pathway",     label: "Federal Pathway" },
  { value: "Formal-Escalation",   label: "Formal Escalation" },
];

export default function NewMatterPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"manual" | "upload">("manual");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    matterType: "general",
    sourceType: "manual",
    riskLevel: "low",
    niacPathway: false,
    niacReviewType: "",
    deadlineAt: "",
  });

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadText, setUploadText] = useState("");
  const [uploadError, setUploadError] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (mode === "upload") {
        if (uploadFile) {
          const fd = new FormData();
          fd.append("file", uploadFile);
          fd.append("title", form.title);
          fd.append("matterType", form.matterType);
          fd.append("niacPathway", String(form.niacPathway));
          if (form.niacReviewType) fd.append("niacReviewType", form.niacReviewType);
          if (form.deadlineAt) fd.append("deadlineAt", form.deadlineAt);
          return api.uploadMatter(fd);
        } else {
          return api.uploadMatterText({
            title: form.title,
            extractedText: uploadText,
            matterType: form.matterType,
            niacReviewType: form.niacReviewType || undefined,
            niacPathway: form.niacPathway,
            deadlineAt: form.deadlineAt || undefined,
          });
        }
      } else {
        return api.createMatter({
          title: form.title,
          description: form.description,
          sourceType: form.sourceType,
          matterType: form.matterType,
          niacReviewType: form.niacReviewType || undefined,
          riskLevel: form.riskLevel,
          niacPathway: form.niacPathway,
          deadlineAt: form.deadlineAt || undefined,
        });
      }
    },
    onSuccess: (matter) => {
      navigate(`/matters/${matter.id}`);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError("");
    const isText = file.type.startsWith("text/") || file.name.match(/\.(txt|md|csv)$/i);
    if (isText) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadText(ev.target?.result as string ?? "");
      reader.readAsText(file);
    } else if (file.type === "application/pdf") {
      setUploadText("");
    } else {
      setUploadError("Unsupported file type. Use PDF, TXT, or MD.");
      setUploadFile(null);
    }
  }

  const canSubmit =
    form.title.trim() &&
    (mode === "manual"
      ? form.description.trim()
      : uploadFile !== null || uploadText.trim());

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <FilePlus2 className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">New Matter</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Submit a new matter for procedural analysis and compliance review.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("manual")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors",
            mode === "manual"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border hover:bg-muted"
          )}
        >
          <FilePlus2 className="h-4 w-4" />
          Manual Entry
        </button>
        <button
          onClick={() => setMode("upload")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors",
            mode === "upload"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border hover:bg-muted"
          )}
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-5 space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Matter Title</Label>
          <Input
            id="title"
            placeholder="Brief descriptive title for this matter"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        {/* Description / Upload */}
        {mode === "manual" ? (
          <div className="space-y-1.5">
            <Label htmlFor="description">Matter Description</Label>
            <textarea
              id="description"
              placeholder="Full description of the matter — include all relevant facts, dates, parties, and procedural background."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={8}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Document Upload</Label>
            <div
              className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              {uploadFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadFile.size / 1024).toFixed(1)} KB
                    {uploadFile.type === "application/pdf" && " — PDF text will be extracted server-side"}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-1">
                    Click to upload PDF, TXT, or MD files (max 20 MB)
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    PDF text is extracted server-side; text files are read directly
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.pdf,text/plain,text/markdown,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}
            <div className="space-y-1.5">
              <Label>Or paste document text</Label>
              <textarea
                placeholder="Paste extracted or copied document text here (alternative to file upload)"
                value={uploadText}
                onChange={(e) => { setUploadText(e.target.value); setUploadFile(null); }}
                rows={5}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </div>
          </div>
        )}

        {/* Row: Matter Type + Source Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Matter Type</Label>
            <select
              value={form.matterType}
              onChange={(e) => setForm({ ...form, matterType: e.target.value })}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {MATTER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {mode === "manual" && (
            <div className="space-y-1.5">
              <Label>Source Type</Label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-1.5">
              <Label>Initial Risk Level</Label>
              <select
                value={form.riskLevel}
                onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {RISK_LEVELS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Deadline</Label>
            <Input
              type="date"
              value={form.deadlineAt}
              onChange={(e) => setForm({ ...form, deadlineAt: e.target.value })}
            />
          </div>
        </div>

        {/* NIAC toggle */}
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="niac"
              checked={form.niacPathway}
              onChange={(e) => setForm({ ...form, niacPathway: e.target.checked, niacReviewType: e.target.checked ? form.niacReviewType : "" })}
              className="mt-0.5"
            />
            <div>
              <label htmlFor="niac" className="text-sm font-medium text-foreground flex items-center gap-1.5 cursor-pointer">
                <Flag className="h-4 w-4 text-purple-600" />
                Flag for NIAC Review Pathway
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                National Indigenous American Committee (527 org) — Indigenous rights review.
                Flag if this matter involves treaty rights, federal Indian law, or tribal political interests.
              </p>
            </div>
          </div>

          {form.niacPathway && (
            <div className="space-y-1.5 pl-6">
              <Label>NIAC Review Type</Label>
              <select
                value={form.niacReviewType}
                onChange={(e) => setForm({ ...form, niacReviewType: e.target.value })}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {NIAC_REVIEW_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {createMutation.error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {(createMutation.error as ApiError)?.status === 403
              ? "Access denied. You do not have permission to create TRACE matters."
              : (createMutation.error as Error).message}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Matter
          </Button>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
