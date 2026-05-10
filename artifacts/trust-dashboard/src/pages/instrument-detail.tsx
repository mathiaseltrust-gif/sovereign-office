import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type TrustInstrument, type TrustFiling } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { Layout } from "@/components/layout";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  FileDown,
  FilePlus,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  FileText,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-card-border">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground font-medium">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5">{value || <span className="text-muted-foreground italic">—</span>}</dd>
    </div>
  );
}

export default function InstrumentDetail() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [fileCounty, setFileCounty] = useState("");
  const [fileState, setFileState] = useState("");
  const [fileNotes, setFileNotes] = useState("");
  const [showFileForm, setShowFileForm] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const { data: inst, isLoading, error } = useQuery<TrustInstrument>({
    queryKey: ["instrument", numId],
    queryFn: () => api.instruments.get(numId),
    enabled: !!numId,
  });

  const { data: filings = [] } = useQuery<TrustFiling[]>({
    queryKey: ["instrument-filings", numId],
    queryFn: () => api.instruments.filings(numId),
    enabled: !!numId,
  });

  const generatePdf = useMutation({
    mutationFn: () => api.instruments.generatePdf(numId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instrument", numId] });
      setActionMsg("PDF generated successfully.");
    },
    onError: (e: Error) => setActionMsg(`Error: ${e.message}`),
  });

  const fileMutation = useMutation({
    mutationFn: () =>
      api.instruments.file(numId, { county: fileCounty, state: fileState, notes: fileNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instrument", numId] });
      queryClient.invalidateQueries({ queryKey: ["instrument-filings", numId] });
      queryClient.invalidateQueries({ queryKey: ["filings"] });
      setShowFileForm(false);
      setFileCounty("");
      setFileState("");
      setFileNotes("");
      setActionMsg("Filed to county recorder's office.");
    },
    onError: (e: Error) => setActionMsg(`Error: ${e.message}`),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.instruments.submit(numId, { county: inst?.county ?? "", state: inst?.state ?? "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instrument", numId] });
      queryClient.invalidateQueries({ queryKey: ["instrument-filings", numId] });
      setActionMsg("Instrument submitted to recorder.");
    },
    onError: (e: Error) => setActionMsg(`Error: ${e.message}`),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !inst) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-destructive font-medium">Instrument not found.</p>
          <Link href="/instruments">
            <a className="mt-2 text-sm text-primary hover:underline">← Back to instruments</a>
          </Link>
        </div>
      </Layout>
    );
  }

  const parties = inst.partiesJson as Record<string, string> ?? {};
  const land = inst.landJson as Record<string, string> ?? {};
  const recorderMeta = inst.recorderMetadata as Record<string, string> ?? {};
  const errors = (inst.validationErrors as string[]) ?? [];

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/instruments">
            <a className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Instruments
            </a>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-foreground font-medium truncate">{inst.title}</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">{inst.title}</h1>
            <p className="text-sm text-muted-foreground mt-1 capitalize">
              {inst.instrumentType.replace(/_/g, " ")} · #{inst.id}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={inst.status} className="text-sm px-3 py-1" />

            {hasRole("trustee") && (
              <>
                {inst.pdfUrl ? (
                  <button
                    onClick={async () => {
                      try {
                        await api.downloadPdf(`/trust/instruments/${inst.id}/pdf`, `instrument-${inst.id}.pdf`);
                      } catch (e) {
                        setActionMsg(String(e));
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card border border-card-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Download PDF
                  </button>
                ) : (
                  <button
                    onClick={() => generatePdf.mutate()}
                    disabled={generatePdf.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card border border-card-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generatePdf.isPending ? "animate-spin" : ""}`} />
                    Generate PDF
                  </button>
                )}

                <button
                  onClick={() => setShowFileForm(!showFileForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card border border-card-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <FilePlus className="w-3.5 h-3.5" /> File to County
                </button>

                {inst.pdfUrl && inst.county && inst.state && (
                  <button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitMutation.isPending ? "Submitting…" : "Submit to Recorder"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {actionMsg && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {actionMsg}
            <button onClick={() => setActionMsg("")} className="ml-auto text-xs underline">Dismiss</button>
          </div>
        )}

        {showFileForm && (
          <div className="mb-4 bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-3">File to County Recorder</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1">County *</label>
                <input
                  value={fileCounty}
                  onChange={(e) => setFileCounty(e.target.value)}
                  placeholder={inst.county ?? "e.g. Maricopa"}
                  className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">State *</label>
                <input
                  value={fileState}
                  onChange={(e) => setFileState(e.target.value)}
                  placeholder={inst.state ?? "e.g. AZ"}
                  className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1">Notes (optional)</label>
              <input
                value={fileNotes}
                onChange={(e) => setFileNotes(e.target.value)}
                placeholder="Additional notes for the recorder…"
                className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileMutation.mutate()}
                disabled={fileMutation.isPending || !fileCounty || !fileState}
                className="px-4 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {fileMutation.isPending ? "Filing…" : "File Instrument"}
              </button>
              <button onClick={() => setShowFileForm(false)} className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-900">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">Validation Issues</p>
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {errors.map((err, i) => (
                <li key={i} className="text-xs text-amber-700 dark:text-amber-500">{String(err)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Section title="Parties" icon={Users}>
              {Object.keys(parties).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No parties recorded.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-3">
                  {Object.entries(parties).map(([k, v]) => (
                    <Field key={k} label={k} value={v} />
                  ))}
                </dl>
              )}
            </Section>

            <Section title="Land Description" icon={MapPin}>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Classification" value={inst.landClassification} />
                <Field label="Jurisdiction" value={inst.jurisdiction} />
                <Field label="State" value={inst.state} />
                <Field label="County" value={inst.county} />
                {Object.entries(land).map(([k, v]) =>
                  !["classification", "jurisdiction", "state", "county"].includes(k.toLowerCase()) ? (
                    <Field key={k} label={k.replace(/([A-Z])/g, " $1").trim()} value={String(v)} />
                  ) : null,
                )}
              </dl>
            </Section>

            <Section title="Recorder Metadata" icon={Info}>
              {Object.keys(recorderMeta).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No recorder metadata.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-3">
                  {Object.entries(recorderMeta).map(([k, v]) => (
                    <Field key={k} label={k.replace(/([A-Z])/g, " $1").trim()} value={typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)} />
                  ))}
                </dl>
              )}
            </Section>

            {inst.trusteeNotes && (
              <Section title="Trustee Notes" icon={FileText}>
                <p className="text-sm text-foreground whitespace-pre-wrap">{inst.trusteeNotes}</p>
              </Section>
            )}

            <Section title="Instrument Content" icon={FileText}>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                {inst.content}
              </pre>
            </Section>
          </div>

          <div className="space-y-4">
            <Section title="Record Info" icon={Clock}>
              <dl className="space-y-3">
                <Field label="Instrument ID" value={`#${inst.id}`} />
                <Field label="Created" value={format(new Date(inst.createdAt), "PPp")} />
                <Field label="Last Updated" value={format(new Date(inst.updatedAt), "PPp")} />
                <Field label="Status" value={inst.status} />
              </dl>
            </Section>

            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-card-border">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-card-foreground">Filings ({filings.length})</h2>
              </div>
              <div className="divide-y divide-card-border">
                {filings.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-xs text-muted-foreground">No filings yet.</p>
                  </div>
                ) : (
                  filings.map((f) => (
                    <div key={f.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {f.county}, {f.state}
                          </p>
                          {f.filingNumber && (
                            <p className="text-xs text-muted-foreground">#{f.filingNumber}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(f.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <StatusBadge status={f.filingStatus} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
