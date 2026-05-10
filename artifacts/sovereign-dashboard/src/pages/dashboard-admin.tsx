import { useListInstruments, useListFilings, useListNfrs, useListTasks, useListComplaints } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const ADMIN_SECTIONS = [
  { href: "/law", label: "Law Library", description: "Federal Indian Law, Tribal Law, Case Doctrines" },
  { href: "/doctrine", label: "Doctrine Manager", description: "Manage controlling legal doctrines and canons" },
  { href: "/recorder-rules", label: "Recorder Rules", description: "Configure recorder-compliance validation rules" },
  { href: "/welfare-acts", label: "Welfare Acts", description: "Administer welfare act instruments and declarations" },
  { href: "/templates", label: "Templates", description: "Manage trust, court, and NFR document templates" },
  { href: "/role-delegation", label: "Role Delegation", description: "Grant and revoke role-based permissions" },
  { href: "/audit-logs", label: "Audit Logs", description: "System-wide audit trail and event log" },
  { href: "/admin", label: "System Configuration", description: "Entra ID integration, bootstrap, system settings" },
];

export default function AdminDashboard() {
  const { data: instruments, isLoading: loadingI } = useListInstruments();
  const { data: filings, isLoading: loadingF } = useListFilings();
  const { data: nfrs, isLoading: loadingN } = useListNfrs();
  const { data: tasks, isLoading: loadingT } = useListTasks();
  const { data: complaints } = useListComplaints();

  const openTasks = (tasks ?? []).filter((t) => t.status === "pending");
  const openComplaints = (complaints ?? []).filter((c) => c.status === "open");

  return (
    <div data-testid="page-admin-dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">System Administration</h1>
        <p className="text-muted-foreground mt-1">Office of the Chief Justice and Trustee — sovereign admin configuration</p>
      </div>

      {loadingI || loadingF || loadingN || loadingT ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Instruments</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-serif font-bold">{instruments?.length ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Filings</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-serif font-bold">{filings?.length ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Open Tasks</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-serif font-bold">{openTasks.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Open Complaints</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-serif font-bold">{openComplaints.length}</div></CardContent>
          </Card>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Administration Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ADMIN_SECTIONS.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="cursor-pointer hover:border-primary transition-colors">
                <CardContent className="flex items-center gap-4 py-4">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{section.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{section.description}</div>
                  </div>
                  <span className="ml-auto text-muted-foreground text-lg">→</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-widest">Recent NFR Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(nfrs ?? []).slice(0, 5).length === 0 ? (
            <p className="text-sm text-muted-foreground">No NFR documents.</p>
          ) : (nfrs ?? []).slice(0, 5).map((n) => (
            <div key={n.id} data-testid={`nfr-row-${n.id}`} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm">NFR #{n.id}</span>
              <Badge variant="outline">{n.status}</Badge>
            </div>
          ))}
          <Link href="/nfr" className="text-xs text-primary hover:underline block pt-1">View all NFRs</Link>
        </CardContent>
      </Card>
    </div>
  );
}
