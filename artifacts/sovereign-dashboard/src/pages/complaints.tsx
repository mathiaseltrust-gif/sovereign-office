import { useState } from "react";
import { useListComplaints, useGetComplaint, getGetComplaintQueryKey, useCreateComplaint, getListComplaintsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function statusVariant(status: string) {
  return status === "open" ? "destructive" : status === "closed" ? "secondary" : "outline";
}

export function ComplaintsListPage() {
  const { data: complaints, isLoading } = useListComplaints();
  const createComplaint = useCreateComplaint();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    createComplaint.mutate({ data: { text } }, {
      onSuccess: () => {
        toast({ title: "Complaint submitted", description: "Auto-classified and task created." });
        queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        setOpen(false);
        setText("");
      },
      onError: () => toast({ title: "Error", description: "Failed to submit.", variant: "destructive" }),
    });
  };

  return (
    <div data-testid="page-complaints">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Complaints</h1>
          <p className="text-muted-foreground mt-1">Citizen complaints — auto-classified and tasked</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-complaint">Submit Complaint</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Submit Complaint</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label>Complaint Text</Label>
                <Textarea
                  data-testid="input-complaint-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Describe the complaint in detail…"
                  className="mt-1"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-complaint" disabled={createComplaint.isPending}>
                  {createComplaint.isPending ? "Submitting…" : "Submit"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (complaints ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No complaints filed.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(complaints ?? []).map((c) => (
            <Card key={c.id} data-testid={`complaint-card-${c.id}`} className="hover:border-primary transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/complaints/${c.id}`}>
                    <p className="text-sm font-medium cursor-pointer hover:text-primary truncate max-w-2xl">{c.text?.substring(0, 120)}</p>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                    {c.classification && (
                      <>
                        <span>{(c.classification as any).actorType}</span>
                        <span>·</span>
                        <span>{(c.classification as any).landStatus}</span>
                        <span>·</span>
                        <span>{(c.classification as any).actionType}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge variant={statusVariant(c.status) as any} className="ml-4 shrink-0">{c.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface ClassificationData {
  actorType: string;
  landStatus: string;
  actionType: string;
}

export function ComplaintDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { data: complaint, isLoading, refetch } = useGetComplaint(id, { query: { enabled: !!id, queryKey: getGetComplaintQueryKey(id) } });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [officerId, setOfficerId] = useState("");
  const [updating, setUpdating] = useState(false);

  if (isLoading) return <div data-testid="page-complaint-detail"><Skeleton className="h-48" /></div>;
  if (!complaint) return <div data-testid="page-complaint-detail" className="text-muted-foreground">Complaint not found.</div>;

  const cls = complaint.classification as ClassificationData | null;

  async function updateComplaint(patch: { status?: string; officerId?: number }) {
    setUpdating(true);
    const token = user ? btoa(JSON.stringify(user)) : "";
    try {
      const res = await fetch(`/api/complaints/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
      queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      toast({ title: "Complaint updated" });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  }

  function handleAssignOfficer(e: React.FormEvent) {
    e.preventDefault();
    if (!officerId.trim()) return;
    updateComplaint({ officerId: Number(officerId) });
    setOfficerId("");
  }

  return (
    <div data-testid="page-complaint-detail">
      <div className="mb-6">
        <Link href="/complaints" className="text-xs text-muted-foreground hover:text-primary">← All Complaints</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-serif font-bold text-foreground">Complaint #{complaint.id}</h1>
          <Badge variant={statusVariant(complaint.status) as "default" | "secondary" | "destructive" | "outline"}>{complaint.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{new Date(complaint.createdAt).toLocaleString()}</p>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm">Complaint Text</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{complaint.text}</p>
        </CardContent>
      </Card>

      {cls && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-sm">Auto-Classification</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge>Actor: {cls.actorType}</Badge>
              <Badge variant="outline">Land: {cls.landStatus}</Badge>
              <Badge variant="secondary">Action: {cls.actionType}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm">Officer Actions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={complaint.status === "open" ? "default" : "outline"}
              disabled={updating || complaint.status === "closed"}
              onClick={() => updateComplaint({ status: "closed" })}
            >
              Close Complaint
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={updating || complaint.status === "open"}
              onClick={() => updateComplaint({ status: "open" })}
            >
              Reopen
            </Button>
          </div>
          <form onSubmit={handleAssignOfficer} className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs mb-1 block">Assign Officer (ID)</Label>
              <input
                data-testid="input-officer-id"
                type="number"
                min="1"
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                placeholder="Officer user ID"
                className="w-full border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button type="submit" size="sm" disabled={updating || !officerId.trim()}>
              Assign
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
