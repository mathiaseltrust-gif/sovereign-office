import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

const ITEMS = [
  { href: "/hub", label: "Main Hub" },
  { href: "/profile", label: "Profile" },
  { href: "/membership", label: "Membership" },
  { href: "/family-tree", label: "Family Tree" },
  { href: "/complaints", label: "Complaints" },
  { href: "/nfr", label: "NFR" },
  { href: "/calendar", label: "Calendar" },
  { href: "/welfare", label: "Welfare" },
];

export default function MemberDashboard() {
  return (
    <div data-testid="page-member-dashboard" className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Member Portal</h1>
        <p className="text-muted-foreground mt-1">Fast load mode. Open a module to load its records.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Open module</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
