import { useListInstruments, useListFilings, useListNfrs, useListTasks, useListCalendarEvents, useListComplaints } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";

function StatCard({ title, value, sub, href }: { title: string; value: number | string; sub?: string; href: string }) {
  return (
    <Link href={href}>
      <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`} className="cursor-pointer hover:border-primary transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-serif font-bold text-foreground">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function TrusteeDashboard() {
  const { data: instruments, isLoading: loadingI } = useListInstruments();
  const { data: filings, isLoading: loadingF } = useListFilings();
  const { data: nfrs, isLoading: loadingN } = useListNfrs();
  const { data: tasks, isLoading: loadingT } = useListTasks();
  const { data: events } = useListCalendarEvents();
  const { data: complaints } = useListComplaints();

  const pendingFilings = filings?.filter((f) => f.filingStatus === "pending") ?? [];
  const pendingTasks = tasks?.filter((t) => t.status === "pending") ?? [];
  const draftInstruments = instruments?.filter((i) => i.status === "draft") ?? [];
  const upcomingEvents = (events ?? []).slice(0, 5);

  return (
    <div data-testid="page-trustee-dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Chief Justice & Trustee Overview</h1>
        <p className="text-muted-foreground mt-1">Office of the Chief Justice and Trustee — full court and trustee services</p>
      </div>

      {loadingI || loadingF || loadingN || loadingT ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Trust Instruments" value={instruments?.length ?? 0} sub={`${draftInstruments.length} draft`} href="/instruments" />
          <StatCard title="Pending Filings" value={pendingFilings.length} sub="awaiting review" href="/filings" />
          <StatCard title="NFR Documents" value={nfrs?.length ?? 0} href="/nfr" />
          <StatCard title="Open Tasks" value={pendingTasks.length} href="/tasks" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest">Complaint Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(complaints ?? []).slice(0, 5).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No complaints.</p>
                ) : (complaints ?? []).slice(0, 5).map((c) => (
                  <Link key={c.id} href={`/complaints/${c.id}`}>
                    <div data-testid={`complaint-row-${c.id}`} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary transition-colors">
                      <span className="text-sm truncate max-w-xs">{c.text?.substring(0, 60)}…</span>
                      <Badge variant={c.status === "open" ? "destructive" : "secondary"} className="ml-2 shrink-0">{c.status}</Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/complaints" className="text-xs text-primary hover:underline block pt-1">View all</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest">Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events.</p>
                ) : upcomingEvents.map((e) => (
                  <div key={e.id} data-testid={`event-row-${e.id}`} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm truncate max-w-xs">{e.title}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">{new Date(e.date).toLocaleDateString()}</span>
                  </div>
                ))}
                <Link href="/calendar" className="text-xs text-primary hover:underline block pt-1">View calendar</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest">Recent Instruments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(instruments ?? []).slice(0, 5).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No instruments yet.</p>
                ) : (instruments ?? []).slice(0, 5).map((i) => (
                  <Link key={i.id} href={`/instruments/${i.id}`}>
                    <div data-testid={`instrument-row-${i.id}`} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary">
                      <span className="text-sm font-medium">{i.title}</span>
                      <Badge variant="outline" className="ml-2 shrink-0">{i.status}</Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/instruments" className="text-xs text-primary hover:underline block pt-1">View all</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest">NFR Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(nfrs ?? []).slice(0, 5).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No NFR documents.</p>
                ) : (nfrs ?? []).slice(0, 5).map((n) => (
                  <div key={n.id} data-testid={`nfr-row-${n.id}`} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">NFR #{n.id}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{n.status}</Badge>
                      {n.pdfUrl && (
                        <span className="text-xs text-primary cursor-pointer hover:underline" onClick={() => window.open(`/api/court/nfr/${n.id}/pdf`)}>PDF</span>
                      )}
                    </div>
                  </div>
                ))}
                <Link href="/nfr" className="text-xs text-primary hover:underline block pt-1">View all</Link>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-1">
          <WhatNextPanel />
        </div>
      </div>
    </div>
  );
}
