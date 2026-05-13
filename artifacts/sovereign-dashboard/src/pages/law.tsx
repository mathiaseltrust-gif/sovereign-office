import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getCurrentBearerToken } from "@/components/auth-provider";

interface LawEntry { id: number; title: string; citation: string; body: string; tags: string[] }
interface DoctrineEntry { id: number; caseName: string; citation: string; summary: string; tags: string[] }
interface LawLibrary { federal: LawEntry[]; tribal: LawEntry[]; doctrines: DoctrineEntry[] }

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
              <p className="text-sm mt-3 text-foreground leading-relaxed border-l-2 border-blue-200 pl-3">
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
              <p className="text-sm mt-3 text-foreground leading-relaxed border-l-2 border-amber-200 pl-3">
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
              <p className="text-sm mt-3 text-foreground leading-relaxed border-l-2 border-green-200 pl-3">
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

export default function LawLibraryPage() {
  const [searchQ, setSearchQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const { data: library, isLoading } = useLawLibrary();
  const { data: searchResults, isLoading: searching } = useLawSearch(submittedQ);

  const display = submittedQ.length >= 2 ? searchResults : library;
  const isSearchMode = submittedQ.length >= 2;

  return (
    <div data-testid="page-law">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Law Library</h1>
        <p className="text-muted-foreground mt-1">
          Federal Indian Law · Tribal Law · Case Doctrines — queryable by classification, welfare, intake, and NFR engines
        </p>
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
