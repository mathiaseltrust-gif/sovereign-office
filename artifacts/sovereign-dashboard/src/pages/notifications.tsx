import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";

interface Notification {
  id: number;
  userId: number | null;
  channel: string;
  category: string;
  title: string;
  message: string;
  severity: string;
  relatedId: number | null;
  relatedType: string | null;
  redFlag: boolean;
  troFlag: boolean;
  read: boolean;
  createdAt: string;
}

function severityBadge(severity: string, redFlag: boolean, troFlag: boolean) {
  if (redFlag) return <Badge className="bg-red-700 text-white text-xs">Red Flag</Badge>;
  if (troFlag) return <Badge className="bg-orange-600 text-white text-xs">TRO Alert</Badge>;
  if (severity === "emergency") return <Badge className="bg-red-600 text-white text-xs">Emergency</Badge>;
  if (severity === "critical") return <Badge className="bg-orange-500 text-white text-xs">Critical</Badge>;
  if (severity === "warning") return <Badge className="bg-yellow-600 text-white text-xs">Warning</Badge>;
  return <Badge variant="secondary" className="text-xs">Info</Badge>;
}

function categoryLabel(category: string) {
  const map: Record<string, string> = {
    family_governance: "Family Governance",
    welfare_update: "Welfare Update",
    trust_instrument: "Trust Instrument",
    recorder_filing: "Recorder Filing",
    court_hearing: "Court Hearing",
    tribal_announcement: "Tribal Announcement",
    tro_alert: "TRO Alert",
    red_flag_alert: "Red Flag",
    task_assigned: "Task",
    complaint_update: "Complaint",
  };
  return map[category] ?? category.replace(/_/g, " ");
}

function NotificationCard({
  notif,
  onMarkRead,
}: {
  notif: Notification;
  onMarkRead: (id: number) => void;
}) {
  const isUrgent = notif.redFlag || notif.troFlag || notif.severity === "emergency" || notif.severity === "critical";

  return (
    <Card
      className={[
        "transition-all",
        notif.read ? "opacity-70" : "",
        notif.redFlag ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "",
        notif.troFlag && !notif.redFlag ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20" : "",
        isUrgent && !notif.redFlag && !notif.troFlag ? "border-yellow-400" : "",
      ].join(" ")}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {!notif.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
              {severityBadge(notif.severity, notif.redFlag, notif.troFlag)}
              <Badge variant="outline" className="text-xs">{categoryLabel(notif.category)}</Badge>
            </div>
            <p className={`font-semibold text-sm leading-snug ${notif.redFlag ? "text-red-800 dark:text-red-300" : notif.troFlag ? "text-orange-800 dark:text-orange-300" : ""}`}>
              {notif.title}
            </p>
            <p className="text-sm text-muted-foreground leading-snug">{notif.message}</p>
            {notif.redFlag && (
              <p className="text-xs text-red-700 dark:text-red-400 font-medium mt-1">
                Federal Indian law applies. Indian Canons of Construction — ambiguities resolved in favor of Indians.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(notif.createdAt).toLocaleString()}
              {notif.relatedType && notif.relatedId ? ` · ${notif.relatedType.replace(/_/g, " ")} #${notif.relatedId}` : ""}
            </p>
          </div>
          {!notif.read && (
            <Button size="sm" variant="ghost" onClick={() => onMarkRead(notif.id)} className="shrink-0 text-xs">
              Mark read
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "red_flag" | "tro">("all");

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
      if (r.ok) {
        const data = await r.json();
        setNotifications(data);
      }
    } catch {
      toast({ title: "Error", description: "Could not load notifications.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useState(() => {
    loadNotifications();
  });

  const markRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      toast({ title: "Error", description: "Could not mark notification as read.", variant: "destructive" });
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "PUT",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: "All marked as read" });
    } catch {
      toast({ title: "Error", description: "Could not mark all as read.", variant: "destructive" });
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "red_flag") return n.redFlag;
    if (filter === "tro") return n.troFlag;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const redFlagCount = notifications.filter((n) => n.redFlag).length;
  const troCount = notifications.filter((n) => n.troFlag).length;

  const FILTERS = [
    { key: "all", label: `All (${notifications.length})` },
    { key: "unread", label: `Unread (${unreadCount})` },
    { key: "red_flag", label: `Red Flags (${redFlagCount})` },
    { key: "tro", label: `TRO Alerts (${troCount})` },
  ] as const;

  return (
    <div data-testid="page-notifications">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            System alerts · Red flag violations · TRO triggers · Welfare updates
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadNotifications}>Refresh</Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={markAllRead}>Mark All Read</Button>
          )}
        </div>
      </div>

      {redFlagCount > 0 && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20 mb-6">
          <CardContent className="pt-4 pb-4">
            <p className="font-semibold text-red-800 dark:text-red-300 text-sm">
              ⚠ {redFlagCount} Red Flag {redFlagCount === 1 ? "Alert" : "Alerts"} — Indian Status / Jurisdiction Violations Detected
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1">
              Federal Indian law applies. Indian Canons of Construction require resolution in favor of Indian interests. Escalate to Chief Justice &amp; Trustee immediately.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
            className={filter === f.key && f.key === "red_flag" ? "bg-red-700 hover:bg-red-800" : filter === f.key && f.key === "tro" ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {filter === "all" ? "No notifications yet." : `No ${filter.replace(/_/g, " ")} notifications.`}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <NotificationCard key={n.id} notif={n} onMarkRead={markRead} />
          ))}
        </div>
      )}
    </div>
  );
}
