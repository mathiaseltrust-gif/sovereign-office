import { useState } from "react";
import {
  Users, MessageSquare, BookOpen, Plus, Trash2, Pin, PinOff,
  CheckCircle, AlertCircle, Shield, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

interface Member {
  id: number;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  tribalNation?: string | null;
  membershipStatus?: string | null;
  pendingReview?: boolean | null;
  icwaEligible?: boolean | null;
  trustBeneficiary?: boolean | null;
  isAncestor?: boolean | null;
  isDeceased?: boolean | null;
  birthYear?: number | null;
  createdAt: string;
}

interface ForumPost {
  id: number;
  title: string;
  category?: string | null;
  authorName?: string | null;
  pinned: boolean;
  replyCount: number;
  createdAt: string;
}

interface LawResource {
  id: number;
  type: string;
  title: string;
  citation: string;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle className="h-3 w-3 mr-1" />{label}
    </Badge>
  ) : (
    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
      <AlertCircle className="h-3 w-3 mr-1" />{label}
    </Badge>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("members");

  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [laws, setLaws] = useState<LawResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);

  const [newMember, setNewMember] = useState({
    fullName: "", firstName: "", lastName: "", birthYear: "",
    tribalNation: "Mathias El Tribe", tribalEnrollmentNumber: "",
    isAncestor: false, icwaEligible: false, trustBeneficiary: false,
    pendingReview: false, notes: "",
  });

  const [newPost, setNewPost] = useState({
    title: "", body: "", category: "Announcements", pinned: false,
  });

  const [newLaw, setNewLaw] = useState({
    type: "tribal", title: "", citation: "", body: "", tags: "",
  });

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/community/directory");
      setMembers(data as Member[]);
      setAuthError(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("Authentication") || msg.includes("401")) setAuthError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/community/forum");
      setPosts(data as ForumPost[]);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  async function loadLaws() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/community/law");
      setLaws(data as LawResource[]);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  async function addMember() {
    if (!newMember.fullName.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    try {
      await apiFetch("/api/community/directory", {
        method: "POST",
        body: JSON.stringify({
          ...newMember,
          birthYear: newMember.birthYear ? parseInt(newMember.birthYear) : undefined,
        }),
      });
      toast({ title: "Member added", description: `${newMember.fullName} has been added to the directory.` });
      setNewMember({ fullName: "", firstName: "", lastName: "", birthYear: "", tribalNation: "Mathias El Tribe", tribalEnrollmentNumber: "", isAncestor: false, icwaEligible: false, trustBeneficiary: false, pendingReview: false, notes: "" });
      loadMembers();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error adding member", description: msg, variant: "destructive" });
    }
  }

  async function deleteMember(id: number, name: string) {
    try {
      await apiFetch(`/api/community/directory/${id}`, { method: "DELETE" });
      toast({ title: "Member removed", description: `${name} has been removed from the directory.` });
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  async function addPost() {
    if (!newPost.title.trim() || !newPost.body.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    try {
      await apiFetch("/api/community/forum", {
        method: "POST",
        body: JSON.stringify(newPost),
      });
      toast({ title: "Post published", description: newPost.pinned ? "Pinned announcement posted." : "Thread created." });
      setNewPost({ title: "", body: "", category: "Announcements", pinned: false });
      loadPosts();
      queryClient.invalidateQueries();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error posting", description: msg, variant: "destructive" });
    }
  }

  async function deletePost(id: number) {
    try {
      await apiFetch(`/api/community/forum/${id}`, { method: "DELETE" });
      toast({ title: "Post deleted" });
      setPosts((prev) => prev.filter((p) => p.id !== id));
      queryClient.invalidateQueries();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  async function addLaw() {
    if (!newLaw.title.trim() || !newLaw.citation.trim() || !newLaw.body.trim()) {
      toast({ title: "Title, citation, and body are required", variant: "destructive" });
      return;
    }
    try {
      await apiFetch("/api/community/law", {
        method: "POST",
        body: JSON.stringify({
          ...newLaw,
          tags: newLaw.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      toast({ title: "Law resource added", description: `${newLaw.title} added to the law library.` });
      setNewLaw({ type: "tribal", title: "", citation: "", body: "", tags: "" });
      loadLaws();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error adding resource", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Community Admin</h1>
        </div>
        <p className="text-muted-foreground">
          Manage members, announcements, and law resources without touching code.
          Write operations require Sovereign Office authentication.
        </p>
      </div>

      {authError && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">Authentication Required for Write Operations</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              To add or remove records, sign in via Azure Entra ID as a Sovereign Office officer.
              Read operations are open to all community members.
            </p>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(t) => {
        setActiveTab(t);
        if (t === "members" && members.length === 0) loadMembers();
        if (t === "forum" && posts.length === 0) loadPosts();
        if (t === "law" && laws.length === 0) loadLaws();
      }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="members" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" /><span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="forum" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Forum</span>
          </TabsTrigger>
          <TabsTrigger value="law" className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /><span className="hidden sm:inline">Law Library</span>
          </TabsTrigger>
        </TabsList>

        {/* MEMBERS TAB */}
        <TabsContent value="members" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Add Family Member
              </CardTitle>
              <CardDescription>Add a new member to the tribal directory.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name *</label>
                  <Input placeholder="e.g. James Running Bear El" value={newMember.fullName} onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name</label>
                  <Input placeholder="First" value={newMember.firstName} onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name</label>
                  <Input placeholder="Last" value={newMember.lastName} onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Birth Year</label>
                  <Input type="number" placeholder="e.g. 1985" value={newMember.birthYear} onChange={(e) => setNewMember({ ...newMember, birthYear: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tribal Nation</label>
                  <Input value={newMember.tribalNation} onChange={(e) => setNewMember({ ...newMember, tribalNation: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Enrollment Number</label>
                  <Input placeholder="Optional" value={newMember.tribalEnrollmentNumber} onChange={(e) => setNewMember({ ...newMember, tribalEnrollmentNumber: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                  <Textarea placeholder="Optional notes about this member..." rows={2} value={newMember.notes} onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                {[
                  { key: "icwaEligible", label: "ICWA Eligible" },
                  { key: "trustBeneficiary", label: "Trust Beneficiary" },
                  { key: "isAncestor", label: "Ancestor" },
                  { key: "pendingReview", label: "Pending Review" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMember[key as keyof typeof newMember] as boolean}
                      onChange={(e) => setNewMember({ ...newMember, [key]: e.target.checked })}
                      className="rounded border-border"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <Button onClick={addMember} className="w-full sm:w-auto gap-2">
                <Plus className="h-4 w-4" /> Add Member
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {members.length} members loaded
            </h3>
            <Button variant="ghost" size="sm" onClick={loadMembers} className="gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {members.length === 0 && !loading && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">Click Refresh to load members.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={loadMembers}>Load Members</Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {members.map((m) => (
              <Card key={m.id} className="group">
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{m.fullName}</span>
                      {m.pendingReview && <StatusBadge ok={false} label="Pending" />}
                      {m.trustBeneficiary && <StatusBadge ok={true} label="Trust" />}
                      {m.icwaEligible && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">ICWA</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.tribalNation ?? "Mathias El Tribe"}
                      {m.birthYear ? ` · b. ${m.birthYear}` : ""}
                      {` · ${m.membershipStatus ?? "active"}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => deleteMember(m.id, m.fullName)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* FORUM TAB */}
        <TabsContent value="forum" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Post Announcement or Thread
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
                <Input placeholder="Announcement or thread title" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={newPost.category} onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}>
                    {["General", "Announcements", "ICWA", "Legal", "Health", "Land", "Culture", "Youth"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                    <input type="checkbox" checked={newPost.pinned} onChange={(e) => setNewPost({ ...newPost, pinned: e.target.checked })} className="rounded border-border" />
                    Pin to top
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Message *</label>
                <Textarea placeholder="Write your announcement or discussion topic..." rows={4} value={newPost.body} onChange={(e) => setNewPost({ ...newPost, body: e.target.value })} />
              </div>
              <Button onClick={addPost} className="w-full sm:w-auto gap-2">
                <Plus className="h-4 w-4" /> {newPost.pinned ? "Post Pinned Announcement" : "Post Thread"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{posts.length} posts</h3>
            <Button variant="ghost" size="sm" onClick={loadPosts} className="gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {posts.length === 0 && !loading && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Button variant="outline" size="sm" onClick={loadPosts}>Load Posts</Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {posts.map((p) => (
              <Card key={p.id} className="group">
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      <span className="font-medium text-sm truncate">{p.title}</span>
                      {p.category && (
                        <Badge variant="outline" className="text-xs py-0">{p.category}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by {p.authorName ?? "Community Member"} · {p.replyCount} {p.replyCount === 1 ? "reply" : "replies"}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => deletePost(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* LAW LIBRARY TAB */}
        <TabsContent value="law" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Add Law Resource
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <div className="flex gap-2">
                  {[{ val: "tribal", label: "Tribal Code" }, { val: "federal", label: "Federal Law" }].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => setNewLaw({ ...newLaw, type: val })}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${newLaw.type === val ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
                <Input placeholder="e.g. Tribal Enrollment Ordinance" value={newLaw.title} onChange={(e) => setNewLaw({ ...newLaw, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Citation *</label>
                <Input placeholder="e.g. MET Code § 3.01 or 25 U.S.C. § 1901" value={newLaw.citation} onChange={(e) => setNewLaw({ ...newLaw, citation: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Body / Summary *</label>
                <Textarea placeholder="The text or summary of this law..." rows={4} value={newLaw.body} onChange={(e) => setNewLaw({ ...newLaw, body: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags (comma-separated)</label>
                <Input placeholder="e.g. enrollment, sovereignty, trust" value={newLaw.tags} onChange={(e) => setNewLaw({ ...newLaw, tags: e.target.value })} />
              </div>
              <Button onClick={addLaw} className="w-full sm:w-auto gap-2">
                <Plus className="h-4 w-4" /> Add to Law Library
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{laws.length} resources</h3>
            <Button variant="ghost" size="sm" onClick={loadLaws} className="gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {laws.length === 0 && !loading && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Button variant="outline" size="sm" onClick={loadLaws}>Load Law Resources</Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {laws.map((l) => (
              <Card key={`${l.type}-${l.id}`} className="group">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${l.type === "tribal" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" : l.type === "federal" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400" : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"}`}
                    >
                      {l.type}
                    </Badge>
                    <span className="font-medium text-sm truncate">{l.title}</span>
                    <span className="text-xs text-muted-foreground font-mono">{l.citation}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
