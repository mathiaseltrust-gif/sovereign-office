import { useGetUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { Link } from "wouter";

export default function ProfilePage() {
  const { user, activeRole } = useAuth();
  const { data: profile, isLoading } = useGetUserProfile({
    query: { queryKey: getGetUserProfileQueryKey() },
  });

  return (
    <div data-testid="page-profile">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-1">Your activity, history, and recommendations</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-serif font-bold">
              {user.name?.[0] ?? "?"}
            </div>
            <div>
              <p className="text-lg font-serif font-semibold" data-testid="text-user-name">{user.name}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-user-email">{user.email}</p>
              <div className="flex gap-1 mt-1">
                {user.roles.map((r) => (
                  <Badge key={r} variant={r === activeRole ? "default" : "outline"} className="text-xs">{r}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : !profile ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Open Tasks</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!profile.tasks?.length ? (
                <p className="text-sm text-muted-foreground">No tasks.</p>
              ) : (profile.tasks as any[]).slice(0, 5).map((t: any) => (
                <div key={t.id} data-testid={`profile-task-${t.id}`} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm truncate max-w-xs">{t.title}</span>
                  <Badge variant="outline" className="ml-2 shrink-0">{t.status}</Badge>
                </div>
              ))}
              <Link href="/tasks" className="text-xs text-primary hover:underline block pt-1">View all</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Upcoming Calendar</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!profile.calendarEvents?.length ? (
                <p className="text-sm text-muted-foreground">No events.</p>
              ) : (profile.calendarEvents as any[]).slice(0, 5).map((e: any) => (
                <div key={e.id} data-testid={`profile-event-${e.id}`} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm truncate max-w-xs">{e.title}</span>
                  <span className="text-xs text-muted-foreground ml-2">{new Date(e.date).toLocaleDateString()}</span>
                </div>
              ))}
              <Link href="/calendar" className="text-xs text-primary hover:underline block pt-1">View all</Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Complaint History</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!profile.complaintHistory?.length ? (
                <p className="text-sm text-muted-foreground">No complaints.</p>
              ) : (profile.complaintHistory as any[]).slice(0, 5).map((c: any) => (
                <Link key={c.id} href={`/complaints/${c.id}`}>
                  <div data-testid={`profile-complaint-${c.id}`} className="flex items-center justify-between py-1.5 border-b last:border-0 cursor-pointer hover:text-primary">
                    <span className="text-sm truncate max-w-xs">{c.text?.substring(0, 60)}</span>
                    <Badge variant="outline" className="ml-2 shrink-0">{c.status}</Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">AI Recommendations</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!profile.recommendations?.length ? (
                <p className="text-sm text-muted-foreground">No recommendations yet.</p>
              ) : (profile.recommendations as string[]).map((r, i) => (
                <p key={i} data-testid={`recommendation-${i}`} className="text-sm py-1.5 border-b last:border-0">{r}</p>
              ))}
            </CardContent>
          </Card>

          {profile.searchHistory?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Search History</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(profile.searchHistory as string[]).map((q, i) => (
                    <Badge key={i} variant="secondary" className="text-xs" data-testid={`search-history-${i}`}>{q}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
