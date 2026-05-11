import { useState } from "react";
import { useListTasks, useCreateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

function makeDevToken(user: unknown) { return btoa(JSON.stringify(user)); }

function statusVariant(status: string) {
  switch (status) {
    case "pending": return "secondary";
    case "in_progress": return "default";
    case "completed": return "outline";
    case "overdue": return "destructive";
    default: return "outline";
  }
}

function isOverdue(dueDate?: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

interface ActiveDelegation {
  id: number;
  scopes: string[];
  scopeLabels: string[];
  expiresAt: string | null;
  delegator: { name: string; email: string; role: string } | null;
}

export default function TasksPage() {
  const { data: tasks, isLoading } = useListTasks();
  const createTask = useCreateTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, sessionToken } = useAuth();
  const token = sessionToken ?? makeDevToken(user);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "" });

  const { data: delegData } = useQuery<{ received: ActiveDelegation[] }>({
    queryKey: ["delegations-tasks"],
    queryFn: async () => {
      const r = await fetch("/api/delegations", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { received: [] };
      const d = await r.json();
      return { received: (d.received ?? []).filter((x: ActiveDelegation & { isActive: boolean }) => x.isActive) };
    },
    retry: false,
  });

  const activeDelegations = delegData?.received ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTask.mutate(
      { data: { title: form.title, description: form.description, dueDate: form.dueDate || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Task created" });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          setOpen(false);
          setForm({ title: "", description: "", dueDate: "" });
        },
        onError: () => toast({ title: "Error", description: "Failed to create task.", variant: "destructive" }),
      }
    );
  };

  const pending = (tasks ?? []).filter((t) => t.status === "pending");
  const inProgress = (tasks ?? []).filter((t) => t.status === "in_progress");
  const completed = (tasks ?? []).filter((t) => t.status === "completed");

  return (
    <div data-testid="page-tasks">
      {/* Active delegation banner */}
      {activeDelegations.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50/60">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm uppercase tracking-widest text-amber-800">
              Acting Under Delegated Authority
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {activeDelegations.map((d) => (
              <div key={d.id} className="flex items-start gap-3">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    {d.delegator?.name ?? d.delegator?.email ?? "Unknown"}{" "}
                    <span className="font-normal text-amber-700">delegated:</span>{" "}
                    {d.scopeLabels.join(", ")}
                  </p>
                  {d.expiresAt && (
                    <p className="text-xs text-amber-600">
                      Expires {new Date(d.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-amber-700 mt-1">
              All actions taken under delegated authority are recorded and attributed to you.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">{pending.length} pending · {inProgress.length} in progress · {completed.length} completed</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-task">New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label>Title</Label>
                <Input data-testid="input-task-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea data-testid="input-task-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" data-testid="input-task-due-date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-task" disabled={createTask.isPending}>Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (tasks ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(tasks ?? []).map((t) => {
            const overdue = isOverdue(t.dueDate) && t.status !== "completed";
            return (
              <Card key={t.id} data-testid={`task-card-${t.id}`} className={overdue ? "border-destructive" : ""}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{t.description}</p>}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {t.dueDate && (
                        <span className={overdue ? "text-destructive font-medium" : ""}>
                          Due: {new Date(t.dueDate).toLocaleDateString()}
                          {overdue && " (OVERDUE)"}
                        </span>
                      )}
                      {t.complaintId && <span>· Complaint #{t.complaintId}</span>}
                    </div>
                  </div>
                  <Badge variant={statusVariant(overdue ? "overdue" : t.status) as any} className="ml-4 shrink-0">
                    {overdue ? "overdue" : t.status}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
