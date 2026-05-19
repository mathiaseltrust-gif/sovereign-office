import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentBearerToken, useIsOfficer } from "@/components/auth-provider";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Landmark, Building2, Leaf, Droplets, Mountain, Tractor, Package, Wrench,
  Plus, X, Edit2, Trash2, AlertTriangle, Clock, DollarSign, TrendingUp,
  Loader2, TreePine, Scale, ScrollText, ShieldAlert, ShieldCheck,
  ArrowRight, MapPin, FileText, BarChart3, ChevronRight, Gavel, BookOpen,
  Map, FileArchive, CalendarDays, Users, Link2, Calendar, CheckCircle2, XCircle, ExternalLink, Search,
} from "lucide-react";
import { OpenInvestigationModal } from "@/components/OpenInvestigationModal";

// ── types ─────────────────────────────────────────────────────────────────────

type Parcel = {
  id: number; tract_number: string; parcel_id: string; legal_description: string;
  acreage: string; classification: string; status: string; county: string; state: string;
  plss_description: string; owner_type: string; acquired_date: string;
  acquisition_source: string; bia_tract_number: string; lat: string; lng: string; notes: string;
  // Tribal Code Authority layer
  internal_tribal_status: string; federal_admin_status: string; jurisdictional_status: string;
  beneficiary_stewardship_type: string; protection_restriction_status: string;
  tribal_code_ref: string; tribal_court_order_num: string;
  protected_status_basis: string; restriction_basis: string; enforcement_authority: string;
  federal_law_cross_ref: string; stewardship_purpose: string;
  cultural_significance: string; historical_occupancy: string;
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

type StewardshipEntry = {
  id: number; name: string; description: string; acreage: string;
  county: string; state: string; estimated_cost: string; acquisition_type: string;
  stage: string; bia_case_number: string; priority: string; target_date: string;
  notes: string; stewardship_purpose: string; cultural_notes: string;
  tribal_code_ref: string; jurisdictional_status: string;
};

type Encumbrance = {
  id: number; parcel_id: number; encumbrance_type: string; title: string;
  description: string; source: string; date_identified: string; status: string;
  federal_law_implicated: string; tribal_code_ref: string; void_ab_initio: boolean;
  resolution_notes: string; tract_number?: string;
};

type Notice = {
  id: number; parcel_id: number; notice_type: string; title: string;
  content: string; issued_date: string; effective_date: string; served_to: string;
  service_method: string; status: string; tribal_code_ref: string;
  federal_law_ref: string; court_order_ref: string; enforcement_action: string;
  tract_number?: string;
};

type Deed = {
  id: number; parcel_id: number; deed_type: string; grantor: string; grantee: string;
  recording_date: string; recording_number: string; recording_jurisdiction: string;
  instrument_date: string; consideration: string; exemption_basis: string;
  sovereign_immunity_claim: boolean; conservation_easement: boolean;
  community_land_use: string; tribal_code_ref: string; federal_law_ref: string;
  file_key: string; file_name: string; file_url: string;
  notes: string; status: string; tract_number?: string;
};

type TaxCompliance = {
  id: number; parcel_id: number; compliance_type: string; jurisdiction: string;
  tax_year: number; deadline_date: string; amount_assessed: string; amount_paid: string;
  payment_date: string; status: string;
  sovereign_immunity_claimed: boolean; immunity_claim_date: string; immunity_basis: string;
  exemption_type: string; exemption_filed_date: string; exemption_status: string;
  appeal_filed: boolean; appeal_date: string; appeal_basis: string;
  tribal_code_ref: string; federal_law_ref: string; notes: string;
  tract_number?: string; county?: string;
};

type MemberAssignment = {
  id: number; parcel_id: number; member_id: string; member_name: string;
  member_email: string; assignment_role: string; family_name: string;
  steward_family: string; assigned_date: string; end_date: string;
  status: string; responsibilities: string; cultural_connection: string;
  tribal_code_ref: string; authorized_by: string; notes: string;
  tract_number?: string;
};

type Stats = {
  totalParcels: number; totalAcreage: number; govAcreage: number; trustAcreage: number;
  protectedAcreage: number; sacredAcreage: number; beneficiaryAcreage: number;
  restrictedAcreage: number; activeParcels: number; disputedParcels: number;
  exclusiveJurisdiction: number; contestedParcels: number;
  totalLeases: number; activeLeases: number; annualRevenue: number; expiringSoon: number;
  pipelineCount: number; activePipeline: number; pipelineAcreage: number;
  activeEncumbrances: number; voidAbInitioCount: number; activeNotices: number;
};

// ── constants ─────────────────────────────────────────────────────────────────

const INTERNAL_TRIBAL_STATUSES = [
  { value: "tribal_government_land",    label: "Tribal Government Land" },
  { value: "tribal_trust_stewardship",  label: "Tribal Trust Stewardship Land" },
  { value: "protected_tribal_land",     label: "Protected Tribal Land" },
  { value: "restricted_tribal_status",  label: "Restricted Tribal Status" },
  { value: "beneficiary_stewardship",   label: "Beneficiary Stewardship Land" },
  { value: "sacred_cultural_land",      label: "Sacred / Cultural Land" },
  { value: "federal_indian_law_implicated", label: "Federal Indian Law Implicated" },
  { value: "jurisdictional_review",     label: "Jurisdictional Review Triggered" },
];

const FEDERAL_ADMIN_STATUSES = [
  { value: "none",                      label: "Not Applicable" },
  { value: "federal_trust",             label: "Federal Trust" },
  { value: "fee_land",                  label: "Fee Land" },
  { value: "fee_to_trust_pending",      label: "Fee-to-Trust Pending (DOI)" },
  { value: "federal_indian_law",        label: "Federal Indian Law Implicated" },
  { value: "jurisdictional_review",     label: "Jurisdictional Review Triggered" },
];

const JURISDICTIONAL_STATUSES = [
  { value: "exclusive_tribal",          label: "Exclusive Tribal Jurisdiction" },
  { value: "concurrent",                label: "Concurrent Jurisdiction" },
  { value: "contested",                 label: "Contested Jurisdiction" },
  { value: "federal_overlay",           label: "Federal Overlay" },
  { value: "state_challenged",          label: "State Challenged" },
];

const BENEFICIARY_TYPES = [
  { value: "member_welfare",            label: "Member Welfare" },
  { value: "housing",                   label: "Housing" },
  { value: "ceremonial_use",            label: "Ceremonial / Cultural Use" },
  { value: "governmental_use",          label: "Governmental Use" },
  { value: "preservation",              label: "Preservation" },
  { value: "community_benefit",         label: "Community Benefit" },
  { value: "economic_development",      label: "Economic Development" },
];

const PROTECTION_STATUSES = [
  { value: "anti_alienation",           label: "Anti-Alienation Protected (METC T4 §4)" },
  { value: "void_ab_initio_protected",  label: "Void Ab Initio — Unauthorized Interference" },
  { value: "court_order_protected",     label: "Tribal Court Order Protected" },
  { value: "treaty_protected",          label: "Treaty Protected" },
  { value: "preservation_restricted",  label: "Preservation Restricted" },
];

const METC_TITLE4_SECTIONS = [
  { value: "METC.T4.§1",  label: "§1 — Short Title & Declaration of Sovereignty" },
  { value: "METC.T4.§2",  label: "§2 — Exclusive Tribal Jurisdiction" },
  { value: "METC.T4.§3",  label: "§3 — Tribal Land Trust Governance" },
  { value: "METC.T4.§4",  label: "§4 — Inherent Anti-Alienation Right" },
  { value: "METC.T4.§5",  label: "§5 — Void Ab Initio — Unauthorized Interference" },
  { value: "METC.T4.§6",  label: "§6 — Protective Orders & Enforcement" },
  { value: "METC.T4.§7",  label: "§7 — Effective Date of Sovereign Orders" },
  { value: "METC.T4.§8",  label: "§8 — Notice & Service Protocols" },
  { value: "METC.T4.§9",  label: "§9 — Jurisdictional Review Triggers" },
  { value: "METC.T4.§10", label: "§10 — Tribal Supreme Court Interpretation & Enforcement" },
];

const FEDERAL_LAW_REFS = [
  { value: "25USC177",          label: "25 U.S.C. §177 — Nonintercourse Act" },
  { value: "18USC1151",         label: "18 U.S.C. §1151 — Indian Country Definition" },
  { value: "25USC2201",         label: "25 U.S.C. §2201 — Indian Land Consolidation Act" },
  { value: "25USC5301",         label: "25 U.S.C. §5301 — Indian Self-Determination Act" },
  { value: "UNDRIP.Art.3",      label: "UNDRIP Art. 3 — Self-Determination" },
  { value: "UNDRIP.Art.26",     label: "UNDRIP Art. 26 — Rights to Lands & Territories" },
  { value: "Worcester.v.Georgia", label: "Worcester v. Georgia (1832)" },
];

const ENCUMBRANCE_TYPES = [
  { value: "lien",                  label: "Lien" },
  { value: "foreclosure_attempt",   label: "Foreclosure Attempt" },
  { value: "tax_assessment",        label: "Tax Assessment" },
  { value: "utility_interference",  label: "Utility Interference" },
  { value: "admin_obstruction",     label: "Administrative Obstruction" },
  { value: "jurisdictional_conflict", label: "Jurisdictional Conflict" },
  { value: "title_dispute",         label: "Title Dispute" },
  { value: "regulatory_overreach",  label: "Regulatory Overreach" },
];

const NOTICE_TYPES = [
  { value: "federal_review",           label: "Notice of Federal Review" },
  { value: "jurisdictional_review",    label: "Jurisdictional Review Notice" },
  { value: "protected_land",           label: "Protected Land Notice" },
  { value: "anti_alienation",          label: "Anti-Alienation Enforcement Notice" },
  { value: "void_ab_initio",           label: "Void Ab Initio Declaration" },
  { value: "admin_obstruction",        label: "Administrative Obstruction Log" },
  { value: "encumbrance_challenge",    label: "Encumbrance Challenge" },
  { value: "preservation",             label: "Preservation Notice" },
];

const STEWARDSHIP_STAGES = [
  { value: "identified",    label: "Identified",        color: "bg-slate-500" },
  { value: "research",      label: "Research",          color: "bg-blue-600" },
  { value: "negotiating",   label: "Negotiating",       color: "bg-indigo-600" },
  { value: "under_contract",label: "Under Arrangement", color: "bg-violet-600" },
  { value: "bia_processing",label: "Federal Review",    color: "bg-amber-600" },
  { value: "transferred",   label: "Restored",          color: "bg-emerald-600" },
  { value: "stewarded",     label: "Under Stewardship", color: "bg-teal-600" },
  { value: "culturally_protected", label: "Culturally Protected", color: "bg-rose-700" },
  { value: "cancelled",     label: "Suspended",         color: "bg-red-700" },
];

const STEWARDSHIP_TYPES = [
  { value: "tribal_governmental_administration", label: "Tribal Governmental Administration" },
  { value: "protected_stewardship",             label: "Protected Stewardship" },
  { value: "beneficiary_held",                  label: "Beneficiary-Held Land" },
  { value: "jurisdictionally_disputed",         label: "Jurisdictionally Disputed" },
  { value: "culturally_protected",              label: "Culturally Protected Territory" },
  { value: "fee_to_trust",                      label: "Fee-to-Trust Application (DOI)" },
  { value: "reacquisition",                     label: "Reacquisition / Treaty Restoration" },
  { value: "purchase",                          label: "Purchase" },
  { value: "donation",                          label: "Donation / Gift" },
];

const PARCEL_STATUSES = ["active", "inactive", "disputed", "transferred", "pending"];
const LEASE_TYPES = ["agricultural", "surface", "mineral", "commercial", "residential", "grazing", "timber"];
const ASSET_TYPES = [
  { value: "building",         label: "Building",           icon: Building2 },
  { value: "infrastructure",   label: "Infrastructure",     icon: Wrench },
  { value: "water_right",      label: "Water Right",        icon: Droplets },
  { value: "mineral_right",    label: "Mineral Right",      icon: Mountain },
  { value: "timber",           label: "Timber / Forestry",  icon: TreePine },
  { value: "agricultural",     label: "Agricultural Land",  icon: Tractor },
  { value: "equipment",        label: "Equipment",          icon: Package },
  { value: "natural_resource", label: "Natural Resource",   icon: Leaf },
];

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

function fmt(n: number, d = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtAcres(n: number) { return `${fmt(n)} ac`; }
function fmtDollar(n: number) {
  return n >= 1_000_000 ? `$${fmt(n / 1_000_000)}M` : n >= 1_000 ? `$${fmt(n / 1_000, 0)}K` : `$${fmt(n, 0)}`;
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function internalStatusColor(s: string) {
  const m: Record<string, string> = {
    tribal_government_land: "bg-amber-700 text-amber-100",
    tribal_trust_stewardship: "bg-emerald-700 text-emerald-100",
    protected_tribal_land: "bg-blue-700 text-blue-100",
    restricted_tribal_status: "bg-violet-700 text-violet-100",
    beneficiary_stewardship: "bg-teal-700 text-teal-100",
    sacred_cultural_land: "bg-rose-800 text-rose-100",
    federal_indian_law_implicated: "bg-orange-700 text-orange-100",
    jurisdictional_review: "bg-red-700 text-red-100",
  };
  return m[s] ?? "bg-muted text-muted-foreground";
}

function jurisdictionColor(s: string) {
  const m: Record<string, string> = {
    exclusive_tribal: "text-emerald-400",
    concurrent: "text-blue-400",
    contested: "text-red-400",
    federal_overlay: "text-amber-400",
    state_challenged: "text-orange-400",
  };
  return m[s] ?? "text-muted-foreground";
}

function leaseStatusColor(s: string) {
  return { active: "text-emerald-400", expired: "text-red-400", pending: "text-blue-400" }[s] ?? "text-amber-400";
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
        <Icon className="w-3.5 h-3.5" />{label}
      </div>
      <p className={`text-2xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#111] border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="text-base font-semibold text-amber-400">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options, placeholder, id }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; id?: string;
}) {
  return (
    <select id={id} aria-label={id} value={value} onChange={e => onChange(e.target.value)}
      className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-amber-500">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SectionDivider({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="col-span-2 border-t border-amber-700/25 pt-4 mt-1">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest">{label}</h3>
      </div>
    </div>
  );
}

// ── Parcel Modal ──────────────────────────────────────────────────────────────

const EMPTY_PARCEL = {
  tractNumber: "", parcelId: "", legalDescription: "", acreage: "",
  classification: "", status: "active", county: "", state: "TX",
  plssDescription: "", ownerType: "tribal", acquiredDate: "", acquisitionSource: "",
  biaTractNumber: "", lat: "", lng: "", notes: "",
  internalTribalStatus: "tribal_government_land", federalAdminStatus: "none",
  jurisdictionalStatus: "exclusive_tribal", beneficiaryStewType: "", protectionRestrictionStatus: "",
  tribalCodeRef: "", tribalCourtOrderNum: "", protectedStatusBasis: "", restrictionBasis: "",
  enforcementAuthority: "", federalLawCrossRef: "", stewardshipPurpose: "",
  culturalSignificance: "", historicalOccupancy: "",
};

function ParcelModal({ parcel, onClose, onSaved }: { parcel?: Parcel; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(parcel ? {
    tractNumber: parcel.tract_number ?? "", parcelId: parcel.parcel_id ?? "",
    legalDescription: parcel.legal_description ?? "", acreage: parcel.acreage ?? "",
    classification: parcel.classification ?? "", status: parcel.status ?? "active",
    county: parcel.county ?? "", state: parcel.state ?? "TX",
    plssDescription: parcel.plss_description ?? "", ownerType: parcel.owner_type ?? "tribal",
    acquiredDate: parcel.acquired_date ?? "", acquisitionSource: parcel.acquisition_source ?? "",
    biaTractNumber: parcel.bia_tract_number ?? "", lat: parcel.lat ?? "", lng: parcel.lng ?? "",
    notes: parcel.notes ?? "",
    internalTribalStatus: parcel.internal_tribal_status ?? "tribal_government_land",
    federalAdminStatus: parcel.federal_admin_status ?? "none",
    jurisdictionalStatus: parcel.jurisdictional_status ?? "exclusive_tribal",
    beneficiaryStewType: parcel.beneficiary_stewardship_type ?? "",
    protectionRestrictionStatus: parcel.protection_restriction_status ?? "",
    tribalCodeRef: parcel.tribal_code_ref ?? "", tribalCourtOrderNum: parcel.tribal_court_order_num ?? "",
    protectedStatusBasis: parcel.protected_status_basis ?? "", restrictionBasis: parcel.restriction_basis ?? "",
    enforcementAuthority: parcel.enforcement_authority ?? "", federalLawCrossRef: parcel.federal_law_cross_ref ?? "",
    stewardshipPurpose: parcel.stewardship_purpose ?? "",
    culturalSignificance: parcel.cultural_significance ?? "", historicalOccupancy: parcel.historical_occupancy ?? "",
  } : { ...EMPTY_PARCEL });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaveErr(null);
    setSaving(true);
    try {
      const url = parcel ? `/api/land/parcels/${parcel.id}` : "/api/land/parcels";
      const res = await authFetch(url, { method: parcel ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Unknown error saving parcel.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title={parcel ? "Edit Parcel" : "Register Land Parcel"} subtitle="Mathias El Tribe — Sovereign Land Registry" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <SectionDivider icon={Landmark} label="Parcel Identification" />
        <Field label="Tract Number"><Input value={form.tractNumber} onChange={set("tractNumber")} placeholder="e.g. MET-2024-001" /></Field>
        <Field label="Parcel ID"><Input value={form.parcelId} onChange={set("parcelId")} placeholder="County/internal identifier" /></Field>
        <Field label="Status">
          <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={PARCEL_STATUSES.map(s => ({ value: s, label: s }))} />
        </Field>
        <Field label="Acreage"><Input type="number" step="0.0001" value={form.acreage} onChange={set("acreage")} placeholder="0.0000" /></Field>
        <div className="col-span-2">
          <Field label="Legal Description"><Textarea value={form.legalDescription} onChange={set("legalDescription")} placeholder="Full legal description" className="resize-none h-16" /></Field>
        </div>
        <Field label="PLSS Description"><Input value={form.plssDescription} onChange={set("plssDescription")} placeholder="e.g. T2N R3E S14 NW¼" /></Field>
        <Field label="BIA Tract Number"><Input value={form.biaTractNumber} onChange={set("biaTractNumber")} placeholder="BIA tract (if applicable)" /></Field>
        <Field label="County"><Input value={form.county} onChange={set("county")} placeholder="County name" /></Field>
        <Field label="State"><Input value={form.state} onChange={set("state")} placeholder="TX" /></Field>
        <Field label="Latitude"><Input value={form.lat} onChange={set("lat")} placeholder="30.2672" /></Field>
        <Field label="Longitude"><Input value={form.lng} onChange={set("lng")} placeholder="-97.7431" /></Field>

        {/* ── METC Title 4 Tribal Code Authority ── */}
        <SectionDivider icon={Scale} label="METC Title 4 — Tribal Code Authority" />

        <Field label="Internal Tribal Status" htmlFor="p-internal-status">
          <Sel id="p-internal-status" value={form.internalTribalStatus} onChange={v => setForm(f => ({ ...f, internalTribalStatus: v }))}
            options={INTERNAL_TRIBAL_STATUSES} placeholder="Select status" />
        </Field>
        <Field label="Jurisdictional Status" htmlFor="p-juris-status">
          <Sel id="p-juris-status" value={form.jurisdictionalStatus} onChange={v => setForm(f => ({ ...f, jurisdictionalStatus: v }))}
            options={JURISDICTIONAL_STATUSES} placeholder="Select jurisdiction" />
        </Field>
        <Field label="Federal Administrative Status" htmlFor="p-fed-admin">
          <Sel id="p-fed-admin" value={form.federalAdminStatus} onChange={v => setForm(f => ({ ...f, federalAdminStatus: v }))}
            options={FEDERAL_ADMIN_STATUSES} />
        </Field>
        <Field label="Beneficiary / Stewardship Type" htmlFor="p-ben-type">
          <Sel id="p-ben-type" value={form.beneficiaryStewType} onChange={v => setForm(f => ({ ...f, beneficiaryStewType: v }))}
            options={BENEFICIARY_TYPES} placeholder="Select type" />
        </Field>
        <Field label="Protection / Restriction Status" htmlFor="p-protect-status">
          <Sel id="p-protect-status" value={form.protectionRestrictionStatus} onChange={v => setForm(f => ({ ...f, protectionRestrictionStatus: v }))}
            options={PROTECTION_STATUSES} placeholder="Select status" />
        </Field>
        <Field label="Stewardship Purpose" htmlFor="p-stew-purpose">
          <Sel id="p-stew-purpose" value={form.stewardshipPurpose} onChange={v => setForm(f => ({ ...f, stewardshipPurpose: v }))}
            options={BENEFICIARY_TYPES} placeholder="Select purpose" />
        </Field>
        <Field label="METC Title 4 Section Reference" htmlFor="p-metc-ref">
          <Sel id="p-metc-ref" value={form.tribalCodeRef} onChange={v => setForm(f => ({ ...f, tribalCodeRef: v }))}
            options={METC_TITLE4_SECTIONS} placeholder="Select code section" />
        </Field>
        <Field label="Federal Law Cross-Reference" htmlFor="p-fed-law">
          <Sel id="p-fed-law" value={form.federalLawCrossRef} onChange={v => setForm(f => ({ ...f, federalLawCrossRef: v }))}
            options={FEDERAL_LAW_REFS} placeholder="Select (if applicable)" />
        </Field>
        <div className="col-span-2">
          <Field label="Tribal Court Order Number"><Input value={form.tribalCourtOrderNum} onChange={set("tribalCourtOrderNum")} placeholder="e.g. MET-SC-2024-015" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Protected Status Basis"><Textarea value={form.protectedStatusBasis} onChange={set("protectedStatusBasis")} placeholder="Basis for protected status under tribal law, treaty, or federal law…" className="resize-none h-16" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Restriction Basis"><Textarea value={form.restrictionBasis} onChange={set("restrictionBasis")} placeholder="Basis for any restriction on alienation or use…" className="resize-none h-14" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Enforcement Authority"><Input value={form.enforcementAuthority} onChange={set("enforcementAuthority")} placeholder="e.g. Mathias El Tribe Supreme Court / Chief Justice & Trustee" /></Field>
        </div>

        {/* ── Historical & Cultural Context ── */}
        <SectionDivider icon={BookOpen} label="Historical & Cultural Context" />
        <div className="col-span-2">
          <Field label="Cultural Significance"><Textarea value={form.culturalSignificance} onChange={set("culturalSignificance")} placeholder="Cultural, ceremonial, or spiritual significance of this land…" className="resize-none h-16" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Historical Occupancy / Traditional Stewardship"><Textarea value={form.historicalOccupancy} onChange={set("historicalOccupancy")} placeholder="Treaties, ancestral territories, historical occupancy record, removals, traditional stewardship history…" className="resize-none h-14" /></Field>
        </div>

        {/* ── Acquisition & Notes ── */}
        <SectionDivider icon={FileText} label="Acquisition & Notes" />
        <Field label="Owner Type">
          <Sel value={form.ownerType} onChange={v => setForm(f => ({ ...f, ownerType: v }))}
            options={[{ value: "tribal", label: "Tribal" }, { value: "individual", label: "Individual Member" }, { value: "fractional", label: "Fractional" }]} />
        </Field>
        <Field label="Date Acquired"><Input type="date" value={form.acquiredDate} onChange={set("acquiredDate")} /></Field>
        <div className="col-span-2">
          <Field label="Acquisition Source / Method"><Input value={form.acquisitionSource} onChange={set("acquisitionSource")} placeholder="e.g. Treaty restoration, purchase, donation…" /></Field>
        </div>
        <div className="col-span-2">
          <Field label="Internal Notes"><Textarea value={form.notes} onChange={set("notes")} placeholder="Internal notes" className="resize-none h-14" /></Field>
        </div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
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

function LeaseModal({ lease, parcels, onClose, onSaved }: { lease?: Lease; parcels: Parcel[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(lease ? {
    parcelId: String(lease.parcel_id ?? ""), leaseType: lease.lease_type ?? "agricultural",
    lesseeName: lease.lessee_name ?? "", startDate: lease.start_date?.split("T")[0] ?? "",
    endDate: lease.end_date?.split("T")[0] ?? "", annualRent: lease.annual_rent ?? "",
    paymentFrequency: lease.payment_frequency ?? "annual", status: lease.status ?? "active",
    biaLeaseNumber: lease.bia_lease_number ?? "", description: lease.description ?? "",
  } : { ...EMPTY_LEASE });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaveErr(null);
    setSaving(true);
    try {
      const res = await authFetch(lease ? `/api/land/leases/${lease.id}` : "/api/land/leases", { method: lease ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Unknown error saving lease.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title={lease ? "Edit Lease" : "Record Tribal Land Lease"} onClose={onClose}>
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
        <div className="col-span-2"><Field label="Lessee Name"><Input value={form.lesseeName} onChange={set("lesseeName")} placeholder="Lessee / tenant name" /></Field></div>
        <Field label="Start Date"><Input type="date" value={form.startDate} onChange={set("startDate")} /></Field>
        <Field label="End Date"><Input type="date" value={form.endDate} onChange={set("endDate")} /></Field>
        <Field label="Annual Rent ($)"><Input type="number" step="0.01" value={form.annualRent} onChange={set("annualRent")} placeholder="0.00" /></Field>
        <Field label="Payment Frequency">
          <Sel value={form.paymentFrequency} onChange={v => setForm(f => ({ ...f, paymentFrequency: v }))}
            options={[{ value: "annual", label: "Annual" }, { value: "semi-annual", label: "Semi-Annual" }, { value: "quarterly", label: "Quarterly" }, { value: "monthly", label: "Monthly" }]} />
        </Field>
        <div className="col-span-2"><Field label="BIA Lease Number (if applicable)"><Input value={form.biaLeaseNumber} onChange={set("biaLeaseNumber")} placeholder="BIA assigned lease number" /></Field></div>
        <div className="col-span-2"><Field label="Description / Terms"><Textarea value={form.description} onChange={set("description")} placeholder="Lease terms, conditions, permitted use, tribal restrictions…" className="resize-none h-20" /></Field></div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
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

const EMPTY_ASSET = { parcelId: "", assetType: "building", name: "", description: "", estimatedValue: "", conditionRating: "good", yearBuilt: "", notes: "" };

function AssetModal({ asset, parcels, onClose, onSaved }: { asset?: Asset; parcels: Parcel[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(asset ? {
    parcelId: String(asset.parcel_id ?? ""), assetType: asset.asset_type ?? "building",
    name: asset.name ?? "", description: asset.description ?? "",
    estimatedValue: asset.estimated_value ?? "", conditionRating: asset.condition_rating ?? "good",
    yearBuilt: String(asset.year_built ?? ""), notes: asset.notes ?? "",
  } : { ...EMPTY_ASSET });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaveErr(null);
    setSaving(true);
    try {
      const res = await authFetch(asset ? `/api/land/assets/${asset.id}` : "/api/land/assets", { method: asset ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Unknown error saving asset.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title={asset ? "Edit Asset" : "Record Asset / Resource"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Parcel">
            <Sel value={form.parcelId} onChange={v => setForm(f => ({ ...f, parcelId: v }))}
              options={parcels.map(p => ({ value: String(p.id), label: `${p.tract_number || p.parcel_id || `#${p.id}`} — ${p.legal_description?.slice(0, 50) ?? ""}` }))}
              placeholder="Select parcel" />
          </Field>
        </div>
        <Field label="Asset Type">
          <Sel value={form.assetType} onChange={v => setForm(f => ({ ...f, assetType: v }))} options={ASSET_TYPES.map(t => ({ value: t.value, label: t.label }))} />
        </Field>
        <Field label="Condition">
          <Sel value={form.conditionRating} onChange={v => setForm(f => ({ ...f, conditionRating: v }))}
            options={["excellent", "good", "fair", "poor"].map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
        </Field>
        <div className="col-span-2"><Field label="Name / Title"><Input value={form.name} onChange={set("name")} placeholder="e.g. Administration Building" /></Field></div>
        <Field label="Estimated Value ($)"><Input type="number" step="0.01" value={form.estimatedValue} onChange={set("estimatedValue")} placeholder="0.00" /></Field>
        <Field label="Year Built"><Input type="number" value={form.yearBuilt} onChange={set("yearBuilt")} placeholder="e.g. 1998" /></Field>
        <div className="col-span-2"><Field label="Description"><Textarea value={form.description} onChange={set("description")} placeholder="Physical description, deed restrictions, permitted uses…" className="resize-none h-16" /></Field></div>
        <div className="col-span-2"><Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} className="resize-none h-12" /></Field></div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
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

// ── Encumbrance Modal ─────────────────────────────────────────────────────────

const EMPTY_ENC = {
  parcelId: "", encumbranceType: "lien", title: "", description: "", source: "",
  dateIdentified: "", status: "active", federalLawImplicated: "", tribalCodeRef: "",
  voidAbInitio: false, resolutionNotes: "",
};

function EncumbranceModal({ enc, parcels, onClose, onSaved }: { enc?: Encumbrance; parcels: Parcel[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(enc ? {
    parcelId: String(enc.parcel_id ?? ""), encumbranceType: enc.encumbrance_type ?? "lien",
    title: enc.title ?? "", description: enc.description ?? "", source: enc.source ?? "",
    dateIdentified: enc.date_identified ?? "", status: enc.status ?? "active",
    federalLawImplicated: enc.federal_law_implicated ?? "",
    tribalCodeRef: enc.tribal_code_ref ?? "",
    voidAbInitio: enc.void_ab_initio ?? false, resolutionNotes: enc.resolution_notes ?? "",
  } : { ...EMPTY_ENC });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaveErr(null);
    setSaving(true);
    try {
      const res = await authFetch(enc ? `/api/land/encumbrances/${enc.id}` : "/api/land/encumbrances", { method: enc ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Unknown error saving encumbrance.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title={enc ? "Edit Encumbrance" : "Record Encumbrance / Interference"} subtitle="Document threats to sovereign land authority" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Parcel">
            <Sel value={form.parcelId} onChange={v => setForm(f => ({ ...f, parcelId: v }))}
              options={parcels.map(p => ({ value: String(p.id), label: `${p.tract_number || p.parcel_id || `#${p.id}`} — ${p.legal_description?.slice(0, 50) ?? ""}` }))}
              placeholder="Select parcel" />
          </Field>
        </div>
        <Field label="Encumbrance Type">
          <Sel value={form.encumbranceType} onChange={v => setForm(f => ({ ...f, encumbranceType: v }))}
            options={ENCUMBRANCE_TYPES} />
        </Field>
        <Field label="Status">
          <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={[{ value: "active", label: "Active" }, { value: "contested", label: "Contested" }, { value: "void_ab_initio", label: "Declared Void Ab Initio" }, { value: "resolved", label: "Resolved" }]} />
        </Field>
        <div className="col-span-2"><Field label="Title / Identifier"><Input value={form.title} onChange={set("title")} placeholder="Brief title for this encumbrance or interference" /></Field></div>
        <div className="col-span-2"><Field label="Source / Actor"><Input value={form.source} onChange={set("source")} placeholder="Who or what entity created this encumbrance" /></Field></div>
        <Field label="Date Identified"><Input type="date" value={form.dateIdentified} onChange={set("dateIdentified")} /></Field>
        <Field label="Federal Law Implicated">
          <Sel value={form.federalLawImplicated} onChange={v => setForm(f => ({ ...f, federalLawImplicated: v }))}
            options={FEDERAL_LAW_REFS} placeholder="Select (if applicable)" />
        </Field>
        <Field label="METC Title 4 Authority">
          <Sel value={form.tribalCodeRef} onChange={v => setForm(f => ({ ...f, tribalCodeRef: v }))}
            options={METC_TITLE4_SECTIONS} placeholder="Select code section" />
        </Field>
        <div className="col-span-2 flex items-center gap-3 py-1">
          <input type="checkbox" id="voidAbInitio" checked={form.voidAbInitio}
            onChange={e => setForm(f => ({ ...f, voidAbInitio: e.target.checked }))}
            className="w-4 h-4 accent-amber-500" />
          <label htmlFor="voidAbInitio" className="text-sm font-medium text-amber-300">
            Declare Void Ab Initio — Unauthorized interference with no legal effect under METC Title 4
          </label>
        </div>
        <div className="col-span-2"><Field label="Description"><Textarea value={form.description} onChange={set("description")} placeholder="Describe the encumbrance, interference, or obstruction in detail…" className="resize-none h-20" /></Field></div>
        <div className="col-span-2"><Field label="Resolution Notes / Tribal Response"><Textarea value={form.resolutionNotes} onChange={set("resolutionNotes")} placeholder="Tribal response, enforcement actions taken, resolution steps…" className="resize-none h-16" /></Field></div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className={`${form.voidAbInitio ? "bg-red-700 hover:bg-red-800" : "bg-amber-600 hover:bg-amber-700"} text-white`}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {enc ? "Save Changes" : form.voidAbInitio ? "Record & Declare Void Ab Initio" : "Record Encumbrance"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Notice Modal ──────────────────────────────────────────────────────────────

const NOTICE_TEMPLATES: Record<string, string> = {
  federal_review: `To Whom It May Concern:\n\nPursuant to the sovereign authority of the Mathias El Tribe and METC Title 4, this notice is hereby issued to inform you that the following land is subject to federal Indian law review under 25 U.S.C. §177 and applicable tribal law.\n\nNo action affecting this land shall be taken without explicit tribal and informed consent.\n\nIssued by authority of the Chief Justice & Trustee\nMathias El Tribe Supreme Court`,
  jurisdictional_review: `JURISDICTIONAL REVIEW NOTICE\n\nPursuant to METC Title 4, §9 (Jurisdictional Review Triggers), you are hereby notified that the Mathias El Tribe asserts exclusive tribal jurisdiction over the referenced land.\n\nAny conflicting jurisdictional claims are subject to review by the Mathias El Tribe Supreme Court pursuant to METC Title 4, §10.\n\nThis notice is issued as a matter of sovereign record.`,
  anti_alienation: `ANTI-ALIENATION ENFORCEMENT NOTICE\n\nPursuant to METC Title 4, §4 (Inherent Anti-Alienation Right), you are hereby notified that this land is subject to the tribe's inherent and non-waivable right against alienation.\n\nAny attempt to alienate, encumber, sell, tax, or otherwise interfere with this land without explicit tribal sovereign consent is without legal force or effect.\n\nViolations are subject to enforcement under METC Title 4, §6.`,
  void_ab_initio: `VOID AB INITIO DECLARATION\n\nPursuant to METC Title 4, §5 (Void Ab Initio — Unauthorized Interference), the Mathias El Tribe hereby declares that the following action(s) affecting tribal land are void ab initio — of no legal effect from their inception.\n\nThis declaration is issued under the sovereign authority of the Mathias El Tribe and shall be recorded in the sovereign land registry.`,
};

const EMPTY_NOTICE = {
  parcelId: "", noticeType: "federal_review", title: "", content: "",
  issuedDate: new Date().toISOString().split("T")[0], effectiveDate: "",
  servedTo: "", serviceMethod: "certified", status: "draft",
  tribalCodeRef: "", federalLawRef: "", courtOrderRef: "", enforcementAction: "",
};

function NoticeModal({ notice, parcels, onClose, onSaved }: { notice?: Notice; parcels: Parcel[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(notice ? {
    parcelId: String(notice.parcel_id ?? ""), noticeType: notice.notice_type ?? "federal_review",
    title: notice.title ?? "", content: notice.content ?? "",
    issuedDate: notice.issued_date ?? new Date().toISOString().split("T")[0],
    effectiveDate: notice.effective_date ?? "", servedTo: notice.served_to ?? "",
    serviceMethod: notice.service_method ?? "certified", status: notice.status ?? "draft",
    tribalCodeRef: notice.tribal_code_ref ?? "", federalLawRef: notice.federal_law_ref ?? "",
    courtOrderRef: notice.court_order_ref ?? "", enforcementAction: notice.enforcement_action ?? "",
  } : { ...EMPTY_NOTICE });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  function loadTemplate() {
    const tmpl = NOTICE_TEMPLATES[form.noticeType];
    if (tmpl) setForm(f => ({ ...f, content: tmpl }));
  }

  async function save() {
    setSaveErr(null);
    setSaving(true);
    try {
      const res = await authFetch(notice ? `/api/land/notices/${notice.id}` : "/api/land/notices", { method: notice ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Unknown error saving notice.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title={notice ? "Edit Notice" : "Generate Sovereign Notice"} subtitle="METC Title 4 — Notice & Service Protocols" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Parcel">
            <Sel value={form.parcelId} onChange={v => setForm(f => ({ ...f, parcelId: v }))}
              options={parcels.map(p => ({ value: String(p.id), label: `${p.tract_number || p.parcel_id || `#${p.id}`} — ${p.legal_description?.slice(0, 50) ?? ""}` }))}
              placeholder="Select parcel (optional — leave blank for general notice)" />
          </Field>
        </div>
        <Field label="Notice Type">
          <Sel value={form.noticeType} onChange={v => setForm(f => ({ ...f, noticeType: v }))}
            options={NOTICE_TYPES} />
        </Field>
        <Field label="Status">
          <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={[{ value: "draft", label: "Draft" }, { value: "issued", label: "Issued" }, { value: "served", label: "Served" }, { value: "acknowledged", label: "Acknowledged" }, { value: "unacknowledged", label: "Unacknowledged" }]} />
        </Field>
        <div className="col-span-2"><Field label="Title / Subject"><Input value={form.title} onChange={set("title")} placeholder="Brief subject of this notice" /></Field></div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">Notice Content</label>
            {NOTICE_TEMPLATES[form.noticeType] && (
              <button onClick={loadTemplate} className="text-xs text-amber-400 hover:text-amber-300 underline">Load template</button>
            )}
          </div>
          <Textarea value={form.content} onChange={set("content")} placeholder="Full text of the notice…" className="resize-none h-36" />
        </div>
        <Field label="METC Title 4 Authority">
          <Sel value={form.tribalCodeRef} onChange={v => setForm(f => ({ ...f, tribalCodeRef: v }))}
            options={METC_TITLE4_SECTIONS} placeholder="Select code section" />
        </Field>
        <Field label="Federal Law Reference">
          <Sel value={form.federalLawRef} onChange={v => setForm(f => ({ ...f, federalLawRef: v }))}
            options={FEDERAL_LAW_REFS} placeholder="Select (if applicable)" />
        </Field>
        <div className="col-span-2"><Field label="Tribal Court Order Reference"><Input value={form.courtOrderRef} onChange={set("courtOrderRef")} placeholder="e.g. MET-SC-2024-015" /></Field></div>
        <div className="col-span-2"><Field label="Served To / Recipient(s)"><Input value={form.servedTo} onChange={set("servedTo")} placeholder="Name(s) / entity / county recorder / federal agency" /></Field></div>
        <Field label="Service Method">
          <Sel value={form.serviceMethod} onChange={v => setForm(f => ({ ...f, serviceMethod: v }))}
            options={[{ value: "certified", label: "Certified Mail" }, { value: "personal", label: "Personal Service" }, { value: "electronic", label: "Electronic" }, { value: "posted", label: "Posted / Published" }, { value: "mail", label: "Regular Mail" }]} />
        </Field>
        <Field label="Issued Date"><Input type="date" value={form.issuedDate} onChange={set("issuedDate")} /></Field>
        <Field label="Effective Date"><Input type="date" value={form.effectiveDate} onChange={set("effectiveDate")} /></Field>
        <div className="col-span-2"><Field label="Enforcement Action / Response"><Textarea value={form.enforcementAction} onChange={set("enforcementAction")} placeholder="Any enforcement action taken or planned…" className="resize-none h-14" /></Field></div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {notice ? "Save Changes" : "Issue Notice"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Stewardship Modal ─────────────────────────────────────────────────────────

const EMPTY_STEW = {
  name: "", description: "", acreage: "", county: "", state: "TX", estimatedCost: "",
  acquisitionType: "tribal_governmental_administration", stage: "identified",
  biaCaseNumber: "", priority: "medium", targetDate: "", notes: "",
  stewardshipPurpose: "", culturalNotes: "", tribalCodeRef: "", jurisdictionalStatus: "exclusive_tribal",
};

function StewardshipModal({ entry, onClose, onSaved }: { entry?: StewardshipEntry; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(entry ? {
    name: entry.name ?? "", description: entry.description ?? "", acreage: entry.acreage ?? "",
    county: entry.county ?? "", state: entry.state ?? "TX", estimatedCost: entry.estimated_cost ?? "",
    acquisitionType: entry.acquisition_type ?? "tribal_governmental_administration",
    stage: entry.stage ?? "identified", biaCaseNumber: entry.bia_case_number ?? "",
    priority: entry.priority ?? "medium", targetDate: entry.target_date ?? "", notes: entry.notes ?? "",
    stewardshipPurpose: entry.stewardship_purpose ?? "", culturalNotes: entry.cultural_notes ?? "",
    tribalCodeRef: entry.tribal_code_ref ?? "", jurisdictionalStatus: entry.jurisdictional_status ?? "exclusive_tribal",
  } : { ...EMPTY_STEW });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const [saveErr, setSaveErr] = useState<string | null>(null);

  async function save() {
    if (!form.name.trim()) return;
    setSaveErr(null);
    setSaving(true);
    try {
      const res = await authFetch(entry ? `/api/land/pipeline/${entry.id}` : "/api/land/pipeline", { method: entry ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Unknown error saving pipeline entry.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title={entry ? "Edit Stewardship Entry" : "Add to Stewardship Pipeline"} subtitle="Land Status & Stewardship — METC Title 4" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Name / Identifier *"><Input value={form.name} onChange={set("name")} placeholder="e.g. East Meadow Traditional Territory" /></Field></div>
        <Field label="Stewardship / Acquisition Type">
          <Sel value={form.acquisitionType} onChange={v => setForm(f => ({ ...f, acquisitionType: v }))} options={STEWARDSHIP_TYPES} />
        </Field>
        <Field label="Current Stage">
          <Sel value={form.stage} onChange={v => setForm(f => ({ ...f, stage: v }))} options={STEWARDSHIP_STAGES.map(s => ({ value: s.value, label: s.label }))} />
        </Field>
        <Field label="Stewardship Purpose">
          <Sel value={form.stewardshipPurpose} onChange={v => setForm(f => ({ ...f, stewardshipPurpose: v }))} options={BENEFICIARY_TYPES} placeholder="Select purpose" />
        </Field>
        <Field label="Jurisdictional Status">
          <Sel value={form.jurisdictionalStatus} onChange={v => setForm(f => ({ ...f, jurisdictionalStatus: v }))} options={JURISDICTIONAL_STATUSES} />
        </Field>
        <Field label="METC Title 4 Authority">
          <Sel value={form.tribalCodeRef} onChange={v => setForm(f => ({ ...f, tribalCodeRef: v }))} options={METC_TITLE4_SECTIONS} placeholder="Select section" />
        </Field>
        <Field label="Priority">
          <Sel value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
            options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
        </Field>
        <Field label="Acreage"><Input type="number" step="0.0001" value={form.acreage} onChange={set("acreage")} placeholder="0.0000" /></Field>
        <Field label="Estimated Cost ($)"><Input type="number" step="0.01" value={form.estimatedCost} onChange={set("estimatedCost")} placeholder="0.00" /></Field>
        <Field label="County"><Input value={form.county} onChange={set("county")} placeholder="County name" /></Field>
        <Field label="State"><Input value={form.state} onChange={set("state")} placeholder="TX" /></Field>
        <Field label="Target Completion"><Input type="date" value={form.targetDate} onChange={set("targetDate")} /></Field>
        <div className="col-span-2"><Field label="BIA / Federal Case Number (if applicable)"><Input value={form.biaCaseNumber} onChange={set("biaCaseNumber")} /></Field></div>
        <div className="col-span-2"><Field label="Description / Sovereign Interest"><Textarea value={form.description} onChange={set("description")} placeholder="Background, sovereign purpose, cultural significance, community need…" className="resize-none h-20" /></Field></div>
        <div className="col-span-2"><Field label="Cultural Notes"><Textarea value={form.culturalNotes} onChange={set("culturalNotes")} placeholder="Ancestral connection, traditional territory notes, ceremonial significance…" className="resize-none h-16" /></Field></div>
        <div className="col-span-2"><Field label="Internal Notes"><Textarea value={form.notes} onChange={set("notes")} className="resize-none h-12" /></Field></div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
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
    { label: "Tribal Government", ac: stats.govAcreage, color: "bg-amber-600" },
    { label: "Trust Stewardship", ac: stats.trustAcreage, color: "bg-emerald-600" },
    { label: "Protected Tribal", ac: stats.protectedAcreage, color: "bg-blue-600" },
    { label: "Beneficiary", ac: stats.beneficiaryAcreage, color: "bg-teal-600" },
    { label: "Sacred / Cultural", ac: stats.sacredAcreage, color: "bg-rose-700" },
    { label: "Restricted", ac: stats.restrictedAcreage, color: "bg-violet-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Landmark} label="Total Parcels" value={String(stats.totalParcels)} sub={`${stats.activeParcels} active`} />
        <StatCard icon={MapPin} label="Total Acreage" value={fmtAcres(stats.totalAcreage)} sub={`${fmtAcres(stats.trustAcreage)} in trust`} accent="text-emerald-400" />
        <StatCard icon={ShieldCheck} label="Exclusive Jurisdiction" value={String(stats.exclusiveJurisdiction)} sub={`${stats.contestedParcels} contested`} accent="text-amber-400" />
        <StatCard icon={DollarSign} label="Est. Annual Revenue" value={fmtDollar(stats.annualRevenue)} sub={`${stats.activeLeases} active leases`} accent="text-emerald-400" />
        <StatCard icon={ShieldAlert} label="Active Encumbrances" value={String(stats.activeEncumbrances)} sub={stats.voidAbInitioCount > 0 ? `${stats.voidAbInitioCount} void ab initio` : "None declared void"} accent={stats.activeEncumbrances > 0 ? "text-red-400" : undefined} />
        <StatCard icon={ScrollText} label="Active Notices" value={String(stats.activeNotices)} sub="Issued / in service" accent={stats.activeNotices > 0 ? "text-amber-400" : undefined} />
        <StatCard icon={TrendingUp} label="Stewardship Pipeline" value={String(stats.activePipeline)} sub={fmtAcres(stats.pipelineAcreage) + " targeted"} accent="text-blue-400" />
        <StatCard icon={AlertTriangle} label="Disputed Parcels" value={String(stats.disputedParcels)} sub="Requiring attention" accent={stats.disputedParcels > 0 ? "text-red-400" : undefined} />
      </div>

      <div className="bg-background/60 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">Tribal Land Status Breakdown</h3>
          <span className="text-xs text-muted-foreground ml-1">— METC Title 4 Authority</span>
        </div>
        <div className="space-y-3">
          {breakdown.map(b => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-32 shrink-0">{b.label}</span>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${Math.min(100, (b.ac / totalAc) * 100)}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground w-24 text-right shrink-0">{fmtAcres(b.ac)}</span>
            </div>
          ))}
        </div>
      </div>

      {stats.voidAbInitioCount > 0 && (
        <div className="bg-red-950/30 border border-red-700/40 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-red-400" />
            <p className="text-sm font-semibold text-red-400">{stats.voidAbInitioCount} Void Ab Initio Declaration{stats.voidAbInitioCount !== 1 ? "s" : ""} on Record</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">Unauthorized interference declared of no legal force or effect — METC Title 4, §5</p>
        </div>
      )}

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
                    <span className="text-foreground font-medium">{l.lessee_name || "Unknown"}</span>
                    <span className="text-muted-foreground ml-2 text-xs capitalize">{l.lease_type}</span>
                    {l.tract_number && <span className="text-muted-foreground ml-2 text-xs">· {l.tract_number}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{new Date(l.end_date).toLocaleDateString()}</span>
                    <span className={`text-xs font-semibold ${d <= 30 ? "text-red-400" : d <= 90 ? "text-amber-400" : "text-yellow-500"}`}>{d}d</span>
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

function ParcelsTab({ parcels, assignments, onRefresh, onSelectParcel }: { parcels: Parcel[]; assignments: MemberAssignment[]; onRefresh: () => void; onSelectParcel?: (p: Parcel) => void }) {
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Parcel | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterInternal, setFilterInternal] = useState("");
  const [filterJuris, setFilterJuris] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [investigationParcel, setInvestigationParcel] = useState<Parcel | null>(null);
  const isOfficer = useIsOfficer();
  const [, navigate] = useLocation();

  // Build a quick parcel-id → active steward lookup for inline display
  const stewardByParcel: Record<number, MemberAssignment | undefined> = {};
  for (const a of assignments) {
    if (!stewardByParcel[a.parcel_id] && a.status === "active") {
      stewardByParcel[a.parcel_id] = a;
    }
  }

  const filtered = parcels.filter(p =>
    (!filterStatus || p.status === filterStatus) &&
    (!filterInternal || p.internal_tribal_status === filterInternal) &&
    (!filterJuris || p.jurisdictional_status === filterJuris)
  );

  async function del(id: number) {
    if (!confirm("Permanently remove this parcel record?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/parcels/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterInternal} onChange={setFilterInternal}
          options={INTERNAL_TRIBAL_STATUSES} placeholder="All Tribal Statuses" />
        <Sel value={filterJuris} onChange={setFilterJuris}
          options={JURISDICTIONAL_STATUSES} placeholder="All Jurisdictions" />
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
              <th className="text-left px-4 py-2.5">Tract / Authority</th>
              <th className="text-left px-4 py-2.5">Legal Description</th>
              <th className="text-right px-4 py-2.5">Acreage</th>
              <th className="text-left px-4 py-2.5">Tribal Status</th>
              <th className="text-left px-4 py-2.5">Jurisdiction</th>
              <th className="text-left px-4 py-2.5">Location</th>
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
                  <button
                    onClick={() => onSelectParcel?.(p)}
                    className="font-medium text-amber-300 hover:text-amber-200 hover:underline underline-offset-2 transition-colors text-left"
                    title={`View parcel record: ${p.tract_number || p.parcel_id || "#" + p.id}`}
                  >
                    {p.tract_number || p.parcel_id || `#${p.id}` || "—"}
                  </button>
                  {p.tribal_code_ref && <div className="text-[10px] text-amber-500 mt-0.5">{p.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</div>}
                  {p.tribal_court_order_num && <div className="text-[10px] text-muted-foreground">Order: {p.tribal_court_order_num}</div>}
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="text-foreground truncate text-xs">{p.legal_description || "—"}</p>
                  {p.protection_restriction_status && (
                    <p className="text-[10px] text-violet-400 mt-0.5 truncate">
                      {PROTECTION_STATUSES.find(s => s.value === p.protection_restriction_status)?.label.split("(")[0].trim()}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground text-xs">{p.acreage ? Number(p.acreage).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td>
                <td className="px-4 py-3">
                  {p.internal_tribal_status ? (
                    <Badge
                      label={INTERNAL_TRIBAL_STATUSES.find(s => s.value === p.internal_tribal_status)?.label.split(" ").slice(0, 3).join(" ") ?? p.internal_tribal_status}
                      className={internalStatusColor(p.internal_tribal_status)}
                    />
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                  {p.federal_admin_status && p.federal_admin_status !== "none" && (
                    <div className="mt-0.5">
                      <Badge label={FEDERAL_ADMIN_STATUSES.find(s => s.value === p.federal_admin_status)?.label.split(" ").slice(0, 3).join(" ") ?? p.federal_admin_status} className="bg-slate-600 text-slate-100" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.jurisdictional_status ? (
                    <span className={`text-xs font-medium ${jurisdictionColor(p.jurisdictional_status)}`}>
                      {JURISDICTIONAL_STATUSES.find(s => s.value === p.jurisdictional_status)?.label.split(" ").slice(0, 2).join(" ")}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                  {p.status === "disputed" && <div className="text-[10px] text-red-400 mt-0.5">⚠ Disputed</div>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  <div>{[p.county, p.state].filter(Boolean).join(", ") || "—"}</div>
                  {stewardByParcel[p.id] && (() => {
                    const s = stewardByParcel[p.id]!;
                    return (
                      <button
                        onClick={() => navigate(`/search?q=${encodeURIComponent(s.member_name)}`)}
                        className="flex items-center gap-1 mt-1 text-amber-400/80 hover:text-amber-300 transition-colors text-left"
                        title={`Go to member profile: ${s.member_name}`}
                      >
                        <Users className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate max-w-[120px]">{s.member_name}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </button>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {isOfficer && (
                      <button
                        onClick={() => setInvestigationParcel(p)}
                        title="Open Investigation"
                        data-testid={`button-open-investigation-parcel-${p.id}`}
                        className="p-1 rounded hover:bg-amber-900/30 text-muted-foreground hover:text-amber-400"
                      >
                        <Gavel className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => { setEditing(p); setModal("edit"); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(p.id)} disabled={deleting === p.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
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
        <ParcelModal parcel={modal === "edit" ? editing ?? undefined : undefined} onClose={() => setModal(null)} onSaved={() => { setModal(null); onRefresh(); }} />
      )}

      {investigationParcel && (
        <OpenInvestigationModal
          onClose={() => setInvestigationParcel(null)}
          defaultSignalType="UNAUTHORIZED_LAND_ENCUMBRANCE"
          affectedParcelId={investigationParcel.id}
          affectedMatter={investigationParcel.tract_number || `Parcel #${investigationParcel.id}`}
          sourceLabel={`Parcel ${investigationParcel.tract_number || `#${investigationParcel.id}`}${investigationParcel.county ? ` — ${investigationParcel.county}, ${investigationParcel.state}` : ""}`}
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

  async function del(id: number) {
    if (!confirm("Remove this lease record?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/leases/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 text-xs">
          {(["all", "active", "expiring", "expired"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md capitalize transition-colors ${filter === f ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{f}</button>
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
              <th className="text-left px-4 py-2.5">Parcel</th>
              <th className="text-left px-4 py-2.5">Lessee</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Term</th>
              <th className="text-right px-4 py-2.5">Annual Rent</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No leases found.</td></tr>}
            {filtered.map(l => {
              const d = l.end_date ? daysUntil(l.end_date) : null;
              return (
                <tr key={l.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium text-sm">{l.tract_number || `Parcel #${l.parcel_id}`}</td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{l.lessee_name || "—"}</div>
                    {l.bia_lease_number && <div className="text-xs text-muted-foreground">BIA: {l.bia_lease_number}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground text-xs">{l.lease_type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {l.start_date ? new Date(l.start_date).toLocaleDateString("en-US", { year: "2-digit", month: "short", day: "numeric" }) : "—"}{" → "}
                    {l.end_date ? new Date(l.end_date).toLocaleDateString("en-US", { year: "2-digit", month: "short", day: "numeric" }) : "Open"}
                    {d !== null && d <= 90 && d > 0 && <span className="ml-1.5 text-amber-400 font-semibold">({d}d)</span>}
                    {d !== null && d <= 0 && <span className="ml-1.5 text-red-400 font-semibold">(expired)</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400 text-sm">{l.annual_rent ? `$${Number(l.annual_rent).toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-xs capitalize font-medium ${leaseStatusColor(l.status)}`}>{l.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(l); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(l.id)} disabled={deleting === l.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
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
      {modal && <LeaseModal lease={editing ?? undefined} parcels={parcels} onClose={() => { setModal(false); setEditing(null); }} onSaved={() => { setModal(false); setEditing(null); onRefresh(); }} />}
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
  const totalValue = filtered.reduce((a, x) => a + Number(x.estimated_value || 0), 0);
  const conditionColor = (c: string) => ({ excellent: "text-emerald-400", good: "text-green-400", fair: "text-amber-400", poor: "text-red-400" }[c] ?? "text-muted-foreground");

  async function del(id: number) {
    if (!confirm("Remove this asset record?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/assets/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  function AssetIcon({ type }: { type: string }) {
    const found = ASSET_TYPES.find(t => t.value === type);
    const Icon = found?.icon ?? Package;
    return <Icon className="w-4 h-4" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterType} onChange={setFilterType} options={ASSET_TYPES.map(t => ({ value: t.value, label: t.label }))} placeholder="All Asset Types" />
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
              <th className="text-right px-4 py-2.5">Yr</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No assets recorded.</td></tr>}
            {filtered.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400"><AssetIcon type={a.asset_type} /></span>
                    <div><div className="text-foreground font-medium">{a.name || "—"}</div>
                      {a.description && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{a.description}</div>}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{a.asset_type?.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{a.tract_number || `#${a.parcel_id}`}</td>
                <td className="px-4 py-3"><span className={`text-xs capitalize ${conditionColor(a.condition_rating)}`}>{a.condition_rating || "—"}</span></td>
                <td className="px-4 py-3 text-right font-mono text-foreground text-sm">{a.estimated_value ? `$${Number(a.estimated_value).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">{a.year_built || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(a); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(a.id)} disabled={deleting === a.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                      {deleting === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} asset{filtered.length !== 1 ? "s" : ""}{totalValue > 0 ? ` · $${totalValue.toLocaleString()} total estimated value` : ""}</p>
      {modal && <AssetModal asset={editing ?? undefined} parcels={parcels} onClose={() => { setModal(false); setEditing(null); }} onSaved={() => { setModal(false); setEditing(null); onRefresh(); }} />}
    </div>
  );
}

// ── Encumbrances Tab ──────────────────────────────────────────────────────────

function EncumbrancesTab({ encumbrances, parcels, onRefresh }: { encumbrances: Encumbrance[]; parcels: Parcel[]; onRefresh: () => void }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Encumbrance | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [investigationTarget, setInvestigationTarget] = useState<Encumbrance | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const isOfficer = useIsOfficer();

  const filtered = encumbrances.filter(e =>
    (!filterType || e.encumbrance_type === filterType) &&
    (!filterStatus || e.status === filterStatus)
  );

  const voidCount = filtered.filter(e => e.void_ab_initio).length;

  async function del(id: number) {
    if (!confirm("Remove this encumbrance record?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/encumbrances/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  const statusColor = (s: string) => ({
    active: "text-red-400", contested: "text-amber-400",
    void_ab_initio: "text-violet-400", resolved: "text-emerald-400",
  }[s] ?? "text-muted-foreground");

  return (
    <div className="space-y-4">
      {voidCount > 0 && (
        <div className="bg-red-950/30 border border-red-700/40 rounded-lg px-4 py-3 flex items-center gap-3">
          <Gavel className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 font-medium">{voidCount} encumbrance{voidCount !== 1 ? "s" : ""} declared <span className="font-bold">Void Ab Initio</span> — unauthorized, no legal force or effect — METC Title 4, §5</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterType} onChange={setFilterType} options={ENCUMBRANCE_TYPES} placeholder="All Types" />
        <Sel value={filterStatus} onChange={setFilterStatus}
          options={[{ value: "active", label: "Active" }, { value: "contested", label: "Contested" }, { value: "void_ab_initio", label: "Void Ab Initio" }, { value: "resolved", label: "Resolved" }]}
          placeholder="All Statuses" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-red-800 hover:bg-red-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Record Encumbrance
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-lg">
            No encumbrances or interference logged. Use this section to track liens, foreclosure attempts, tax assessments, administrative obstruction, and jurisdictional conflicts.
          </div>
        )}
        {filtered.map(e => (
          <div key={e.id} className={`rounded-lg border p-4 transition-colors ${e.void_ab_initio ? "border-red-700/50 bg-red-950/20" : "border-border bg-background/60 hover:border-amber-700/40"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {e.void_ab_initio && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-700 text-white uppercase tracking-wide">
                      <Gavel className="w-3 h-3" /> VOID AB INITIO
                    </span>
                  )}
                  <span className="font-semibold text-foreground">{e.title || "Untitled"}</span>
                  <Badge label={ENCUMBRANCE_TYPES.find(t => t.value === e.encumbrance_type)?.label ?? e.encumbrance_type} className="bg-muted text-muted-foreground" />
                  <span className={`text-xs font-medium capitalize ${statusColor(e.status)}`}>{e.status?.replace(/_/g, " ")}</span>
                </div>
                {e.tract_number && <p className="text-xs text-muted-foreground mt-1">Parcel: {e.tract_number}</p>}
                {e.description && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{e.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {e.source && <span>Source: {e.source}</span>}
                  {e.date_identified && <span>Identified: {new Date(e.date_identified).toLocaleDateString()}</span>}
                  {e.tribal_code_ref && <span className="text-amber-500">{e.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</span>}
                  {e.federal_law_implicated && <span className="text-blue-400">{FEDERAL_LAW_REFS.find(f => f.value === e.federal_law_implicated)?.label.split("—")[0].trim()}</span>}
                </div>
                {e.resolution_notes && (
                  <div className="mt-2 text-xs bg-muted/30 rounded px-2 py-1.5 text-muted-foreground">
                    <span className="text-foreground font-medium">Tribal response:</span> {e.resolution_notes}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isOfficer && (
                  <button
                    onClick={() => setInvestigationTarget(e)}
                    title="Open Investigation"
                    data-testid={`button-open-investigation-enc-${e.id}`}
                    className="p-1 rounded hover:bg-amber-900/30 text-muted-foreground hover:text-amber-400"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => { setEditing(e); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(e.id)} disabled={deleting === e.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                  {deleting === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && <EncumbranceModal enc={editing ?? undefined} parcels={parcels} onClose={() => { setModal(false); setEditing(null); }} onSaved={() => { setModal(false); setEditing(null); onRefresh(); }} />}

      {investigationTarget && (
        <OpenInvestigationModal
          onClose={() => setInvestigationTarget(null)}
          defaultSignalType="UNAUTHORIZED_LAND_ENCUMBRANCE"
          defaultTriggeringEntity={investigationTarget.source ?? ""}
          affectedParcelId={investigationTarget.parcel_id ?? undefined}
          affectedMatter={investigationTarget.title || investigationTarget.encumbrance_type}
          sourceLabel={`Encumbrance #${investigationTarget.id}${investigationTarget.title ? ` — ${investigationTarget.title}` : ""}`}
        />
      )}
    </div>
  );
}

// ── Notices Tab ───────────────────────────────────────────────────────────────

function NoticesTab({ notices, parcels, onRefresh }: { notices: Notice[]; parcels: Parcel[]; onRefresh: () => void }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = notices.filter(n =>
    (!filterType || n.notice_type === filterType) &&
    (!filterStatus || n.status === filterStatus)
  );

  async function del(id: number) {
    if (!confirm("Remove this notice?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/notices/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  const statusColor = (s: string) => ({
    draft: "text-muted-foreground", issued: "text-amber-400",
    served: "text-blue-400", acknowledged: "text-emerald-400", unacknowledged: "text-red-400",
  }[s] ?? "text-muted-foreground");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterType} onChange={setFilterType} options={NOTICE_TYPES} placeholder="All Notice Types" />
        <Sel value={filterStatus} onChange={setFilterStatus}
          options={[{ value: "draft", label: "Draft" }, { value: "issued", label: "Issued" }, { value: "served", label: "Served" }, { value: "acknowledged", label: "Acknowledged" }, { value: "unacknowledged", label: "Unacknowledged" }]}
          placeholder="All Statuses" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Generate Notice
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-lg">
            No notices on record. Generate a Notice of Federal Review, Jurisdictional Review Notice, Anti-Alienation Enforcement Notice, or other sovereign notice.
          </div>
        )}
        {filtered.map(n => (
          <div key={n.id} className="bg-background/60 border border-border rounded-lg p-4 hover:border-amber-700/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <ScrollText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-foreground">{n.title || NOTICE_TYPES.find(t => t.value === n.notice_type)?.label}</span>
                  <Badge label={NOTICE_TYPES.find(t => t.value === n.notice_type)?.label.split(" ").slice(0, 3).join(" ") ?? n.notice_type} className="bg-amber-900/40 text-amber-200" />
                  <span className={`text-xs font-medium capitalize ${statusColor(n.status)}`}>{n.status}</span>
                </div>
                {n.tract_number && <p className="text-xs text-muted-foreground mt-1">Parcel: {n.tract_number}</p>}
                {n.content && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 font-mono leading-relaxed">{n.content.substring(0, 200)}…</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {n.served_to && <span>To: {n.served_to}</span>}
                  {n.service_method && <span>Via: {n.service_method.replace(/_/g, " ")}</span>}
                  {n.issued_date && <span>Issued: {new Date(n.issued_date).toLocaleDateString()}</span>}
                  {n.effective_date && <span>Effective: {new Date(n.effective_date).toLocaleDateString()}</span>}
                  {n.tribal_code_ref && <span className="text-amber-500">{n.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</span>}
                  {n.federal_law_ref && <span className="text-blue-400">{FEDERAL_LAW_REFS.find(f => f.value === n.federal_law_ref)?.label.split("—")[0].trim()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditing(n); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(n.id)} disabled={deleting === n.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                  {deleting === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && <NoticeModal notice={editing ?? undefined} parcels={parcels} onClose={() => { setModal(false); setEditing(null); }} onSaved={() => { setModal(false); setEditing(null); onRefresh(); }} />}
    </div>
  );
}

// ── Stewardship Pipeline Tab ──────────────────────────────────────────────────

function StewardshipTab({ pipeline, onRefresh }: { pipeline: StewardshipEntry[]; onRefresh: () => void }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<StewardshipEntry | null>(null);
  const [filterStage, setFilterStage] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = pipeline.filter(e => !filterStage || e.stage === filterStage);

  async function del(id: number) {
    if (!confirm("Remove this stewardship entry?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/pipeline/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  async function advance(entry: StewardshipEntry) {
    const stages = STEWARDSHIP_STAGES.filter(s => s.value !== "cancelled").map(s => s.value);
    const idx = stages.indexOf(entry.stage);
    if (idx < 0 || idx >= stages.length - 1) return;
    await authFetch(`/api/land/pipeline/${entry.id}`, { method: "PUT", body: JSON.stringify({ ...entry, stage: stages[idx + 1] }) });
    onRefresh();
  }

  function stageInfo(s: string) { return STEWARDSHIP_STAGES.find(x => x.value === s) ?? STEWARDSHIP_STAGES[0]; }
  const priorityColor = (p: string) => ({ high: "text-red-400", medium: "text-amber-400", low: "text-slate-400" }[p] ?? "");

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2">
        Track all land under active stewardship consideration — including land already stewarded, protected, beneficiary-held, jurisdictionally disputed, or culturally protected, in addition to formal acquisition processes.
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterStage} onChange={setFilterStage} options={STEWARDSHIP_STAGES.map(s => ({ value: s.value, label: s.label }))} placeholder="All Stages" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Entry
          </Button>
        </div>
      </div>

      <div className="hidden md:flex gap-1 overflow-x-auto pb-1">
        {STEWARDSHIP_STAGES.filter(s => s.value !== "cancelled").map((s, i, arr) => (
          <div key={s.value} className="flex items-center gap-1 min-w-fit">
            <div className="text-center">
              <div className={`text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded ${s.color} text-white`}>{s.label}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{pipeline.filter(e => e.stage === s.value).length}</div>
            </div>
            {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-lg">
            No stewardship entries. Add land under stewardship consideration — including existing protected, stewarded, or culturally significant land.
          </div>
        )}
        {filtered.map(e => {
          const si = stageInfo(e.stage);
          const stages = STEWARDSHIP_STAGES.filter(s => s.value !== "cancelled").map(s => s.value);
          const isLast = stages.indexOf(e.stage) >= stages.length - 1;
          return (
            <div key={e.id} className="bg-background/60 border border-border rounded-lg p-4 hover:border-amber-700/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{e.name}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded text-white ${si.color}`}>{si.label}</span>
                    <span className={`text-xs font-medium capitalize ${priorityColor(e.priority)}`}>{e.priority} priority</span>
                    {e.jurisdictional_status && <span className={`text-xs ${jurisdictionColor(e.jurisdictional_status)}`}>{JURISDICTIONAL_STATUSES.find(s => s.value === e.jurisdictional_status)?.label.split(" ").slice(0, 2).join(" ")}</span>}
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>}
                  {e.cultural_notes && <p className="text-xs text-rose-300/70 mt-1 line-clamp-1 italic">{e.cultural_notes}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    {e.acreage && <span><MapPin className="w-3 h-3 inline mr-0.5" />{fmtAcres(Number(e.acreage))}</span>}
                    {e.county && <span>{[e.county, e.state].filter(Boolean).join(", ")}</span>}
                    {e.estimated_cost && <span><DollarSign className="w-3 h-3 inline mr-0.5" />Est. {fmtDollar(Number(e.estimated_cost))}</span>}
                    {e.tribal_code_ref && <span className="text-amber-500">{e.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</span>}
                    {e.target_date && <span>Target: {new Date(e.target_date).toLocaleDateString()}</span>}
                    <span className="capitalize">{STEWARDSHIP_TYPES.find(t => t.value === e.acquisition_type)?.label ?? e.acquisition_type?.replace(/_/g, " ")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isLast && e.stage !== "cancelled" && (
                    <button onClick={() => advance(e)} title="Advance stage" className="p-1.5 rounded hover:bg-amber-600/20 text-amber-500 hover:text-amber-400">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => { setEditing(e); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(e.id)} disabled={deleting === e.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                    {deleting === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {modal && <StewardshipModal entry={editing ?? undefined} onClose={() => { setModal(false); setEditing(null); }} onSaved={() => { setModal(false); setEditing(null); onRefresh(); }} />}
    </div>
  );
}

// ── Map Tab (Leaflet) ─────────────────────────────────────────────────────────

// ── Parcel Detail Drawer ───────────────────────────────────────────────────────
function ParcelDetailDrawer({
  parcel, assignments, leases, assets, encumbrances, deeds, parcels,
  onClose, onNavigateTab, navigate, onRefresh,
}: {
  parcel: Parcel;
  assignments: MemberAssignment[];
  leases: Lease[];
  assets: Asset[];
  encumbrances: Encumbrance[];
  deeds: Deed[];
  parcels: Parcel[];
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  navigate: (path: string) => void;
  onRefresh?: () => void;
}) {
  const [householdModal, setHouseholdModal] = useState(false);
  const [householdEditing, setHouseholdEditing] = useState<MemberAssignment | null>(null);
  const [householdDefaultRole, setHouseholdDefaultRole] = useState<string>("spouse");

  const parcelAssignments = useMemo(() => assignments.filter(a => a.parcel_id === parcel.id && a.status === "active"), [assignments, parcel.id]);
  const parcelLeases    = useMemo(() => leases.filter(l => l.parcel_id === parcel.id), [leases, parcel.id]);
  const parcelAssets    = useMemo(() => assets.filter(a => a.parcel_id === parcel.id), [assets, parcel.id]);
  const parcelEnc       = useMemo(() => encumbrances.filter(e => e.parcel_id === parcel.id), [encumbrances, parcel.id]);
  const parcelDeeds     = useMemo(() => deeds.filter(d => d.parcel_id === parcel.id), [deeds, parcel.id]);

  const tribalStatusLabel   = INTERNAL_TRIBAL_STATUSES.find(s => s.value === parcel.internal_tribal_status)?.label ?? parcel.internal_tribal_status ?? "—";
  const jurisdictionLabel   = JURISDICTIONAL_STATUSES.find(s => s.value === parcel.jurisdictional_status)?.label ?? parcel.jurisdictional_status ?? "—";
  const fedStatusLabel      = FEDERAL_ADMIN_STATUSES.find(s => s.value === parcel.federal_admin_status)?.label ?? parcel.federal_admin_status ?? "—";
  const protectionLabel     = PROTECTION_STATUSES.find(s => s.value === parcel.protection_restriction_status)?.label ?? parcel.protection_restriction_status ?? null;

  const displayId = parcel.tract_number || parcel.parcel_id || `#${parcel.id}`;

  function JumpButton({ tab, label, count }: { tab: string; label: string; count: number }) {
    if (count === 0) return null;
    return (
      <button
        onClick={() => { onNavigateTab(tab); onClose(); }}
        className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg border border-border/50 hover:border-amber-600/40 hover:bg-amber-900/10 transition-colors text-left"
      >
        <span className="text-xs text-foreground/80">{label}</span>
        <span className="text-xs font-semibold text-amber-400 tabular-nums">{count}</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[520px] bg-background border-l border-border shadow-2xl flex flex-col h-full overflow-hidden">
        {/* ── Header ── */}
        <div className="flex-none border-b border-border/60 p-5 bg-amber-900/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500/70">Parcel Record</span>
              </div>
              <h2 className="text-xl font-bold font-mono text-amber-300 leading-tight">{displayId}</h2>
              {parcel.parcel_id && parcel.tract_number && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">APN / Parcel ID: {parcel.parcel_id}</p>
              )}
              {parcel.legal_description && (
                <p className="text-xs text-foreground/60 mt-1 leading-relaxed line-clamp-2">{parcel.legal_description}</p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-6">

            {/* ── Status Grid ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card/60 border border-border/40 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Tribal Status</p>
                <p className="text-xs font-semibold text-foreground leading-snug">{tribalStatusLabel}</p>
              </div>
              <div className="bg-card/60 border border-border/40 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Jurisdiction</p>
                <p className={`text-xs font-semibold leading-snug ${jurisdictionColor(parcel.jurisdictional_status)}`}>{jurisdictionLabel}</p>
              </div>
              {parcel.federal_admin_status && parcel.federal_admin_status !== "none" && (
                <div className="bg-card/60 border border-border/40 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Federal Admin</p>
                  <p className="text-xs font-semibold text-slate-300 leading-snug">{fedStatusLabel}</p>
                </div>
              )}
              {parcel.acreage && (
                <div className="bg-card/60 border border-border/40 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Acreage</p>
                  <p className="text-xs font-semibold font-mono text-foreground">{Number(parcel.acreage).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ac</p>
                </div>
              )}
            </div>

            {/* ── Location & Legal ── */}
            {([parcel.county, parcel.state].some(Boolean) || parcel.plss_description) && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Location</p>
                {[parcel.county, parcel.state].filter(Boolean).length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-foreground/80">
                    <MapPin className="w-3 h-3 text-amber-500/60 shrink-0" />
                    <span>{[parcel.county, parcel.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                {parcel.plss_description && (
                  <p className="text-xs text-muted-foreground font-mono leading-snug">{parcel.plss_description}</p>
                )}
              </div>
            )}

            {/* ── Tribal Code References ── */}
            {(parcel.tribal_code_ref || parcel.tribal_court_order_num || parcel.federal_law_cross_ref) && (
              <div className="bg-amber-900/10 border border-amber-700/20 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-amber-500/60 mb-2">Legal Authority</p>
                {parcel.tribal_code_ref && <p className="text-xs text-amber-300/80 font-mono">{parcel.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</p>}
                {parcel.tribal_court_order_num && <p className="text-xs text-amber-300/60">Order: {parcel.tribal_court_order_num}</p>}
                {parcel.federal_law_cross_ref && <p className="text-xs text-muted-foreground">{parcel.federal_law_cross_ref}</p>}
                {protectionLabel && <p className="text-xs text-violet-400/80 italic">{protectionLabel.split("(")[0].trim()}</p>}
              </div>
            )}

            {/* ── Protection / Stewardship Notes ── */}
            {(parcel.stewardship_purpose || parcel.cultural_significance || parcel.historical_occupancy) && (
              <div className="space-y-2">
                {parcel.stewardship_purpose && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Stewardship Purpose</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{parcel.stewardship_purpose}</p>
                  </div>
                )}
                {parcel.cultural_significance && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Cultural Significance</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{parcel.cultural_significance}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Household Members ── */}
            {(() => {
              const householdMembers = parcelAssignments.filter(a => HOUSEHOLD_ROLES.has(a.assignment_role));
              const stewardAssignments = parcelAssignments.filter(a => !HOUSEHOLD_ROLES.has(a.assignment_role));
              return (
                <>
                  {/* Household Members panel — always shown so user can add */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Household Members
                      </p>
                      <div className="flex items-center gap-1.5">
                        {(["spouse", "child"] as const).map(role => (
                          <button
                            key={role}
                            onClick={() => { setHouseholdEditing(null); setHouseholdDefaultRole(role); setHouseholdModal(true); }}
                            className="text-[10px] px-2 py-0.5 rounded border border-amber-700/40 text-amber-400 hover:bg-amber-900/20 hover:text-amber-300 transition-colors flex items-center gap-0.5"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            {role === "spouse" ? "Spouse" : "Child"}
                          </button>
                        ))}
                        <button
                          onClick={() => { setHouseholdEditing(null); setHouseholdDefaultRole("sibling"); setHouseholdModal(true); }}
                          className="text-[10px] px-2 py-0.5 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-amber-700/30 transition-colors"
                        >
                          + Other
                        </button>
                      </div>
                    </div>

                    {householdMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 italic py-1">
                        No household members linked to this parcel yet. Use the buttons above to add your spouse or children.
                      </p>
                    ) : (
                      householdMembers.map(a => (
                        <div key={a.id} className="flex items-center justify-between gap-3 bg-blue-950/30 border border-blue-800/30 rounded-lg px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{a.member_name}</p>
                            <p className="text-[10px] text-blue-400/80 capitalize">{ASSIGNMENT_ROLES.find(r => r.value === a.assignment_role)?.label ?? a.assignment_role}</p>
                            {a.family_name && <p className="text-[10px] text-muted-foreground">{a.family_name}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => { setHouseholdEditing(a); setHouseholdDefaultRole(a.assignment_role); setHouseholdModal(true); }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { navigate(`/search?q=${encodeURIComponent(a.member_name)}`); onClose(); }}
                              className="text-[10px] text-amber-400 hover:text-amber-300 border border-amber-700/40 rounded px-1.5 py-0.5"
                              title="View profile"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Steward Assignments */}
                  {stewardAssignments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Active Stewards &amp; Assignees</p>
                      {stewardAssignments.map(a => (
                        <div key={a.id} className="flex items-center justify-between gap-3 bg-card/60 border border-border/40 rounded-lg px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{a.member_name}</p>
                            <p className="text-[10px] text-amber-400/70 capitalize">{ASSIGNMENT_ROLES.find(r => r.value === a.assignment_role)?.label ?? a.assignment_role}</p>
                            {a.family_name && <p className="text-[10px] text-muted-foreground">{a.family_name}</p>}
                          </div>
                          <button
                            onClick={() => { navigate(`/search?q=${encodeURIComponent(a.member_name)}`); onClose(); }}
                            className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors shrink-0 border border-amber-700/40 rounded px-2 py-1 hover:bg-amber-900/20"
                            title={`View ${a.member_name}'s profile`}
                          >
                            View Profile
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {/* ── Notes ── */}
            {parcel.notes && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Notes</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{parcel.notes}</p>
              </div>
            )}

            {/* ── Related Records ── */}
            {(parcelLeases.length + parcelAssets.length + parcelEnc.length + parcelDeeds.length) > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Related Records</p>
                <JumpButton tab="leases"       label="Leases"        count={parcelLeases.length} />
                <JumpButton tab="assets"       label="Assets"        count={parcelAssets.length} />
                <JumpButton tab="deeds"        label="Deed Records"  count={parcelDeeds.length} />
                <JumpButton tab="encumbrances" label="Encumbrances"  count={parcelEnc.length} />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex-none border-t border-border/40 p-4 flex items-center gap-3 bg-card/30">
          <button
            onClick={() => { onNavigateTab("assignments"); onClose(); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 text-xs text-foreground/80 transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> Manage Assignments
          </button>
          <button
            onClick={() => { onNavigateTab("parcels"); onClose(); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs text-white font-medium transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> Edit Parcel Record
          </button>
        </div>
      </div>
      {householdModal && (
        <AssignmentModal
          assignment={householdEditing ?? undefined}
          parcels={parcels.length > 0 ? parcels : [parcel]}
          defaultRole={householdDefaultRole}
          defaultParcelId={String(parcel.id)}
          onClose={() => { setHouseholdModal(false); setHouseholdEditing(null); }}
          onSaved={() => { setHouseholdModal(false); setHouseholdEditing(null); onRefresh?.(); }}
        />
      )}
    </div>
  );
}

function MapTab({ parcels, onSelectParcel }: { parcels: Parcel[]; onSelectParcel?: (p: Parcel) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<unknown>(null);
  const [filter, setFilter] = useState("");
  const onSelectRef = useRef(onSelectParcel);
  useEffect(() => { onSelectRef.current = onSelectParcel; }, [onSelectParcel]);

  const mapParcels = parcels.filter(p => p.lat && p.lng && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)));
  const filtered = filter ? mapParcels.filter(p => p.internal_tribal_status === filter) : mapParcels;

  // colour by internal status
  const markerColor = (s: string) => ({
    tribal_government_land: "#b45309",
    tribal_trust_stewardship: "#059669",
    protected_tribal_land: "#1d4ed8",
    restricted_tribal_status: "#7c3aed",
    beneficiary_stewardship: "#0d9488",
    sacred_cultural_land: "#be123c",
    federal_indian_law_implicated: "#c2410c",
    jurisdictional_review: "#dc2626",
  }[s] ?? "#6b7280");

  useEffect(() => {
    if (!mapRef.current) return;
    // dynamic import to avoid SSR issues
    import("leaflet").then(L => {
      if (leafletMap.current) {
        (leafletMap.current as { remove(): void }).remove();
        leafletMap.current = null;
      }
      if (!mapRef.current) return;

      // inject leaflet CSS once
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const center: [number, number] = filtered.length > 0
        ? [filtered.reduce((a, p) => a + Number(p.lat), 0) / filtered.length,
           filtered.reduce((a, p) => a + Number(p.lng), 0) / filtered.length]
        : [31.5, -97.5];

      const map = L.map(mapRef.current!).setView(center, filtered.length > 0 ? 10 : 6);
      leafletMap.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      filtered.forEach(p => {
        const color = markerColor(p.internal_tribal_status);
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const statusLabel = INTERNAL_TRIBAL_STATUSES.find(s => s.value === p.internal_tribal_status)?.label ?? p.internal_tribal_status;
        const jurisdLabel = JURISDICTIONAL_STATUSES.find(s => s.value === p.jurisdictional_status)?.label ?? p.jurisdictional_status ?? "—";
        const marker = L.marker([Number(p.lat), Number(p.lng)], { icon });
        marker.bindPopup(`
            <div style="font-family:system-ui;min-width:220px">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:#d97706;cursor:pointer" data-parcel-open="true">${p.tract_number || p.parcel_id || "#" + p.id}</div>
              ${p.legal_description ? `<div style="font-size:11px;color:#888;margin-bottom:6px">${p.legal_description.slice(0, 80)}…</div>` : ""}
              <div style="font-size:11px"><b>Status:</b> ${statusLabel}</div>
              <div style="font-size:11px"><b>Jurisdiction:</b> ${jurisdLabel}</div>
              <div style="font-size:11px"><b>Acreage:</b> ${p.acreage ? Number(p.acreage).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"} ac</div>
              ${[p.county, p.state].filter(Boolean).length ? `<div style="font-size:11px"><b>Location:</b> ${[p.county, p.state].filter(Boolean).join(", ")}</div>` : ""}
              ${p.tribal_code_ref ? `<div style="font-size:10px;color:#b45309;margin-top:4px">${p.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</div>` : ""}
              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #333">
                <span data-parcel-open="true" style="font-size:11px;color:#d97706;cursor:pointer;font-weight:600">View parcel record →</span>
              </div>
            </div>
          `);
        marker.on("popupopen", (e: unknown) => {
          const popup = (e as { popup: { getElement(): HTMLElement | null; close(): void } }).popup;
          const el = popup.getElement();
          el?.querySelectorAll("[data-parcel-open]").forEach(node => {
            (node as HTMLElement).addEventListener("click", (ev) => {
              ev.stopPropagation();
              popup.close();
              onSelectRef.current?.(p);
            });
          });
        });
        marker.addTo(map);
      });
    });

    return () => {
      if (leafletMap.current) {
        (leafletMap.current as { remove(): void }).remove();
        leafletMap.current = null;
      }
    };
  }, [filtered.length, filter, JSON.stringify(filtered.map(p => p.id))]);

  const noCoords = parcels.length - mapParcels.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filter} onChange={setFilter} options={INTERNAL_TRIBAL_STATUSES} placeholder="All Tribal Statuses" />
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} parcels plotted
          {noCoords > 0 && ` · ${noCoords} missing coordinates`}
        </span>
      </div>

      {mapParcels.length === 0 && (
        <div className="bg-muted/20 border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-3 text-amber-400/50" />
          <p className="font-medium mb-1">No parcels with coordinates</p>
          <p className="text-xs">Add latitude and longitude when registering parcels to plot them on the map.</p>
        </div>
      )}

      {mapParcels.length > 0 && (
        <>
          <div ref={mapRef} className="w-full rounded-lg overflow-hidden border border-border" style={{ height: 460 }} />
          <div className="flex flex-wrap gap-2 text-xs">
            {INTERNAL_TRIBAL_STATUSES.map(s => (
              <div key={s.value} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: markerColor(s.value) }} />
                <span className="text-muted-foreground">{s.label.split(" ").slice(0, 3).join(" ")}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Deed Modal ────────────────────────────────────────────────────────────────

const DEED_TYPES = [
  { value: "warranty",      label: "Warranty Deed" },
  { value: "quitclaim",     label: "Quit-Claim Deed" },
  { value: "trust_deed",    label: "Tribal Trust Deed" },
  { value: "grant_deed",    label: "Grant Deed" },
  { value: "conservation",  label: "Conservation Easement" },
  { value: "community_land",label: "Community Land Grant" },
  { value: "sovereign_declaration", label: "Sovereign Territorial Declaration" },
  { value: "treaty_conveyance", label: "Treaty Conveyance Document" },
];

const COMMUNITY_USES = [
  { value: "ceremonial",    label: "Ceremonial / Sacred Use" },
  { value: "housing",       label: "Tribal Housing" },
  { value: "agriculture",   label: "Community Agriculture" },
  { value: "government",    label: "Governmental / Administrative" },
  { value: "conservation",  label: "Conservation / Preservation" },
  { value: "economic",      label: "Economic Development" },
  { value: "educational",   label: "Educational / Cultural Center" },
];

const EMPTY_DEED = {
  parcelId: "", deedType: "warranty", grantor: "", grantee: "", recordingDate: "",
  recordingNumber: "", recordingJurisdiction: "", instrumentDate: "", consideration: "",
  exemptionBasis: "", sovereignImmunityClaim: false, conservationEasement: false,
  communityLandUse: "", tribalCodeRef: "", federalLawRef: "",
  fileKey: "", fileName: "", fileUrl: "", notes: "", status: "active",
};

function DeedModal({ deed, parcels, onClose, onSaved }: { deed?: Deed; parcels: Parcel[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(deed ? {
    parcelId: String(deed.parcel_id ?? ""), deedType: deed.deed_type ?? "warranty",
    grantor: deed.grantor ?? "", grantee: deed.grantee ?? "",
    recordingDate: deed.recording_date?.split("T")[0] ?? "",
    recordingNumber: deed.recording_number ?? "",
    recordingJurisdiction: deed.recording_jurisdiction ?? "",
    instrumentDate: deed.instrument_date?.split("T")[0] ?? "",
    consideration: deed.consideration ?? "", exemptionBasis: deed.exemption_basis ?? "",
    sovereignImmunityClaim: deed.sovereign_immunity_claim ?? false,
    conservationEasement: deed.conservation_easement ?? false,
    communityLandUse: deed.community_land_use ?? "",
    tribalCodeRef: deed.tribal_code_ref ?? "", federalLawRef: deed.federal_law_ref ?? "",
    fileKey: deed.file_key ?? "", fileName: deed.file_name ?? "", fileUrl: deed.file_url ?? "",
    notes: deed.notes ?? "", status: deed.status ?? "active",
  } : { ...EMPTY_DEED });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaveErr(null); setSaving(true);
    try {
      const res = await authFetch(deed ? `/api/land/deeds/${deed.id}` : "/api/land/deeds", { method: deed ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) { setSaveErr(e instanceof Error ? e.message : "Unknown error."); } finally { setSaving(false); }
  }

  return (
    <Modal title={deed ? "Edit Deed Record" : "Add Deed / Instrument"} subtitle="Sovereign Deed Repository — METC Title 4" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Parcel">
            <Sel value={form.parcelId} onChange={v => setForm(f => ({ ...f, parcelId: v }))}
              options={parcels.map(p => ({ value: String(p.id), label: `${p.tract_number || p.parcel_id || "#" + p.id} — ${p.legal_description?.slice(0, 50) ?? ""}` }))}
              placeholder="Select parcel" />
          </Field>
        </div>
        <Field label="Deed / Instrument Type">
          <Sel value={form.deedType} onChange={v => setForm(f => ({ ...f, deedType: v }))} options={DEED_TYPES} />
        </Field>
        <Field label="Status">
          <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={[{ value: "active", label: "Active" }, { value: "superseded", label: "Superseded" }, { value: "void", label: "Void" }, { value: "pending", label: "Pending" }]} />
        </Field>
        <div className="col-span-2"><Field label="Grantor (From)"><Input value={form.grantor} onChange={set("grantor")} placeholder="Person or entity conveying the land" /></Field></div>
        <div className="col-span-2"><Field label="Grantee (To)"><Input value={form.grantee} onChange={set("grantee")} placeholder="Person or entity receiving the land (e.g. Mathias El Tribe)" /></Field></div>
        <Field label="Instrument Date"><Input type="date" value={form.instrumentDate} onChange={set("instrumentDate")} /></Field>
        <Field label="Recording Date"><Input type="date" value={form.recordingDate} onChange={set("recordingDate")} /></Field>
        <Field label="Recording Number"><Input value={form.recordingNumber} onChange={set("recordingNumber")} placeholder="County/recorder instrument #" /></Field>
        <Field label="Recording Jurisdiction"><Input value={form.recordingJurisdiction} onChange={set("recordingJurisdiction")} placeholder="County/recorder office" /></Field>
        <Field label="Consideration ($)"><Input type="number" step="0.01" value={form.consideration} onChange={set("consideration")} placeholder="0.00 (or exempt)" /></Field>
        <Field label="Community Land Use">
          <Sel value={form.communityLandUse} onChange={v => setForm(f => ({ ...f, communityLandUse: v }))} options={COMMUNITY_USES} placeholder="Select use (if applicable)" />
        </Field>

        <SectionDivider icon={ShieldCheck} label="Exemption & Sovereign Immunity" />
        <div className="col-span-2 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="d-sovereign-immunity" checked={form.sovereignImmunityClaim}
              onChange={e => setForm(f => ({ ...f, sovereignImmunityClaim: e.target.checked }))}
              className="w-4 h-4 accent-amber-500" />
            <label htmlFor="d-sovereign-immunity" className="text-sm font-medium text-amber-300">
              Sovereign Immunity Claim — transfer outside state/county jurisdiction under METC T4
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="d-conservation" checked={form.conservationEasement}
              onChange={e => setForm(f => ({ ...f, conservationEasement: e.target.checked }))}
              className="w-4 h-4 accent-emerald-500" />
            <label htmlFor="d-conservation" className="text-sm font-medium text-emerald-300">
              Conservation Easement — land use restricted for preservation/cultural protection
            </label>
          </div>
        </div>
        <div className="col-span-2"><Field label="Exemption Basis"><Textarea value={form.exemptionBasis} onChange={set("exemptionBasis")} placeholder="Basis for tax exemption, transfer fee waiver, or sovereign immunity claim…" className="resize-none h-14" /></Field></div>

        <SectionDivider icon={FileArchive} label="Digital Deed File" />
        <Field label="File URL (Google Drive, SharePoint, or direct link)">
          <Input value={form.fileUrl} onChange={set("fileUrl")} placeholder="https://…" />
        </Field>
        <Field label="File Name / Description">
          <Input value={form.fileName} onChange={set("fileName")} placeholder="e.g. Warranty_Deed_MET-2024-001.pdf" />
        </Field>

        <SectionDivider icon={Scale} label="METC Title 4 Authority" />
        <Field label="METC Title 4 Reference">
          <Sel value={form.tribalCodeRef} onChange={v => setForm(f => ({ ...f, tribalCodeRef: v }))} options={METC_TITLE4_SECTIONS} placeholder="Select code section" />
        </Field>
        <Field label="Federal Law Reference">
          <Sel value={form.federalLawRef} onChange={v => setForm(f => ({ ...f, federalLawRef: v }))} options={FEDERAL_LAW_REFS} placeholder="Select (if applicable)" />
        </Field>

        <div className="col-span-2"><Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} className="resize-none h-12" /></Field></div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {deed ? "Save Changes" : "Record Deed"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Deeds Tab ─────────────────────────────────────────────────────────────────

function DeedsTab({ deeds, parcels, onRefresh }: { deeds: Deed[]; parcels: Parcel[]; onRefresh: () => void }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Deed | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filterParcel, setFilterParcel] = useState("");

  const filtered = filterParcel ? deeds.filter(d => String(d.parcel_id) === filterParcel) : deeds;
  const immunityCount = deeds.filter(d => d.sovereign_immunity_claim).length;

  async function del(id: number) {
    if (!confirm("Remove this deed record?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/deeds/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  return (
    <div className="space-y-4">
      {immunityCount > 0 && (
        <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg px-4 py-3 flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300 font-medium">{immunityCount} deed{immunityCount !== 1 ? "s" : ""} with active <b>Sovereign Immunity Claim</b> — outside county/state jurisdiction</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterParcel} onChange={setFilterParcel}
          options={parcels.map(p => ({ value: String(p.id), label: p.tract_number || p.parcel_id || `#${p.id}` }))}
          placeholder="All Parcels" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Deed
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-2.5">Deed / Instrument</th>
              <th className="text-left px-4 py-2.5">Grantor → Grantee</th>
              <th className="text-left px-4 py-2.5">Dates</th>
              <th className="text-left px-4 py-2.5">Parcel</th>
              <th className="text-left px-4 py-2.5">Flags</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                No deeds recorded. Add warranty deeds, trust deeds, conservation easements, and sovereign declarations.
              </td></tr>
            )}
            {filtered.map(d => (
              <tr key={d.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{DEED_TYPES.find(t => t.value === d.deed_type)?.label ?? d.deed_type}</div>
                  {d.recording_number && <div className="text-xs text-muted-foreground">#{d.recording_number}</div>}
                  {d.tribal_code_ref && <div className="text-[10px] text-amber-500">{d.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-muted-foreground">{d.grantor || "—"}</div>
                  <div className="text-xs font-medium text-foreground flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-amber-500" />{d.grantee || "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {d.instrument_date && <div>Instr: {new Date(d.instrument_date).toLocaleDateString()}</div>}
                  {d.recording_date && <div>Rec: {new Date(d.recording_date).toLocaleDateString()}</div>}
                  {d.recording_jurisdiction && <div className="text-[10px]">{d.recording_jurisdiction}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{d.tract_number || `#${d.parcel_id}`}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    {d.sovereign_immunity_claim && <Badge label="Sovereign Immunity" className="bg-amber-800 text-amber-100" />}
                    {d.conservation_easement && <Badge label="Conservation" className="bg-emerald-800 text-emerald-100" />}
                    {d.file_url && (
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                        <ExternalLink className="w-2.5 h-2.5" />{d.file_name || "View Deed"}
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(d); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(d.id)} disabled={deleting === d.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                      {deleting === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} deed record{filtered.length !== 1 ? "s" : ""}</p>
      {modal && <DeedModal deed={editing ?? undefined} parcels={parcels} onClose={() => { setModal(false); setEditing(null); }} onSaved={() => { setModal(false); setEditing(null); onRefresh(); }} />}
    </div>
  );
}

// ── Tax Compliance Modal ──────────────────────────────────────────────────────

const TAX_COMPLIANCE_TYPES = [
  { value: "county_tax",       label: "County Property Tax" },
  { value: "municipal_tax",    label: "Municipal Tax" },
  { value: "state_tax",        label: "State Tax" },
  { value: "special_assessment", label: "Special Assessment" },
  { value: "exemption_filing", label: "Exemption Filing" },
  { value: "immunity_claim",   label: "Sovereign Immunity Claim" },
  { value: "appeal",           label: "Tax Appeal / Challenge" },
  { value: "annual_review",    label: "Annual Compliance Review" },
];

const EXEMPTION_TYPES = [
  { value: "tribal_sovereign",  label: "Tribal Sovereign Immunity" },
  { value: "nonprofit",         label: "Non-Profit / Charitable" },
  { value: "agricultural",      label: "Agricultural Use" },
  { value: "conservation",      label: "Conservation Easement" },
  { value: "religious",         label: "Religious / Ceremonial Use" },
  { value: "governmental",      label: "Governmental Use" },
  { value: "treaty",            label: "Treaty Rights Basis" },
];

const EMPTY_TAX = {
  parcelId: "", complianceType: "county_tax", jurisdiction: "", taxYear: String(new Date().getFullYear()),
  deadlineDate: "", amountAssessed: "", amountPaid: "", paymentDate: "", status: "pending",
  sovereignImmunityClaimed: false, immunityClaimDate: "", immunityBasis: "",
  exemptionType: "", exemptionFiledDate: "", exemptionStatus: "",
  appealFiled: false, appealDate: "", appealBasis: "", tribalCodeRef: "", federalLawRef: "", notes: "",
};

function TaxModal({ entry, parcels, onClose, onSaved }: { entry?: TaxCompliance; parcels: Parcel[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(entry ? {
    parcelId: String(entry.parcel_id ?? ""), complianceType: entry.compliance_type ?? "county_tax",
    jurisdiction: entry.jurisdiction ?? "", taxYear: String(entry.tax_year ?? new Date().getFullYear()),
    deadlineDate: entry.deadline_date?.split("T")[0] ?? "",
    amountAssessed: entry.amount_assessed ?? "", amountPaid: entry.amount_paid ?? "",
    paymentDate: entry.payment_date?.split("T")[0] ?? "", status: entry.status ?? "pending",
    sovereignImmunityClaimed: entry.sovereign_immunity_claimed ?? false,
    immunityClaimDate: entry.immunity_claim_date?.split("T")[0] ?? "",
    immunityBasis: entry.immunity_basis ?? "", exemptionType: entry.exemption_type ?? "",
    exemptionFiledDate: entry.exemption_filed_date?.split("T")[0] ?? "",
    exemptionStatus: entry.exemption_status ?? "",
    appealFiled: entry.appeal_filed ?? false, appealDate: entry.appeal_date?.split("T")[0] ?? "",
    appealBasis: entry.appeal_basis ?? "", tribalCodeRef: entry.tribal_code_ref ?? "",
    federalLawRef: entry.federal_law_ref ?? "", notes: entry.notes ?? "",
  } : { ...EMPTY_TAX });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaveErr(null); setSaving(true);
    try {
      const res = await authFetch(entry ? `/api/land/tax-compliance/${entry.id}` : "/api/land/tax-compliance", { method: entry ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) { setSaveErr(e instanceof Error ? e.message : "Unknown error."); } finally { setSaving(false); }
  }

  return (
    <Modal title={entry ? "Edit Tax Compliance" : "Track Tax / Compliance Item"} subtitle="Tax Compliance Calendar — Sovereign Immunity & Exemption Tracking" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Parcel">
            <Sel value={form.parcelId} onChange={v => setForm(f => ({ ...f, parcelId: v }))}
              options={parcels.map(p => ({ value: String(p.id), label: `${p.tract_number || p.parcel_id || "#" + p.id} — ${p.county ?? ""}` }))}
              placeholder="Select parcel" />
          </Field>
        </div>
        <Field label="Compliance Type">
          <Sel value={form.complianceType} onChange={v => setForm(f => ({ ...f, complianceType: v }))} options={TAX_COMPLIANCE_TYPES} />
        </Field>
        <Field label="Status">
          <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={[
              { value: "pending", label: "Pending" },
              { value: "paid", label: "Paid" },
              { value: "exempt", label: "Exempt" },
              { value: "immunity_claimed", label: "Immunity Claimed" },
              { value: "appealing", label: "Under Appeal" },
              { value: "overdue", label: "Overdue" },
              { value: "voided", label: "Voided / Void Ab Initio" },
            ]} />
        </Field>
        <Field label="Jurisdiction / Entity"><Input value={form.jurisdiction} onChange={set("jurisdiction")} placeholder="e.g. Travis County Tax Office" /></Field>
        <Field label="Tax Year"><Input type="number" value={form.taxYear} onChange={set("taxYear")} placeholder={String(new Date().getFullYear())} /></Field>
        <Field label="Deadline Date"><Input type="date" value={form.deadlineDate} onChange={set("deadlineDate")} /></Field>
        <Field label="Amount Assessed ($)"><Input type="number" step="0.01" value={form.amountAssessed} onChange={set("amountAssessed")} placeholder="0.00" /></Field>
        <Field label="Amount Paid ($)"><Input type="number" step="0.01" value={form.amountPaid} onChange={set("amountPaid")} placeholder="0.00" /></Field>
        <Field label="Payment Date"><Input type="date" value={form.paymentDate} onChange={set("paymentDate")} /></Field>

        <SectionDivider icon={ShieldCheck} label="Sovereign Immunity Claim" />
        <div className="col-span-2 flex items-center gap-3">
          <input type="checkbox" id="t-immunity" checked={form.sovereignImmunityClaimed}
            onChange={e => setForm(f => ({ ...f, sovereignImmunityClaimed: e.target.checked }))}
            className="w-4 h-4 accent-amber-500" />
          <label htmlFor="t-immunity" className="text-sm font-medium text-amber-300">
            Sovereign Immunity Claimed — tribal land not subject to this tax/assessment
          </label>
        </div>
        {form.sovereignImmunityClaimed && (
          <>
            <Field label="Immunity Claim Date"><Input type="date" value={form.immunityClaimDate} onChange={set("immunityClaimDate")} /></Field>
            <div className="col-span-2 col-start-1"><Field label="Immunity Basis"><Textarea value={form.immunityBasis} onChange={set("immunityBasis")} placeholder="Cite METC Title 4 sections, federal Indian law, treaties…" className="resize-none h-14" /></Field></div>
          </>
        )}

        <SectionDivider icon={FileText} label="Exemption Filing" />
        <Field label="Exemption Type">
          <Sel value={form.exemptionType} onChange={v => setForm(f => ({ ...f, exemptionType: v }))} options={EXEMPTION_TYPES} placeholder="Select (if applicable)" />
        </Field>
        <Field label="Exemption Status">
          <Sel value={form.exemptionStatus} onChange={v => setForm(f => ({ ...f, exemptionStatus: v }))}
            options={[{ value: "not_filed", label: "Not Filed" }, { value: "filed", label: "Filed" }, { value: "approved", label: "Approved" }, { value: "denied", label: "Denied" }, { value: "appealing", label: "Under Appeal" }]}
            placeholder="Select status" />
        </Field>
        <Field label="Exemption Filed Date"><Input type="date" value={form.exemptionFiledDate} onChange={set("exemptionFiledDate")} /></Field>
        <div className="col-span-2 flex items-center gap-3">
          <input type="checkbox" id="t-appeal" checked={form.appealFiled}
            onChange={e => setForm(f => ({ ...f, appealFiled: e.target.checked }))}
            className="w-4 h-4 accent-amber-500" />
          <label htmlFor="t-appeal" className="text-sm font-medium text-foreground">Appeal Filed</label>
        </div>
        {form.appealFiled && (
          <>
            <Field label="Appeal Date"><Input type="date" value={form.appealDate} onChange={set("appealDate")} /></Field>
            <div className="col-span-2 col-start-1"><Field label="Appeal Basis"><Textarea value={form.appealBasis} onChange={set("appealBasis")} className="resize-none h-12" /></Field></div>
          </>
        )}

        <SectionDivider icon={Scale} label="METC Title 4 Authority" />
        <Field label="METC Title 4 Reference">
          <Sel value={form.tribalCodeRef} onChange={v => setForm(f => ({ ...f, tribalCodeRef: v }))} options={METC_TITLE4_SECTIONS} placeholder="Select section" />
        </Field>
        <Field label="Federal Law Reference">
          <Sel value={form.federalLawRef} onChange={v => setForm(f => ({ ...f, federalLawRef: v }))} options={FEDERAL_LAW_REFS} placeholder="Select (if applicable)" />
        </Field>
        <div className="col-span-2"><Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} className="resize-none h-12" /></Field></div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className={`${form.sovereignImmunityClaimed ? "bg-amber-600 hover:bg-amber-700" : "bg-amber-600 hover:bg-amber-700"} text-white`}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {entry ? "Save Changes" : "Track Item"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Tax Compliance Tab ────────────────────────────────────────────────────────

function TaxTab({ tax, parcels, onRefresh }: { tax: TaxCompliance[]; parcels: Parcel[]; onRefresh: () => void }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<TaxCompliance | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = filterStatus ? tax.filter(t => t.status === filterStatus) : tax;
  const today = new Date();

  function daysUntilDate(d: string) { return Math.ceil((new Date(d).getTime() - today.getTime()) / 86_400_000); }

  const overdue = filtered.filter(t => t.deadline_date && daysUntilDate(t.deadline_date) < 0 && t.status === "pending");
  const dueThisMonth = filtered.filter(t => t.deadline_date && daysUntilDate(t.deadline_date) >= 0 && daysUntilDate(t.deadline_date) <= 30 && t.status === "pending");
  const immunityCount = filtered.filter(t => t.sovereign_immunity_claimed).length;

  async function del(id: number) {
    if (!confirm("Remove this tax compliance record?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/tax-compliance/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  const statusColor = (s: string) => ({
    pending: "text-amber-400", paid: "text-emerald-400", exempt: "text-teal-400",
    immunity_claimed: "text-amber-300", appealing: "text-blue-400",
    overdue: "text-red-400", voided: "text-violet-400",
  }[s] ?? "text-muted-foreground");

  const statusIcon = (s: string) => {
    if (s === "paid" || s === "exempt") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (s === "overdue") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (s === "immunity_claimed") return <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />;
    return <Calendar className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-sm">
        {overdue.length > 0 && (
          <div className="col-span-3 bg-red-950/30 border border-red-700/40 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300 font-medium">{overdue.length} item{overdue.length !== 1 ? "s" : ""} <b>OVERDUE</b> — deadline passed</p>
          </div>
        )}
        {dueThisMonth.length > 0 && (
          <div className="col-span-3 bg-amber-950/30 border border-amber-700/40 rounded-lg px-4 py-3 flex items-center gap-3">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300 font-medium">{dueThisMonth.length} deadline{dueThisMonth.length !== 1 ? "s" : ""} due within 30 days</p>
          </div>
        )}
        {immunityCount > 0 && (
          <div className="col-span-3 bg-amber-950/20 border border-amber-700/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-200 font-medium">{immunityCount} item{immunityCount !== 1 ? "s" : ""} with <b>Sovereign Immunity</b> claimed — tribal land not subject to these assessments</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterStatus} onChange={setFilterStatus}
          options={[
            { value: "pending", label: "Pending" }, { value: "paid", label: "Paid" },
            { value: "exempt", label: "Exempt" }, { value: "immunity_claimed", label: "Immunity Claimed" },
            { value: "appealing", label: "Appealing" }, { value: "overdue", label: "Overdue" },
            { value: "voided", label: "Voided" },
          ]} placeholder="All Statuses" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Track Item
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-2.5">Type / Jurisdiction</th>
              <th className="text-left px-4 py-2.5">Parcel</th>
              <th className="text-left px-4 py-2.5">Year</th>
              <th className="text-left px-4 py-2.5">Deadline</th>
              <th className="text-right px-4 py-2.5">Assessed</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                No tax compliance items. Track county/municipal tax deadlines, sovereign immunity claims, and exemption filings.
              </td></tr>
            )}
            {filtered.map(t => {
              const d = t.deadline_date ? daysUntilDate(t.deadline_date) : null;
              const isOverdue = d !== null && d < 0 && t.status === "pending";
              return (
                <tr key={t.id} className={`border-t border-border hover:bg-muted/20 transition-colors ${isOverdue ? "bg-red-950/10" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{TAX_COMPLIANCE_TYPES.find(x => x.value === t.compliance_type)?.label ?? t.compliance_type}</div>
                    {t.jurisdiction && <div className="text-xs text-muted-foreground">{t.jurisdiction}</div>}
                    {t.tribal_code_ref && <div className="text-[10px] text-amber-500">{t.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.tract_number || `#${t.parcel_id}`}{t.county ? ` · ${t.county}` : ""}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{t.tax_year || "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {t.deadline_date ? (
                      <div>
                        <div className={isOverdue ? "text-red-400 font-semibold" : "text-foreground"}>{new Date(t.deadline_date).toLocaleDateString()}</div>
                        {d !== null && <div className={`text-[10px] ${d < 0 ? "text-red-400" : d <= 30 ? "text-amber-400" : "text-muted-foreground"}`}>
                          {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d remaining`}
                        </div>}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {t.amount_assessed ? <div className="text-foreground">${Number(t.amount_assessed).toLocaleString()}</div> : "—"}
                    {t.amount_paid && <div className="text-emerald-400 text-[10px]">Paid: ${Number(t.amount_paid).toLocaleString()}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(t.status)}
                      <span className={`text-xs font-medium capitalize ${statusColor(t.status)}`}>{t.status.replace(/_/g, " ")}</span>
                    </div>
                    {t.sovereign_immunity_claimed && <div className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" />Immunity</div>}
                    {t.exemption_type && <div className="text-[10px] text-teal-400 mt-0.5">{EXEMPTION_TYPES.find(e => e.value === t.exemption_type)?.label.split(" ").slice(0, 2).join(" ")}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(t); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(t.id)} disabled={deleting === t.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                        {deleting === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {modal && <TaxModal entry={editing ?? undefined} parcels={parcels} onClose={() => { setModal(false); setEditing(null); }} onSaved={() => { setModal(false); setEditing(null); onRefresh(); }} />}
    </div>
  );
}

// ── Member Assignment Modal ───────────────────────────────────────────────────

const ASSIGNMENT_ROLES = [
  { value: "steward",        label: "Land Steward" },
  { value: "caretaker",      label: "Caretaker / Custodian" },
  { value: "cultural_keeper",label: "Cultural Keeper" },
  { value: "family_steward", label: "Steward Family Representative" },
  { value: "overseer",       label: "Overseer / Supervisor" },
  { value: "beneficiary",    label: "Beneficiary (Land Benefit)" },
  { value: "committee",      label: "Land Committee Member" },
  { value: "trustee",        label: "Trustee Assignment" },
  { value: "spouse",         label: "Spouse / Partner" },
  { value: "child",          label: "Child / Dependent" },
  { value: "parent",         label: "Parent / Guardian" },
  { value: "sibling",        label: "Sibling" },
];

const HOUSEHOLD_ROLES = new Set(["spouse", "child", "parent", "sibling"]);

const EMPTY_ASSIGN = {
  parcelId: "", memberId: "", memberName: "", memberEmail: "", assignmentRole: "steward",
  familyName: "", stewardFamily: "", assignedDate: new Date().toISOString().split("T")[0],
  endDate: "", status: "active", responsibilities: "", culturalConnection: "",
  tribalCodeRef: "", authorizedBy: "", notes: "",
};

function AssignmentModal({ assignment, parcels, defaultRole, defaultParcelId, onClose, onSaved }: {
  assignment?: MemberAssignment; parcels: Parcel[];
  defaultRole?: string; defaultParcelId?: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(assignment ? {
    parcelId: String(assignment.parcel_id ?? ""), memberId: assignment.member_id ?? "",
    memberName: assignment.member_name ?? "", memberEmail: assignment.member_email ?? "",
    assignmentRole: assignment.assignment_role ?? "steward",
    familyName: assignment.family_name ?? "", stewardFamily: assignment.steward_family ?? "",
    assignedDate: assignment.assigned_date?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    endDate: assignment.end_date?.split("T")[0] ?? "", status: assignment.status ?? "active",
    responsibilities: assignment.responsibilities ?? "", culturalConnection: assignment.cultural_connection ?? "",
    tribalCodeRef: assignment.tribal_code_ref ?? "", authorizedBy: assignment.authorized_by ?? "",
    notes: assignment.notes ?? "",
  } : { ...EMPTY_ASSIGN, assignmentRole: defaultRole ?? "steward", parcelId: defaultParcelId ?? "" });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.memberName.trim()) { setSaveErr("Member name is required."); return; }
    setSaveErr(null); setSaving(true);
    try {
      const res = await authFetch(assignment ? `/api/land/assignments/${assignment.id}` : "/api/land/assignments", { method: assignment ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { const msg = await res.text(); setSaveErr(`Save failed (${res.status}): ${msg}`); return; }
      onSaved();
    } catch (e) { setSaveErr(e instanceof Error ? e.message : "Unknown error."); } finally { setSaving(false); }
  }

  return (
    <Modal title={assignment ? "Edit Assignment" : "Assign Member / Steward"} subtitle="Member & Steward Assignments — METC Title 4 Land Stewardship" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Parcel">
            <Sel value={form.parcelId} onChange={v => setForm(f => ({ ...f, parcelId: v }))}
              options={parcels.map(p => ({ value: String(p.id), label: `${p.tract_number || p.parcel_id || "#" + p.id} — ${p.legal_description?.slice(0, 50) ?? ""}` }))}
              placeholder="Select parcel" />
          </Field>
        </div>
        <Field label="Assignment Role">
          <Sel value={form.assignmentRole} onChange={v => setForm(f => ({ ...f, assignmentRole: v }))} options={ASSIGNMENT_ROLES} />
        </Field>
        <Field label="Status">
          <Sel value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "pending", label: "Pending" }, { value: "revoked", label: "Revoked" }]} />
        </Field>
        <div className="col-span-2"><Field label="Member Name *"><Input value={form.memberName} onChange={set("memberName")} placeholder="Full name of member or steward" /></Field></div>
        <Field label="Member ID (System ID)"><Input value={form.memberId} onChange={set("memberId")} placeholder="Internal member ID (optional)" /></Field>
        <Field label="Member Email"><Input type="email" value={form.memberEmail} onChange={set("memberEmail")} placeholder="member@tribe.org" /></Field>
        <Field label="Family Name / Lineage"><Input value={form.familyName} onChange={set("familyName")} placeholder="Family or clan name" /></Field>
        <Field label="Steward Family Name"><Input value={form.stewardFamily} onChange={set("stewardFamily")} placeholder="Steward family collective name" /></Field>
        <Field label="Assigned Date"><Input type="date" value={form.assignedDate} onChange={set("assignedDate")} /></Field>
        <Field label="End Date (if temporary)"><Input type="date" value={form.endDate} onChange={set("endDate")} /></Field>
        <div className="col-span-2"><Field label="Authorized By"><Input value={form.authorizedBy} onChange={set("authorizedBy")} placeholder="Chief Justice / Council / Trustee who authorized" /></Field></div>
        <div className="col-span-2"><Field label="Responsibilities"><Textarea value={form.responsibilities} onChange={set("responsibilities")} placeholder="Stewardship duties, land care obligations, reporting requirements…" className="resize-none h-16" /></Field></div>
        <div className="col-span-2"><Field label="Cultural Connection to Land"><Textarea value={form.culturalConnection} onChange={set("culturalConnection")} placeholder="Ancestral connection, traditional relationship, cultural significance to this member/family…" className="resize-none h-14" /></Field></div>

        <Field label="METC Title 4 Reference">
          <Sel value={form.tribalCodeRef} onChange={v => setForm(f => ({ ...f, tribalCodeRef: v }))} options={METC_TITLE4_SECTIONS} placeholder="Select section" />
        </Field>
        <div className="col-span-2 col-start-1"><Field label="Notes"><Textarea value={form.notes} onChange={set("notes")} className="resize-none h-10" /></Field></div>
      </div>
      {saveErr && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{saveErr}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving || !form.memberName.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {assignment ? "Save Changes" : "Assign Member"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Member Assignments Tab ────────────────────────────────────────────────────

function AssignmentsTab({ assignments, parcels, onRefresh }: { assignments: MemberAssignment[]; parcels: Parcel[]; onRefresh: () => void }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MemberAssignment | null>(null);
  const [, navigate] = useLocation();
  const [filterParcel, setFilterParcel] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const filtered = assignments.filter(a =>
    (!filterParcel || String(a.parcel_id) === filterParcel) &&
    (!filterRole || a.assignment_role === filterRole)
  );

  async function del(id: number) {
    if (!confirm("Remove this assignment?")) return;
    setDeleting(id);
    try { await authFetch(`/api/land/assignments/${id}`, { method: "DELETE" }); onRefresh(); } finally { setDeleting(null); }
  }

  const roleColor = (r: string) => ({
    steward: "bg-emerald-800 text-emerald-100",
    caretaker: "bg-teal-800 text-teal-100",
    cultural_keeper: "bg-rose-800 text-rose-100",
    family_steward: "bg-amber-800 text-amber-100",
    trustee: "bg-violet-800 text-violet-100",
    spouse: "bg-blue-800 text-blue-100",
    child: "bg-sky-800 text-sky-100",
    parent: "bg-indigo-800 text-indigo-100",
    sibling: "bg-cyan-800 text-cyan-100",
  }[r] ?? "bg-muted text-muted-foreground");

  const statusColor = (s: string) => ({
    active: "text-emerald-400", inactive: "text-muted-foreground",
    pending: "text-amber-400", revoked: "text-red-400",
  }[s] ?? "text-muted-foreground");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Sel value={filterParcel} onChange={setFilterParcel}
          options={parcels.map(p => ({ value: String(p.id), label: p.tract_number || p.parcel_id || `#${p.id}` }))}
          placeholder="All Parcels" />
        <Sel value={filterRole} onChange={setFilterRole} options={ASSIGNMENT_ROLES} placeholder="All Roles" />
        <div className="ml-auto">
          <Button onClick={() => { setEditing(null); setModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white text-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Assign Member
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-lg">
            <Users className="w-8 h-8 mx-auto mb-3 text-amber-400/50" />
            No member assignments yet. Link tribal members and steward families to specific parcels.
          </div>
        )}
        {filtered.map(a => (
          <div key={a.id} className="bg-background/60 border border-border rounded-lg p-4 hover:border-amber-700/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => navigate(`/search?q=${encodeURIComponent(a.member_name)}`)}
                    className="font-semibold text-foreground hover:text-amber-300 hover:underline transition-colors flex items-center gap-1"
                    title={`View member profile: ${a.member_name}`}
                  >
                    {a.member_name}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </button>
                  <Badge label={ASSIGNMENT_ROLES.find(r => r.value === a.assignment_role)?.label ?? a.assignment_role} className={roleColor(a.assignment_role)} />
                  <span className={`text-xs font-medium capitalize ${statusColor(a.status)}`}>{a.status}</span>
                </div>
                {(a.family_name || a.steward_family) && (
                  <p className="text-xs text-amber-300/70 mt-0.5 italic">
                    {[a.steward_family, a.family_name].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                  <span><Landmark className="w-3 h-3 inline mr-0.5" />{a.tract_number || `#${a.parcel_id}`}</span>
                  {a.member_email && <span><Link2 className="w-3 h-3 inline mr-0.5" />{a.member_email}</span>}
                  <span><CalendarDays className="w-3 h-3 inline mr-0.5" />Since {new Date(a.assigned_date).toLocaleDateString()}</span>
                  {a.end_date && <span>Until {new Date(a.end_date).toLocaleDateString()}</span>}
                  {a.authorized_by && <span>Auth: {a.authorized_by}</span>}
                </div>
                {a.responsibilities && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{a.responsibilities}</p>}
                {a.cultural_connection && <p className="text-xs text-rose-300/60 mt-1 italic line-clamp-1">{a.cultural_connection}</p>}
                {a.tribal_code_ref && <span className="text-[10px] text-amber-500">{a.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditing(a); setModal(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(a.id)} disabled={deleting === a.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                  {deleting === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} assignment{filtered.length !== 1 ? "s" : ""}</p>
      {modal && <AssignmentModal assignment={editing ?? undefined} parcels={parcels} onClose={() => { setModal(false); setEditing(null); }} onSaved={() => { setModal(false); setEditing(null); onRefresh(); }} />}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Land Templates Tab ────────────────────────────────────────────────────────

const LAND_TEMPLATES = [
  { key: "trust_deed",              title: "Deed of Trust — Indian Trust Land",       law: "25 U.S.C. §177 · METC T4 §4",       desc: "Conveys Indian trust land subject to anti-alienation protections." },
  { key: "land_lease",              title: "Lease of Individual Indian Allotment",    law: "25 U.S.C. §415 · BIA Lease Rules",   desc: "Agricultural, surface, or commercial lease on individual allotment." },
  { key: "trust_land_transfer",     title: "Trust Land Transfer Instrument",          law: "25 U.S.C. §2201 · AIPRA",            desc: "Transfers federal trust land between tribal entities with Secretarial approval." },
  { key: "trust_land_status_report",title: "Trust Land Status Report (TSR)",          law: "METC T4 §3 · 25 U.S.C. §5301",      desc: "Documents current trust land status for court, agency, or recorder filing." },
  { key: "trust_land_instrument",   title: "Trust Land Instrument (General Purpose)", law: "METC T4 §3",                         desc: "General-purpose instrument covering conveyance, lease, right-of-way, or protective declaration." },
  { key: "trust_land_decision_letter", title: "Decision Letter — Trust Land Action",  law: "METC T4 §10 · Admin. Procedure",     desc: "Formal determination letter: approved, denied, conditional, or referred." },
  { key: "trust_land_intake_form",  title: "Trust Land Intake Form",                  law: "METC T4 §9",                         desc: "Intake and routing form for a trust land matter submitted for review." },
  { key: "land_into_trust",         title: "Application for Land Acquisition in Trust", law: "25 U.S.C. §5108 · 25 C.F.R. Part 151", desc: "Petitions BIA to take fee land into federal trust on behalf of a tribal member or the tribe." },
  { key: "restricted_status_confirmation", title: "Confirmation of Restricted Land Status", law: "25 U.S.C. §177 · 25 C.F.R. §1.4",  desc: "Confirms restricted fee land cannot be alienated or taxed without federal approval — for court, agency, or recorder use." },
  { key: "trust_land_probate_summary", title: "Trust Land Probate Summary",           law: "25 U.S.C. §2201 · AIPRA",            desc: "Heirship determination and distribution summary for deceased tribal member." },
  { key: "encumbrance_review",      title: "Encumbrance Review",                      law: "METC T4 §5 · 25 U.S.C. §177",       desc: "Identifies and challenges unauthorized encumbrances on trust land." },
  { key: "notice_of_title_defect",  title: "Notice of Title Defect",                  law: "METC T4 §8 · UCC §2-314",            desc: "Formal notice of title defects, adverse claims, or chain-of-title gaps." },
  { key: "notice_of_federal_review", title: "Notice of Federal Review",               law: "METC T4 §9 · 25 U.S.C. §5301",      desc: "Triggers federal review for jurisdictional or land status matters." },
];

function LandTemplatesTab() {
  const [search, setSearch] = useState("");

  const filtered = LAND_TEMPLATES.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search land templates…"
            className="pl-9 pr-3 py-2 w-full bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <a
          href="/instrument-wizard"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
        >
          <Gavel className="w-3.5 h-3.5" /> Open Wizard
        </a>
        <a
          href="/templates"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> All Templates
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(t => (
          <div key={t.key} className="bg-background border border-border rounded-lg p-4 flex flex-col gap-2 hover:border-amber-600/50 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <BookOpen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{t.law}</span>
            </div>
            <p className="text-sm font-semibold text-foreground leading-snug">{t.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">{t.desc}</p>
            <a
              href={`/instrument-wizard?key=${t.key}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 mt-1 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" /> Generate Document
            </a>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 py-12 text-center text-sm text-muted-foreground">No templates match your search.</div>
        )}
      </div>

      <div className="border border-amber-700/30 bg-amber-950/10 rounded-lg p-4 text-xs text-amber-300 space-y-1">
        <p className="font-semibold uppercase tracking-widest text-[10px] text-amber-500 mb-2">API Access — Bulk Document Generation</p>
        <p>All templates are available via <code className="bg-amber-900/30 px-1 rounded">POST /api/trust/instruments/templates/generate</code></p>
        <p className="text-muted-foreground mt-1">Pass <code className="bg-muted px-1 rounded">{"{ templateKey, variables }"}</code> to generate any instrument programmatically.</p>
      </div>
    </div>
  );
}

// ── Deed Generator Tab ────────────────────────────────────────────────────────

interface DeedCounty {
  slug: string; name: string; state: string;
  recorderOffice: string; address: string; phone: string;
  parcelLabel: string; deedTypes: string[]; hasSampleData: boolean;
}

const DEED_FORM_DEFAULTS = {
  grantor: "Mathias El Tribe Sovereign Authority",
  grantorAddress: "Sovereign Office of the Chief Justice & Trustee",
  grantee: "Mathias El Tribe Land Trust",
  granteeAddress: "c/o Office of the Chief Justice",
  parcelId: "", legalDescription: "", consideration: "Sovereign Trust — No Monetary Consideration (Exempt: 25 U.S.C. §177)",
  deedType: "Tribal Trust Deed", tractNumber: "", biaTractNumber: "",
  federalLawRef: "25 U.S.C. §177 — Non-Intercourse Act",
  tribalCodeRef: "METC Title 4 §3 — Tribal Land Trust Governance",
  exemptionBasis: "Indian Trust Land — exempt from state transfer tax per 25 U.S.C. §177 and METC Title 4 §4",
  sovereignImmunity: true,
};

function DeedGeneratorTab() {
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [form, setForm] = useState<typeof DEED_FORM_DEFAULTS & { county?: string; state?: string; notaryCounty?: string; notaryState?: string }>(DEED_FORM_DEFAULTS);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  const countiesQ = useQuery<DeedCounty[]>({
    queryKey: ["deed-counties"],
    queryFn: () => authFetch("/api/deed/counties").then(r => r.json()),
  });

  const counties = countiesQ.data ?? [];
  const selectedCounty = counties.find(c => c.slug === selectedSlug);

  function setf(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function loadSample() {
    if (!selectedSlug) return;
    setSampleLoading(true);
    try {
      const token = await getCurrentBearerToken();
      const r = await fetch(`/api/deed/${selectedSlug}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const html = await r.text();
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
      }
    } finally { setSampleLoading(false); }
  }

  async function generate(download: boolean) {
    if (!selectedSlug || !selectedCounty) return;
    setErr(null);
    setGenerating(true);
    try {
      const token = await getCurrentBearerToken();
      const body = {
        ...form,
        county: form.county || selectedCounty.name,
        state: form.state || selectedCounty.state,
        notaryCounty: form.notaryCounty || selectedCounty.name,
        notaryState: form.notaryState || selectedCounty.state,
      };
      const r = await fetch(`/api/deed/${selectedSlug}${download ? "?download=1" : ""}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? "Generation failed"); return; }
      const html = await r.text();
      if (download) {
        const blob = new Blob([html], { type: "text/html" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `deed-${selectedSlug}.html`;
        a.click();
      } else {
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally { setGenerating(false); }
  }

  const stateGroups = counties.reduce((acc, c) => {
    (acc[c.state] ??= []).push(c);
    return acc;
  }, {} as Record<string, DeedCounty[]>);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left — county picker + recorder info */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-2">1. Select County</label>
            <select
              value={selectedSlug}
              onChange={e => {
                setSelectedSlug(e.target.value);
                const c = counties.find(x => x.slug === e.target.value);
                if (c) setForm(f => ({ ...f, deedType: c.deedTypes[0], county: c.name, state: c.state, notaryCounty: c.name, notaryState: c.state }));
              }}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">— Choose a county —</option>
              {Object.entries(stateGroups).map(([state, cs]) => (
                <optgroup key={state} label={`── ${state} ──`}>
                  {cs.map(c => (
                    <option key={c.slug} value={c.slug}>{c.name}{c.hasSampleData ? " ★" : ""}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">★ = sample data available for quick preview</p>
          </div>

          {selectedCounty && (
            <div className="bg-amber-950/10 border border-amber-700/30 rounded-lg p-3 space-y-1.5 text-xs">
              <p className="font-semibold text-amber-400 text-[10px] uppercase tracking-widest mb-2">{selectedCounty.recorderOffice}</p>
              <p className="text-muted-foreground">{selectedCounty.address}</p>
              <p className="text-muted-foreground">{selectedCounty.phone}</p>
              <p className="mt-1"><span className="text-muted-foreground">Parcel label: </span>{selectedCounty.parcelLabel}</p>
              {selectedCounty.hasSampleData && (
                <button
                  onClick={loadSample}
                  disabled={sampleLoading}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-amber-600/40 text-amber-400 hover:bg-amber-900/20 transition-colors text-xs font-medium"
                >
                  <FileText className="w-3 h-3" />
                  {sampleLoading ? "Loading…" : "Preview sample deed"}
                </button>
              )}
            </div>
          )}

          {/* API reference */}
          <div className="border border-border rounded-lg p-3 space-y-2 text-xs">
            <p className="font-semibold uppercase tracking-widest text-[10px] text-muted-foreground">API Import Reference</p>
            <div className="space-y-1.5 font-mono text-[10px] text-muted-foreground">
              <p className="text-green-400">GET /api/deed/counties</p>
              <p className="text-blue-400">GET /api/deed/:county</p>
              <p className="text-blue-400">POST /api/deed/:county</p>
              <p className="text-muted-foreground pl-2">?download=1 for file</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Counties: MI (8) · CA (4) · TX (4)</p>
          </div>
        </div>

        {/* Right — deed form */}
        <div className="xl:col-span-2 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">2. Deed Details</p>

          {!selectedSlug ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Select a county to configure the deed.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {selectedCounty && (
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">Deed Type</label>
                  <select
                    value={form.deedType}
                    onChange={setf("deedType")}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {selectedCounty.deedTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {([ ["grantor","Grantor Name"], ["grantorAddress","Grantor Address"], ["grantee","Grantee Name"], ["granteeAddress","Grantee Address"] ] as ["grantor"|"grantorAddress"|"grantee"|"granteeAddress", string][]).map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-muted-foreground block mb-1">{label}</label>
                  <input
                    value={form[k]}
                    onChange={setf(k)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}

              <div>
                <label className="text-xs text-muted-foreground block mb-1">{selectedCounty?.parcelLabel ?? "Parcel ID"} <span className="text-red-400">*</span></label>
                <input value={form.parcelId} onChange={setf("parcelId")} placeholder="Required" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tribal Tract Number</label>
                <input value={form.tractNumber} onChange={setf("tractNumber")} placeholder="MET-XXX-001" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Legal Description <span className="text-red-400">*</span></label>
                <textarea value={form.legalDescription} onChange={setf("legalDescription")} rows={4} placeholder="Full legal description of the property…" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none" />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Consideration</label>
                <input value={form.consideration} onChange={setf("consideration")} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Federal Law Reference</label>
                <input value={form.federalLawRef} onChange={setf("federalLawRef")} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tribal Code Reference</label>
                <input value={form.tribalCodeRef} onChange={setf("tribalCodeRef")} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Exemption / Tax Basis</label>
                <input value={form.exemptionBasis} onChange={setf("exemptionBasis")} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </div>

              {err && (
                <div className="col-span-2 flex items-center gap-2 text-xs text-red-400 bg-red-950/20 border border-red-700/30 rounded-md px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {err}
                </div>
              )}

              <div className="col-span-2 flex items-center gap-3 pt-2 border-t border-border">
                <button
                  onClick={() => generate(false)}
                  disabled={generating || !form.parcelId || !form.legalDescription}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {generating ? "Generating…" : "Preview Deed"}
                </button>
                <button
                  onClick={() => generate(true)}
                  disabled={generating || !form.parcelId || !form.legalDescription}
                  className="flex items-center gap-2 px-4 py-2 border border-amber-600/50 text-amber-400 hover:bg-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
                >
                  <FileArchive className="w-3.5 h-3.5" />
                  Download HTML
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "overview",      label: "Overview",              icon: BarChart3 },
  { id: "map",           label: "Map View",              icon: Map },
  { id: "parcels",       label: "Land Registry",         icon: Landmark },
  { id: "leases",        label: "Leases",                icon: FileText },
  { id: "assets",        label: "Assets & Resources",    icon: Building2 },
  { id: "deeds",         label: "Deed Repository",       icon: FileArchive },
  { id: "deed-gen",      label: "Deed Generator",        icon: Gavel },
  { id: "tax",           label: "Tax Compliance",        icon: CalendarDays },
  { id: "assignments",   label: "Member / Stewards",     icon: Users },
  { id: "encumbrances",  label: "Encumbrances",          icon: ShieldAlert },
  { id: "notices",       label: "Notices & Enforcement", icon: ScrollText },
  { id: "stewardship",   label: "Stewardship Pipeline",  icon: TrendingUp },
  { id: "templates",     label: "Document Templates",    icon: BookOpen },
];

const EMPTY_STATS: Stats = {
  totalParcels: 0, totalAcreage: 0, govAcreage: 0, trustAcreage: 0, protectedAcreage: 0,
  sacredAcreage: 0, beneficiaryAcreage: 0, restrictedAcreage: 0, activeParcels: 0,
  disputedParcels: 0, exclusiveJurisdiction: 0, contestedParcels: 0,
  totalLeases: 0, activeLeases: 0, annualRevenue: 0, expiringSoon: 0,
  pipelineCount: 0, activePipeline: 0, pipelineAcreage: 0,
  activeEncumbrances: 0, voidAbInitioCount: 0, activeNotices: 0,
};

export default function LandPage() {
  const [tab, setTab] = useState("overview");
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    qc.removeQueries({ queryKey: ["land-parcels"] });
    qc.removeQueries({ queryKey: ["land-stats"] });
  }, [qc]);

  async function q<T>(url: string): Promise<T> {
    const token = await getCurrentBearerToken();
    const r = await fetch(url, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  const statsQ = useQuery<Stats>({ queryKey: ["land-stats"], queryFn: () => q("/api/land/stats"), staleTime: 0 });
  const parcelsQ = useQuery<Parcel[]>({ queryKey: ["land-parcels"], queryFn: () => q("/api/land/parcels"), staleTime: 0 });
  const leasesQ = useQuery<Lease[]>({ queryKey: ["land-leases"], queryFn: () => q("/api/land/leases") });
  const assetsQ = useQuery<Asset[]>({ queryKey: ["land-assets"], queryFn: () => q("/api/land/assets") });
  const encQ = useQuery<Encumbrance[]>({ queryKey: ["land-encumbrances"], queryFn: () => q("/api/land/encumbrances") });
  const noticesQ = useQuery<Notice[]>({ queryKey: ["land-notices"], queryFn: () => q("/api/land/notices") });
  const pipelineQ = useQuery<StewardshipEntry[]>({ queryKey: ["land-pipeline"], queryFn: () => q("/api/land/pipeline") });
  const deedsQ = useQuery<Deed[]>({ queryKey: ["land-deeds"], queryFn: () => q("/api/land/deeds") });
  const taxQ = useQuery<TaxCompliance[]>({ queryKey: ["land-tax"], queryFn: () => q("/api/land/tax-compliance") });
  const assignQ = useQuery<MemberAssignment[]>({ queryKey: ["land-assignments"], queryFn: () => q("/api/land/assignments") });

  const refresh = useCallback((keys?: string[]) => {
    (keys ?? [
      "land-stats", "land-parcels", "land-leases", "land-assets",
      "land-encumbrances", "land-notices", "land-pipeline",
      "land-deeds", "land-tax", "land-assignments",
    ]).forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  }, [qc]);

  const loading = statsQ.isLoading || parcelsQ.isLoading;
  const stats = statsQ.data ?? EMPTY_STATS;

  return (
    <div className="max-w-6xl mx-auto space-y-5 p-6">
      <div className="border-b border-amber-700/30 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-600/20 border border-amber-600/40 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Land & Asset Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mathias El Tribe — Indigenous Governance & Stewardship Infrastructure · <span className="text-amber-500">METC Title 4 Authority</span>
            </p>
          </div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1" />}
          {(stats.activeEncumbrances > 0 || stats.contestedParcels > 0) && (
            <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-700/40 rounded px-2.5 py-1">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-300 font-medium">
                {[stats.activeEncumbrances > 0 && `${stats.activeEncumbrances} encumbrance${stats.activeEncumbrances !== 1 ? "s" : ""}`,
                  stats.contestedParcels > 0 && `${stats.contestedParcels} contested`].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-muted/30 rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const alert = (t.id === "encumbrances" && stats.activeEncumbrances > 0) || (t.id === "notices" && stats.activeNotices > 0);
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors relative ${tab === t.id ? "bg-background text-amber-400 font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {alert && <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-1.5 right-1" />}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "overview"     && <OverviewTab stats={stats} leases={leasesQ.data ?? []} />}
        {tab === "map"          && <MapTab parcels={parcelsQ.data ?? []} onSelectParcel={setSelectedParcel} />}
        {tab === "parcels"      && <ParcelsTab parcels={parcelsQ.data ?? []} assignments={assignQ.data ?? []} onRefresh={() => refresh(["land-parcels", "land-stats"])} onSelectParcel={setSelectedParcel} />}
        {tab === "leases"       && <LeasesTab leases={leasesQ.data ?? []} parcels={parcelsQ.data ?? []} onRefresh={() => refresh(["land-leases", "land-stats"])} />}
        {tab === "assets"       && <AssetsTab assets={assetsQ.data ?? []} parcels={parcelsQ.data ?? []} onRefresh={() => refresh(["land-assets"])} />}
        {tab === "deeds"        && <DeedsTab deeds={deedsQ.data ?? []} parcels={parcelsQ.data ?? []} onRefresh={() => refresh(["land-deeds"])} />}
        {tab === "tax"          && <TaxTab tax={taxQ.data ?? []} parcels={parcelsQ.data ?? []} onRefresh={() => refresh(["land-tax"])} />}
        {tab === "assignments"  && <AssignmentsTab assignments={assignQ.data ?? []} parcels={parcelsQ.data ?? []} onRefresh={() => refresh(["land-assignments"])} />}
        {tab === "encumbrances" && <EncumbrancesTab encumbrances={encQ.data ?? []} parcels={parcelsQ.data ?? []} onRefresh={() => refresh(["land-encumbrances", "land-stats"])} />}
        {tab === "notices"      && <NoticesTab notices={noticesQ.data ?? []} parcels={parcelsQ.data ?? []} onRefresh={() => refresh(["land-notices", "land-stats"])} />}
        {tab === "stewardship"  && <StewardshipTab pipeline={pipelineQ.data ?? []} onRefresh={() => refresh(["land-pipeline", "land-stats"])} />}
        {tab === "templates"    && <LandTemplatesTab />}
        {tab === "deed-gen"     && <DeedGeneratorTab />}
      </div>

      {selectedParcel && (
        <ParcelDetailDrawer
          parcel={selectedParcel}
          assignments={assignQ.data ?? []}
          leases={leasesQ.data ?? []}
          assets={assetsQ.data ?? []}
          encumbrances={encQ.data ?? []}
          deeds={deedsQ.data ?? []}
          parcels={parcelsQ.data ?? []}
          onClose={() => setSelectedParcel(null)}
          onNavigateTab={(t) => { setTab(t); setSelectedParcel(null); }}
          navigate={navigate}
          onRefresh={() => refresh(["land-assignments"])}
        />
      )}
    </div>
  );
}
