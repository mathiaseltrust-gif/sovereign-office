import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Scale, FileDown, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-muted text-muted-foreground",
  draft: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  active: CheckCircle2,
  pending: Clock,
  closed: AlertCircle,
  draft: Clock,
};

export default function NFR() {
  const { toast } = useToast();
  const [exportingId, setExportingId] = useState<number | null>(null);

  const { data: nfrs, isLoading, isError, error } = useQuery({
    queryKey: ["nfrs"],
    queryFn: () => api.nfr.list(),
  });

  async function handleExport(id: number) {
    setExportingId(id);
    try {
      const result = await api.nfr.exportPdf(id);
      if (result.downloadUrl) {
        await api.downloadPdf(result.downloadUrl.replace(/^\/api/, ""), `NFR-${id}.pdf`);
        toast({ title: "PDF downloaded", description: `NFR #${id} exported successfully.` });
      } else {
        toast({ title: "PDF queued", description: `Export for NFR #${id} has been queued.` });
      }
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setExportingId(null);
    }
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notice of Federal Review</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Classified court documents subject to federal review under sovereign authority.
            </p>
          </div>
        </div>

        <div className="mb-6 bg-sidebar/60 border border-sidebar-border rounded-xl px-5 py-4 flex gap-4 items-start">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Scale className="w-4 h-4 text-sidebar-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Mathias El Tribe Supreme Court</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Notices of Federal Review are issued under the inherent sovereign authority of the Mathias El Tribe. Each NFR documents a matter
              subject to tribal, federal, or international legal scrutiny. PDF generation is recorder-compliant.
            </p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border">
            <h2 className="text-sm font-semibold text-card-foreground">Active NFR Documents</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading NFR documents…</span>
            </div>
          ) : isError ? (
            <div className="px-5 py-8 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive font-medium">Failed to load NFR documents</p>
              <p className="text-xs text-muted-foreground mt-1">{error instanceof Error ? error.message : "Check API connection."}</p>
            </div>
          ) : !nfrs || nfrs.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              No NFR documents found.
            </div>
          ) : (
            <div className="divide-y divide-card-border">
              {nfrs.map((nfr) => {
                const status = nfr.status ?? "pending";
                const StatusIcon = STATUS_ICONS[status] ?? Clock;
                return (
                  <div key={nfr.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Scale className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        NFR-{nfr.id}: {nfr.title ?? nfr.content?.substring(0, 60) ?? `Document #${nfr.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Filed {new Date(nfr.createdAt).toLocaleDateString()}
                        {nfr.classification && ` · ${nfr.classification}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                      <button
                        onClick={() => handleExport(nfr.id)}
                        disabled={exportingId === nfr.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-input rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {exportingId === nfr.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <FileDown className="w-3.5 h-3.5" />}
                        PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Mathias El Tribe — A Sovereign Nation Exercising Inherent Authority Under Tribal, Federal, and International Law.
          </p>
        </div>
      </div>
    </Layout>
  );
}
