import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, FilterX } from "lucide-react";
import { AtlasEvent } from "@/pages/atlas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface AtlasSidebarProps {
  events: AtlasEvent[];
  activeEras: string[];
  setActiveEras: (v: string[]) => void;
  activeTypes: string[];
  setActiveTypes: (v: string[]) => void;
  activeSeverities: string[];
  setActiveSeverities: (v: string[]) => void;
  activePolicies: string[];
  setActivePolicies: (v: string[]) => void;
}

const ERA_LABELS: Record<string, string> = {
  "colonial": "Colonial Era",
  "early-republic": "Early Republic",
  "removal": "Removal Era",
  "reservation": "Reservation Era",
  "post-civil-war": "Post-Civil War",
  "allotment": "Allotment Era",
  "jim-crow": "Jim Crow Era",
  "termination": "Termination Era",
  "wwii-migration": "WWII & Migration",
  "self-determination": "Self-Determination Era",
  "modern": "Modern Era"
};

export function AtlasSidebar({
  events,
  activeEras, setActiveEras,
  activeTypes, setActiveTypes,
  activeSeverities, setActiveSeverities,
  activePolicies, setActivePolicies
}: AtlasSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Extract unique values
  const eras = Array.from(new Set(events.map(e => e.era))).sort((a,b) => events.findIndex(e=>e.era===a) - events.findIndex(e=>e.era===b));
  const types = Array.from(new Set(events.map(e => e.event_type))).sort();
  const severities = ["critical", "high", "moderate"];
  const policies = Array.from(new Set(events.map(e => e.policy_area))).sort();

  const toggleFilter = (val: string, activeList: string[], setter: (v: string[]) => void) => {
    if (activeList.includes(val)) {
      setter(activeList.filter(i => i !== val));
    } else {
      setter([...activeList, val]);
    }
  };

  const clearAll = () => {
    setActiveEras([]);
    setActiveTypes([]);
    setActiveSeverities([]);
    setActivePolicies([]);
  };

  const activeCount = activeEras.length + activeTypes.length + activeSeverities.length + activePolicies.length;

  return (
    <motion.div 
      initial={false}
      animate={{ width: collapsed ? 48 : 320 }}
      className="h-full border-r border-border bg-sidebar bg-parchment-texture z-10 flex flex-col relative"
    >
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-4 bg-background border border-border rounded-full p-1 shadow-sm z-20 hover:bg-muted"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {collapsed ? (
        <div className="flex-1 py-4 flex flex-col items-center">
          {activeCount > 0 && <Badge variant="destructive" className="mb-4 h-6 w-6 p-0 flex items-center justify-center rounded-full">{activeCount}</Badge>}
          <span className="[writing-mode:vertical-lr] font-serif text-muted-foreground tracking-widest uppercase mt-4">Filters</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50">
            <h2 className="font-serif font-medium text-lg">Filters</h2>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground">
                <FilterX className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-8">
              
              {/* Severity */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Severity Level</h3>
                <div className="space-y-2">
                  {severities.map(s => (
                    <div key={s} className="flex items-center gap-2">
                      <Checkbox 
                        id={`sev-${s}`} 
                        checked={activeSeverities.includes(s)}
                        onCheckedChange={() => toggleFilter(s, activeSeverities, setActiveSeverities)}
                        data-testid={`filter-severity-${s}`}
                      />
                      <Label htmlFor={`sev-${s}`} className="capitalize flex items-center gap-2 cursor-pointer">
                        <span className={`w-2 h-2 rounded-full ${s === 'critical' ? 'bg-[#a64115]' : s === 'high' ? 'bg-[#c29b40]' : 'bg-[#5c744c]'}`}></span>
                        {s}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Era */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Era</h3>
                <div className="space-y-2">
                  {eras.map(e => (
                    <div key={e} className="flex items-center gap-2">
                      <Checkbox 
                        id={`era-${e}`} 
                        checked={activeEras.includes(e)}
                        onCheckedChange={() => toggleFilter(e, activeEras, setActiveEras)}
                        data-testid={`filter-era-${e}`}
                      />
                      <Label htmlFor={`era-${e}`} className="cursor-pointer">{ERA_LABELS[e] || e}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Type */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Event Type</h3>
                <div className="space-y-2">
                  {types.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <Checkbox 
                        id={`type-${t}`} 
                        checked={activeTypes.includes(t)}
                        onCheckedChange={() => toggleFilter(t, activeTypes, setActiveTypes)}
                        data-testid={`filter-type-${t.replace(/\s+/g, '-').toLowerCase()}`}
                      />
                      <Label htmlFor={`type-${t}`} className="cursor-pointer">{t}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy Area */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Policy Area</h3>
                <div className="space-y-2">
                  {policies.map(p => (
                    <div key={p} className="flex items-center gap-2">
                      <Checkbox 
                        id={`pol-${p}`} 
                        checked={activePolicies.includes(p)}
                        onCheckedChange={() => toggleFilter(p, activePolicies, setActivePolicies)}
                        data-testid={`filter-policy-${p.replace(/\s+/g, '-').toLowerCase()}`}
                      />
                      <Label htmlFor={`pol-${p}`} className="cursor-pointer">{p}</Label>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </ScrollArea>
        </div>
      )}
    </motion.div>
  );
}
