import { useListCalendarEvents } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function typeVariant(type: string) {
  switch (type) {
    case "nfr_deadline": return "destructive";
    case "task_due": return "secondary";
    case "hearing": return "default";
    case "filing": return "outline";
    default: return "outline";
  }
}

export default function CalendarPage() {
  const { data: events, isLoading } = useListCalendarEvents();

  const grouped = (events ?? []).reduce<Record<string, typeof events>>((acc, e) => {
    const month = new Date(e.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[month]) acc[month] = [];
    acc[month]!.push(e);
    return acc;
  }, {});

  const sortedMonths = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return (
    <div data-testid="page-calendar">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Calendar</h1>
        <p className="text-muted-foreground mt-1">All scheduled events, deadlines, and hearings</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (events ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No calendar events yet.</CardContent></Card>
      ) : sortedMonths.map((month) => (
        <div key={month} className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{month}</h2>
          <div className="space-y-2">
            {grouped[month]!.map((e) => {
              const isPast = new Date(e.date) < new Date();
              return (
                <Card key={e.id} data-testid={`event-card-${e.id}`} className={isPast ? "opacity-60" : ""}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-4">
                      <div className="text-center w-12 shrink-0">
                        <div className="text-lg font-serif font-bold leading-none">{new Date(e.date).getDate()}</div>
                        <div className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("en-US", { weekday: "short" })}</div>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{e.title}</p>
                        {e.description && <p className="text-xs text-muted-foreground mt-0.5 max-w-xl truncate">{e.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant={typeVariant(e.type) as any} className="shrink-0">{e.type.replace(/_/g, " ")}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
