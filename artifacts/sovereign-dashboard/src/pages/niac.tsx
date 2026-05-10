import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";

const ADVOCACY_AREAS = [
  {
    title: "Federal Indian Policy Reform",
    status: "Active",
    desc: "Advocacy for improved federal trust management, BIA accountability, and tribal sovereignty recognition in federal legislation.",
  },
  {
    title: "ICWA Preservation",
    status: "Active",
    desc: "Political advocacy to defend and strengthen the Indian Child Welfare Act against state and federal legislative attacks.",
  },
  {
    title: "Voting Rights & Civic Engagement",
    status: "Active",
    desc: "Voter registration drives, ballot access campaigns, and civic education for indigenous communities.",
  },
  {
    title: "Economic Development Policy",
    status: "Active",
    desc: "Advocacy for Indian set-aside contract expansions, BIA business financing reform, and IEE regulatory improvements.",
  },
  {
    title: "Land & Water Rights",
    status: "Active",
    desc: "Political action on ancestral land reclamation, water rights adjudication, and treaty enforcement at the federal level.",
  },
  {
    title: "Healthcare Access",
    status: "Active",
    desc: "Lobbying for improved IHS funding, Medicaid Indian provisions, and health equity for indigenous people.",
  },
];

const FEC_COMPLIANCE = [
  { label: "Organization Type", value: "Section 527 Political Organization" },
  { label: "FEC Registration", value: "Registered — 52 U.S.C. § 30101" },
  { label: "Disclosure", value: "Annual Form 8872 filed with IRS" },
  { label: "Contribution Limits", value: "No limit — Section 527 exempt" },
  { label: "Independent Expenditures", value: "Permitted with FEC disclosure" },
  { label: "Candidate Coordination", value: "Prohibited — independent only" },
];

const DISCLAIMER = "Paid for by the National Indigenous American Committee. Not authorized by any candidate or candidate's committee.";

export default function NiacPage() {
  return (
    <div data-testid="page-niac">
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Section 527 Political Organization</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">National Indigenous American Committee</h1>
            <p className="text-muted-foreground mt-1">NIAC — FEC Registered — Advancing Indigenous Sovereignty Through Political Action</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-purple-700 text-white">Section 527 Political Org</Badge>
            <Badge variant="outline" className="text-xs border-purple-400 text-purple-700">26 U.S.C. § 527</Badge>
            <Badge variant="outline" className="text-xs">FEC Registered</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Advocacy Areas", value: ADVOCACY_AREAS.length, color: "text-purple-600" },
          { label: "FEC Status", value: "Active", color: "text-green-600" },
          { label: "Org Type", value: "§ 527", color: "text-blue-600" },
          { label: "Reporting", value: "Current", color: "text-green-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-serif font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Mission & Political Purpose</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                The National Indigenous American Committee (NIAC) is a federally registered Section 527 political organization
                dedicated to advancing indigenous sovereignty and federal Indian law through organized political advocacy,
                voter registration, and federal policy engagement. NIAC operates independently of any candidate or party.
              </p>
              <div className="p-3 rounded-md border bg-background">
                <p className="text-xs font-mono text-muted-foreground mb-1">Legal Authority</p>
                <p className="text-sm">26 U.S.C. § 527 — Political Organization Tax Treatment</p>
                <p className="text-xs text-muted-foreground mt-1">
                  NIAC is exempt from federal income tax on political organization taxable income.
                  Contributions are not deductible as charitable contributions for federal tax purposes.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Active Advocacy Areas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ADVOCACY_AREAS.map(({ title, status, desc }) => (
                <div key={title} className="p-3 rounded-md border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <Badge className="bg-purple-100 text-purple-800 text-xs">{status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">FEC Compliance & Reporting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {FEC_COMPLIANCE.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium text-right max-w-[200px]">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-purple-300 bg-purple-50/50">
            <CardContent className="pt-4 space-y-2">
              <p className="text-xs font-semibold text-purple-900 uppercase tracking-widest">Important Political Disclaimer</p>
              <p className="text-xs text-purple-800">{DISCLAIMER}</p>
              <p className="text-xs text-purple-700 pt-1">
                Contributions to NIAC are not deductible as charitable contributions for federal income tax purposes.
                NIAC files Form 8872 with the IRS annually disclosing contributions and expenditures in excess of $200.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Member Civic Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { href: "/complaints", label: "File Policy Complaint" },
                { href: "/filings", label: "Political Filing" },
                { href: "/calendar", label: "Advocacy Events" },
                { href: "/law", label: "Federal Indian Policy Law" },
                { href: "/profile", label: "Member Registration" },
                { href: "/notifications", label: "Advocacy Alerts" },
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
