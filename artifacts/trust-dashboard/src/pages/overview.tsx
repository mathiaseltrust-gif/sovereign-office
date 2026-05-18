import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { api, getAuthToken, type TrustInstrument, type TrustFiling } from "@/lib/api";
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
  Send,
  Plus,
  Search,
  Loader2,
  Landmark,
  Briefcase,
  Users,
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

// ── Trust type definitions ────────────────────────────────────────────────────
const TRUST_TYPES = [
  { name: "Family Trust", slug: "family_trust", icon: Heart, color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400", desc: "Protect and manage assets for family beneficiaries across generations." },
  { name: "Tribal Trust", slug: "tribal_trust", icon: Shield, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", desc: "Sovereign trust structure aligned with tribal law and governance authority." },
  { name: "Land Trust", slug: "land_trust", icon: TreePine, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", desc: "Hold and protect tribal and family land with sovereign authority." },
  { name: "Charitable Trust", slug: "charitable_trust", icon: Globe, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", desc: "Support community programs, education, and cultural preservation." },
  { name: "Living Trust", slug: "living_trust", icon: BookOpen, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", desc: "Revocable structure for lifetime management and seamless succession." },
  { name: "Governance Trust", slug: "governance_trust", icon: Scale, color: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400", desc: "Structural trust supporting tribal governance and organizational continuity." },
  { name: "Educational Trust", slug: "educational_trust", icon: Building2, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", desc: "Fund education, SDU programs, and training for tribal members." },
  { name: "Community Preservation Trust", slug: "community_preservation_trust", icon: Users, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", desc: "Preserve community identity, history, and cultural legacy." },
  { name: "Beneficiary Trust", slug: "beneficiary_trust", icon: UserCircle, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", desc: "Direct benefit structures for named tribal members or descendants." },
  { name: "Asset Protection Structure", slug: "asset_protection_structure", icon: Briefcase, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", desc: "Shield sovereign assets from unauthorized encumbrance or seizure." },
];

// ── Companion Trust Guide chat panel ─────────────────────────────────────────
function CompanionTrustGuide() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const QUICK_PROMPTS = [
    "What type of trust should I create?",
    "How do I set up a land trust?",
    "Explain beneficiary structures",
    "What protections does a family trust offer?",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(msg: string) {
    const text = msg.trim();
    if (!text || sending) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setSending(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/kaya/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Unable to reach Companion right now. Please try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm flex flex-col" style={{ minHeight: 340, maxHeight: 520 }}>
      <div className="px-4 py-3 border-b border-card-border flex items-center gap-2 shrink-0">
        <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
          <span className="text-[8px] font-bold text-primary">C</span>
        </div>
        <h2 className="text-sm font-semibold text-card-foreground">Companion Trust Guide</h2>
      </div>

      {messages.length === 0 ? (
        <div className="p-4 space-y-3 shrink-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ask Companion about trust types, structures, beneficiaries, and what may align with your goals.
          </p>
          <div className="flex flex-col gap-1.5">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="text-left text-xs px-3 py-2 rounded-lg border border-primary/20 text-primary hover:bg-primary/5 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-foreground border border-card-border"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted/40 border border-card-border rounded-xl px-3 py-2.5">
                <div className="flex gap-1 items-center">
                  <div className="w-1 h-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1 h-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1 h-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="p-3 border-t border-card-border shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about trust structures…"
            className="flex-1 text-xs rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Trust Governance Workspace (high-access) ────────────────────────────
function TrustGovernanceWorkspace({
  user,
  config,
  instruments,
  filings,
  stats,
}: {
  user: { name?: string | null } | null;
  config: ReturnType<typeof getRoleConfig>;
  instruments: TrustInstrument[];
  filings: TrustFiling[];
  stats: { total: number; valid: number; draft: number; filings: number; pendingFilings: number };
}) {
  const [search, setSearch] = useState("");
  const [showAllTypes, setShowAllTypes] = useState(false);

  const filtered = instruments.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.instrumentType.toLowerCase().includes(q) ||
      (i.state ?? "").toLowerCase().includes(q)
    );
  });

  const visibleTypes = showAllTypes ? TRUST_TYPES : TRUST_TYPES.slice(0, 6);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trust Governance Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
            <span className="ml-2 text-xs text-muted-foreground/60">· {config.roleLabel}</span>
          </p>
        </div>
        {config.canCreateInstrument && (
          <Link
            href="/instruments/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Instrument
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Instruments" value={stats.total} icon={FolderOpen} color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" />
        <StatCard label="Valid / Filed" value={stats.valid} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" />
        <StatCard label="Total Filings" value={stats.filings} icon={FileText} color="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" />
        <StatCard label="Pending Review" value={stats.pendingFilings} icon={Clock} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" />
      </div>

      {/* NFR Banner */}
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

      {/* Trust Types */}
      <div className="mb-6 bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Trust Structures Available</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The system supports all of the following trust types and structures.
            </p>
          </div>
          {config.canCreateInstrument && (
            <Link
              href="/instruments/new"
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline shrink-0"
            >
              Begin creation <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleTypes.map(({ name, slug, icon: Icon, color, desc }) => (
            <div
              key={slug}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-card-border hover:border-primary/30 transition-colors group bg-background/50"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        {!showAllTypes && TRUST_TYPES.length > 6 && (
          <div className="px-5 pb-4">
            <button
              onClick={() => setShowAllTypes(true)}
              className="text-xs text-primary font-medium hover:underline"
            >
              Show {TRUST_TYPES.length - 6} more structures →
            </button>
          </div>
        )}
      </div>

      {/* Main 3-column workspace */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: instruments + filings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Instruments */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-card-border gap-3">
              <h2 className="text-sm font-semibold text-card-foreground shrink-0">Trust Instruments</h2>
              <div className="flex-1 flex items-center gap-2 bg-background border border-input rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search instruments…"
                  className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              {config.canCreateInstrument && (
                <Link
                  href="/instruments/new"
                  className="shrink-0 flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <Plus className="w-3 h-3" /> New
                </Link>
              )}
            </div>
            <div className="divide-y divide-card-border max-h-[420px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <AlertCircle className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">
                    {search ? "No instruments match your search." : "No instruments yet."}
                  </p>
                  {!search && config.canCreateInstrument && (
                    <Link
                      href="/instruments/new"
                      className="mt-2 inline-block text-xs text-primary font-medium hover:underline"
                    >
                      Create your first instrument →
                    </Link>
                  )}
                </div>
              ) : (
                [...filtered].reverse().map((inst) => (
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
            {instruments.length > 0 && (
              <div className="px-5 py-3 border-t border-card-border">
                <Link href="/instruments" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  View all instruments <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Filings */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
              <h2 className="text-sm font-semibold text-card-foreground">County Recorder Filings</h2>
              <Link href="/filings" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-card-border">
              {filings.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <FileText className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">No filings yet.</p>
                </div>
              ) : (
                [...filings].reverse().slice(0, 5).map((filing) => (
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

        {/* Right: Companion + What's Next */}
        <div className="space-y-5">
          <CompanionTrustGuide />
          <WhatNextPanel items={config.whatNext} />
        </div>
      </div>
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

  return (
    <Layout>
      <TrustGovernanceWorkspace
        user={user}
        config={config}
        instruments={instruments}
        filings={filings}
        stats={stats}
      />
    </Layout>
  );
}
