import { useQuery } from "@tanstack/react-query";
import { api, type TrustInstrument } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { Plus, Search, FolderOpen, FileDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { getRoleConfig } from "@/lib/role-config";

export default function Instruments() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const config = getRoleConfig(user?.roles ?? []);

  const { data: instruments = [], isLoading } = useQuery<TrustInstrument[]>({
    queryKey: ["instruments"],
    queryFn: () => api.instruments.list(),
  });

  const filtered = instruments.filter((inst) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inst.title.toLowerCase().includes(q) ||
      inst.instrumentType.toLowerCase().includes(q) ||
      (inst.state ?? "").toLowerCase().includes(q) ||
      (inst.county ?? "").toLowerCase().includes(q) ||
      (inst.landClassification ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trust Instruments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {instruments.length} instrument{instruments.length !== 1 ? "s" : ""} on record
            </p>
          </div>
          {config.canCreateInstrument && (
            <Link
              href="/instruments/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Instrument
            </Link>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-card-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by title, type, state, county…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="px-5 py-12 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Loading instruments…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-foreground">
                {search ? "No instruments match your search." : "No instruments yet."}
              </p>
              {!search && config.canCreateInstrument && (
                <Link
                  href="/instruments/new"
                  className="mt-2 inline-block text-sm text-primary font-medium hover:underline"
                >
                  Create your first instrument →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">State / County</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classification</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">PDF</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {filtered.map((inst) => (
                    <tr key={inst.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/instruments/${inst.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                        >
                          {inst.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize whitespace-nowrap">
                        {inst.instrumentType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {[inst.county, inst.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {inst.landClassification ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {format(new Date(inst.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inst.pdfUrl && (
                          <button
                            onClick={async () => {
                              try {
                                await api.downloadPdf(
                                  `/trust/instruments/${inst.id}/pdf`,
                                  `instrument-${inst.id}.pdf`,
                                );
                              } catch (err) {
                                alert(String(err));
                              }
                            }}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            title="Download PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/instruments/${inst.id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
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
