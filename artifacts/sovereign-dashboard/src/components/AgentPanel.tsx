import { Link } from "wouter";

export interface AgentPanelProps {
  pendingTasks?: number;
  openComplaints?: number;
  pendingFilings?: number;
  draftNfrs?: number;
  draftInstruments?: number;
}

const ACTIONS = [
  { href: "/hub", label: "Hub" },
  { href: "/tasks", label: "Tasks" },
  { href: "/complaints", label: "Complaints" },
  { href: "/nfr", label: "Review" },
  { href: "/law", label: "Library" },
];

export function AgentPanel(_props: AgentPanelProps) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 mb-6 shadow-sm">
      <p className="text-sm font-semibold text-foreground">Fast-load mode</p>
      <p className="text-xs text-muted-foreground mt-1">This panel no longer fetches background suggestions on dashboard load.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <button className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
              {action.label}
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
