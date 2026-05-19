import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { removeBackground } from "@imgly/background-removal";
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
  Key, UserCheck, ShieldAlert, Trash2, Clock, Edit2, Feather, Save,
  Download, CreditCard, ScanLine, IdCard, Info,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "";

const SIG_FONTS: { key: string; label: string }[] = [
  { key: "Dancing Script", label: "Dancing Script" },
  { key: "Great Vibes", label: "Great Vibes" },
  { key: "Pinyon Script", label: "Pinyon Script" },
  { key: "Alex Brush", label: "Alex Brush" },
];

const SIG_TYPES = [
  {
    key: "script",
    label: "Script",
    sub: "Cursive · ID card & general use",
    defaultFont: "Dancing Script",
  },
  {
    key: "legal",
    label: "Legal  /s/",
    sub: "Typed · court filings & formal docs",
    defaultFont: "Times New Roman",
  },
] as const;
type SigType = typeof SIG_TYPES[number]["key"];

const SIG_COLORS: { key: string; label: string; hex: string }[] = [
  { key: "black", label: "Black", hex: "#111111" },
  { key: "blue",  label: "Blue",  hex: "#1a3a6e" },
  { key: "grey",  label: "Grey",  hex: "#888888" },
];

const SIG_PRESETS = [
  "Chief Mathias El",
  "Mathew-Allen: McCaster",
];

const stripSlashS = (name: string) => name.replace(/^\/s\/\s*/i, "").trim();

/* ── Land Record Panel ── */
interface LandRecord {
  apn?: string | null;
  mailingAddress?: string | null;
  landStatus?: string | null;
  legalDescription?: string | null;
  hasRecordedInstrument?: boolean;
  tribalLandCode?: string | null;
  docNumbers?: string[] | null;
  landRestrictionBasis?: string[] | null;
  landClassification?: string | null;
  selfExecuting?: boolean;
}

