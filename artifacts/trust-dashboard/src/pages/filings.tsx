import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type TrustFiling } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { CheckCircle2, XCircle, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function Filings() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: filings = [], isLoading } = useQuery<TrustFiling[]>({
    queryKey: ["filings"],
    queryFn: () => api.filings.list(),
  });

  const acceptMutation = useMutation({
    mutationFn: ({ id, filingNumber }: { id: number; filingNumber?: string }) =>
      api.filings.accept(id, filingNumber),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["filings"] });
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      setActionMsg(`Filing #${updated.id} accepted.`);
    },
    onError: (e: Error) => setActionMsg(`Error: ${e.message}`),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.filings.reject(id, reason),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["filings"] });
      setRejectId(null);
      setRejectReason("");
      setActionMsg(`Filing #${updated.id} rejected.`);
    },
    onError: (e: Error) => setActionMsg(`Error: ${e.message}`),
  });

  const filtered = filings.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.county.toLowerCase().includes(q) ||
      f.state.toLowerCase().includes(q) ||
      (f.filingStatus ?? "").toLowerCase().includes(q) ||
      (f.documentType ?? "").toLowerCase().includes(q) ||
      (f.filingNumber ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">County Filings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filings.length} filing{filings.length !== 1 ? "s" : ""} on record
            </p>
          </div>
        </div>

        {actionMsg && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {actionMsg}
            <button onClick={() => setActionMsg("")} className="ml-auto text-xs underline">Dismiss</button>
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-card-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by county, state, status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="px-5 py-12 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Loading filings…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-foreground">
                {search ? "No filings match your search." : "No filings yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filing #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Instrument</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">County / State</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Land Class</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filed</th>
                    {hasRole("officer") && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {filtered.map((filing) => (
                    <>
                      <tr key={filing.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {filing.filingNumber ?? <span className="italic text-muted-foreground/60">Pending</span>}
                        </td>
                        <td className="px-4 py-3">
                          {filing.instrumentId ? (
                            <Link href={`/instruments/${filing.instrumentId}`}>
                              <a className="text-primary hover:underline text-xs">#{filing.instrumentId}</a>
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium whitespace-nowrap">
                          {filing.county}, {filing.state}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize text-xs whitespace-nowrap">
                          {(filing.documentType ?? "—").replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {filing.landClassification ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={filing.filingStatus} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {filing.submittedAt
                            ? format(new Date(filing.submittedAt), "MMM d, yyyy")
                            : format(new Date(filing.createdAt), "MMM d, yyyy")}
                        </td>
                        {hasRole("officer") && (
                          <td className="px-4 py-3 text-right">
                            {filing.filingStatus === "submitted" && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => acceptMutation.mutate({ id: filing.id })}
                                  disabled={acceptMutation.isPending}
                                  className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                                  title="Accept"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                                </button>
                                <button
                                  onClick={() => setRejectId(filing.id)}
                                  className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
                                  title="Reject"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                      {rejectId === filing.id && (
                        <tr key={`reject-${filing.id}`} className="bg-red-50/50 dark:bg-red-900/10">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <input
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Reason for rejection…"
                                className="flex-1 px-3 py-1.5 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                              <button
                                onClick={() => rejectMutation.mutate({ id: filing.id, reason: rejectReason })}
                                disabled={rejectMutation.isPending}
                                className="px-3 py-1.5 text-xs font-semibold bg-destructive text-destructive-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                              >
                                Confirm Reject
                              </button>
                              <button
                                onClick={() => { setRejectId(null); setRejectReason(""); }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
