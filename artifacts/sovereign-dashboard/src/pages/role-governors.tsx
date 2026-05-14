import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { canManageGovernors } from "@/lib/governor-access";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Redirect } from "wouter";

interface RoleGovernor {
  id: number;
  roleKey: string;
  displayName: string;
  postureStatement: string;
  jurisdictionalScope: string;
  toneDirectives: string;
  authorityCitation: string;
  signatureBlockTemplate: string;
  documentHeaderTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ActivationLogEntry {
  id: number;
  governorId: number;
  roleKey: string;
  documentId: number | null;
  documentType: string | null;
  actingUserId: number | null;
  actingUserEmail: string | null;
  activatedAt: string;
  createdAt: string;
}

function getApiBase(): string {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  return base.replace(/\/sovereign-dashboard$/, "");
}

function getAuthHeaders(sessionToken: string | null): Record<string, string> {
  if (!sessionToken) return {};
  return { Authorization: `Bearer ${sessionToken}` };
}

const ROLE_KEY_COLORS: Record<string, string> = {
  chief_justice: "bg-amber-100 text-amber-800 border-amber-300",
  trustee: "bg-blue-100 text-blue-800 border-blue-300",
  officer: "bg-green-100 text-green-800 border-green-300",
  elder: "bg-purple-100 text-purple-800 border-purple-300",
  member: "bg-slate-100 text-slate-800 border-slate-300",
  guest: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

interface EditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  governor: RoleGovernor;
  sessionToken: string | null;
}

function EditDrawer({ open, onOpenChange, governor, sessionToken }: EditDrawerProps) {
  const [form, setForm] = useState({
    displayName: governor.displayName,
    postureStatement: governor.postureStatement,
    jurisdictionalScope: governor.jurisdictionalScope,
    toneDirectives: governor.toneDirectives,
    authorityCitation: governor.authorityCitation,
    signatureBlockTemplate: governor.signatureBlockTemplate,
    documentHeaderTemplate: governor.documentHeaderTemplate,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`${getApiBase()}/api/governors/${governor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(sessionToken) },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to update governor");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Governor updated", description: `${form.displayName} definition saved.` });
      void queryClient.invalidateQueries({ queryKey: ["governors"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Update failed", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Governor — {governor.displayName}</DialogTitle>
          <DialogDescription>
            Modify the sovereign posture, jurisdictional scope, tone directives, authority citation, and document templates for this role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="postureStatement">Posture Statement</Label>
            <Textarea
              id="postureStatement"
              value={form.postureStatement}
              onChange={(e) => setForm((f) => ({ ...f, postureStatement: e.target.value }))}
              rows={4}
              className="mt-1 font-mono text-sm"
            />
          </div>

          <div>
            <Label htmlFor="jurisdictionalScope">Jurisdictional Scope</Label>
            <Textarea
              id="jurisdictionalScope"
              value={form.jurisdictionalScope}
              onChange={(e) => setForm((f) => ({ ...f, jurisdictionalScope: e.target.value }))}
              rows={3}
              className="mt-1 font-mono text-sm"
            />
          </div>

          <div>
            <Label htmlFor="toneDirectives">Tone Directives</Label>
            <Textarea
              id="toneDirectives"
              value={form.toneDirectives}
              onChange={(e) => setForm((f) => ({ ...f, toneDirectives: e.target.value }))}
              rows={3}
              className="mt-1 font-mono text-sm"
            />
          </div>

          <div>
            <Label htmlFor="authorityCitation">Authority Citation</Label>
            <Textarea
              id="authorityCitation"
              value={form.authorityCitation}
              onChange={(e) => setForm((f) => ({ ...f, authorityCitation: e.target.value }))}
              rows={3}
              className="mt-1 font-mono text-sm"
            />
          </div>

          <div>
            <Label htmlFor="documentHeaderTemplate">Document Header Template</Label>
            <Textarea
              id="documentHeaderTemplate"
              value={form.documentHeaderTemplate}
              onChange={(e) => setForm((f) => ({ ...f, documentHeaderTemplate: e.target.value }))}
              rows={3}
              className="mt-1 font-mono text-sm"
            />
          </div>

          <div>
            <Label htmlFor="signatureBlockTemplate">Signature Block Template</Label>
            <Textarea
              id="signatureBlockTemplate"
              value={form.signatureBlockTemplate}
              onChange={(e) => setForm((f) => ({ ...f, signatureBlockTemplate: e.target.value }))}
              rows={4}
              className="mt-1 font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ActivateConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  governor: RoleGovernor;
  onConfirm: () => void;
  isPending: boolean;
}

function ActivateConfirmModal({ open, onOpenChange, governor, onConfirm, isPending }: ActivateConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Activate Governor — {governor.displayName}</DialogTitle>
          <DialogDescription>
            This will set the <strong>{governor.displayName}</strong> as the active role governor for all subsequent document generation. Confirm the posture below before activating.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Posture</p>
            <p className="text-sm">{governor.postureStatement}</p>
          </div>
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Authority Citation</p>
            <p className="text-sm font-mono">{governor.authorityCitation}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Activating…" : "Confirm & Activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface GovernorCardProps {
  governor: RoleGovernor;
  sessionToken: string | null;
  onActivated: () => void;
}

function GovernorCard({ governor, sessionToken, onActivated }: GovernorCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const { toast } = useToast();

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getApiBase()}/api/governors/${governor.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(sessionToken) },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to activate governor");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Governor activated", description: `${governor.displayName} is now the active sovereign posture.` });
      setActivateOpen(false);
      onActivated();
    },
    onError: (err: unknown) => {
      toast({ title: "Activation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    },
  });

  const colorClass = ROLE_KEY_COLORS[governor.roleKey] ?? "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <>
      <Card className={`relative border-2 transition-shadow ${governor.isActive ? "border-primary shadow-md shadow-primary/10" : "border-border"}`}>
        {governor.isActive && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border border-green-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Active
            </span>
          </div>
        )}

        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${colorClass}`}>
              {governor.roleKey.replace(/_/g, " ")}
            </span>
          </div>
          <CardTitle className="text-base mt-2">{governor.displayName}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-3">{governor.postureStatement}</p>

          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Authority Citation</p>
            <p className="text-xs font-mono leading-relaxed line-clamp-2">{governor.authorityCitation}</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            {!governor.isActive && (
              <Button size="sm" className="flex-1" onClick={() => setActivateOpen(true)}>
                Activate
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <EditDrawer open={editOpen} onOpenChange={setEditOpen} governor={governor} sessionToken={sessionToken} />
      <ActivateConfirmModal
        open={activateOpen}
        onOpenChange={setActivateOpen}
        governor={governor}
        onConfirm={() => activateMutation.mutate()}
        isPending={activateMutation.isPending}
      />
    </>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function RoleGovernorsPage() {
  const { activeRole, sessionToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!canManageGovernors(activeRole)) {
    return <Redirect to="/hub" />;
  }

  const { data: governorsData, isLoading: governorsLoading, error: governorsError } = useQuery({
    queryKey: ["governors"],
    queryFn: async () => {
      const res = await fetch(`${getApiBase()}/api/governors`, {
        headers: getAuthHeaders(sessionToken),
      });
      if (!res.ok) throw new Error("Failed to load governors");
      return res.json() as Promise<{ governors: RoleGovernor[] }>;
    },
  });

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ["governors-log"],
    queryFn: async () => {
      const res = await fetch(`${getApiBase()}/api/governors/log`, {
        headers: getAuthHeaders(sessionToken),
      });
      if (!res.ok) throw new Error("Failed to load activation log");
      return res.json() as Promise<{ log: ActivationLogEntry[] }>;
    },
  });

  const activeGovernor = governorsData?.governors.find((g) => g.isActive);

  const handleActivated = () => {
    void queryClient.invalidateQueries({ queryKey: ["governors"] });
    void queryClient.invalidateQueries({ queryKey: ["governors-log"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-primary">Role Governor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the sovereign posture, tone, jurisdiction, and authority citation for each legal character. The active governor is automatically injected into every document generation session.
        </p>
      </div>

      {activeGovernor && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-primary">Active Governor: {activeGovernor.displayName}</p>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{activeGovernor.authorityCitation}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="governors">
        <TabsList>
          <TabsTrigger value="governors">Role Governors</TabsTrigger>
          <TabsTrigger value="log">Activation Log</TabsTrigger>
        </TabsList>

        <TabsContent value="governors" className="mt-4">
          {governorsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6 space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : governorsError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load role governors. Ensure the API server is running and your session has Chief Justice or Sovereign Admin access.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {governorsData?.governors.map((governor) => (
                <GovernorCard
                  key={governor.id}
                  governor={governor}
                  sessionToken={sessionToken}
                  onActivated={handleActivated}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          {logLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !logData?.log.length ? (
            <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No activation events recorded yet. Activating a governor or generating a document will create entries here.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Governor</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Document Type</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acting User</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logData.log.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${ROLE_KEY_COLORS[entry.roleKey] ?? "bg-slate-100 text-slate-700"}`}>
                          {entry.roleKey.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{entry.documentType ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{entry.actingUserEmail ?? (entry.actingUserId ? `User #${entry.actingUserId}` : "—")}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
