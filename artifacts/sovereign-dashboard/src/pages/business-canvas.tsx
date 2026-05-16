import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { useAuth } from "@/components/auth-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessConcept {
  id: number;
  title: string;
  description: string;
  structure: string;
  status: string;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BusinessVote {
  id: number;
  title: string;
  description: string;
  motionType: string;
  status: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  voteRecords: { userId: number; vote: string }[];
  createdAt: string;
  closedAt: string | null;
}

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TabKey = "concepts" | "voting" | "creative" | "law" | "copilot";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "concepts",  label: "Concepts",           icon: "💼" },
  { key: "voting",    label: "Governance & Voting", icon: "🗳️" },
  { key: "creative",  label: "AI Creative Studio",  icon: "🎨" },
  { key: "law",       label: "Law & Ethics",         icon: "⚖️" },
  { key: "copilot",   label: "Business Copilot",     icon: "🤖" },
];

function statusBadge(status: string) {
  switch (status) {
    case "draft":     return <Badge variant="secondary">Draft</Badge>;
    case "submitted": return <Badge variant="default">Submitted</Badge>;
    case "active":    return <Badge className="bg-green-600 text-white">Active</Badge>;
    case "archived":  return <Badge variant="outline">Archived</Badge>;
    default:          return <Badge variant="outline">{status}</Badge>;
  }
}

