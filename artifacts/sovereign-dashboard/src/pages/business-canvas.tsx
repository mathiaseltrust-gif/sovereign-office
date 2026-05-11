import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface BusinessConcept {
  id: number;
  title: string;
  description: string;
  structure: string;
  status: string;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

function statusBadge(status: string) {
  switch (status) {
    case "draft": return <Badge variant="secondary">Draft</Badge>;
    case "submitted": return <Badge variant="default">Submitted</Badge>;
    case "active": return <Badge className="bg-green-600 text-white">Active</Badge>;
    case "archived": return <Badge variant="outline">Archived</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function ConceptCard({ concept }: { concept: BusinessConcept }) {
  return (
    <Link href={`/business-canvas/${concept.id}`}>
      <Card className="cursor-pointer hover:border-primary transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold leading-tight">{concept.title}</CardTitle>
            {statusBadge(concept.status)}
          </div>
          {concept.structure && (
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{concept.structure}</p>
          )}
        </CardHeader>
        <CardContent>
          {concept.aiSummary ? (
            <p className="text-sm text-muted-foreground line-clamp-3">{concept.aiSummary}</p>
          ) : concept.description ? (
            <p className="text-sm text-muted-foreground line-clamp-3">{concept.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No summary yet</p>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Updated {new Date(concept.updatedAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function BusinessCanvas() {
  const [concepts, setConcepts] = useState<BusinessConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/business/concepts")
      .then((r) => r.json())
      .then((data) => {
        setConcepts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast({ title: "Failed to load business concepts", variant: "destructive" });
      });
  }, []);

  return (
    <div data-testid="page-business-canvas">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Business Canvas</h1>
          <p className="text-muted-foreground mt-1">
            AI-guided sovereign business formation for the Mathias El Tribe
          </p>
        </div>
        <Button
          size="lg"
          className="shrink-0"
          onClick={() => navigate("/business-canvas/new")}
        >
          + Start a New Business Idea
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : concepts.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🏛️</div>
            <h2 className="text-xl font-semibold mb-2">No Business Concepts Yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Start developing your sovereign business idea. Our AI will guide you through structure selection, planning, legal protections, and activation steps.
            </p>
            <Button size="lg" onClick={() => navigate("/business-canvas/new")}>
              Start a New Business Idea
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{concepts.length} concept{concepts.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {concepts.map((c) => (
              <ConceptCard key={c.id} concept={c} />
            ))}
          </div>
        </>
      )}

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="font-semibold text-sm mb-1">AI-Guided Formation</h3>
            <p className="text-xs text-muted-foreground">Azure OpenAI analyzes your idea and recommends sovereign-optimized business structures</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="text-2xl mb-2">🛡️</div>
            <h3 className="font-semibold text-sm mb-1">Sovereign Protections</h3>
            <p className="text-xs text-muted-foreground">Automatically identifies tribal sovereign immunity provisions and federal Indian law protections</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-semibold text-sm mb-1">Activation Checklist</h3>
            <p className="text-xs text-muted-foreground">Step-by-step agency contacts and actions to bring your business to life</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
