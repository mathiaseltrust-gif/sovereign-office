import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useIsTrustee, useCanReviewLineage, useIsOfficer, getCurrentBearerToken } from "@/components/auth-provider";
import {
  SlidersHorizontal, Maximize2, Plus, Minus, UserPlus, Users, Upload, X, MapPin,
  BookOpen, Clock, ChevronDown, ChevronRight, AlertTriangle, Shield, Scroll,
  Flame, Star, Info,
} from "lucide-react";
import { MapPickerModal } from "@/components/map-picker-modal";

type Tab = "view-lineage" | "my-submissions" | "edit-ancestors" | "knowledge-of-self" | "deduplicate";

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
  visibility?: string | null;
  photoUrl?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  deathPlace?: string | null;
  deathDate?: string | null;
  burialPlace?: string | null;
  createdAt?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  locationAddress?: string | null;
  _parents?: Array<{ id: number; fullName: string; birthYear?: number | null; photoUrl?: string | null }>;
  _children?: Array<{ id: number; fullName: string; birthYear?: number | null; photoUrl?: string | null }>;
  _spouses?: Array<{ id: number; fullName: string; birthYear?: number | null; photoUrl?: string | null }>;
  _profile?: {
    legalName?: string | null;
    preferredName?: string | null;
    tribalName?: string | null;
    nickname?: string | null;
    mailingAddress?: string | null;
    lineageVerified?: boolean | null;
    membershipVerified?: boolean | null;
  } | null;
}

interface PositionedNode extends LineageNode {
  y: number;
  x: number;
}

interface Edge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isAncestorLine: boolean;
}

interface FamilyUnit {
  id: number;
  gedcomFamId?: string | null;
  husbandId?: number | null;
  wifeId?: number | null;
  spouseIds?: number[] | null;
  childIds?: number[] | null;
  relationshipType?: string | null;
  sourceType?: string | null;
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
  contactEmail?: string;
  isDeceased?: boolean;
  generationalPosition?: number | null;
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

interface HistoricalEvent {
  eventId: string;
  title: string;
  year: number;
  era: string;
  eventType: string | null;
  policyArea: string | null;
  severityLevel: string;
  affectedRegions: string | null;
  identityImpact: string | null;
  reclassificationImpact: string | null;
  ancestorRelevanceNote: string | null;
  plainLanguageSummary: string | null;
  coordinateLat: number | null;
  coordinateLng: number | null;
  relationshipType: string;
  confidenceLevel: string;
  locationMatch: boolean;
}

interface AncestorContext {
  ancestorId: number;
  fullName: string;
  birthYear: number | null;
  deathYear: number | null;
  tribalNation: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  locationAddress: string | null;
  events: HistoricalEvent[];
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
  ancestorContext: AncestorContext[];
}

const TAB_LABELS: Record<Tab, string> = {
  "view-lineage": "Visual Tree",
  "my-submissions": "My Family",
  "edit-ancestors": "Edit Ancestors",
  "knowledge-of-self": "Knowledge-of-Self Links",
  "deduplicate": "Find Duplicates",
};

const PROTECTION_COLORS: Record<string, string> = {
  standard: "bg-green-100 text-green-800",
  elevated: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
  "in-law": "bg-purple-100 text-purple-800",
  affiliate: "bg-purple-100 text-purple-800",
};

const NODE_W = 200;
const NODE_H = 92;
const H_GAP = 48;
const V_GAP = 80;
const CANVAS_PADDING = 60;

function computeLayout(nodes: LineageNode[], familyUnits: FamilyUnit[] = [], preferredRootId?: number | null): { positioned: PositionedNode[]; totalW: number; totalH: number } {
  if (nodes.length === 0) return { positioned: [], totalW: 0, totalH: 0 };

  // ── Identify root (lowest gen, or ID 20 if present) ──────────────────────
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rootNode =
    (preferredRootId ? nodes.find((n) => n.id === preferredRootId) : null)
    ?? nodes.find((n) => n.id === 12)
    ?? nodes.find((n) => n.linkedProfileUserId != null)
    ?? nodes.reduce((a, b) =>
      (a.generationalPosition ?? 99) <= (b.generationalPosition ?? 99) ? a : b
    );

  // ── Tag each node as paternal / maternal / root via BFS ──────────────────
  const side = new Map<number, "root" | "paternal" | "maternal">();
  side.set(rootNode.id, "root");

  // Build child→parent map — seed from node.parentIds, then supplement with FAM records
  const parentOf = new Map<number, number[]>();
  for (const n of nodes) {
    const pids = Array.isArray(n.parentIds) ? (n.parentIds as number[]) : [];
    parentOf.set(n.id, pids);
  }
  // FAM records are authoritative for children that have no parentIds set
  for (const fam of familyUnits) {
    const famParents = [fam.husbandId, fam.wifeId, ...(Array.isArray(fam.spouseIds) ? fam.spouseIds : [])]
      .filter((id): id is number => id != null);
    for (const childId of (Array.isArray(fam.childIds) ? fam.childIds : []) as number[]) {
      if (!byId.has(childId)) continue;
      const existing = parentOf.get(childId) ?? [];
      const extra = famParents.filter((pid) => byId.has(pid) && !existing.includes(pid));
      if (extra.length > 0) parentOf.set(childId, [...existing, ...extra]);
    }
  }

  // Find direct parents of root — first = paternal, second = maternal
  const rootParents = parentOf.get(rootNode.id) ?? [];
  const paternalRootId = rootParents[0] ?? null;
  const maternalRootId = rootParents[1] ?? null;

  function tagSubtree(startId: number, label: "paternal" | "maternal") {
    const queue = [startId];
    while (queue.length) {
      const cur = queue.shift()!;
      if (side.has(cur)) continue;
      side.set(cur, label);
      const n = byId.get(cur);
      if (!n) continue;
      const pids = Array.isArray(n.parentIds) ? (n.parentIds as number[]) : [];
      for (const pid of pids) {
        if (!side.has(pid)) queue.push(pid);
      }
    }
  }

  if (paternalRootId) tagSubtree(paternalRootId, "paternal");
  if (maternalRootId) tagSubtree(maternalRootId, "maternal");
  // Any remaining untagged nodes default to paternal
  for (const n of nodes) {
    if (!side.has(n.id)) side.set(n.id, "paternal");
  }

  // ── Group by generation ───────────────────────────────────────────────────
  const byGen = new Map<number, LineageNode[]>();
  for (const n of nodes) {
    const gen = n.generationalPosition ?? 0;
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(n);
  }

  // Natural family tree order: oldest ancestors at top (highest gen number),
  // self (gen=0) in the middle, children (gen=-1) and grandchildren (gen=-2) below.
  // Simple descending sort: 5 → 4 → 3 → 2 → 1 → 0 → -1 → -2
  const sortedGens = [...byGen.keys()].sort((a, b) => b - a);

  // ── Sort within each generation: root → paternal (left) → maternal (right) ─
  for (const [gen, arr] of byGen) {
    byGen.set(gen, arr.sort((a, b) => {
      const order = { root: 1, paternal: 0, maternal: 2 } as Record<string, number>;
      const sa = order[side.get(a.id) ?? "paternal"] ?? 0;
      const sb = order[side.get(b.id) ?? "paternal"] ?? 0;
      return sa - sb;
    }));
  }

  const maxPerGen = Math.max(...[...byGen.values()].map((g) => g.length));
  const totalW = CANVAS_PADDING * 2 + maxPerGen * NODE_W + (maxPerGen - 1) * H_GAP;
  const positioned: PositionedNode[] = [];

  sortedGens.forEach((gen, genIndex) => {
    const nodesInGen = byGen.get(gen)!;
    const paternal = nodesInGen.filter((n) => side.get(n.id) === "paternal");
    const root = nodesInGen.filter((n) => side.get(n.id) === "root");
    const maternal = nodesInGen.filter((n) => side.get(n.id) === "maternal");

    // For gen 0: center the root node; for other gens: paternal left, maternal right with gap
    const y = CANVAS_PADDING + genIndex * (NODE_H + V_GAP);

    if (root.length > 0 && paternal.length === 0 && maternal.length === 0) {
      // Only root node in this row — center it
      const x = (totalW - NODE_W) / 2;
      root.forEach((n) => positioned.push({ ...n, x, y }));
    } else {
      // Lay out paternal on left half, root in center, maternal on right half
      const CENTER_GAP = 32;
      const halfW = (totalW - CENTER_GAP) / 2;

      // Paternal block (left)
      if (paternal.length > 0) {
        const blockW = paternal.length * NODE_W + (paternal.length - 1) * H_GAP;
        const startX = halfW - blockW; // right-align within left half
        paternal.forEach((n, i) => {
          positioned.push({ ...n, x: startX + i * (NODE_W + H_GAP), y });
        });
      }

      // Root block (center)
      if (root.length > 0) {
        const centerX = (totalW - NODE_W) / 2;
        root.forEach((n, i) => {
          positioned.push({ ...n, x: centerX + i * (NODE_W + H_GAP), y });
        });
      }

      // Maternal block (right)
      if (maternal.length > 0) {
        const startX = halfW + CENTER_GAP;
        maternal.forEach((n, i) => {
          positioned.push({ ...n, x: startX + i * (NODE_W + H_GAP), y });
        });
      }
    }
  });

  const totalH = CANVAS_PADDING * 2 + sortedGens.length * NODE_H + (sortedGens.length - 1) * V_GAP;
  return { positioned, totalW, totalH };
}

function buildEdges(positioned: PositionedNode[], familyUnits: FamilyUnit[] = []): Edge[] {
  const nodeMap = new Map(positioned.map((n) => [n.id, n]));
  const edges: Edge[] = [];
  const added = new Set<string>();

  function pushEdge(parentId: number, childId: number) {
    const key = `${parentId}-${childId}`;
    if (added.has(key)) return;
    const parent = nodeMap.get(parentId);
    const child  = nodeMap.get(childId);
    if (!parent || !child) return;
    added.add(key);
    const isAncestorLine = parent.protectionLevel === "ancestor" || child.protectionLevel === "ancestor";
    edges.push({ key, x1: parent.x + NODE_W / 2, y1: parent.y + NODE_H, x2: child.x + NODE_W / 2, y2: child.y, isAncestorLine });
  }

  // FAM records first — they are the authoritative parent→child source
  for (const fam of familyUnits) {
    const famParents = [fam.husbandId, fam.wifeId, ...(Array.isArray(fam.spouseIds) ? fam.spouseIds : [])]
      .filter((id): id is number => id != null);
    for (const childId of (Array.isArray(fam.childIds) ? fam.childIds : []) as number[]) {
      for (const pid of famParents) pushEdge(pid, childId);
    }
  }

  // Legacy parentIds fallback (for nodes not covered by any FAM record)
  for (const node of positioned) {
    const parentIds = Array.isArray(node.parentIds) ? (node.parentIds as number[]) : [];
    for (const pid of parentIds) pushEdge(pid, node.id);
  }

  return edges;
}

function nodeCardClasses(node: LineageNode): { border: string; bg: string } {
  if (node.sourceType === "archived") return { border: "border-muted", bg: "bg-muted/30" };
  switch (node.protectionLevel) {
    case "ancestor": return { border: "border-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30" };
    case "descendant": return { border: "border-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" };
    case "member":
    case "spouse": return { border: "border-rose-300", bg: "bg-rose-50 dark:bg-rose-950/20" };
    case "in-law":
    case "affiliate": return { border: "border-purple-300", bg: "bg-purple-50 dark:bg-purple-950/20" };
    default: return { border: "border-border", bg: "bg-card" };
  }
}

function protectionBadge(level?: string | null) {
  switch (level) {
    case "ancestor": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-yellow-200 text-yellow-900">Ancestor</span>;
    case "descendant": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-200 text-blue-900">Descendant</span>;
    case "member": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Member</span>;
    case "spouse": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Spouse</span>;
    case "in-law": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">In-Law</span>;
    case "affiliate": return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">Affiliate</span>;
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

  const { data: lineageData, isLoading: lineageLoading } = useQuery<LineageData>({
    queryKey: ["family-tree"],
    queryFn: async () => {
      const r = await fetch("/api/family-tree", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) throw new Error("Failed to load lineage");
      return r.json();
    },
  });

  const { data: kosData, isLoading: kosLoading } = useQuery<KnowledgeOfSelf>({
    queryKey: ["family-tree-kos"],
    queryFn: async () => {
      const r = await fetch("/api/family-tree/knowledge-of-self", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
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

      {activeTab === "view-lineage" && (
        <InteractiveTreeTab canEdit={canEdit} onDataChange={() => { queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] }); }} />
      )}
      {activeTab === "my-submissions" && (
        <MySubmissionsTab onDataChange={() => { queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] }); queryClient.invalidateQueries({ queryKey: ["my-submissions"] }); }} />
      )}
      {activeTab === "edit-ancestors" && (
        <EditAncestorsTab lineageData={lineageData} isLoading={lineageLoading} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["family-tree"] }); toast({ title: "Ancestor saved" }); }} />
      )}
      {activeTab === "knowledge-of-self" && (
        <KnowledgeOfSelfTab kosData={kosData} lineageData={lineageData} isLoading={kosLoading} onLink={() => { queryClient.invalidateQueries({ queryKey: ["family-tree-kos"] }); toast({ title: "Identity link created" }); }} />
      )}
      {activeTab === "deduplicate" && (
        <DeduplicateTab onResolved={() => { queryClient.invalidateQueries({ queryKey: ["family-tree"] }); queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] }); }} />
      )}
    </div>
  );
}

