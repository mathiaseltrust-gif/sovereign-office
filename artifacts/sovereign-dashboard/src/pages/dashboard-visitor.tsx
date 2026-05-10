import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const PUBLIC_RESOURCES = [
  { title: "Public Records Search", desc: "Search publicly available court records, filings, and instruments.", href: "/search" },
  { title: "Tribal Law Library", desc: "Browse publicly accessible tribal laws, statutes, and legal doctrines.", href: "/law" },
  { title: "Submit Press Inquiry", desc: "Submit a media inquiry or press access request.", href: "/complaints" },
];

export default function VisitorDashboard() {
  return (
    <div data-testid="page-visitor-dashboard" className="max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-serif font-bold text-foreground">Visitor & Media Portal</h1>
          <Badge variant="outline" className="border-amber-400 text-amber-700">Restricted Access</Badge>
        </div>
        <p className="text-muted-foreground mt-2">
          Welcome to the Mathias El Tribe Visitor Portal. Access is limited to publicly available information only.
          For tribal member services, please contact the Sovereign Office of the Chief Justice & Trustee.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">Notice to Visitors and Media</p>
          <p className="text-sm text-amber-700">
            This portal is governed by the inherent sovereign authority of the Mathias El Tribe. All visitors
            and media representatives are subject to tribal protocols. Unauthorized access to restricted areas,
            recording without consent, or misrepresentation of tribal matters may result in immediate removal
            and referral to the Office of the Chief Justice.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Available Resources</h2>
        {PUBLIC_RESOURCES.map((r) => (
          <Link key={r.title} href={r.href}>
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 ml-4">Open</Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest">Contact the Sovereign Office</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">For press credentials, official media inquiries, or tribal affairs assistance:</p>
          <div className="text-sm space-y-1">
            <p className="font-medium">Office of the Chief Justice & Trustee</p>
            <p className="text-muted-foreground">Mathias El Tribe — Sovereign Seat of Government</p>
            <p className="text-muted-foreground">All requests submitted through this portal are reviewed by tribal staff.</p>
          </div>
          <div className="pt-2">
            <Link href="/complaints">
              <Button size="sm">Submit Inquiry or Request</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
