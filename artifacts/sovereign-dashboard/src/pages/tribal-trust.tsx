import { useListInstruments, useListFilings } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";

const TRUST_AUTHORITIES = [
  { title: "Indian Reorganization Act", code: "25 U.S.C. § 5108", desc: "Authorizes federal acquisition and protection of tribal trust land" },
  { title: "Trust Fund Management", code: "25 U.S.C. § 162a", desc: "BIA fiduciary obligation to manage tribal and individual Indian trust funds" },
  { title: "American Indian Probate Reform", code: "25 U.S.C. § 2201 et seq.", desc: "Governs inheritance of trust land and assets" },
  { title: "Trust Land Regulations", code: "25 C.F.R. Part 115", desc: "Regulatory framework for individual Indian money accounts" },
];

const TRUST_PROGRAMS = [
  { title: "Beneficiary Designation", desc: "Document and register your trust beneficiary status with the Office" },
  { title: "Trust Land Claims", desc: "File instruments for trust land recognition, allotments, and improvements" },
  { title: "Asset Protection", desc: "Federal trust protections against state taxation, liens, and encumbrances" },
  { title: "Inheritance Planning", desc: "Trust inheritance documentation under AIPRA and tribal succession law" },
];

export default function TribalTrustPage() {
  const { data: instruments } = useListInstruments();
  const { data: filings } = useListFilings();

  const trustInstruments = instruments ?? [];
  const trustFilings = (filings ?? []).filter((f) => f.filingStatus === "pending");

  return (
    <div data-testid="page-tribal-trust">
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Federal Indian Trust</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">Mathias El Tribe Trust</h1>
            <p className="text-muted-foreground mt-1">Bureau of Indian Affairs — Federal Fiduciary — 25 U.S.C. § 5108</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-amber-700 text-white">Federal Indian Trust</Badge>
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">BIA Fiduciary Oversight</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Trust Instruments", value: trustInstruments.length, href: "/instruments", color: "text-amber-600" },
          { label: "Pending Filings", value: trustFilings.length, href: "/filings", color: "text-blue-600" },
          { label: "Active Programs", value: TRUST_PROGRAMS.length, href: "/welfare", color: "text-green-600" },
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
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Trust Mission & Federal Duty</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                The Mathias El Tribe Trust holds and manages trust assets, land, and financial instruments on behalf of enrolled members
                under the federal government's solemn fiduciary duty. Trust assets are protected from state taxation, alienation,
                and encumbrance without federal approval.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TRUST_PROGRAMS.map(({ title, desc }) => (
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
                <CardTitle className="text-sm uppercase tracking-widest">Trust Instruments</CardTitle>
                <Link href="/instruments">
                  <Button size="sm" variant="outline" className="text-xs">New Instrument</Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {trustInstruments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trust instruments on file.</p>
                ) : trustInstruments.slice(0, 6).map((i) => (
                  <Link key={i.id} href={`/instruments/${i.id}`}>
                    <div className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:text-primary">
                      <span className="text-sm font-medium truncate max-w-[160px]">{i.title}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 text-xs">{i.status}</Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/instruments" className="text-xs text-primary hover:underline block pt-1">All instruments →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest">Controlling Law</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {TRUST_AUTHORITIES.map((s) => (
                  <div key={s.code} className="py-2 border-b last:border-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-mono text-muted-foreground">{s.code}</p>
                    </div>
                    <p className="text-xs font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-300 bg-amber-50/50">
            <CardContent className="pt-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">Federal Trust Protection Notice</p>
              <p className="text-xs text-amber-800">
                All trust assets held by the Mathias El Tribe Trust are protected under federal law from state taxation,
                state court jurisdiction, alienation, and encumbrance without BIA approval. Any attempt by a state court
                or creditor to attach, lien, or encumber trust assets must be immediately reported to the Chief Justice & Trustee
                for federal assertion of trust immunity.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { href: "/instruments", label: "File Trust Instrument" },
                { href: "/filings", label: "Submit Filing" },
                { href: "/welfare", label: "Welfare Instruments" },
                { href: "/family-tree", label: "Lineage & Inheritance" },
                { href: "/documents", label: "Court Documents" },
                { href: "/law", label: "Indian Trust Law" },
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
