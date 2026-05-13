import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  welfare_actions: "Act on welfare matters on your behalf",
  trust_filings: "File and review trust instruments",
  family_governance: "Family governance decisions",
  lineage_review: "Review and correct lineage records",
  elder_advisory: "Participate in Elder Advisory Council",
  court_review: "Review court documents and NFRs",
  full_authority: "All authorities (Chief Justice / Admin only)",
};

interface DelegationScope {
  scope: string;
  label: string;
}

interface DelegationUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Delegation {
  id: number;
  delegatorId: number;
  delegateeId: number;
  scopes: string[];
  scopeLabels: string[];
  reason: string | null;
  note: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  isActive: boolean;
  delegator: DelegationUser | null;
  delegatee: DelegationUser | null;
  direction: "granted" | "received";
}

interface DelegationsData {
  granted: Delegation[];
  received: Delegation[];
  validScopes: DelegationScope[];
}

function DelegationCard({ d, onRevoke, isRevoking }: { d: Delegation; onRevoke?: (id: number) => void; isRevoking?: boolean }) {
  const expired = d.expiresAt && new Date(d.expiresAt) <= new Date();
  const status = d.revokedAt ? "revoked" : expired ? "expired" : "active";

  return (
    <div className={`rounded-lg border px-4 py-3 ${d.isActive ? "bg-background" : "bg-muted/30 opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {d.direction === "granted" ? (
              <span className="text-xs font-medium text-muted-foreground">To:</span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">From:</span>
            )}
            <span className="text-sm font-semibold">
              {d.direction === "granted" ? (d.delegatee?.name ?? d.delegatee?.email ?? "Unknown") : (d.delegator?.name ?? d.delegator?.email ?? "Unknown")}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] capitalize ${
                status === "active" ? "bg-green-50 text-green-700 border-green-200" :
                status === "revoked" ? "bg-red-50 text-red-700 border-red-200" :
                "bg-gray-50 text-gray-500 border-gray-200"
              }`}
            >
              {status}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
            {d.scopeLabels.map((label) => (
              <Badge key={label} variant="secondary" className="text-[11px]">{label}</Badge>
            ))}
          </div>

          <div className="space-y-0.5 text-xs text-muted-foreground">
            {d.reason && <p><span className="font-medium">Reason:</span> {d.reason}</p>}
            {d.note && <p><span className="font-medium">Note:</span> {d.note}</p>}
            {d.expiresAt && (
              <p>
                <span className="font-medium">Expires:</span>{" "}
                {new Date(d.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            )}
            {d.revokedAt && d.revokedReason && <p><span className="font-medium">Revoked:</span> {d.revokedReason}</p>}
            <p>Granted {new Date(d.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
          </div>
        </div>

        {d.direction === "granted" && d.isActive && onRevoke && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-red-200 text-red-700 hover:bg-red-50 text-xs"
            onClick={() => onRevoke(d.id)}
            disabled={isRevoking}
          >
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

export function DelegationPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [delegateeEmail, setDelegateeEmail] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<DelegationsData>({
    queryKey: ["delegations"],
    queryFn: async () => {
      const r = await fetch("/api/delegations", { headers: { Authorization: `Bearer ${getCurrentBearerToken()}` } });
      if (!r.ok) throw new Error("Failed to load delegations");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/delegations", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ delegateeEmail, scopes: selectedScopes, reason: reason || undefined, note: note || undefined, expiresAt: expiresAt || undefined }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create delegation");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Delegation granted", description: `Authority delegated to ${delegateeEmail}.` });
      qc.invalidateQueries({ queryKey: ["delegations"] });
      setOpen(false);
      setDelegateeEmail(""); setSelectedScopes([]); setReason(""); setNote(""); setExpiresAt("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/delegations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to revoke");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Delegation revoked" });
      qc.invalidateQueries({ queryKey: ["delegations"] });
      setRevokingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
      setRevokingId(null);
    },
  });

  const handleRevoke = (id: number) => {
    setRevokingId(id);
    revokeMutation.mutate(id);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const validScopes = data?.validScopes ?? [];
  const granted = data?.granted ?? [];
  const received = data?.received ?? [];
  const activeGranted = granted.filter((d) => d.isActive);
  const pastGranted = granted.filter((d) => !d.isActive);
  const activeReceived = received.filter((d) => d.isActive);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm uppercase tracking-widest">Delegation of Authority</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Grant specific authorities to other officers, elders, or chiefs. Delegations are recorded and auditable.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Grant Delegation</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Grant Delegation of Authority</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div>
                  <Label>Delegate to (email address)</Label>
                  <Input
                    className="mt-1"
                    type="email"
                    placeholder="officer@mathiasel.tribe"
                    value={delegateeEmail}
                    onChange={(e) => setDelegateeEmail(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Authorities to Delegate</Label>
                  <div className="space-y-2">
                    {validScopes.map(({ scope, label }) => (
                      <label key={scope} className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="mt-0.5 w-4 h-4 shrink-0"
                          checked={selectedScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                        />
                        <div>
                          <span className="text-sm font-medium">{label}</span>
                          <p className="text-xs text-muted-foreground">{SCOPE_DESCRIPTIONS[scope]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Reason <span className="text-muted-foreground text-xs">(required for record)</span></Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. Travel absence, medical leave, succession"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Internal Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    placeholder="Any additional context for the record"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Expiry Date <span className="text-muted-foreground text-xs">(leave blank for indefinite)</span></Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || !delegateeEmail || selectedScopes.length === 0}
                  >
                    {createMutation.isPending ? "Granting…" : "Grant Delegation"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <>
            {activeReceived.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Authority Delegated to You
                </p>
                <div className="space-y-2">
                  {activeReceived.map((d) => (
                    <DelegationCard key={d.id} d={d} />
                  ))}
                </div>
              </div>
            )}

            {activeGranted.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Active Delegations You Granted
                </p>
                <div className="space-y-2">
                  {activeGranted.map((d) => (
                    <DelegationCard
                      key={d.id}
                      d={d}
                      onRevoke={handleRevoke}
                      isRevoking={revokingId === d.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeGranted.length === 0 && activeReceived.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active delegations. Use "Grant Delegation" to delegate specific authorities to another officer or elder.
              </p>
            )}

            {pastGranted.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Past Delegations
                </p>
                <div className="space-y-2">
                  {pastGranted.slice(0, 5).map((d) => (
                    <DelegationCard key={d.id} d={d} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
