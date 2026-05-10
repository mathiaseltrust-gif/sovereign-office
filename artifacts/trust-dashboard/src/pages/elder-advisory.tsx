import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { getRoleConfig } from "@/lib/role-config";
import { Star, Shield, TreePine, BookOpen, Scale, AlertCircle } from "lucide-react";

const AUTHORITY_ITEMS = [
  {
    icon: Star,
    title: "Cultural Authority",
    description:
      "Elders hold recognized authority over tribal cultural matters, ceremonies, and traditional practices. Cultural authority may be exercised by written declaration filed with the Office of the Chief Justice.",
    actions: ["Issue Cultural Declaration", "Review Cultural Records"],
  },
  {
    icon: Shield,
    title: "Advisory Authority",
    description:
      "The Elder Advisory role grants formal standing to advise the Chief Justice, Trustee, and tribal officers on matters of governance, law, and community welfare. Advisory opinions are entered into the official record.",
    actions: ["Submit Advisory Opinion", "View Opinion Log"],
  },
  {
    icon: TreePine,
    title: "Family Governance Authority",
    description:
      "Elders may convene family governance proceedings to resolve intra-family disputes, approve family decisions, and issue binding family governance orders under tribal law.",
    actions: ["Convene Governance Proceeding", "View Family Orders"],
  },
  {
    icon: BookOpen,
    title: "Lineage Correction Authority",
    description:
      "Elders hold the recognized right to submit corrections to tribal lineage and family tree records. Lineage corrections are reviewed by the Chief Justice and recorded in the official lineage registry.",
    actions: ["Submit Lineage Correction", "View Lineage Records"],
  },
];

const PROTECTIONS = [
  "Elders are immune from adverse tribal action without cause and Elder Council review.",
  "Elder advisory opinions carry formal weight in all tribal legal proceedings.",
  "Elders may not be removed from advisory roles without a supermajority vote of the tribal council.",
  "Elder cultural declarations are entered into the permanent tribal record.",
];

export default function ElderAdvisory() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const config = getRoleConfig(roles);

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Elder Advisory Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {config.roleLabel} — Cultural & Governance Authority
          </p>
        </div>

        <div className="bg-sidebar rounded-xl px-6 py-5 border border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <Scale className="w-5 h-5 text-sidebar-primary" />
            <p className="text-sm font-semibold text-sidebar-foreground">Mathias El Tribe Supreme Court — Elder Authority Registry</p>
          </div>
          <p className="text-xs text-sidebar-foreground/70 leading-relaxed">
            As a recognized Elder, your authority is formally registered with the Office of the Chief Justice & Trustee.
            The following panels reflect your active authorities and available actions under tribal law.
          </p>
        </div>

        <div className="space-y-3">
          {AUTHORITY_ITEMS.map(({ icon: Icon, title, description, actions }) => (
            <div key={title} className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 border-b border-card-border">
                <div className="w-9 h-9 rounded-lg bg-sidebar-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-sidebar-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <button
                      key={action}
                      className="px-3 py-1.5 text-xs font-medium border border-input rounded-lg hover:bg-muted transition-colors"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Elder Protections</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            {PROTECTIONS.map((p) => (
              <div key={p} className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">{p}</p>
              </div>
            ))}
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
