import { Layout } from "@/components/layout";
import { Scale, FileDown, Clock, CheckCircle2, AlertCircle } from "lucide-react";

const MOCK_NFRS = [
  { id: 1, title: "NFR-2026-001: Land Status Review — Encroachment Matter", status: "active", date: "2026-04-12", classification: "Restricted" },
  { id: 2, title: "NFR-2026-002: Federal Agency Action — Jurisdictional Challenge", status: "pending", date: "2026-03-28", classification: "Confidential" },
  { id: 3, title: "NFR-2025-018: Prior Doctrine Application — Welfare Act Standing", status: "closed", date: "2025-11-05", classification: "Public" },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  active: CheckCircle2,
  pending: Clock,
  closed: AlertCircle,
};

export default function NFR() {
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
          <div className="divide-y divide-card-border">
            {MOCK_NFRS.map((nfr) => {
              const StatusIcon = STATUS_ICONS[nfr.status];
              return (
                <div key={nfr.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Scale className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{nfr.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Filed {nfr.date} · {nfr.classification}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[nfr.status]}`}>
                      <StatusIcon className="w-3 h-3" />
                      {nfr.status.charAt(0).toUpperCase() + nfr.status.slice(1)}
                    </span>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-input rounded-lg hover:bg-muted transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
