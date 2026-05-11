import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MessageSquare, Users, Pin, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityEvent {
  type: "forum" | "member";
  id: number;
  title: string;
  subtitle: string;
  meta: string;
  pinned: boolean;
  replyCount: number;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`/api/community/activity`);
        if (res.ok) {
          const data = await res.json() as ActivityEvent[];
          setEvents(data);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
    const interval = setInterval(() => {
      fetchActivity();
      forceUpdate((n) => n + 1);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Network Activity
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {loading ? (
          <div className="space-y-0 divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No activity yet. Be the first to post!
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {events.map((event, idx) => (
              <div
                key={`${event.type}-${event.id}-${idx}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    event.type === "forum"
                      ? "bg-primary/10"
                      : "bg-amber-500/10"
                  }`}
                >
                  {event.type === "forum" ? (
                    <MessageSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {event.pinned && (
                      <Pin className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                    {event.type === "forum" ? (
                      <Link href={`/forum/${event.id}`}>
                        <span className="text-sm font-medium leading-snug hover:text-primary transition-colors cursor-pointer line-clamp-1">
                          {event.title}
                        </span>
                      </Link>
                    ) : (
                      <Link href={`/directory/${event.id}`}>
                        <span className="text-sm font-medium leading-snug hover:text-primary transition-colors cursor-pointer line-clamp-1">
                          {event.title}
                        </span>
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 px-1.5 h-4 ${
                        event.type === "forum"
                          ? "bg-primary/5 border-primary/20 text-primary"
                          : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-400"
                      }`}
                    >
                      {event.type === "forum" ? event.subtitle : event.subtitle}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{event.meta}</span>
                    {event.type === "forum" && event.replyCount > 0 && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <MessageSquare className="h-2.5 w-2.5" />
                        {event.replyCount}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground/60 ml-auto">{timeAgo(event.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
