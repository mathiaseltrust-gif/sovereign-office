import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useIsTrustee, useCanReviewLineage } from "@/components/auth-provider";

type Tab = "upload-photo" | "upload-csv" | "view-lineage" | "edit-ancestors" | "knowledge-of-self";

interface LineageNode {
  id: number;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  gender?: string | null;
  tribalNation?: string | null;
  tribalEnrollmentNumber?: string | null;
  notes?: string | null;
  isDeceased?: boolean | null;
  isAncestor?: boolean | null;
  generationalPosition?: number | null;
  lineageTags?: string[] | null;
  icwaEligible?: boolean | null;
  welfareEligible?: boolean | null;
  trustBeneficiary?: boolean | null;
  sourceType?: string | null;
  linkedProfileUserId?: number | null;
  protectionLevel?: string | null;
  membershipStatus?: string | null;
  nameVariants?: string[] | null;
  parentIds?: number[] | null;
  childrenIds?: number[] | null;
  spouseIds?: number[] | null;
  pendingReview?: boolean | null;
  addedByMemberId?: number | null;
  supportingDocumentName?: string | null;
  createdAt?: string;
  _parents?: Array<{ id: number; fullName: string; birthYear?: number | null }>;
  _children?: Array<{ id: number; fullName: string; birthYear?: number | null }>;
}

interface PositionedNode extends LineageNode {
  x: number;
  y: number;
}

interface Edge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isAncestorLine: boolean;
}

interface LineageRecord {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  birthYear?: number;
  deathYear?: number;
  gender?: string;
  tribalNation?: string;
  tribalEnrollmentNumber?: string;
  notes?: string;
  isDeceased?: boolean;
  generationalPosition?: number;
  lineageTags?: string[];
  icwaEligible?: boolean;
  welfareEligible?: boolean;
  trustBeneficiary?: boolean;
  sourceType?: string;
  linkedProfileUserId?: number;
  createdAt?: string;
}

interface LineageData {
  lineage: LineageRecord[];
  narratives: Array<{
    id: number;
    title?: string;
    content?: string;
    lineageTags?: string[];
    ancestorChain?: string[];
    familyGroup?: string;
    generationalDepth?: number;
    protectionLevel?: string;
    benefitEligibility?: Record<string, boolean>;
    icwaEligible?: boolean;
    welfareEligible?: boolean;
    trustInheritance?: boolean;
    identityTags?: string[];
  }>;
}

interface KnowledgeOfSelf {
  narratives: LineageData["narratives"];
  linkedAncestors: LineageRecord[];
  records: Array<{
    id: number;
    recordType: string;
    recordSource?: string;
    documentContent?: string;
    verificationStatus?: string;
    icwaRelevant?: boolean;
    trustRelevant?: boolean;
    welfareRelevant?: boolean;
    createdAt?: string;
  }>;
}

function makeToken(user: unknown) { return btoa(JSON.stringify(user)); }

const TAB_LABELS: Record<Tab, string> = {
  "upload-photo": "Upload Photo",
  "upload-csv": "Upload CSV",
  "view-lineage": "Visual Tree",
  "edit-ancestors": "Edit Ancestors",
  "knowledge-of-self": "Knowledge-of-Self Links",
};

const PROTECTION_COLORS: Record<string, string> = {
  standard: "bg-green-100 text-green-800",
  elevated: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const NODE_W = 200;
const NODE_H = 92;
const H_GAP = 48;
const V_GAP = 80;
const CANVAS_PADDING = 60;

function computeLayout(nodes: LineageNode[]): { positioned: PositionedNode[]; totalW: number; totalH: number } {
  if (nodes.length === 0) return { positioned: [], totalW: 0, totalH: 0 };

  const byGen = new Map<number, LineageNode[]>();
  for (const n of nodes) {
    const gen = n.generationalPosition ?? 0;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(n);
  }

  const sortedGens = [...byGen.keys()].sort((a, b) => a - b);
  const positioned: PositionedNode[] = [];

  const maxPerGen = Math.max(...[...byGen.values()].map((g) => g.length));
  const totalW = CANVAS_PADDING * 2 + maxPerGen * NODE_W + (maxPerGen - 1) * H_GAP;

  sortedGens.forEach((gen, genIndex) => {
    const nodesInGen = byGen.get(gen)!;
    const rowW = nodesInGen.length * NODE_W + (nodesInGen.length - 1) * H_GAP;
    const startX = (totalW - rowW) / 2;
    const y = CANVAS_PADDING + genIndex * (NODE_H + V_GAP);
    nodesInGen.forEach((node, i) => {
      const x = startX + i * (NODE_W + H_GAP);
      positioned.push({ ...node, x, y });
    });
  });

  const totalH = CANVAS_PADDING * 2 + sortedGens.length * NODE_H + (sortedGens.length - 1) * V_GAP;
  return { positioned, totalW, totalH };
}

function buildEdges(positioned: PositionedNode[]): Edge[] {
  const nodeMap = new Map(positioned.map((n) => [n.id, n]));
  const edges: Edge[] = [];
  for (const node of positioned) {
    const parentIds = Array.isArray(node.parentIds) ? (node.parentIds as number[]) : [];
    for (const pid of parentIds) {
      const parent = nodeMap.get(pid);
      if (!parent) continue;
      const isAncestorLine = parent.protectionLevel === "ancestor" || node.protectionLevel === "ancestor";
      edges.push({
        key: `${pid}-${node.id}`,
        x1: parent.x + NODE_W / 2,
        y1: parent.y + NODE_H,
        x2: node.x + NODE_W / 2,
        y2: node.y,
        isAncestorLine,
      });
    }
  }
  return edges;
}

function nodeCardClasses(node: LineageNode): { border: string; bg: string } {
  if (node.sourceType === "archived") return { border: "border-muted", bg: "bg-muted/30" };
  switch (node.protectionLevel) {
    case "ancestor": return { border: "border-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30" };
    case "descendant": return { border: "border-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" };
    default: return { border: "border-border", bg: "bg-card" };
  }
}

function protectionBadge(level?: string | null) {
  switch (level) {
    case "ancestor": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-yellow-200 text-yellow-900">Ancestor</span>;
    case "descendant": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-200 text-blue-900">Descendant</span>;
    case "pending": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-700">Pending</span>;
    default: return level ? <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 capitalize">{level}</span> : null;
  }
}

function membershipDot(status?: string | null) {
  switch (status) {
    case "verified": return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" title="Membership verified" />;
    case "pending": return <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" title="Membership pending" />;
    case "rejected": return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" title="Membership rejected" />;
    default: return <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" title="Unknown membership" />;
  }
}

export default function FamilyTreePage() {
  const { user } = useAuth();
  const canEdit = useIsTrustee();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("view-lineage");
  const token = makeToken(user);

  const { data: lineageData, isLoading: lineageLoading } = useQuery<LineageData>({
    queryKey: ["family-tree"],
    queryFn: async () => {
      const r = await fetch("/api/family-tree", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load lineage");
      return r.json();
    },
  });

  const { data: kosData, isLoading: kosLoading } = useQuery<KnowledgeOfSelf>({
    queryKey: ["family-tree-kos"],
    queryFn: async () => {
      const r = await fetch("/api/family-tree/knowledge-of-self", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load knowledge-of-self");
      return r.json();
    },
  });

  return (
    <div data-testid="page-family-tree">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Family Tree &amp; Lineage</h1>
        <p className="text-muted-foreground mt-1">
          Interactive visual family tree — ancestors, descendants, and protected lineage lines
        </p>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap border-b pb-3">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            ].join(" ")}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "upload-photo" && (
        <PhotoUploadTab token={token} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["family-tree"] }); toast({ title: "Photo uploaded", description: "Use Edit Ancestors to extract names and dates." }); }} />
      )}
      {activeTab === "upload-csv" && (
        <CsvUploadTab token={token} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["family-tree"] }); queryClient.invalidateQueries({ queryKey: ["family-tree-kos"] }); toast({ title: "Lineage imported", description: "Family tree data has been stored." }); }} />
      )}
      {activeTab === "view-lineage" && (
        <InteractiveTreeTab token={token} canEdit={canEdit} onDataChange={() => { queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] }); }} />
      )}
      {activeTab === "edit-ancestors" && (
        <EditAncestorsTab token={token} lineageData={lineageData} isLoading={lineageLoading} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["family-tree"] }); toast({ title: "Ancestor saved" }); }} />
      )}
      {activeTab === "knowledge-of-self" && (
        <KnowledgeOfSelfTab token={token} kosData={kosData} lineageData={lineageData} isLoading={kosLoading} onLink={() => { queryClient.invalidateQueries({ queryKey: ["family-tree-kos"] }); toast({ title: "Identity link created" }); }} />
      )}
    </div>
  );
}

