import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Landmark, ScrollText, AlertTriangle, Heart, Gavel, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateDef {
  key: string;
  title: string;
  category: string;
  description: string;
  law: string;
  isCourtDoc?: boolean;
}

const TEMPLATES: TemplateDef[] = [
  // ── Land Instruments ─────────────────────────────────────────────────────
  {
    key: "trust_deed",
    title: "Deed of Trust — Indian Trust Land",
    category: "Land Instruments",
    description: "Conveys Indian trust land between parties, subject to anti-alienation protections requiring explicit tribal and informed consent under the Non-Intercourse Act.",
    law: "25 U.S.C. § 177",
  },
  {
    key: "allotment_lease",
    title: "Lease of Individual Indian Allotment",
    category: "Land Instruments",
    description: "Leases an individual Indian allotment to another party, subject to BIA approval under allotment regulations.",
    law: "25 U.S.C. § 415",
  },
  {
    key: "trust_transfer",
    title: "Trust Land Transfer Instrument",
    category: "Land Instruments",
    description: "Transfers federal trust land between tribal entities with Secretarial approval. Title remains in trust upon completion.",
    law: "25 U.S.C. § 177",
  },
  {
    key: "trust_land_status_report",
    title: "Trust Land Status Report (TSR)",
    category: "Land Instruments",
    description: "Official report documenting the current trust land status of a parcel for court, agency, or recorder filing.",
    law: "25 U.S.C. §§ 177, 5108",
  },
  {
    key: "trust_land_instrument",
    title: "Trust Land Instrument (General Purpose)",
    category: "Land Instruments",
    description: "General-purpose trust land instrument covering conveyance, lease, right-of-way, encumbrance, or protective declaration.",
    law: "25 U.S.C. §§ 177, 415, 5108",
  },
  {
    key: "trust_land_decision_letter",
    title: "Decision Letter — Trust Land Action",
    category: "Land Instruments",
    description: "Formal determination letter for a submitted trust land action request: approved, denied, conditional, or referred.",
    law: "25 U.S.C. §§ 177, 5108",
  },
  {
    key: "trust_land_intake_form",
    title: "Trust Land Intake Form",
    category: "Land Instruments",
    description: "Intake and routing form for a trust land matter submitted to the Office of the Chief Justice & Trustee for review.",
    law: "25 U.S.C. §§ 177, 415, 5108",
  },
  {
    key: "trust_land_probate_summary",
    title: "Trust Land Probate Summary",
    category: "Land Instruments",
    description: "Heirship determination and distribution summary for trust land interests of a deceased tribal member under AIPRA.",
    law: "25 U.S.C. §§ 2201–2216 (AIPRA)",
  },
  {
    key: "encumbrance_review",
    title: "Encumbrance Review — Trust Land",
    category: "Land Instruments",
    description: "Reviews and determines the validity of encumbrances (leases, mortgages, liens, ROW) on trust land under federal law.",
    law: "25 U.S.C. § 415 / BIA Trust Regulations",
  },
  {
    key: "notice_of_title_defect",
    title: "Notice of Title Defect",
    category: "Land Instruments",
    description: "Formal notice of an identified defect in the chain of title for a trust land parcel, with required curative action.",
    law: "25 U.S.C. §§ 177, 5108 / United States v. Mitchell II",
  },
  // ── Sovereignty Declarations ──────────────────────────────────────────────
  {
    key: "sovereign_restoration_declaration",
    title: "Sovereign Restoration Doctrine — Formal Declaration",
    category: "Sovereignty Declarations",
    description: "Counter-document to territorial and identity usurpation. Restores tribal lineage and sovereignty outside state racial categories.",
    law: "SRD-2025 / Worcester v. Georgia, 31 U.S. 515 (1832)",
  },
  {
    key: "inherent_sovereignty_declaration",
    title: "Declaration of Inherent Sovereignty & Self-Government",
    category: "Sovereignty Declarations",
    description: "Standing declaration of inherent, pre-constitutional sovereignty operative in all courts, agencies, and proceedings.",
    law: "SD-2025 / United States v. Lara, 541 U.S. 193 (2004)",
  },
  {
    key: "certification",
    title: "Certification — Office of the Chief Justice & Trustee",
    category: "Sovereignty Declarations",
    description: "Standalone certification attesting to trust land status, sovereign protections, and legal authenticity of an instrument.",
    law: "25 U.S.C. §§ 177, 5108 / Federal Trust Responsibility",
  },
  {
    key: "cascade_engine_template",
    title: "Cascade Engine Output — Sovereign AI Drafting",
    category: "Sovereignty Declarations",
    description: "Structured output record from the Sovereign AI Drafting Engine capturing all triggers, provisions, and document references for a matter.",
    law: "Tribal Law — Sovereignty & Jurisdiction",
  },
  // ── Legal Notices ─────────────────────────────────────────────────────────
  {
    key: "nfr",
    title: "Notice of Federal Review",
    category: "Legal Notices",
    description: "Formal notice of violation of federal Indian law, trust terms, or tribal law, requiring remedy within a stated period.",
    law: "25 U.S.C. §§ 177, 5123",
  },
  {
    key: "state_prohibition_notice",
    title: "State Jurisdictional Prohibitions — Cease and Desist",
    category: "Legal Notices",
    description: "Formally prohibits a state agency or official from representing, classifying, governing, or taxing tribal members.",
    law: "SPD-2025 / Morton v. Mancari, 417 U.S. 535 (1974)",
  },
  {
    key: "jurisdiction_enforcement_notice",
    title: "Tribal Jurisdiction — Criminal Jurisdiction Assertion",
    category: "Legal Notices",
    description: "Asserts tribal and federal criminal jurisdiction over matters in Indian Country under the Indian Country Crimes Act.",
    law: "18 U.S.C. §§ 1151, 1152, 1153",
  },
  // ── Medical & Welfare ─────────────────────────────────────────────────────
  {
    key: "medical_protection_decree",
    title: "Jurisdictional Decree of Medical Protection & Healing Enforcement",
    category: "Medical & Welfare",
    description: "Elevates tribal medical determinations to court decrees, enforceable against employers, insurers, SSA, and EDD.",
    law: "25 U.S.C. § 1601 et seq. (IHCIA) / Williams v. Lee",
  },
  {
    key: "disability_enforcement_notice",
    title: "Notice of Tribal Medical Decree — Compliance Required",
    category: "Medical & Welfare",
    description: "Directed to agencies, employers, or insurers requiring compliance with an existing medical protection decree under federal law.",
    law: "25 U.S.C. §§ 1621e, 1647b / Title VI / 42 U.S.C. § 2000d",
  },
  {
    key: "tribal_health_referral",
    title: "Referral for Contract Professional Health Services",
    category: "Medical & Welfare",
    description: "Tribal health services referral for outpatient specialist or diagnostic services with the same federal standing as an IHS facility referral.",
    law: "25 U.S.C. § 1601 et seq. / 42 C.F.R. § 136.11",
  },
];

