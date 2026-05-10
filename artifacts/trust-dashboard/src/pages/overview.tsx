import { useQuery } from "@tanstack/react-query";
import { api, type TrustInstrument, type TrustFiling } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import {
  FolderOpen,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();

  const { data: instruments = [] } = useQuery<TrustInstrument[]>({
    queryKey: ["instruments"],
    queryFn: () => api.instruments.list(),
  });

  const { data: filings = [] } = useQuery<TrustFiling[]>({
    queryKey: ["filings"],
    queryFn: () => api.filings.list(),
  });

  const stats = {
    total: instruments.length,
    valid: instruments.filter((i) => i.status === "valid" || i.status === "filed" || i.status === "submitted").length,
    draft: instruments.filter((i) => i.status === "draft").length,
    filings: filings.length,
    pendingFilings: filings.filter((f) => f.filingStatus === "submitted").length,
    acceptedFilings: filings.filter((f) => f.filingStatus === "accepted").length,
  };

  const recentInstruments = [...instruments].reverse().slice(0, 5);
  const recentFilings = [...filings].reverse().slice(0, 5);

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Instruments" value={stats.total} icon={FolderOpen} color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" />
          <StatCard label="Valid / Filed" value={stats.valid} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" />
          <StatCard label="Total Filings" value={stats.filings} icon={FileText} color="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" />
          <StatCard label="Pending Review" value={stats.pendingFilings} icon={Clock} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
              <h2 className="text-sm font-semibold text-card-foreground">Recent Instruments</h2>
              <Link href="/instruments">
                <a className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  View all <ArrowRight className="w-3 h-3" />
                </a>
              </Link>
            </div>
            <div className="divide-y divide-card-border">
              {recentInstruments.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">No instruments yet.</p>
                  <Link href="/instruments/new">
                    <a className="mt-2 inline-block text-xs text-primary font-medium hover:underline">Create your first instrument →</a>
                  </Link>
                </div>
              ) : (
                recentInstruments.map((inst) => (
                  <Link key={inst.id} href={`/instruments/${inst.id}`}>
                    <a className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate group-hover:text-primary transition-colors">
                          {inst.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {inst.instrumentType} · {inst.state ?? "—"}
                        </p>
                      </div>
                      <StatusBadge status={inst.status} />
                    </a>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
              <h2 className="text-sm font-semibold text-card-foreground">Recent Filings</h2>
              <Link href="/filings">
                <a className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  View all <ArrowRight className="w-3 h-3" />
                </a>
              </Link>
            </div>
            <div className="divide-y divide-card-border">
              {recentFilings.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">No filings yet.</p>
                </div>
              ) : (
                recentFilings.map((filing) => (
                  <div key={filing.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate">
                        {filing.county}, {filing.state}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {filing.documentType} · Instrument #{filing.instrumentId}
                      </p>
                    </div>
                    <StatusBadge status={filing.filingStatus} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
