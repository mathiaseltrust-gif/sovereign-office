import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CreateInstrumentPayload, type CreateInstrumentResult } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wand2,
} from "lucide-react";

const INSTRUMENT_TYPES = [
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

export default function CreateInstrument() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [mode, setMode] = useState<"manual" | "template">("manual");
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
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateInstrumentPayload) => api.instruments.create(payload),
    onSuccess: (result: CreateInstrumentResult) => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      navigate(`/instruments/${result.instrument.id}`);
    },
  });

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

  function handleSubmit(e: React.FormEvent) {
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

      const payload: CreateInstrumentPayload = {
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
      };
      createMutation.mutate(payload);
    }
  }

  if (!hasRole("trustee")) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">You need Trustee access to create instruments.</p>
          <Link href="/instruments">
            <a className="text-sm text-primary hover:underline mt-2 inline-block">← Back</a>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/instruments">
            <a className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Instruments
            </a>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-foreground font-medium">New Instrument</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Create Trust Instrument</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a recorder-compliant trust instrument with PDF output.
          </p>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === "manual"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4" /> Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setMode("template")}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === "template"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wand2 className="w-4 h-4" /> From Template
          </button>
        </div>

        {createMutation.error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-900 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {(createMutation.error as Error).message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === "template" ? (
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold mb-4">Select Template</h2>
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
          ) : (
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
                    {INSTRUMENT_TYPES.map((t) => (
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
          )}

          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold">Recorder Information</h2>
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
                <label className="block text-xs font-medium mb-1.5">APN (optional)</label>
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
              disabled={createMutation.isPending || (mode === "template" && !templateKey)}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {createMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Create &amp; Generate PDF
                </>
              )}
            </button>
            <Link href="/instruments">
              <a className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </a>
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
