import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CreateInstrumentPayload, type CreateInstrumentResult, getAuthToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wand2,
  Search,
  User,
  ChevronRight,
  Loader2,
  Building2,
  TreePine,
  Scroll,
  Scale,
  RefreshCw,
  X,
} from "lucide-react";

const GUIDED_TYPES = [
  {
    value: "trust_instrument",
    label: "Trust Instrument",
    desc: "Establishes a trust for tribal land or assets under sovereign authority.",
    icon: Scale,
  },
  {
    value: "land_trust",
    label: "Land Trust",
    desc: "Places land into trust status, activating federal and tribal protections.",
    icon: TreePine,
  },
  {
    value: "tribal_trust",
    label: "Tribal Trust Instrument",
    desc: "Full tribal sovereign trust under Mathias El Tribe jurisdiction.",
    icon: Building2,
  },
  {
    value: "deed_of_trust",
    label: "Deed of Trust",
    desc: "Security interest in land with trust status and recorder-compliant formatting.",
    icon: Scroll,
  },
];

const ALL_INSTRUMENT_TYPES = [
  { value: "will_and_trust", label: "Will & Trust Instrument" },
  { value: "trust_instrument", label: "Trust Instrument" },
  { value: "deed_of_trust", label: "Deed of Trust" },
  { value: "land_trust", label: "Land Trust" },
  { value: "tribal_trust", label: "Tribal Trust Instrument" },
  { value: "warranty_deed", label: "Warranty Deed" },
  { value: "quitclaim_deed", label: "Quitclaim Deed" },
  { value: "easement", label: "Easement" },
];

const US_STATES = [
  "AK","AL","AR","AZ","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL",
  "IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE",
  "NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VA","VT","WA","WI","WV","WY",
];

interface DirectoryMember {
  id: number;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  tribalNation: string | null;
  membershipStatus: string | null;
  trustBeneficiary: boolean | null;
  icwaEligible: boolean | null;
  isDeceased: boolean | null;
  generationalPosition: string | null;
}

function deriveJurisdiction(member: DirectoryMember): string {
  const nation = member.tribalNation?.trim();
  if (nation) return `${nation}, under Sovereign Tribal Authority — Mathias El Tribe`;
  return "Mathias El Tribe Sovereign Territory, under Inherent Tribal Jurisdiction";
}

function deriveLandClassification(member: DirectoryMember): string {
  if (member.trustBeneficiary) return "Indian Trust Land";
  if (member.icwaEligible) return "Indian Allotment — ICWA Protected";
  return "Indian Allotment / Potential Trust Land";
}

function deriveLandDescription(member: DirectoryMember, instrumentType: string): string {
  const name = member.fullName ?? [member.firstName, member.lastName].filter(Boolean).join(" ");
  const nation = member.tribalNation ? `, tribal nation: ${member.tribalNation}` : "";
  const typeLabel = ALL_INSTRUMENT_TYPES.find((t) => t.value === instrumentType)?.label ?? instrumentType;
  return `Land and assets associated with ${name}${nation}, subject to tribal trust status and sovereign authority of the Mathias El Tribe. Instrument type: ${typeLabel}. All interests subject to Indian Land Protection and Federal Preemption Doctrine.`;
}

function deriveTitle(member: DirectoryMember, instrumentType: string): string {
  const typeLabel =
    GUIDED_TYPES.find((t) => t.value === instrumentType)?.label ??
    ALL_INSTRUMENT_TYPES.find((t) => t.value === instrumentType)?.label ??
    instrumentType;
  const name = member.fullName ?? [member.firstName, member.lastName].filter(Boolean).join(" ");
  return `${typeLabel} — ${name}`;
}

