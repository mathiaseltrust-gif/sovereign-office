import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";

interface ImportResult {
  format: string;
  total: number;
  created: number;
  merged: number;
  skipped: number;
  errors: string[];
  lineageIds: number[];
  graph: {
    totalGenerations: number;
    tribalNations: string[];
    familyGroups: string[];
    lineageTags: string[];
    icwaEligible: boolean;
    welfareEligible: boolean;
  };
}

interface LineageNode {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  birthYear?: number;
  deathYear?: number;
  gender?: string;
  tribalNation?: string;
  isDeceased?: boolean;
  generationalPosition?: number;
  parentIds?: number[];
  childrenIds?: number[];
  protectionLevel?: string;
  membershipStatus?: string;
  icwaEligible?: boolean;
  trustBeneficiary?: boolean;
  sourceType?: string;
  entraObjectId?: string;
}

const PROTECTION_COLORS: Record<string, string> = {
  ancestor: "bg-amber-100 text-amber-800 border-amber-300",
  descendant: "bg-blue-100 text-blue-800 border-blue-300",
  pending: "bg-gray-100 text-gray-700 border-gray-300",
};

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  denied: "bg-red-100 text-red-800",
};

export default function AdminLineageImportPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("");

  const { data: nodesData, isLoading: nodesLoading, refetch } = useQuery<{ nodes: LineageNode[]; count: number }>({
    queryKey: ["lineage-nodes"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/nodes?limit=200", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error("Failed to load registry");
      return r.json();
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("No file selected");
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/lineage/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
        body: form,
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Import failed");
      }
      return r.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      void refetch();
      toast({
        title: "Import complete",
        description: `Created ${data.created}, merged ${data.merged}, skipped ${data.skipped} of ${data.total} records.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const nodes = nodesData?.nodes ?? [];
  const ancestors = nodes.filter((n) => n.protectionLevel === "ancestor" || n.isDeceased);
  const descendants = nodes.filter((n) => n.protectionLevel === "descendant" && !n.isDeceased);
  const pending = nodes.filter((n) => !n.protectionLevel || n.protectionLevel === "pending");

  return (
    <div data-testid="page-lineage-import">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Lineage Registry</h1>
        <p className="text-muted-foreground mt-1">
          Import the McCaster family tree from Ancestry GEDCOM or CSV exports. All records are stored in the sovereign lineage registry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Ancestry Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-md p-3 text-xs space-y-1">
              <p className="font-semibold uppercase tracking-widest text-muted-foreground mb-1">Accepted formats</p>
              <p><span className="font-mono font-semibold">.ged / .gedcom</span> — Ancestry GEDCOM export (preferred)</p>
              <p><span className="font-mono font-semibold">.csv</span> — CSV with columns: name, birth_year, death_year, parent_names, gender, tribal_nation, notes</p>
            </div>

            <div
              className="border-2 border-dashed border-muted rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {selectedFile ? (
                <div>
                  <p className="font-medium text-sm">{selectedFile}</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to choose a different file</p>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Drop a file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Supports GEDCOM (.ged) and CSV (.csv) — max 20MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".ged,.gedcom,.csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0]?.name ?? "")}
              />
            </div>

            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || !selectedFile}
              className="w-full"
            >
              {importMutation.isPending ? "Importing…" : "Import into Registry"}
            </Button>
            {importMutation.isError && (
              <p className="text-sm text-destructive">{(importMutation.error as Error).message}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registry Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {nodesLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <div className="space-y-3">
                {[
                  ["Total Records", nodes.length, "text-foreground"],
                  ["Ancestors", ancestors.length, "text-amber-700"],
                  ["Descendants", descendants.length, "text-blue-700"],
                  ["Pending Review", pending.length, "text-muted-foreground"],
                ].map(([label, val, color]) => (
                  <div key={label as string} className="flex items-center justify-between py-1 border-b last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className={`text-2xl font-serif font-bold ${color}`}>{val as number}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="mb-8 border-green-300 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-800">
              Import Complete — {result.format.toUpperCase()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                ["Created", result.created, "text-green-700"],
                ["Merged", result.merged, "text-blue-700"],
                ["Skipped", result.skipped, "text-muted-foreground"],
              ].map(([label, val, color]) => (
                <div key={label as string} className="text-center">
                  <div className={`text-3xl font-serif font-bold ${color}`}>{val as number}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">{label}</div>
                </div>
              ))}
            </div>

            {result.graph.lineageTags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-green-700 mb-1">Lineage Tags</p>
                <div className="flex flex-wrap gap-1">
                  {result.graph.lineageTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs border-green-300 text-green-800">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-sm">
              {result.graph.tribalNations.length > 0 && (
                <span className="text-green-700"><strong>Nations:</strong> {result.graph.tribalNations.join(", ")}</span>
              )}
              {result.graph.totalGenerations > 0 && (
                <span className="text-green-700"><strong>Generations:</strong> {result.graph.totalGenerations}</span>
              )}
              {result.graph.icwaEligible && <Badge className="bg-blue-700 text-white text-xs">ICWA Eligible</Badge>}
              {result.graph.welfareEligible && <Badge className="bg-green-700 text-white text-xs">Welfare Eligible</Badge>}
            </div>

            {result.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-yellow-700 mb-1">Warnings ({result.errors.length})</p>
                <ul className="space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-yellow-800">{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-serif font-semibold">Registry Records</h2>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>Refresh</Button>
      </div>

      {nodesLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : nodes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No records in the lineage registry yet. Import a GEDCOM or CSV file to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <Card key={node.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{node.fullName}</span>
                      {node.isDeceased && <Badge variant="secondary" className="text-xs">Deceased</Badge>}
                      {node.icwaEligible && <Badge className="bg-blue-700 text-white text-xs">ICWA</Badge>}
                      {node.trustBeneficiary && <Badge className="bg-amber-700 text-white text-xs">Trust</Badge>}
                      {node.entraObjectId && <Badge className="bg-green-700 text-white text-xs">MS Linked</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                      {node.birthYear && <span>b. {node.birthYear}</span>}
                      {node.deathYear && <span>d. {node.deathYear}</span>}
                      {node.tribalNation && <span>· {node.tribalNation}</span>}
                      {node.gender && <span>· {node.gender}</span>}
                      {node.generationalPosition !== undefined && <span>· Gen {node.generationalPosition}</span>}
                      <span>· {(Array.isArray(node.parentIds) ? node.parentIds as number[] : []).length} parents, {(Array.isArray(node.childrenIds) ? node.childrenIds as number[] : []).length} children</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {node.protectionLevel && (
                      <Badge variant="outline" className={`text-xs capitalize ${PROTECTION_COLORS[node.protectionLevel] ?? ""}`}>
                        {node.protectionLevel}
                      </Badge>
                    )}
                    {node.membershipStatus && (
                      <Badge className={`text-xs capitalize ${STATUS_COLORS[node.membershipStatus] ?? "bg-gray-100 text-gray-700"}`}>
                        {node.membershipStatus}
                      </Badge>
                    )}
                    {node.sourceType && (
                      <Badge variant="outline" className="text-xs capitalize">{node.sourceType}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
