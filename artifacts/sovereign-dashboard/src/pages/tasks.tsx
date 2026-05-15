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
import { getCurrentBearerToken } from "@/components/auth-provider";
import { CheckCircle2, Clock, Circle, AlertCircle } from "lucide-react";

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

function statusIcon(status: string) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "in_progress") return <Clock className="h-4 w-4 text-blue-500" />;
  if (status === "overdue") return <AlertCircle className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

export default function TasksPage() {
  const { data: tasks, isLoading } = useListTasks();
  const createTask = useCreateTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "" });
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data: delegData } = useQuery<{ received: ActiveDelegation[] }>({
    queryKey: ["delegations-tasks"],
    queryFn: async () => {
      const r = await fetch("/api/delegations", { headers: { Authorization: `Bearer ${getCurrentBearerToken()}` } });
      if (!r.ok) return { received: [] };
      const d = await r.json();
      return { received: (d.received ?? []).filter((x: ActiveDelegation & { isActive: boolean }) => x.isActive) };
    },
    retry: false,
  });

  const activeDelegations = delegData?.received ?? [];

  const updateTaskStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({ title: status === "completed" ? "Task completed" : status === "in_progress" ? "Task started" : "Task updated" });
    } catch {
      toast({ title: "Error", description: "Could not update task.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

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

  const allTasks = tasks ?? [];
  const pending = allTasks.filter((t) => t.status === "pending" && !isOverdue(t.dueDate));
  const inProgress = allTasks.filter((t) => t.status === "in_progress" && !isOverdue(t.dueDate));
  const overdue = allTasks.filter((t) => isOverdue(t.dueDate) && t.status !== "completed");
  const completed = allTasks.filter((t) => t.status === "completed");

  function TaskCard({ t }: { t: typeof allTasks[0] }) {
    const od = isOverdue(t.dueDate) && t.status !== "completed";
    const busy = updatingId === t.id;
    return (
      <Card key={t.id} data-testid={`task-card-${t.id}`} className={od ? "border-destructive" : t.status === "completed" ? "opacity-60" : ""}>
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{statusIcon(od ? "overdue" : t.status)}</div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
              {t.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{t.description}</p>}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                {t.dueDate && (
                  <span className={od ? "text-destructive font-semibold" : ""}>
                    Due: {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {od && " — OVERDUE"}
                  </span>
                )}
                {t.complaintId && <span>· Complaint #{t.complaintId}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {t.status === "pending" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => updateTaskStatus(t.id, "in_progress")}>
                  Start
                </Button>
              )}
              {(t.status === "pending" || t.status === "in_progress" || od) && (
                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" disabled={busy} onClick={() => updateTaskStatus(t.id, "completed")}>
                  Complete
                </Button>
              )}
              {t.status === "completed" && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={busy} onClick={() => updateTaskStatus(t.id, "pending")}>
                  Reopen
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function Section({ title, count, items, emptyText, accent }: {
    title: string; count: number; items: typeof allTasks; emptyText?: string; accent?: string;
  }) {
    if (items.length === 0 && !emptyText) return null;
    return (
      <div>
        <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${accent ?? ""}`}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {items.map((t) => <TaskCard key={t.id} t={t} />)}
          </div>
        )}
      </div>
    );
  }

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
          <p className="text-muted-foreground mt-1">
            {overdue.length > 0 && <span className="text-destructive font-medium">{overdue.length} overdue · </span>}
            {pending.length} pending · {inProgress.length} in progress · {completed.length} completed
          </p>
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
                <Input data-testid="input-task-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="What needs to be done?" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea data-testid="input-task-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Optional details…" />
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
      ) : allTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-3">No tasks yet.</p>
            <Button size="sm" onClick={() => setOpen(true)}>Create your first task</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <Section title="Overdue" count={overdue.length} items={overdue} accent="border-destructive/50" />
          )}
          <Section title="In Progress" count={inProgress.length} items={inProgress} />
          <Section title="Pending" count={pending.length} items={pending} emptyText="No pending tasks." />
          <Section title="Completed" count={completed.length} items={completed} />
        </div>
      )}
    </div>
  );
}
