import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";

const PROGRAMS = [
  {
    title: "Educational Scholarships",
    category: "Education",
    desc: "Post-secondary scholarships and vocational training grants for enrolled members and their dependents.",
    eligibility: "Enrolled member or dependent",
  },
  {
    title: "Emergency Housing Assistance",
    category: "Housing",
    desc: "Emergency rental and utility assistance for members facing housing insecurity.",
    eligibility: "Enrolled member with verified need",
  },
  {
    title: "Cultural Preservation Grants",
    category: "Culture",
    desc: "Funding for language preservation, traditional arts, ceremonies, and oral history documentation.",
    eligibility: "Enrolled member or tribal program",
  },
  {
    title: "Health & Wellness Program",
    category: "Health",
    desc: "Supplemental health services, alternative therapies, and wellness equipment for members not covered by Indian Health.",
    eligibility: "Enrolled member",
  },
  {
    title: "Small Business Seed Grants",
    category: "Economic",
    desc: "Seed funding for enrolled member-owned small businesses aligned with tribal economic development.",
    eligibility: "Enrolled member, IEE eligible",
  },
  {
    title: "Elder Care Support",
    category: "Welfare",
    desc: "In-home care assistance, transportation, and daily living support for enrolled elders.",
    eligibility: "Enrolled member age 60+",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Education: "bg-blue-100 text-blue-800",
  Housing: "bg-green-100 text-green-800",
  Culture: "bg-purple-100 text-purple-800",
  Health: "bg-red-100 text-red-800",
  Economic: "bg-orange-100 text-orange-800",
  Welfare: "bg-amber-100 text-amber-800",
};

const COMPLIANCE_ITEMS = [
  { label: "IRS 990 Filing", status: "Current", detail: "Annual informational return — Form 990" },
  { label: "State Registration", status: "Active", detail: "Non-profit registration maintained" },
  { label: "Donor Disclosure", status: "Compliant", detail: "Donors receive written acknowledgment for gifts ≥ $250" },
  { label: "Public Benefit Test", status: "Satisfied", detail: "Primarily serves public charitable class" },
];

export default function CharitableTrustPage() {
  return (
    <div data-testid="page-charitable-trust">
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">501(c)(3) Non-Profit Organization</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">Mathias El Tribe Charitable Trust</h1>
            <p className="text-muted-foreground mt-1">Tax-Exempt Charitable Organization — Donations are tax-deductible</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-green-700 text-white">501(c)(3) Certified</Badge>
            <Badge variant="outline" className="text-xs border-green-500 text-green-700">26 U.S.C. § 501(c)(3)</Badge>
            <Badge variant="outline" className="text-xs">IRS Tax-Exempt</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Programs", value: PROGRAMS.length, color: "text-green-600" },
          { label: "Compliance Items", value: COMPLIANCE_ITEMS.length, color: "text-blue-600" },
          { label: "Tax Deductible", value: "100%", color: "text-amber-600" },
          { label: "Federal Status", value: "Active", color: "text-green-600" },
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
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Mission & Tax-Exempt Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                The Mathias El Tribe Charitable Trust is a federally recognized 501(c)(3) non-profit organization advancing
                education, health, housing, and cultural preservation for enrolled members and eligible indigenous families.
                All contributions are tax-deductible to the full extent permitted by law under 26 U.S.C. § 170.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Organization Type", value: "Public Charity" },
                  { label: "Legal Basis", value: "26 U.S.C. § 501(c)(3)" },
                  { label: "Deductibility", value: "26 U.S.C. § 170" },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2 rounded-md bg-background border text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xs font-semibold mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Charitable Programs</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PROGRAMS.map(({ title, category, desc, eligibility }) => (
                <div key={title} className="p-3 rounded-md border space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{title}</p>
                    <Badge className={`${CATEGORY_COLORS[category] ?? ""} text-xs shrink-0`}>{category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    <span className="font-medium">Eligibility:</span> {eligibility}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">IRS Compliance Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {COMPLIANCE_ITEMS.map(({ label, status, detail }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 text-xs shrink-0">{status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-green-300 bg-green-50/50">
            <CardContent className="pt-4">
              <p className="text-sm font-semibold text-green-900 mb-2">Donor Notice — 26 U.S.C. § 170</p>
              <p className="text-xs text-green-800">
                The Mathias El Tribe Charitable Trust is exempt from federal income tax under Internal Revenue Code § 501(c)(3).
                Contributions to the Trust are deductible under § 170. The Trust is also qualified to receive tax deductible bequests,
                devises, transfers, or gifts under section 2055, 2106, or 2522.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { href: "/welfare", label: "Apply for Assistance" },
                { href: "/filings", label: "Program Enrollment Filing" },
                { href: "/instruments", label: "Trust Instruments" },
                { href: "/family-tree", label: "Verify Lineage Eligibility" },
                { href: "/profile", label: "Member Profile" },
                { href: "/law", label: "Charitable Trust Law" },
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