function LandRecordPanel() {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<LandRecord>({});

  const { data, isLoading, refetch } = useQuery<LandRecord>({
    queryKey: ["land-record"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/identity/land`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error("Could not load land record");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => { if (data) setForm(data); }, [data]);

  const saveMut = useMutation({
    mutationFn: async (payload: LandRecord) => {
      const r = await fetch(`${API}/api/identity/land`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Land record saved" }); setEditing(false); refetch(); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const em = (v?: string | null) => v || <span className="text-muted-foreground/40 italic text-[10px]">—</span>;

  if (isLoading) return (
    <div className="space-y-2 pt-2">
      {[1, 2, 3].map(i => <div key={i} className="h-6 bg-muted animate-pulse rounded" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      {!editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Parcel (APN)</div>
              <div className="text-xs font-mono">{em(data?.apn)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Tribal Land Code</div>
              <div className="text-xs font-mono">{em(data?.tribalLandCode)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 sm:col-span-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Property Address</div>
              <div className="text-xs">{em(data?.mailingAddress)}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Legal Description</div>
            <div className="text-xs leading-relaxed">{em(data?.legalDescription)}</div>
          </div>

          {data?.docNumbers && data.docNumbers.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Recorded Documents</div>
              <div className="flex flex-wrap gap-1.5">
                {data.docNumbers.map((d, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-background border border-border">{d}</span>
                ))}
              </div>
            </div>
          )}

          {data?.landRestrictionBasis && data.landRestrictionBasis.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Restriction Basis</div>
              <div className="space-y-0.5">
                {data.landRestrictionBasis.map((b, i) => (
                  <div key={i} className="text-[10px] flex items-start gap-1.5">
                    <span className="text-green-600 shrink-0 mt-0.5">•</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${data?.hasRecordedInstrument ? "border-green-300 text-green-700 bg-green-50" : "border-border text-muted-foreground"}`}>
              Recorded Instrument: {data?.hasRecordedInstrument ? "Yes" : "No"}
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${data?.selfExecuting ? "border-green-300 text-green-700 bg-green-50" : "border-border text-muted-foreground"}`}>
              Self-Executing: {data?.selfExecuting ? "Yes" : "No"}
            </span>
          </div>

          <button onClick={() => setEditing(true)} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
            Edit parcel details
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">APN</Label>
              <Input className="text-xs h-8 font-mono" value={form.apn ?? ""} onChange={e => setForm(p => ({ ...p, apn: e.target.value }))} placeholder="514-364-11-00-1" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Tribal Land Code</Label>
              <Input className="text-xs h-8 font-mono" value={form.tribalLandCode ?? ""} onChange={e => setForm(p => ({ ...p, tribalLandCode: e.target.value }))} placeholder="MET-TL-BC-001" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Property Address</Label>
            <Input className="text-xs h-8" value={form.mailingAddress ?? ""} onChange={e => setForm(p => ({ ...p, mailingAddress: e.target.value }))} placeholder="Street, City, State ZIP" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Legal Description</Label>
            <Textarea className="text-xs min-h-[70px]" value={form.legalDescription ?? ""} onChange={e => setForm(p => ({ ...p, legalDescription: e.target.value }))} placeholder="Lot description from deed..." />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Land Classification</Label>
            <Input className="text-xs h-8" value={form.landClassification ?? ""} onChange={e => setForm(p => ({ ...p, landClassification: e.target.value }))} placeholder="e.g. Tribal Housing / General Welfare Land" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Document Numbers (comma-separated)</Label>
            <Input className="text-xs h-8 font-mono" value={(form.docNumbers ?? []).join(", ")} onChange={e => setForm(p => ({ ...p, docNumbers: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} placeholder="224042175, 223043047" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Restriction Basis (one per line)</Label>
            <Textarea className="text-xs min-h-[70px]" value={(form.landRestrictionBasis ?? []).join("\n")} onChange={e => setForm(p => ({ ...p, landRestrictionBasis: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) }))} placeholder={"25 U.S.C. § 177 (Non-Intercourse Act)\nILCA provisions"} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.hasRecordedInstrument ?? false} onChange={e => setForm(p => ({ ...p, hasRecordedInstrument: e.target.checked }))} className="h-3 w-3" />
              <span className="text-[10px] text-muted-foreground">Recorded Instrument on File</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.selfExecuting ?? false} onChange={e => setForm(p => ({ ...p, selfExecuting: e.target.checked }))} className="h-3 w-3" />
              <span className="text-[10px] text-muted-foreground">Self-Executing Protections</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Save
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(false); if (data) setForm(data); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Barcode Scanner Overlay ── */
function BarcodeScannerOverlay({
  onSuccess,
  onCancel,
}: {
  onSuccess: (text: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current!,
        (result, err) => {
          if (result && !detectedRef.current) {
            detectedRef.current = true;
            setDetected(true);
            controlsRef.current?.stop();
            onSuccess(result.getText());
          }
          if (err && !(err instanceof NotFoundException)) {
            console.warn("[BarcodeScanner]", err);
          }
        },
      )
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch((e: Error) => {
        const msg = e?.message ?? "";
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
          setCameraError("Camera permission was denied. Please allow camera access and try again.");
        } else {
          setCameraError(msg || "Unable to start camera.");
        }
      });

    return () => {
      try { controlsRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  if (cameraError) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-destructive">Camera unavailable</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{cameraError}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={onCancel}>
          <Upload className="h-3.5 w-3.5" /> Upload a photo instead
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Aim at the barcode on the back of your ID</p>
        <button onClick={onCancel} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
          Use file upload instead
        </button>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black" style={{ aspectRatio: "4/3" }}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-[85%]" style={{ aspectRatio: "3.375" }}>
            <div className="absolute inset-0 border-2 border-white/70 rounded-md" />
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br-sm" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-primary/60 animate-pulse" />
          </div>
        </div>
        <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
          <span className="text-[10px] text-white/80 bg-black/50 px-2.5 py-1 rounded-full">
            {detected ? "Barcode detected…" : "Hold steady — scanning PDF417 barcode"}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        The barcode is on the back of most driver's licenses. Hold your camera 6–12 inches away in good lighting.
      </p>

      <Button size="sm" variant="ghost" className="h-8 text-xs w-full" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/* ── ID Document Panel ── */
interface ExtractedIdFields {
  documentType: string;
  issuingJurisdictionCode: string;
  issuingJurisdictionName: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  expiryDate: string;
  issueDate: string;
  idNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  fullAddress: string;
  sex: string;
  eyeColor: string;
  height: string;
  vehicleClass?: string;
  restrictions?: string;
  endorsements?: string;
  extractionMethod: "barcode" | "vision_ocr" | "none";
  confidenceScore: number;
}

interface JurisdictionAdvisory {
  hasAdvisory: boolean;
  level: "info" | "advisory" | "none";
  message: string | null;
  tribalOverlapNote: string | null;
}

interface IdExtractionResult {
  fields: ExtractedIdFields;
  jurisdictionAdvisory: JurisdictionAdvisory;
  extractionMethod: string;
  confidenceScore: number;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  dl: "Driver's License",
  state_id: "State ID",
  passport: "Passport",
  tribal_id: "Tribal ID",
  auto: "Auto-detect",
  unknown: "ID Document",
};

function IdDocumentPanel({ vaultData }: { vaultData?: { hasIdDocument?: boolean; idDocumentType?: string | null; idDocumentUploadedAt?: string | null; idJurisdictionCode?: string | null } }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"idle" | "upload" | "scan" | "review" | "done">(vaultData?.hasIdDocument ? "done" : "idle");
  const [docType, setDocType] = useState<"auto" | "dl" | "passport" | "tribal">("auto");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<IdExtractionResult | null>(null);
  const [editedFields, setEditedFields] = useState<Partial<ExtractedIdFields>>({});
  const [saving, setSaving] = useState(false);
  const [updateAddress, setUpdateAddress] = useState<boolean | null>(null);
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (side: "front" | "back", file: File) => {
    const url = URL.createObjectURL(file);
    if (side === "front") { setFrontFile(file); setFrontPreview(url); }
    else { setBackFile(file); setBackPreview(url); }
  };

  const handleExtract = async () => {
    if (!frontFile && !backFile) {
      toast({ title: "Upload at least one side of the ID", variant: "destructive" });
      return;
    }
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("docType", docType);
      if (frontFile) fd.append("front", frontFile);
      if (backFile) fd.append("back", backFile);

      const resp = await fetch(`${API}/api/user/id-document`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: fd,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Extraction failed");
      }
      const data: IdExtractionResult & { scanSessionId?: string } = await resp.json();
      setResult(data);
      setEditedFields(data.fields);
      setUpdateAddress(null);
      setScanSessionId(data.scanSessionId ?? null);
      setStep("review");
    } catch (err) {
      toast({ title: "Could not extract ID data", description: (err as Error).message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleBarcodeScanned = async (barcodeText: string) => {
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("docType", "dl");
      fd.append("barcodeText", barcodeText);

      const resp = await fetch(`${API}/api/user/id-document`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: fd,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Extraction failed");
      }
      const data: IdExtractionResult & { scanSessionId?: string } = await resp.json();
      setResult(data);
      setEditedFields(data.fields);
      setUpdateAddress(null);
      setScanSessionId(data.scanSessionId ?? null);
      setStep("review");
    } catch (err) {
      toast({ title: "Could not process barcode", description: (err as Error).message, variant: "destructive" });
      setStep("upload");
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirm = async () => {
    if (!result) return;
    if (updateAddress === null) {
      toast({ title: "Please answer the mailing address question before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const merged = { ...result.fields, ...editedFields };
      const resp = await fetch(`${API}/api/user/id-document/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: JSON.stringify({
          fields: merged,
          scanSessionId: scanSessionId ?? undefined,
          idDocumentType: merged.documentType,
          idJurisdictionCode: merged.issuingJurisdictionCode,
          jurisdictionAdvisory: result.jurisdictionAdvisory,
          updateVault: updateAddress,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Save failed");
      }
      setStep("done");
      toast({
        title: "ID document saved",
        description: updateAddress
          ? "Your identity data and mailing address have been updated."
          : "Your identity data has been confirmed. Mailing address was not changed.",
      });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const ef = (key: keyof ExtractedIdFields) => {
    const v = (editedFields as unknown as Record<string, unknown>)[key] ?? (result?.fields as unknown as Record<string, unknown>)?.[key] ?? "";
    return String(v);
  };

  const setEf = (key: keyof ExtractedIdFields, value: string) => {
    setEditedFields((p) => ({ ...p, [key]: value }));
  };

  if (step === "done") {
    const docTypeLabel = DOC_TYPE_LABELS[vaultData?.idDocumentType ?? editedFields.documentType ?? "unknown"] ?? "ID Document";
    const uploadedAt = vaultData?.idDocumentUploadedAt ?? new Date().toISOString();
    const jurisdictionCode = vaultData?.idJurisdictionCode ?? editedFields.issuingJurisdictionCode ?? "";
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 p-3 rounded-lg border border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-green-800">ID on file — {docTypeLabel}</p>
            <p className="text-[10px] text-green-700">
              Uploaded {new Date(uploadedAt).toLocaleDateString()} · Jurisdiction: {jurisdictionCode || "—"}
            </p>
          </div>
          <button
            onClick={() => { setStep("upload"); setResult(null); setEditedFields({}); setFrontFile(null); setBackFile(null); setFrontPreview(null); setBackPreview(null); }}
            className="text-[10px] text-green-700 underline underline-offset-2 hover:text-green-900 transition-colors shrink-0"
          >
            Update
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Your identity document is stored encrypted. Officers can see the document type and upload date. Only Trustees can access the stored images.
        </p>
      </div>
    );
  }

  if (step === "idle") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border border-border">
          <IdCard className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground">No ID on file</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
              Scan or upload your government-issued ID to automatically extract and verify your identity and address. Supports driver's licenses, state IDs, passports, and tribal IDs.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setStep("upload")}>
          <ScanLine className="h-3.5 w-3.5" /> Scan Government ID
        </Button>
      </div>
    );
  }

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Document Type</span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as typeof docType)}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="auto">Auto-detect</option>
            <option value="dl">Driver's License</option>
            <option value="passport">Passport</option>
            <option value="tribal">Tribal ID</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["front", "back"] as const).map((side) => {
            const preview = side === "front" ? frontPreview : backPreview;
            const inputRef = side === "front" ? frontInputRef : backInputRef;
            const file = side === "front" ? frontFile : backFile;
            return (
              <div key={side} className="space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  {side === "front" ? "Front" : "Back"} of ID
                  {file && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                  {side === "back" && docType !== "passport" && <span className="text-[9px] text-muted-foreground">(required for DL barcode)</span>}
                </div>
                <div
                  className={`relative rounded-lg border-2 border-dashed transition-colors cursor-pointer overflow-hidden ${preview ? "border-primary/40" : "border-border hover:border-primary/30"}`}
                  style={{ aspectRatio: "1.586" }}
                  onClick={() => inputRef.current?.click()}
                >
                  {preview ? (
                    <img src={preview} alt={`ID ${side}`} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted/20">
                      <Camera className="h-6 w-6 text-muted-foreground/60" />
                      <p className="text-[10px] text-muted-foreground text-center px-2">Tap to take photo or upload</p>
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(side, f); }}
                  />
                </div>
                {preview && (
                  <button
                    className="text-[10px] text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (side === "front") { setFrontFile(null); setFrontPreview(null); }
                      else { setBackFile(null); setBackPreview(null); }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleExtract}
            disabled={extracting || (!frontFile && !backFile)}
          >
            {extracting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting…</> : <><ScanLine className="h-3.5 w-3.5" /> Extract ID Data</>}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setStep("idle")}>Cancel</Button>
        </div>

        <div className="sm:hidden">
          <div className="flex items-center gap-2 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 w-full border-primary/40 text-primary hover:bg-primary/5"
            onClick={() => setStep("scan")}
            disabled={extracting}
          >
            <Camera className="h-3.5 w-3.5" /> Scan with Camera
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Point your camera at the barcode on the back of a driver's license for 97% accuracy extraction.
          </p>
        </div>

        <p className="text-[10px] text-muted-foreground hidden sm:block">
          For driver's licenses, uploading the back enables high-accuracy barcode extraction. Images are stored encrypted and only accessible to Trustees.
        </p>
      </div>
    );
  }

  if (step === "scan") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-semibold text-foreground">Scan ID Barcode</p>
        </div>
        {extracting ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Processing barcode…</p>
          </div>
        ) : (
          <BarcodeScannerOverlay
            onSuccess={handleBarcodeScanned}
            onCancel={() => setStep("upload")}
          />
        )}
      </div>
    );
  }

  if (step === "review" && result) {
    const advisory = result.jurisdictionAdvisory;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <p className="text-xs font-semibold text-foreground">Data extracted — review and confirm</p>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {result.extractionMethod === "barcode" ? "PDF417 barcode" : "Vision OCR"} · {Math.round(result.confidenceScore * 100)}% confidence
          </span>
        </div>

        {advisory.hasAdvisory && advisory.level !== "none" && (
          <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${advisory.level === "advisory" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
            {advisory.level === "advisory" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            <div className="space-y-1">
              {advisory.message && <p>{advisory.message}</p>}
              {advisory.tribalOverlapNote && <p className="text-[10px] opacity-80">{advisory.tribalOverlapNote}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { key: "fullName" as const, label: "Full Legal Name" },
            { key: "dateOfBirth" as const, label: "Date of Birth" },
            { key: "idNumber" as const, label: "ID / License Number" },
            { key: "expiryDate" as const, label: "Expiry Date" },
            { key: "issueDate" as const, label: "Issue Date" },
            { key: "issuingJurisdictionName" as const, label: "Issuing State/Authority" },
          ]).map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</Label>
              <Input
                className="h-8 text-xs font-mono"
                value={ef(key)}
                onChange={(e) => setEf(key, e.target.value)}
              />
            </div>
          ))}
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Address on ID</Label>
            <Input
              className="h-8 text-xs"
              value={ef("fullAddress")}
              onChange={(e) => setEf("fullAddress", e.target.value)}
            />
          </div>
        </div>

        {ef("fullAddress") && (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Update primary mailing address?</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono break-words">{ef("fullAddress")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUpdateAddress(true)}
                className={`flex-1 h-8 rounded-md border text-xs font-semibold transition-colors ${updateAddress === true ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted/60"}`}
              >
                Yes, update it
              </button>
              <button
                type="button"
                onClick={() => setUpdateAddress(false)}
                className={`flex-1 h-8 rounded-md border text-xs font-semibold transition-colors ${updateAddress === false ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-background text-foreground hover:bg-muted/60"}`}
              >
                No, keep current
              </button>
            </div>
            {updateAddress === null && (
              <p className="text-[10px] text-amber-700 font-medium">Please choose before saving.</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleConfirm} disabled={saving || (!!ef("fullAddress") && updateAddress === null)}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Confirm & Save</>}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setStep("upload")}>
            Re-upload
          </Button>
          <p className="text-[10px] text-muted-foreground ml-auto">Data stored encrypted.</p>
        </div>
      </div>
    );
  }

  return null;
}

