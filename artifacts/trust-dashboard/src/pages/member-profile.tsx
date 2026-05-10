import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { getRoleConfig } from "@/lib/role-config";
import { UserCircle, Mail, Shield, Scale } from "lucide-react";

export default function MemberProfile() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const config = getRoleConfig(roles);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Your tribal membership record and standing.</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-sidebar px-6 py-8 flex items-center gap-5 border-b border-sidebar-border">
            <div className="w-16 h-16 rounded-full bg-sidebar-primary flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-sidebar-primary-foreground">{initials}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-sidebar-foreground">{user?.name}</p>
              <p className="text-sm text-sidebar-primary font-medium">{config.roleLabel}</p>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5">{config.roleSubtitle}</p>
            </div>
          </div>

          <div className="divide-y divide-card-border">
            <div className="flex items-center gap-4 px-6 py-4">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 px-6 py-4">
              <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Access Roles</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 bg-sidebar-primary/10 text-sidebar-primary text-xs font-medium rounded-full capitalize"
                    >
                      {r.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <UserCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Member ID</p>
                <p className="text-sm font-medium text-foreground font-mono">{user?.id}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border">
            <Scale className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Tribal Standing</h2>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-sm font-medium text-foreground">Active Member — Mathias El Tribe</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your membership is recognized under the sovereign authority of the Mathias El Tribe. For changes to your membership record,
              contact the Office of the Chief Justice & Trustee.
            </p>
          </div>
        </div>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Mathias El Tribe — A Sovereign Nation Exercising Inherent Authority Under Tribal, Federal, and International Law.
          </p>
        </div>
      </div>
    </Layout>
  );
}
