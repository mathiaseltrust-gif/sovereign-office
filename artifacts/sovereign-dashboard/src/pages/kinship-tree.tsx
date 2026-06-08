import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { ChevronDown, ChevronRight, Search, CircleDot, UserPlus, GitBranch } from "lucide-react";

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

type ViewMode = "horizontal" | "fan" | "collateral";

type Positioned = Node & { x: number; y: number; side?: "root" | "paternal" | "maternal"; depth?: number };

const CARD_W = 238;
const CARD_H = 58;
const COL_GAP = 270;
const ROW_GAP = 82;
const SVG_W = 1380;
const SVG_H = 740;

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

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

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

function findById(nodes: Node[]) {
  return new Map(nodes.map((n) => [n.id, n]));
}

function parentPair(root: Node | null, nodes: Node[]) {
  const byId = findById(nodes);
  const pids = safeArray<number>(root?.parentIds);
  return {
    father: pids[0] ? byId.get(Number(pids[0])) ?? null : null,
    mother: pids[1] ? byId.get(Number(pids[1])) ?? null : null,
  };
}

function ancestorSlots(start: Node | null, nodes: Node[], side: "paternal" | "maternal", maxDepth = 4): Positioned[] {
  const byId = findById(nodes);
  const out: Positioned[] = [];
  const walk = (node: Node | null, depth: number, lane: number) => {
    if (!node || depth > maxDepth) return;
    const x = 430 + (depth - 1) * COL_GAP;
    const centerY = side === "paternal" ? 238 : 500;
    const spread = Math.max(0, depth - 1) * 78;
    const y = centerY + lane * spread;
    out.push({ ...node, x, y, side, depth });
    const pids = safeArray<number>(node.parentIds);
    walk(pids[0] ? byId.get(Number(pids[0])) ?? null : null, depth + 1, lane - 0.55);
    walk(pids[1] ? byId.get(Number(pids[1])) ?? null : null, depth + 1, lane + 0.55);
  };
  walk(start, 1, 0);
  return out;
}

function buildHorizontal(root: Node | null, nodes: Node[]) {
  if (!root) return { positioned: [] as Positioned[], edges: [] as Array<[number, number]> };
  const { father, mother } = parentPair(root, nodes);
  const positioned: Positioned[] = [
    { ...root, x: 92, y: 348, side: "root", depth: 0 },
    ...ancestorSlots(father, nodes, "paternal"),
    ...ancestorSlots(mother, nodes, "maternal"),
  ];
  const visible = new Set(positioned.map((n) => n.id));
  const edges: Array<[number, number]> = [];
  for (const n of positioned) {
    for (const pid of safeArray<number>(n.parentIds)) {
      if (visible.has(Number(pid))) edges.push([Number(n.id), Number(pid)]);
    }
  }
  return { positioned, edges };
}

function buildFan(root: Node | null, nodes: Node[]) {
  const byId = findById(nodes);
  const entries: Array<{ node: Node; depth: number; a1: number; a2: number; side: "paternal" | "maternal" }> = [];
  if (!root) return entries;
  const q: Array<{ node: Node; depth: number; slot: number; slots: number; side: "paternal" | "maternal" }> = [];
  const pids = safeArray<number>(root.parentIds);
  if (pids[0] && byId.get(Number(pids[0]))) q.push({ node: byId.get(Number(pids[0]))!, depth: 1, slot: 0, slots: 2, side: "paternal" });
  if (pids[1] && byId.get(Number(pids[1]))) q.push({ node: byId.get(Number(pids[1]))!, depth: 1, slot: 1, slots: 2, side: "maternal" });
  const seen = new Set<number>();
  while (q.length) {
    const item = q.shift()!;
    if (seen.has(item.node.id) || item.depth > 6) continue;
    seen.add(item.node.id);
    const a1 = -Math.PI / 2 + (item.slot / item.slots) * Math.PI * 2;
    const a2 = -Math.PI / 2 + ((item.slot + 1) / item.slots) * Math.PI * 2;
    entries.push({ node: item.node, depth: item.depth, a1, a2, side: item.side });
    const pp = safeArray<number>(item.node.parentIds);
    const nextSlots = item.slots * 2;
    if (pp[0] && byId.get(Number(pp[0]))) q.push({ node: byId.get(Number(pp[0]))!, depth: item.depth + 1, slot: item.slot * 2, slots: nextSlots, side: item.side });
    if (pp[1] && byId.get(Number(pp[1]))) q.push({ node: byId.get(Number(pp[1]))!, depth: item.depth + 1, slot: item.slot * 2 + 1, slots: nextSlots, side: item.side });
  }
  return entries;
}

