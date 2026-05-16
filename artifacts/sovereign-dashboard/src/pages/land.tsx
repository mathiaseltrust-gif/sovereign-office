import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Landmark, Building2, Leaf, Droplets, Zap, Tractor, Mountain,
  Plus, X, Edit2, Trash2, AlertTriangle, CheckCircle, Clock,
  DollarSign, TrendingUp, Loader2, TreePine, Waves, Package,
  Wrench, FlaskConical, BarChart3, ArrowRight, MapPin, FileText,
  ChevronRight,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

type Parcel = {
  id: number; tract_number: string; parcel_id: string; legal_description: string;
  acreage: string; classification: string; status: string; county: string; state: string;
  plss_description: string; owner_type: string; acquired_date: string;
  acquisition_source: string; bia_tract_number: string; lat: string; lng: string; notes: string;
};

type Lease = {
  id: number; parcel_id: number; lease_type: string; lessee_name: string;
  start_date: string; end_date: string; annual_rent: string;
  payment_frequency: string; status: string; bia_lease_number: string;
  description: string; tract_number?: string;
};

type Asset = {
  id: number; parcel_id: number; asset_type: string; name: string;
  description: string; estimated_value: string; condition_rating: string;
  year_built: number; notes: string; tract_number?: string;
};

type PipelineEntry = {
  id: number; name: string; description: string; acreage: string;
  county: string; state: string; estimated_cost: string; acquisition_type: string;
  stage: string; bia_case_number: string; priority: string; target_date: string; notes: string;
};

type Stats = {
  totalParcels: number; totalAcreage: number; trustAcreage: number; feeAcreage: number;
  allotmentAcreage: number; restrictedAcreage: number; activeParcels: number;
  disputedParcels: number; totalLeases: number; activeLeases: number;
  annualRevenue: number; expiringSoon: number; pipelineCount: number;
  activePipeline: number; pipelineAcreage: number;
};

// ── constants ─────────────────────────────────────────────────────────────────

const CLASSIFICATIONS = ["trust", "fee", "allotment", "restricted", "fee_to_trust_pending"];
const PARCEL_STATUSES = ["active", "inactive", "disputed", "transferred", "pending"];
const LEASE_TYPES = ["agricultural", "surface", "mineral", "commercial", "residential", "grazing", "timber"];
const ASSET_TYPES = [
  { value: "building", label: "Building", icon: Building2 },
  { value: "infrastructure", label: "Infrastructure", icon: Wrench },
  { value: "water_right", label: "Water Right", icon: Droplets },
  { value: "mineral_right", label: "Mineral Right", icon: Mountain },
  { value: "timber", label: "Timber / Forestry", icon: TreePine },
  { value: "agricultural", label: "Agricultural Land", icon: Tractor },
  { value: "equipment", label: "Equipment", icon: Package },
  { value: "natural_resource", label: "Natural Resource", icon: Leaf },
];
const PIPELINE_STAGES = [
  { value: "identified",    label: "Identified",      color: "bg-slate-500" },
  { value: "research",      label: "Research",        color: "bg-blue-600" },
  { value: "negotiating",   label: "Negotiating",     color: "bg-indigo-600" },
  { value: "under_contract",label: "Under Contract",  color: "bg-violet-600" },
  { value: "bia_processing",label: "BIA Processing",  color: "bg-amber-600" },
  { value: "transferred",   label: "Transferred",     color: "bg-emerald-600" },
  { value: "cancelled",     label: "Cancelled",       color: "bg-red-700" },
];
const ACQUISITION_TYPES = ["fee_to_trust", "purchase", "donation", "exchange", "reacquisition", "treaty_restoration"];
const CONDITIONS = ["excellent", "good", "fair", "poor"];
const PRIORITIES = ["high", "medium", "low"];

// ── helpers ───────────────────────────────────────────────────────────────────

