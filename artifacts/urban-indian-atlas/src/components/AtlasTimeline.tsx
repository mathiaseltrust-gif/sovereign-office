import { AtlasEvent } from "@/pages/atlas";
import { Slider } from "@/components/ui/slider";
import { useMemo } from "react";

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

export function AtlasTimeline({
  events, filteredEvents, yearRange, setYearRange, selectedEventId, onSelectEvent
}: AtlasTimelineProps) {
  
  const minYear = 1790;
  const maxYear = 2024;
  const span = maxYear - minYear;

  const getPosition = (year: number) => {
    return ((year - minYear) / span) * 100;
  };

  return (
    <div className="h-28 bg-card border-t border-border flex flex-col justify-center px-8 relative z-10">
      
      <div className="flex justify-between items-center mb-4">
        <span className="font-mono text-sm text-muted-foreground">{yearRange[0]}</span>
        <span className="font-serif text-sm italic opacity-70 px-4 py-1 bg-background/50 rounded border border-border">Timeline of Survival</span>
        <span className="font-mono text-sm text-muted-foreground">{yearRange[1]}</span>
      </div>

      <div className="relative h-10 w-full flex items-center">
        {/* Scrubber Background Track */}
        <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-1 bg-border/40 rounded-full" />
        
        {/* Events markers */}
        {events.map(evt => {
          const isFilteredOut = !filteredEvents.find(e => e.id === evt.id);
          const isSelected = evt.id === selectedEventId;
          const pos = getPosition(evt.year);
          const bg = severityColors[evt.severity_level] || "bg-foreground";
          
          return (
            <div 
              key={evt.id}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full cursor-pointer hover:scale-150 transition-transform ${bg} ${isFilteredOut ? 'opacity-20 scale-75' : 'opacity-90'} ${isSelected ? 'ring-2 ring-foreground ring-offset-1 scale-125 z-20' : 'z-10'}`}
              style={{ 
                left: `${pos}%`, 
                width: isSelected ? '12px' : '8px', 
                height: isSelected ? '12px' : '8px' 
              }}
              onClick={() => onSelectEvent(evt.id)}
              data-testid={`timeline-marker-${evt.id}`}
              title={`${evt.year}: ${evt.title}`}
            />
          );
        })}

        <Slider
          defaultValue={[1790, 2024]}
          value={[yearRange[0], yearRange[1]]}
          min={1790}
          max={2024}
          step={1}
          onValueChange={(val: any) => setYearRange([val[0], val[1]])}
          className="absolute inset-0"
        />
      </div>

    </div>
  );
}
