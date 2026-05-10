import { useListTasks, useListComplaints, useListNfrs } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";

export default function OfficerDashboard() {
  const { data: tasks, isLoading: loadingT } = useListTasks();
  const { data: complaints, isLoading: loadingC } = useListComplaints();
  const { data: nfrs, isLoading: loadingN } = useListNfrs();

  const myTasks = (tasks ?? []).filter((t) => t.status === "pending");
  const openComplaints = (complaints ?? []).filter((c) => c.status === "open");
  const draftNfrs = (nfrs ?? []).filter((n) => n.status === "draft");

  if (loadingT || loadingC || loadingN) {
    return (
      <div data-testid="page-officer-dashboard">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold">Officer Dashboard</h1>
          <p className="text-muted-foreground mt-1">Office of the Chief Justice and Trustee — Officer Services</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-officer-dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Officer Dashboard</h1>
        <p className="text-muted-foreground mt-1">Office of the Chief Justice and Trustee — complaints, welfare, classification, and tasks</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Open Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{myTasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Open Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{openComplaints.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Draft NFRs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{draftNfrs.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest">Tasks Due</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {myTasks.slice(0, 6).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending tasks.</p>
                ) : myTasks.slice(0, 6).map((t) => (
                  <div key={t.id} data-testid={`task-row-${t.id}`} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium truncate max-w-xs">{t.title}</span>
                    <div className="flex items-center gap-2">
                      {t.dueDate && <span className="text-xs text-muted-foreground">{new Date(t.dueDate).toLocaleDateString()}</span>}
                      <Badge variant="outline">{t.status}</Badge>
                    </div>
                  </div>
                ))}
                <Link href="/tasks" className="text-xs text-primary hover:underline block pt-1">View all tasks</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest">Recent Complaints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {openComplaints.slice(0, 6).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open complaints.</p>
                ) : openComplaints.slice(0, 6).map((c) => (
                  <Link key={c.id} href={`/complaints/${c.id}`}>
                    <div data-testid={`complaint-row-${c.id}`} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary">
                      <span className="text-sm truncate max-w-xs">{c.text?.substring(0, 50)}…</span>
                      <Badge variant="destructive" className="ml-2 shrink-0">{c.status}</Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/complaints" className="text-xs text-primary hover:underline block pt-1">View all complaints</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-widest">NFR Pipeline</CardTitle>
                <Link href="/classify" className="text-xs text-primary hover:underline">New Classification</Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {draftNfrs.slice(0, 5).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No draft NFRs.</p>
                ) : draftNfrs.slice(0, 5).map((n) => (
                  <div key={n.id} data-testid={`nfr-row-${n.id}`} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">NFR #{n.id}</span>
                    <Badge variant="secondary">{n.status}</Badge>
                  </div>
                ))}
                <Link href="/nfr" className="text-xs text-primary hover:underline block pt-1">View all NFRs</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/classify" className="block text-sm text-primary hover:underline py-1 border-b">Run Classification →</Link>
                <Link href="/welfare" className="block text-sm text-primary hover:underline py-1 border-b">Welfare Instruments →</Link>
                <Link href="/intake-ai" className="block text-sm text-primary hover:underline py-1 border-b">AI Intake Review →</Link>
                <Link href="/law" className="block text-sm text-primary hover:underline py-1">Law Library →</Link>
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