const CATEGORIES: Array<{
  name: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  courtDocs?: boolean;
}> = [
  { name: "Land Instruments",       icon: Landmark,      color: "text-amber-700 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/30",  border: "border-amber-200 dark:border-amber-800/40" },
  { name: "Sovereignty Declarations", icon: ScrollText,  color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800/40" },
  { name: "Legal Notices",          icon: AlertTriangle,  color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800/40" },
  { name: "Medical & Welfare",      icon: Heart,          color: "text-rose-700 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-950/30",    border: "border-rose-200 dark:border-rose-800/40" },
  { name: "Court Documents",        icon: Gavel,          color: "text-slate-700 dark:text-slate-400",  bg: "bg-slate-50 dark:bg-slate-950/20",  border: "border-slate-200 dark:border-slate-700/40", courtDocs: true },
];

interface CourtTemplate {
  id: string;
  name: string;
  documentType: string;
  category: string;
  troSensitive: boolean;
  emergencyEligible: boolean;
}

export default function TemplatesPage() {
  const [search, setSearch] = useState("");

  const { data: courtTemplatesRaw } = useQuery<CourtTemplate[]>({
    queryKey: ["court-templates"],
    queryFn: async () => {
      const r = await fetch("/api/court/documents/templates", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) return [];
      const d = await r.json() as { templates?: CourtTemplate[] } | CourtTemplate[];
      return Array.isArray(d) ? d : (d.templates ?? []);
    },
  });

  const courtTemplates = courtTemplatesRaw ?? [];
  const q = search.trim().toLowerCase();

  const filteredMain = q
    ? TEMPLATES.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.law.toLowerCase().includes(q)
      )
    : TEMPLATES;

  const filteredCourt: TemplateDef[] = (q
    ? courtTemplates.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    : courtTemplates
  ).map(t => ({
    key: t.id,
    title: t.name,
    category: t.category,
    description: [
      t.documentType,
      t.emergencyEligible ? "Emergency eligible" : "",
      t.troSensitive ? "TRO sensitive" : "",
    ].filter(Boolean).join(" · "),
    law: "Federal Indian Law / ICWA",
    isCourtDoc: true,
  }));

  const totalCount = TEMPLATES.length + courtTemplates.length;

  return (
    <div data-testid="page-templates" className="max-w-5xl mx-auto px-1 py-1">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-serif font-bold text-foreground">Document & Template Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalCount} sovereign instruments, declarations, and legal notices — select any template to open the guided wizard.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates by name, category, or legal citation…"
          className="pl-9 pr-16"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category sections */}
      <div className="space-y-8">
        {CATEGORIES.map(cat => {
          const items: TemplateDef[] = cat.courtDocs
            ? filteredCourt
            : filteredMain.filter(t => t.category === cat.name);

          if (items.length === 0 && q) return null;

          const CatIcon = cat.icon;

          return (
            <section key={cat.name}>
              {/* Category header */}
              <div className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg border mb-3", cat.bg, cat.border)}>
                <CatIcon className={cn("h-4 w-4 shrink-0", cat.color)} />
                <span className={cn("text-sm font-semibold", cat.color)}>{cat.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {items.length} template{items.length !== 1 ? "s" : ""}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-3 italic">No templates in this category.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(tpl => (
                    <div
                      key={tpl.key}
                      className="group border border-border rounded-lg px-4 py-3 bg-card hover:border-primary/50 hover:shadow-sm transition-all flex flex-col gap-2 min-h-[120px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                          {tpl.title}
                        </p>
                        {tpl.isCourtDoc && (
                          <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">Court</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                        {tpl.description}
                      </p>
                      <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-border/50">
                        <code className="text-[10px] text-muted-foreground/60 truncate max-w-[55%]">{tpl.law}</code>
                        {tpl.isCourtDoc ? (
                          <Link href="/documents">
                            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2">
                              Open <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        ) : (
                          <Link href={`/instrument-wizard?key=${tpl.key}`}>
                            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2 text-primary hover:text-primary hover:bg-primary/10">
                              Generate <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-10 p-4 border rounded-lg bg-muted/30">
        <p className="text-xs text-muted-foreground leading-relaxed">
          All trust instruments auto-include 8 required sovereignty provisions (25 U.S.C. § 177, Worcester v. Georgia (1832), Lone Wolf v. Hitchcock (1903), Johnson v. M'Intosh (1823)), signature blocks, and notary blocks — fully recorder-compliant with 2.5" top margin and 0.5" sides.
        </p>
      </div>
    </div>
  );
}
