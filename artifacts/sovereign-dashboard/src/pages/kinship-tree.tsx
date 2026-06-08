import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { ChevronDown, ChevronRight, Search, Users, GitBranch, CircleDot, UserPlus } from "lucide-react";

type RelKind =
  | "self" | "parent" | "child" | "spouse" | "sibling"
  | "paternal_aunt" | "paternal_uncle" | "maternal_aunt" | "maternal_uncle"
  | "cousin" | "niece_nephew" | "household_member" | "collateral_relative";

type Node = {
  id: number;
  fullName: string;
  gender?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  birthDate?: string | null;
  deathDate?: string | null;
  photoUrl?: string | null;
  parentIds?: number[] | null;
  childrenIds?: number[] | null;
  spouseIds?: number[] | null;
  siblingIds?: number[] | null;
  membershipStatus?: string | null;
  protectionLevel?: string | null;
  nameVariants?: string[] | null;
};

type Relationship = {
  personId: number;
  relatedId: number;
  relationship: RelKind;
  source: string;
  confidence: string;
  node: Node;
};

type RelationshipsResponse = {
  root: Node | null;
  relationships: Relationship[];
  grouped: Record<string, Relationship[]>;
  nodes: Node[];
};

type ViewMode = "horizontal" | "pedigree" | "collateral";

const GROUP_LABELS: Record<string, string> = {
  spouse: "Spouse & Children",
  child: "Children",
  sibling: "Siblings",
  paternal_aunt: "Paternal Aunties",
  paternal_uncle: "Paternal Uncles",
  maternal_aunt: "Maternal Aunties",
  maternal_uncle: "Maternal Uncles",
  cousin: "Cousins",
  niece_nephew: "Nieces / Nephews",
  parent: "Parents",
};

