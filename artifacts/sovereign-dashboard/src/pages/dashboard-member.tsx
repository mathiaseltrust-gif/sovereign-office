import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import {
  BadgeCheck, UserCircle, TreePine, MessageSquare,
  CalendarDays, Heart, Bell, Sparkles,
} from "lucide-react";

interface MembershipSummary {
  membershipVerified: boolean;
  lineageVerified: boolean;
  entraVerified: boolean;
  memberType?: string;
}

const ITEMS = [
  {
    href: "/profile",
    label: "Profile & Tribal ID",
    description: "Manage your identity record, profile information, signature, and Tribal ID.",
    icon: UserCircle,
  },
  {
    href: "/family-tree",
    label: "Family Tree & Lineage",
    description: "View your lineage, family connections, and any records awaiting review.",
    icon: TreePine,
  },
  {
    href: "/complaints",
    label: "My Complaints",
    description: "Submit a matter for review and follow the status of complaints you filed.",
    icon: MessageSquare,
  },
  {
    href: "/calendar",
    label: "My Calendar",
    description: "Keep your important dates, birthdays, memorials, and personal reminders together.",
    icon: CalendarDays,
  },
  {
    href: "/welfare",
    label: "Welfare & Assistance",
    description: "Open member welfare tools and available assistance workflows.",
    icon: Heart,
  },
  {
    href: "/notifications",
    label: "Notifications",
    description: "Review membership, lineage, complaint, and Office updates addressed to you.",
    icon: Bell,
  },
  {
    href: "/intake-companion",
    label: "Companion",
    description: "Start a guided intake for identity, land, healthcare, welfare, or another concern.",
    icon: Sparkles,
  },
];

export default function MemberDashboard() {
  const { user, mode } = useAuth();
  const { data: membership } = useQuery<MembershipSummary>({
    queryKey: ["member-dashboard-membership"],
    queryFn: async () => {
      const token = getCurrentBearerToken();
      const res = await fetch("/api/membership/verify", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    retry: false,
  });

  return (
    <div data-testid="page-member-dashboard" className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Mathias El Tribe · Sovereign Office
        </p>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Your membership, family, personal records, and Office services in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/membership">
          <Card className="cursor-pointer hover:border-primary transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Membership</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <BadgeCheck className={membership?.membershipVerified ? "h-4 w-4 text-green-600" : "h-4 w-4 text-amber-600"} />
              <Badge variant={membership?.membershipVerified ? "default" : "secondary"}>
                {membership ? (membership.membershipVerified ? "Verified" : "Pending") : "Checking…"}
              </Badge>
            </CardContent>
          </Card>
        </Link>

        <Link href="/family-tree">
          <Card className="cursor-pointer hover:border-primary transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Lineage</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <TreePine className={membership?.lineageVerified ? "h-4 w-4 text-green-600" : "h-4 w-4 text-amber-600"} />
              <Badge variant={membership?.lineageVerified ? "default" : "secondary"}>
                {membership ? (membership.lineageVerified ? "Reviewed" : "Pending") : "Checking…"}
              </Badge>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Sign-in</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {mode === "microsoft" ? "Microsoft" : mode === "password" ? "Sovereign Office password" : "Secure session"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">My Office</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="cursor-pointer hover:border-primary transition-colors h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-semibold">{item.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
