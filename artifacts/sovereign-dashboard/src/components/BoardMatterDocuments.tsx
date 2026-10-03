import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { FileCheck2, Link2, Paperclip, Unlink } from "lucide-react";

interface BoardDocument {
  association_id: number;
  relationship_type: string;
  linked_at: string;
  registry_id: number;
  document_ref: string;
  title: string | null;
  original_filename: string;
  classification: string | null;
  verification_state: string;
  sensitivity_level: string;
  storage_provider: string;
  source_channel: string;
  source_uri: string | null;
  organization_ids: string[];
}

interface CatalogDocument {
  registry_id: number;
  document_ref: string;
  title: string | null;
  original_filename: string;
  classification: string | null;
  verification_state: string;
  sensitivity_level: string;
  storage_provider: string;
  source_channel: string;
  organization_id: string | null;
}

interface LinkedResponse {
  matterId: number;
  orgId: string;
  documents: BoardDocument[];
}

interface CatalogResponse {
  matterId: number;
  orgId: string;
  documents: CatalogDocument[];
}

const RELATIONSHIPS = [
  ["evidence", "Evidence"],
  ["governing_instrument", "Governing Instrument"],
  ["correspondence", "Correspondence"],
  ["attachment", "Attachment"],
  ["report", "Report"],
  ["resolution", "Resolution"],
  ["minutes", "Minutes"],
] as const;

function headers(json = false): HeadersInit {
  const token = getCurrentBearerToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: headers() });
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export function BoardMatterDocuments({ matterId }: { matterId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [documentRef, setDocumentRef] = useState("");
  const [relationshipType, setRelationshipType] = useState("evidence");

  const linkedKey = ["board-matter-documents", matterId];
  const catalogKey = ["board-matter-document-catalog", matterId];

  const { data: linked, isLoading: linkedLoading } = useQuery<LinkedResponse>({
    queryKey: linkedKey,
    queryFn: () => getJson(`/api/board/matters/${matterId}/documents`),
  });

  const { data: catalog, isLoading: catalogLoading } = useQuery<CatalogResponse>({
    queryKey: catalogKey,
    queryFn: () => getJson(`/api/board/matters/${matterId}/document-catalog`),
  });

  const attach = useMutation({
    mutationFn: async () => {
      if (!documentRef) throw new Error("Select a document first.");
      const r = await fetch(`/api/board/matters/${matterId}/documents`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ documentRef, relationshipType }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      setDocumentRef("");
      qc.invalidateQueries({ queryKey: linkedKey });
      qc.invalidateQueries({ queryKey: catalogKey });
      toast({
        title: "Document linked to Board Matter",
        description: "The original file was preserved; only the institutional relationship was added.",
      });
    },
    onError: (error: Error) => toast({
      title: "Could not link document",
      description: error.message,
      variant: "destructive",
    }),
  });

  const unlink = useMutation({
    mutationFn: async (associationId: number) => {
      const r = await fetch(
        `/api/board/matters/${matterId}/documents/${associationId}`,
        { method: "DELETE", headers: headers() },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      return r.json() as Promise<{ documentPreserved?: boolean }>;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: linkedKey });
      qc.invalidateQueries({ queryKey: catalogKey });
      toast({
        title: "Board Matter link removed",
        description: result.documentPreserved
          ? "The canonical document remains stored in Office records."
          : "The relationship was removed.",
      });
    },
    onError: (error: Error) => toast({
      title: "Could not unlink document",
      description: error.message,
      variant: "destructive",
    }),
  });

  const available = useMemo(() => catalog?.documents ?? [], [catalog]);

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> Matter Evidence &amp; Documents
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Attach an existing canonical Office document. The file is not copied.
          </p>
        </div>
        <Badge variant="outline">{linked?.documents.length ?? 0} linked</Badge>
      </div>

      {linkedLoading ? (
        <p className="text-xs text-muted-foreground">Loading linked documents…</p>
      ) : (linked?.documents.length ?? 0) === 0 ? (
        <p className="text-xs text-muted-foreground">No canonical documents are linked to this matter yet.</p>
      ) : (
        <div className="space-y-2">
          {linked!.documents.map((doc) => (
            <div key={doc.association_id} className="rounded-md border bg-background p-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate flex items-center gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  {doc.title || doc.original_filename}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                  {doc.document_ref} · {doc.relationship_type.replace(/_/g, " ")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {doc.classification ?? "unclassified"} · {doc.verification_state} · stored once
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] shrink-0"
                disabled={unlink.isPending}
                onClick={() => unlink.mutate(doc.association_id)}
              >
                <Unlink className="h-3 w-3 mr-1" /> Unlink
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-3 space-y-2">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Link Existing Office Document
        </Label>
        <div className="grid sm:grid-cols-[1fr_170px_auto] gap-2">
          <Select value={documentRef} onValueChange={setDocumentRef}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={catalogLoading ? "Loading documents…" : "Choose canonical document"} />
            </SelectTrigger>
            <SelectContent>
              {available.map((doc) => (
                <SelectItem key={doc.document_ref} value={doc.document_ref}>
                  {doc.document_ref} — {doc.title || doc.original_filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={relationshipType} onValueChange={setRelationshipType}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className="h-9"
            disabled={!documentRef || attach.isPending}
            onClick={() => attach.mutate()}
          >
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            {attach.isPending ? "Linking…" : "Link"}
          </Button>
        </div>
        {!catalogLoading && available.length === 0 && (
          <p className="text-[10px] text-muted-foreground">
            No additional canonical documents are currently available within this matter's authorized entity scope.
          </p>
        )}
      </div>
    </div>
  );
}
