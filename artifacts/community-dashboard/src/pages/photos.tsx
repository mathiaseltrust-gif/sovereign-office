import React, { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  Camera, Search, Upload, Link2, CheckCircle2, X, ArrowLeft,
  User, ImageOff, Loader2, RefreshCw,
} from "lucide-react";
import { useListCommunityMembers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getSovereignSession } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getCommunityToken(): string | null {
  try {
    const raw = localStorage.getItem("sovereign_auth_v3");
    if (!raw) return null;
    const s = JSON.parse(raw) as { sessionToken?: string; user?: { id?: string | number; email?: string; name?: string; roles?: string[] } };
    if (s.sessionToken) return s.sessionToken;
    if (s.user?.email) {
      const u = s.user;
      const id = String(u.id ?? u.email ?? "");
      if (id && u.email) return btoa(JSON.stringify({ id, email: u.email, name: u.name ?? u.email, roles: Array.isArray(u.roles) ? u.roles : ["member"] }));
    }
  } catch { /* ignore */ }
  return null;
}

type CommunityMember = {
  id: number;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  photoFilename?: string | null;
  tribalNation?: string | null;
  isAncestor?: boolean | null;
};

// ─── Single Member Photo Card ─────────────────────────────────────────────────

function MemberPhotoCard({
  member,
  onSaved,
}: {
  member: CommunityMember;
  onSaved: (id: number, url: string) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [urlInput, setUrlInput] = useState(member.photoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localPhotoUrl, setLocalPhotoUrl] = useState(member.photoUrl ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = `${member.firstName?.charAt(0) ?? ""}${member.lastName?.charAt(0) ?? ""}`.trim() || "?";

  const patchPhoto = useCallback(async (photoUrl: string) => {
    const token = getCommunityToken();
    setSaving(true);
    try {
      const r = await fetch(`/api/community/directory/${member.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ photoUrl }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(e.error ?? "Save failed");
      }
      setLocalPhotoUrl(photoUrl);
      onSaved(member.id, photoUrl);
      setOpen(false);
      toast({ title: "Photo saved", description: `Photo updated for ${member.fullName}.` });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [member.id, member.fullName, onSaved, toast]);

  const handleUrlSave = () => {
    if (!urlInput.trim()) return;
    patchPhoto(urlInput.trim());
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Images only", description: "Please select a JPG, PNG, HEIC, or WEBP file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadProgress(10);
    try {
      // Step 1: request presigned upload URL
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) {
        const e = await urlRes.json().catch(() => ({})) as { error?: string };
        throw new Error(e.error ?? "Could not get upload URL");
      }
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      setUploadProgress(30);

      // Step 2: upload file directly to GCS via presigned URL
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("File upload to storage failed");
      setUploadProgress(80);

      // Step 3: save the serving URL to the member record
      // objectPath is e.g. /objects/uploads/some-uuid
      // serving URL is /api/storage + objectPath
      const servingUrl = `/api/storage${objectPath}`;
      await patchPhoto(servingUrl);
      setUploadProgress(100);
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [patchPhoto, toast]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <Card className={`transition-all duration-200 ${open ? "ring-2 ring-primary/30" : "hover:shadow-sm"}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage
                src={localPhotoUrl || (member.photoFilename ? `/assets/${member.photoFilename}` : "")}
                className="object-cover"
              />
              <AvatarFallback className="text-lg font-bold text-primary bg-primary/10">
                {initials}
              </AvatarFallback>
            </Avatar>
            {localPhotoUrl && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <Link href={`${BASE}/directory/${member.id}`}>
              <p className="font-semibold text-sm hover:text-primary truncate">{member.fullName || "Unknown"}</p>
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              {localPhotoUrl ? (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Has photo
                </span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ImageOff className="h-3 w-3" /> No photo
                </span>
              )}
              {member.isAncestor && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                  Ancestor
                </Badge>
              )}
            </div>
          </div>

          {/* Toggle button */}
          <Button
            variant={open ? "secondary" : "outline"}
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
            {open ? "Close" : localPhotoUrl ? "Change" : "Add Photo"}
          </Button>
        </div>

        {/* Expand panel */}
        {open && (
          <div className="mt-4 border-t pt-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "url" | "upload")}>
              <TabsList className="h-8 text-xs mb-3">
                <TabsTrigger value="url" className="text-xs gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Paste URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="text-xs gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Upload File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="mt-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/photo.jpg"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUrlSave()}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleUrlSave} disabled={saving || !urlInput.trim()} className="shrink-0">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
                {urlInput && (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={urlInput}
                      alt="Preview"
                      className="h-12 w-12 rounded-full object-cover border"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                    />
                    <p className="text-xs text-muted-foreground">Preview — paste a direct image link (ends in .jpg, .png, etc.)</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upload" className="mt-0">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFilePick}
                />
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    uploading
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                  onClick={() => !uploading && fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  {uploading ? (
                    <div className="space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-primary font-medium">Uploading… {uploadProgress}%</p>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Click or drag a photo here</p>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG, HEIC, WEBP — any size</p>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {localPhotoUrl && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <p className="text-xs text-muted-foreground truncate max-w-[70%]">Current: {localPhotoUrl}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive h-7"
                  onClick={() => patchPhoto("")}
                  disabled={saving}
                >
                  Remove photo
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PhotoManager() {
  const session = getSovereignSession();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "with" | "without">("all");
  const [photoMap, setPhotoMap] = useState<Record<number, string>>({});

  const { data: allMembers = [], isLoading, refetch } = useListCommunityMembers(
    {},
    { query: { staleTime: 30_000 } }
  ) as { data: CommunityMember[]; isLoading: boolean; refetch: () => void };

  const handleSaved = useCallback((id: number, url: string) => {
    setPhotoMap((prev) => ({ ...prev, [id]: url }));
  }, []);

  const members = (allMembers as CommunityMember[]).map((m) => ({
    ...m,
    photoUrl: photoMap[m.id] !== undefined ? photoMap[m.id] : m.photoUrl,
  }));

  const filtered = members.filter((m) => {
    const name = (m.fullName ?? "").toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase());
    const hasPhoto = !!(m.photoUrl || m.photoFilename);
    const matchesFilter = filter === "all" || (filter === "with" && hasPhoto) || (filter === "without" && !hasPhoto);
    return matchesSearch && matchesFilter;
  });

  const withPhotoCount = members.filter((m) => m.photoUrl || m.photoFilename).length;
  const withoutCount = members.length - withPhotoCount;

  if (!session) {
    return (
      <div className="text-center py-20">
        <Camera className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold">Officer Access Required</h2>
        <p className="text-muted-foreground mt-2">Sign in as an officer to manage member photos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Camera className="h-7 w-7 text-primary" /> Photo Manager
            </h1>
            <p className="text-muted-foreground mt-1">
              Add or update profile photos for family members — paste a URL or upload from your device.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Members", value: members.length, color: "text-foreground" },
          { label: "Have Photos", value: withPhotoCount, color: "text-green-600 dark:text-green-400" },
          { label: "Need Photos", value: withoutCount, color: "text-amber-600 dark:text-amber-400" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{isLoading ? "–" : value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          {(["all", "without", "with"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f === "all" ? "All" : f === "with" ? "Has Photo" : "Needs Photo"}
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <User className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No members match your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {members.length} members
          </p>
          {filtered.map((m) => (
            <MemberPhotoCard key={m.id} member={m} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