function InteractiveTreeTab({ token, canEdit, onDataChange }: { token: string; canEdit: boolean; onDataChange: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canApprove = useCanReviewLineage();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<{ nodes: LineageNode[]; page: number; count: number }>({
    queryKey: ["lineage-nodes"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/nodes?limit=200", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load tree data");
      return r.json();
    },
  });

  const nodes = (data?.nodes ?? []).filter((n) => n.sourceType !== "archived");
  const { positioned, totalW, totalH } = useMemo(() => computeLayout(nodes), [nodes]);
  const edges = useMemo(() => buildEdges(positioned), [positioned]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMemberAddModal, setShowMemberAddModal] = useState(false);
  const [editingNode, setEditingNode] = useState<LineageNode | null>(null);
  const [mergingNode, setMergingNode] = useState<LineageNode | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocusIdx, setSearchFocusIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const q = searchQuery.trim().toLowerCase();
  const matchingNodes = useMemo(() => {
    if (!q) return [] as PositionedNode[];
    return positioned.filter(
      (n) =>
        n.fullName.toLowerCase().includes(q) ||
        (n.tribalNation ?? "").toLowerCase().includes(q) ||
        (n.nameVariants ?? []).some((v) => v.toLowerCase().includes(q))
    );
  }, [q, positioned]);

  const matchingIdSet = useMemo(() => new Set(matchingNodes.map((n) => n.id)), [matchingNodes]);
  const hasSearch = q.length > 0;

  const panToNode = useCallback((node: PositionedNode) => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const targetScale = Math.max(transform.scale, 0.8);
    const x = clientWidth / 2 - (node.x + NODE_W / 2) * targetScale;
    const y = clientHeight / 2 - (node.y + NODE_H / 2) * targetScale;
    setTransform({ x, y, scale: targetScale });
    setSelectedNodeId(node.id);
  }, [transform.scale]);

  const handleSearchKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      setSearchFocusIdx(0);
      return;
    }
    if (matchingNodes.length === 0) return;
    if (e.key === "Enter") {
      const idx = searchFocusIdx % matchingNodes.length;
      panToNode(matchingNodes[idx]);
      setSearchFocusIdx((i) => i + 1);
    }
  }, [matchingNodes, searchFocusIdx, panToNode]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchFocusIdx(0);
    searchInputRef.current?.focus();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const selectedNode = positioned.find((n) => n.id === selectedNodeId) ?? null;

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || totalW === 0 || totalH === 0) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const scaleX = (clientWidth - 40) / totalW;
    const scaleY = (clientHeight - 40) / totalH;
    const scale = Math.min(scaleX, scaleY, 1.5);
    const x = (clientWidth - totalW * scale) / 2;
    const y = (clientHeight - totalH * scale) / 2;
    setTransform({ x, y, scale });
  }, [totalW, totalH]);

  useEffect(() => {
    if (positioned.length > 0) fitToScreen();
  }, [positioned.length > 0]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setTransform((prev) => {
      const newScale = Math.min(3, Math.max(0.15, prev.scale + delta * prev.scale));
      const rect = containerRef.current!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scaleRatio = newScale / prev.scale;
      return {
        scale: newScale,
        x: mouseX - scaleRatio * (mouseX - prev.x),
        y: mouseY - scaleRatio * (mouseY - prev.y),
      };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return;
    setTransform((prev) => ({
      ...prev,
      x: dragStart.current!.tx + (e.clientX - dragStart.current!.x),
      y: dragStart.current!.ty + (e.clientY - dragStart.current!.y),
    }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/lineage/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Import failed");
      return r.json();
    },
    onSuccess: (res) => {
      toast({
        title: "Import complete",
        description: `Created: ${res.created}, Merged: ${res.merged}, Skipped: ${res.skipped}`,
      });
      queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
      onDataChange();
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: 480 }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {canEdit && (
          <Button size="sm" onClick={() => { setEditingNode(null); setShowAddModal(true); }}>
            + Add Person
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setShowMemberAddModal(true)}>
          + Add My Family
        </Button>
        {canEdit && (
          <>
            <input
              ref={importRef}
              type="file"
              accept=".csv,.ged,.gedcom,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} disabled={importMutation.isPending}>
              {importMutation.isPending ? "Importing…" : "Import File"}
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={fitToScreen}>Fit to Screen</Button>
        <Button size="sm" variant="ghost" onClick={() => setTransform((p) => ({ ...p, scale: Math.min(3, p.scale * 1.25) }))}>＋</Button>
        <Button size="sm" variant="ghost" onClick={() => setTransform((p) => ({ ...p, scale: Math.max(0.15, p.scale / 1.25) }))}>－</Button>

        {/* ── Search bar + dropdown (wrapper is the anchor for the dropdown) ── */}
        <div className="relative flex items-center ml-2">
          <svg className="absolute left-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchFocusIdx(0); }}
            onKeyDown={handleSearchKey}
            placeholder="Search by name or nation…"
            className="pl-7 pr-7 py-1 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring w-52"
          />
          {hasSearch && (
            <button
              onClick={clearSearch}
              className="absolute right-2 text-muted-foreground hover:text-foreground leading-none text-base"
              title="Clear search (Esc)"
            >
              ✕
            </button>
          )}

          {/* Dropdown — absolutely positioned below the input, inside the same relative wrapper */}
          {hasSearch && matchingNodes.length > 0 && (
            <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
              <div className="px-2 py-1 text-xs text-muted-foreground border-b bg-muted/40 flex items-center justify-between">
                <span>{matchingNodes.length} result{matchingNodes.length !== 1 ? "s" : ""}</span>
                <span className="opacity-60">Enter to cycle</span>
              </div>
              <ul className="max-h-48 overflow-y-auto divide-y divide-border/50">
                {matchingNodes.slice(0, 12).map((node, i) => {
                  const activeFocusIdx = searchFocusIdx % matchingNodes.length;
                  return (
                    <li key={node.id}>
                      <button
                        className={[
                          "w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors",
                          i === activeFocusIdx ? "bg-accent/50 font-medium" : "",
                        ].join(" ")}
                        onClick={() => { panToNode(node); setSearchFocusIdx(i + 1); }}
                      >
                        <span className="font-medium truncate block">{node.fullName}</span>
                        {node.tribalNation && (
                          <span className="text-muted-foreground truncate block">{node.tribalNation}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {matchingNodes.length > 12 && (
                  <li className="px-3 py-1.5 text-xs text-muted-foreground italic">
                    +{matchingNodes.length - 12} more — refine your search
                  </li>
                )}
              </ul>
            </div>
          )}
          {hasSearch && matchingNodes.length === 0 && (
            <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs text-muted-foreground">
              No matches found
            </div>
          )}
        </div>
        {/* ──────────────────────────────────────────────────────────────────── */}

        <span className="text-xs text-muted-foreground ml-auto">{nodes.length} records · scroll to zoom · drag to pan</span>
      </div>

      <div className="flex flex-1 gap-0 min-h-0">
        <div
          ref={containerRef}
          className={`flex-1 border rounded-lg bg-muted/20 overflow-hidden relative select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-node]")) setSelectedNodeId(null); }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="space-y-3 w-64">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            </div>
          )}

          {!isLoading && nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <p className="text-lg">No lineage records yet.</p>
              {canEdit && (
                <Button onClick={() => setShowAddModal(true)}>Add the first person</Button>
              )}
              <Button variant="secondary" onClick={() => setShowMemberAddModal(true)}>Add My Family Member</Button>
            </div>
          )}

          {!isLoading && positioned.length > 0 && (
            <div
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: "0 0",
                position: "absolute",
                width: totalW,
                height: totalH,
              }}
            >
              <svg
                style={{ position: "absolute", top: 0, left: 0, width: totalW, height: totalH, pointerEvents: "none", overflow: "visible" }}
              >
                {edges.map((edge) => {
                  const cx1 = edge.x1;
                  const cy1 = edge.y1 + V_GAP * 0.4;
                  const cx2 = edge.x2;
                  const cy2 = edge.y2 - V_GAP * 0.4;
                  return (
                    <path
                      key={edge.key}
                      d={`M${edge.x1},${edge.y1} C${cx1},${cy1} ${cx2},${cy2} ${edge.x2},${edge.y2}`}
                      fill="none"
                      stroke={edge.isAncestorLine ? "#ca8a04" : "#94a3b8"}
                      strokeWidth={edge.isAncestorLine ? 2.5 : 1.5}
                      strokeDasharray={edge.isAncestorLine ? undefined : "4 3"}
                      opacity={0.75}
                    />
                  );
                })}
              </svg>

              {positioned.map((node) => {
                const { border, bg } = nodeCardClasses(node);
                const isSelected = node.id === selectedNodeId;
                const isMatch = hasSearch && matchingIdSet.has(node.id);
                const isDimmed = hasSearch && !matchingIdSet.has(node.id);
                return (
                  <div
                    key={node.id}
                    data-node="1"
                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                    style={{ position: "absolute", left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
                    className={[
                      "rounded-lg border-2 px-3 py-2 cursor-pointer transition-all duration-150",
                      bg, border,
                      isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md",
                      isMatch ? "ring-2 ring-amber-400 shadow-amber-200 shadow-md" : "",
                      isDimmed ? "opacity-25" : "",
                      node.sourceType === "archived" ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold leading-tight line-clamp-2 flex-1">
                        {node.fullName}
                      </span>
                      {membershipDot(node.membershipStatus)}
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {node.birthYear && <span>b.{node.birthYear}</span>}
                      {node.birthYear && node.deathYear && <span> – </span>}
                      {node.deathYear && <span>d.{node.deathYear}</span>}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {node.pendingReview && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-yellow-200 text-yellow-900 border border-yellow-400">Pending Review</span>
                      )}
                      {!node.pendingReview && protectionBadge(node.protectionLevel)}
                      {node.linkedProfileUserId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" title="Linked user profile" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            token={token}
            canEdit={canEdit}
            canApprove={canApprove}
            currentUserId={user?.dbId ?? null}
            onClose={() => setSelectedNodeId(null)}
            onEdit={(n) => { setEditingNode(n); setShowAddModal(true); }}
            onMerge={(n) => setMergingNode(n)}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] })}
          />
        )}
      </div>

      {showAddModal && (
        <AddPersonModal
          token={token}
          allNodes={nodes}
          editingNode={editingNode}
          onClose={() => { setShowAddModal(false); setEditingNode(null); }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditingNode(null);
            queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
            onDataChange();
            toast({ title: editingNode ? "Person updated" : "Person added" });
          }}
        />
      )}

      {mergingNode && (
        <MergeModal
          token={token}
          sourceNode={mergingNode}
          allNodes={nodes}
          onClose={() => setMergingNode(null)}
          onSuccess={() => {
            setMergingNode(null);
            setSelectedNodeId(null);
            queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
            onDataChange();
            toast({ title: "Nodes merged successfully" });
          }}
        />
      )}

      {showMemberAddModal && (
        <MemberAddFamilyModal
          token={token}
          allNodes={nodes}
          onClose={() => setShowMemberAddModal(false)}
          onSuccess={() => {
            setShowMemberAddModal(false);
            queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
            onDataChange();
            toast({ title: "Family member submitted", description: "Your submission is pending review by an administrator." });
          }}
        />
      )}
    </div>
  );
}

function NodeDetailPanel({ node, token, canEdit, canApprove, currentUserId, onClose, onEdit, onMerge, onRefresh }: {
  node: PositionedNode;
  token: string;
  canEdit: boolean;
  canApprove: boolean;
  currentUserId?: number | null;
  onClose: () => void;
  onEdit: (node: LineageNode) => void;
  onMerge: (node: LineageNode) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [showEditOwn, setShowEditOwn] = useState(false);
  const [editOwnForm, setEditOwnForm] = useState({ fullName: "", firstName: "", lastName: "", birthYear: "", gender: "", tribalNation: "", supportingDocumentName: "" });

  const { data: detail, isLoading } = useQuery<LineageNode>({
    queryKey: ["lineage-node-detail", node.id],
    queryFn: async () => {
      const r = await fetch(`/api/lineage/nodes/${node.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load node detail");
      return r.json();
    },
  });

  const n = detail ?? node;
  const canEditOwn = !!(
    n.pendingReview &&
    n.addedByMemberId != null &&
    currentUserId != null &&
    n.addedByMemberId === currentUserId
  );

  const editOwnMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        fullName: editOwnForm.fullName || n.fullName,
        firstName: editOwnForm.firstName,
        lastName: editOwnForm.lastName,
        birthYear: editOwnForm.birthYear ? parseInt(editOwnForm.birthYear, 10) : null,
        gender: editOwnForm.gender,
        tribalNation: editOwnForm.tribalNation,
        supportingDocumentName: editOwnForm.supportingDocumentName,
      };
      const r = await fetch(`/api/lineage/nodes/member/${n.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Update failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Submission updated", description: "Your pending submission has been updated." });
      setShowEditOwn(false);
      onRefresh();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function openEditOwn() {
    setEditOwnForm({
      fullName: n.fullName ?? "",
      firstName: n.firstName ?? "",
      lastName: n.lastName ?? "",
      birthYear: n.birthYear?.toString() ?? "",
      gender: n.gender ?? "",
      tribalNation: n.tribalNation ?? "",
      supportingDocumentName: n.supportingDocumentName ?? "",
    });
    setShowEditOwn(true);
  }

  return (
    <div className="w-80 border-l bg-card flex flex-col overflow-y-auto" style={{ minWidth: 300 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-card z-10">
        <span className="font-semibold text-sm truncate">{n.fullName}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none ml-2">✕</button>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
      ) : (
        <div className="p-4 space-y-4 text-sm flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {protectionBadge(n.protectionLevel)}
            {membershipDot(n.membershipStatus)}
            <span className="text-xs text-muted-foreground capitalize">{n.membershipStatus ?? "unknown"}</span>
          </div>

          <div className="space-y-1">
            {n.firstName && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">First name</span><span>{n.firstName}</span></div>}
            {n.lastName && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Last name</span><span>{n.lastName}</span></div>}
            {n.birthYear && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Birth year</span><span>{n.birthYear}</span></div>}
            {n.deathYear && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Death year</span><span>{n.deathYear}</span></div>}
            {n.gender && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Gender</span><span className="capitalize">{n.gender}</span></div>}
            {n.tribalNation && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Tribal nation</span><span>{n.tribalNation}</span></div>}
            {n.tribalEnrollmentNumber && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Enrollment #</span><span>{n.tribalEnrollmentNumber}</span></div>}
            {n.generationalPosition !== undefined && n.generationalPosition !== null && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Generation</span><span>{n.generationalPosition}</span></div>}
            {n.sourceType && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Source</span><span className="capitalize">{n.sourceType}</span></div>}
            {n.linkedProfileUserId && (
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground w-28 shrink-0">Linked user</span>
                <a href="/sovereign-dashboard/profile" className="text-primary underline text-sm hover:opacity-80">View profile</a>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Eligibility</p>
            <div className="flex gap-2 flex-wrap">
              <Badge variant={n.icwaEligible ? "default" : "secondary"} className="text-xs">ICWA: {n.icwaEligible ? "Yes" : "N/A"}</Badge>
              <Badge variant={n.welfareEligible ? "default" : "secondary"} className="text-xs">Welfare: {n.welfareEligible ? "Yes" : "N/A"}</Badge>
              <Badge variant={n.trustBeneficiary ? "default" : "secondary"} className="text-xs">Trust: {n.trustBeneficiary ? "Yes" : "N/A"}</Badge>
            </div>
          </div>

          {Array.isArray(n.nameVariants) && (n.nameVariants as string[]).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Name variants</p>
              <div className="flex flex-wrap gap-1">
                {(n.nameVariants as string[]).map((v, i) => <Badge key={i} variant="outline" className="text-xs">{v}</Badge>)}
              </div>
            </div>
          )}

          {Array.isArray(n.lineageTags) && (n.lineageTags as string[]).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {(n.lineageTags as string[]).map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}
              </div>
            </div>
          )}

          {n._parents && n._parents.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Parents</p>
              {n._parents.map((p) => <p key={p.id} className="text-xs">{p.fullName}{p.birthYear ? ` (b.${p.birthYear})` : ""}</p>)}
            </div>
          )}

          {n._children && n._children.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Children</p>
              {n._children.map((c) => <p key={c.id} className="text-xs">{c.fullName}{c.birthYear ? ` (b.${c.birthYear})` : ""}</p>)}
            </div>
          )}

          {n.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
              <p className="text-xs text-muted-foreground italic">{n.notes}</p>
            </div>
          )}

          {n.pendingReview && canApprove && (
            <div className="border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 rounded-md p-3 space-y-2">
              <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-300 uppercase tracking-widest">Pending Review</p>
              {n.supportingDocumentName && (
                <p className="text-xs text-muted-foreground">Document: <span className="font-medium">{n.supportingDocumentName}</span></p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={async () => {
                    const r = await fetch(`/api/lineage/nodes/${n.id}/approve`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ membershipStatus: "descendant" }),
                    });
                    if (r.ok) { toast({ title: "Approved", description: `${n.fullName} has been approved.` }); onRefresh(); }
                    else { const d = await r.json(); toast({ title: "Error", description: d.error, variant: "destructive" }); }
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={async () => {
                    const r = await fetch(`/api/lineage/nodes/${n.id}/reject`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ reason: "Does not meet membership criteria" }),
                    });
                    if (r.ok) { toast({ title: "Rejected", description: `${n.fullName}'s submission has been rejected.` }); onRefresh(); onClose(); }
                    else { const d = await r.json(); toast({ title: "Error", description: d.error, variant: "destructive" }); }
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}

          {n.pendingReview && !canApprove && (
            <div className="border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 rounded-md px-3 py-2">
              <p className="text-xs text-yellow-900 dark:text-yellow-300 font-medium">Awaiting officer review</p>
            </div>
          )}

          {canEditOwn && !showEditOwn && (
            <div className="pt-1">
              <Button size="sm" variant="outline" className="w-full" onClick={openEditOwn}>
                Edit My Submission
              </Button>
            </div>
          )}

          {canEditOwn && showEditOwn && (
            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Edit Your Pending Submission</p>
              <div>
                <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
                <Input className="mt-1 h-8 text-sm" value={editOwnForm.fullName} onChange={(e) => setEditOwnForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">First Name</Label>
                  <Input className="mt-1 h-8 text-sm" value={editOwnForm.firstName} onChange={(e) => setEditOwnForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Last Name</Label>
                  <Input className="mt-1 h-8 text-sm" value={editOwnForm.lastName} onChange={(e) => setEditOwnForm((p) => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Birth Year</Label>
                  <Input type="number" className="mt-1 h-8 text-sm" value={editOwnForm.birthYear} onChange={(e) => setEditOwnForm((p) => ({ ...p, birthYear: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Gender</Label>
                  <select className="mt-1 w-full border rounded-md px-2 h-8 text-sm bg-input text-foreground" value={editOwnForm.gender} onChange={(e) => setEditOwnForm((p) => ({ ...p, gender: e.target.value }))}>
                    <option value="">Unknown</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Tribal Nation</Label>
                <Input className="mt-1 h-8 text-sm" value={editOwnForm.tribalNation} onChange={(e) => setEditOwnForm((p) => ({ ...p, tribalNation: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Supporting Document Name</Label>
                <Input className="mt-1 h-8 text-sm" value={editOwnForm.supportingDocumentName} onChange={(e) => setEditOwnForm((p) => ({ ...p, supportingDocumentName: e.target.value }))} placeholder="e.g. Birth certificate" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => editOwnMutation.mutate()} disabled={editOwnMutation.isPending || !editOwnForm.fullName.trim()}>
                  {editOwnMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowEditOwn(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {canEdit && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(n)}>Edit</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onMerge(n)}>Merge</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemberAddFamilyModal({ token, allNodes, onClose, onSuccess }: {
  token: string;
  allNodes: LineageNode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    firstName: "",
    lastName: "",
    birthYear: "",
    gender: "",
    tribalNation: "",
    relationshipType: "child",
    supportingDocumentName: "",
    parentSearch: "",
    selectedParentIds: [] as number[],
  });

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const parentSearchResults = useMemo(() => {
    const q = form.parentSearch.toLowerCase().trim();
    if (!q) return [] as LineageNode[];
    return allNodes.filter((n) => n.fullName.toLowerCase().includes(q)).slice(0, 8);
  }, [form.parentSearch, allNodes]);

  const selectedParents = useMemo(() =>
    allNodes.filter((n) => form.selectedParentIds.includes(n.id)), [allNodes, form.selectedParentIds]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        birthYear: form.birthYear ? parseInt(form.birthYear, 10) : undefined,
        gender: form.gender || undefined,
        tribalNation: form.tribalNation || undefined,
        relationshipType: form.relationshipType,
        parentIds: form.selectedParentIds,
        supportingDocumentName: form.supportingDocumentName || undefined,
      };
      const r = await fetch("/api/lineage/nodes/member", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Submission failed");
      return r.json();
    },
    onSuccess,
    onError: (err: Error) => { void err; },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-base">Add My Family Member</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your submission will be reviewed by an officer or administrator.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <Label>Full Name <span className="text-destructive">*</span></Label>
            <Input className="mt-1" value={form.fullName} onChange={f("fullName")} placeholder="Full legal name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name</Label>
              <Input className="mt-1" value={form.firstName} onChange={f("firstName")} placeholder="Given name" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input className="mt-1" value={form.lastName} onChange={f("lastName")} placeholder="Family name" />
            </div>
            <div>
              <Label>Birth Year</Label>
              <Input className="mt-1" type="number" value={form.birthYear} onChange={f("birthYear")} placeholder="e.g. 2005" />
            </div>
            <div>
              <Label>Gender</Label>
              <select value={form.gender} onChange={f("gender")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Tribal Nation</Label>
            <Input className="mt-1" value={form.tribalNation} onChange={f("tribalNation")} placeholder="e.g. Mathias El Tribe" />
          </div>

          <div>
            <Label>Relationship to You <span className="text-destructive">*</span></Label>
            <select value={form.relationshipType} onChange={f("relationshipType")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
              <option value="child">Child (biological)</option>
              <option value="parent">Parent (biological)</option>
              <option value="sibling">Sibling (biological)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">For adoptions, guardianships, or other relationships requiring documentation — contact an administrator for the full intake process.</p>
          </div>

          <div>
            <Label>Link to Existing Member (optional)</Label>
            <Input
              className="mt-1"
              value={form.parentSearch}
              onChange={f("parentSearch")}
              placeholder="Search by name to link as parent…"
            />
            {parentSearchResults.length > 0 && (
              <div className="border rounded-md mt-1 bg-card divide-y max-h-36 overflow-y-auto">
                {parentSearchResults.map((n) => (
                  <button
                    key={n.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      if (!form.selectedParentIds.includes(n.id)) {
                        setForm((prev) => ({ ...prev, selectedParentIds: [...prev.selectedParentIds, n.id], parentSearch: "" }));
                      } else {
                        setForm((prev) => ({ ...prev, parentSearch: "" }));
                      }
                    }}
                  >
                    {n.fullName}{n.birthYear ? ` (b.${n.birthYear})` : ""}
                  </button>
                ))}
              </div>
            )}
            {selectedParents.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedParents.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={() => setForm((prev) => ({ ...prev, selectedParentIds: prev.selectedParentIds.filter((id) => id !== p.id) }))}
                  >
                    {p.fullName} ✕
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Supporting Document (optional)</Label>
            <Input
              className="mt-1"
              value={form.supportingDocumentName}
              onChange={f("supportingDocumentName")}
              placeholder="e.g. Birth Certificate, Adoption Order…"
            />
            <p className="text-xs text-muted-foreground mt-1">Enter the document name or type. Physical documents can be presented to an officer for verification.</p>
          </div>

          {saveMutation.isError && (
            <p className="text-sm text-destructive">{(saveMutation.error as Error).message}</p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t shrink-0">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.fullName} className="flex-1">
            {saveMutation.isPending ? "Submitting…" : "Submit for Review"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function AddPersonModal({ token, allNodes, editingNode, onClose, onSuccess }: {
  token: string;
  allNodes: LineageNode[];
  editingNode: LineageNode | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = editingNode !== null;
  const [form, setForm] = useState({
    fullName: editingNode?.fullName ?? "",
    firstName: editingNode?.firstName ?? "",
    lastName: editingNode?.lastName ?? "",
    birthYear: editingNode?.birthYear?.toString() ?? "",
    deathYear: editingNode?.deathYear?.toString() ?? "",
    gender: editingNode?.gender ?? "",
    tribalNation: editingNode?.tribalNation ?? "",
    tribalEnrollmentNumber: editingNode?.tribalEnrollmentNumber ?? "",
    notes: editingNode?.notes ?? "",
    generationalPosition: editingNode?.generationalPosition?.toString() ?? "0",
    protectionLevel: editingNode?.protectionLevel ?? "pending",
    parentSearch: "",
    selectedParentIds: Array.isArray(editingNode?.parentIds) ? (editingNode!.parentIds as number[]) : [] as number[],
  });

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const parentSearchResults = useMemo(() => {
    const q = form.parentSearch.toLowerCase().trim();
    if (!q) return [];
    return allNodes
      .filter((n) => n.id !== editingNode?.id && n.fullName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [form.parentSearch, allNodes, editingNode]);

  const selectedParents = useMemo(() =>
    allNodes.filter((n) => form.selectedParentIds.includes(n.id)), [allNodes, form.selectedParentIds]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        fullName: form.fullName,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        birthYear: form.birthYear ? parseInt(form.birthYear, 10) : undefined,
        deathYear: form.deathYear ? parseInt(form.deathYear, 10) : undefined,
        gender: form.gender || undefined,
        tribalNation: form.tribalNation || undefined,
        tribalEnrollmentNumber: form.tribalEnrollmentNumber || undefined,
        notes: form.notes || undefined,
        generationalPosition: parseInt(form.generationalPosition, 10) || 0,
        protectionLevel: form.protectionLevel,
        parentIds: form.selectedParentIds,
      };

      const url = isEdit ? `/api/lineage/nodes/${editingNode!.id}` : "/api/lineage/nodes";
      const method = isEdit ? "PATCH" : "POST";

      const r = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
      return r.json();
    },
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="font-semibold text-base">{isEdit ? "Edit Person" : "Add Person"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <Label>Full Name <span className="text-destructive">*</span></Label>
            <Input data-testid="add-person-fullname" className="mt-1" value={form.fullName} onChange={f("fullName")} placeholder="Full name as it appears in records" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name</Label>
              <Input className="mt-1" value={form.firstName} onChange={f("firstName")} placeholder="Given name" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input className="mt-1" value={form.lastName} onChange={f("lastName")} placeholder="Family name" />
            </div>
            <div>
              <Label>Birth Year</Label>
              <Input data-testid="add-person-birthyear" className="mt-1" type="number" value={form.birthYear} onChange={f("birthYear")} placeholder="e.g. 1882" />
            </div>
            <div>
              <Label>Death Year</Label>
              <Input className="mt-1" type="number" value={form.deathYear} onChange={f("deathYear")} placeholder="blank if living" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Generation (0 = oldest)</Label>
              <Input data-testid="add-person-generation" className="mt-1" type="number" value={form.generationalPosition} onChange={f("generationalPosition")} />
            </div>
            <div>
              <Label>Protection Level</Label>
              <select data-testid="add-person-protection" value={form.protectionLevel} onChange={f("protectionLevel")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="pending">Pending</option>
                <option value="ancestor">Ancestor</option>
                <option value="descendant">Descendant</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gender</Label>
              <select value={form.gender} onChange={f("gender")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Tribal Nation</Label>
              <Input className="mt-1" value={form.tribalNation} onChange={f("tribalNation")} placeholder="e.g. Choctaw Nation" />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea className="mt-1" value={form.notes} onChange={f("notes")} rows={2} placeholder="Role, relationships, historical context…" />
          </div>

          <div>
            <Label>Parent (search by name)</Label>
            <Input
              data-testid="add-person-parent-search"
              className="mt-1"
              value={form.parentSearch}
              onChange={f("parentSearch")}
              placeholder="Start typing to search…"
            />
            {parentSearchResults.length > 0 && (
              <div className="border rounded-md mt-1 bg-card divide-y max-h-36 overflow-y-auto">
                {parentSearchResults.map((n) => (
                  <button
                    key={n.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      if (!form.selectedParentIds.includes(n.id)) {
                        setForm((prev) => ({ ...prev, selectedParentIds: [...prev.selectedParentIds, n.id], parentSearch: "" }));
                      } else {
                        setForm((prev) => ({ ...prev, parentSearch: "" }));
                      }
                    }}
                  >
                    {n.fullName}{n.birthYear ? ` (b.${n.birthYear})` : ""}
                  </button>
                ))}
              </div>
            )}
            {selectedParents.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedParents.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className="cursor-pointer text-xs"
                    onClick={() => setForm((prev) => ({ ...prev, selectedParentIds: prev.selectedParentIds.filter((id) => id !== p.id) }))}
                  >
                    {p.fullName} ✕
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {saveMutation.isError && (
            <p className="text-sm text-destructive">{(saveMutation.error as Error).message}</p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t shrink-0">
          <Button data-testid="add-person-submit" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.fullName} className="flex-1">
            {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Person"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function MergeModal({ token, sourceNode, allNodes, onClose, onSuccess }: {
  token: string;
  sourceNode: LineageNode;
  allNodes: LineageNode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [targetNode, setTargetNode] = useState<LineageNode | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return allNodes
      .filter((n) => n.id !== sourceNode.id && n.fullName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, allNodes, sourceNode.id]);

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/lineage/nodes/${sourceNode.id}/merge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: targetNode!.id }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Merge failed");
      return r.json();
    },
    onSuccess,
    onError: (err: Error) => toast({ title: "Merge failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-base">Merge Duplicate</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-muted rounded-md p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Source (will be archived)</p>
            <p className="font-semibold text-sm">{sourceNode.fullName}</p>
            {sourceNode.birthYear && <p className="text-xs text-muted-foreground">b.{sourceNode.birthYear}</p>}
          </div>

          {!targetNode ? (
            <div>
              <Label>Search for the node to merge into</Label>
              <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name…" />
              {results.length > 0 && (
                <div className="border rounded-md mt-1 bg-card divide-y max-h-40 overflow-y-auto">
                  {results.map((n) => (
                    <button
                      key={n.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => { setTargetNode(n); setSearch(""); }}
                    >
                      {n.fullName}{n.birthYear ? ` (b.${n.birthYear})` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-300 rounded-md p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Target (will receive merged data)</p>
                <p className="font-semibold text-sm">{targetNode.fullName}</p>
                {targetNode.birthYear && <p className="text-xs text-muted-foreground">b.{targetNode.birthYear}</p>}
                <button className="text-xs text-muted-foreground underline mt-1" onClick={() => setTargetNode(null)}>Change target</button>
              </div>

              {!confirmed ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This will copy all relationships and name variants from <strong>{sourceNode.fullName}</strong> into <strong>{targetNode.fullName}</strong>, then archive the source record. This cannot be undone automatically.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setConfirmed(true)} className="flex-1">I understand — confirm merge</Button>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={() => mergeMutation.mutate()} disabled={mergeMutation.isPending} className="flex-1">
                    {mergeMutation.isPending ? "Merging…" : "Merge Now"}
                  </Button>
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                </div>
              )}
            </div>
          )}

          {mergeMutation.isError && (
            <p className="text-sm text-destructive">{(mergeMutation.error as Error).message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoUploadTab({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("No file selected");
      const form = new FormData();
      form.append("file", file);
      if (notes) form.append("notes", notes);
      const r = await fetch("/api/family-tree/upload-photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Upload failed");
      return r.json();
    },
    onSuccess: (data) => { setResult(data); onSuccess(); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Upload Family Tree Photo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
            <p className="text-muted-foreground mb-3">Upload a photo or scan of a family tree, genealogy chart, or ancestral document</p>
            <p className="text-xs text-muted-foreground mb-4">Supported: JPG, PNG, WebP (max 20MB)</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" id="photo-upload" />
            <label htmlFor="photo-upload" className="cursor-pointer inline-flex items-center px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
              Choose Photo
            </label>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Family name, approximate time period, location, or other context about the photo…" rows={3} className="mt-1" />
          </div>
          <Button onClick={() => upload.mutate()} disabled={upload.isPending} className="w-full">
            {upload.isPending ? "Uploading…" : "Upload Photo"}
          </Button>
          {upload.isError && <p className="text-sm text-destructive">{(upload.error as Error).message}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base text-green-700">Photo Received</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{result.message as string}</p>
            <div className="bg-muted rounded-md p-3">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2">Next Steps</p>
              <ol className="space-y-1">
                {(result.instructions as string[]).map((step, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{i + 1}. {step}</li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CsvUploadTab({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("No file selected");
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/family-tree/upload-csv", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Upload failed");
      return r.json();
    },
    onSuccess: (data) => { setResult(data); onSuccess(); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload CSV Lineage Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-md p-4">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2">Required CSV Format</p>
            <code className="text-xs block whitespace-pre-wrap text-muted-foreground">{`name,birth_year,death_year,gender,tribal_nation,parent_names,spouse_names,notes
"Mary McCaster",1882,1945,female,"Choctaw Nation","John McCaster;Sarah Richards","",""
"John McCaster Sr.",1850,1920,male,"Choctaw Nation","","","Elder and landowner"
"Thomas McCaster",1905,1978,male,"","Mary McCaster;Henry Brooks","Jane Wilson",""`}</code>
          </div>
          <p className="text-xs text-muted-foreground">
            — <strong>parent_names</strong>: semicolon-separated list of parent full names as they appear in the CSV<br />
            — <strong>spouse_names</strong>: semicolon-separated spouse names<br />
            — <strong>birth_year</strong> / <strong>death_year</strong>: 4-digit years (leave blank if unknown)
          </p>
          <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
            <p className="text-muted-foreground mb-3">Select your CSV file</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer inline-flex items-center px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
              Choose CSV File
            </label>
          </div>
          <Button onClick={() => upload.mutate()} disabled={upload.isPending} className="w-full">
            {upload.isPending ? "Importing…" : "Import Lineage from CSV"}
          </Button>
          {upload.isError && <p className="text-sm text-destructive">{(upload.error as Error).message}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card className="border-green-300 bg-green-50">
            <CardContent className="pt-4">
              <p className="text-green-800 font-semibold">{result.message as string}</p>
            </CardContent>
          </Card>

          {!!result.summary && (() => {
            const s = result.summary as Record<string, unknown>;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Lineage Summary</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Persons</span><span className="font-medium">{s.totalPersons as number}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Generations</span><span className="font-medium">{s.generations as number}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tribal Nations</span><span className="font-medium">{(s.tribalNations as string[]).join(", ") || "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Family Groups</span><span className="font-medium">{(s.familyGroups as string[]).join(", ") || "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Protection Level</span>
                      <Badge className={PROTECTION_COLORS[s.protectionLevel as string] ?? ""}>{s.protectionLevel as string}</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Eligibility</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {[["ICWA", s.icwaEligible], ["Tribal Welfare", (s.benefitEligibility as Record<string, boolean>)?.tribalWelfare], ["Trust Beneficiary", s.trustInheritance], ["Ancestral Land Rights", (s.benefitEligibility as Record<string, boolean>)?.ancestralLandRights]].map(([label, val]) => (
                      <div key={label as string} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label as string}</span>
                        <Badge variant={val ? "default" : "secondary"} className="text-xs">{val ? "Eligible" : "Not Determined"}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function EditAncestorsTab({ token, lineageData, isLoading, onSuccess }: { token: string; lineageData?: LineageData; isLoading: boolean; onSuccess: () => void }) {
  const [form, setForm] = useState({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", generationalPosition: "0" });
  const [editId, setEditId] = useState<number | null>(null);
  const [showMemberAddModal, setShowMemberAddModal] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        fullName: form.fullName,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        birthYear: form.birthYear ? parseInt(form.birthYear, 10) : undefined,
        deathYear: form.deathYear ? parseInt(form.deathYear, 10) : undefined,
        gender: form.gender || undefined,
        tribalNation: form.tribalNation || undefined,
        tribalEnrollmentNumber: form.tribalEnrollmentNumber || undefined,
        notes: form.notes || undefined,
        generationalPosition: parseInt(form.generationalPosition, 10) || 0,
      };

      if (editId !== null) {
        const r = await fetch(`/api/family-tree/${editId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "Update failed");
        return r.json();
      } else {
        const r = await fetch("/api/family-tree/manual", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "Create failed");
        return r.json();
      }
    },
    onSuccess: () => {
      setForm({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", generationalPosition: "0" });
      setEditId(null);
      onSuccess();
    },
  });

  function loadForEdit(person: LineageRecord) {
    setEditId(person.id);
    setForm({
      fullName: person.fullName ?? "",
      firstName: person.firstName ?? "",
      lastName: person.lastName ?? "",
      birthYear: person.birthYear?.toString() ?? "",
      deathYear: person.deathYear?.toString() ?? "",
      gender: person.gender ?? "",
      tribalNation: person.tribalNation ?? "",
      tribalEnrollmentNumber: person.tribalEnrollmentNumber ?? "",
      notes: person.notes ?? "",
      generationalPosition: person.generationalPosition?.toString() ?? "0",
    });
  }

  const fld = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowMemberAddModal(true)}>
          + Add My Family
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editId !== null ? `Editing Ancestor #${editId}` : "Add New Ancestor"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input className="mt-1" value={form.fullName} onChange={fld("fullName")} placeholder="Full name as it appears in records" />
            </div>
            <div>
              <Label>First Name</Label>
              <Input className="mt-1" value={form.firstName} onChange={fld("firstName")} placeholder="Given name" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input className="mt-1" value={form.lastName} onChange={fld("lastName")} placeholder="Family name" />
            </div>
            <div>
              <Label>Gender</Label>
              <select value={form.gender} onChange={fld("gender")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Birth Year</Label>
              <Input className="mt-1" value={form.birthYear} onChange={fld("birthYear")} placeholder="e.g. 1882" type="number" />
            </div>
            <div>
              <Label>Death Year</Label>
              <Input className="mt-1" value={form.deathYear} onChange={fld("deathYear")} placeholder="e.g. 1945 (blank if living)" type="number" />
            </div>
            <div>
              <Label>Generational Position</Label>
              <Input className="mt-1" value={form.generationalPosition} onChange={fld("generationalPosition")} placeholder="0 = oldest ancestor" type="number" />
            </div>
            <div>
              <Label>Tribal Nation</Label>
              <Input className="mt-1" value={form.tribalNation} onChange={fld("tribalNation")} placeholder="e.g. Choctaw Nation" />
            </div>
            <div>
              <Label>Enrollment Number</Label>
              <Input className="mt-1" value={form.tribalEnrollmentNumber} onChange={fld("tribalEnrollmentNumber")} placeholder="Tribal enrollment number" />
            </div>
            <div className="md:col-span-3">
              <Label>Notes</Label>
              <Textarea className="mt-1" value={form.notes} onChange={fld("notes")} placeholder="Role, relationships, place of origin, any relevant history…" rows={3} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.fullName}>
              {saveMutation.isPending ? "Saving…" : editId !== null ? "Update Ancestor" : "Add Ancestor"}
            </Button>
            {editId !== null && (
              <Button variant="outline" onClick={() => { setEditId(null); setForm({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", generationalPosition: "0" }); }}>
                Cancel Edit
              </Button>
            )}
          </div>
          {saveMutation.isError && <p className="text-sm text-destructive">{(saveMutation.error as Error).message}</p>}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (lineageData?.lineage ?? []).length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Existing Ancestors (click to edit)</p>
          <div className="space-y-2">
            {(lineageData?.lineage ?? []).map((person) => (
              <Card key={person.id} className={`cursor-pointer hover:border-primary transition-colors ${editId === person.id ? "border-primary ring-1 ring-primary" : ""}`} onClick={() => loadForEdit(person)}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{person.fullName}</span>
                    <span className="text-xs text-muted-foreground ml-3">
                      {person.birthYear ? `b. ${person.birthYear}` : ""}{person.deathYear ? ` – d. ${person.deathYear}` : ""}
                      {person.tribalNation ? ` · ${person.tribalNation}` : ""}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{person.sourceType ?? "manual"}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showMemberAddModal && (
        <MemberAddFamilyModal
          token={token}
          allNodes={(lineageData?.lineage ?? []) as unknown as LineageNode[]}
          onClose={() => setShowMemberAddModal(false)}
          onSuccess={() => { setShowMemberAddModal(false); onSuccess(); }}
        />
      )}
    </div>
  );
}

function KnowledgeOfSelfTab({ token, kosData, lineageData, isLoading, onLink }: { token: string; kosData?: KnowledgeOfSelf; lineageData?: LineageData; isLoading: boolean; onLink: () => void }) {
  const [selectedLineageId, setSelectedLineageId] = useState<number | "">("");

  const linkMutation = useMutation({
    mutationFn: async (lineageId: number) => {
      const r = await fetch(`/api/family-tree/${lineageId}/link-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Link failed");
      return r.json();
    },
    onSuccess: onLink,
  });

  if (isLoading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const narratives = kosData?.narratives ?? [];
  const linkedAncestors = kosData?.linkedAncestors ?? [];
  const records = kosData?.records ?? [];
  const allLineage = lineageData?.lineage ?? [];

  return (
    <div className="space-y-6">
      {narratives.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Identity Narratives ({narratives.length})</p>
          {narratives.map((n) => (
            <Card key={n.id} className="border-l-4 border-amber-500">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{n.title ?? "Lineage Narrative"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {n.familyGroup && <p className="text-sm"><span className="text-muted-foreground">Family Group: </span>{n.familyGroup}</p>}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Generational Depth: </span>{n.generationalDepth ?? 0}</div>
                  <div><span className="text-muted-foreground">Protection: </span><Badge className={`${PROTECTION_COLORS[n.protectionLevel ?? "standard"]} text-xs`}>{n.protectionLevel ?? "standard"}</Badge></div>
                  <div><span className="text-muted-foreground">ICWA: </span><Badge variant={n.icwaEligible ? "default" : "secondary"} className="text-xs">{n.icwaEligible ? "Eligible" : "N/A"}</Badge></div>
                  <div><span className="text-muted-foreground">Trust: </span><Badge variant={n.trustInheritance ? "default" : "secondary"} className="text-xs">{n.trustInheritance ? "Beneficiary" : "N/A"}</Badge></div>
                  <div><span className="text-muted-foreground">Welfare: </span><Badge variant={n.welfareEligible ? "default" : "secondary"} className="text-xs">{n.welfareEligible ? "Eligible" : "N/A"}</Badge></div>
                </div>
                {n.ancestorChain && n.ancestorChain.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Ancestor Chain</p>
                    <div className="flex flex-wrap gap-1">{n.ancestorChain.map((a, i) => <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>)}</div>
                  </div>
                )}
                {n.identityTags && n.identityTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">{n.identityTags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {linkedAncestors.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Linked Ancestors ({linkedAncestors.length})</p>
          <div className="space-y-2">
            {linkedAncestors.map((a) => (
              <Card key={a.id}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <span className="font-medium text-sm">{a.fullName}</span>
                    {a.tribalNation && <span className="text-xs text-muted-foreground ml-2">· {a.tribalNation}</span>}
                  </div>
                  <Badge className="bg-green-700 text-white text-xs">Linked</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {allLineage.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Link Ancestor to Your Identity Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Linking creates an identity record connecting your user profile to this ancestor, supporting ICWA verification, welfare eligibility, and trust inheritance claims.</p>
            <div>
              <Label>Select Ancestor</Label>
              <select value={selectedLineageId} onChange={(e) => setSelectedLineageId(e.target.value ? parseInt(e.target.value, 10) : "")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="">Select an ancestor to link…</option>
                {allLineage.map((l) => (
                  <option key={l.id} value={l.id}>{l.fullName}{l.birthYear ? ` (b. ${l.birthYear})` : ""}</option>
                ))}
              </select>
            </div>
            <Button onClick={() => { if (selectedLineageId) linkMutation.mutate(selectedLineageId as number); }} disabled={!selectedLineageId || linkMutation.isPending}>
              {linkMutation.isPending ? "Linking…" : "Link to My Identity Profile"}
            </Button>
            {linkMutation.isError && <p className="text-sm text-destructive">{(linkMutation.error as Error).message}</p>}
            {linkMutation.isSuccess && <p className="text-sm text-green-700">Ancestor linked to your identity profile.</p>}
          </CardContent>
        </Card>
      )}

      {narratives.length === 0 && linkedAncestors.length === 0 && records.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No Knowledge-of-Self links yet. Import lineage data via CSV or photo, then link ancestors to your identity profile here.</p>
          </CardContent>
        </Card>
      )}

      {records.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Ancestral Records ({records.length})</p>
          <div className="space-y-2">
            {records.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs capitalize">{rec.recordType}</Badge>
                    <Badge variant={rec.verificationStatus === "verified" ? "default" : "secondary"} className="text-xs">{rec.verificationStatus}</Badge>
                  </div>
                  {rec.documentContent && <p className="text-xs text-muted-foreground mt-1">{rec.documentContent}</p>}
                  <div className="flex gap-2 mt-2">
                    {rec.icwaRelevant && <Badge className="bg-blue-700 text-white text-xs">ICWA</Badge>}
                    {rec.trustRelevant && <Badge className="bg-amber-700 text-white text-xs">Trust</Badge>}
                    {rec.welfareRelevant && <Badge className="bg-green-700 text-white text-xs">Welfare</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