async function authFetch(url: string, opts: RequestInit = {}) {
  const token = await getCurrentBearerToken();
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtAcres(n: number) {
  return `${fmt(n)} ac`;
}

function fmtDollar(n: number) {
  return n >= 1_000_000
    ? `$${fmt(n / 1_000_000)}M`
    : n >= 1_000
    ? `$${fmt(n / 1_000, 0)}K`
    : `$${fmt(n, 0)}`;
}

function classColor(c: string) {
  const m: Record<string, string> = {
    trust: "bg-emerald-700 text-emerald-100",
    fee: "bg-slate-600 text-slate-100",
    allotment: "bg-amber-700 text-amber-100",
    restricted: "bg-violet-700 text-violet-100",
    fee_to_trust_pending: "bg-blue-700 text-blue-100",
  };
  return m[c] ?? "bg-muted text-muted-foreground";
}

function leaseStatusColor(s: string) {
  if (s === "active") return "text-emerald-400";
  if (s === "expired") return "text-red-400";
  if (s === "pending") return "text-blue-400";
  return "text-amber-400";
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

// ── tiny shared UI ────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${className ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-background/60 border border-border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className={`text-2xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#111] border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-[#111] z-10">
          <h2 className="text-base font-semibold text-amber-400">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Parcel Modal ──────────────────────────────────────────────────────────────

const EMPTY_PARCEL = {
  tractNumber: "", parcelId: "", legalDescription: "", acreage: "",
  classification: "trust", status: "active", county: "", state: "TX",
  plssDescription: "", ownerType: "tribal", acquiredDate: "", acquisitionSource: "",
  biaTractNumber: "", lat: "", lng: "", notes: "",
};

function ParcelModal({ parcel, onClose, onSaved }: {
  parcel?: Parcel; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(parcel ? {
    tractNumber: parcel.tract_number ?? "", parcelId: parcel.parcel_id ?? "",
    legalDescription: parcel.legal_description ?? "", acreage: parcel.acreage ?? "",
    classification: parcel.classification ?? "trust", status: parcel.status ?? "active",
    county: parcel.county ?? "", state: parcel.state ?? "TX",
    plssDescription: parcel.plss_description ?? "", ownerType: parcel.owner_type ?? "tribal",
    acquiredDate: parcel.acquired_date ?? "", acquisitionSource: parcel.acquisition_source ?? "",
    biaTractNumber: parcel.bia_tract_number ?? "", lat: parcel.lat ?? "", lng: parcel.lng ?? "",
    notes: parcel.notes ?? "",
  } : { ...EMPTY_PARCEL });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const url = parcel ? `/api/land/parcels/${parcel.id}` : "/api/land/parcels";
      const method = parcel ? "PUT" : "POST";
      const res = await authFetch(url, { method, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={parcel ? "Edit Parcel" : "Register New Parcel"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tract Number"><Input value={form.tractNumber} onChange={set("tractNumber")} placeholder="e.g. TX-2024-001" /></Field>
        <Field label="Parcel ID"><Input value={form.parcelId} onChange={set("parcelId")} placeholder="County parcel ID" /></Field>
        <Field label="Classification">
          <Sel value={form.classification} onChange={v => setForm(f => ({ ...f, classification: v }))}
            options={CLASSIFICATIONS.map(c => ({ value: c, label: c.replace(/_/g, " ") }))} />
        </Field>
        <Field label="Status">
          <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={PARCEL_STATUSES.map(s => ({ value: s, label: s }))} />
        </Field>
        <Field label="Acreage"><Input type="number" step="0.0001" value={form.acreage} onChange={set("acreage")} placeholder="0.0000" /></Field>
        <Field label="Owner Type">
          <Sel value={form.ownerType} onChange={v => setForm(f => ({ ...f, ownerType: v }))}
            options={[{ value: "tribal", label: "Tribal" }, { value: "individual", label: "Individual" }, { value: "fractional", label: "Fractional" }]} />
        </Field>
        <Field label="County"><Input value={form.county} onChange={set("county")} placeholder="County name" /></Field>
        <Field label="State"><Input value={form.state} onChange={set("state")} placeholder="TX" /></Field>
        <div className="col-span-2">
          <Field label="Legal Description"><Textarea value={form.legalDescription} onChange={set("legalDescription")} placeholder="Full legal description of the parcel" className="resize-none h-20" /></Field>
        </div>
        <Field label="PLSS Description"><Input value={form.plssDescription} onChange={set("plssDescription")} placeholder="e.g. T2N R3E S14 NW¼" /></Field>
        <Field label="BIA Tract Number"><Input value={form.biaTractNumber} onChange={set("biaTractNumber")} placeholder="BIA tract identifier" /></Field>
        <Field label="Acquisition Source">
          <Sel value={form.acquisitionSource} onChange={v => setForm(f => ({ ...f, acquisitionSource: v }))}
            options={ACQUISITION_TYPES.map(t => ({ value: t, label: t.replace(/_/g, " ") }))} placeholder="Select source" />
        </Field>
        <Field label="Date Acquired"><Input type="date" value={form.acquiredDate} onChange={set("acquiredDate")} /></Field>
        <Field label="Latitude"><Input value={form.lat} onChange={set("lat")} placeholder="e.g. 30.2672" /></Field>
        <Field label="Longitude"><Input value={form.lng} onChange={set("lng")} placeholder="e.g. -97.7431" /></Field>
        <div className="col-span-2">
          <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Internal notes" className="resize-none h-16" /></Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {parcel ? "Save Changes" : "Register Parcel"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Lease Modal ───────────────────────────────────────────────────────────────

const EMPTY_LEASE = {
  parcelId: "", leaseType: "agricultural", lesseeName: "", startDate: "", endDate: "",
  annualRent: "", paymentFrequency: "annual", status: "active", biaLeaseNumber: "", description: "",
};

function LeaseModal({ lease, parcels, onClose, onSaved }: {
  lease?: Lease; parcels: Parcel[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(lease ? {
    parcelId: String(lease.parcel_id ?? ""), leaseType: lease.lease_type ?? "agricultural",
    lesseeName: lease.lessee_name ?? "", startDate: lease.start_date?.split("T")[0] ?? "",
    endDate: lease.end_date?.split("T")[0] ?? "", annualRent: lease.annual_rent ?? "",
    paymentFrequency: lease.payment_frequency ?? "annual", status: lease.status ?? "active",
    biaLeaseNumber: lease.bia_lease_number ?? "", description: lease.description ?? "",
  } : { ...EMPTY_LEASE });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const url = lease ? `/api/land/leases/${lease.id}` : "/api/land/leases";
      const method = lease ? "PUT" : "POST";
      const res = await authFetch(url, { method, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={lease ? "Edit Lease" : "Record New Lease"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Parcel">
            <Sel value={form.parcelId} onChange={v => setForm(f => ({ ...f, parcelId: v }))}
              options={parcels.map(p => ({ value: String(p.id), label: `${p.tract_number || p.parcel_id || `#${p.id}`} — ${p.legal_description?.slice(0, 50) ?? ""}` }))}
              placeholder="Select parcel" />
          </Field>
        </div>
        <Field label="Lease Type">
          <Sel value={form.leaseType} onChange={v => setForm(f => ({ ...f, leaseType: v }))}
            options={LEASE_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
        </Field>
        <Field label="Status">
          <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={[{ value: "active", label: "Active" }, { value: "pending", label: "Pending" }, { value: "expired", label: "Expired" }, { value: "terminated", label: "Terminated" }]} />
        </Field>
        <div className="col-span-2">
          <Field label="Lessee Name"><Input value={form.lesseeName} onChange={set("lesseeName")} placeholder="Lessee / tenant name" /></Field>
        </div>
        <Field label="Start Date"><Input type="date" value={form.startDate} onChange={set("startDate")} /></Field>
        <Field label="End Date"><Input type="date" value={form.endDate} onChange={set("endDate")} /></Field>
        <Field label="Annual Rent ($)"><Input type="number" step="0.01" value={form.annualRent} onChange={set("annualRent")} placeholder="0.00" /></Field>
        <Field label="Payment Frequency">
          <Sel value={form.paymentFrequency} onChange={v => setForm(f => ({ ...f, paymentFrequency: v }))}
            options={[{ value: "annual", label: "Annual" }, { value: "semi-annual", label: "Semi-Annual" }, { value: "quarterly", label: "Quarterly" }, { value: "monthly", label: "Monthly" }]} />
        </Field>
        <div className="col-span-2">
          <Field label="BIA Lease Number"><Input value={form.biaLeaseNumber} onChange={set("biaLeaseNumber")} placeholder="BIA assigned lease number" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Description"><Textarea value={form.description} onChange={set("description")} placeholder="Lease terms, conditions, permitted use…" className="resize-none h-20" /></Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {lease ? "Save Changes" : "Record Lease"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Asset Modal ───────────────────────────────────────────────────────────────

const EMPTY_ASSET = {
  parcelId: "", assetType: "building", name: "", description: "",
  estimatedValue: "", conditionRating: "good", yearBuilt: "", notes: "",
};

function AssetModal({ asset, parcels, onClose, onSaved }: {
  asset?: Asset; parcels: Parcel[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(asset ? {
    parcelId: String(asset.parcel_id ?? ""), assetType: asset.asset_type ?? "building",
    name: asset.name ?? "", description: asset.description ?? "",
    estimatedValue: asset.estimated_value ?? "", conditionRating: asset.condition_rating ?? "good",
    yearBuilt: String(asset.year_built ?? ""), notes: asset.notes ?? "",
  } : { ...EMPTY_ASSET });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const url = asset ? `/api/land/assets/${asset.id}` : "/api/land/assets";
      const method = asset ? "PUT" : "POST";
      const res = await authFetch(url, { method, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={asset ? "Edit Asset" : "Record New Asset"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Parcel">
            <Sel value={form.parcelId} onChange={v => setForm(f => ({ ...f, parcelId: v }))}
              options={parcels.map(p => ({ value: String(p.id), label: `${p.tract_number || p.parcel_id || `#${p.id}`} — ${p.legal_description?.slice(0, 50) ?? ""}` }))}
              placeholder="Select parcel" />
          </Field>
        </div>
        <Field label="Asset Type">
          <Sel value={form.assetType} onChange={v => setForm(f => ({ ...f, assetType: v }))}
            options={ASSET_TYPES.map(t => ({ value: t.value, label: t.label }))} />
        </Field>
        <Field label="Condition">
          <Sel value={form.conditionRating} onChange={v => setForm(f => ({ ...f, conditionRating: v }))}
            options={CONDITIONS.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
        </Field>
        <div className="col-span-2">
          <Field label="Name / Title"><Input value={form.name} onChange={set("name")} placeholder="e.g. Main Administration Building" /></Field>
        </div>
        <Field label="Estimated Value ($)"><Input type="number" step="0.01" value={form.estimatedValue} onChange={set("estimatedValue")} placeholder="0.00" /></Field>
        <Field label="Year Built"><Input type="number" value={form.yearBuilt} onChange={set("yearBuilt")} placeholder="e.g. 1998" /></Field>
        <div className="col-span-2">
          <Field label="Description"><Textarea value={form.description} onChange={set("description")} placeholder="Physical description, permitted uses, deed restrictions…" className="resize-none h-20" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Maintenance history, encumbrances, contacts…" className="resize-none h-14" /></Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {asset ? "Save Changes" : "Record Asset"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Pipeline Modal ────────────────────────────────────────────────────────────

const EMPTY_PIPELINE = {
  name: "", description: "", acreage: "", county: "", state: "TX", estimatedCost: "",
  acquisitionType: "fee_to_trust", stage: "identified", biaCaseNumber: "",
  priority: "medium", targetDate: "", notes: "",
};

function PipelineModal({ entry, onClose, onSaved }: {
  entry?: PipelineEntry; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(entry ? {
    name: entry.name ?? "", description: entry.description ?? "",
    acreage: entry.acreage ?? "", county: entry.county ?? "", state: entry.state ?? "TX",
    estimatedCost: entry.estimated_cost ?? "", acquisitionType: entry.acquisition_type ?? "fee_to_trust",
    stage: entry.stage ?? "identified", biaCaseNumber: entry.bia_case_number ?? "",
    priority: entry.priority ?? "medium", targetDate: entry.target_date ?? "", notes: entry.notes ?? "",
  } : { ...EMPTY_PIPELINE });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = entry ? `/api/land/pipeline/${entry.id}` : "/api/land/pipeline";
      const method = entry ? "PUT" : "POST";
      const res = await authFetch(url, { method, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={entry ? "Edit Acquisition Entry" : "Add to Acquisition Pipeline"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Name / Identifier *"><Input value={form.name} onChange={set("name")} placeholder="e.g. East Meadow 40-Acre Tract" /></Field>
        </div>
        <Field label="Acquisition Type">
          <Sel value={form.acquisitionType} onChange={v => setForm(f => ({ ...f, acquisitionType: v }))}
            options={ACQUISITION_TYPES.map(t => ({ value: t, label: t.replace(/_/g, " ") }))} />
        </Field>
        <Field label="Current Stage">
          <Sel value={form.stage} onChange={v => setForm(f => ({ ...f, stage: v }))}
            options={PIPELINE_STAGES.map(s => ({ value: s.value, label: s.label }))} />
        </Field>
        <Field label="Priority">
          <Sel value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
            options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
        </Field>
        <Field label="Target Completion"><Input type="date" value={form.targetDate} onChange={set("targetDate")} /></Field>
        <Field label="Acreage"><Input type="number" step="0.0001" value={form.acreage} onChange={set("acreage")} placeholder="0.0000" /></Field>
        <Field label="Estimated Cost ($)"><Input type="number" step="0.01" value={form.estimatedCost} onChange={set("estimatedCost")} placeholder="0.00" /></Field>
        <Field label="County"><Input value={form.county} onChange={set("county")} placeholder="County name" /></Field>
        <Field label="State"><Input value={form.state} onChange={set("state")} placeholder="TX" /></Field>
        <div className="col-span-2">
          <Field label="BIA Case Number"><Input value={form.biaCaseNumber} onChange={set("biaCaseNumber")} placeholder="BIA case / application number" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Description"><Textarea value={form.description} onChange={set("description")} placeholder="Background, purpose, sovereign interest, cultural significance…" className="resize-none h-20" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Contacts, obstacles, next steps…" className="resize-none h-14" /></Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving || !form.name.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {entry ? "Save Changes" : "Add to Pipeline"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ stats, leases }: { stats: Stats; leases: Lease[] }) {
  const expiring = leases.filter(l => l.status === "active" && l.end_date && daysUntil(l.end_date) <= 180 && daysUntil(l.end_date) > 0);

  const totalAc = stats.totalAcreage || 1;
  const breakdown = [
    { label: "Trust Land", ac: stats.trustAcreage, color: "bg-emerald-600" },
    { label: "Allotment", ac: stats.allotmentAcreage, color: "bg-amber-600" },
    { label: "Restricted", ac: stats.restrictedAcreage, color: "bg-violet-600" },
    { label: "Fee Land", ac: stats.feeAcreage, color: "bg-slate-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={Landmark} label="Total Parcels" value={String(stats.totalParcels)} sub={`${stats.activeParcels} active`} />
        <StatCard icon={MapPin} label="Total Acreage" value={fmtAcres(stats.totalAcreage)} sub={`${fmtAcres(stats.trustAcreage)} in trust`} accent="text-emerald-400" />
        <StatCard icon={FileText} label="Active Leases" value={String(stats.activeLeases)} sub={stats.expiringSoon > 0 ? `${stats.expiringSoon} expiring soon` : "All current"} accent={stats.expiringSoon > 0 ? "text-amber-400" : undefined} />
        <StatCard icon={DollarSign} label="Est. Annual Revenue" value={fmtDollar(stats.annualRevenue)} sub="From active leases" accent="text-emerald-400" />
        <StatCard icon={TrendingUp} label="In Acquisition Pipeline" value={String(stats.activePipeline)} sub={fmtAcres(stats.pipelineAcreage) + " targeted"} accent="text-blue-400" />
        <StatCard icon={AlertTriangle} label="Disputed Parcels" value={String(stats.disputedParcels)} sub="Requiring attention" accent={stats.disputedParcels > 0 ? "text-red-400" : undefined} />
      </div>

      <div className="bg-background/60 border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Land Classification Breakdown</h3>
        <div className="space-y-3">
          {breakdown.map(b => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24 shrink-0">{b.label}</span>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${Math.min(100, (b.ac / totalAc) * 100)}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground w-24 text-right shrink-0">{fmtAcres(b.ac)}</span>
            </div>
          ))}
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4" /> Lease Expirations — Next 180 Days
          </h3>
          <div className="space-y-2">
            {expiring.slice(0, 8).map(l => {
              const d = daysUntil(l.end_date);
              return (
                <div key={l.id} className="flex items-center justify-between text-sm py-1.5 border-b border-amber-900/30 last:border-0">
                  <div>
                    <span className="text-foreground font-medium">{l.lessee_name || "Unknown Lessee"}</span>
                    <span className="text-muted-foreground ml-2 text-xs capitalize">{l.lease_type}</span>
                    {l.tract_number && <span className="text-muted-foreground ml-2 text-xs">· {l.tract_number}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{new Date(l.end_date).toLocaleDateString()}</span>
                    <span className={`text-xs font-semibold ${d <= 30 ? "text-red-400" : d <= 90 ? "text-amber-400" : "text-yellow-500"}`}>
                      {d} days
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Parcels Tab ───────────────────────────────────────────────────────────────

function ParcelsTab({ parcels, onRefresh }: { parcels: Parcel[]; onRefresh: () => void }) {
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Parcel | null>(null);
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = parcels.filter(p =>
    (!filterClass || p.classification === filterClass) &&
    (!filterStatus || p.status === filterStatus)
  );

  async function deleteParcel(id: number) {
    if (!confirm("Permanently remove this parcel record?")) return;
    setDeleting(id);
    try {
      await authFetch(`/api/land/parcels/${id}`, { method: "DELETE" });
      onRefresh();
    } finally { setDeleting(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterClass} onChange={setFilterClass}
          options={CLASSIFICATIONS.map(c => ({ value: c, label: c.replace(/_/g, " ") }))} placeholder="All Classifications" />
        <Sel value={filterStatus} onChange={setFilterStatus}
          options={PARCEL_STATUSES.map(s => ({ value: s, label: s }))} placeholder="All Statuses" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal("add"); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Register Parcel
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-2.5">Tract / Parcel</th>
              <th className="text-left px-4 py-2.5">Legal Description</th>
              <th className="text-right px-4 py-2.5">Acreage</th>
              <th className="text-left px-4 py-2.5">Classification</th>
              <th className="text-left px-4 py-2.5">County / State</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No parcels registered. Click "Register Parcel" to begin.</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{p.tract_number || "—"}</div>
                  {p.bia_tract_number && <div className="text-xs text-muted-foreground">BIA: {p.bia_tract_number}</div>}
                </td>
                <td className="px-4 py-3 max-w-[240px]">
                  <p className="text-foreground truncate">{p.legal_description || "—"}</p>
                  {p.plss_description && <p className="text-xs text-muted-foreground">{p.plss_description}</p>}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{p.acreage ? fmt(Number(p.acreage)) : "—"}</td>
                <td className="px-4 py-3">
                  <Badge label={p.classification.replace(/_/g, " ")} className={classColor(p.classification)} />
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{[p.county, p.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs capitalize ${p.status === "active" ? "text-emerald-400" : p.status === "disputed" ? "text-red-400" : "text-muted-foreground"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(p); setModal("edit"); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteParcel(p.id)} disabled={deleting === p.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                      {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} parcel{filtered.length !== 1 ? "s" : ""} · {fmtAcres(filtered.reduce((a, p) => a + Number(p.acreage || 0), 0))} total</p>

      {(modal === "add" || modal === "edit") && (
        <ParcelModal
          parcel={modal === "edit" ? editing ?? undefined : undefined}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Leases Tab ────────────────────────────────────────────────────────────────

function LeasesTab({ leases, parcels, onRefresh }: { leases: Lease[]; parcels: Parcel[]; onRefresh: () => void }) {
  const [filter, setFilter] = useState<"all" | "active" | "expiring" | "expired">("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Lease | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = leases.filter(l => {
    if (filter === "all") return true;
    if (filter === "active") return l.status === "active" && (!l.end_date || daysUntil(l.end_date) > 90);
    if (filter === "expiring") return l.status === "active" && l.end_date && daysUntil(l.end_date) <= 90 && daysUntil(l.end_date) > 0;
    if (filter === "expired") return l.status === "expired" || (l.end_date && daysUntil(l.end_date) <= 0);
    return true;
  });

  async function deleteLease(id: number) {
    if (!confirm("Remove this lease record?")) return;
    setDeleting(id);
    try {
      await authFetch(`/api/land/leases/${id}`, { method: "DELETE" });
      onRefresh();
    } finally { setDeleting(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 text-xs">
          {(["all", "active", "expiring", "expired"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md capitalize transition-colors ${filter === f ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Record Lease
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-2.5">Parcel / Tract</th>
              <th className="text-left px-4 py-2.5">Lessee</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Term</th>
              <th className="text-right px-4 py-2.5">Annual Rent</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No leases found.</td></tr>
            )}
            {filtered.map(l => {
              const d = l.end_date ? daysUntil(l.end_date) : null;
              return (
                <tr key={l.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium">{l.tract_number || `Parcel #${l.parcel_id}`}</td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{l.lessee_name || "—"}</div>
                    {l.bia_lease_number && <div className="text-xs text-muted-foreground">BIA: {l.bia_lease_number}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{l.lease_type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {l.start_date ? new Date(l.start_date).toLocaleDateString("en-US", { year: "2-digit", month: "short", day: "numeric" }) : "—"}
                    {" → "}
                    {l.end_date ? new Date(l.end_date).toLocaleDateString("en-US", { year: "2-digit", month: "short", day: "numeric" }) : "Open"}
                    {d !== null && d <= 90 && d > 0 && <span className="ml-1.5 text-amber-400 font-semibold">({d}d)</span>}
                    {d !== null && d <= 0 && <span className="ml-1.5 text-red-400 font-semibold">(expired)</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">
                    {l.annual_rent ? `$${Number(l.annual_rent).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs capitalize font-medium ${leaseStatusColor(l.status)}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(l); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteLease(l.id)} disabled={deleting === l.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                        {deleting === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} lease{filtered.length !== 1 ? "s" : ""}
        {filter === "all" || filter === "active" ? ` · $${leases.filter(l => l.status === "active").reduce((a, l) => a + Number(l.annual_rent || 0), 0).toLocaleString()} annual revenue` : ""}
      </p>

      {modal && (
        <LeaseModal
          lease={editing ?? undefined}
          parcels={parcels}
          onClose={() => { setModal(false); setEditing(null); }}
          onSaved={() => { setModal(false); setEditing(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Assets Tab ────────────────────────────────────────────────────────────────

function AssetsTab({ assets, parcels, onRefresh }: { assets: Asset[]; parcels: Parcel[]; onRefresh: () => void }) {
  const [filterType, setFilterType] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = assets.filter(a => !filterType || a.asset_type === filterType);

  async function deleteAsset(id: number) {
    if (!confirm("Remove this asset record?")) return;
    setDeleting(id);
    try {
      await authFetch(`/api/land/assets/${id}`, { method: "DELETE" });
      onRefresh();
    } finally { setDeleting(null); }
  }

  const totalValue = filtered.reduce((a, x) => a + Number(x.estimated_value || 0), 0);

  function AssetIcon({ type }: { type: string }) {
    const found = ASSET_TYPES.find(t => t.value === type);
    const Icon = found?.icon ?? Package;
    return <Icon className="w-4 h-4" />;
  }

  const conditionColor = (c: string) => ({
    excellent: "text-emerald-400", good: "text-green-400",
    fair: "text-amber-400", poor: "text-red-400",
  }[c] ?? "text-muted-foreground");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterType} onChange={setFilterType}
          options={ASSET_TYPES.map(t => ({ value: t.value, label: t.label }))} placeholder="All Asset Types" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Record Asset
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-2.5">Asset</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Parcel</th>
              <th className="text-left px-4 py-2.5">Condition</th>
              <th className="text-right px-4 py-2.5">Est. Value</th>
              <th className="text-right px-4 py-2.5">Yr. Built</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No assets recorded. Click "Record Asset" to begin.</td></tr>
            )}
            {filtered.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400"><AssetIcon type={a.asset_type} /></span>
                    <div>
                      <div className="text-foreground font-medium">{a.name || "—"}</div>
                      {a.description && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{a.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{a.asset_type?.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{a.tract_number || `#${a.parcel_id}`}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs capitalize ${conditionColor(a.condition_rating)}`}>{a.condition_rating || "—"}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {a.estimated_value ? `$${Number(a.estimated_value).toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">{a.year_built || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(a); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteAsset(a.id)} disabled={deleting === a.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                      {deleting === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
        {totalValue > 0 ? ` · ${fmtDollar(totalValue)} total estimated value` : ""}
      </p>

      {modal && (
        <AssetModal
          asset={editing ?? undefined}
          parcels={parcels}
          onClose={() => { setModal(false); setEditing(null); }}
          onSaved={() => { setModal(false); setEditing(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────

function PipelineTab({ pipeline, onRefresh }: { pipeline: PipelineEntry[]; onRefresh: () => void }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<PipelineEntry | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filterStage, setFilterStage] = useState("");

  const filtered = pipeline.filter(e => !filterStage || e.stage === filterStage);

  async function deleteEntry(id: number) {
    if (!confirm("Remove this acquisition entry?")) return;
    setDeleting(id);
    try {
      await authFetch(`/api/land/pipeline/${id}`, { method: "DELETE" });
      onRefresh();
    } finally { setDeleting(null); }
  }

  async function advanceStage(entry: PipelineEntry) {
    const stages = PIPELINE_STAGES.filter(s => s.value !== "cancelled").map(s => s.value);
    const idx = stages.indexOf(entry.stage);
    if (idx < 0 || idx >= stages.length - 1) return;
    const nextStage = stages[idx + 1];
    await authFetch(`/api/land/pipeline/${entry.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...entry, stage: nextStage }),
    });
    onRefresh();
  }

  function stageInfo(s: string) {
    return PIPELINE_STAGES.find(x => x.value === s) ?? PIPELINE_STAGES[0];
  }

  const priorityColor = (p: string) => ({ high: "text-red-400", medium: "text-amber-400", low: "text-slate-400" }[p] ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterStage} onChange={setFilterStage}
          options={PIPELINE_STAGES.map(s => ({ value: s.value, label: s.label }))} placeholder="All Stages" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add to Pipeline
          </Button>
        </div>
      </div>

      <div className="hidden md:flex gap-1 mb-2">
        {PIPELINE_STAGES.filter(s => s.value !== "cancelled").map((s, i, arr) => (
          <div key={s.value} className="flex items-center gap-1 flex-1">
            <div className="flex-1 text-center">
              <div className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${s.color} text-white`}>{s.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {pipeline.filter(e => e.stage === s.value).length}
              </div>
            </div>
            {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-lg">
            No acquisition entries. Click "Add to Pipeline" to track land acquisition efforts.
          </div>
        )}
        {filtered.map(e => {
          const si = stageInfo(e.stage);
          const stages = PIPELINE_STAGES.filter(s => s.value !== "cancelled").map(s => s.value);
          const isLast = stages.indexOf(e.stage) >= stages.length - 1;
          return (
            <div key={e.id} className="bg-background/60 border border-border rounded-lg p-4 hover:border-amber-700/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{e.name}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded text-white ${si.color}`}>{si.label}</span>
                    <span className={`text-xs font-medium capitalize ${priorityColor(e.priority)}`}>{e.priority} priority</span>
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    {e.acreage && <span><MapPin className="w-3 h-3 inline mr-0.5" />{fmtAcres(Number(e.acreage))}</span>}
                    {e.county && <span>{[e.county, e.state].filter(Boolean).join(", ")}</span>}
                    {e.estimated_cost && <span><DollarSign className="w-3 h-3 inline mr-0.5" />Est. {fmtDollar(Number(e.estimated_cost))}</span>}
                    {e.bia_case_number && <span>BIA: {e.bia_case_number}</span>}
                    {e.target_date && <span>Target: {new Date(e.target_date).toLocaleDateString()}</span>}
                    <span className="capitalize">{e.acquisition_type?.replace(/_/g, " ")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isLast && e.stage !== "cancelled" && (
                    <button onClick={() => advanceStage(e)} title="Advance to next stage" className="p-1.5 rounded hover:bg-amber-600/20 text-amber-500 hover:text-amber-400 text-xs font-medium flex items-center gap-1">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => { setEditing(e); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteEntry(e.id)} disabled={deleting === e.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                    {deleting === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <PipelineModal
          entry={editing ?? undefined}
          onClose={() => { setModal(false); setEditing(null); }}
          onSaved={() => { setModal(false); setEditing(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  label: "Overview",           icon: BarChart3 },
  { id: "parcels",   label: "Land Registry",       icon: Landmark },
  { id: "leases",    label: "Leases",              icon: FileText },
  { id: "assets",    label: "Assets & Resources",  icon: Building2 },
  { id: "pipeline",  label: "Acquisition Pipeline", icon: TrendingUp },
];

export default function LandPage() {
  const [tab, setTab] = useState("overview");
  const qc = useQueryClient();

  const statsQ = useQuery<Stats>({
    queryKey: ["land-stats"],
    queryFn: async () => {
      const token = await getCurrentBearerToken();
      const r = await fetch("/api/land/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const parcelsQ = useQuery<Parcel[]>({
    queryKey: ["land-parcels"],
    queryFn: async () => {
      const token = await getCurrentBearerToken();
      const r = await fetch("/api/land/parcels", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const leasesQ = useQuery<Lease[]>({
    queryKey: ["land-leases"],
    queryFn: async () => {
      const token = await getCurrentBearerToken();
      const r = await fetch("/api/land/leases", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const assetsQ = useQuery<Asset[]>({
    queryKey: ["land-assets"],
    queryFn: async () => {
      const token = await getCurrentBearerToken();
      const r = await fetch("/api/land/assets", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const pipelineQ = useQuery<PipelineEntry[]>({
    queryKey: ["land-pipeline"],
    queryFn: async () => {
      const token = await getCurrentBearerToken();
      const r = await fetch("/api/land/pipeline", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const refresh = useCallback((keys?: string[]) => {
    const all = ["land-stats", "land-parcels", "land-leases", "land-assets", "land-pipeline"];
    (keys ?? all).forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  }, [qc]);

  const stats = statsQ.data ?? {
    totalParcels: 0, totalAcreage: 0, trustAcreage: 0, feeAcreage: 0,
    allotmentAcreage: 0, restrictedAcreage: 0, activeParcels: 0, disputedParcels: 0,
    totalLeases: 0, activeLeases: 0, annualRevenue: 0, expiringSoon: 0,
    pipelineCount: 0, activePipeline: 0, pipelineAcreage: 0,
  };

  const loading = statsQ.isLoading || parcelsQ.isLoading;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="border-b border-amber-700/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-600/20 border border-amber-600/40 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Land & Asset Management</h1>
            <p className="text-sm text-muted-foreground">Tribal land registry, lease management, and acquisition pipeline</p>
          </div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
        </div>
      </div>

      <div className="flex gap-1 bg-muted/30 rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-background text-amber-400 font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "overview" && <OverviewTab stats={stats} leases={leasesQ.data ?? []} />}
        {tab === "parcels" && (
          <ParcelsTab
            parcels={parcelsQ.data ?? []}
            onRefresh={() => refresh(["land-parcels", "land-stats"])}
          />
        )}
        {tab === "leases" && (
          <LeasesTab
            leases={leasesQ.data ?? []}
            parcels={parcelsQ.data ?? []}
            onRefresh={() => refresh(["land-leases", "land-stats"])}
          />
        )}
        {tab === "assets" && (
          <AssetsTab
            assets={assetsQ.data ?? []}
            parcels={parcelsQ.data ?? []}
            onRefresh={() => refresh(["land-assets"])}
          />
        )}
        {tab === "pipeline" && (
          <PipelineTab
            pipeline={pipelineQ.data ?? []}
            onRefresh={() => refresh(["land-pipeline", "land-stats"])}
          />
        )}
      </div>
    </div>
  );
}
