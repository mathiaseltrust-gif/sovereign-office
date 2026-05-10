import { useListComplaints, useListFilings, useListNfrs, useListCalendarEvents } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";

const STATUTES = [
  { code: "25 U.S.C. § 1302", title: "Indian Civil Rights Act" },
  { code: "25 U.S.C. § 1901", title: "Indian Child Welfare Act" },
  { code: "28 U.S.C. § 1360", title: "State Jurisdiction Limits" },
  { code: "25 U.S.C. § 233", title: "Tribal Court Jurisdiction" },
];

export default function SupremeCourtPage() {
  const { data: complaints } = useListComplaints();
  const { data: filings } = useListFilings();
  const { data: nfrs } = useListNfrs();
  const { data: events } = useListCalendarEvents();

  const openComplaints = (complaints ?? []).filter((c) => c.status === "open");
  const pendingFilings = (filings ?? []).filter((f) => f.filingStatus === "pending");
  const upcomingEvents = (events ?? []).slice(0, 5);

  return (
    <div data-testid="page-supreme-court">
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Sovereign Tribal Court</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">Mathias El Tribe Supreme Court</h1>
            <p className="text-muted-foreground mt-1">Office of the Chief Justice & Trustee — Full Faith and Credit</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-red-700 text-white">Tribal Court of General Jurisdiction</Badge>
            <Badge variant="outline" className="text-xs border-red-400 text-red-700">25 U.S.C. § 1302 (ICRA)</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Open Matters", value: openComplaints.length, href: "/complaints", color: "text-red-600" },
          { label: "Pending Filings", value: pendingFilings.length, href: "/filings", color: "text-amber-600" },
          { label: "NFR Documents", value: nfrs?.length ?? 0, href: "/nfr", color: "text-blue-600" },
          { label: "Court Calendar", value: upcomingEvents.length, href: "/calendar", color: "text-green-600" },
        ].map(({ label, value, href, color }) => (
          <Link key={label} href={href}>
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-serif font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Court Authority & Jurisdiction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The Mathias El Tribe Supreme Court exercises exclusive sovereign jurisdiction over all matters arising under tribal law,
                trust land disputes, ICWA child welfare proceedings, member rights enforcement, and complaints against state or federal actors.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {[
                  { title: "ICWA Proceedings", desc: "Mandatory notice and intervention in all child custody matters involving enrolled members" },
                  { title: "Trust Disputes", desc: "Exclusive jurisdiction over BIA trust land, allotments, and fiduciary matters" },
                  { title: "Member Rights", desc: "Enforcement of Indian Civil Rights Act protections for all enrolled members" },
                  { title: "NFR Review", desc: "Notice of Federal Review proceedings for actions affecting tribal sovereignty" },
                ].map(({ title, desc }) => (
                  <div key={title} className="p-3 rounded-md border bg-background">
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-widest">Active Matters</CardTitle>
                <Link href="/complaints">
                  <Button size="sm" variant="outline" className="text-xs">File New Matter</Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {openComplaints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open matters.</p>
                ) : openComplaints.slice(0, 5).map((c) => (
                  <Link key={c.id} href={`/complaints/${c.id}`}>
                    <div className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary">
                      <span className="text-sm truncate max-w-[180px]">{c.text?.substring(0, 50)}</span>
                      <Badge variant="destructive" className="ml-2 shrink-0 text-xs">{c.status}</Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/complaints" className="text-xs text-primary hover:underline block pt-1">All court matters →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-widest">Pending Filings</CardTitle>
                <Link href="/filings">
                  <Button size="sm" variant="outline" className="text-xs">New Filing</Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingFilings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending filings.</p>
                ) : pendingFilings.slice(0, 5).map((f) => (
                  <Link key={f.id} href={`/filings/${f.id}`}>
                    <div className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary">
                      <span className="text-sm truncate max-w-[180px]">Filing #{f.id}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 text-xs">{f.filingStatus}</Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/filings" className="text-xs text-primary hover:underline block pt-1">All filings →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest">Court Calendar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming hearings.</p>
                ) : upcomingEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm truncate max-w-[180px]">{e.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(e.date).toLocaleDateString()}</span>
                  </div>
                ))}
                <Link href="/calendar" className="text-xs text-primary hover:underline block pt-1">Full court calendar →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest">Controlling Statutes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {STATUTES.map((s) => (
                  <div key={s.code} className="py-2 border-b last:border-0">
                    <p className="text-xs font-mono text-muted-foreground">{s.code}</p>
                    <p className="text-sm">{s.title}</p>
                  </div>
                ))}
                <Link href="/law" className="text-xs text-primary hover:underline block pt-1">Full law library →</Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { href: "/complaints", label: "File Court Matter" },
                { href: "/nfr", label: "Notice of Federal Review" },
                { href: "/filings", label: "Submit Court Filing" },
                { href: "/documents", label: "Court Documents" },
                { href: "/classify", label: "Classification" },
                { href: "/law", label: "Law Library" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}>
                  <Button variant="outline" size="sm" className="w-full text-xs">{label}</Button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <WhatNextPanel compact />
        </div>
      </div>
    </div>
  );
}
