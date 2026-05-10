import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { getRoleConfig } from "@/lib/role-config";
import { TreePine, Users, ScrollText, Shield, ChevronRight } from "lucide-react";

const GOVERNANCE_SECTIONS = [
  {
    icon: Users,
    title: "Household Registry",
    description: "View and manage the members registered under your family household record.",
    action: "View Household",
  },
  {
    icon: TreePine,
    title: "Family Tree & Lineage",
    description: "Review your family's lineage tree as recorded in the tribal registry.",
    action: "View Lineage",
  },
  {
    icon: ScrollText,
    title: "Family Governance Orders",
    description: "View active and historical family governance orders issued within your family unit.",
    action: "View Orders",
  },
  {
    icon: Shield,
    title: "Dependent Status",
    description: "Review the tribal membership status of all dependents in your household.",
    action: "View Dependents",
  },
];

export default function FamilyGovernance() {
  const { user } = useAuth();
  const config = getRoleConfig(user?.roles ?? []);

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Family Governance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Family records, lineage, and governance matters for {user?.name}.
          </p>
        </div>

        <div className="bg-sidebar rounded-xl px-6 py-5 border border-sidebar-border">
          <p className="text-xs font-semibold text-sidebar-primary uppercase tracking-widest mb-1">Your Role</p>
          <p className="text-base font-bold text-sidebar-foreground">{config.roleLabel}</p>
          <p className="text-xs text-sidebar-foreground/60 mt-1 leading-relaxed">
            Family governance records are maintained under the authority of the Office of the Chief Justice & Trustee.
            Your role grants access to the sections listed below.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {GOVERNANCE_SECTIONS.map(({ icon: Icon, title, description, action }) => (
            <div key={title} className="bg-card border border-card-border rounded-xl shadow-sm p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>
              <button className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline self-start">
                {action} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ))}
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
