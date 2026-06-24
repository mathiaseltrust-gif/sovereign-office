import { AtlasEvent } from "@/pages/atlas";
import { Slider } from "@/components/ui/slider";

interface AtlasTimelineProps {
  events: AtlasEvent[];
  filteredEvents: AtlasEvent[];
  yearRange: [number, number];
  setYearRange: (r: [number, number]) => void;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

const severityColors = {
  critical: "bg-[#a64115]",
  high: "bg-[#c29b40]",
  moderate: "bg-[#5c744c]"
};

function eventDateLabel(evt: AtlasEvent): string {
  if (evt.eventDate || evt.dateStart) {
    const date = new Date(evt.eventDate ?? evt.dateStart!);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
  }
  return String(evt.year);
}

function eventLocationLabel(evt: AtlasEvent): string | null {
  return evt.eventPlace || evt.locationName || evt.affected_regions?.[0] || evt.states_affected?.[0] || null;
}

function compactTitle(evt: AtlasEvent): string {
  if (/^ancestor\s+#\d+$/i.test(evt.title ?? "")) return evt.source_title || "Ancestor record";
  return evt.short_title || evt.title || evt.source_title || "Ancestor record";
}

export function AtlasTimeline({
  events, filteredEvents, yearRange, setYearRange, selectedEventId, onSelectEvent
}: AtlasTimelineProps) {
  
  const minYear = 1790;
  const maxYear = new Date().getFullYear();
  const span = maxYear - minYear;

  const getPosition = (year: number) => {
    return ((year - minYear) / span) * 100;
  };

  return (
    <div className="h-40 bg-card border-t border-border flex flex-col justify-center px-6 relative z-10">
      
      <div className="flex justify-between items-center mb-3">
        <span className="font-mono text-sm text-muted-foreground">{yearRange[0]}</span>
        <span className="font-serif text-sm italic opacity-70 px-4 py-1 bg-background/50 rounded border border-border">Timeline of Survival</span>
        <span className="font-mono text-sm text-muted-foreground">{yearRange[1]}</span>
      </div>

      <div className="relative h-20 w-full flex items-center">
        {/* Scrubber Background Track */}
        <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-1 bg-border/40 rounded-full" />
        
        {/* Events markers */}
        {events.map((evt, index) => {
          const isFilteredOut = !filteredEvents.find(e => e.id === evt.id);
          const isSelected = evt.id === selectedEventId;
          const pos = getPosition(evt.year);
          const bg = severityColors[evt.severity_level] || "bg-foreground";
          const label = compactTitle(evt);
          const location = eventLocationLabel(evt);
          const lane = index % 2 === 0 ? "top-1" : "bottom-1";
          const labelAlign = pos > 82 ? "-translate-x-full text-right" : pos < 18 ? "translate-x-0 text-left" : "-translate-x-1/2 text-center";
          
          return (
            <button
              key={evt.id}
              type="button"
              className={`absolute ${lane} group cursor-pointer transition-opacity ${isFilteredOut ? 'opacity-25' : 'opacity-95'} ${isSelected ? 'z-30' : 'z-10'}`}
              style={{ left: `${Math.max(0, Math.min(100, pos))}%` }}
              onClick={() => onSelectEvent(evt.id)}
              data-testid={`timeline-marker-${evt.id}`}
              title={`${eventDateLabel(evt)} · ${evt.event_type}${location ? ` · ${location}` : ""}: ${label}`}
            >
              <span
                className={`absolute left-0 block -translate-x-1/2 rounded-full ${bg} ${isSelected ? 'h-3.5 w-3.5 ring-2 ring-foreground ring-offset-1' : 'h-2.5 w-2.5 group-hover:scale-125'} transition-transform`}
                style={{ top: index % 2 === 0 ? 31 : -1 }}
              />
              <span className={`block w-40 max-w-[42vw] ${labelAlign} rounded border px-2 py-1 shadow-sm ${isSelected ? 'border-primary bg-background text-foreground' : 'border-border/70 bg-background/80 text-muted-foreground group-hover:text-foreground'}`}>
                <span className="block truncate text-[10px] font-mono uppercase tracking-wide">
                  {eventDateLabel(evt)} · {evt.event_type || "Event"}
                </span>
                <span className="block truncate text-[11px] font-medium leading-tight">{label}</span>
                {location && <span className="block truncate text-[10px] opacity-70">{location}</span>}
              </span>
            </button>
          );
        })}

        <Slider
          defaultValue={[1790, new Date().getFullYear()]}
          value={[yearRange[0], yearRange[1]]}
          min={1790}
          max={new Date().getFullYear()}
          step={1}
          onValueChange={(val: any) => setYearRange([val[0], val[1]])}
          className="absolute inset-0"
        />
      </div>

    </div>
  );
}