/* ── Protections Panel ── */
interface MemberRight {
  id: string;
  name: string;
  category: string;
  citation: string;
  plainLanguage: string;
  logicChain?: string[];
  watchFor: string;
  status: "active" | "applicable" | "verify";
}
interface IdentityMarker { type: string; label: string; value: string; legalSignificance: string; }
interface LandStatusMarker { type: string; label: string; value: string; jurisdictionNote: string; }
interface InheritedRight extends MemberRight {
  sourceAncestorId: number;
  sourceAncestorName: string;
  generationalDepth: number;
  inheritanceTribalNation: string;
  inheritancePath: string;
}
interface RightsProfile {
  rights: MemberRight[];
  identityMarkers: IdentityMarker[];
  landStatusMarkers: LandStatusMarker[];
  protectionSummary: string;
  inheritedRights: InheritedRight[];
  inheritanceSummary: string;
  ancestorTribalNations: Array<{ name: string; ancestorId: number; ancestorName: string; generation: number }>;
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

const TRUST_CASES = [
  { citation: "Seminole Nation v. United States, 316 U.S. 286 (1942)", point: "Established the federal government must meet 'the most exacting fiduciary standards' — act as a fair and honorable trustee, not just a bureaucrat." },
  { citation: "Mitchell v. United States, 463 U.S. 206 (1983)", point: "US held liable for mismanaging timber on Indian allotments. The trust duty covers day-to-day management of Indian resources, not just big policy decisions." },
  { citation: "Cobell v. Salazar, 573 F.3d 808 (D.C. Cir. 2009)", point: "BIA held liable for over 100 years of mismanagement of Individual Indian Money accounts. The duty is real, historical, and enforceable." },
  { citation: "White Mountain Apache Tribe v. United States, 537 U.S. 465 (2003)", point: "Trust duty extends to government-occupied tribal property. If the US holds or uses tribal assets, it must protect them." },
  { citation: "Morton v. Ruiz, 415 U.S. 199 (1974)", point: "BIA cannot arbitrarily deny benefits to eligible Indians by creating unpublished eligibility rules. The duty runs to the people, not to an administrative list." },
  { citation: "United States v. Jicarilla Apache Nation, 564 U.S. 162 (2011)", point: "Confirmed the government acts as a trustee in its dealings with Indian tribes. The trust relationship is foundational to how federal-Indian dealings are analyzed." },
];

const LAND_STATUS_EXPLANATIONS: Record<string, { headline: string; logic: string[]; protections: string[] }> = {
  trust: {
    headline: "Indian Trust Land — Federally Protected",
    logic: [
      "Trust land is held by the United States in trust for the tribe or individual Indian. Legal title is in the federal government's name — but the beneficial ownership belongs to you.",
      "Because the US holds title, the land cannot be taxed by the state, cannot be seized by creditors, and cannot be sold or transferred without explicit federal approval.",
      "This protection flows from the Non-Intercourse Act (25 U.S.C. § 177, originally 1790) — any land transaction not federally approved is legally voidable.",
    ],
    protections: ["No state property tax", "No creditor liens without BIA approval", "No forced sale or foreclosure", "Transfer requires federal approval", "BIA LTRO recording required"],
  },
  allotment: {
    headline: "Indian Allotment — Restricted Federal Supervision",
    logic: [
      "An allotment is a parcel of land originally set aside for an individual Indian under the Dawes Act or subsequent legislation. The federal trust relationship still applies.",
      "Allotments are subject to federal probate through the BIA when the owner passes. Heirs are determined under federal law, not state probate court.",
      "Transfer of an allotment requires federal approval. Many allotments are still in trust status and carry the same tax and lien protections as tribal trust land.",
    ],
    protections: ["Federal probate jurisdiction", "Transfer requires BIA approval", "State tax jurisdiction limited", "Restricted from private foreclosure", "Federal inheritance rules apply"],
  },
  fee: {
    headline: "Fee Simple — Indian Owner, State Jurisdiction Considerations",
    logic: [
      "Fee simple means you hold direct title — there is no federal trust wrapper. State property tax, lien, and foreclosure rules generally apply.",
      "However: if you are an Indian and the land is in or near Indian country, additional federal protections may still apply depending on the history of the parcel.",
      "If this land was previously allotment or trust land, consult with BIA to determine whether any trust restrictions survive. 'Fee simple' does not automatically mean all Indian land protections are gone.",
    ],
    protections: ["State tax generally applies", "Review whether prior trust restrictions survive", "Consult BIA before any transfer", "Assert Indian Canon of Construction if status is ambiguous"],
  },
  restricted: {
    headline: "Restricted Indian Land — Anti-Alienation in Force",
    logic: [
      "Restricted Indian land is land where the owner holds fee title but the land cannot be sold, mortgaged, or transferred without explicit tribal and informed consent — similar to trust land in practical effect.",
      "The restrictions may arise from allotment law, tribal ordinance, or specific federal statute. They run with the land — they cannot be waived by a private agreement.",
      "State and local governments have no jurisdiction to lift these restrictions. Any purported federal action to modify or remove them without explicit tribal and informed consent would be ultra vires and void.",
    ],
    protections: ["Cannot be sold without explicit tribal and informed consent", "Cannot be mortgaged without explicit tribal and informed consent", "State courts cannot order forced sale", "Restrictions run with the land permanently — only the Tribe may consent to modification"],
  },
};

function TrustResponsibilityBreakdown() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-primary/10 transition-colors text-left"
      >
        <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">Federal Indian Trust Responsibility</p>
          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
            The US is your legal fiduciary — this duty is inherent, applies broadly to all American Indians, and is enforceable in federal court regardless of land ownership or BIA-list status.
          </p>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="border-t border-primary/15 px-3 pb-4 pt-3 space-y-4 bg-background/60">
          <div className="space-y-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">What It Is — Logical Foundation</p>
            <ol className="space-y-2">
              {[
                "In 1831, Chief Justice Marshall described tribes as 'domestic dependent nations' — like a ward to its guardian. That created a legally enforceable relationship: the US assumed responsibility for Indian welfare in exchange for the land and sovereignty tribes gave up.",
                "Congress codified that duty in 25 U.S.C. § 162a, making the Secretary of the Interior a fiduciary over Indian trust assets — legally required to act in Indians' best interest. That standard has been held to flow through all federal agencies dealing with Indian affairs.",
                "A fiduciary cannot use their position to harm the beneficiary. When they do, there is legal liability — not just political accountability, but court-enforceable liability.",
                "Who it applies to: ALL American Indians. Not only those on reservations. Not only members of BIA-recognized tribes. Not only people with a CDIB card or on a specific list. Morton v. Ruiz (1974) confirmed the duty is to the people — not to an administrative roster.",
                "What you can do with it: when a federal agency denies a benefit, delays action, or takes a position that harms your land or rights, assert the trust responsibility in writing. Put it on the record. That assertion matters — in administrative appeals and in federal court.",
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-foreground leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Key Cases — How Broadly Courts Have Applied It</p>
            <div className="space-y-2">
              {TRUST_CASES.map(({ citation, point }) => (
                <div key={citation} className="rounded-md border border-border bg-background px-2.5 py-2">
                  <p className="text-[10px] font-mono text-primary mb-0.5">{citation}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug">{point}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md bg-primary/5 border border-primary/20 px-2.5 py-2">
            <p className="text-[10px] text-primary font-semibold">Enforcement path if violated:</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              File a formal complaint with the BIA Regional Director citing the breach. Escalate to the DOI Office of the Solicitor. If the trust responsibility is violated regarding money or property, file in the U.S. Court of Federal Claims (28 U.S.C. § 2501 — 6-year statute of limitations).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProtectionsPanel() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showRights, setShowRights] = useState(true);
  const [showInherited, setShowInherited] = useState(false);
  const [showIdentityMarkers, setShowIdentityMarkers] = useState(false);
  const [showLandMarkers, setShowLandMarkers] = useState(false);

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
        {data.identityMarkers.length > 0 && (() => {
          const allVerified = data.identityMarkers.every(m => m.value === "Verified" || m.value === "CRITICAL");
          return (
            <div>
              <button
                onClick={() => setShowIdentityMarkers(v => !v)}
                className="w-full flex items-center justify-between hover:bg-muted/40 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <UserCheck className="h-3 w-3" /> Identity Standing
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${allVerified ? "border-green-300 text-green-700 bg-green-50" : "border-amber-300 text-amber-700 bg-amber-50"}`}>
                    {allVerified ? "Yes" : "No"} · {data.identityMarkers.length}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showIdentityMarkers ? "rotate-180" : ""}`} />
                </div>
              </button>
              {showIdentityMarkers && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
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
              )}
            </div>
          );
        })()}

        {/* ── Land status markers ── */}
        {data.landStatusMarkers.length > 0 && (() => {
          const allLandVerified = data.landStatusMarkers.every(m => m.value === "Verified" || m.value === "Active");
          return (
            <div>
              <button
                onClick={() => setShowLandMarkers(v => !v)}
                className="w-full flex items-center justify-between hover:bg-muted/40 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <MapPin className="h-3 w-3" /> Land Status
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${allLandVerified ? "border-green-300 text-green-700 bg-green-50" : "border-amber-300 text-amber-700 bg-amber-50"}`}>
                    {allLandVerified ? "Yes" : "No"} · {data.landStatusMarkers.length}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showLandMarkers ? "rotate-180" : ""}`} />
                </div>
              </button>
              {showLandMarkers && (
                <div className="space-y-2 mt-2">
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
              )}
            </div>
          );
        })()}

        {/* ── Rights list ── */}
        <div>
          <button
            onClick={() => setShowRights(v => !v)}
            className="w-full flex items-center justify-between hover:bg-muted/40 rounded-lg px-2 py-1.5 -mx-2 transition-colors mb-2"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Key className="h-3 w-3" /> Your Rights
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-green-300 text-green-700 bg-green-50">
                {data.rights.filter(r => r.status === "active").length} active
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showRights ? "rotate-180" : ""}`} />
            </div>
          </button>
          {showRights && <div className="space-y-1.5">
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
                    <div className="px-3 pb-3 space-y-3 border-t border-border bg-muted/20">
                      {right.logicChain && right.logicChain.length > 0 && (
                        <div className="mt-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">How This Works — Logical Breakdown</p>
                          <ol className="space-y-2">
                            {right.logicChain.map((step, i) => (
                              <li key={i} className="flex gap-2.5 text-xs">
                                <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                                <span className="text-foreground leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {!right.logicChain && (
                        <p className="text-xs text-foreground leading-relaxed mt-2">{right.plainLanguage}</p>
                      )}
                      <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Legal Authority</p>
                        <p className="text-[10px] text-muted-foreground font-mono leading-snug">{right.citation}</p>
                      </div>
                      <div className="flex items-start gap-1.5 rounded-md bg-orange-50 border border-orange-200 px-2.5 py-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-orange-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-orange-800 leading-snug"><strong>Watch for: </strong>{right.watchFor}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>}
          {showRights && data.rights.length > 6 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="mt-2 w-full text-[11px] text-primary hover:underline flex items-center justify-center gap-1"
            >
              {showAll ? "Show fewer" : `Show all ${data.rights.length} protections`}
              <ChevronDown className={`h-3 w-3 transition-transform ${showAll ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* ── Inherited through lineage ── */}
        <div>
          <button
            onClick={() => setShowInherited(s => !s)}
            className="w-full flex items-center justify-between group"
          >
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="h-3 w-3" /> Inherited Through Lineage
              {data.inheritedRights?.length > 0 && (
                <Badge className="bg-rose-600 hover:bg-rose-600 text-white text-[9px] py-0 ml-1">{data.inheritedRights.length}</Badge>
              )}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showInherited ? "rotate-180" : ""}`} />
          </button>

          {showInherited && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            {data.inheritanceSummary ?? "Add tribal nation and treaty affiliation data to ancestor records in the Family Tree to activate inherited protections."}
          </p>
          )}

          {showInherited && data.inheritedRights?.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {/* Ancestor nations summary */}
              {data.ancestorTribalNations?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {data.ancestorTribalNations.map((n, i) => (
                    <div key={i} className="flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5">
                      <span className="text-[9px] font-bold text-rose-700 uppercase tracking-widest">{n.name}</span>
                      <span className="text-[9px] text-rose-500">· {n.ancestorName}</span>
                    </div>
                  ))}
                </div>
              )}
              {data.inheritedRights.map((right) => {
                const isOpen = expanded === right.id;
                const catColor = CATEGORY_COLORS[right.category] ?? "text-rose-700 bg-rose-50 border-rose-200";
                return (
                  <div key={right.id} className="rounded-lg border border-rose-100 overflow-hidden bg-rose-50/30">
                    <button
                      onClick={() => setExpanded(isOpen ? null : right.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-50/60 transition-colors text-left"
                    >
                      <div className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-widest font-bold shrink-0 ${catColor}`}>
                        treaty
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-foreground leading-snug block">{right.name}</span>
                        <span className="text-[9px] text-muted-foreground">
                          via {right.sourceAncestorName} · {right.inheritancePath} · {right.inheritanceTribalNation}
                        </span>
                      </div>
                      <Badge className="bg-green-600 hover:bg-green-600 text-white text-[9px] py-0 shrink-0">active</Badge>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-3 border-t border-rose-100 bg-rose-50/20">
                        {right.logicChain && right.logicChain.length > 0 && (
                          <div className="mt-2.5">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">How This Works — Logical Breakdown</p>
                            <ol className="space-y-2">
                              {right.logicChain.map((step, i) => (
                                <li key={i} className="flex gap-2.5 text-xs">
                                  <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                                  <span className="text-foreground leading-relaxed">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {!right.logicChain && (
                          <p className="text-xs text-foreground leading-relaxed mt-2">{right.plainLanguage}</p>
                        )}
                        <div className="rounded-md border border-rose-100 bg-background px-2.5 py-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Legal Authority</p>
                          <p className="text-[10px] text-muted-foreground font-mono leading-snug">{right.citation}</p>
                        </div>
                        <div className="flex items-start gap-1.5 rounded-md bg-orange-50 border border-orange-200 px-2.5 py-2">
                          <ShieldAlert className="h-3.5 w-3.5 text-orange-600 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-orange-800 leading-snug"><strong>Watch for: </strong>{right.watchFor}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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

function buildPrintHtml(record: PipelineRecord, mode: "esign" | "color", signatureUrl?: string | null): string {
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
    <div style="border:1.5px solid #1a3a6e;width:154px;height:100px;padding:6px 8px;text-align:center;background:#fff;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-between;flex-shrink:0;">
      <div style="line-height:1.25;width:100%;">
        <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:8pt;font-weight:700;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.4px;">BY ORDER OF THE</div>
        <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:7.5pt;font-weight:900;color:#1a3a6e;text-transform:uppercase;letter-spacing:0px;">MATHIAS EL TRIBE SUPREME COURT</div>
      </div>
      ${stampDate
        ? `<div style="font-family:'Courier New',Courier,monospace;font-size:13pt;font-weight:700;color:#8B0000;letter-spacing:2px;line-height:1.1;width:100%;">${esc(stampDate.month)}&nbsp;${esc(stampDate.daySpaced)}&nbsp;${esc(stampDate.year)}</div>`
        : `<div style="font-family:'Courier New',Courier,monospace;font-size:13pt;font-weight:700;color:#bbb;letter-spacing:2px;line-height:1.1;width:100%;">— — — — —</div>`}
      <div style="text-align:center;line-height:1.3;width:100%;">
        <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:8pt;font-weight:700;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.4px;">OFFICE OF THE</div>
        <div style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:8pt;font-weight:900;color:#1a3a6e;text-transform:uppercase;letter-spacing:0.4px;">CHIEF JUSTICE &amp; TRUSTEE</div>
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
         <div style="margin-bottom:18px;font-size:9pt;color:#222;">I hereby affix my hand and seal to this sovereign instrument this _______ day of _________________________, _______.</div>
         <div style="display:flex;justify-content:space-between;gap:32px;margin-bottom:18px;align-items:flex-end;">
           <div style="flex:1;min-width:0;">
             ${signatureUrl
               ? `<div style="margin-bottom:4px;height:48px;display:flex;align-items:flex-end;"><img src="${signatureUrl}" style="max-height:48px;max-width:200px;object-fit:contain;" alt="Signature" /></div>`
               : `<div style="height:48px;"></div>`}
             <div style="border-top:1px solid #000;padding-top:4px;"><div style="font-size:8.5pt;font-weight:700;color:#000;">Chief Mathias El</div><div style="font-size:7.5pt;color:#555;margin-top:1px;">Chief Justice &amp; Trustee · Mathias El Tribe Supreme Court</div></div>
           </div>
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
            <div style="font-family:'Times New Roman',Georgia,serif;font-size:9pt;font-style:italic;color:#444;margin:3px 0;">&ldquo;What ever we do. it has to make sense&rdquo;</div>
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
const EMAIL_NOTIFICATION_TOGGLES = [
  { key: "emailOnFamilyGovernance", label: "Family Governance" },
  { key: "emailOnWelfareUpdate", label: "Welfare Updates" },
  { key: "emailOnTrustInstrument", label: "Trust Instruments" },
  { key: "emailOnRecorderFiling", label: "Recorder Filings" },
  { key: "emailOnCourtHearing", label: "Court & Calendar Events" },
  { key: "emailOnTribalAnnouncement", label: "Tribal Announcements" },
  { key: "emailOnTaskAssigned", label: "Task Assignments" },
  { key: "emailOnComplaintUpdate", label: "Complaint Updates" },
  { key: "emailOnDirectMessage", label: "Direct Messages" },
  { key: "emailOnLineageReview", label: "Lineage Review" },
  { key: "emailOnLineageApproved", label: "Lineage Approved" },
  { key: "emailOnLineageRejected", label: "Lineage Updates" },
  { key: "emailOnEnrollmentGranted", label: "Enrollment Granted" },
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
    key: "tribalName",
    label: "Tribal / Ceremonial Name",
    question: "Do you have a tribal or ceremonial name you'd like on file with the court?",
    placeholder: "Tribal or ceremonial name",
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
    key: "preferredJurisdiction",
    label: "Preferred Jurisdiction",
    question: "Which tribal court district or jurisdiction do you primarily operate within?",
    placeholder: "e.g. Tribal Court, District 1",
  },
  {
    key: "bio",
    label: "Background",
    question: "Can you briefly describe your role and connection to the tribe? This personalizes your court documents and welfare filings.",
    placeholder: "Brief role or background",
    multiline: true,
  },
];

/* ── Incomplete intake indicator ── */
const INTAKE_TYPES = [
  { key: "identity-lineage", label: "Identity & Lineage" },
  { key: "housing-land",     label: "Housing & Land Protection" },
  { key: "healthcare",       label: "Healthcare & Benefits" },
  { key: "welfare",          label: "Welfare & Protection" },
  { key: "business",         label: "Sovereign Business" },
] as const;

function IntakeStatusIndicator() {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const [open, setOpen] = useState(false);
  const incomplete = INTAKE_TYPES.filter(
    (t) => !sessionStorage.getItem(`intake_completed_${t.key}`)
  );
  if (incomplete.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-xs font-medium text-foreground">
            {incomplete.length} intake{incomplete.length > 1 ? "s" : ""} not yet completed
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The following intakes have not been completed yet. You can continue at any time — your profile
            will be updated as more information is gathered.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {incomplete.map((t) => (
              <a
                key={t.key}
                href={`${base}/intake-companion?type=${t.key}`}
                className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
                {t.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [statementEditing, setStatementEditing] = useState(false);
  const [statementSaving, setStatementSaving] = useState(false);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState(false);
  const [genLetter, setGenLetter] = useState(false);

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

  /* signature state */
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [isUploadingSig, setIsUploadingSig] = useState(false);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const [sigTab, setSigTab] = useState<"generate" | "upload">("generate");
  const [sigName, setSigName] = useState(SIG_PRESETS[0]);
  const [sigType, setSigType] = useState<SigType>("script");
  const [sigFont, setSigFont] = useState("Dancing Script");
  const [sigColor, setSigColor] = useState("black");
  const [sigGenerating, setSigGenerating] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);

  /* vault state — we never store actual values client-side after save */
  const [vaultHas, setVaultHas] = useState({ dob: false, address: false, email: false, ssn: false });
  const [vaultIdDoc, setVaultIdDoc] = useState<{ hasIdDocument: boolean; idDocumentType: string | null; idDocumentUploadedAt: string | null; idJurisdictionCode: string | null; idScanRequestedAt: string | null }>({ hasIdDocument: false, idDocumentType: null, idDocumentUploadedAt: null, idJurisdictionCode: null, idScanRequestedAt: null });
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
    legalDescription: "",
    bio: "",
    preferredJurisdiction: "",
    chiefStatement: "",
    chiefStatementRef: "",
  });
  const [landStatus, setLandStatus] = useState("");
  const [hasRecordedInstrument, setHasRecordedInstrument] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean | string>>({});

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
            legalDescription: p.legalDescription ?? "",
            bio: p.bio ?? "",
            chiefStatement: p.chiefStatement ?? "",
            chiefStatementRef: p.chiefStatementRef ?? "",
            preferredJurisdiction: p.preferredJurisdiction ?? "",
          });
          setLandStatus(p.landStatus ?? "");
          setHasRecordedInstrument(p.hasRecordedInstrument ?? false);
          if (p.signatureUrl) setSignatureUrl(p.signatureUrl);
          setNotifPrefs((p.notificationPreferences as Record<string, boolean | string>) ?? {});
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
          setVaultIdDoc({
            hasIdDocument: vd.hasIdDocument ?? false,
            idDocumentType: vd.idDocumentType ?? null,
            idDocumentUploadedAt: vd.idDocumentUploadedAt ? String(vd.idDocumentUploadedAt) : null,
            idJurisdictionCode: vd.idJurisdictionCode ?? null,
            idScanRequestedAt: vd.idScanRequestedAt ? String(vd.idScanRequestedAt) : null,
          });
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
      toast({ title: "Processing photo…", description: "Removing background — may take a moment on first use." });
      const objectUrl = URL.createObjectURL(file);
      let processedBlob: Blob;
      try {
        processedBlob = await removeBackground(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      const processedFile = new File([processedBlob], "profile.png", { type: "image/png" });
      const formData = new FormData();
      formData.append("photo", processedFile);
      const r = await fetch("/api/identity/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: formData,
      });
      if (r.ok) {
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
        reader.readAsDataURL(processedFile);
        toast({ title: "Photo saved", description: "Background removed and photo updated." });
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

  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose a signature image under 4 MB.", variant: "destructive" });
      return;
    }
    setIsUploadingSig(true);
    try {
      const formData = new FormData();
      formData.append("signature", file);
      const r = await fetch("/api/identity/signature", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: formData,
      });
      if (r.ok) {
        const reader = new FileReader();
        reader.onload = (ev) => setSignatureUrl(ev.target?.result as string);
        reader.readAsDataURL(file);
        toast({ title: "Signature saved", description: "Your digital signature has been stored and will appear on printed documents." });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Upload failed", description: (err as any).error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error uploading signature.", variant: "destructive" });
    } finally {
      setIsUploadingSig(false);
      if (sigInputRef.current) sigInputRef.current.value = "";
    }
  };

  /* ── Signature generator ── */
  useEffect(() => {
    if (document.getElementById("sig-gfonts")) return;
    const link = document.createElement("link");
    link.id = "sig-gfonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pinyon+Script&family=Alex+Brush&display=swap";
    document.head.appendChild(link);
  }, []);

  const generateSig = useCallback(async (name: string, font: string, color: string = "black") => {
    if (!name.trim()) return;
    setSigGenerating(true);
    try {
      const isTNR = font === "Times New Roman";
      const hex = SIG_COLORS.find(c => c.key === color)?.hex ?? "#111111";
      const baseName = stripSlashS(name);
      const displayName = isTNR ? `/s/  ${baseName}` : baseName;

      if (!isTNR) {
        await document.fonts.load(`bold 56px "${font}"`).catch(() => {});
      }

      const canvas = sigCanvasRef.current;
      if (!canvas) return;
      const CANVAS_W = 540; const CANVAS_H = 120;
      canvas.width = CANVAS_W; canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      if (isTNR) {
        // Formal printed style — render "/s/" in regular weight, name in bold italic
        const slashPart = "/s/  ";
        ctx.font = `400 28px "Times New Roman", serif`;
        ctx.fillStyle = hex;
        ctx.textBaseline = "middle";
        const slashW = ctx.measureText(slashPart).width;
        ctx.fillText(slashPart, 14, 52);
        ctx.font = `bold italic 30px "Times New Roman", serif`;
        ctx.fillStyle = hex;
        ctx.fillText(baseName, 14 + slashW, 52);
        const totalW = Math.min(slashW + ctx.measureText(baseName).width, CANVAS_W - 14);
        ctx.beginPath(); ctx.moveTo(14, 82); ctx.lineTo(14 + totalW, 82);
        ctx.strokeStyle = hex; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.font = `bold 54px "${font}", serif`;
        ctx.fillStyle = hex;
        ctx.textBaseline = "middle";
        ctx.fillText(displayName, 14, 52);
        const tw = Math.min(ctx.measureText(displayName).width, CANVAS_W - 14);
        ctx.beginPath(); ctx.moveTo(14, 94); ctx.lineTo(14 + tw, 94);
        ctx.strokeStyle = hex; ctx.lineWidth = 1.5; ctx.stroke();
      }
    } finally {
      setSigGenerating(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => generateSig(sigName, sigFont, sigColor), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveGeneratedSig = useCallback(async () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    setIsUploadingSig(true);
    try {
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Canvas empty");
      const formData = new FormData();
      formData.append("signature", blob, "signature.png");
      const r = await fetch(`${API}/api/identity/signature`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: formData,
      });
      if (r.ok) {
        setSignatureUrl(canvas.toDataURL("image/png"));
        toast({ title: "Signature saved", description: "Your digital signature is on file and will appear on printed sovereign documents." });
      } else {
        toast({ title: "Save failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving signature", variant: "destructive" });
    } finally {
      setIsUploadingSig(false);
    }
  }, [toast]);

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
      const html = buildPrintHtml(updated, mode, signatureUrl);
      const w = window.open("", "_blank", "width=1000,height=820");
      if (!w) { alert("Pop-up blocked — please allow pop-ups for this site."); return; }
      w.document.open();
      w.document.write(html);
      w.document.close();
      toast({ title: `Sealed — ${d.fileNumber}`, description: "Print event logged." });
    } catch (e: any) {
      toast({ title: "Print failed", description: e.message, variant: "destructive" });
    } finally {
      setPrintingId(null);
    }
  }

  // ── Tribal ID download ──
  function triggerIdDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function handleDownloadTribalId() {
    setGeneratingId(true);
    try {
      const r = await fetch(`/api/identity/tribal-id/${user!.id}`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error("Failed to generate Tribal ID");
      const blob = await r.blob();
      triggerIdDownload(blob, `tribal-id-${user!.id}.pdf`);
      toast({ title: "Tribal ID Generated", description: "Your Tribal ID PDF has been downloaded." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGeneratingId(false);
    }
  }

  async function handleDownloadVerificationLetter() {
    setGenLetter(true);
    try {
      const r = await fetch("/api/identity/verification-letter/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purpose: "General Identity Verification" }),
      });
      if (!r.ok) throw new Error("Failed to generate Verification Letter");
      const blob = await r.blob();
      triggerIdDownload(blob, `verification-letter-${user!.id}.pdf`);
      toast({ title: "Verification Letter Generated", description: "Verification letter PDF downloaded." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGenLetter(false);
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
          <img src={`${import.meta.env.BASE_URL}supreme-court-seal-color.png`} className="w-24 h-24 object-contain drop-shadow shrink-0" alt="Mathias El Tribe Supreme Court" />
          {/* Member photo — center */}
          <div className="relative shrink-0">
            <div className="w-20 h-24 flex items-end justify-center bg-transparent">
              {photoUrl
                ? <img src={photoUrl} alt="Profile" className="w-full h-full object-contain object-bottom" />
                : <User className="h-10 w-10 text-muted-foreground" />
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
          <img src={`${import.meta.env.BASE_URL}chief-justice-seal.png`} className="w-24 h-24 object-contain drop-shadow shrink-0" alt="Chief Justice" />
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

      {/* ── Incomplete intake indicator ── */}
      <IntakeStatusIndicator />

      {/* ── Smoke check ── */}
      <SmokeCheckBar />

      {/* ── KAYA — primary AI interface (top) ── */}
      <KayaChat
        memberPhoto={photoUrl}
        memberName={fields.legalName || undefined}
        pendingTasks={data?.tasks?.filter((t: any) => t.status !== "completed" && t.status !== "done").length}
        unreadNotifications={unreadCount}
        onboardingReminder={true}
      />

      {/* ── Your Protections — identity standing, land status, rights ── */}
      <ProtectionsPanel />

      {/* ── Tribal Identity Document — download card, all members ── */}
      <Card className="overflow-hidden border-indigo-800/30">
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4">
            {/* Seal — role-aware */}
            <div className="shrink-0 w-14 h-14 rounded-lg border border-indigo-800/30 bg-black/60 flex items-center justify-center overflow-hidden">
              <img
                src={
                  isChief
                    ? `${import.meta.env.BASE_URL}chief-justice-seal.png`
                    : `${import.meta.env.BASE_URL}tribal-seal.png`
                }
                alt="Seal"
                className="w-12 h-12 object-contain"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                {isChief ? "Office of the Chief Justice & Trustee" : "Mathias El Tribe"}
              </p>
              <h3 className="text-sm font-serif font-bold text-foreground leading-tight">
                Sovereign Identity Document
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {fields.legalName || user?.name || "—"}&nbsp;·&nbsp;
                {isChief ? "Chief Justice & Trustee" : activeRole}
              </p>
            </div>

            {/* Right: special badge for chief only */}
            {isChief && (
              <div className="shrink-0 hidden sm:flex items-center">
                <span className="text-[8px] font-bold tracking-widest uppercase px-2 py-1 rounded border border-amber-600/50 text-amber-600 bg-amber-950/30">
                  Chief Office
                </span>
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-[#1C2B4B] hover:bg-[#243560] text-white text-xs"
              onClick={handleDownloadTribalId}
              disabled={generatingId}
            >
              {generatingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {generatingId ? "Generating…" : "Download Tribal ID"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs border-indigo-700/40 text-indigo-700"
              onClick={handleDownloadVerificationLetter}
              disabled={genLetter}
            >
              {genLetter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {genLetter ? "Generating…" : "Verification Letter"}
            </Button>
            <Link href="/tribal-id">
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" />
                View Full ID
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

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

      {/* ── Chief's Statement — personal declaration, chief only ── */}
      {isChief && (
        <Card className="border-amber-700/30 bg-gradient-to-br from-amber-950/20 via-background to-background overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Feather className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <CardTitle className="text-xs uppercase tracking-widest text-amber-700">Chief's Statement</CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Your personal declaration — visible on your profile</p>
                </div>
              </div>
              {!statementEditing ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatementEditing(true)}
                  className="h-7 text-xs gap-1.5 text-amber-700 hover:text-amber-600 hover:bg-amber-900/20 shrink-0"
                >
                  <Edit2 className="h-3 w-3" />
                  {fields.chiefStatement ? "Edit" : "Write"}
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatementEditing(false)}
                    className="h-7 text-xs text-muted-foreground"
                    disabled={statementSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      setStatementSaving(true);
                      try {
                        const r = await fetch("/api/user/profile", {
                          method: "PUT",
                          headers: {
                            Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            chiefStatement: fields.chiefStatement,
                            chiefStatementRef: fields.chiefStatementRef,
                          }),
                        });
                        if (r.ok) {
                          toast({ title: "Statement saved", description: "Your declaration has been recorded." });
                          setStatementEditing(false);
                        } else {
                          toast({ title: "Could not save", variant: "destructive" });
                        }
                      } finally {
                        setStatementSaving(false);
                      }
                    }}
                    className="h-7 text-xs gap-1.5 bg-amber-700 hover:bg-amber-600 text-white"
                    disabled={statementSaving}
                  >
                    {statementSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {statementEditing ? (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Your statement</Label>
                  <Textarea
                    value={fields.chiefStatement}
                    onChange={e => setFields(f => ({ ...f, chiefStatement: e.target.value }))}
                    placeholder={`Being Chief is not an appointment — it is an arrival. A remembering. A necessity. It is a spiritual designation: a destination reached through the weight of preparation and the fire of realization that you stand for your people against opposing nations. This is a calling. The preparation is intense, because this role is not for the weak...`}
                    rows={8}
                    className="text-sm leading-relaxed resize-none"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Reference / Learn more <span className="text-muted-foreground/50">(optional — e.g. "Find out more through the SDU" or a link)</span>
                  </Label>
                  <Input
                    value={fields.chiefStatementRef}
                    onChange={e => setFields(f => ({ ...f, chiefStatementRef: e.target.value }))}
                    placeholder="e.g. For more information, contact the Sovereign Development Unit (SDU)"
                    className="text-sm"
                  />
                </div>
              </>
            ) : fields.chiefStatement ? (
              <div className="space-y-3">
                <blockquote className="border-l-2 border-amber-700/50 pl-4 space-y-1">
                  {fields.chiefStatement.split("\n").filter(Boolean).map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed text-foreground/90 font-serif italic">
                      {para}
                    </p>
                  ))}
                </blockquote>
                {fields.chiefStatementRef && (
                  <p className="text-xs text-amber-700/80 pl-4 border-l-2 border-amber-700/20">
                    {fields.chiefStatementRef}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-4 text-center">
                <Feather className="h-8 w-8 text-amber-700/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No statement written yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Write your declaration — what being Chief means to you, in your own words.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatementEditing(true)}
                  className="mt-3 gap-1.5 text-xs border-amber-700/30 text-amber-700 hover:bg-amber-900/10"
                >
                  <Edit2 className="h-3 w-3" /> Write my statement
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              className="relative w-24 h-32 flex items-end justify-center bg-transparent cursor-pointer group shrink-0"
              onClick={() => photoInputRef.current?.click()}
              title="Click to change photo"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Profile"
                  className="w-full h-full object-contain object-bottom"
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

          {/* ── Digital Signature ── */}
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs font-semibold text-foreground mb-0.5">Digital Signature</p>
            <p className="text-[10px] text-muted-foreground mb-3">Generate a court-style signature from your name, or upload a handwritten one.</p>

            {/* Tab toggle */}
            <div className="flex gap-1 mb-4">
              {(["generate", "upload"] as const).map(t => (
                <button key={t} onClick={() => setSigTab(t)}
                  className={`text-[10px] px-3 py-1 rounded-md font-semibold transition-colors capitalize ${sigTab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {t === "generate" ? "Generate" : "Upload Handwritten"}
                </button>
              ))}
            </div>

            {sigTab === "generate" && (
              <div className="space-y-3">

                {/* ── Signature Type selector — drives everything else ── */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Signature Type</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SIG_TYPES.map(t => (
                      <button
                        key={t.key}
                        onClick={() => {
                          setSigType(t.key);
                          const nextFont = t.defaultFont;
                          setSigFont(nextFont);
                          generateSig(sigName, nextFont, sigColor);
                        }}
                        className={`text-left px-3 py-2 rounded-lg border transition-colors ${sigType === t.key ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/40"}`}
                      >
                        <p className={`text-xs font-bold leading-tight ${sigType === t.key ? "text-primary" : "text-foreground"}`}>{t.label}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{t.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name presets */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Name</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SIG_PRESETS.map(p => (
                      <button key={p} onClick={() => { setSigName(p); generateSig(p, sigFont, sigColor); }}
                        className={`text-[10px] px-2.5 py-1 rounded border font-mono transition-colors ${sigName === p ? "border-primary bg-primary/5 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"}`}>
                        {sigType === "legal" ? `/s/  ${p}` : p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <Input className="text-xs h-8 font-mono flex-1" value={sigName}
                      placeholder="Your Name"
                      onChange={e => setSigName(e.target.value)} />
                    <Button variant="outline" size="sm" className="h-8 text-xs shrink-0"
                      onClick={() => generateSig(sigName, sigFont, sigColor)}>Preview</Button>
                  </div>
                </div>

                {/* Font style picker — only shown for script type */}
                {sigType === "script" && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Script Style</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SIG_FONTS.map(f => (
                        <button key={f.key} onClick={() => { setSigFont(f.key); generateSig(sigName, f.key, sigColor); }}
                          className={`px-3 py-0.5 rounded border transition-colors ${sigFont === f.key ? "border-primary bg-primary/5 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"}`}
                          style={{ fontFamily: `"${f.key}", serif`, fontSize: "15px" }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Color picker */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Color</p>
                  <div className="flex gap-2">
                    {SIG_COLORS.map(c => (
                      <button
                        key={c.key}
                        onClick={() => { setSigColor(c.key); generateSig(sigName, sigFont, c.key); }}
                        className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded border transition-colors"
                        style={sigColor === c.key
                          ? { borderColor: c.hex, background: `${c.hex}12`, color: c.hex, fontWeight: 700 }
                          : { borderColor: "#e2e8f0", color: "#888" }}
                        title={c.label}
                      >
                        <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: c.hex }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Canvas preview */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Preview</p>
                  <div className="relative rounded-lg border border-dashed border-border bg-white overflow-hidden" style={{ height: 120 }}>
                    {sigGenerating && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <canvas ref={sigCanvasRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                </div>

                {/* Authorization notice */}
                <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-[10px] text-amber-800 leading-relaxed">
                  <strong>Authorization:</strong> By saving, you authorize this signature for use on sovereign documents where appropriate. This signature does not constitute a waiver of any rights, immunities, protections, or sovereign standing of the Mathias El Tribe or its members.
                </div>

                <Button size="sm" className="h-8 text-xs" onClick={saveGeneratedSig} disabled={isUploadingSig}>
                  {isUploadingSig ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  Save as My Signature
                </Button>
              </div>
            )}

            {sigTab === "upload" && (
              <div>
                <p className="text-xs text-muted-foreground mb-3">Upload a PNG of your handwritten signature (transparent background recommended).</p>
                <div className="flex items-center gap-5">
                  <div className="relative w-40 h-16 rounded border border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer group overflow-hidden shrink-0"
                    onClick={() => sigInputRef.current?.click()}>
                    {signatureUrl
                      ? <img src={signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain p-1" />
                      : <span className="text-[10px] text-muted-foreground italic">No signature on file</span>}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {isUploadingSig ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Upload className="h-4 w-4 text-white" />}
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={isUploadingSig}
                    onClick={() => sigInputRef.current?.click()} className="h-8 text-xs">
                    {isUploadingSig
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Uploading…</>
                      : <><Upload className="h-3.5 w-3.5 mr-1.5" /> {signatureUrl ? "Replace" : "Upload Signature"}</>}
                  </Button>
                </div>
              </div>
            )}

            {/* Current on file */}
            {signatureUrl && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">On File</p>
                <div className="rounded border border-border bg-white p-2 w-fit">
                  <img src={signatureUrl} alt="Current signature" className="max-h-12 max-w-[220px] object-contain" />
                </div>
                <p className="text-[10px] text-green-700 mt-1">Appears on printed sovereign documents.</p>
              </div>
            )}

            <input ref={sigInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSignatureChange} />
          </div>
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

      {/* ── Resolved identity markers ── */}
      {(autoTags.length > 0 || (data?.identity && (data.identity as any).courtCaption)) && (
        <Card>
          <CardContent className="pt-4 pb-3 space-y-2.5">
            {(data?.identity as any)?.courtCaption && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <Gavel className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Court Caption</p>
                  <p className="text-xs font-mono text-foreground leading-snug">{(data?.identity as any)?.courtCaption}</p>
                </div>
              </div>
            )}
            {autoTags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Detected Affiliations</p>
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
            Used in trust instruments, LEN confirmations, BIA land status filings, document drafting, and discrepancy detection during document intake.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── Federal Trust Responsibility — full breakdown ── */}
          <TrustResponsibilityBreakdown />

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
              {landStatus && LAND_STATUS_EXPLANATIONS[landStatus] && (() => {
                const ex = LAND_STATUS_EXPLANATIONS[landStatus];
                return (
                  <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2.5 space-y-2 mt-1">
                    <p className="text-[10px] font-bold text-foreground">{ex.headline}</p>
                    <ol className="space-y-1.5">
                      {ex.logic.map((step, i) => (
                        <li key={i} className="flex gap-2 text-[10px]">
                          <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                          <span className="text-muted-foreground leading-snug">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                      {ex.protections.map(p => (
                        <span key={p} className="text-[9px] rounded-full bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 font-medium">✓ {p}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Parcel Details</p>
            <LandRecordPanel />
          </div>
        </CardContent>
      </Card>

      {/* ── Notification preferences ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest">Email Notification Preferences</CardTitle>
          <p className="text-xs text-muted-foreground">Choose which events trigger an email to your inbox.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Master toggle */}
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Receive notification emails</p>
              <p className="text-xs text-muted-foreground">Master switch — turn off to stop all non-critical emails.</p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary shrink-0"
              checked={notifPrefs.email === true}
              onChange={(e) => setNotifPrefs((p) => ({ ...p, email: e.target.checked }))}
            />
          </label>

          {/* Always-on notice */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 leading-relaxed">
            <strong>TRO alerts and red-flag alerts</strong> are always delivered by email — they cannot be turned off.
          </div>

          {/* Per-category toggles — shown only when master email is on */}
          {notifPrefs.email === true && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Per-category settings</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {EMAIL_NOTIFICATION_TOGGLES.map((toggle) => (
                  <label key={toggle.key} className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-primary shrink-0"
                      checked={notifPrefs[toggle.key] !== false}
                      onChange={(e) => setNotifPrefs((p) => ({ ...p, [toggle.key]: e.target.checked }))}
                    />
                    <span className="text-sm">{toggle.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Delivery frequency — shown only when master email is on */}
          {notifPrefs.email === true && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Delivery frequency</p>
              <div className="flex flex-col gap-1">
                {[
                  { value: "instant", label: "Send immediately", desc: "Each notification emails you right away." },
                  { value: "daily", label: "Daily digest", desc: "All notifications bundled into one email per day." },
                  { value: "weekly", label: "Weekly digest", desc: "One summary email at the start of each week." },
                ].map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start gap-2.5 cursor-pointer rounded-md px-2.5 py-2 hover:bg-muted/50 transition-colors">
                    <input
                      type="radio"
                      name="sovereignEmailDeliveryFrequency"
                      className="mt-0.5 accent-primary shrink-0"
                      checked={(notifPrefs.emailDeliveryFrequency ?? "instant") === value}
                      onChange={() => setNotifPrefs((p) => ({ ...p, emailDeliveryFrequency: value }))}
                    />
                    <div>
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Email delivery preview — live summary */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-3 space-y-2">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Email delivery preview</p>
            {notifPrefs.email !== true ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                No category emails will be sent — master switch is off. Only TRO and red-flag alerts will still be delivered.
              </p>
            ) : (() => {
              const enabled = EMAIL_NOTIFICATION_TOGGLES.filter((t) => notifPrefs[t.key] !== false);
              const freq = notifPrefs.emailDeliveryFrequency ?? "instant";
              return (
                <>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] rounded-full bg-amber-100 border border-amber-200 text-amber-800 px-2 py-0.5 font-medium">TRO alerts</span>
                    <span className="text-[10px] rounded-full bg-amber-100 border border-amber-200 text-amber-800 px-2 py-0.5 font-medium">Red-flag alerts</span>
                    {enabled.length === 0 ? (
                      <span className="text-xs text-muted-foreground self-center ml-1">No optional categories selected.</span>
                    ) : enabled.map((t) => (
                      <span key={t.key} className="text-[10px] rounded-full bg-blue-100 border border-blue-200 text-blue-800 px-2 py-0.5 font-medium">{t.label}</span>
                    ))}
                  </div>
                  <div className="pt-1 border-t border-blue-100 flex items-center gap-1.5">
                    <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Frequency:</span>
                    <span className="text-[10px] text-blue-700">
                      {freq === "daily" ? "Daily digest" : freq === "weekly" ? "Weekly digest" : "Send immediately"}
                    </span>
                  </div>
                </>
              );
            })()}
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

      {/* ── ID Document ── */}
      <div className="border-2 border-[#1C2B4B]/20 rounded-lg overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <IdCard className="h-4 w-4 text-[#1C2B4B] shrink-0" />
          <span className="text-sm font-semibold">Government ID</span>
          {vaultIdDoc.hasIdDocument ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border border-green-300 bg-green-50 text-green-700 ml-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> On file
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 ml-1">
              <XCircle className="h-2.5 w-2.5" /> Not uploaded
            </span>
          )}
        </div>
        {vaultIdDoc.idScanRequestedAt && !vaultIdDoc.hasIdDocument && (
          <div className="mx-4 mb-0 mt-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900">Action required — An officer has requested your ID verification</p>
              <p className="text-[10px] text-amber-800 mt-0.5">
                Please upload a photo of your government-issued ID below to complete identity verification.
                Requested {new Date(vaultIdDoc.idScanRequestedAt).toLocaleDateString()}.
              </p>
            </div>
          </div>
        )}
        <div className="border-t border-[#1C2B4B]/15 px-4 py-4">
          <IdDocumentPanel vaultData={vaultIdDoc} />
        </div>
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
