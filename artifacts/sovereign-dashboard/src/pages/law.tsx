import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getCurrentBearerToken, useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Check, BookOpen } from "lucide-react";

interface LawEntry { id: number; title: string; citation: string; body: string; tags: string[] }
interface DoctrineEntry { id: number; caseName: string; citation: string; summary: string; tags: string[] }
interface LawLibrary { federal: LawEntry[]; tribal: LawEntry[]; doctrines: DoctrineEntry[] }

const LAW_ADMIN_ROLES = new Set(["chief_justice", "sovereign_admin", "admin", "trustee"]);

function authHeaders() {
  return { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" };
}

function useLawLibrary() {
  return useQuery<LawLibrary>({
    queryKey: ["law-library"],
    queryFn: async () => {
      const r = await fetch("/api/law", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) throw new Error("Failed to load law library");
      return r.json();
    },
    staleTime: 60_000,
  });
}

function useLawSearch(q: string) {
  return useQuery<LawLibrary>({
    queryKey: ["law-search", q],
    queryFn: async () => {
      const r = await fetch(`/api/law/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error("Search failed");
      return r.json();
    },
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

function TagBadges({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((t) => (
        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
      ))}
    </div>
  );
}

function FederalLawCard({ law }: { law: LawEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-blue-100">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-700 text-white text-xs">Federal</Badge>
              <span className="font-semibold text-sm">{law.title}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{law.citation}</p>
            <TagBadges tags={law.tags} />
            {open && (
              <p className="text-sm mt-3 text-foreground leading-relaxed border-l-2 border-blue-200 pl-3 whitespace-pre-wrap">
                {law.body}
              </p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(o => !o)}>
            {open ? "Collapse" : "Read"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TribalLawCard({ law }: { law: LawEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-amber-100">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-700 text-white text-xs">Tribal</Badge>
              <span className="font-semibold text-sm">{law.title}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{law.citation}</p>
            <TagBadges tags={law.tags} />
            {open && (
              <p className="text-sm mt-3 text-foreground leading-relaxed border-l-2 border-amber-200 pl-3 whitespace-pre-wrap">
                {law.body}
              </p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(o => !o)}>
            {open ? "Collapse" : "Read"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DoctrineCard({ doc }: { doc: DoctrineEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-green-100">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-700 text-white text-xs">Doctrine</Badge>
              <span className="font-semibold text-sm">{doc.caseName}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{doc.citation}</p>
            <TagBadges tags={doc.tags} />
            {open && (
              <p className="text-sm mt-3 text-foreground leading-relaxed border-l-2 border-green-200 pl-3 whitespace-pre-wrap">
                {doc.summary}
              </p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(o => !o)}>
            {open ? "Collapse" : "Read"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type EntryKind = "federal" | "tribal" | "doctrine";

const KIND_META: Record<EntryKind, { label: string; color: string; endpoint: string; bodyLabel: string; titleLabel: string }> = {
  federal: { label: "Federal Indian Law", color: "blue", endpoint: "/api/law/federal", bodyLabel: "Body / Text", titleLabel: "Title" },
  tribal: { label: "Tribal Law", color: "amber", endpoint: "/api/law/tribal", bodyLabel: "Body / Text", titleLabel: "Title" },
  doctrine: { label: "Case Doctrine", color: "green", endpoint: "/api/law/doctrines", bodyLabel: "Summary", titleLabel: "Case Name" },
};

function AddEntryForm({ kind, onAdded }: { kind: EntryKind; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ titleOrCase: "", citation: "", body: "", tags: "" });
  const { toast } = useToast();
  const meta = KIND_META[kind];

  const mutation = useMutation({
    mutationFn: async () => {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      const payload = kind === "doctrine"
        ? { caseName: form.titleOrCase, citation: form.citation, summary: form.body, tags }
        : { title: form.titleOrCase, citation: form.citation, body: form.body, tags };
      const r = await fetch(meta.endpoint, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to add entry");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: `${meta.label} entry added`, description: "Now available in the library and to COMPANION." });
      setForm({ titleOrCase: "", citation: "", body: "", tags: "" });
      setOpen(false);
      onAdded();
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    },
  });

  const canSubmit = form.titleOrCase.trim() && form.citation.trim() && form.body.trim() && !mutation.isPending;

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 mb-4"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-3.5 h-3.5" />
        Add {meta.label} Entry
      </Button>
    );
  }

  const borderColor = meta.color === "blue" ? "border-blue-300" : meta.color === "amber" ? "border-amber-300" : "border-green-300";
  const bgColor = meta.color === "blue" ? "bg-blue-50/60" : meta.color === "amber" ? "bg-amber-50/60" : "bg-green-50/60";

  return (
    <Card className={`border-2 border-dashed ${borderColor} ${bgColor} mb-4`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Add {meta.label} Entry
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This entry will be immediately available in the library and queried by COMPANION, Classification, Welfare, and Intake engines.
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{meta.titleLabel} *</Label>
            <Input
              placeholder={kind === "doctrine" ? "e.g. Worcester v. Georgia" : "e.g. Indian Child Welfare Act"}
              value={form.titleOrCase}
              onChange={e => setForm(f => ({ ...f, titleOrCase: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Citation *</Label>
            <Input
              placeholder={kind === "doctrine" ? "e.g. 31 U.S. 515 (1832)" : "e.g. 25 U.S.C. §§ 1901–1963"}
              value={form.citation}
              onChange={e => setForm(f => ({ ...f, citation: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{meta.bodyLabel} * <span className="text-muted-foreground font-normal">(paste full text, notes, or summary)</span></Label>
          <Textarea
            placeholder="Paste the full text, your notes, or a summary of this law or doctrine. COMPANION will use this content when answering questions…"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={8}
            className="font-mono text-xs leading-relaxed resize-y"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Tags <span className="text-muted-foreground font-normal">(comma-separated — used by Classification and Intake engines)</span></Label>
          <Input
            placeholder="e.g. ICWA, family, child welfare, federal trust"
            value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
          >
            <Check className="w-3.5 h-3.5" />
            {mutation.isPending ? "Saving…" : "Save to Library"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setForm({ titleOrCase: "", citation: "", body: "", tags: "" }); }}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LawLibraryPage() {
  const [searchQ, setSearchQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const { data: library, isLoading } = useLawLibrary();
  const { data: searchResults, isLoading: searching } = useLawSearch(submittedQ);
  const qc = useQueryClient();
  const { user } = useAuth();

  const isLawAdmin = user?.roles?.some(r => LAW_ADMIN_ROLES.has(r)) ?? false;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["law-library"] });
    void qc.invalidateQueries({ queryKey: ["law-search"] });
  };

  const display = submittedQ.length >= 2 ? searchResults : library;
  const isSearchMode = submittedQ.length >= 2;

  return (
    <div data-testid="page-law">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Law Library</h1>
        <p className="text-muted-foreground mt-1">
          Federal Indian Law · Tribal Law · Case Doctrines — queryable by Classification, Welfare, Intake Filter &amp; NFR engines
        </p>
        {isLawAdmin && (
          <p className="text-xs text-amber-700 mt-1.5">
            You have edit access — use the <strong>Add Entry</strong> buttons in each tab to add custom statutes, tribal law, or doctrines. All entries are immediately available to COMPANION and the AI engines.
          </p>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Search statutes, citations, doctrines…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSubmittedQ(searchQ)}
          className="max-w-lg"
        />
        <Button onClick={() => setSubmittedQ(searchQ)} disabled={searchQ.length < 2}>Search</Button>
        {isSearchMode && (
          <Button variant="ghost" onClick={() => { setSearchQ(""); setSubmittedQ(""); }}>Clear</Button>
        )}
      </div>

      {isSearchMode && (
        <div className="mb-4 text-sm text-muted-foreground">
          Search results for: <strong>"{submittedQ}"</strong>
          {display && (
            <span className="ml-2">
              ({(display.federal?.length ?? 0) + (display.tribal?.length ?? 0) + (display.doctrines?.length ?? 0)} results)
            </span>
          )}
        </div>
      )}

      {isLoading && !isSearchMode ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <Tabs defaultValue="federal">
          <TabsList className="mb-4">
            <TabsTrigger value="federal">
              Federal Indian Law ({display?.federal?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="tribal">
              Tribal Law ({display?.tribal?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="doctrines">
              Case Doctrines ({display?.doctrines?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="federal">
            {isLawAdmin && !isSearchMode && <AddEntryForm kind="federal" onAdded={invalidate} />}
            {searching ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : (display?.federal ?? []).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No federal laws found.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {(display?.federal ?? []).map((law) => <FederalLawCard key={law.id} law={law} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tribal">
            {isLawAdmin && !isSearchMode && <AddEntryForm kind="tribal" onAdded={invalidate} />}
            {searching ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : (display?.tribal ?? []).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No tribal laws found.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {(display?.tribal ?? []).map((law) => <TribalLawCard key={law.id} law={law} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="doctrines">
            {isLawAdmin && !isSearchMode && <AddEntryForm kind="doctrine" onAdded={invalidate} />}
            {searching ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : (display?.doctrines ?? []).length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No doctrines found.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {(display?.doctrines ?? []).map((doc) => <DoctrineCard key={doc.id} doc={doc} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {!isSearchMode && library && (
        <div className="mt-6 text-xs text-muted-foreground text-center">
          {(library.federal?.length ?? 0) + (library.tribal?.length ?? 0)} statutes ·{" "}
          {library.doctrines?.length ?? 0} controlling doctrines — used by Classification, Welfare, Intake Filter &amp; NFR engines
        </div>
      )}
    </div>
  );
}
