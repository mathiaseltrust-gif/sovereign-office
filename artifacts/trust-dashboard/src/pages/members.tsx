import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, Clock, Shield } from "lucide-react";

async function fetchMembers(): Promise<Member[]> {
  const token = localStorage.getItem("trust_auth_token");
  const res = await fetch("/api/users", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  entraId?: string;
}

const ROLE_LABELS: Record<string, string> = {
  chief_justice: "Chief Justice & Trustee",
  trustee: "Trustee",
  officer: "Officer",
  medical_provider: "Medical Provider",
  elder: "Elder",
  community_elder: "Community Elder",
  family_elder: "Family Elder",
  grandparent_elder: "Grandparent Elder",
  adult: "Member (Adult)",
  minor: "Member (Minor)",
  visitor_media: "Visitor / Media",
  member: "Member",
  admin: "Administrator",
};

export default function Members() {
  const { data, isLoading, error } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: fetchMembers,
  });

  const members = data ?? [];

  const verified = members.filter((m) => m.entraId);
  const pending = members.filter((m) => !m.entraId);

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Member Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tribal membership records and role assignments.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Members</p>
              <p className="text-xl font-bold text-foreground">{members.length}</p>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entra Verified</p>
              <p className="text-xl font-bold text-foreground">{verified.length}</p>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Verification</p>
              <p className="text-xl font-bold text-foreground">{pending.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-card-border flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">All Members</h2>
          </div>

          {isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading members...</div>
          )}

          {error && (
            <div className="p-8 text-center text-sm text-destructive">
              Could not load members. Check API connection.
            </div>
          )}

          {!isLoading && !error && members.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No members found.</div>
          )}

          {!isLoading && members.length > 0 && (
            <div className="divide-y divide-border">
              {members.map((member) => {
                const initials = member.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) ?? "?";
                return (
                  <div key={member.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-sidebar flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-sidebar-foreground">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                      {member.entraId ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Verified</span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