export default function CreateInstrument() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [mode, setMode] = useState<"guided" | "manual" | "template">("guided");

  const [guidedStep, setGuidedStep] = useState<1 | 2 | 3>(1);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<DirectoryMember | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [guidedNotes, setGuidedNotes] = useState("");

  const [form, setForm] = useState({
    type: "trust_instrument",
    title: "",
    parties: ["", ""],
    landDescription: "",
    jurisdiction: "",
    state: "",
    county: "",
    landClassification: "Indian Trust Land",
    indianLandProtection: true,
    trustStatus: false,
    federalPreemption: true,
    tribalJurisdiction: false,
    requiresNotary: true,
    trusteeNotes: "",
    apn: "",
  });

  const [templateKey, setTemplateKey] = useState("");

  const { data: templatesData } = useQuery<{ templates: string[] }>({
    queryKey: ["templates"],
    queryFn: () => api.instruments.templates(),
    enabled: mode === "template",
  });

  const { data: memberResults, isFetching: isSearching } = useQuery<DirectoryMember[]>({
    queryKey: ["directory-search", memberSearch],
    queryFn: async () => {
      if (!memberSearch.trim() || memberSearch.trim().length < 2) return [];
      const token = getAuthToken();
      const res = await fetch(`/api/community/directory?q=${encodeURIComponent(memberSearch.trim())}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      const data = await res.json() as DirectoryMember[];
      return data.filter((m) => !m.isDeceased).slice(0, 12);
    },
    enabled: memberSearch.trim().length >= 2,
    staleTime: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateInstrumentPayload) => api.instruments.create(payload),
    onSuccess: (result: CreateInstrumentResult) => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      navigate(`/instruments/${result.instrument.id}`);
    },
  });

  function handleGuidedSubmit() {
    if (!selectedMember || !selectedType) return;
    const memberName =
      selectedMember.fullName ??
      [selectedMember.firstName, selectedMember.lastName].filter(Boolean).join(" ");
    const payload: CreateInstrumentPayload = {
      type: selectedType,
      title: deriveTitle(selectedMember, selectedType),
      parties: [memberName, "Mathias El Tribe, A Sovereign Nation"],
      landDescription: deriveLandDescription(selectedMember, selectedType),
      jurisdiction: deriveJurisdiction(selectedMember),
      indianLandProtection: true,
      trustStatus: !!selectedMember.trustBeneficiary,
      federalPreemption: true,
      tribalJurisdiction: true,
      trusteeNotes: guidedNotes || undefined,
      recorderMetadata: {
        landClassification: deriveLandClassification(selectedMember),
        documentType: selectedType,
        requiresNotary: true,
      },
    };
    createMutation.mutate(payload);
  }

  function handleChange(field: keyof typeof form, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handlePartyChange(idx: number, value: string) {
    setForm((prev) => {
      const parties = [...prev.parties];
      parties[idx] = value;
      return { ...prev, parties };
    });
  }

  function handleManualOrTemplateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "template") {
      if (!templateKey) return;
      createMutation.mutate({
        templateKey,
        state: form.state,
        recorderMetadata: {
          county: form.county,
          state: form.state,
          requiresNotary: form.requiresNotary,
          landClassification: form.landClassification,
          apn: form.apn || undefined,
        },
      });
    } else {
      const parties = form.parties.filter((p) => p.trim());
      if (!form.type || parties.length === 0 || !form.landDescription || !form.jurisdiction) return;
      createMutation.mutate({
        type: form.type,
        title: form.title || undefined,
        parties,
        landDescription: form.landDescription,
        jurisdiction: form.jurisdiction,
        indianLandProtection: form.indianLandProtection,
        trustStatus: form.trustStatus,
        federalPreemption: form.federalPreemption,
        tribalJurisdiction: form.tribalJurisdiction,
        trusteeNotes: form.trusteeNotes || undefined,
        state: form.state || undefined,
        recorderMetadata: {
          county: form.county || undefined,
          state: form.state || undefined,
          requiresNotary: form.requiresNotary,
          landClassification: form.landClassification || undefined,
          apn: form.apn || undefined,
        },
      });
    }
  }

  if (!hasRole("trustee")) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">You need Trustee access to create instruments.</p>
          <Link href="/instruments" className="text-sm text-primary hover:underline mt-2 inline-block">← Back</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/instruments" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Instruments
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-foreground font-medium">New Instrument</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Create Trust Instrument</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generates a recorder-compliant instrument with PDF output.
          </p>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg w-fit">
          {[
            { key: "guided", label: "Guided", icon: Search },
            { key: "manual", label: "Manual Entry", icon: FileText },
            { key: "template", label: "From Template", icon: Wand2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key as typeof mode)}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {createMutation.error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {(createMutation.error as Error).message}
          </div>
        )}

        {/* ── GUIDED MODE ───────────────────────────────────────────────── */}
        {mode === "guided" && (
          <div className="space-y-4">
            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-2">
              {[
                { n: 1, label: "Find Person" },
                { n: 2, label: "Select Type" },
                { n: 3, label: "Review & Generate" },
              ].map(({ n, label }, i) => (
                <div key={n} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2 ${
                      guidedStep === n
                        ? "text-primary"
                        : guidedStep > n
                        ? "text-emerald-600"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        guidedStep > n
                          ? "bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30"
                          : guidedStep === n
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-muted-foreground/20 text-muted-foreground/40"
                      }`}
                    >
                      {guidedStep > n ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
                    </div>
                    <span className="text-xs font-medium hidden sm:block">{label}</span>
                  </div>
                  {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground/20 shrink-0" />}
                </div>
              ))}
            </div>

            {/* Step 1 — Member Search */}
            {guidedStep === 1 && (
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h2 className="text-sm font-semibold mb-0.5">Who is this instrument for?</h2>
                  <p className="text-xs text-muted-foreground">
                    Search by name — the system pulls their tribal record automatically.
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => {
                      setMemberSearch(e.target.value);
                      setSelectedMember(null);
                    }}
                    placeholder="Type a name to search tribal family records…"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                </div>

                {memberSearch.trim().length >= 2 && memberResults !== undefined && (
                  <div className="border border-card-border rounded-lg overflow-hidden">
                    {memberResults.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No records found for &ldquo;{memberSearch}&rdquo; — try a different spelling or use{" "}
                        <button type="button" onClick={() => setMode("manual")} className="text-primary hover:underline">
                          Manual Entry
                        </button>
                        .
                      </div>
                    ) : (
                      <div className="divide-y divide-card-border max-h-64 overflow-auto">
                        {memberResults.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMember(m);
                              setMemberSearch(m.fullName ?? "");
                              setGuidedStep(2);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{m.fullName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {m.tribalNation ?? "Tribal Member"}
                                {m.membershipStatus ? ` · ${m.membershipStatus}` : ""}
                                {m.trustBeneficiary ? " · Trust Beneficiary" : ""}
                                {m.icwaEligible ? " · ICWA Eligible" : ""}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {memberSearch.trim().length < 2 && (
                  <p className="text-xs text-muted-foreground/50 italic text-center py-2">
                    Type at least 2 characters to search tribal records
                  </p>
                )}

                <div className="pt-1 border-t border-card-border">
                  <p className="text-xs text-muted-foreground">
                    Person not in records?{" "}
                    <button type="button" onClick={() => setMode("manual")} className="text-primary hover:underline">
                      Switch to Manual Entry
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2 — Select instrument type */}
            {guidedStep === 2 && selectedMember && (
              <div className="space-y-4">
                <div className="bg-muted/40 border border-card-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{selectedMember.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedMember.tribalNation ?? "Mathias El Tribe"}
                      {selectedMember.trustBeneficiary ? " · Trust Beneficiary" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMember(null);
                      setMemberSearch("");
                      setGuidedStep(1);
                    }}
                    className="text-muted-foreground hover:text-foreground p-1 rounded"
                    title="Change person"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold mb-0.5">What type of instrument?</h2>
                    <p className="text-xs text-muted-foreground">Choose the instrument that best fits this situation.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {GUIDED_TYPES.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => {
                            setSelectedType(t.value);
                            setGuidedStep(3);
                          }}
                          className="flex flex-col gap-2 p-4 rounded-xl border text-left transition-all hover:shadow-sm border-card-border hover:border-primary/40 hover:bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="text-sm font-semibold text-foreground">{t.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Review & Generate */}
            {guidedStep === 3 && selectedMember && selectedType && (
              <div className="space-y-4">
                <div className="bg-muted/40 border border-card-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{selectedMember.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {GUIDED_TYPES.find((t) => t.value === selectedType)?.label}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuidedStep(2)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded"
                    title="Change selection"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold mb-0.5">Auto-generated instrument details</h2>
                    <p className="text-xs text-muted-foreground">
                      Derived from the tribal record. No additional input required.
                    </p>
                  </div>

                  <div className="space-y-2.5 bg-muted/30 rounded-lg p-4">
                    {[
                      {
                        label: "Document Title",
                        value: deriveTitle(selectedMember, selectedType),
                      },
                      {
                        label: "Grantor",
                        value:
                          selectedMember.fullName ??
                          [selectedMember.firstName, selectedMember.lastName].filter(Boolean).join(" "),
                      },
                      {
                        label: "Trustee / Beneficiary",
                        value: "Mathias El Tribe, A Sovereign Nation",
                      },
                      {
                        label: "Jurisdiction",
                        value: deriveJurisdiction(selectedMember),
                      },
                      {
                        label: "Land Classification",
                        value: deriveLandClassification(selectedMember),
                      },
                      {
                        label: "Active Protections",
                        value: [
                          "Indian Land Protection",
                          "Federal Preemption",
                          "Tribal Jurisdiction",
                          selectedMember.icwaEligible ? "ICWA Protection" : null,
                          selectedMember.trustBeneficiary ? "Trust Beneficiary Status" : null,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="grid grid-cols-5 gap-2 text-xs">
                        <span className="col-span-2 font-medium text-muted-foreground">{label}</span>
                        <span className="col-span-3 text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1">
                    <label className="block text-xs font-medium mb-1.5">Trustee Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <textarea
                      value={guidedNotes}
                      onChange={(e) => setGuidedNotes(e.target.value)}
                      placeholder="Any additional context for this instrument…"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleGuidedSubmit}
                    disabled={createMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Generating…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Generate Trust Instrument
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuidedStep(2)}
                    className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MANUAL MODE ───────────────────────────────────────────────── */}
        {mode === "manual" && (
          <form onSubmit={handleManualOrTemplateSubmit} className="space-y-5">
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold">Instrument Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Instrument Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => handleChange("type", e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ALL_INSTRUMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Title (optional)</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Grantor (Party 1) *</label>
                <input
                  type="text"
                  value={form.parties[0]}
                  onChange={(e) => handlePartyChange(0, e.target.value)}
                  placeholder="Full legal name of grantor"
                  required
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Additional Parties (optional)</label>
                <input
                  type="text"
                  value={form.parties[1]}
                  onChange={(e) => handlePartyChange(1, e.target.value)}
                  placeholder="Co-grantor, beneficiary, etc."
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Land Description *</label>
                <textarea
                  value={form.landDescription}
                  onChange={(e) => handleChange("landDescription", e.target.value)}
                  placeholder="Legal description of the land parcel…"
                  required
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Jurisdiction *</label>
                <input
                  type="text"
                  value={form.jurisdiction}
                  onChange={(e) => handleChange("jurisdiction", e.target.value)}
                  placeholder="e.g. Maricopa County, Arizona"
                  required
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Trustee Notes (optional)</label>
                <textarea
                  value={form.trusteeNotes}
                  onChange={(e) => handleChange("trusteeNotes", e.target.value)}
                  placeholder="Internal notes for the trustee record…"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { field: "indianLandProtection", label: "Indian Land Protection" },
                  { field: "federalPreemption", label: "Federal Preemption" },
                  { field: "tribalJurisdiction", label: "Tribal Jurisdiction" },
                  { field: "trustStatus", label: "Trust Status" },
                  { field: "requiresNotary", label: "Requires Notary" },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[field as keyof typeof form] as boolean}
                      onChange={(e) => handleChange(field as keyof typeof form, e.target.checked)}
                      className="rounded border-input text-primary focus:ring-ring"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recorder Information</h2>
                <span className="text-xs text-muted-foreground">All fields optional</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">State</label>
                  <select
                    value={form.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select state…</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">County</label>
                  <input
                    type="text"
                    value={form.county}
                    onChange={(e) => handleChange("county", e.target.value)}
                    placeholder="e.g. Maricopa"
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">APN</label>
                  <input
                    type="text"
                    value={form.apn}
                    onChange={(e) => handleChange("apn", e.target.value)}
                    placeholder="Assessor Parcel Number"
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Land Classification</label>
                <input
                  type="text"
                  value={form.landClassification}
                  onChange={(e) => handleChange("landClassification", e.target.value)}
                  placeholder="e.g. Indian Trust Land"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Create &amp; Generate PDF</>
                )}
              </button>
              <Link href="/instruments" className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </Link>
            </div>
          </form>
        )}

        {/* ── TEMPLATE MODE ─────────────────────────────────────────────── */}
        {mode === "template" && (
          <form onSubmit={handleManualOrTemplateSubmit} className="space-y-5">
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold">Select Template</h2>
              {!templatesData?.templates?.length ? (
                <p className="text-sm text-muted-foreground">No templates available.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {templatesData.templates.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTemplateKey(t)}
                      className={`p-3 text-left text-sm rounded-lg border transition-colors ${
                        templateKey === t
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-card-border hover:border-primary/50 text-muted-foreground"
                      }`}
                    >
                      <span className="font-medium capitalize">{t.replace(/_/g, " ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {templateKey && (
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Recorder Information</h2>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">State</label>
                    <select
                      value={form.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select state…</option>
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">County</label>
                    <input
                      type="text"
                      value={form.county}
                      onChange={(e) => handleChange("county", e.target.value)}
                      placeholder="e.g. Maricopa"
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending || !templateKey}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Generate from Template</>
                )}
              </button>
              <Link href="/instruments" className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
