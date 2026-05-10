import { useListInstrumentTemplates, getListInstrumentTemplatesQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const TEMPLATE_DESCRIPTIONS: Record<string, { description: string; type: string }> = {
  trust_deed: {
    description: "Standard Indian trust land deed instrument with mandatory sovereignty provisions, federal preemption clauses, and recorder-compliant formatting.",
    type: "Conveyance",
  },
  allotment_lease: {
    description: "BIA-compliant allotment lease for trust land. Includes tribal jurisdiction retention, federal oversight provisions, and Indian title protection.",
    type: "Lease",
  },
  trust_transfer: {
    description: "Trust-to-trust transfer instrument. Preserves trust status through conveyance with complete chain-of-title sovereignty guardrails.",
    type: "Transfer",
  },
  nfr: {
    description: "Notice of Federal Review — sovereign notification instrument for documenting federal Indian law violations and establishing legal record.",
    type: "Notice",
  },
};

export default function TemplatesPage() {
  const { data: templatesData, isLoading } = useListInstrumentTemplates({
    query: { queryKey: getListInstrumentTemplatesQueryKey() },
  });

  const templates = templatesData?.templates ?? [];

  return (
    <div data-testid="page-templates">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Instrument Templates</h1>
        <p className="text-muted-foreground mt-1">Pre-built sovereign instrument templates with built-in legal provisions</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No templates available.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((key) => {
            const info = TEMPLATE_DESCRIPTIONS[key] ?? { description: "Custom template.", type: "Custom" };
            return (
              <Card key={key} data-testid={`template-card-${key}`} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-serif">{key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</CardTitle>
                    <Badge variant="outline">{info.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{info.description}</p>
                  <Link href="/instruments">
                    <Button size="sm" variant="outline" data-testid={`button-use-template-${key}`}>
                      Use Template
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 border rounded-lg bg-muted/30">
        <p className="text-xs text-muted-foreground">
          All templates auto-insert 8 required trust-land legal provisions (25 U.S.C. § 177, Worcester v. Georgia, Lone Wolf v. Hitchcock, Johnson v. M'Intosh, and others), signature blocks, and notary blocks — fully recorder-compliant with 2.5" top margin and 0.5" sides.
        </p>
      </div>
    </div>
  );
}
