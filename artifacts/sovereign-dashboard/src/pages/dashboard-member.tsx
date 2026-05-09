import { useListComplaints, useListCalendarEvents, useListNfrs } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function MemberDashboard() {
  const { data: complaints } = useListComplaints();
  const { data: events } = useListCalendarEvents();
  const { data: nfrs } = useListNfrs();

  const upcomingEvents = (events ?? []).slice(0, 6);

  return (
    <div data-testid="page-member-dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Member Portal</h1>
        <p className="text-muted-foreground mt-1">Your complaint history, NFR status, and calendar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Your Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{complaints?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">NFR Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{nfrs?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Calendar Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{events?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-widest">Complaint History</CardTitle>
            <Link href="/complaints" className="text-xs text-primary hover:underline">Submit new</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {(complaints ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No complaints filed.</p>
            ) : (complaints ?? []).slice(0, 6).map((c) => (
              <Link key={c.id} href={`/complaints/${c.id}`}>
                <div data-testid={`complaint-row-${c.id}`} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary">
                  <span className="text-sm truncate max-w-xs">{c.text?.substring(0, 60)}</span>
                  <Badge variant={c.status === "open" ? "destructive" : "secondary"} className="ml-2 shrink-0">{c.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-widest">Upcoming Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            ) : upcomingEvents.map((e) => (
              <div key={e.id} data-testid={`event-row-${e.id}`} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{e.title}</span>
                <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString()}</span>
              </div>
            ))}
            <Link href="/calendar" className="text-xs text-primary hover:underline block pt-1">Full calendar</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