function years(node?: Node | null) {
  if (!node) return "";
  const b = node.birthYear ?? (node.birthDate ? Number(String(node.birthDate).slice(0, 4)) : null);
  const d = node.deathYear ?? (node.deathDate ? Number(String(node.deathDate).slice(0, 4)) : null);
  if (b && d) return `${b}-${d}`;
  if (b && !d) return `${b}-Living`;
  return "";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function PersonCard({ node, small = false, active = false, onClick }: { node: Node; small?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-left bg-white border rounded-md shadow-sm hover:shadow transition flex items-center gap-2",
        active ? "ring-2 ring-primary border-primary" : "border-slate-300",
        small ? "px-2 py-1 min-w-[170px]" : "px-3 py-2 min-w-[235px]",
      ].join(" ")}
    >
      {node.photoUrl ? (
        <img src={node.photoUrl} className={small ? "h-8 w-8 rounded object-cover" : "h-11 w-11 rounded object-cover"} />
      ) : (
        <span className={["rounded bg-slate-100 border flex items-center justify-center font-semibold text-slate-600", small ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-xs"].join(" ")}>{initials(node.fullName)}</span>
      )}
      <span className="min-w-0">
        <span className={["block font-semibold text-slate-900 truncate", small ? "text-xs" : "text-sm"].join(" ")}>{node.fullName}</span>
        <span className="block text-[11px] text-slate-500 truncate">{years(node)}</span>
      </span>
    </button>
  );
}

function GroupList({ title, rels, onSelect }: { title: string; rels: Relationship[]; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(true);
  if (!rels.length) return null;
  return (
    <div className="border-t border-slate-200 py-2">
      <button className="flex items-center gap-1 text-sm font-medium text-sky-700" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
        <Badge variant="secondary" className="ml-1">{rels.length}</Badge>
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {rels.map((r) => (
            <button key={`${r.relationship}-${r.relatedId}`} className="w-full flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-100 text-left" onClick={() => onSelect(r.relatedId)}>
              {r.node?.photoUrl ? <img src={r.node.photoUrl} className="h-7 w-7 rounded object-cover" /> : <span className="h-7 w-7 rounded bg-slate-100 border flex items-center justify-center text-[10px]">{initials(r.node.fullName)}</span>}
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">{r.node.fullName}</span>
                <span className="block text-[11px] text-muted-foreground">{years(r.node)} · {r.confidence}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AncestorColumn({ title, nodes, tone, onSelect }: { title: string; nodes: Node[]; tone: "paternal" | "maternal"; onSelect: (id: number) => void }) {
  return (
    <div className="min-w-[280px] space-y-3">
      <div className={["rounded px-3 py-2 text-xs font-bold uppercase tracking-wide", tone === "paternal" ? "bg-orange-100 text-orange-900" : "bg-sky-100 text-sky-900"].join(" ")}>{title}</div>
      {nodes.length === 0 ? (
        <div className="border border-dashed rounded-md p-4 text-sm text-muted-foreground flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add {tone === "paternal" ? "father" : "mother"}</div>
      ) : nodes.map((n) => <PersonCard key={n.id} node={n} onClick={() => onSelect(n.id)} />)}
    </div>
  );
}

function findParents(root: Node | null, nodes: Node[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentIds = Array.isArray(root?.parentIds) ? root!.parentIds! : [];
  return {
    father: parentIds[0] ? byId.get(parentIds[0]) ?? null : null,
    mother: parentIds[1] ? byId.get(parentIds[1]) ?? null : null,
  };
}

function ancestorChain(start: Node | null, nodes: Node[], max = 5): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Node[] = [];
  let current = start;
  let depth = 0;
  while (current && depth < max) {
    out.push(current);
    const pids = Array.isArray(current.parentIds) ? current.parentIds : [];
    current = pids[0] ? byId.get(pids[0]) ?? null : null;
    depth++;
  }
  return out;
}

export default function KinshipTreePage() {
  const [rootId, setRootId] = useState<number | null>(12);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ViewMode>("horizontal");

  const { data, isLoading, error } = useQuery<RelationshipsResponse>({
    queryKey: ["lineage-relationships", rootId],
    queryFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const url = rootId ? `/api/lineage/relationships/${rootId}` : "/api/lineage/relationships/self";
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to load relationships");
      return r.json();
    },
  });

  const nodes = data?.nodes?.filter(Boolean) ?? [];
  const root = data?.root ?? null;
  const grouped = data?.grouped ?? {};
  const { father, mother } = findParents(root, nodes);
  const paternalAncestors = ancestorChain(father, nodes, 5);
  const maternalAncestors = ancestorChain(mother, nodes, 5);

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter((n) => n.fullName.toLowerCase().includes(q) || (n.nameVariants ?? []).some((v) => v.toLowerCase().includes(q))).slice(0, 10);
  }, [nodes, search]);

  const select = (id: number) => setRootId(id);

  return (
    <div className="space-y-4" data-testid="page-kinship-tree">
      <div>
        <h1 className="text-3xl font-serif font-bold">Kinship Tree</h1>
        <p className="text-muted-foreground">Ancestry-style relationship graph — paternal, maternal, siblings, aunties, uncles, cousins, spouse and children.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-72" placeholder="Find in tree…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {searchMatches.length > 0 && (
            <div className="absolute z-50 mt-1 w-80 rounded-md border bg-popover shadow-lg p-1">
              {searchMatches.map((n) => (
                <button key={n.id} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { select(n.id); setSearch(""); }}>
                  {n.fullName} <span className="text-xs text-muted-foreground">{years(n)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {(["horizontal", "pedigree", "collateral"] as ViewMode[]).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m === "horizontal" ? "Horizontal" : m === "pedigree" ? "Pedigree" : "Collateral"}</Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => setRootId(12)}><CircleDot className="h-4 w-4 mr-1" />Root</Button>
      </div>

      {isLoading && <Card><CardContent className="p-6 text-muted-foreground">Loading kinship graph…</CardContent></Card>}
      {error && <Card><CardContent className="p-6 text-red-700">{String((error as Error).message)}</CardContent></Card>}

      {!isLoading && root && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
                <span className="font-semibold">{root.fullName}</span>
                <span className="text-xs text-slate-300">{nodes.length} related nodes loaded</span>
              </div>

              {mode === "horizontal" && (
                <div className="p-6 overflow-auto bg-slate-700 min-h-[540px]">
                  <div className="flex items-center gap-8 min-w-max">
                    <div className="space-y-3">
                      <PersonCard node={root} active />
                      <div className="rounded-md bg-white border shadow-sm p-2 w-[235px]">
                        <GroupList title="Spouse & Children" rels={[...(grouped.spouse ?? []), ...(grouped.child ?? [])]} onSelect={select} />
                        <GroupList title="Siblings" rels={grouped.sibling ?? []} onSelect={select} />
                      </div>
                    </div>

                    <GitBranch className="h-8 w-8 text-slate-300" />

                    <AncestorColumn title="Paternal branch" tone="paternal" nodes={paternalAncestors} onSelect={select} />
                    <AncestorColumn title="Maternal branch" tone="maternal" nodes={maternalAncestors} onSelect={select} />
                  </div>
                </div>
              )}

              {mode === "pedigree" && (
                <div className="p-6 overflow-auto bg-slate-700 min-h-[540px]">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-w-[900px]">
                    <div className="space-y-3">
                      <div className="text-white/80 text-xs uppercase font-bold">Root</div>
                      <PersonCard node={root} active onClick={() => select(root.id)} />
                    </div>
                    <div className="space-y-3">
                      <div className="text-orange-200 text-xs uppercase font-bold">Father / paternal</div>
                      {paternalAncestors.map((n) => <PersonCard key={n.id} node={n} onClick={() => select(n.id)} />)}
                    </div>
                    <div className="space-y-3">
                      <div className="text-sky-200 text-xs uppercase font-bold">Mother / maternal</div>
                      {maternalAncestors.map((n) => <PersonCard key={n.id} node={n} onClick={() => select(n.id)} />)}
                    </div>
                  </div>
                </div>
              )}

              {mode === "collateral" && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-slate-50 min-h-[540px]">
                  <Card><CardContent className="p-4"><GroupList title="Paternal Aunties" rels={grouped.paternal_aunt ?? []} onSelect={select} /><GroupList title="Paternal Uncles" rels={grouped.paternal_uncle ?? []} onSelect={select} /></CardContent></Card>
                  <Card><CardContent className="p-4"><GroupList title="Maternal Aunties" rels={grouped.maternal_aunt ?? []} onSelect={select} /><GroupList title="Maternal Uncles" rels={grouped.maternal_uncle ?? []} onSelect={select} /></CardContent></Card>
                  <Card><CardContent className="p-4"><GroupList title="Cousins" rels={grouped.cousin ?? []} onSelect={select} /><GroupList title="Nieces / Nephews" rels={grouped.niece_nephew ?? []} onSelect={select} /></CardContent></Card>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h2 className="font-bold">Selected Person</h2>
              </div>
              <PersonCard node={root} active />
              <div className="text-xs text-muted-foreground">{root.protectionLevel ?? "lineage"} · {root.membershipStatus ?? "status unknown"}</div>
              {Object.entries(GROUP_LABELS).map(([key, label]) => (
                <GroupList key={key} title={label} rels={grouped[key] ?? []} onSelect={select} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
