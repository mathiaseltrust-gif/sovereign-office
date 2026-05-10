import { useQuery } from "@tanstack/react-query";
import { api, type TrustInstrument, type TrustFiling } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getRoleConfig, ELDER_ROLES } from "@/lib/role-config";
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
  Star,
  Shield,
  TreePine,
  BookOpen,
  Globe,
  Heart,
  Building2,
  Scale,
  UserCircle,
  ChevronRight,
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

function WhatNextPanel({ items }: { items: Array<{ title: string; description: string }> }) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm">
      <div className="px-5 py-4 border-b border-card-border">
        <h2 className="text-sm font-semibold text-card-foreground">What's Next</h2>
      </div>
      <div className="divide-y divide-card-border">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3 px-5 py-4">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-card-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElderOverview({ name, roleLabel, whatNext }: {
  name: string;
  roleLabel: string;
  whatNext: Array<{ title: string; description: string }>;
}) {
  const authorities = [
    { icon: Star, label: "Cultural Authority", desc: "Recognized authority over tribal cultural matters and ceremonies." },
    { icon: Shield, label: "Elder Protections", desc: "Full elder protections under tribal law, including advisory immunity." },
    { icon: TreePine, label: "Family Governance Authority", desc: "Authority to govern family matters and resolve intra-family disputes." },
    { icon: BookOpen, label: "Lineage Correction Authority", desc: "Recognized right to correct and certify lineage records." },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">Elder Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome, <span className="font-medium text-foreground">{name}</span> — {roleLabel}
        </p>
      </div>

      <div className="bg-sidebar rounded-xl px-6 py-5 border border-sidebar-border">
        <p className="text-xs font-semibold text-sidebar-primary uppercase tracking-widest mb-1">Your Standing</p>
        <p className="text-base font-bold text-sidebar-foreground">{roleLabel}</p>
        <p className="text-xs text-sidebar-foreground/60 mt-1 leading-relaxed">
          As an Elder of the Mathias El Tribe, you hold cultural, advisory, and governance authority recognized under tribal law.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {authorities.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-sidebar-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <WhatNextPanel items={whatNext} />
    </div>
  );
}

function MemberOverview({ name, roleLabel, roleSubtitle, whatNext, panels }: {
  name: string;
  roleLabel: string;
  roleSubtitle: string;
  whatNext: Array<{ title: string; description: string }>;
  panels: string[];
}) {
  const panelIcons: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string; href: string }> = {
    "niac-panel": { icon: Globe, color: "bg-blue-100 text-blue-700", label: "NIAC Panel", href: "/niac" },
    "charitable-panel": { icon: Heart, color: "bg-rose-100 text-rose-700", label: "Charitable Trust", href: "/charitable-trust" },
    "iee-panel": { icon: Building2, color: "bg-emerald-100 text-emerald-700", label: "I.E.E. Panel", href: "/iee" },
    "family-panel": { icon: TreePine, color: "bg-amber-100 text-amber-700", label: "Family Governance", href: "/family-governance" },
    "provider-welcome": { icon: UserCircle, color: "bg-teal-100 text-teal-700", label: "Medical Records", href: "/medical-records" },
  };

  const specialPanels = panels.filter((p) => panelIcons[p]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Member Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome, <span className="font-medium text-foreground">{name}</span>
        </p>
      </div>

      <div className="bg-sidebar rounded-xl px-6 py-5 border border-sidebar-border">
        <p className="text-xs font-semibold text-sidebar-primary uppercase tracking-widest mb-1">Your Role</p>
        <p className="text-base font-bold text-sidebar-foreground">{roleLabel}</p>
        <p className="text-xs text-sidebar-foreground/60 mt-1">{roleSubtitle}</p>
      </div>

      {specialPanels.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {specialPanels.map((p) => {
            const { icon: Icon, color, label, href } = panelIcons[p];
            return (
              <Link
                key={p}
                href={href}
                className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex items-center gap-3 hover:border-primary/40 transition-colors group"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex-1">{label}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            );
          })}
        </div>
      )}

      <WhatNextPanel items={whatNext} />
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const config = getRoleConfig(roles);
  const isElder = roles.some((r) => ELDER_ROLES.has(r));
  const isHighAccess = ["chief_justice", "sovereign_admin", "trustee", "officer"].some((r) => roles.includes(r));

  const { data: instruments = [] } = useQuery<TrustInstrument[]>({
    queryKey: ["instruments"],
    queryFn: () => api.instruments.list(),
    enabled: isHighAccess,
  });

  const { data: filings = [] } = useQuery<TrustFiling[]>({
    queryKey: ["filings"],
    queryFn: () => api.filings.list(),
    enabled: isHighAccess,
  });

  if (isElder) {
    return (
      <Layout>
        <ElderOverview
          name={user?.name ?? ""}
          roleLabel={config.roleLabel}
          whatNext={config.whatNext}
        />
      </Layout>
    );
  }

  if (!isHighAccess) {
    return (
      <Layout>
        <MemberOverview
          name={user?.name ?? ""}
          roleLabel={config.roleLabel}
          roleSubtitle={config.roleSubtitle}
          whatNext={config.whatNext}
          panels={config.overviewPanels}
        />
      </Layout>
    );
  }

  const stats = {
    total: instruments.length,
    valid: instruments.filter((i) => ["valid", "filed", "submitted"].includes(i.status)).length,
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
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
              <span className="ml-2 text-xs text-muted-foreground/60">· {config.roleLabel}</span>
            </p>
          </div>
          {config.canCreateInstrument && (
            <Link
              href="/instruments/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              + New Instrument
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Instruments" value={stats.total} icon={FolderOpen} color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" />
          <StatCard label="Valid / Filed" value={stats.valid} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" />
          <StatCard label="Total Filings" value={stats.filings} icon={FileText} color="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" />
          <StatCard label="Pending Review" value={stats.pendingFilings} icon={Clock} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" />
        </div>

        {config.canViewNFR && (
          <div className="mb-6 bg-sidebar/60 border border-sidebar-border rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
              <Scale className="w-4 h-4 text-sidebar-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Notice of Federal Review</p>
              <p className="text-xs text-muted-foreground mt-0.5">Access, generate, and manage NFR documents for classified court matters.</p>
            </div>
            <Link
              href="/nfr"
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline flex-shrink-0"
            >
              Open NFR <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-card-border rounded-xl shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
                <h2 className="text-sm font-semibold text-card-foreground">Recent Instruments</h2>
                <Link
                  href="/instruments"
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-card-border">
                {recentInstruments.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No instruments yet.</p>
                    {config.canCreateInstrument && (
                      <Link
                        href="/instruments/new"
                        className="mt-2 inline-block text-xs text-primary font-medium hover:underline"
                      >
                        Create your first instrument →
                      </Link>
                    )}
                  </div>
                ) : (
                  recentInstruments.map((inst) => (
                    <Link
                      key={inst.id}
                      href={`/instruments/${inst.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate group-hover:text-primary transition-colors">
                          {inst.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {inst.instrumentType} · {inst.state ?? "—"}
                        </p>
                      </div>
                      <StatusBadge status={inst.status} />
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
                <h2 className="text-sm font-semibold text-card-foreground">Recent Filings</h2>
                <Link
                  href="/filings"
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  View all <ArrowRight className="w-3 h-3" />
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

          <div>
            <WhatNextPanel items={config.whatNext} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
