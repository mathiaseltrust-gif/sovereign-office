import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Globe, Heart, Building2, ChevronRight } from "lucide-react";

type PanelType = "niac" | "charitable-trust" | "iee";

const PANEL_CONFIG: Record<PanelType, {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  description: string;
  sections: Array<{ label: string; detail: string }>;
}> = {
  niac: {
    icon: Globe,
    title: "NIAC Panel",
    subtitle: "National Indigenous Affairs Council",
    description:
      "The National Indigenous Affairs Council coordinates inter-tribal affairs, federal relations, and sovereign policy under the authority of the Mathias El Tribe. Your NIAC membership grants access to formal inquiry, advocacy, and inter-governmental communication channels.",
    sections: [
      { label: "NIAC Membership Status", detail: "Active — Mathias El Tribe NIAC Standing" },
      { label: "Submit Formal Inquiry", detail: "File a formal inquiry to the NIAC secretariat." },
      { label: "Inter-Tribal Communications", detail: "Review official correspondence between participating tribes." },
      { label: "Federal Relations Reports", detail: "Access published reports on federal-tribal relations." },
    ],
  },
  "charitable-trust": {
    icon: Heart,
    title: "Charitable Trust",
    subtitle: "Mathias El Tribe Charitable Trust",
    description:
      "The Mathias El Tribe Charitable Trust supports community welfare, educational programs, and cultural preservation. As a charitable trust member, you have access to trust status reports, benefit programs, and trustee communications.",
    sections: [
      { label: "Charitable Trust Status", detail: "Active member — Charitable Trust beneficiary." },
      { label: "Benefit Programs", detail: "View available charitable benefit programs for members." },
      { label: "Trust Instruments", detail: "Access published charitable trust instruments." },
      { label: "Trustee Communications", detail: "Review official communications from the Office of the Trustee." },
    ],
  },
  iee: {
    icon: Building2,
    title: "I.E.E. Panel",
    subtitle: "Indigenous Economic Enterprise",
    description:
      "The Indigenous Economic Enterprise program supports sovereign tribal commerce and economic development. IEE members may register enterprises, obtain verification certificates, and access exclusive enterprise support programs.",
    sections: [
      { label: "IEE Verification Status", detail: "Your enterprise verification standing with the tribe." },
      { label: "Enterprise Registration", detail: "Register or update your tribal enterprise affiliation." },
      { label: "Certification Documents", detail: "Access and download IEE certification letters and seals." },
      { label: "Enterprise Support Programs", detail: "View tribal programs supporting indigenous enterprises." },
    ],
  },
};

interface PanelPageProps {
  panel: PanelType;
}

export default function PanelPage({ panel }: PanelPageProps) {
  const { user } = useAuth();
  const cfg = PANEL_CONFIG[panel];
  const Icon = cfg.icon;

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{cfg.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{cfg.subtitle} — {user?.name}</p>
        </div>

        <div className="bg-sidebar rounded-xl px-6 py-5 border border-sidebar-border flex gap-4 items-start">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-sidebar-primary" />
          </div>
          <p className="text-xs text-sidebar-foreground/80 leading-relaxed pt-1">{cfg.description}</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm divide-y divide-card-border">
          {cfg.sections.map(({ label, detail }) => (
            <div key={label} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
              </div>
              <button className="flex items-center gap-1 text-xs text-primary font-medium hover:underline flex-shrink-0">
                Open <ChevronRight className="w-3 h-3" />
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

export function NiacPage() { return <PanelPage panel="niac" />; }
export function CharitableTrustPage() { return <PanelPage panel="charitable-trust" />; }
export function IEEPage() { return <PanelPage panel="iee" />; }