function voteBadge(status: string) {
  switch (status) {
    case "open":   return <Badge className="bg-blue-600 text-white">Open</Badge>;
    case "passed": return <Badge className="bg-green-600 text-white">✓ Passed</Badge>;
    case "failed": return <Badge className="bg-red-600 text-white">✗ Failed</Badge>;
    case "tied":   return <Badge className="bg-amber-500 text-white">Tied</Badge>;
    case "tabled": return <Badge variant="outline">Tabled</Badge>;
    default:       return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Concepts Tab ─────────────────────────────────────────────────────────────

function ConceptsTab() {
  const [concepts, setConcepts] = useState<BusinessConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/business/concepts", {
      headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
    })
      .then(r => r.json())
      .then(data => { setConcepts(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setLoading(false); toast({ title: "Failed to load business concepts", variant: "destructive" }); });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">{concepts.length} concept{concepts.length !== 1 ? "s" : ""}</p>
        <Button onClick={() => navigate("/business-canvas/new")}>+ New Business Idea</Button>
      </div>

      {concepts.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🏛️</div>
            <h2 className="text-xl font-semibold mb-2">No Business Concepts Yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Start developing your sovereign business idea. Our AI will guide you through structure selection, planning, legal protections, and activation steps.
            </p>
            <Button size="lg" onClick={() => navigate("/business-canvas/new")}>
              Start a New Business Idea
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {concepts.map(c => (
            <Link key={c.id} href={`/business-canvas/${c.id}`}>
              <Card className="cursor-pointer hover:border-primary transition-colors h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">{c.title}</CardTitle>
                    {statusBadge(c.status)}
                  </div>
                  {c.structure && <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{c.structure}</p>}
                </CardHeader>
                <CardContent>
                  {c.aiSummary ? (
                    <p className="text-sm text-muted-foreground line-clamp-3">{c.aiSummary}</p>
                  ) : c.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-3">{c.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No summary yet</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">Updated {new Date(c.updatedAt).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Voting Tab ───────────────────────────────────────────────────────────────

const MOTION_TYPES = ["procedural", "financial", "governance", "officer", "resolution", "amendment"];

function VotingTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [votes, setVotes] = useState<BusinessVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<number | null>(null);
  const [voting, setVoting] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", description: "", motionType: "procedural" });

  const isElevated = user?.roles?.some(r => ["trustee", "officer", "sovereign_admin", "admin", "elder"].includes(r)) ?? false;
  const userId = (user as { dbId?: number } | null)?.dbId;

  async function load() {
    try {
      const r = await fetch("/api/business/votes", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      const data = await r.json();
      setVotes(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function createMotion() {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/business/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Motion created — voting is now open" });
      setForm({ title: "", description: "", motionType: "procedural" });
      setShowCreate(false);
      load();
    } catch { toast({ title: "Failed to create motion", variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function castVote(voteId: number, choice: "yes" | "no" | "abstain") {
    setVoting(voteId);
    try {
      const r = await fetch(`/api/business/votes/${voteId}/vote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: JSON.stringify({ vote: choice }),
      });
      if (r.status === 409) { toast({ title: "You have already voted on this motion" }); return; }
      if (!r.ok) throw new Error();
      load();
    } catch { toast({ title: "Vote failed", variant: "destructive" }); }
    finally { setVoting(null); }
  }

  async function closeVote(voteId: number) {
    setClosing(voteId);
    try {
      const r = await fetch(`/api/business/votes/${voteId}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error();
      toast({ title: "Vote closed and tallied" });
      load();
    } catch { toast({ title: "Failed to close vote", variant: "destructive" }); }
    finally { setClosing(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Governance & Voting</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Create tribal motions, record votes, and manage governance decisions</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)} variant={showCreate ? "outline" : "default"}>
          {showCreate ? "Cancel" : "+ New Motion"}
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Draft a Motion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Motion Title *</label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Authorize tribal enterprise fund allocation for FY2025"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Description / WHEREAS clauses</label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Provide background, rationale, and the proposed action..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Motion Type</label>
              <div className="flex flex-wrap gap-2">
                {MOTION_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, motionType: t }))}
                    className={[
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      form.motionType === t ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50",
                    ].join(" ")}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={createMotion} disabled={creating || !form.title.trim()} className="w-full">
              {creating ? "Creating motion…" : "Open for Vote"}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : votes.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="text-4xl mb-3">🗳️</div>
            <h3 className="font-semibold mb-1">No Motions Yet</h3>
            <p className="text-sm text-muted-foreground">Create your first governance motion to begin voting.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {votes.map(v => {
            const total = v.yesCount + v.noCount + v.abstainCount;
            const hasVoted = userId ? v.voteRecords?.some(r => r.userId === userId) : false;
            const isOpen = v.status === "open";
            return (
              <Card key={v.id} className={v.status === "passed" ? "border-green-500/40 bg-green-50/50 dark:bg-green-950/20" : v.status === "failed" ? "border-red-500/30" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{v.title}</span>
                        {voteBadge(v.status)}
                        <Badge variant="outline" className="text-xs">{v.motionType}</Badge>
                      </div>
                      {v.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</p>}
                    </div>
                  </div>

                  {/* Vote bar */}
                  {total > 0 && (
                    <div className="mb-3">
                      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-1">
                        {v.yesCount > 0 && <div className="bg-green-500 rounded-l-full" style={{ width: `${(v.yesCount / total) * 100}%` }} />}
                        {v.noCount > 0 && <div className="bg-red-500 rounded-r-full" style={{ width: `${(v.noCount / total) * 100}%` }} />}
                        {v.abstainCount > 0 && <div className="bg-muted-foreground/30" style={{ width: `${(v.abstainCount / total) * 100}%` }} />}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className="text-green-600 font-medium">✓ {v.yesCount} Yes</span>
                        <span className="text-red-600 font-medium">✗ {v.noCount} No</span>
                        <span>{v.abstainCount} Abstain</span>
                        <span>— {total} vote{total !== 1 ? "s" : ""} cast</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {isOpen && !hasVoted && (
                      <>
                        <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white h-7 text-xs" onClick={() => castVote(v.id, "yes")} disabled={voting === v.id}>
                          ✓ Aye
                        </Button>
                        <Button size="sm" className="bg-red-700 hover:bg-red-800 text-white h-7 text-xs" onClick={() => castVote(v.id, "no")} disabled={voting === v.id}>
                          ✗ Nay
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => castVote(v.id, "abstain")} disabled={voting === v.id}>
                          Abstain
                        </Button>
                      </>
                    )}
                    {isOpen && hasVoted && (
                      <span className="text-xs text-muted-foreground italic">You have voted on this motion.</span>
                    )}
                    {isOpen && isElevated && (
                      <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={() => closeVote(v.id)} disabled={closing === v.id}>
                        {closing === v.id ? "Closing…" : "Close & Tally"}
                      </Button>
                    )}
                    {!isOpen && v.closedAt && (
                      <span className="text-xs text-muted-foreground ml-auto">Closed {new Date(v.closedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AI Creative Studio Tab ───────────────────────────────────────────────────

type CreativeMode = "logo" | "branding" | "sop" | "ethics";

const CREATIVE_TOOLS: { mode: CreativeMode; icon: string; title: string; description: string; placeholder: string }[] = [
  {
    mode: "logo",
    icon: "🎨",
    title: "Logo Concept Generator",
    description: "Describe your business and get a detailed visual concept: symbol ideas, color palette with hex codes, typography, and tagline options.",
    placeholder: "Describe your business, its values, and any symbols or imagery that matter to your community…",
  },
  {
    mode: "branding",
    icon: "✨",
    title: "Brand & Identity Builder",
    description: "Get 3 business name options, a brand positioning statement, mission statement, voice description, and taglines.",
    placeholder: "What does this business do? Who does it serve? What feeling should the brand convey?",
  },
  {
    mode: "sop",
    icon: "📋",
    title: "Procedure / SOP Writer",
    description: "Generate a complete, formatted Standard Operating Procedure ready for adoption — with purpose, scope, responsibilities, and numbered steps.",
    placeholder: "Describe the process you need documented (e.g. 'Employee onboarding', 'Tribal fund disbursement approval', 'Customer complaint handling')…",
  },
  {
    mode: "ethics",
    icon: "🌿",
    title: "Ethics Policy Generator",
    description: "Create a values-aligned ethics framework: core principles, standards of conduct, conflict of interest policy, and enforcement provisions.",
    placeholder: "Describe the entity type and any specific ethics concerns (e.g. 'Tribal enterprise fund manager', 'Board of officers governing a joint venture')…",
  },
];

function CreativeStudioTab() {
  const { toast } = useToast();
  const [results, setResults] = useState<Record<CreativeMode, string>>({ logo: "", branding: "", sop: "", ethics: "" });
  const [inputs, setInputs] = useState<Record<CreativeMode, string>>({ logo: "", branding: "", sop: "", ethics: "" });
  const [loading, setLoading] = useState<Record<CreativeMode, boolean>>({ logo: false, branding: false, sop: false, ethics: false });
  const [copied, setCopied] = useState<CreativeMode | null>(null);

  async function generate(mode: CreativeMode) {
    const message = inputs[mode].trim();
    if (!message) return;
    setLoading(l => ({ ...l, [mode]: true }));
    try {
      const r = await fetch("/api/business/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: JSON.stringify({ message, mode }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json() as { reply: string };
      setResults(res => ({ ...res, [mode]: data.reply }));
    } catch { toast({ title: "Generation failed — try again", variant: "destructive" }); }
    finally { setLoading(l => ({ ...l, [mode]: false })); }
  }

  function copyResult(mode: CreativeMode) {
    navigator.clipboard.writeText(results[mode]).then(() => {
      setCopied(mode);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">AI Creative Studio</h2>
        <p className="text-sm text-muted-foreground mt-0.5">AI-powered tools for branding, procedures, and ethics — built for sovereign enterprise</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CREATIVE_TOOLS.map(tool => (
          <Card key={tool.mode} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tool.icon}</span>
                <div>
                  <CardTitle className="text-base">{tool.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 flex-1">
              <Textarea
                rows={3}
                placeholder={tool.placeholder}
                value={inputs[tool.mode]}
                onChange={e => setInputs(i => ({ ...i, [tool.mode]: e.target.value }))}
                disabled={loading[tool.mode]}
                className="text-sm resize-none"
              />
              <Button
                onClick={() => generate(tool.mode)}
                disabled={loading[tool.mode] || !inputs[tool.mode].trim()}
                className="w-full"
              >
                {loading[tool.mode] ? "Generating…" : `Generate ${tool.title.split(" ")[0]} ${tool.title.split(" ")[1]}`}
              </Button>
              {results[tool.mode] && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyResult(tool.mode)}
                        className="text-xs text-primary hover:underline"
                      >
                        {copied === tool.mode ? "✓ Copied" : "Copy"}
                      </button>
                      <button
                        onClick={() => setResults(r => ({ ...r, [tool.mode]: "" }))}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{results[tool.mode]}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Law & Ethics Tab ─────────────────────────────────────────────────────────

const LAW_CARDS = [
  {
    icon: "🏛️",
    title: "25 U.S.C. § 477 — Tribal Corporate Charters",
    category: "Tribal Corporate Law",
    summary: "Authorizes the Secretary of the Interior to issue a charter of incorporation to any Indian tribe. A chartered tribal corporation has power to purchase, take by gift or bequest, or otherwise acquire, own, hold, manage, operate, and dispose of property of every description.",
  },
  {
    icon: "🛡️",
    title: "Tribal Sovereign Immunity",
    category: "Immunity Doctrine",
    summary: "Tribal enterprises established under tribal law share in the sovereign immunity of the tribe unless the tribe has explicitly waived immunity. Courts have consistently held that this immunity extends to commercial activities conducted on behalf of the tribe.",
  },
  {
    icon: "💰",
    title: "Indian Country Tax Exemptions",
    category: "Tax Law",
    summary: "Tribal enterprises operating within Indian Country may be exempt from state and local taxes. Federal taxes may apply depending on structure. BIA and IRS guidelines provide specific exemption criteria based on entity type, location, and tribal member ownership.",
  },
  {
    icon: "🤝",
    title: "SBA 8(a) Business Development",
    category: "Federal Programs",
    summary: "Tribally-owned businesses may qualify for the SBA 8(a) program, providing access to set-aside federal contracts, business development assistance, and competitive advantages. Tribal entities must meet specific ownership and control requirements.",
  },
  {
    icon: "🎰",
    title: "NIGC — Indian Gaming Regulatory Act",
    category: "Gaming Law",
    summary: "The National Indian Gaming Commission (NIGC) regulates gaming activities on Indian lands. The IGRA (25 U.S.C. § 2701 et seq.) establishes three classes of gaming and requires tribal-state compacts for Class III gaming operations.",
  },
  {
    icon: "📜",
    title: "Indian Reorganization Act (IRA)",
    category: "Federal Trust Law",
    summary: "25 U.S.C. § 461 et seq. authorizes tribal self-governance, tribal land acquisition into trust, and tribal business operations. The IRA is the foundation for modern tribal enterprise authority and protects tribal business activities from state interference.",
  },
  {
    icon: "⚖️",
    title: "Federal Trust Responsibility",
    category: "Trust Law",
    summary: "The federal government holds trust responsibility to protect tribal assets, sovereignty, and self-determination. This duty applies to business development — federal agencies must consult with tribes before actions affecting tribal economic interests.",
  },
  {
    icon: "🌿",
    title: "Tribal Business Ethics Standards",
    category: "Business Ethics",
    summary: "Tribal enterprises are expected to uphold values of community benefit, transparency, and environmental stewardship alongside profit goals. Board members owe fiduciary duties under tribal law. Conflict of interest policies should be adopted for all enterprises.",
  },
];

function LawEthicsTab() {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const categories = ["all", ...Array.from(new Set(LAW_CARDS.map(c => c.category)))];
  const filtered = filter === "all" ? LAW_CARDS : LAW_CARDS.filter(c => c.category === filter);

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    try {
      const r = await fetch("/api/business/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: JSON.stringify({ message: question, mode: "law" }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json() as { reply: string };
      setAnswer(data.reply);
    } catch { toast({ title: "Could not get answer — try again", variant: "destructive" }); }
    finally { setAsking(false); }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Business Law & Ethics</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Tribal business law references and AI-powered legal Q&A</p>
      </div>

      {/* Ask a Question */}
      <Card className="mb-6 border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>💬</span> Ask a Business Law Question
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={2}
            placeholder="e.g. Can a tribal LLC be sued in state court? What taxes does a tribal enterprise pay? How do we adopt ethics bylaws?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={asking}
            className="text-sm resize-none"
          />
          <Button onClick={ask} disabled={asking || !question.trim()} size="sm">
            {asking ? "Researching…" : "Get Answer"}
          </Button>
          {answer && (
            <div className="rounded-lg border bg-white dark:bg-background p-3 mt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Legal Analysis</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={[
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              filter === c ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50",
            ].join(" ")}
          >
            {c === "all" ? "All Areas" : c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((card, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-2">
                <span className="text-2xl mt-0.5">{card.icon}</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.category}</p>
                  <CardTitle className="text-sm mt-0.5">{card.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.summary}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Business Copilot Tab ─────────────────────────────────────────────────────

type CopilotMode = "chat" | "logo" | "sop" | "ethics" | "motion" | "branding" | "law";

const COPILOT_CHIPS: { label: string; mode: CopilotMode; prompt: string; icon: string }[] = [
  { label: "Draft a Procedure",    mode: "sop",      prompt: "I need to create a Standard Operating Procedure. Please ask me what process to document.", icon: "📋" },
  { label: "Logo Concept",         mode: "logo",     prompt: "I'd like a logo concept for my tribal business. Please ask me about the business to create a visual concept.", icon: "🎨" },
  { label: "Business Name Ideas",  mode: "branding", prompt: "Help me brainstorm business name ideas. Please ask me about the business first.", icon: "✨" },
  { label: "Business Law Q&A",     mode: "law",      prompt: "I have a business law question about our tribal enterprise.", icon: "⚖️" },
  { label: "Ethics Policy",        mode: "ethics",   prompt: "I need to create a business ethics policy for our tribal enterprise. Please guide me through what's needed.", icon: "🌿" },
  { label: "Draft a Motion",       mode: "motion",   prompt: "I need to draft a formal governance motion. Please ask me about the motion to draft it correctly.", icon: "🗳️" },
  { label: "Funding Strategy",     mode: "chat",     prompt: "What federal funding programs and grants are available for tribal enterprises?", icon: "💰" },
  { label: "Board Resolution",     mode: "motion",   prompt: "I need to draft a formal board resolution. Please ask me for the details.", icon: "📜" },
];

function formatCopilotContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("## ")) return <h3 key={i} style={{ fontWeight: 700, marginTop: 8, marginBottom: 2, fontSize: 13 }}>{line.replace("## ", "")}</h3>;
    if (line.startsWith("### ")) return <h4 key={i} style={{ fontWeight: 600, marginTop: 6, marginBottom: 2, fontSize: 12.5 }}>{line.replace("### ", "")}</h4>;
    if (line.startsWith("**") && line.endsWith("**")) return <strong key={i} style={{ display: "block", marginTop: 4 }}>{line.replace(/\*\*/g, "")}</strong>;
    if (line.match(/^\d+\.\s/)) return <div key={i} style={{ paddingLeft: 16, marginBottom: 2 }}>{line}</div>;
    if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ paddingLeft: 16, marginBottom: 1 }}>{line}</div>;
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{line}</div>;
  });
}

function CopilotTab() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string, mode: CopilotMode = "chat") {
    if (!text.trim() || loading) return;
    const userMsg: CopilotMessage = { id: Date.now().toString(), role: "user", content: text, mode };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);

    const history = messages.slice(-16).map(m => ({ role: m.role, content: m.content }));

    try {
      const r = await fetch("/api/business/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: JSON.stringify({ message: text, mode, history }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json() as { reply: string; mode: string };
      setMessages(m => [...m, { id: (Date.now() + 1).toString(), role: "assistant", content: data.reply, mode: data.mode }]);
    } catch {
      toast({ title: "Copilot unavailable — try again", variant: "destructive" });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function copyMsg(id: string, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const MODE_LABELS: Record<string, string> = { logo: "Logo Concept", sop: "SOP", ethics: "Ethics Policy", motion: "Motion Draft", branding: "Branding", law: "Legal Analysis" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 260px)", minHeight: 480, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", background: "linear-gradient(135deg, #451a03 0%, #7c2d12 100%)", color: "#fef3c7", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Georgia', serif" }}>Business Copilot</div>
            <div style={{ fontSize: 10.5, opacity: 0.8 }}>Strategy · Law · Ethics · Creative · Governance</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ margin: "auto 0", paddingTop: 20 }}>
            <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              Your sovereign business AI partner — strategy, law, ethics, creative, and governance all in one.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {COPILOT_CHIPS.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => send(chip.prompt, chip.mode)}
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #d97706",
                    borderRadius: 20,
                    padding: "6px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "'Georgia', serif",
                    color: "#7c2d12",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span>{chip.icon}</span> {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
            {msg.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#7c2d12", color: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2 }}>
                🤖
              </div>
            )}
            <div style={{
              maxWidth: "82%",
              background: msg.role === "user" ? "#451a03" : "#fffbf0",
              color: msg.role === "user" ? "#fef3c7" : "#1a1a2e",
              borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              padding: "9px 13px",
              lineHeight: 1.6,
              fontSize: 13.5,
              border: msg.role === "assistant" ? "1px solid #fde68a" : "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {msg.role === "assistant" && msg.mode && MODE_LABELS[msg.mode] && (
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#7c2d12", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
                  {MODE_LABELS[msg.mode]}
                </div>
              )}
              {msg.role === "assistant" ? formatCopilotContent(msg.content) : msg.content}
              {msg.role === "assistant" && (
                <button
                  onClick={() => copyMsg(msg.id, msg.content)}
                  style={{ marginTop: 8, fontSize: 10.5, color: "#78716c", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {copiedId === msg.id ? "✓ Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#7c2d12", color: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🤖</div>
            <div style={{ background: "#fffbf0", border: "1px solid #fde68a", borderRadius: "14px 14px 14px 4px", padding: "10px 14px", display: "flex", gap: 4, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706", animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips when mid-conversation */}
      {messages.length > 0 && messages.length < 4 && (
        <div style={{ padding: "6px 16px", borderTop: "1px solid #fef3c7", background: "#fffbf0", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
          {COPILOT_CHIPS.slice(0, 4).map(chip => (
            <button
              key={chip.label}
              onClick={() => send(chip.prompt, chip.mode)}
              disabled={loading}
              style={{ background: "#fff", border: "1px solid #d97706", borderRadius: 20, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: "#7c2d12" }}
            >
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about business strategy, law, branding, ethics, procedures, governance…"
            rows={1}
            disabled={loading}
            style={{ flex: 1, resize: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "'Georgia', serif", outline: "none", lineHeight: 1.5, maxHeight: 80, overflowY: "auto", background: loading ? "#f9fafb" : "#fff", color: "#1a1a2e" }}
            onInput={e => { const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 80) + "px"; }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{ background: loading || !input.trim() ? "#9ca3af" : "#7c2d12", color: "#fff", border: "none", borderRadius: 8, width: 36, height: 36, cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}
          >
            ↑
          </button>
        </div>
        <div style={{ marginTop: 5, fontSize: 10, color: "#9ca3af", textAlign: "center" }}>
          Business Copilot · Strategy · Law · Ethics · Creative · Governance
        </div>
      </div>
    </div>
  );
}

// ─── Main Hub ─────────────────────────────────────────────────────────────────

export default function BusinessCanvas() {
  const [activeTab, setActiveTab] = useState<TabKey>("concepts");
  const [, navigate] = useLocation();

  return (
    <div data-testid="page-business-canvas">

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Business Canvas</h1>
            <p className="text-muted-foreground mt-1">
              Sovereign enterprise workspace — formation, governance, creative tools, and AI copilot
            </p>
          </div>
          {activeTab === "concepts" && (
            <Button size="lg" className="shrink-0" onClick={() => navigate("/business-canvas/new")}>
              + New Business Idea
            </Button>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 mb-6 border-b">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
            ].join(" ")}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "concepts"  && <ConceptsTab />}
      {activeTab === "voting"    && <VotingTab />}
      {activeTab === "creative"  && <CreativeStudioTab />}
      {activeTab === "law"       && <LawEthicsTab />}
      {activeTab === "copilot"   && <CopilotTab />}

      {/* Feature overview cards — only on concepts tab */}
      {activeTab === "concepts" && (
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[
            { icon: "🗳️", title: "Governance & Voting", desc: "Draft motions, record votes, tally results", tab: "voting" as TabKey },
            { icon: "🎨", title: "AI Creative Studio", desc: "Logos, branding, procedures, ethics policies", tab: "creative" as TabKey },
            { icon: "⚖️", title: "Business Law", desc: "Tribal law references + AI legal Q&A", tab: "law" as TabKey },
            { icon: "🤖", title: "Business Copilot", desc: "Full-scope AI for any business challenge", tab: "copilot" as TabKey },
          ].map(item => (
            <Card
              key={item.tab}
              className="bg-muted/30 cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-all"
              onClick={() => setActiveTab(item.tab)}
            >
              <CardContent className="pt-5 pb-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-xs mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