// ── My Family / Submissions Tab ───────────────────────────────────────────
function MySubmissionsTab({ onDataChange }: { onDataChange: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  interface MyNode {
    id: number;
    fullName: string;
    firstName?: string | null;
    lastName?: string | null;
    birthYear?: number | null;
    gender?: string | null;
    tribalNation?: string | null;
    notes?: string | null;
    membershipStatus?: string | null;
    pendingReview?: boolean | null;
    visibility?: string | null;
    sourceType?: string | null;
    addedByMemberId?: number | null;
    supportingDocumentName?: string | null;
    createdAt?: string;
  }

  const { data, isLoading, refetch } = useQuery<{ nodes: MyNode[] }>({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/nodes/my", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error("Failed to load your submissions");
      return r.json();
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, visibility }: { id: number; visibility: string }) => {
      const r = await fetch(`/api/lineage/nodes/member/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Update failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Visibility updated" });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const nodes = data?.nodes ?? [];

  function statusBadge(node: MyNode) {
    if (node.membershipStatus === "verified" || node.membershipStatus === "descendant") {
      return <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-800">Approved</span>;
    }
    if (node.membershipStatus === "rejected") {
      return <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-100 text-red-800">Rejected</span>;
    }
    return <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Pending Review</span>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">My Family Members</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            People you've added to the tribal tree. Control who can see each entry — private entries are only visible to you and the Chief Justice.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)} className="shrink-0">
          + Add Family Member
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : nodes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">You haven't added any family members yet.</p>
            <p className="text-xs mt-1">Click "Add Family Member" to contribute to the tribal family tree.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {nodes.map((node) => (
            <Card key={node.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">{node.fullName}</span>
                      {statusBadge(node)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {node.notes && <p className="truncate">{node.notes}</p>}
                      {node.birthYear && <p>Born {node.birthYear}</p>}
                      {node.tribalNation && <p>{node.tribalNation}</p>}
                      {node.supportingDocumentName && (
                        <p className="text-blue-600">📄 {node.supportingDocumentName}</p>
                      )}
                      {node.createdAt && (
                        <p>Submitted {new Date(node.createdAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Visibility toggle */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Visibility</div>
                    <div className="flex rounded-lg border overflow-hidden text-xs">
                      <button
                        className={[
                          "px-3 py-1.5 font-medium transition-colors",
                          (node.visibility ?? "private") === "private"
                            ? "bg-slate-800 text-white"
                            : "bg-transparent text-muted-foreground hover:bg-muted",
                        ].join(" ")}
                        onClick={() => {
                          if ((node.visibility ?? "private") !== "private") {
                            visibilityMutation.mutate({ id: node.id, visibility: "private" });
                          }
                        }}
                        disabled={visibilityMutation.isPending}
                        title="Only you and administration can see this"
                      >
                        🔒 Private
                      </button>
                      <button
                        className={[
                          "px-3 py-1.5 font-medium transition-colors border-l",
                          (node.visibility ?? "private") === "tribal"
                            ? "bg-emerald-700 text-white"
                            : "bg-transparent text-muted-foreground hover:bg-muted",
                        ].join(" ")}
                        onClick={() => {
                          if ((node.visibility ?? "private") !== "tribal") {
                            visibilityMutation.mutate({ id: node.id, visibility: "tribal" });
                          }
                        }}
                        disabled={visibilityMutation.isPending}
                        title="Name and relationship visible to all tribal members"
                      >
                        🌿 Tribal
                      </button>
                    </div>
                    {(node.visibility ?? "private") === "tribal" && (
                      <p className="text-[9px] text-emerald-700 text-right max-w-[140px] leading-tight">
                        Name visible to all members. Details remain private.
                      </p>
                    )}
                    {(node.visibility ?? "private") === "private" && (
                      <p className="text-[9px] text-muted-foreground text-right max-w-[140px] leading-tight">
                        Only you and the Chief Justice can see this.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground border rounded-lg p-3 bg-muted/30">
        <p className="font-semibold mb-1">How the tribal tree works</p>
        <p>Each member contributes their own family connections. Your entries are yours to manage — they never overwrite anyone else's. The Chief Justice can see all contributions regardless of visibility setting, and uses them to build the collective tribal picture.</p>
      </div>

      {showAddModal && (
        <MemberAddFamilyModal
          allNodes={[]}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refetch();
            onDataChange();
            toast({ title: "Family member submitted", description: "Pending review. You can adjust visibility at any time." });
          }}
        />
      )}
    </div>
  );
}

// ── Tree view mode ──────────────────────────────────────────────────────────────
type TreeViewMode = "family" | "pedigree" | "fan";

// ── Pedigree layout — d3-hierarchy Reingold–Tilford ─────────────────────────────
const PDIG_W    = 158;  // node width
const PDIG_H    = 70;   // node height
const PDIG_CGAP = 52;   // column gap (horizontal, between generations)
const PDIG_RGAP = 18;   // row gap    (vertical, between siblings)
const PDIG_PAD  = 60;   // canvas padding
const PDIG_MAX  = 8;    // max ancestor generations

interface PedigreeNode extends LineageNode {
  px: number; py: number; gen: number; ahnNum: number;
}

/** Horizontal ancestor chart using d3-hierarchy Reingold–Tilford.
 *  Root on the left; oldest ancestors spread to the right.
 *  Paternal line = amber connectors, maternal = sky-blue. */
function computePedigreeLayout(nodes: LineageNode[], preferredRootId?: number | null): {
  placed: PedigreeNode[];
  totalW: number;
  totalH: number;
  pEdges: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; isPat: boolean }>;
} {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const root =
    (preferredRootId ? nodes.find((n) => n.id === preferredRootId) : null)
    ?? nodes.find((n) => n.id === 12)
    ?? nodes.find((n) => n.linkedProfileUserId != null)
    ?? nodes.find(n => (n.generationalPosition ?? 99) === 0)
    ?? nodes[0];
  if (!root) return { placed: [], totalW: 0, totalH: 0, pEdges: [] };

  // Build recursive ancestor structure:  root = focal person; "children" in d3 = parents (upward)
  interface HierDatum { node: LineageNode; ahnNum: number; children?: HierDatum[] }

  function buildHier(id: number, gen: number, ahnNum: number, seen: Set<number>): HierDatum | null {
    if (gen > PDIG_MAX || seen.has(id)) return null;
    const n = byId.get(id);
    if (!n) return null;
    seen.add(id);
    const pids = Array.isArray(n.parentIds) ? (n.parentIds as number[]) : [];
    const kids: HierDatum[] = [];
    if (pids[0]) { const c = buildHier(pids[0], gen + 1, ahnNum * 2,     new Set(seen)); if (c) kids.push(c); }
    if (pids[1]) { const c = buildHier(pids[1], gen + 1, ahnNum * 2 + 1, new Set(seen)); if (c) kids.push(c); }
    return { node: n, ahnNum, children: kids.length ? kids : undefined };
  }

  const hierData = buildHier(root.id, 0, 1, new Set());
  if (!hierData) return { placed: [], totalW: 0, totalH: 0, pEdges: [] };

  const root2 = hierarchy<HierDatum>(hierData, d => d.children);

  // nodeSize: [breadth-spacing (→ our vertical), depth-spacing (→ our horizontal)]
  tree<HierDatum>().nodeSize([PDIG_H + PDIG_RGAP, PDIG_W + PDIG_CGAP])(root2);

  // Bounding box in d3 space (x = breadth, y = depth)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  root2.each(d => {
    const dx = d.x ?? 0; const dy = d.y ?? 0;
    minX = Math.min(minX, dx); maxX = Math.max(maxX, dx);
    minY = Math.min(minY, dy); maxY = Math.max(maxY, dy);
  });

  // Transpose: d3.y (depth) → our px (horizontal); d3.x (breadth) → our py (vertical)
  const totalW = PDIG_PAD * 2 + (maxY - minY) + PDIG_W;
  const totalH = PDIG_PAD * 2 + (maxX - minX) + PDIG_H;

  const placed: PedigreeNode[] = [];
  root2.each(d => {
    const px = PDIG_PAD + ((d.y ?? 0) - minY);
    const py = PDIG_PAD + ((d.x ?? 0) - minX);
    placed.push({ ...d.data.node, px, py, gen: d.depth, ahnNum: d.data.ahnNum });
  });

  const pEdges: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; isPat: boolean }> = [];
  root2.links().forEach(({ source, target }) => {
    const child  = placed.find(p => p.id === source.data.node.id);
    const parent = placed.find(p => p.id === target.data.node.id);
    if (!child || !parent) return;
    pEdges.push({
      key:   `${child.id}-${parent.id}`,
      x1:    child.px + PDIG_W,  y1: child.py  + PDIG_H / 2,
      x2:    parent.px,           y2: parent.py + PDIG_H / 2,
      isPat: target.data.ahnNum % 2 === 0,
    });
  });

  return { placed, totalW, totalH, pEdges };
}

// ── Fan chart layout (radial ancestor wheel) ────────────────────────────────────
const FAN_ROOT_R = 62;   // radius of root circle
const FAN_RING_W = 66;   // thickness of each generation ring
const FAN_MAX_GEN = 7;   // max generations in fan
const FAN_PAD    = 80;   // padding around outermost ring

// Paternal (father's side): warm earth/amber palette
const FAN_PAT_COLORS = ["#7c2d12","#9a3412","#c2410c","#ea580c","#f97316","#fb923c","#fdba74"];
// Maternal (mother's side): cool sky/water palette
const FAN_MAT_COLORS = ["#0c4a6e","#075985","#0369a1","#0284c7","#0ea5e9","#38bdf8","#7dd3fc"];

function fanArcPath(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number): string {
  const f = (v: number) => v.toFixed(2);
  const c = Math.cos, s = Math.sin;
  const lg = (a2 - a1) > Math.PI ? 1 : 0;
  return [
    `M${f(cx + r1 * c(a1))},${f(cy + r1 * s(a1))}`,
    `L${f(cx + r2 * c(a1))},${f(cy + r2 * s(a1))}`,
    `A${r2},${r2} 0 ${lg} 1 ${f(cx + r2 * c(a2))},${f(cy + r2 * s(a2))}`,
    `L${f(cx + r1 * c(a2))},${f(cy + r1 * s(a2))}`,
    `A${r1},${r1} 0 ${lg} 0 ${f(cx + r1 * c(a1))},${f(cy + r1 * s(a1))} Z`,
  ].join(" ");
}

interface FanEntry {
  id: number; node: LineageNode; gen: number; ahnNum: number;
  a1: number; a2: number; isPat: boolean;
}

function buildFanEntries(nodes: LineageNode[], preferredRootId?: number | null): { entries: FanEntry[]; root: LineageNode | null; maxGen: number } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root =
    (preferredRootId ? nodes.find((n) => n.id === preferredRootId) : null)
    ?? nodes.find((n) => n.id === 12)
    ?? nodes.find((n) => n.linkedProfileUserId != null)
    ?? nodes.find((n) => (n.generationalPosition ?? 99) === 0)
    ?? nodes[0] ?? null;
  if (!root) return { entries: [], root: null, maxGen: 0 };

  const entries: FanEntry[] = [];
  const seen = new Set<number>();
  const q: Array<{ id: number; gen: number; ahnNum: number }> = [{ id: root.id, gen: 0, ahnNum: 1 }];
  let qi = 0, maxGen = 0;

  while (qi < q.length) {
    const { id, gen, ahnNum } = q[qi++];
    if (seen.has(id) || gen > FAN_MAX_GEN) continue;
    seen.add(id);
    const n = byId.get(id);
    if (!n) continue;
    maxGen = Math.max(maxGen, gen);

    if (gen > 0) {
      const slots = Math.pow(2, gen);
      const pos   = ahnNum - slots;
      const OFFSET = -Math.PI / 2; // 0° = top (12 o'clock)
      const a1 = OFFSET + (pos / slots) * 2 * Math.PI;
      const a2 = OFFSET + ((pos + 1) / slots) * 2 * Math.PI;
      // Paternal = descendants of father (ahnNum=2); maternal = descendants of mother (ahnNum=3)
      const msb = Math.floor(Math.log2(ahnNum));
      const isPat = ahnNum === 2 || (ahnNum > 2 && msb >= 1 && ((ahnNum >> (msb - 1)) & 1) === 0);
      entries.push({ id, node: n, gen, ahnNum, a1, a2, isPat });
    }

    const pids = Array.isArray(n.parentIds) ? (n.parentIds as number[]) : [];
    if (pids[0] && !seen.has(pids[0])) q.push({ id: pids[0], gen: gen + 1, ahnNum: ahnNum * 2 });
    if (pids[1] && !seen.has(pids[1])) q.push({ id: pids[1], gen: gen + 1, ahnNum: ahnNum * 2 + 1 });
  }

  return { entries, root, maxGen };
}

const TREE_SESSION_KEY = "family-tree-viewport";

function readTreeSession(): { transform: { x: number; y: number; scale: number }; selectedNodeId: number | null } | null {
  try {
    const raw = sessionStorage.getItem(TREE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function InteractiveTreeTab({ canEdit, onDataChange }: { canEdit: boolean; onDataChange: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canApprove = useCanReviewLineage();
  const isOfficer = useIsOfficer();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<{ nodes: LineageNode[]; page: number; count: number }>({
    queryKey: ["lineage-nodes"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/nodes?limit=2000", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) throw new Error("Failed to load tree data");
      return r.json();
    },
  });

  // Always load the current user's own node + immediate family regardless of pagination
  const { data: selfData } = useQuery<{ nodes: LineageNode[] }>({
    queryKey: ["lineage-nodes-self"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/nodes/self", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) return { nodes: [] };
      return r.json();
    },
    staleTime: 30_000,
  });

  // FAM (family unit) records — used to connect orphan nodes that belong to a family group
  const { data: famUnitData } = useQuery<{ familyUnits: FamilyUnit[] }>({
    queryKey: ["family-units"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/family-units", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) return { familyUnits: [] };
      return r.json();
    },
    staleTime: 60_000,
  });
  const familyUnits: FamilyUnit[] = famUnitData?.familyUnits ?? [];

  const nodes = (() => {
    const base = (data?.nodes ?? []).filter((n) => n.sourceType !== "archived");
    const selfNodes = (selfData?.nodes ?? []).filter((n) => n.sourceType !== "archived");
    if (selfNodes.length === 0) return base;
    const existingIds = new Set(base.map((n) => n.id));
    const missing = selfNodes.filter((n) => !existingIds.has(n.id));
    return missing.length > 0 ? [...base, ...missing] : base;
  })();

  // ── Generational zoom — which depth-level of the tree is visible ─────────
  // 1 = Household (self + spouse + children)
  // 2 = + Parents of self and spouse
  // 3 = + Grandparents
  // 4 = + Great-grandparents
  // 5 = 2× Great-grandparents
  // 99 = Full tree (no depth restriction)
  const [generationDepth, setGenerationDepth] = useState(2);

  const DEPTH_MAX = 99;
  const DEPTH_LABELS: Record<number, string> = {
    1: "Household",
    2: "+ Parents",
    3: "+ Grandparents",
    4: "+ Great-grand",
    5: "2× Great-grand",
    6: "3× Great-grand",
    7: "4× Great-grand",
  };
  const depthLabel = generationDepth >= DEPTH_MAX ? "Full Tree" : (DEPTH_LABELS[generationDepth] ?? `${generationDepth - 2}× Great-grand`);

  // Self node resolved from raw data (not from positioned, to avoid circular dependency)
  const selfNodeRaw = useMemo(() => {
    return nodes.find((n) => user?.dbId != null && n.linkedProfileUserId === user.dbId)
      ?? nodes.find((n) => n.id === 20)
      ?? null;
  }, [nodes, user?.dbId]);

  // BFS outward from selfNodeRaw to collect visible node IDs for the given depth level
  const depthVisibleIds = useMemo((): Set<number> | null => {
    if (generationDepth >= DEPTH_MAX) return null; // null = show all
    if (!selfNodeRaw) return null;
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const included = new Set<number>();
    included.add(selfNodeRaw.id);

    // Always include self's spouses
    const selfSpouseIds = (selfNodeRaw.spouseIds ?? []) as number[];
    selfSpouseIds.forEach((id) => included.add(id));

    // Level 1 always: direct children of self (and spouses' children with self)
    const selfChildren = nodes.filter((n) =>
      (n.parentIds ?? []).some((pid) => included.has(pid as number))
    );
    selfChildren.forEach((n) => included.add(n.id));

    if (generationDepth <= 1) return included;

    // Ancestor BFS — each level adds one generation up
    // Start from self + all spouses for ancestor traversal
    let upFrontier: number[] = [selfNodeRaw.id, ...selfSpouseIds];
    for (let lvl = 1; lvl <= generationDepth - 1; lvl++) {
      const nextFrontier: number[] = [];
      for (const uid of upFrontier) {
        const node = byId.get(uid);
        if (!node) continue;
        for (const pid of (node.parentIds ?? []) as number[]) {
          if (!included.has(pid)) {
            included.add(pid);
            nextFrontier.push(pid);
            // Include this ancestor's spouse(s)
            const parent = byId.get(pid);
            if (parent) {
              (parent.spouseIds ?? []).forEach((sid) => included.add(sid as number));
            }
          }
        }
      }
      upFrontier = nextFrontier;

      // Descendant BFS — level 2 shows grandchildren, level 3 great-grandchildren, etc.
      if (lvl >= 1) {
        const childFrontier = [...included];
        for (const cid of childFrontier) {
          nodes.filter((n) => (n.parentIds ?? []).includes(cid as never)).forEach((n) => included.add(n.id));
        }
      }
    }

    return included;
  }, [nodes, selfNodeRaw, generationDepth]);

  // ── Member access restriction ─────────────────────────────────────────────
  // Non-privileged members see only nodes connected to their own lineage path
  // (ancestors they share in common with the tree root, plus their own household).
  const memberAccessFilter = useMemo((): Set<number> | null => {
    const privilegedRoles = new Set(["sovereign_admin", "admin", "trustee", "elder", "officer"]);
    if ((user?.roles ?? []).some((r) => privilegedRoles.has(r))) return null; // no restriction
    const memberNode = nodes.find((n) => user?.dbId != null && n.linkedProfileUserId === user.dbId);
    if (!memberNode) return new Set<number>(); // no lineage node → see nothing
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const visible = new Set<number>();
    visible.add(memberNode.id);
    // Include member's household
    (memberNode.spouseIds ?? []).forEach((id) => visible.add(id as number));
    nodes.filter((n) => (n.parentIds ?? []).includes(memberNode.id as never)).forEach((n) => visible.add(n.id));
    // BFS up: collect all ancestors (these are the "common ancestors" they share)
    const queue: number[] = [...(memberNode.parentIds ?? []) as number[]];
    const visited = new Set<number>();
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      visible.add(id);
      const node = byId.get(id);
      if (node) {
        (node.spouseIds ?? []).forEach((sid) => visible.add(sid as number));
        (node.parentIds ?? []).forEach((pid) => queue.push(pid as number));
      }
    }
    return visible;
  }, [nodes, user?.dbId, user?.roles]);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [filterGender, setFilterGender]           = useState("all");
  const [filterSource, setFilterSource]           = useState("all");
  const [filterProtection, setFilterProtection]   = useState("all");
  const [filterStatus, setFilterStatus]           = useState("all");
  const [filterDeceased, setFilterDeceased]       = useState("all");
  const filteredNodes = useMemo(() => nodes.filter((n) => {
    if (memberAccessFilter !== null && !memberAccessFilter.has(n.id)) return false;
    if (depthVisibleIds    !== null && !depthVisibleIds.has(n.id))    return false;
    if (filterGender !== "all") {
      const g = (n.gender ?? "").toLowerCase();
      if (filterGender === "male"   && g !== "male")                        return false;
      if (filterGender === "female" && g !== "female")                      return false;
      if (filterGender === "other"  && (g === "male" || g === "female"))    return false;
    }
    if (filterSource !== "all"     && (n.sourceType     ?? "manual")  !== filterSource)     return false;
    if (filterProtection !== "all" && (n.protectionLevel ?? "pending") !== filterProtection) return false;
    if (filterStatus !== "all"     && (n.membershipStatus ?? "pending") !== filterStatus)    return false;
    if (filterDeceased === "living"   &&  n.isDeceased) return false;
    if (filterDeceased === "deceased" && !n.isDeceased) return false;
    return true;
  }), [nodes, memberAccessFilter, depthVisibleIds, filterGender, filterSource, filterProtection, filterStatus, filterDeceased]);

  const activeFilterCount = [filterGender, filterSource, filterProtection, filterStatus, filterDeceased]
    .filter((v) => v !== "all").length;

  const clearFilters = useCallback(() => {
    setFilterGender("all"); setFilterSource("all"); setFilterProtection("all");
    setFilterStatus("all"); setFilterDeceased("all");
  }, []);

  // ── Separate orphan nodes (no connections to anyone else) from the main tree
  const connectedNodes = useMemo(() => {
    const nodeIdSet = new Set(filteredNodes.map((n) => n.id));
    // Build set of all node IDs referenced in any FAM record
    const famConnectedIds = new Set<number>();
    for (const fam of familyUnits) {
      const members = [
        fam.husbandId,
        fam.wifeId,
        ...(Array.isArray(fam.spouseIds) ? fam.spouseIds : []),
        ...(Array.isArray(fam.childIds)  ? fam.childIds  : []),
      ].filter((id): id is number => id != null);
      for (const id of members) famConnectedIds.add(id);
    }
    return filteredNodes.filter((n) => {
      const parents  = (Array.isArray(n.parentIds)    ? n.parentIds    as number[] : []);
      const children = (Array.isArray(n.childrenIds)  ? n.childrenIds  as number[] : []);
      const hasDirectLink = parents.some((id) => nodeIdSet.has(id)) || children.some((id) => nodeIdSet.has(id));
      const hasFamLink    = famConnectedIds.has(n.id);
      const hasLink       = hasDirectLink || hasFamLink;
      const isUnrelatedGedcom = n.sourceType === "gedcom" && n.generationalPosition === null && !hasFamLink;
      return hasLink && !isUnrelatedGedcom;
    });
  }, [filteredNodes, familyUnits]);

  const treeNodes = connectedNodes;

  const preferredRootId =
    treeNodes.find((n) => user?.dbId != null && n.linkedProfileUserId === user.dbId)?.id ?? null;

  const { positioned, totalW, totalH } = useMemo(
    () => computeLayout(treeNodes, familyUnits, preferredRootId),
    [treeNodes, familyUnits, preferredRootId]
  );
  const edges = useMemo(() => buildEdges(positioned, familyUnits), [positioned, familyUnits]);

  const containerRef = useRef<HTMLDivElement>(null);

  const [_savedSession] = useState(readTreeSession);
  const [transform, setTransform] = useState(_savedSession?.transform ?? { x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(_savedSession?.selectedNodeId ?? null);
  const hasRestoredSession = useRef(!!_savedSession);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMemberAddModal, setShowMemberAddModal] = useState(false);
  const [editingNode, setEditingNode] = useState<LineageNode | null>(null);
  const [mergingNode, setMergingNode] = useState<LineageNode | null>(null);
  const [treeView, setTreeView] = useState<TreeViewMode>("family");
  const importRef = useRef<HTMLInputElement>(null);

  const pedigreeData = useMemo(
    () => treeView === "pedigree" ? computePedigreeLayout(treeNodes, preferredRootId) : { placed: [], totalW: 0, totalH: 0, pEdges: [] },
    [treeNodes, treeView],
  );
  const fanData = useMemo(
    () => treeView === "fan" ? buildFanEntries(treeNodes, preferredRootId) : { entries: [], root: null, maxGen: 0 },
    [treeNodes, treeView],
  );
  const fanCanvasSize = useMemo(() => {
    if (fanData.maxGen === 0) return (FAN_ROOT_R + FAN_PAD) * 2;
    return (FAN_ROOT_R + fanData.maxGen * FAN_RING_W + FAN_PAD) * 2;
  }, [fanData.maxGen]);

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const q = searchQuery.trim().toLowerCase();
  const allMatchingNodes = useMemo(() => {
    if (!q) return [] as PositionedNode[];
    return positioned.filter(
      (n) =>
        n.fullName.toLowerCase().includes(q) ||
        (n.tribalNation ?? "").toLowerCase().includes(q) ||
        (n.nameVariants ?? []).some((v) => v.toLowerCase().includes(q))
    );
  }, [q, positioned]);

  const matchingNodes = useMemo(() => allMatchingNodes.slice(0, 8), [allMatchingNodes]);
  const matchingIdSet = useMemo(() => new Set(allMatchingNodes.map((n) => n.id)), [allMatchingNodes]);
  const hasSearch = q.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const panToNode = useCallback((node: PositionedNode) => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const targetScale = Math.max(transform.scale, 0.8);
    const x = clientWidth / 2 - (node.x + NODE_W / 2) * targetScale;
    const y = clientHeight / 2 - (node.y + NODE_H / 2) * targetScale;
    setTransform({ x, y, scale: targetScale });
    setSelectedNodeId(node.id);
  }, [transform.scale]);

  const handleSuggestionClick = useCallback((node: PositionedNode) => {
    panToNode(node);
    setDropdownOpen(false);
    setActiveIdx(-1);
  }, [panToNode]);

  const handleSearchKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setDropdownOpen(false);
      setActiveIdx(-1);
      if (!dropdownOpen) {
        setSearchQuery("");
      }
      return;
    }
    if (matchingNodes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % matchingNodes.length);
      setDropdownOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? matchingNodes.length - 1 : i - 1));
      setDropdownOpen(true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeIdx >= 0 ? activeIdx : 0;
      if (matchingNodes[idx]) {
        handleSuggestionClick(matchingNodes[idx]);
      }
    }
  }, [matchingNodes, activeIdx, dropdownOpen, handleSuggestionClick]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setActiveIdx(-1);
    setDropdownOpen(false);
    searchInputRef.current?.focus();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const selectedNode = positioned.find((n) => n.id === selectedNodeId) ?? null;

  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const w = treeView === "pedigree" ? pedigreeData.totalW : treeView === "fan" ? fanCanvasSize : totalW;
    const h = treeView === "pedigree" ? pedigreeData.totalH : treeView === "fan" ? fanCanvasSize : totalH;
    if (w === 0 || h === 0) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const scaleX = (clientWidth - 40) / w;
    const scaleY = (clientHeight - 40) / h;
    const scale = Math.min(scaleX, scaleY, 1.5);
    const x = (clientWidth - w * scale) / 2;
    const y = (clientHeight - h * scale) / 2;
    setTransform({ x, y, scale });
  }, [totalW, totalH, treeView, pedigreeData.totalW, pedigreeData.totalH, fanCanvasSize]);

  // Default: zoom in on the current user's node (or root) and their direct connections
  const centerOnSelf = useCallback(() => {
    if (!containerRef.current || positioned.length === 0) return;
    // 1. Node linked to the current logged-in user (most reliable)
    // 2. Fallback: layout root node — same logic as computeLayout (id=20 first, then min-gen reduce)
    // 3. Fallback: first positioned node
    const selfNode =
      positioned.find((n) => user?.dbId != null && n.linkedProfileUserId === user.dbId) ??
      positioned.find((n) => n.id === 20) ??
      positioned.reduce((a, b) => ((a.generationalPosition ?? 99) <= (b.generationalPosition ?? 99) ? a : b)) ??
      positioned[0];
    if (!selfNode) return;
    const { clientWidth, clientHeight } = containerRef.current;
    // 1.2× shows self + direct parents above + children below in the viewport
    const scale = 1.2;
    const x = clientWidth  / 2 - (selfNode.x + NODE_W / 2) * scale;
    const y = clientHeight / 2 - (selfNode.y + NODE_H / 2) * scale;
    setTransform({ x, y, scale });
    setSelectedNodeId(selfNode.id);
  }, [positioned, user?.dbId]);

  // "Show My Family" — bird's-eye view of 2–3 generations:
  // grandparents → parents → self + siblings → children → grandchildren
  // showMyFamilyView: reset depth to household (Level 1) and fit to screen
  const showMyFamilyView = useCallback(() => {
    setGenerationDepth(1);
    // fitToScreen is called by the generationDepth useEffect below
  }, []);

  useEffect(() => {
    if (positioned.length > 0) {
      if (hasRestoredSession.current) {
        hasRestoredSession.current = false;
      } else {
        // Default: center on the current user's node and open their detail panel.
        // centerOnSelf both pans the viewport to self and selects that node.
        centerOnSelf();
      }
    }
  }, [positioned.length > 0]);

  // Auto-fit viewport whenever the generation depth changes so the view snaps to the
  // newly visible set of nodes without the user having to press "Fit" manually.
  useEffect(() => {
    if (positioned.length === 0) return;
    // Small delay ensures the layout has settled after the depth filter re-renders
    const id = setTimeout(() => fitToScreen(), 60);
    return () => clearTimeout(id);
  }, [generationDepth]);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        sessionStorage.setItem(
          TREE_SESSION_KEY,
          JSON.stringify({ transform, selectedNodeId })
        );
      } catch {
      }
    }, 300);
    return () => clearTimeout(id);
  }, [transform, selectedNodeId]);

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
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
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

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">

        {/* Search */}
        <div ref={searchWrapperRef} className="relative flex items-center">
          <svg className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setActiveIdx(-1); setDropdownOpen(true); }}
            onFocus={() => { if (hasSearch) setDropdownOpen(true); }}
            onKeyDown={handleSearchKey}
            placeholder="Search name or nation…"
            className="pl-8 pr-7 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring w-48"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={dropdownOpen && hasSearch}
          />
          {hasSearch && (
            <button onClick={clearSearch} className="absolute right-2 text-muted-foreground hover:text-foreground" title="Clear (Esc)">
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Search dropdown */}
          {dropdownOpen && hasSearch && matchingNodes.length > 0 && (
            <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
              <div className="px-2 py-1 text-xs text-muted-foreground border-b bg-muted/40 flex items-center justify-between">
                <span>{allMatchingNodes.length} result{allMatchingNodes.length !== 1 ? "s" : ""}{allMatchingNodes.length > 8 ? " — showing 8" : ""}</span>
                <span className="opacity-60">↑↓ to navigate · Enter to go</span>
              </div>
              <ul role="listbox" className="max-h-48 overflow-y-auto divide-y divide-border/50">
                {matchingNodes.map((node, i) => (
                  <li key={node.id} role="option" aria-selected={i === activeIdx}>
                    <button
                      className={[
                        "w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors",
                        i === activeIdx ? "bg-accent text-accent-foreground font-medium" : "",
                      ].join(" ")}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionClick(node)}
                    >
                      <span className="font-medium truncate block">{node.fullName}</span>
                      {node.tribalNation && (
                        <span className="text-muted-foreground truncate block">{node.tribalNation}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dropdownOpen && hasSearch && matchingNodes.length === 0 && (
            <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs text-muted-foreground">
              No matches found
            </div>
          )}
        </div>

        {/* Filters toggle */}
        <Button
          size="sm"
          variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          className="gap-1.5 h-8"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* Divider */}
        <div className="h-5 w-px bg-border mx-0.5 hidden sm:block" />

        {/* View mode switcher */}
        <div className="flex items-center rounded-md border border-input divide-x divide-input overflow-hidden">
          {(["family", "pedigree", "fan"] as TreeViewMode[]).map((mode) => {
            const labels: Record<TreeViewMode, string> = { family: "Family", pedigree: "Pedigree", fan: "Fan" };
            const titles: Record<TreeViewMode, string> = {
              family: "Family tree — vertical layout with all connections",
              pedigree: "Pedigree chart — horizontal, direct ancestors only",
              fan: "Fan chart — radial ancestor wheel",
            };
            return (
              <button
                key={mode}
                onClick={() => { setTreeView(mode); setTransform({ x: 0, y: 0, scale: 1 }); }}
                className={[
                  "px-2.5 py-1 text-xs transition-colors",
                  treeView === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                ].join(" ")}
                title={titles[mode]}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* View controls */}
        <Button size="sm" variant="outline" onClick={centerOnSelf} className="gap-1 h-8" title="Center on my node">
          <Users className="h-3.5 w-3.5" /> Me
        </Button>
        <Button size="sm" variant="outline" onClick={fitToScreen} className="gap-1 h-8" title="Fit current view to screen">
          <Maximize2 className="h-3.5 w-3.5" /> Fit
        </Button>

        {/* Generational depth stepper — + shows more generations (zoom out), – shows fewer (zoom in) */}
        <div className="flex items-center rounded-md border border-input divide-x divide-input overflow-hidden">
          <button
            className="h-8 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title="Show more generations"
            disabled={generationDepth >= DEPTH_MAX}
            onClick={() => setGenerationDepth((d) => Math.min(DEPTH_MAX, d + 1))}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <span
            className="px-2 h-8 flex items-center text-xs font-medium min-w-[110px] justify-center cursor-pointer select-none"
            title="Click to show full tree"
            onClick={() => setGenerationDepth((d) => d >= DEPTH_MAX ? 1 : DEPTH_MAX)}
          >
            {depthLabel}
          </span>
          <button
            className="h-8 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title="Show fewer generations"
            disabled={generationDepth <= 1}
            onClick={() => setGenerationDepth((d) => Math.max(1, d - 1))}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border mx-0.5 hidden sm:block" />

        {/* Add actions */}
        {canEdit && (
          <Button size="sm" onClick={() => { setEditingNode(null); setShowAddModal(true); }} className="gap-1.5 h-8">
            <UserPlus className="h-3.5 w-3.5" /> Add Person
          </Button>
        )}
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
            <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}
              disabled={importMutation.isPending} className="gap-1.5 h-8">
              <Upload className="h-3.5 w-3.5" />
              {importMutation.isPending ? "Importing…" : "Import"}
            </Button>
          </>
        )}

        {/* Record count */}
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {activeFilterCount > 0
            ? <>{connectedNodes.length} connected <span className="opacity-60">of {nodes.length}</span></>
            : <>{connectedNodes.length} <span className="opacity-60">of {nodes.length} people</span></>
          }
          <span className="hidden sm:inline opacity-50"> · scroll to zoom</span>
        </span>
      </div>

      {/* ── Filter panel ─────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="mb-2 rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              { label: "Gender",     value: filterGender,     set: setFilterGender,     opts: [["all","All"],["male","Male"],["female","Female"],["other","Other"]] },
              { label: "Status",     value: filterStatus,     set: setFilterStatus,     opts: [["all","All"],["verified","Verified"],["pending","Pending"],["rejected","Rejected"]] },
              { label: "Source",     value: filterSource,     set: setFilterSource,     opts: [["all","All"],["manual","Manual"],["gedcom","GEDCOM"],["member_self","Member"]] },
              { label: "Living",     value: filterDeceased,   set: setFilterDeceased,   opts: [["all","All"],["living","Living"],["deceased","Deceased"]] },
              { label: "Protection", value: filterProtection, set: setFilterProtection, opts: [["all","All"],["ancestor","Ancestor"],["descendant","Descendant"],["spouse","Spouse"],["member","Member"],["in-law","In-Law"],["affiliate","Affiliate"],["pending","Pending"]] },
            ].map(({ label, value, set, opts }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[62px] shrink-0">{label}</span>
                <div className="flex gap-1 flex-wrap">
                  {opts.map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => set(v)}
                      className={[
                        "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                        value === v
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      ].join(" ")}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
              Clear all filters
            </button>
          )}
        </div>
      )}

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
              <p className="text-lg font-medium">No lineage records yet.</p>
              <p className="text-sm">Add the first person to start building the family tree.</p>
              <div className="flex gap-2">
                {canEdit && (
                  <Button onClick={() => setShowAddModal(true)} className="gap-1.5">
                    <UserPlus className="h-4 w-4" /> Add Person
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setShowMemberAddModal(true)} className="gap-1.5">
                  <Users className="h-4 w-4" /> Add My Family
                </Button>
              </div>
            </div>
          )}

          {!isLoading && nodes.length > 0 && filteredNodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <SlidersHorizontal className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">No people match the current filters.</p>
              <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
            </div>
          )}

          {!isLoading && treeView === "family" && positioned.length > 0 && (
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
                const g = (node.gender ?? "").toLowerCase();
                const genderDot = g === "male"
                  ? "bg-sky-400"
                  : g === "female"
                    ? "bg-pink-400"
                    : "bg-slate-300 dark:bg-slate-500";
                const dateLabel = node.birthYear || node.deathYear
                  ? `${node.birthYear ?? "?"}${node.isDeceased || node.deathYear ? ` – ${node.deathYear ?? "†"}` : ""}`
                  : node.isDeceased ? "Deceased" : "";

                return (
                  <div
                    key={node.id}
                    data-node="1"
                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                    style={{
                      position: "absolute",
                      left: node.x,
                      top: node.y,
                      width: NODE_W,
                      height: NODE_H,
                      zIndex: isSelected ? 20 : 1,
                    }}
                    className={[
                      "rounded-xl border-2 px-3 py-2 cursor-pointer transition-all duration-150 flex flex-col justify-between hover:z-10",
                      bg, border,
                      isSelected ? "ring-2 ring-primary shadow-lg scale-[1.03]" : "hover:shadow-md hover:scale-[1.02]",
                      isMatch ? "ring-2 ring-amber-400 shadow-amber-200/60 shadow-md" : "",
                      isDimmed ? "opacity-20 pointer-events-none" : "",
                      node.sourceType === "archived" ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    {/* Top row: photo/gender dot · name · membership dot */}
                    <div className="flex items-start gap-1.5">
                      {node.photoUrl ? (
                        <img
                          src={node.photoUrl}
                          alt={node.fullName}
                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-border/60"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${genderDot}`} title={node.gender ?? "unknown"} />
                      )}
                      <span className="text-xs font-semibold leading-snug line-clamp-2 flex-1 min-w-0">
                        {node.fullName}
                      </span>
                      {membershipDot(node.membershipStatus)}
                    </div>

                    {/* Bottom: dates + badges */}
                    <div className="mt-1 space-y-1">
                      {dateLabel && (
                        <p className="text-[11px] text-muted-foreground leading-none">{dateLabel}</p>
                      )}
                      <div className="flex items-center gap-1 flex-wrap">
                        {node.pendingReview && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-yellow-200 text-yellow-900 border border-yellow-300">Review</span>
                        )}
                        {!node.pendingReview && node.protectionLevel && node.protectionLevel !== "standard" && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                            node.protectionLevel === "ancestor"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                              : node.protectionLevel === "descendant"
                                ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                                : "bg-muted text-muted-foreground"
                          }`}>{node.protectionLevel}</span>
                        )}
                        {node.tribalNation && !node.pendingReview && (
                          <span className="text-[9px] text-muted-foreground truncate max-w-[90px]" title={node.tribalNation}>
                            {node.tribalNation}
                          </span>
                        )}
                        {node.linkedProfileUserId && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Linked member profile" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Pedigree view ───────────────────────────────────────────────── */}
          {!isLoading && treeView === "pedigree" && pedigreeData.placed.length > 0 && (
            <div
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: "0 0",
                position: "absolute",
                width: pedigreeData.totalW,
                height: pedigreeData.totalH,
              }}
            >
              <svg
                style={{ position: "absolute", top: 0, left: 0, width: pedigreeData.totalW, height: pedigreeData.totalH, pointerEvents: "none", overflow: "visible" }}
              >
                {pedigreeData.pEdges.map((e) => {
                  const midX = (e.x1 + e.x2) / 2;
                  return (
                    <path
                      key={e.key}
                      d={`M${e.x1},${e.y1} H${midX} V${e.y2} H${e.x2}`}
                      fill="none"
                      stroke={e.isPat ? "#b45309" : "#0369a1"}
                      strokeWidth={1.5}
                      opacity={0.55}
                    />
                  );
                })}
              </svg>
              {pedigreeData.placed.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const isRoot = node.ahnNum === 1;
                const isPat = node.ahnNum % 2 === 0;
                const bg = isRoot
                  ? "bg-primary/10 dark:bg-primary/20 border-primary"
                  : isPat
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700"
                    : "bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700";
                const dateStr = node.birthYear
                  ? `${node.birthYear}${node.deathYear ? ` – ${node.deathYear}` : node.isDeceased ? " – †" : ""}`
                  : "";
                return (
                  <div
                    key={node.id}
                    data-node="1"
                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                    style={{ position: "absolute", left: node.px, top: node.py, width: PDIG_W, height: PDIG_H }}
                    className={[
                      "rounded-lg border-2 px-2.5 py-1.5 cursor-pointer transition-all flex flex-col justify-between overflow-hidden",
                      bg,
                      isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md hover:scale-[1.01]",
                    ].join(" ")}
                  >
                    <span className="text-[11px] font-semibold leading-tight line-clamp-2">{node.fullName}</span>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">{dateStr}</span>
                      {node.gen > 0 && (
                        <span className="text-[9px] font-bold text-muted-foreground/50">Gen +{node.gen}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isLoading && treeView === "pedigree" && !isLoading && pedigreeData.placed.length === 0 && nodes.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <p className="text-sm font-medium">No ancestor chain found from the root node.</p>
              <p className="text-xs">Pedigree view shows direct ancestors only (parents, grandparents, etc.).</p>
            </div>
          )}

          {/* ── Fan chart view ──────────────────────────────────────────────── */}
          {!isLoading && treeView === "fan" && (fanData.entries.length > 0 || fanData.root !== null) && (
            <div
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: "0 0",
                position: "absolute",
                width: fanCanvasSize,
                height: fanCanvasSize,
              }}
            >
              <svg
                width={fanCanvasSize}
                height={fanCanvasSize}
                style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
              >
                {fanData.entries.map((entry) => {
                  const r1 = FAN_ROOT_R + (entry.gen - 1) * FAN_RING_W + 2;
                  const r2 = r1 + FAN_RING_W - 4;
                  const cx = fanCanvasSize / 2;
                  const cy = fanCanvasSize / 2;
                  const colors = entry.isPat ? FAN_PAT_COLORS : FAN_MAT_COLORS;
                  const fill = colors[Math.min(entry.gen - 1, colors.length - 1)];
                  const pathD = fanArcPath(cx, cy, r1, r2, entry.a1, entry.a2);
                  const midA = (entry.a1 + entry.a2) / 2;
                  const midR = (r1 + r2) / 2;
                  const tx = cx + midR * Math.cos(midA);
                  const ty = cy + midR * Math.sin(midA);
                  const arcSpan = entry.a2 - entry.a1;
                  const showLabel = arcSpan > 0.12 && entry.gen <= 5;
                  const nameParts = entry.node.fullName.split(" ");
                  const labelText = entry.gen <= 3
                    ? (nameParts[0].length > 11 ? nameParts[0].slice(0, 10) + "…" : nameParts[0])
                    : (nameParts[0].length > 7 ? nameParts[0].slice(0, 6) + "…" : nameParts[0]);
                  const isSelected = entry.id === selectedNodeId;
                  const rotateDeg = (midA * 180 / Math.PI) + 90;
                  return (
                    <g
                      key={entry.id}
                      data-node="1"
                      onClick={(e) => { e.stopPropagation(); setSelectedNodeId(entry.id); }}
                      style={{ cursor: "pointer" }}
                    >
                      <path
                        d={pathD}
                        fill={fill}
                        stroke={isSelected ? "#fbbf24" : "white"}
                        strokeWidth={isSelected ? 2.5 : 0.8}
                        opacity={isSelected ? 1 : 0.88}
                      />
                      {showLabel && (
                        <text
                          x={tx}
                          y={ty}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={Math.max(7, Math.min(11, (arcSpan * midR) / 7))}
                          fill="white"
                          fontWeight="600"
                          style={{ pointerEvents: "none", userSelect: "none" }}
                          transform={`rotate(${rotateDeg}, ${tx}, ${ty})`}
                        >
                          {labelText}
                        </text>
                      )}
                      <title>
                        {entry.node.fullName}
                        {entry.node.birthYear ? ` (${entry.node.birthYear}${entry.node.deathYear ? `–${entry.node.deathYear}` : ""})` : ""}
                        {` · Gen +${entry.gen}`}
                      </title>
                    </g>
                  );
                })}
                {fanData.root && (
                  <g
                    data-node="1"
                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(fanData.root!.id); }}
                    style={{ cursor: "pointer" }}
                  >
                    <circle
                      cx={fanCanvasSize / 2}
                      cy={fanCanvasSize / 2}
                      r={FAN_ROOT_R - 3}
                      fill={selectedNodeId === fanData.root.id ? "#7c3aed" : "#4f46e5"}
                      stroke="white"
                      strokeWidth={3}
                    />
                    <text
                      x={fanCanvasSize / 2}
                      y={fanCanvasSize / 2 - 7}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={11}
                      fontWeight="700"
                      fill="white"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {fanData.root.fullName.split(" ")[0]}
                    </text>
                    {fanData.root.fullName.split(" ").length > 1 && (
                      <text
                        x={fanCanvasSize / 2}
                        y={fanCanvasSize / 2 + 7}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={9}
                        fill="rgba(255,255,255,0.85)"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {fanData.root.fullName.split(" ").slice(1).join(" ").slice(0, 14)}
                      </text>
                    )}
                    <title>{fanData.root.fullName}</title>
                  </g>
                )}
              </svg>
            </div>
          )}

          {/* ── Legend overlay ─────────────────────────────────────────────── */}
          {!isLoading && nodes.length > 0 && (
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-sm pointer-events-none select-none">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Legend</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-3 h-0.5 bg-amber-500 shrink-0" />Ancestor line
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-3 h-0 border-t border-dashed border-slate-400 shrink-0" />Family line
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm bg-yellow-100 border border-yellow-400 shrink-0" />Ancestor
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm bg-sky-50 border border-sky-400 shrink-0" />Descendant
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm bg-rose-50 border border-rose-300 shrink-0" />Member
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />Male
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />Female
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            canEdit={canEdit}
            canApprove={canApprove}
            isOfficer={isOfficer}
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

function NodeDetailPanel({ node, canEdit, canApprove, isOfficer, currentUserId, onClose, onEdit, onMerge, onRefresh }: {
  node: PositionedNode;
  canEdit: boolean;
  canApprove: boolean;
  isOfficer: boolean;
  currentUserId?: number | null;
  onClose: () => void;
  onEdit: (node: LineageNode) => void;
  onMerge: (node: LineageNode) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditOwn, setShowEditOwn] = useState(false);
  const [editOwnForm, setEditOwnForm] = useState({ fullName: "", firstName: "", lastName: "", birthYear: "", gender: "", tribalNation: "", supportingDocumentName: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ email: "", name: "", role: "member", temporaryPassword: "" });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showHousehold, setShowHousehold] = useState(false);
  const [householdRel, setHouseholdRel] = useState<"spouse" | "child" | "dependent">("child");
  const [showReclassify, setShowReclassify] = useState(false);
  const [reclassifyLevel, setReclassifyLevel] = useState<string>("");

  const reclassifyMutation = useMutation({
    mutationFn: async (level: string) => {
      const r = await fetch(`/api/lineage/nodes/${node.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ protectionLevel: level }),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Classification updated", description: `${node.fullName} is now classified as "${reclassifyLevel}".` });
      setShowReclassify(false);
      queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
      queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", node.id] });
      onRefresh();
    },
    onError: (err: Error) => toast({ title: "Reclassify failed", description: err.message, variant: "destructive" }),
  });

  // Fetch the current user's own linked lineage node (for household membership check)
  const { data: selfNodeData, refetch: refetchSelf } = useQuery<{ nodes: Array<{ id: number; spouseIds: unknown; childrenIds: unknown }> }>({
    queryKey: ["lineage-self-node"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/nodes/self", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: isOfficer,
    staleTime: 30_000,
  });

  const selfNode = selfNodeData?.nodes?.[0] ?? null;
  const selfSpouseIds: number[] = Array.isArray(selfNode?.spouseIds) ? (selfNode!.spouseIds as number[]) : [];
  const selfChildIds: number[]  = Array.isArray(selfNode?.childrenIds) ? (selfNode!.childrenIds as number[]) : [];
  const isAlreadyInHousehold = selfNode ? (selfSpouseIds.includes(node.id) || selfChildIds.includes(node.id)) : false;

  const addToHouseholdMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/lineage/nodes/household/add", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ targetNodeId: node.id, relationship: householdRel }),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error ?? "Failed to add to household"); }
      return r.json() as Promise<{ success: boolean; alreadyAdded: boolean; message: string }>;
    },
    onSuccess: (data) => {
      toast({ title: data.alreadyAdded ? "Already in household" : "Added to household", description: data.message });
      setShowHousehold(false);
      refetchSelf();
      queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
      onRefresh();
    },
    onError: (err: Error) => toast({ title: "Could not add to household", description: err.message, variant: "destructive" }),
  });

  const { data: detail, isLoading } = useQuery<LineageNode>({
    queryKey: ["lineage-node-detail", node.id],
    queryFn: async () => {
      const r = await fetch(`/api/lineage/nodes/${node.id}`, { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
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
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Update failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Submission updated", description: "Your pending submission has been updated." });
      setShowEditOwn(false);
      queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", n.id] });
      onRefresh();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ isMemberOwn }: { isMemberOwn: boolean }) => {
      const url = isMemberOwn
        ? `/api/lineage/nodes/member/${n.id}`
        : `/api/lineage/nodes/${n.id}`;
      const r = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? "Delete failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Record deleted", description: `${n.fullName} has been removed from the family tree.` });
      queryClient.invalidateQueries({ queryKey: ["family-tree"] });
      queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
      setConfirmDelete(false);
      onClose();
      onRefresh();
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setConfirmDelete(false);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/lineage/nodes/${n.id}/enroll`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: enrollForm.email,
          name: enrollForm.name || n.fullName,
          role: enrollForm.role,
          ...(enrollForm.temporaryPassword ? { temporaryPassword: enrollForm.temporaryPassword } : {}),
        }),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error ?? "Enrollment failed"); }
      return r.json() as Promise<{ success: boolean; created: boolean; user: { id: number; email: string; name: string; role: string }; message: string; loginMethod: string }>;
    },
    onSuccess: (data) => {
      toast({ title: data.created ? "Account created" : "Account linked", description: data.message });
      setShowEnroll(false);
      queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", n.id] });
      queryClient.invalidateQueries({ queryKey: ["family-tree"] });
      onRefresh();
    },
    onError: (err: Error) => toast({ title: "Enrollment failed", description: err.message, variant: "destructive" }),
  });

  const linkSelfMutation = useMutation({
    mutationFn: async (nodeId: number) => {
      const r = await fetch(`/api/lineage/nodes/${nodeId}/link-self`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error ?? "Failed to link"); }
      return r.json() as Promise<{ linked: boolean; fullName: string; alreadyLinked?: boolean }>;
    },
    onSuccess: (data) => {
      toast({
        title: data.alreadyLinked ? "Already linked" : `Linked — "${data.fullName}" is now your node`,
        description: data.alreadyLinked ? "This node is already linked to your profile." : "The Me button will now center on you.",
      });
      queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", n.id] });
      queryClient.invalidateQueries({ queryKey: ["family-tree"] });
      queryClient.invalidateQueries({ queryKey: ["lineage-nodes"] });
      onRefresh();
    },
    onError: (err: Error) => toast({ title: "Could not link", description: err.message, variant: "destructive" }),
  });

  const updateEnrollMutation = useMutation({
    mutationFn: async (updates: { role?: string; name?: string }) => {
      const r = await fetch(`/api/lineage/nodes/${n.id}/enroll`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error ?? "Update failed"); }
      return r.json() as Promise<{ success: boolean; user: { id: number; email: string; name: string; role: string } }>;
    },
    onSuccess: (data) => {
      toast({ title: "Access updated", description: `${data.user.name} is now a ${data.user.role}.` });
      queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", n.id] });
      onRefresh();
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const locationMutation = useMutation({
    mutationFn: async ({ lat, lng, address }: { lat: number | null; lng: number | null; address: string }) => {
      const r = await fetch(`/api/ancestors/${n.id}/location`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, address }),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error ?? "Failed to save location"); }
      return r.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.lat != null ? "Location saved" : "Location cleared",
        description: vars.lat != null ? (vars.address || `${vars.lat?.toFixed(4)}, ${vars.lng?.toFixed(4)}`) : "Homeland pin removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", n.id] });
      setShowMapPicker(false);
      onRefresh();
    },
    onError: (err: Error) => toast({ title: "Could not save location", description: err.message, variant: "destructive" }),
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
    <div className="w-80 border-l bg-card flex flex-col overflow-y-auto" style={{ minWidth: 300, paddingBottom: 56 }}>
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
            {n._profile?.legalName && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Legal name</span><span className="font-medium">{n._profile.legalName}</span></div>}
            {n._profile?.preferredName && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Preferred name</span><span>{n._profile.preferredName}</span></div>}
            {n._profile?.nickname && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Nickname</span><span>{n._profile.nickname}</span></div>}
            {(n.birthYear || n.birthDate || n.birthPlace) && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Born</span>
                <span>{[n.birthDate ?? (n.birthYear?.toString()), n.birthPlace].filter(Boolean).join(" — ")}</span>
              </div>
            )}
            {(n.deathYear || n.deathDate || n.deathPlace) && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Died</span>
                <span>{[n.deathDate ?? (n.deathYear?.toString()), n.deathPlace].filter(Boolean).join(" — ")}</span>
              </div>
            )}
            {n.burialPlace && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Buried at</span><span>{n.burialPlace}</span></div>}
            {n.gender && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Gender</span><span className="capitalize">{n.gender}</span></div>}
            {(n._profile?.tribalName || n.tribalNation) && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Tribal name</span>
                <span>{n._profile?.tribalName ?? n.tribalNation}</span>
              </div>
            )}
            {n._profile?.tribalName && n.tribalNation && n._profile.tribalName !== n.tribalNation && (
              <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Tribal nation</span><span>{n.tribalNation}</span></div>
            )}
            {n.tribalEnrollmentNumber && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">SSMEL No.</span><span className="font-semibold">{n.tribalEnrollmentNumber}</span></div>}
            {n._profile?.mailingAddress && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Mailing address</span>
                <span className="break-all">{n._profile.mailingAddress}</span>
              </div>
            )}
            {n.generationalPosition !== undefined && n.generationalPosition !== null && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Generation</span><span>{n.generationalPosition}</span></div>}
            {n.sourceType && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Source</span><span className="capitalize">{n.sourceType}</span></div>}
            {n.linkedProfileUserId && (
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground w-28 shrink-0">Linked user</span>
                {n.linkedProfileUserId === currentUserId ? (
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400">You</span>
                ) : (
                  <a href="/sovereign-dashboard/profile" className="text-primary underline text-sm hover:opacity-80">View profile</a>
                )}
              </div>
            )}
            {n._profile && (n._profile.lineageVerified || n._profile.membershipVerified) && (
              <div className="flex gap-1.5 flex-wrap pt-0.5">
                {n._profile.lineageVerified && <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">✓ Lineage verified</span>}
                {n._profile.membershipVerified && <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">✓ Membership verified</span>}
              </div>
            )}
          </div>

          {/* ── "This is me" self-link button ──────────────────────────── */}
          {currentUserId && (!n.linkedProfileUserId || n.linkedProfileUserId === currentUserId) && (
            <div className={`rounded-md border px-3 py-2.5 flex items-center justify-between gap-3 ${
              n.linkedProfileUserId === currentUserId
                ? "border-green-300 bg-green-50 dark:bg-green-950/30"
                : "border-primary/30 bg-primary/5"
            }`}>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {n.linkedProfileUserId === currentUserId ? "This is your node" : "Is this you?"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {n.linkedProfileUserId === currentUserId
                    ? "The Me button centers on this node at 1.8× zoom."
                    : "Link this node to your account so the Me button finds you."}
                </p>
              </div>
              {n.linkedProfileUserId === currentUserId ? (
                <span className="text-green-600 shrink-0">✓</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  disabled={linkSelfMutation.isPending}
                  onClick={() => linkSelfMutation.mutate(n.id)}
                >
                  {linkSelfMutation.isPending ? "Linking…" : "This is me"}
                </Button>
              )}
            </div>
          )}

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
              {n._parents.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 py-0.5">
                  {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" /> : <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground shrink-0">👤</span>}
                  <span className="text-xs">{p.fullName}{p.birthYear ? ` (b.${p.birthYear})` : ""}</span>
                </div>
              ))}
            </div>
          )}

          {n._spouses && n._spouses.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Spouse / Partner</p>
              {n._spouses.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 py-0.5">
                  {s.photoUrl ? <img src={s.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" /> : <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground shrink-0">👤</span>}
                  <span className="text-xs">{s.fullName}{s.birthYear ? ` (b.${s.birthYear})` : ""}</span>
                </div>
              ))}
            </div>
          )}

          {n._children && n._children.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Children</p>
              {n._children.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 py-0.5">
                  {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" /> : <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground shrink-0">👤</span>}
                  <span className="text-xs">{c.fullName}{c.birthYear ? ` (b.${c.birthYear})` : ""}</span>
                </div>
              ))}
            </div>
          )}

          {n.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
              <p className="text-xs text-muted-foreground italic">{n.notes}</p>
            </div>
          )}

          {/* ── Likely Ancestral Location ── */}
          {(canEdit || n.locationLat != null) && (
            <div className="border rounded-md px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Likely Ancestral Location
                </p>
                {canEdit && (
                  <button
                    className="text-[11px] text-primary hover:underline shrink-0"
                    onClick={() => setShowMapPicker(true)}
                    disabled={locationMutation.isPending}
                  >
                    {n.locationLat != null ? "Move pin" : "Add pin"}
                  </button>
                )}
              </div>
              {n.locationLat != null ? (
                <div className="space-y-0.5">
                  {n.locationAddress && <p className="text-xs font-medium text-foreground">{n.locationAddress}</p>}
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {(n.locationLat as number).toFixed(5)}, {(n.locationLng as number).toFixed(5)}
                  </p>
                  {canEdit && (
                    <button
                      className="text-[10px] text-destructive hover:underline"
                      onClick={() => locationMutation.mutate({ lat: null, lng: null, address: "" })}
                      disabled={locationMutation.isPending}
                    >
                      {locationMutation.isPending ? "Removing…" : "Remove pin"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No pin set — click "Add pin" to place this person on the Atlas.</p>
              )}
            </div>
          )}

          {showMapPicker && (
            <MapPickerModal
              initialLat={n.locationLat ?? null}
              initialLng={n.locationLng ?? null}
              initialAddress={n.locationAddress ?? null}
              onConfirm={(lat, lng, address) => locationMutation.mutate({ lat, lng, address })}
              onCancel={() => setShowMapPicker(false)}
            />
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
                      headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ membershipStatus: "descendant" }),
                    });
                    if (r.ok) { toast({ title: "Approved", description: `${n.fullName} has been approved.` }); queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", n.id] }); onRefresh(); }
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
                      headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ reason: "Does not meet membership criteria" }),
                    });
                    if (r.ok) { toast({ title: "Rejected", description: `${n.fullName}'s submission has been rejected.` }); queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", n.id] }); onRefresh(); onClose(); }
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

          {!n.pendingReview && n.membershipStatus === "pending" && canEdit && (
            <div className="border border-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded-md p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase tracking-widest">Membership Not Yet Confirmed</p>
              <p className="text-xs text-blue-700 dark:text-blue-400">Confirm this member to activate their enrollment record.</p>
              <Button
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={async () => {
                  const r = await fetch(`/api/lineage/nodes/${n.id}`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ membershipStatus: "confirmed", protectionLevel: n.protectionLevel === "pending" ? "descendant" : n.protectionLevel }),
                  });
                  if (r.ok) { toast({ title: "Member confirmed", description: `${n.fullName} has been confirmed.` }); queryClient.invalidateQueries({ queryKey: ["lineage-node-detail", n.id] }); onRefresh(); }
                  else { const d = await r.json(); toast({ title: "Error", description: d.error, variant: "destructive" }); }
                }}
              >
                Confirm Member
              </Button>
            </div>
          )}

          {/* ── Grant Membership Access (trustees only) ─────────────────── */}
          {canEdit && (
            <div className="border border-primary/20 rounded-md overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                onClick={() => {
                  setShowEnroll((v) => !v);
                  setEnrollForm({ email: "", name: n.fullName ?? "", role: (n.isAncestor && (n.generationalPosition ?? 0) >= 2) ? "elder" : "member", temporaryPassword: "" });
                }}
              >
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">
                  {n.linkedProfileUserId ? "Membership Access" : "Grant Membership Access"}
                </span>
                <span className="text-xs text-primary">{showEnroll ? "▲" : "▼"}</span>
              </button>

              {showEnroll && (
                <div className="p-3 space-y-3 bg-card">
                  {n.linkedProfileUserId ? (
                    /* ── Already enrolled — show update controls ── */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        Account linked — User #{n.linkedProfileUserId}
                      </div>
                      <div>
                        <Label className="text-xs">Update Role</Label>
                        <select
                          className="mt-1 w-full border rounded-md px-2 h-8 text-sm bg-input text-foreground"
                          defaultValue={n.membershipStatus === "confirmed" ? "member" : "member"}
                          onChange={(e) => updateEnrollMutation.mutate({ role: e.target.value })}
                        >
                          <option value="member">Member</option>
                          <option value="elder">Tribal Elder</option>
                          <option value="officer">Officer</option>
                          <option value="trustee">Trustee</option>
                          <option value="medical_provider">Medical Provider</option>
                          <option value="visitor_media">Visitor / Media</option>
                          <option value="sovereign_admin">Sovereign Admin</option>
                        </select>
                      </div>
                      {updateEnrollMutation.isPending && <p className="text-xs text-muted-foreground">Saving…</p>}
                    </div>
                  ) : (
                    /* ── Not yet enrolled — show grant form ── */
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Create a login account for this person and link it to their lineage record. Their access level will match their assigned role.
                      </p>
                      <div>
                        <Label className="text-xs">Email Address <span className="text-destructive">*</span></Label>
                        <Input
                          className="mt-1 h-8 text-sm"
                          type="email"
                          placeholder="member@example.com"
                          value={enrollForm.email}
                          onChange={(e) => setEnrollForm((p) => ({ ...p, email: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Display Name</Label>
                        <Input
                          className="mt-1 h-8 text-sm"
                          value={enrollForm.name}
                          onChange={(e) => setEnrollForm((p) => ({ ...p, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Role / Access Level</Label>
                        <select
                          className="mt-1 w-full border rounded-md px-2 h-8 text-sm bg-input text-foreground"
                          value={enrollForm.role}
                          onChange={(e) => setEnrollForm((p) => ({ ...p, role: e.target.value }))}
                        >
                          <option value="member">Member</option>
                          <option value="elder">Tribal Elder</option>
                          <option value="officer">Officer</option>
                          <option value="trustee">Trustee</option>
                          <option value="medical_provider">Medical Provider</option>
                          <option value="visitor_media">Visitor / Media</option>
                          <option value="sovereign_admin">Sovereign Admin</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Temporary Password <span className="text-muted-foreground">(optional — leave blank for Microsoft login only)</span></Label>
                        <Input
                          className="mt-1 h-8 text-sm"
                          type="password"
                          placeholder="Min 8 characters"
                          value={enrollForm.temporaryPassword}
                          onChange={(e) => setEnrollForm((p) => ({ ...p, temporaryPassword: e.target.value }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!enrollForm.email.trim() || enrollMutation.isPending}
                        onClick={() => enrollMutation.mutate()}
                      >
                        {enrollMutation.isPending ? "Granting access…" : "Grant Membership Access"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {canEditOwn && !showEditOwn && (
            <div className="pt-1 space-y-2">
              <Button size="sm" variant="outline" className="w-full" onClick={openEditOwn}>
                Edit My Submission
              </Button>
              {!confirmDelete ? (
                <Button size="sm" variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                  Delete My Submission
                </Button>
              ) : (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <p className="text-xs text-destructive font-medium">Remove this record permanently?</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => deleteMutation.mutate({ isMemberOwn: true })} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? "Deleting…" : "Yes, delete"}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                </div>
              )}
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

          {/* ── Add to My Household (officers / trustees only) ──────────────── */}
          {isOfficer && !n.isDeceased && n.id !== currentUserId && (
            <div className="border border-emerald-200 dark:border-emerald-800 rounded-md overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors text-left"
                onClick={() => setShowHousehold((v) => !v)}
              >
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {isAlreadyInHousehold ? "In Your Household" : "Add to My Household"}
                </span>
                {isAlreadyInHousehold ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Added</span>
                ) : (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">{showHousehold ? "▲" : "▼"}</span>
                )}
              </button>

              {showHousehold && (
                <div className="p-3 space-y-3 bg-card">
                  {isAlreadyInHousehold ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      {n.fullName} is already listed in your household. They appear as a household member on the Atlas map.
                    </p>
                  ) : !selfNode ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        To add someone to your household, first link a lineage node to your profile using <strong>"This is me"</strong> on your own card.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        This will add <strong>{n.fullName}</strong> to your household. They will appear as a household member on the Continuity Atlas map.
                      </p>
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">Relationship</label>
                        <select
                          className="w-full border rounded-md px-2 h-8 text-sm bg-input text-foreground"
                          value={householdRel}
                          onChange={(e) => setHouseholdRel(e.target.value as "spouse" | "child" | "dependent")}
                        >
                          <option value="spouse">Spouse / Partner</option>
                          <option value="child">Child / Grandchild</option>
                          <option value="dependent">Dependent</option>
                        </select>
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
                        disabled={addToHouseholdMutation.isPending}
                        onClick={() => addToHouseholdMutation.mutate()}
                      >
                        {addToHouseholdMutation.isPending ? "Adding…" : `Add as ${householdRel}`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Reclassify Connection Type (officers only) ─────────────────── */}
          {isOfficer && (
            <div className="border border-purple-200 dark:border-purple-800 rounded-md overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors text-left"
                onClick={() => { setShowReclassify((v) => !v); setReclassifyLevel(n.protectionLevel ?? "pending"); }}
              >
                <span className="text-xs font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-widest">
                  Connection Type
                </span>
                <span className="flex items-center gap-1.5">
                  {protectionBadge(n.protectionLevel)}
                  <span className="text-xs text-purple-700 dark:text-purple-400">{showReclassify ? "▲" : "▼"}</span>
                </span>
              </button>

              {showReclassify && (
                <div className="p-3 space-y-3 bg-card">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Change how <strong>{n.fullName}</strong> is classified in the lineage record. Only blood relatives should be labeled Ancestor or Descendant.
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {([
                      ["ancestor",   "🟡 Ancestor",          "Blood ancestor — part of the direct lineage"],
                      ["descendant", "🔵 Descendant",        "Blood descendant — part of the direct lineage"],
                      ["spouse",     "🌹 Spouse / Partner",  "Legally married or partnered into the family"],
                      ["in-law",     "🟣 In-Law",            "Related through a spouse or partner, not by blood"],
                      ["affiliate",  "🟣 Affiliate",         "Associated with the family, no blood or marriage tie"],
                      ["member",     "🌹 Member",            "Tribal member by affiliation or enrollment"],
                      ["pending",    "⬜ Pending Review",    "Classification not yet confirmed"],
                    ] as const).map(([val, label, desc]) => (
                      <label
                        key={val}
                        className={`flex items-start gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-colors ${reclassifyLevel === val ? "border-purple-400 bg-purple-50 dark:bg-purple-950/30" : "border-border hover:border-purple-300 hover:bg-muted/40"}`}
                      >
                        <input
                          type="radio"
                          name="reclassify"
                          value={val}
                          checked={reclassifyLevel === val}
                          onChange={() => setReclassifyLevel(val)}
                          className="mt-0.5 accent-purple-600"
                        />
                        <div>
                          <div className="text-xs font-semibold text-foreground">{label}</div>
                          <div className="text-[10px] text-muted-foreground">{desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-purple-700 hover:bg-purple-800 text-white"
                    disabled={reclassifyMutation.isPending || reclassifyLevel === (n.protectionLevel ?? "pending")}
                    onClick={() => reclassifyMutation.mutate(reclassifyLevel)}
                  >
                    {reclassifyMutation.isPending ? "Saving…" : "Save Classification"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(n)}>Edit</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onMerge(n)}>Merge</Button>
              </div>
              {!confirmDelete ? (
                <Button size="sm" variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                  Delete Record
                </Button>
              ) : (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <p className="text-xs text-destructive font-medium">Permanently delete <strong>{n.fullName}</strong> and remove all links to this record?</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => deleteMutation.mutate({ isMemberOwn: false })} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? "Deleting…" : "Yes, delete"}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemberAddFamilyModal({ allNodes, onClose, onSuccess }: {
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
    visibility: "private",
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
        visibility: form.visibility,
      };
      const r = await fetch("/api/lineage/nodes/member", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
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
              <optgroup label="Descendants">
                <option value="child">My Child (son / daughter)</option>
                <option value="grandchild">My Grandchild</option>
                <option value="niece_nephew">My Niece or Nephew</option>
              </optgroup>
              <optgroup label="Same Generation">
                <option value="sibling">My Sibling (same mother &amp; father)</option>
                <option value="half_sibling">My Half-Sibling (one shared parent)</option>
                <option value="cousin">My Cousin</option>
                <option value="spouse">My Spouse / Partner</option>
              </optgroup>
              <optgroup label="Ancestors">
                <option value="parent">My Parent (mother / father)</option>
                <option value="aunt_uncle">My Aunt or Uncle</option>
              </optgroup>
            </select>
            {{
              child: "Your child will be linked to you automatically as their parent.",
              grandchild: "Your grandchild will be added below your generation.",
              niece_nephew: "Your niece or nephew will be linked to you as parent — use the link below to also add their other parent.",
              sibling: "Your shared parents will be copied automatically from your own record.",
              half_sibling: "Use the 'Link to Existing Member' search below to specify the one parent you share.",
              cousin: "Use 'Link to Existing Member' to connect them to their parent (your aunt or uncle).",
              spouse: "Your spouse will be linked to your record automatically.",
              parent: "Use 'Link to Existing Member' to attach them to your grandparents if known.",
              aunt_uncle: "Use 'Link to Existing Member' to connect them to your grandparents.",
            }[form.relationshipType] && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 leading-relaxed">
                {({
                  child: "Your child will be linked to you automatically as their parent.",
                  grandchild: "Your grandchild will be added below your generation.",
                  niece_nephew: "Your niece or nephew will be linked to you as parent — use the link below to also add their other parent.",
                  sibling: "Your shared parents will be copied automatically from your own record.",
                  half_sibling: "Use the 'Link to Existing Member' search below to specify the one parent you share.",
                  cousin: "Use 'Link to Existing Member' to connect them to their parent (your aunt or uncle).",
                  spouse: "Your spouse will be linked to your record automatically.",
                  parent: "Use 'Link to Existing Member' to attach them to your grandparents if known.",
                  aunt_uncle: "Use 'Link to Existing Member' to connect them to your grandparents.",
                } as Record<string, string>)[form.relationshipType]}
              </p>
            )}
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

          <div>
            <Label>Who can see this person in the tribal tree?</Label>
            <select
              value={form.visibility}
              onChange={f("visibility")}
              className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground"
            >
              <option value="private">Private — only me and administration</option>
              <option value="tribal">Share with tribe — name and relationship visible to all members</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {form.visibility === "tribal"
                ? "Other members will see this person's name and your relationship in the shared tribal tree. Sensitive details (notes, documents) remain private."
                : "This entry will only be visible to you and the Chief Justice. You can change this at any time."}
            </p>
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

function AddPersonModal({ allNodes, editingNode, onClose, onSuccess }: {
  allNodes: LineageNode[];
  editingNode: LineageNode | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = editingNode !== null;
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwnNode = editingNode?.linkedProfileUserId != null && editingNode.linkedProfileUserId === user?.dbId;
  const photoFileRef = useRef<HTMLInputElement>(null);
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
    protectionLevel: editingNode?.protectionLevel ?? "member",
    membershipStatus: editingNode?.membershipStatus ?? "confirmed",
    parentSearch: "",
    selectedParentIds: Array.isArray(editingNode?.parentIds) ? (editingNode!.parentIds as number[]) : [] as number[],
    photoUrl: editingNode?.photoUrl ?? "",
    birthPlace: editingNode?.birthPlace ?? "",
    birthDate: editingNode?.birthDate ?? "",
    deathPlace: editingNode?.deathPlace ?? "",
    deathDate: editingNode?.deathDate ?? "",
    burialPlace: editingNode?.burialPlace ?? "",
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
        membershipStatus: form.membershipStatus,
        parentIds: form.selectedParentIds,
        photoUrl: form.photoUrl || null,
        birthPlace: form.birthPlace || null,
        birthDate: form.birthDate || null,
        deathPlace: form.deathPlace || null,
        deathDate: form.deathDate || null,
        burialPlace: form.burialPlace || null,
      };

      const url = isEdit ? `/api/lineage/nodes/${editingNode!.id}` : "/api/lineage/nodes";
      const method = isEdit ? "PATCH" : "POST";

      const r = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
      return r.json();
    },
    onSuccess,
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
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
            <div>
              <Label>Birth Date</Label>
              <Input className="mt-1" value={form.birthDate} onChange={f("birthDate")} placeholder="e.g. 12 MAR 1845" />
            </div>
            <div>
              <Label>Death Date</Label>
              <Input className="mt-1" value={form.deathDate} onChange={f("deathDate")} placeholder="e.g. 4 JUL 1902" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Birthplace</Label>
              <Input className="mt-1" value={form.birthPlace} onChange={f("birthPlace")} placeholder="City, State or County" />
            </div>
            <div>
              <Label>Place of Death</Label>
              <Input className="mt-1" value={form.deathPlace} onChange={f("deathPlace")} placeholder="City, State or County" />
            </div>
          </div>

          <div>
            <Label>Buried At</Label>
            <Input className="mt-1" value={form.burialPlace} onChange={f("burialPlace")} placeholder="Cemetery or town name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Generation (0 = you · higher = older ancestors · negative = descendants)</Label>
              <Input data-testid="add-person-generation" className="mt-1" type="number" value={form.generationalPosition} onChange={f("generationalPosition")} />
            </div>
            <div>
              <Label>Protection Level</Label>
              <select data-testid="add-person-protection" value={form.protectionLevel} onChange={f("protectionLevel")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="ancestor">Ancestor (blood lineage)</option>
                <option value="descendant">Descendant (blood lineage)</option>
                <option value="spouse">Spouse / Partner</option>
                <option value="in-law">In-Law (related by marriage, not blood)</option>
                <option value="affiliate">Affiliate (associated, not blood or marriage)</option>
                <option value="member">Member (tribal affiliation)</option>
                <option value="pending">Pending Review</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Membership Status</Label>
              <select value={form.membershipStatus} onChange={f("membershipStatus")} className="mt-1 w-full border rounded-md p-2 text-sm bg-input text-foreground">
                <option value="confirmed">Confirmed</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <Label>SSMEL Membership No.</Label>
              <Input
                className="mt-1"
                value={form.tribalEnrollmentNumber}
                onChange={f("tribalEnrollmentNumber")}
                placeholder="e.g. SSMEL07"
              />
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
            <Label>Profile Photo</Label>
            <div className="mt-1 flex gap-2 items-start">
              {form.photoUrl && (
                <div className="relative shrink-0">
                  <img
                    src={form.photoUrl}
                    alt="Profile preview"
                    className="w-14 h-14 rounded-full object-cover border border-border"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <button
                    type="button"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-xs flex items-center justify-center leading-none"
                    onClick={() => setForm((p) => ({ ...p, photoUrl: "" }))}
                    title="Remove photo"
                  >✕</button>
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <Input
                  className="h-8 text-sm"
                  value={form.photoUrl}
                  onChange={f("photoUrl")}
                  placeholder="Paste photo URL (e.g. from Ancestry)…"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">or</span>
                  <input
                    ref={photoFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setForm((p) => ({ ...p, photoUrl: (ev.target?.result as string) ?? "" }));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={() => photoFileRef.current?.click()}
                  >
                    <Upload className="w-3 h-3" /> Upload from device
                  </button>
                </div>
              </div>
            </div>
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

function MergeModal({ sourceNode, allNodes, onClose, onSuccess }: {
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
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
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

function PhotoUploadTab({ onSuccess }: { onSuccess: () => void }) {
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
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
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

function CsvUploadTab({ onSuccess }: { onSuccess: () => void }) {
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
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
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

function EditAncestorsTab({ lineageData, isLoading, onSuccess }: { lineageData?: LineageData; isLoading: boolean; onSuccess: () => void }) {
  const [form, setForm] = useState({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", contactEmail: "", generationalPosition: "0", lineageTags: [] as string[] });
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
        contactEmail: form.contactEmail || undefined,
        generationalPosition: parseInt(form.generationalPosition, 10) || 0,
        lineageTags: form.lineageTags.length > 0 ? form.lineageTags : undefined,
      };

      if (editId !== null) {
        const r = await fetch(`/api/family-tree/${editId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "Update failed");
        return r.json();
      } else {
        const r = await fetch("/api/family-tree/manual", {
          method: "POST",
          headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "Create failed");
        return r.json();
      }
    },
    onSuccess: () => {
      setForm({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", contactEmail: "", generationalPosition: "0", lineageTags: [] });
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
      contactEmail: person.contactEmail ?? "",
      generationalPosition: person.generationalPosition?.toString() ?? "0",
      lineageTags: Array.isArray(person.lineageTags) ? (person.lineageTags as string[]) : [],
    });
  }

  function toggleTag(tag: string) {
    setForm(prev => ({
      ...prev,
      lineageTags: prev.lineageTags.includes(tag)
        ? prev.lineageTags.filter(t => t !== tag)
        : [...prev.lineageTags, tag],
    }));
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
            <div>
              <Label>Contact Email</Label>
              <Input className="mt-1" value={form.contactEmail} onChange={fld("contactEmail")} placeholder="email@example.com" type="email" />
              <p className="text-xs text-muted-foreground mt-1">Used to verify access and membership for living members</p>
            </div>
            <div className="md:col-span-3">
              <Label>Treaty & Lineage Affiliations</Label>
              <p className="text-xs text-muted-foreground mb-2 mt-0.5">Select all historical treaty affiliations and lineage markers that apply to this ancestor. These activate inherited rights for their descendants.</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: "dancing-rabbit-creek", label: "Dancing Rabbit Creek (1830)", desc: "Choctaw" },
                  { tag: "choctaw-removal", label: "Choctaw Removal Era", desc: "1830s" },
                  { tag: "ira-allottee", label: "IRA Allottee", desc: "1934" },
                  { tag: "dawes-roll", label: "Dawes Roll", desc: "Five Civilized Tribes" },
                  { tag: "freedmen-roll", label: "Freedmen Roll", desc: "Post-Civil War" },
                  { tag: "removal-survivor", label: "Removal Survivor", desc: "Indian Removal Act" },
                  { tag: "non-intercourse-act", label: "Non-Intercourse Act", desc: "Land protection" },
                ].map(({ tag, label, desc }) => {
                  const active = form.lineageTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-rose-600 border-rose-600 text-white"
                          : "bg-background border-border text-muted-foreground hover:border-rose-400 hover:text-rose-700"
                      }`}
                    >
                      {active && <span className="text-[10px]">✓</span>}
                      {label}
                      <span className={`text-[10px] ${active ? "text-rose-100" : "text-muted-foreground"}`}>{desc}</span>
                    </button>
                  );
                })}
              </div>
              {form.lineageTags.length > 0 && (
                <p className="text-[10px] text-rose-700 mt-1.5">{form.lineageTags.length} affiliation{form.lineageTags.length !== 1 ? "s" : ""} selected — these will activate inherited rights for all blood descendants.</p>
              )}
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
              <Button variant="outline" onClick={() => { setEditId(null); setForm({ fullName: "", firstName: "", lastName: "", birthYear: "", deathYear: "", gender: "", tribalNation: "", tribalEnrollmentNumber: "", notes: "", contactEmail: "", generationalPosition: "0", lineageTags: [] }); }}>
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
          allNodes={(lineageData?.lineage ?? []) as unknown as LineageNode[]}
          onClose={() => setShowMemberAddModal(false)}
          onSuccess={() => { setShowMemberAddModal(false); onSuccess(); }}
        />
      )}
    </div>
  );
}

const KOS_RESOURCES = [
  {
    category: "Sovereign Status & Urban Indian Rights",
    color: "border-amber-600",
    items: [
      { title: "Urban Indian Policy — NCUIH", desc: "National Council of Urban Indian Health: federal policy, 2023 Urban Indian Confer Act, and direct service funding advocacy.", url: "https://ncuih.org/policy/" },
      { title: "Indian Self-Determination & Education Assistance Act (ISDEAA)", desc: "25 U.S.C. § 5301 — the foundational law enabling tribes and urban Indian orgs to contract federal programs.", url: "https://uscode.house.gov/view.xhtml?path=/prelim@title25/chapter46&edition=prelim" },
      { title: "Urban Indian Organizations (UIOs) — IHS", desc: "IHS list of federally funded UIOs providing health care and services to off-reservation tribal members.", url: "https://www.ihs.gov/urban/" },
      { title: "SDU — Sociology of Developing Underclass (Political Context)", desc: "SDU framework applied to urban Indigenous displacement: redress, sovereignty, and self-determination outside the reservation system.", url: "https://www.urbannative.org/" },
    ],
  },
  {
    category: "Ancestry & Blood Quantum Documentation",
    color: "border-sky-600",
    items: [
      { title: "Dawes Rolls — National Archives", desc: "1898–1914 enrollment records for the Five Civilized Tribes. Essential for proving lineal descent and eligibility.", url: "https://www.archives.gov/research/native-americans/dawes" },
      { title: "Mathias El Tribe Enrollment — Sovereign Registry", desc: "Tribal membership is determined by the Mathias El Tribe under inherent sovereign authority — not by any BIA administrative list. Contact the Office of the Chief Justice & Trustee to begin enrollment.", url: "/sovereign-dashboard/directory" },
      { title: "FamilySearch — Native American Records", desc: "Free genealogy database with census rolls, church records, and Indian agency records from the 1800s–1900s.", url: "https://www.familysearch.org/en/wiki/Native_American_Genealogy" },
      { title: "Ancestry.com — Native American Collections", desc: "Digitized Indian census schedules (1885–1940), Dawes packets, and allotment records.", url: "https://www.ancestry.com/search/collections/list/#ghCategories=40" },
    ],
  },
  {
    category: "ICWA & Child Welfare Sovereignty",
    color: "border-red-600",
    items: [
      { title: "Indian Child Welfare Act (ICWA) — Full Text", desc: "25 U.S.C. § 1901 — federal minimum standards for placement of Indian children. Know your rights and the tribe's rights.", url: "https://uscode.house.gov/view.xhtml?path=/prelim@title25/chapter21&edition=prelim" },
      { title: "NICWA — ICWA Compliance Guide", desc: "National Indian Child Welfare Association resources for families, advocates, and courts navigating ICWA cases.", url: "https://www.nicwa.org/icwa/" },
      { title: "Haaland v. Brackeen (2023) — SCOTUS", desc: "Supreme Court ruling upholding ICWA's constitutionality. Key precedent affirming tribal sovereignty in child welfare.", url: "https://www.supremecourt.gov/opinions/22pdf/21-376_3f14.pdf" },
    ],
  },
  {
    category: "Knowing Your Land & Trust Rights",
    color: "border-green-600",
    items: [
      { title: "TAAMS — Trust Asset & Accounting Management", desc: "BIA system for tracking trust land, mineral rights, and Individual Indian Money (IIM) accounts.", url: "https://www.bia.gov/bia/ots/taams" },
      { title: "ILCA — Indian Land Consolidation Act", desc: "Law governing fractionated heirship interests and tribal land consolidation — affects every allottee's descendants.", url: "https://uscode.house.gov/view.xhtml?path=/prelim@title25/chapter24&edition=prelim" },
      { title: "Cobell Settlement — Land Buy-Back Program", desc: "USDA/DOI Land Buy-Back Program purchasing fractionated interests from willing sellers to consolidate tribal lands.", url: "https://www.doi.gov/buybackprogram" },
    ],
  },
  {
    category: "Identity Narrative & Oral History",
    color: "border-purple-600",
    items: [
      { title: "StoryCorps — Tribal Stories Project", desc: "Record and preserve oral histories. StoryCorps has a dedicated process for Indigenous family narratives.", url: "https://storycorps.org/" },
      { title: "American Indian Studies Research Institute", desc: "AISRI at Indiana University: linguistic and archival resources for preserving tribal languages and histories.", url: "https://aisri.indiana.edu/" },
      { title: "NDN Collective — Indigenous Knowledge Hub", desc: "Policy, land, language, and economic self-determination resources for urban and reservation Indigenous people.", url: "https://ndncollective.org/" },
    ],
  },
];

// ─── Who You Are ────────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, { border: string; dot: string; bg: string }> = {
  critical:    { border: "border-red-700/50",    dot: "bg-red-600",     bg: "bg-red-950/20" },
  high:        { border: "border-amber-600/50",  dot: "bg-amber-500",   bg: "bg-amber-950/20" },
  moderate:    { border: "border-emerald-700/50",dot: "bg-emerald-600", bg: "bg-emerald-950/20" },
  beneficial:  { border: "border-sky-700/50",    dot: "bg-sky-500",     bg: "bg-sky-950/20" },
};
function sevStyle(s: string) { return SEV_COLORS[s] ?? { border: "border-border/40", dot: "bg-muted-foreground", bg: "" }; }

function HistEventCard({ ev, lifeStart }: { ev: HistoricalEvent; lifeStart: number | null }) {
  const [open, setOpen] = useState(false);
  const sev = sevStyle(ev.severityLevel);
  const age = lifeStart && ev.year >= lifeStart ? ev.year - lifeStart : null;
  return (
    <div className={`rounded-md border ${sev.border} ${sev.bg} overflow-hidden`}>
      <button
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sev.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">{ev.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ev.year}
            {age !== null ? ` · Age ${age}` : ""}
            {" · "}<span className="capitalize">{ev.era?.replace(/-/g, " ")}</span>
            {ev.locationMatch && <span className="text-primary ml-1">· region match</span>}
          </p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 opacity-50" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 opacity-40" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/10 pt-2">
          {ev.plainLanguageSummary && (
            <p className="text-sm text-foreground/80 leading-relaxed">{ev.plainLanguageSummary}</p>
          )}
          {ev.ancestorRelevanceNote && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">How this may have affected this ancestor</p>
              <p className="text-xs text-foreground/75 italic leading-relaxed">{ev.ancestorRelevanceNote}</p>
            </div>
          )}
          {ev.identityImpact && (
            <div className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-primary/60 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{ev.identityImpact}</p>
            </div>
          )}
          {ev.reclassificationImpact && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{ev.reclassificationImpact}</p>
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap pt-0.5">
            <Badge variant="outline" className="text-[10px] capitalize">{ev.severityLevel}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{ev.confidenceLevel} confidence</Badge>
            {ev.policyArea && <Badge variant="outline" className="text-[10px] capitalize">{ev.policyArea.replace(/_/g," ")}</Badge>}
          </div>
        </div>
      )}
    </div>
  );
}

function WhoYouAreTab({ ancestorContext }: { ancestorContext: AncestorContext[] }) {
  const [expandedAncestorId, setExpandedAncestorId] = useState<number | null>(null);

  if (ancestorContext.length === 0) {
    return (
      <div className="py-12 text-center px-6 space-y-3">
        <BookOpen className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
        <p className="font-semibold text-sm">Your story is waiting to be told</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Add ancestors to your family tree with birth and death years, then link them to your
          identity profile. This view will show you the historical acts and policies that shaped
          their lives — and shaped who you are.
        </p>
      </div>
    );
  }

  // Collect all unique events across all ancestors for the "shaped by history" summary
  const allEventMap = new Map<string, HistoricalEvent & { ancestorNames: string[] }>();
  for (const ancestor of ancestorContext) {
    for (const ev of ancestor.events) {
      if (!allEventMap.has(ev.eventId)) {
        allEventMap.set(ev.eventId, { ...ev, ancestorNames: [ancestor.fullName] });
      } else {
        allEventMap.get(ev.eventId)!.ancestorNames.push(ancestor.fullName);
      }
    }
  }
  const topEvents = [...allEventMap.values()]
    .sort((a, b) => {
      const sevOrd: Record<string, number> = { critical: 0, high: 1, moderate: 2, beneficial: 3 };
      return (sevOrd[a.severityLevel] ?? 2) - (sevOrd[b.severityLevel] ?? 2) || a.year - b.year;
    })
    .slice(0, 8);

  const tribalNations = [...new Set(ancestorContext.flatMap(a => a.tribalNation ? [a.tribalNation] : []))];
  const totalEvents = allEventMap.size;
  const critCount = [...allEventMap.values()].filter(e => e.severityLevel === "critical").length;

  return (
    <div className="space-y-6">
      {/* Identity statement */}
      <Card className="border-amber-400/30 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Scroll className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="font-bold text-base text-amber-900 dark:text-amber-300 font-serif">
              Who You Are
            </p>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-300/90 leading-relaxed">
            You descend from{" "}
            <strong>{ancestorContext.length} documented ancestor{ancestorContext.length !== 1 ? "s" : ""}</strong>
            {tribalNations.length > 0 && (
              <> of the <strong>{tribalNations.join(", ")}</strong> nation{tribalNations.length !== 1 ? "s" : ""}</>
            )}.
            {" "}Across their lifetimes, your people faced{" "}
            <strong>{totalEvents} recorded federal acts, policies, and events</strong>
            {critCount > 0 && <> — including {critCount} of critical severity</>}.{" "}
            These were not abstractions. They shaped where your family lived, how they were classified,
            whether they were counted, and whether their children were taken.
            This is your history. This is who you are.
          </p>
          {tribalNations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tribalNations.map(n => (
                <Badge key={n} className="bg-amber-700/20 text-amber-800 dark:text-amber-300 border-amber-600/30 text-xs">
                  {n}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shaped by history — top events across all ancestors */}
      {topEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-red-600/70" />
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Acts That Shaped Your People ({totalEvents} total)
            </p>
          </div>
          <div className="space-y-2">
            {topEvents.map(ev => (
              <div key={ev.eventId} className={`rounded-md border ${sevStyle(ev.severityLevel).border} ${sevStyle(ev.severityLevel).bg} px-3 py-2.5`}>
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sevStyle(ev.severityLevel).dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">{ev.title} <span className="font-normal text-muted-foreground">({ev.year})</span></p>
                    {ev.plainLanguageSummary && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.plainLanguageSummary}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Affected: {ev.ancestorNames.slice(0, 3).join(", ")}{ev.ancestorNames.length > 3 ? ` +${ev.ancestorNames.length - 3} more` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{ev.severityLevel}</Badge>
                </div>
              </div>
            ))}
          </div>
          {totalEvents > 8 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {totalEvents - 8} more events shown per ancestor below
            </p>
          )}
        </div>
      )}

      {/* Per-ancestor sections */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground/60" />
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Your Ancestors — Life by Life
          </p>
        </div>
        <div className="space-y-3">
          {ancestorContext.map(ancestor => {
            const isOpen = expandedAncestorId === ancestor.ancestorId;
            const lifespan = [ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ") || "Dates unknown";
            const critAncCount = ancestor.events.filter(e => e.severityLevel === "critical").length;
            const sortedEvts = [...ancestor.events].sort((a, b) => a.year - b.year);

            return (
              <Card key={ancestor.ancestorId} className="overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedAncestorId(isOpen ? null : ancestor.ancestorId)}
                >
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-serif">{ancestor.fullName}</CardTitle>
                          {ancestor.tribalNation && (
                            <Badge variant="outline" className="text-[10px]">{ancestor.tribalNation}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lifespan}
                          {ancestor.birthPlace ? ` · ${ancestor.birthPlace}` : ancestor.locationAddress ? ` · ${ancestor.locationAddress}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-medium">{ancestor.events.length} events</p>
                          {critAncCount > 0 && <p className="text-[10px] text-red-600">{critAncCount} critical</p>}
                        </div>
                        {isOpen ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-40" />}
                      </div>
                    </div>
                  </CardHeader>
                </button>

                {isOpen && (
                  <CardContent className="pt-0 pb-4 px-4">
                    {ancestor.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No matched historical events for this ancestor's recorded lifespan.</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Mini life summary */}
                        <div className="bg-muted/30 rounded p-2.5 mb-3 flex gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{lifespan}</span>
                          </div>
                          {(ancestor.birthPlace || ancestor.locationAddress) && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>{ancestor.birthPlace ?? ancestor.locationAddress}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Star className="w-3 h-3" />
                            <span>
                              {sortedEvts.filter(e => e.relationshipType === "alive_during").length} lived through ·{" "}
                              {sortedEvts.filter(e => e.severityLevel === "critical").length} critical
                            </span>
                          </div>
                        </div>
                        {/* Events sorted chronologically */}
                        {sortedEvts.map(ev => (
                          <HistEventCard key={ev.eventId} ev={ev} lifeStart={ancestor.birthYear} />
                        ))}
                      </div>
                    )}
                    <div className="mt-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300/30 rounded p-2.5">
                      <div className="flex gap-2">
                        <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-amber-700 dark:text-amber-400/80 leading-relaxed">
                          These connections are derived from recorded dates, tribal nation, and affected regions. They are potentially relevant — not confirmed facts. Each connection requires source review.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KnowledgeOfSelfTab({ kosData, lineageData, isLoading, onLink }: { kosData?: KnowledgeOfSelf; lineageData?: LineageData; isLoading: boolean; onLink: () => void }) {
  const [selectedLineageId, setSelectedLineageId] = useState<number | "">("");
  const [kosTab, setKosTab] = useState<"profile" | "learn" | "who-you-are">("who-you-are");

  const linkMutation = useMutation({
    mutationFn: async (lineageId: number) => {
      const r = await fetch(`/api/family-tree/${lineageId}/link-identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
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
      {/* Sub-tab switcher */}
      <div className="flex gap-2 border-b pb-2 flex-wrap">
        <button
          onClick={() => setKosTab("who-you-are")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors flex items-center gap-1.5 ${kosTab === "who-you-are" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Scroll className="w-3.5 h-3.5" /> Who You Are
        </button>
        <button
          onClick={() => setKosTab("profile")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${kosTab === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          My Identity Profile
        </button>
        <button
          onClick={() => setKosTab("learn")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${kosTab === "learn" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Learn & Resources
        </button>
      </div>

      {kosTab === "who-you-are" && (
        <WhoYouAreTab ancestorContext={kosData?.ancestorContext ?? []} />
      )}

      {kosTab === "profile" && (
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
            <Card className="border-dashed">
              <CardContent className="py-10 text-center space-y-2">
                <p className="font-medium text-sm">No identity links yet</p>
                <p className="text-muted-foreground text-sm">Import lineage data via CSV or document, then link ancestors to your identity profile here. Switch to the <strong>Learn & Resources</strong> tab for guidance on gathering genealogical documentation.</p>
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
      )}

      {kosTab === "learn" && (
        <div className="space-y-6">
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700">
            <CardContent className="py-4">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Knowledge of Self — The Foundation of Sovereignty</p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Urban Indian people — those living off-reservation in cities — retain full tribal citizenship and sovereign rights. Knowing your lineage, your rights under federal Indian law, and how to document ancestry is the first act of reclaiming sovereignty. These resources are curated for Mathias El Tribe members navigating identity, ancestry, ICWA, and tribal rights outside the reservation context.
              </p>
            </CardContent>
          </Card>

          {KOS_RESOURCES.map((section) => (
            <div key={section.category}>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">{section.category}</p>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <Card key={item.title} className={`border-l-4 ${section.color}`}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-xs text-primary underline underline-offset-2 hover:no-underline"
                        >
                          Open →
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          <Card className="border-dashed">
            <CardContent className="py-4">
              <p className="text-sm font-semibold mb-1">Next Step: Build Your Lineage</p>
              <p className="text-sm text-muted-foreground">Use the <strong>Edit Ancestors</strong> tab to enter family members, then return to <strong>My Identity Profile</strong> here to link them to your sovereign identity record. Each linked ancestor strengthens your documentation for ICWA, trust, and welfare claims.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface ImportedPerson {
  fullName: string;
  birthYear?: number;
  deathYear?: number;
  gender?: string;
  parentNames?: string[];
  spouseNames?: string[];
  notes?: string;
}

interface ImportDocumentResult {
  sourceType: string;
  extractionMethod: string;
  filename: string;
  total: number;
  created: number;
  merged: number;
  skipped: number;
  errors: string[];
  people: ImportedPerson[];
  graph: {
    totalGenerations: number;
    tribalNations: string[];
    familyGroups: string[];
    lineageTags: string[];
    icwaEligible: boolean;
    welfareEligible: boolean;
  };
}

function ImportDocumentTab({ onSuccess }: { onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportDocumentResult | null>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/lineage/import-document", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: form,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Upload failed" })) as { error?: string; hint?: string };
        throw new Error(err.hint ? `${err.error} — ${err.hint}` : (err.error ?? "Upload failed"));
      }
      return r.json() as Promise<ImportDocumentResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      onSuccess();
      toast({
        title: `Import complete — ${data.created} new, ${data.merged} merged`,
        description: `${data.total} people extracted from ${data.filename}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResult(null);
    e.target.value = "";
  }

  const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.csv,.ged,.gedcom,.txt";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Family Tree from Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md bg-muted/40 border p-4 text-sm space-y-1">
            <p className="font-semibold text-foreground">Supported formats</p>
            <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
              <li><strong>PDF</strong> — Ancestry.com exports, FamilySearch prints, scanned genealogy reports</li>
              <li><strong>Images</strong> (JPG, PNG, WEBP) — photos or scans of handwritten trees, charts, certificates</li>
              <li><strong>GEDCOM</strong> (.ged) — standard genealogical file export from any family tree software</li>
              <li><strong>CSV</strong> — spreadsheet with columns: name, birth_year, death_year, parent_names, spouse_names</li>
              <li><strong>TXT</strong> — plain-text notes, family histories, or any document listing family members</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">
              AI extraction reads names, birth/death dates, and family relationships automatically. GEDCOM and structured CSV files use a direct parser (no AI required).
            </p>
          </div>

          <div
            className="border-2 border-dashed border-muted rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB · {selectedFile.type || "unknown type"}</p>
                <p className="text-xs text-primary">Click to change file</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Click to select a file, or drag and drop</p>
                <p className="text-xs text-muted-foreground">PDF · JPG · PNG · GEDCOM · CSV · TXT · up to 25 MB</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => { if (selectedFile) importMutation.mutate(selectedFile); }}
            disabled={!selectedFile || importMutation.isPending}
          >
            {importMutation.isPending
              ? "Extracting & Importing…"
              : selectedFile
              ? `Extract & Import "${selectedFile.name}"`
              : "Select a file above"}
          </Button>

          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse w-3/4" />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                AI is reading your document and identifying family members…
              </p>
            </div>
          )}

          {importMutation.isError && (
            <p className="text-sm text-destructive">{(importMutation.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card className="border-green-300 bg-green-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-800">Import Successful</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-green-100 p-3">
                  <p className="text-2xl font-bold text-green-800">{result.created}</p>
                  <p className="text-xs text-green-700 font-medium">New Records</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3">
                  <p className="text-2xl font-bold text-blue-800">{result.merged}</p>
                  <p className="text-xs text-blue-700 font-medium">Merged / Updated</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground font-medium">Skipped</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">{result.sourceType.toUpperCase()}</Badge>
                <Badge variant="outline" className="text-xs">Extracted via {result.extractionMethod === "ai" ? "AI" : "Parser"}</Badge>
                {result.graph.icwaEligible && <Badge className="bg-blue-700 text-white text-xs">ICWA Eligible</Badge>}
                {result.graph.welfareEligible && <Badge className="bg-green-700 text-white text-xs">Welfare Eligible</Badge>}
                {result.graph.totalGenerations > 0 && <Badge variant="outline" className="text-xs">{result.graph.totalGenerations} Generation{result.graph.totalGenerations !== 1 ? "s" : ""}</Badge>}
              </div>
              {result.graph.familyGroups.length > 0 && (
                <p className="text-xs text-muted-foreground">Family groups: {result.graph.familyGroups.join(", ")}</p>
              )}
              {result.errors.length > 0 && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Skipped records ({result.errors.length})</p>
                  {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
                </div>
              )}
            </CardContent>
          </Card>

          {result.people.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Extracted People ({result.people.length}{result.total > result.people.length ? ` of ${result.total}` : ""})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.people.map((person, i) => (
                  <div key={i} className="rounded-lg border bg-card p-3 space-y-1">
                    <p className="text-sm font-semibold leading-tight">{person.fullName}</p>
                    <div className="flex flex-wrap gap-1">
                      {person.birthYear && <span className="text-xs text-muted-foreground">b. {person.birthYear}</span>}
                      {person.birthYear && person.deathYear && <span className="text-xs text-muted-foreground">–</span>}
                      {person.deathYear && <span className="text-xs text-muted-foreground">d. {person.deathYear}</span>}
                      {person.gender && <Badge variant="outline" className="text-xs py-0">{person.gender}</Badge>}
                    </div>
                    {person.parentNames && person.parentNames.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        Parents: {person.parentNames.join(", ")}
                      </p>
                    )}
                    {person.spouseNames && person.spouseNames.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        Spouse: {person.spouseNames.join(", ")}
                      </p>
                    )}
                    {person.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{person.notes}</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Switch to the <strong>Visual Tree</strong> tab to see all imported members in the interactive family tree.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Deduplicate Tab ──────────────────────────────────────────────────────────

interface DupRow {
  id: number;
  fullName: string;
  birthYear: number | null;
  deathYear: number | null;
  sourceType: string;
  createdAt: string;
}

interface ExactGroup {
  ids: number[];
  name: string;
  birthYear: number | null;
  rows: DupRow[];
}

interface FuzzyGroup {
  ids: number[];
  name: string;
  reason: string;
  rows: DupRow[];
}

interface DupScanResult {
  total: number;
  exact: ExactGroup[];
  fuzzy: FuzzyGroup[];
}

function DeduplicateTab({ onResolved }: { onResolved: () => void }) {
  const { toast } = useToast();
  const isTrustee = useIsTrustee();

  const { data, isLoading, refetch } = useQuery<DupScanResult>({
    queryKey: ["lineage-duplicates"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/duplicates", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (!r.ok) throw new Error("Failed to scan duplicates");
      return r.json();
    },
  });

  const autoRemoveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/lineage/duplicates/auto-remove", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ merged: number; removed: number }>;
    },
    onSuccess: (result) => {
      toast({ title: "Auto-remove complete", description: `${result.removed} exact duplicate${result.removed !== 1 ? "s" : ""} removed across ${result.merged} group${result.merged !== 1 ? "s" : ""}.` });
      refetch();
      onResolved();
    },
    onError: (err: Error) => toast({ title: "Auto-remove failed", description: err.message, variant: "destructive" }),
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ keepId, removeId }: { keepId: number; removeId: number }) => {
      const r = await fetch("/api/lineage/duplicates/merge", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, removeId }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: "Records merged", description: `Record #${vars.removeId} merged into #${vars.keepId}.` });
      refetch();
      onResolved();
    },
    onError: (err: Error) => toast({ title: "Merge failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/lineage/duplicates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (_, id) => {
      toast({ title: "Record deleted", description: `Record #${id} removed.` });
      refetch();
      onResolved();
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const busy = autoRemoveMutation.isPending || mergeMutation.isPending || deleteMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  const exactCount = data?.exact.length ?? 0;
  const fuzzyCount = data?.fuzzy.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Duplicate Ancestor Detection</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scanned <strong>{data?.total ?? 0}</strong> records —{" "}
            <span className={exactCount > 0 ? "text-destructive font-medium" : ""}>{exactCount} exact duplicate group{exactCount !== 1 ? "s" : ""}</span>
            {" "}and{" "}
            <span className={fuzzyCount > 0 ? "text-amber-600 font-medium" : ""}>{fuzzyCount} suggested review{fuzzyCount !== 1 ? "s" : ""}</span>.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={busy}>Rescan</Button>
          {isTrustee && exactCount > 0 && (
            <Button variant="destructive" size="sm" onClick={() => autoRemoveMutation.mutate()} disabled={busy}>
              {autoRemoveMutation.isPending ? "Removing…" : `Auto-Remove All ${exactCount} Exact Group${exactCount !== 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
      </div>

      {exactCount === 0 && fuzzyCount === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p className="text-2xl mb-2">✓</p>
            <p className="font-medium">No duplicates found.</p>
            <p className="text-sm mt-1">All {data?.total ?? 0} ancestor records appear unique.</p>
          </CardContent>
        </Card>
      )}

      {exactCount > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-destructive flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
            Exact Duplicates — same name &amp; birth year (auto-removable)
          </h3>
          {data!.exact.map((group, gi) => (
            <Card key={gi} className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Badge variant="destructive">{group.rows.length} copies</Badge>
                  {group.name}
                  {group.birthYear && <span className="text-muted-foreground font-normal">b. {group.birthYear}</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {group.rows.map((row, ri) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <div className="space-y-0.5">
                      <p className="font-medium">#{row.id} — {row.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.birthYear ? `b. ${row.birthYear}` : "birth year unknown"}
                        {row.deathYear ? ` · d. ${row.deathYear}` : ""}
                        {" · "}source: {row.sourceType}
                        {" · "}added {new Date(row.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isTrustee && ri > 0 ? (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy}
                          onClick={() => mergeMutation.mutate({ keepId: group.rows[0].id, removeId: row.id })}>
                          Merge into #{group.rows[0].id}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" disabled={busy}
                          onClick={() => deleteMutation.mutate(row.id)}>
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs shrink-0">Keep (best record)</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {fuzzyCount > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-amber-700 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            Suggested Reviews — possible duplicates requiring manual decision
          </h3>
          {data!.fuzzy.map((group, gi) => (
            <Card key={gi} className="border-amber-200 bg-amber-50/40">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="border-amber-400 text-amber-700">{group.rows.length} records</Badge>
                  {group.name}
                </CardTitle>
                <p className="text-xs text-amber-700 mt-1">{group.reason}</p>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {group.rows.map((row, ri) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <div className="space-y-0.5">
                      <p className="font-medium">#{row.id} — {row.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.birthYear ? `b. ${row.birthYear}` : "birth year unknown"}
                        {row.deathYear ? ` · d. ${row.deathYear}` : ""}
                        {" · "}source: {row.sourceType}
                        {" · "}added {new Date(row.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isTrustee && ri > 0 ? (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy}
                          onClick={() => mergeMutation.mutate({ keepId: group.rows[0].id, removeId: row.id })}>
                          Merge into #{group.rows[0].id}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" disabled={busy}
                          onClick={() => deleteMutation.mutate(row.id)}>
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs shrink-0">Primary</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
