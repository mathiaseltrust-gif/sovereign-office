import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";

const ENTERPRISE_TYPES = [
  {
    title: "Construction & Infrastructure",
    code: "NAICS 236-238",
    desc: "General contracting, construction management, and infrastructure development eligible for federal Indian set-aside contracts.",
    certifications: ["SBA Indian Set-Aside", "BIA Business Financing", "HUBZone Eligible"],
  },
  {
    title: "Professional Services",
    code: "NAICS 541",
    desc: "Legal, accounting, consulting, and technical services owned and operated by enrolled members.",
    certifications: ["SBA 8(a) Eligible", "Indian-Owned Preference"],
  },
  {
    title: "Natural Resources & Agriculture",
    code: "NAICS 111-115",
    desc: "Farming, forestry, fishing, and natural resource enterprises on trust land or with tribal approval.",
    certifications: ["BIA Financing", "Trust Land Operations"],
  },
  {
    title: "Technology & Innovation",
    code: "NAICS 511-519",
    desc: "Technology companies, software development, and digital services owned by enrolled members.",
    certifications: ["SBA 8(a) Eligible", "Federal Contracting Preference"],
  },
  {
    title: "Retail & Consumer Services",
    code: "NAICS 441-559",
    desc: "Retail businesses, restaurants, and consumer services operated by enrolled members.",
    certifications: ["Tribal Business License", "Indian-Owned Preference"],
  },
  {
    title: "Healthcare & Wellness",
    code: "NAICS 621-623",
    desc: "Health clinics, wellness centers, and healthcare services complementary to the Medical Center.",
    certifications: ["IHS Contract Eligible", "Tribal Health Preference"],
  },
];

const LEGAL_FRAMEWORK = [
  { code: "25 C.F.R. § 140.3", title: "Indian Economic Enterprise Definition", desc: "Defines IEE eligibility — must be majority-owned and controlled by enrolled members" },
  { code: "25 U.S.C. § 1544", title: "BIA Business Financing Program", desc: "Federal loan guarantees and direct loans for enrolled member-owned businesses" },
  { code: "15 U.S.C. § 637(e)", title: "Indian Set-Aside Contracts", desc: "Federal contracting preference for Indian Economic Enterprises" },
  { code: "25 U.S.C. § 1521 et seq.", title: "Indian Business Development Program", desc: "BIA grant program for tribal and Indian-owned business development" },
];

const ELIGIBILITY_REQUIREMENTS = [
  "51% or more owned by enrolled tribal member(s)",
  "Management and daily operations controlled by enrolled member(s)",
  "BIA Form 5-5321 certification on file",
  "Tribal business license from Office of the Chief Justice & Trustee",
  "Compliance with 25 C.F.R. Part 140",
];

export default function IeePage() {
  return (
    <div data-testid="page-iee">
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">SBA-Certified Indian Economic Enterprise</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">Indian Economic Enterprises</h1>
            <p className="text-muted-foreground mt-1">I.E.E. — 25 C.F.R. § 140.3 — Sovereign Business Division</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-orange-700 text-white">SBA IEE Certified</Badge>
            <Badge variant="outline" className="text-xs border-orange-400 text-orange-700">25 C.F.R. § 140.3</Badge>
            <Badge variant="outline" className="text-xs">Federal Set-Aside Eligible</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Enterprise Types", value: ENTERPRISE_TYPES.length, color: "text-orange-600" },
          { label: "Legal Authorities", value: LEGAL_FRAMEWORK.length, color: "text-blue-600" },
          { label: "Eligibility Rules", value: ELIGIBILITY_REQUIREMENTS.length, color: "text-green-600" },
          { label: "Set-Aside Status", value: "Eligible", color: "text-green-600" },
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
          <Card className="border-orange-200 bg-orange-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Mission & Economic Self-Determination</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Indian Economic Enterprises (I.E.E.s) are tribal business enterprises majority-owned and controlled by enrolled
                members. They are eligible for SBA Indian set-aside contracts, BIA business financing, and federal Indian business
                preferences — building economic self-sufficiency and generational wealth within the tribe.
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">IEE Eligibility Requirements</p>
                <ul className="space-y-1">
                  {ELIGIBILITY_REQUIREMENTS.map((req, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-orange-600 font-bold shrink-0">✓</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Enterprise Categories</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ENTERPRISE_TYPES.map(({ title, code, desc, certifications }) => (
                <div key={title} className="p-3 rounded-md border space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{title}</p>
                    <span className="text-xs font-mono text-muted-foreground shrink-0">{code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <div className="flex flex-wrap gap-1 pt-1 border-t">
                    {certifications.map((c) => (
                      <Badge key={c} className="bg-orange-100 text-orange-800 text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Legal Framework</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {LEGAL_FRAMEWORK.map(({ code, title, desc }) => (
                <div key={code} className="py-2 border-b last:border-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-mono text-muted-foreground">{code}</p>
                  </div>
                  <p className="text-xs font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-orange-300 bg-orange-50/50">
            <CardContent className="pt-4">
              <p className="text-sm font-semibold text-orange-900 mb-2">Federal Contracting Advantage</p>
              <p className="text-xs text-orange-800">
                Certified Indian Economic Enterprises have preference in federal contracting under 15 U.S.C. § 637(e).
                Federal agencies may set aside contracts exclusively for IEEs without full and open competition.
                BIA may provide direct loans and loan guarantees under 25 U.S.C. § 1544 to support IEE operations.
                Contact the Office of the Chief Justice & Trustee to begin your IEE certification process.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Registration & Certification</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { href: "/filings", label: "Register Enterprise" },
                { href: "/instruments", label: "Business Trust Instrument" },
                { href: "/profile", label: "Member Verification" },
                { href: "/family-tree", label: "Lineage Documentation" },
                { href: "/law", label: "IEE Law Library" },
                { href: "/welfare", label: "Business Assistance" },
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
