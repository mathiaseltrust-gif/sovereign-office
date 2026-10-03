import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { AlertTriangle, CalendarDays, CheckSquare, ExternalLink, Scale, ShieldCheck } from "lucide-react";

interface BoardMatter {
  id: number;
  status: string;
  priority: string;
  dueDate: string | null;
}

const ITEMS = [
  { href: "/board", label: "Board of Trustees", description: "Board Matters, oversight, evidence, resolutions, and records" },
  { href: "/sovereign-pipeline", label: "AI Intake & Pipeline", description: "Incoming matters and routed institutional work" },
  { href: "/instruments", label: "Trust Instruments", description: "Create, review, and maintain trust instruments" },
  { href: "/filings", label: "Filings", description: "Pending and completed institutional filings" },
  { href: "/nfr", label: "NFR", description: "Notice of Federal Review workflow" },
  { href: "/tasks", label: "Tasks", description: "Assigned work and delegated action" },
  { href: "/calendar", label: "Calendar", description: "Deadlines, hearings, meetings, and reminders" },
  { href: "/land", label: "Land & Assets", description: "Trust land and asset administration" },
];

function authHeaders() {
  const token = getCurrentBearerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function TrusteeDashboard() {
  const { data: matters = [] } = useQuery<BoardMatter[]>({
    queryKey: ["board-matters"],
    queryFn: async () => {
      const r = await fetch("/api/board/matters", { headers: authHeaders() });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const openMatters = matters.filter((m) => m.status !== "closed");
  const awaitingEvidence = matters.filter((m) => m.status === "awaiting_evidence");
  const urgent = openMatters.filter((m) => m.priority === "urgent");
  const dueSoon = openMatters.filter((m) => {
    if (!m.dueDate) return false;
    const due = new Date(m.dueDate).getTime();
    return due >= now && due - now <= sevenDays;
  });

  return (
    <div data-testid="page-trustee-dashboard" className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Office of the Chief Justice & Trustee</p>
          <h1 className="text-3xl font-serif font-bold text-foreground mt-1">Trustee Command Center</h1>
          <p className="text-muted-foreground mt-1">
            Fiduciary oversight, Board work, trust administration, filings, assets, deadlines, and institutional review.
          </p>
        </div>
        <a href="/trust-dashboard/">
          <Button variant="outline" className="gap-1.5">
            <Scale className="h-4 w-4" />
            Open Trust Administration
            <ExternalLink className="h-3 w-3" />
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Open Board Matters", value: openMatters.length, icon: ShieldCheck },
          { label: "Urgent", value: urgent.length, icon: AlertTriangle },
          { label: "Awaiting Evidence", value: awaitingEvidence.length, icon: CheckSquare },
          { label: "Due in 7 Days", value: dueSoon.length, icon: CalendarDays },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-3xl font-serif font-bold mt-1">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Trustee Workspaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className={`cursor-pointer hover:border-primary transition-colors h-full ${item.href === "/board" ? "border-amber-300 bg-amber-50/30" : ""}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{item.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/board"><Button size="sm">Open Board Matters</Button></Link>
        <Link href="/tasks"><Button size="sm" variant="outline">Tasks</Button></Link>
        <Link href="/calendar"><Button size="sm" variant="outline">Calendar</Button></Link>
        <Link href="/org"><Button size="sm" variant="outline">Organization Records</Button></Link>
      </div>
    </div>
  );
}
