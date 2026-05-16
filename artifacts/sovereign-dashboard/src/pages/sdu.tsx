import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";
import { OrgDocumentsPanel } from "@/components/OrgDocumentsPanel";

const PROGRAMS = [
  {
    title: "Sovereignty Literacy",
    level: "Foundational",
    desc: "Core education on tribal sovereignty, federal Indian law, treaty rights, and the legal framework of self-determination. Designed so every enrolled member understands their rights and standing.",
  },
  {
    title: "Federal Indian Law Practicum",
    level: "Intermediate",
    desc: "Deep study of BIA regulations, Indian Civil Rights Act, ICWA, ISDEAA, and trust responsibilities. Prepares members for advocacy, compliance, and legal self-representation.",
  },
  {
    title: "Tribal Business & Enterprise",
    level: "Applied",
    desc: "Practical education on forming and operating Indian Economic Enterprises, SBA certification, BIA financing, and sovereign contracting. Includes business planning and model canvas workshops.",
  },
  {
    title: "Self-Determination Administration",
    level: "Advanced",
    desc: "Training for tribal officers and administrators on contracting and compacting under ISDEAA, program management, and the administration of federal programs under tribal authority.",
  },
  {
    title: "Cultural Preservation & Heritage",
    level: "Community",
    desc: "Programs preserving language, oral history, ancestral memory, and cultural practice — integrating indigenous knowledge systems with contemporary education.",
  },
  {
    title: "Health & Wellness Education",
    level: "Community",
    desc: "Health literacy rooted in tribal sovereignty — covering Indian Health Service rights, Medicaid Indian provisions, IHCIA, and member wellness resources available under federal trust responsibility.",
  },
];

const LEGAL_FRAMEWORK = [
  { code: "25 U.S.C. § 5321", title: "ISDEAA — Self-Determination Contracts", desc: "Authorizes tribes to administer federal education programs through self-determination contracts, replacing BIA-run programs with tribal-run ones." },
  { code: "25 U.S.C. § 5322", title: "ISDEAA — Self-Governance Compacts", desc: "Allows tribes to compact entire program areas including education into block grants administered under tribal authority." },
  { code: "20 U.S.C. § 7441", title: "Native American Language Programs", desc: "Federal support for indigenous language education and preservation programs." },
  { code: "26 U.S.C. § 501(c)(3)", title: "Nonprofit Tax-Exempt Status", desc: "SDU operates as a tax-exempt nonprofit. Donations are tax-deductible and the institution may receive foundation grants and federal education funding." },
];

const MEMBER_BENEFITS = [
  "Free access to all SDU course materials and certifications",
  "Priority enrollment in federal Indian law practicum",
  "Professional development credits for tribal officers",
  "Credentials recognized by the Office of the Chief Justice & Trustee",
  "Continuing education toward enrollment and advocacy roles",
  "Access to SDU digital library and sovereignty resource archive",
];

export default function SduPage() {
  return (
    <div data-testid="page-sdu">
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Nonprofit Indigenous Education System — ISDEAA</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">Self Determination University</h1>
            <p className="text-muted-foreground mt-1">SDU — 25 U.S.C. § 5321 — Educating Members in Sovereign Rights & Self-Determined Practice</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-teal-700 text-white">Nonprofit — 501(c)(3)</Badge>
            <Badge variant="outline" className="text-xs border-teal-500 text-teal-700">25 U.S.C. § 5321 ISDEAA</Badge>
            <Badge variant="outline" className="text-xs">Mathias El Tribe Education</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Programs", value: PROGRAMS.length, color: "text-teal-600" },
          { label: "Legal Authorities", value: LEGAL_FRAMEWORK.length, color: "text-blue-600" },
          { label: "Member Benefits", value: MEMBER_BENEFITS.length, color: "text-green-600" },
          { label: "Status", value: "Active", color: "text-green-600" },
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

          <Card className="border-teal-200 bg-teal-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Mission & Purpose</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Self Determination University (SDU) is the nonprofit education arm of the Mathias El Tribe, organized under
                the Indian Self-Determination and Education Assistance Act (ISDEAA). SDU provides culturally grounded education,
                professional development, and sovereignty literacy to enrolled members and eligible indigenous communities —
                equipping them with the knowledge, credentials, and practical tools to exercise their inherent rights,
                operate sovereign institutions, and build generational self-sufficiency.
              </p>
              <div className="p-3 rounded-md border bg-background">
                <p className="text-xs font-mono text-muted-foreground mb-1">Governing Instrument</p>
                <p className="text-sm">25 U.S.C. § 5321 — ISDEAA Self-Determination Contracts</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Under ISDEAA, the Mathias El Tribe may contract or compact to administer federal education programs
                  directly. SDU is the institutional vehicle for that authority — replacing external program delivery
                  with tribally-run, culturally competent education.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Education Programs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {PROGRAMS.map(({ title, level, desc }) => (
                <div key={title} className="p-3 rounded-md border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <Badge className="bg-teal-100 text-teal-800 text-xs">{level}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">How to Start Your Own — Legal Framework</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground mb-2">
                Any tribe or tribal entity can establish an indigenous education nonprofit under these authorities.
                SDU's structure is replicable — organized as a 501(c)(3) with ISDEAA contracting authority,
                it can receive federal education dollars directly and deliver programs tribally.
              </p>
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

          <Card className="border-teal-200 bg-teal-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest">Benefits for Enrolled Members</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {MEMBER_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex gap-2 text-sm">
                    <span className="text-teal-600 font-bold shrink-0">✓</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <OrgDocumentsPanel orgId="sdu" orgName="Self Determination University" />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Member Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { href: "/sdu/definitions", label: "Definition Literacy" },
                { href: "/profile", label: "Member Enrollment" },
                { href: "/law", label: "Law Library" },
                { href: "/business-canvas", label: "Business Education" },
                { href: "/tribal-id", label: "Credentials" },
                { href: "/notifications", label: "Education Alerts" },
                { href: "/org", label: "All Organizations" },
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