function arcPath(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number) {
  const x1 = cx + r1 * Math.cos(a1), y1 = cy + r1 * Math.sin(a1);
  const x2 = cx + r2 * Math.cos(a1), y2 = cy + r2 * Math.sin(a1);
  const x3 = cx + r2 * Math.cos(a2), y3 = cy + r2 * Math.sin(a2);
  const x4 = cx + r1 * Math.cos(a2), y4 = cy + r1 * Math.sin(a2);
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${x1},${y1} L${x2},${y2} A${r2},${r2} 0 ${large} 1 ${x3},${y3} L${x4},${y4} A${r1},${r1} 0 ${large} 0 ${x1},${y1} Z`;
}

function PersonCardSvg({ node, active = false }: { node: Positioned; active?: boolean }) {
  const fill = node.side === "paternal" ? "#fff7ed" : node.side === "maternal" ? "#eff6ff" : "#ffffff";
  const stroke = active ? "#d6a316" : node.side === "paternal" ? "#f97316" : node.side === "maternal" ? "#0284c7" : "#cbd5e1";
  return (
    <g transform={`translate(${node.x},${node.y})`} className="cursor-pointer">
      <rect width={CARD_W} height={CARD_H} rx="7" fill={fill} stroke={stroke} strokeWidth={active ? 4 : 2} filter="url(#shadow)" />
      <rect x="10" y="10" width="38" height="38" rx="4" fill="#e2e8f0" stroke="#cbd5e1" />
      <text x="29" y="34" textAnchor="middle" fontSize="11" fill="#334155" fontWeight="700">{initials(node.fullName)}</text>
      <text x="58" y="24" fontSize="14" fill="#0f172a" fontWeight="700">{node.fullName.length > 24 ? `${node.fullName.slice(0, 24)}…` : node.fullName}</text>
      <text x="58" y="42" fontSize="11" fill="#64748b">{years(node)}</text>
    </g>
  );
}

function RelationshipPanel({ title, rels, onSelect }: { title: string; rels: Relationship[]; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(true);
  if (!rels.length) return null;
  return (
    <div className="border-t border-slate-200 py-2">
      <button className="flex items-center gap-1 text-sm font-medium text-sky-700" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}<Badge variant="secondary" className="ml-1">{rels.length}</Badge>
      </button>
      {open && <div className="mt-2 space-y-1">{rels.map((r) => <button key={`${r.relationship}-${r.relatedId}`} onClick={() => onSelect(r.relatedId)} className="w-full text-left rounded px-2 py-1.5 hover:bg-slate-100"><span className="block text-sm font-semibold truncate">{r.node.fullName}</span><span className="block text-[11px] text-muted-foreground">{years(r.node)} · {r.confidence}</span></button>)}</div>}
    </div>
  );
}

export default function KinshipTreePage() {
  const [rootId, setRootId] = useState<number>(12);
  const [mode, setMode] = useState<ViewMode>("horizontal");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<RelationshipsResponse>({
    queryKey: ["lineage-relationships", rootId],
    queryFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const r = await fetch(`/api/lineage/relationships/${rootId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to load relationships");
      return r.json();
    },
  });

  const root = data?.root ?? null;
  const nodes = data?.nodes?.filter(Boolean) ?? [];
  const grouped = data?.grouped ?? {};
  const { positioned, edges } = useMemo(() => buildHorizontal(root, nodes), [root, nodes]);
  const posById = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);
  const fanEntries = useMemo(() => buildFan(root, nodes), [root, nodes]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter((n) => n.fullName.toLowerCase().includes(q) || safeArray<string>(n.nameVariants).some((v) => v.toLowerCase().includes(q))).slice(0, 10);
  }, [nodes, search]);

  const select = (id: number) => setRootId(id);
  const immediate = [...(grouped.spouse ?? []), ...(grouped.child ?? []), ...(grouped.sibling ?? [])];

  return (
    <div className="space-y-4" data-testid="page-kinship-tree">
      <div>
        <h1 className="text-3xl font-serif font-bold">Kinship Tree</h1>
        <p className="text-muted-foreground">Genealogy renderer — horizontal, fan, paternal/maternal branches, siblings, aunties, uncles, cousins, spouse and children.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-80" placeholder="Find in tree…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {matches.length > 0 && <div className="absolute z-50 mt-1 w-80 rounded-md border bg-popover shadow-lg p-1">{matches.map((n) => <button key={n.id} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { select(n.id); setSearch(""); }}>{n.fullName} <span className="text-xs text-muted-foreground">{years(n)}</span></button>)}</div>}
        </div>
        {(["horizontal", "fan", "collateral"] as ViewMode[]).map((m) => <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m === "horizontal" ? "Horizontal" : m === "fan" ? "Fan" : "Collateral"}</Button>)}
        <Button size="sm" variant="outline" onClick={() => setRootId(12)}><CircleDot className="h-4 w-4 mr-1" />Root</Button>
      </div>

      {isLoading && <Card><CardContent className="p-6 text-muted-foreground">Loading kinship graph…</CardContent></Card>}
      {error && <Card><CardContent className="p-6 text-red-700">{String((error as Error).message)}</CardContent></Card>}

      {!isLoading && root && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between"><span className="font-semibold">{root.fullName}</span><span className="text-xs text-slate-300">{nodes.length} related nodes loaded</span></div>

              {mode === "horizontal" && (
                <div className="overflow-auto bg-[#4b4b4b] min-h-[660px]">
                  <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
                    <defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="1" stdDeviation="1.8" floodOpacity="0.25" /></filter></defs>
                    <text x="430" y="76" fontSize="13" fill="#fed7aa" fontWeight="800">PATERNAL BRANCH</text>
                    <text x="430" y="338" fontSize="13" fill="#bfdbfe" fontWeight="800">MATERNAL BRANCH</text>
                    {edges.map(([childId, parentId]) => {
                      const c = posById.get(childId); const p = posById.get(parentId); if (!c || !p) return null;
                      const x1 = c.x + CARD_W, y1 = c.y + CARD_H / 2, x2 = p.x, y2 = p.y + CARD_H / 2;
                      const mx = (x1 + x2) / 2;
                      return <path key={`${childId}-${parentId}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#cbd5e1" strokeWidth="2" />;
                    })}
                    {positioned.map((n) => <g key={n.id} onClick={() => select(n.id)}><PersonCardSvg node={n} active={n.id === root.id} /></g>)}
                    {immediate.length > 0 && (
                      <foreignObject x="88" y="430" width="250" height="250">
                        <div className="rounded-md bg-white border shadow-sm p-2 max-h-[235px] overflow-auto">
                          <RelationshipPanel title="Spouse & Children" rels={[...(grouped.spouse ?? []), ...(grouped.child ?? [])]} onSelect={select} />
                          <RelationshipPanel title="Siblings" rels={grouped.sibling ?? []} onSelect={select} />
                        </div>
                      </foreignObject>
                    )}
                    <foreignObject x="1220" y="160" width="132" height="86"><div className="border border-dashed rounded p-3 text-sm text-slate-100 flex gap-2 items-center"><UserPlus className="h-4 w-4" /> Add father</div></foreignObject>
                    <foreignObject x="1220" y="420" width="132" height="86"><div className="border border-dashed rounded p-3 text-sm text-slate-100 flex gap-2 items-center"><UserPlus className="h-4 w-4" /> Add mother</div></foreignObject>
                  </svg>
                </div>
              )}

              {mode === "fan" && (
                <div className="overflow-auto bg-slate-100 min-h-[660px] flex items-center justify-center">
                  <svg width="760" height="760" viewBox="0 0 760 760">
                    <circle cx="380" cy="380" r="68" fill="#4338ca" stroke="#fff" strokeWidth="4" />
                    <text x="380" y="375" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800">{root.fullName.split(" ")[0]}</text>
                    <text x="380" y="394" textAnchor="middle" fill="#ddd6fe" fontSize="10">{root.fullName.split(" ").slice(1).join(" ").slice(0, 18)}</text>
                    {fanEntries.map((e) => {
                      const r1 = 74 + (e.depth - 1) * 62;
                      const r2 = r1 + 60;
                      const fill = e.side === "paternal" ? ["#7c2d12", "#9a3412", "#c2410c", "#ea580c", "#f97316"][Math.min(e.depth - 1, 4)] : ["#0c4a6e", "#075985", "#0369a1", "#0284c7", "#0ea5e9"][Math.min(e.depth - 1, 4)];
                      const mid = (e.a1 + e.a2) / 2;
                      const tx = 380 + ((r1 + r2) / 2) * Math.cos(mid);
                      const ty = 380 + ((r1 + r2) / 2) * Math.sin(mid);
                      return <g key={`${e.node.id}-${e.depth}`} onClick={() => select(e.node.id)} className="cursor-pointer"><path d={arcPath(380, 380, r1, r2, e.a1, e.a2)} fill={fill} stroke="#fff" strokeWidth="2" /><text x={tx} y={ty} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{e.node.fullName.split(" ")[0]}</text></g>;
                    })}
                  </svg>
                </div>
              )}

              {mode === "collateral" && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-slate-50 min-h-[660px]">
                  <Card><CardContent className="p-4"><RelationshipPanel title="Paternal Aunties" rels={grouped.paternal_aunt ?? []} onSelect={select} /><RelationshipPanel title="Paternal Uncles" rels={grouped.paternal_uncle ?? []} onSelect={select} /></CardContent></Card>
                  <Card><CardContent className="p-4"><RelationshipPanel title="Maternal Aunties" rels={grouped.maternal_aunt ?? []} onSelect={select} /><RelationshipPanel title="Maternal Uncles" rels={grouped.maternal_uncle ?? []} onSelect={select} /></CardContent></Card>
                  <Card><CardContent className="p-4"><RelationshipPanel title="Cousins" rels={grouped.cousin ?? []} onSelect={select} /><RelationshipPanel title="Nieces / Nephews" rels={grouped.niece_nephew ?? []} onSelect={select} /></CardContent></Card>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2"><GitBranch className="h-4 w-4" /><h2 className="font-bold">Selected Person</h2></div>
              <div className="rounded-md border p-3"><div className="font-bold">{root.fullName}</div><div className="text-xs text-muted-foreground">{years(root)} · {root.protectionLevel ?? "lineage"} · {root.membershipStatus ?? "status unknown"}</div></div>
              {Object.entries(GROUP_LABELS).map(([key, label]) => <RelationshipPanel key={key} title={label} rels={grouped[key] ?? []} onSelect={select} />)}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
