import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsAdmin, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Link, Redirect } from "wouter";

const SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
  emergency: "Emergency",
};

function toLabel(raw: string): string {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface CategoryOptions {
  categories: string[];
  severities: string[];
}

export default function AdminEmailPreviewPage() {
  const isAdmin = useIsAdmin();
  const { toast } = useToast();

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const apiBase = base.replace(/\/sovereign-dashboard$/, "");

  const { data: options, isLoading: optionsLoading, isError: optionsError, refetch: refetchOptions } = useQuery<CategoryOptions>({
    queryKey: ["admin-email-preview-categories"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/admin/email-preview/categories`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!res.ok) throw new Error("Could not load categories");
      return res.json() as Promise<CategoryOptions>;
    },
    enabled: isAdmin,
    staleTime: Infinity,
  });

  const categories = options?.categories ?? [];
  const severities = options?.severities ?? [];

  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("default");
  const [recipientName, setRecipientName] = useState("Jane Doe");
  const [title, setTitle] = useState("Important Notice from the Office of the Chief Justice and Trustee");
  const [message, setMessage] = useState(
    "This is a sample message body. It gives you a preview of how notification emails appear to recipients.\n\nYou can change the fields on the left to see how different categories and severities affect the email design.",
  );

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedCategory = category || (categories[0] ?? "");

  const handlePreview = useCallback(async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/email-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
        },
        body: JSON.stringify({
          category: selectedCategory,
          severity: severity === "default" ? undefined : severity,
          recipientName: recipientName.trim() || "Sample Recipient",
          title: title.trim() || "Sample Title",
          message: message.trim() || "Sample message.",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error((err as { error?: string }).error ?? "Preview failed");
      }
      const data = await res.json() as { html: string };
      setPreviewHtml(data.html);
    } catch (err) {
      toast({
        title: "Preview failed",
        description: err instanceof Error ? err.message : "Could not load email preview.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [apiBase, selectedCategory, severity, recipientName, title, message, toast]);

  if (!isAdmin) {
    return <Redirect to="/dashboard/admin" />;
  }

  return (
    <div data-testid="page-email-preview">
      <div className="mb-6">
        <Link href="/dashboard/admin" className="text-xs text-muted-foreground hover:text-primary">
          ← Admin Dashboard
        </Link>
        <h1 className="text-3xl font-serif font-bold text-foreground mt-2">Email Template Preview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Preview notification email designs before they reach members. Select a category and severity, fill in sample content, then click Preview.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        <Card className="sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-widest">Preview Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {optionsError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 flex items-center justify-between gap-2">
                <p className="text-xs text-destructive">Could not load template options.</p>
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => refetchOptions()}>
                  Retry
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              {optionsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedCategory} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {toLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="severity">Severity</Label>
              {optionsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default (category default)</SelectItem>
                    {severities.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SEVERITY_LABELS[s] ?? toLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recipient">Sample Recipient Name</Label>
              <Input
                id="recipient"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">Email Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message">Message Body</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Message body..."
                className="resize-none"
              />
            </div>

            <Button
              className="w-full"
              onClick={handlePreview}
              disabled={loading || optionsLoading || !selectedCategory}
            >
              {loading ? "Generating…" : "Preview Email"}
            </Button>
          </CardContent>
        </Card>

        <div>
          {loading ? (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-10 w-32" />
              </CardContent>
            </Card>
          ) : previewHtml ? (
            <div className="rounded-lg border bg-background overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Email Preview</span>
                <span className="text-xs text-muted-foreground">
                  {toLabel(selectedCategory)}
                  {severity !== "default" ? ` · ${severity}` : ""}
                </span>
              </div>
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ height: "700px" }}
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center">
                <div className="text-4xl text-muted-foreground/30">✉</div>
                <p className="text-sm text-muted-foreground">
                  Configure the settings on the left and click <strong>Preview Email</strong> to see how the notification email will look.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
