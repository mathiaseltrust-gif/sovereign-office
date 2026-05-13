import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";

const AUTHORITY_ITEMS = [
  {
    title: "Cultural Authority",
    color: "bg-amber-50 border-amber-200",
    badgeClass: "bg-amber-100 text-amber-800",
    description:
      "Elders hold recognized authority over tribal cultural matters, ceremonies, and traditional practices. Cultural authority may be exercised by written declaration filed with the Office of the Chief Justice.",
    actions: [
      { label: "Submit Advisory Opinion", href: "/complaints" },
      { label: "View Law Library", href: "/law" },
    ],
  },
  {
    title: "Advisory Authority",
    color: "bg-blue-50 border-blue-200",
    badgeClass: "bg-blue-100 text-blue-800",
    description:
      "The Elder Advisory role grants formal standing to advise the Chief Justice, Trustee, and tribal officers on matters of governance, law, and community welfare. Advisory opinions are entered into the official record.",
    actions: [
      { label: "File Complaint / Opinion", href: "/complaints" },
      { label: "View Court Documents", href: "/documents" },
    ],
  },
  {
    title: "Family Governance Authority",
    color: "bg-green-50 border-green-200",
    badgeClass: "bg-green-100 text-green-800",
    description:
      "Elders may convene family governance proceedings to resolve intra-family disputes, approve family decisions, and issue binding family governance orders under tribal law.",
    actions: [
      { label: "Family Governance", href: "/family-governance" },
      { label: "Family Tree & Lineage", href: "/family-tree" },
    ],
  },
  {
    title: "Lineage Correction Authority",
    color: "bg-purple-50 border-purple-200",
    badgeClass: "bg-purple-100 text-purple-800",
    description:
      "Elders hold the recognized right to submit corrections to tribal lineage and family tree records. Lineage corrections are reviewed by the Chief Justice and recorded in the official lineage registry.",
    actions: [
      { label: "Open Family Tree", href: "/family-tree" },
      { label: "Lineage Registry", href: "/admin/lineage-import" },
    ],
  },
];

const PROTECTIONS = [
  "Elders are immune from adverse tribal action without cause and Elder Council review.",
  "Elder advisory opinions carry formal weight in all tribal legal proceedings.",
  "Elders may not be removed from advisory roles without a supermajority vote of the tribal council.",
  "Elder cultural declarations are entered into the permanent tribal record.",
];

const ROLE_LABELS: Record<string, string> = {
  elder: "Tribal Elder",
  trustee: "Chief Justice & Trustee",
  officer: "Officer",
  sovereign_admin: "Sovereign Administrator",
  member: "Member",
};

export default function ElderAdvisoryPage() {
  const { activeRole, user } = useAuth();
  const roleLabel = ROLE_LABELS[activeRole] ?? "Member";
  const isElder = activeRole === "elder" || activeRole === "trustee" || activeRole === "sovereign_admin";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Sovereign Office</p>
          <h1 className="text-3xl font-serif font-bold">Elder Advisory Panel</h1>
          <p className="text-muted-foreground mt-1">{roleLabel} — Cultural &amp; Governance Authority</p>
        </div>
        <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 h-fit">
          Elder Authority Registry
        </Badge>
      </div>

      {/* Role context card */}
      <Card className="bg-sidebar/40 border-sidebar-border">
        <CardContent className="py-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-lg shrink-0">
            {(user?.name ?? roleLabel).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm">{user?.name ?? "Current User"}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-prose">
              Elder authority is recognized under the Mathias El Tribe's sovereign governance structure.
              All authorities listed below are exercisable by documented declaration or formal filing.
            </p>
          </div>
        </CardContent>
      </Card>

      {!isElder && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-4 text-sm text-amber-800">
            Elder Advisory authorities are available to Elders, the Chief Justice, and Sovereign Administrators.
            Your current role ({roleLabel}) grants read-only access to this panel.
          </CardContent>
        </Card>
      )}

      {/* Authority cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {AUTHORITY_ITEMS.map(({ title, color, badgeClass, description, actions }) => (
          <Card key={title} className={`${color} border`}>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge className={`${badgeClass} text-xs font-semibold`}>{title}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              {isElder && (
                <div className="flex gap-2 flex-wrap">
                  {actions.map(({ label, href }) => (
                    <Link key={href} href={href}>
                      <Button variant="outline" size="sm" className="text-xs h-7">{label}</Button>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Elder protections */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Elder Protections Under Tribal Law</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {PROTECTIONS.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Link href="/family-tree"><Button variant="outline" size="sm">Family Tree &amp; Lineage</Button></Link>
        <Link href="/supreme-court"><Button variant="outline" size="sm">Supreme Court</Button></Link>
        <Link href="/complaints"><Button variant="outline" size="sm">File a Matter</Button></Link>
      </div>
    </div>
  );
}
