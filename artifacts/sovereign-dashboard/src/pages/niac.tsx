import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";
import { OrgDocumentsPanel } from "@/components/OrgDocumentsPanel";

const ADVOCACY_AREAS = [
  {
    title: "Federal Indian Policy Reform",
    status: "Active",
    desc: "Direct assertion of tribal sovereign authority in federal Indian policy — holding the United States to its trust responsibility and compelling legislative recognition of inherent tribal rights.",
  },
  {
    title: "ICWA Preservation",
    status: "Active",
    desc: "Political defense of the Indian Child Welfare Act as a self-executing protection of tribal sovereignty over child custody and placement proceedings.",
  },
  {
    title: "Indigenous Civic Self-Determination",
    status: "Active",
    desc: "Advancing the inherent right of indigenous peoples to participate in governance on their own terms — locally, tribally, and nationally — through self-organized political expression and community mobilization.",
  },
  {
    title: "Economic Sovereignty & Development",
    status: "Active",
    desc: "Policy advocacy for Indian set-aside contract access, sovereign business financing, and removal of regulatory barriers to tribal economic self-sufficiency.",
  },
  {
    title: "Land & Water Rights",
    status: "Active",
    desc: "Political action on ancestral land reclamation, water rights adjudication, and treaty enforcement — asserting the tribe's original and continuing title under federal law.",
  },
  {
    title: "Tribal Health Sovereignty",
    status: "Active",
    desc: "Asserting the tribe's right to control and direct health services for enrolled members — advocating for adequate federal resources as a fulfillment of treaty obligations, not as a government favor.",
  },
];

const LEGAL_STANDING = [
  { label: "Committee Type", value: "Indigenous Political Committee" },
  { label: "Tax Instrument", value: "26 U.S.C. § 527 — Political Organization" },
  { label: "Annual Disclosure", value: "Form 8872 filed with IRS" },
  { label: "Contribution Treatment", value: "Not income — § 527 exempt" },
  { label: "Independent Expenditures", value: "Permitted with required disclosure" },
  { label: "Candidate Independence", value: "Fully independent — not coordinated" },
];

const DISCLAIMER = "Paid for by the National Indigenous American Committee (American Indian Party). Not authorized by any candidate or candidate's committee.";

export default function NiacPage() {
  return (
    <div data-testid="page-niac">
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Indigenous Political Committee — Affiliate of the Mathias El Tribe</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">National Indigenous American Committee</h1>
            <p className="text-muted-foreground mt-1">Also Known as the <strong>American Indian Party</strong> — Advancing Indigenous Sovereignty Through Self-Determined Political Action</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-purple-700 text-white">American Indian Party</Badge>
            <Badge variant="outline" className="text-xs border-purple-400 text-purple-700">26 U.S.C. § 527</Badge>
            <Badge variant="outline" className="text-xs">Affiliate — Mathias El Tribe</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Advocacy Areas", value: ADVOCACY_AREAS.length, color: "text-purple-600" },
          { label: "Political Standing", value: "Active", color: "text-green-600" },
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
                The National Indigenous American Committee (NIAC) — also known as the <strong>American Indian Party</strong> — is
                an affiliate of the Mathias El Tribe organized as an indigenous political committee under 26 U.S.C. § 527.
                NIAC exercises the tribe's inherent political authority through self-determined advocacy, direct policy
                engagement, and the defense of federal Indian law. It acts not as a petitioner seeking recognition from
                external government, but as a sovereign political body asserting rights that are inherent,
                self-executing, and self-evident.
              </p>
              <div className="p-3 rounded-md border bg-background">
                <p className="text-xs font-mono text-muted-foreground mb-1">Legal Instrument</p>
                <p className="text-sm">26 U.S.C. § 527 — Political Organization Tax Treatment</p>
                <p className="text-xs text-muted-foreground mt-1">
                  NIAC utilizes § 527 as a legal instrument of organizational standing. Contributions are not
                  deductible as charitable contributions for federal income tax purposes.
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
              <CardTitle className="text-sm uppercase tracking-widest">Legal Standing & Reporting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {LEGAL_STANDING.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium text-right max-w-[200px]">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <OrgDocumentsPanel orgId="niac" orgName="National Indigenous American Committee" />

          <Card className="border-purple-300 bg-purple-50/50">
            <CardContent className="pt-4 space-y-2">
              <p className="text-xs font-semibold text-purple-900 uppercase tracking-widest">Political Disclosure</p>
              <p className="text-xs text-purple-800">{DISCLAIMER}</p>
              <p className="text-xs text-purple-700 pt-1">
                Contributions to NIAC are not deductible as charitable contributions for federal income tax purposes.
                NIAC files Form 8872 with the IRS annually disclosing contributions and expenditures in excess of $200.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Member Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { href: "/complaints", label: "File Policy Complaint" },
                { href: "/filings", label: "Political Filing" },
                { href: "/calendar", label: "Advocacy Events" },
                { href: "/law", label: "Federal Indian Policy Law" },
                { href: "/profile", label: "Member Profile" },
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
