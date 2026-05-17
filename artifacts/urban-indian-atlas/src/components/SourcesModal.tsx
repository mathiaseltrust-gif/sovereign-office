import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: any;
}

export function SourcesModal({ isOpen, onClose, sources }: SourcesModalProps) {
  const categories = [
    { id: "acts", label: "Acts of Congress", data: sources.acts_of_congress },
    { id: "cases", label: "Court Cases", data: sources.court_cases },
    { id: "reports", label: "Federal Reports", data: sources.federal_reports },
    { id: "census", label: "Census Materials", data: sources.census_materials },
    { id: "state", label: "State Records", data: sources.state_records },
    { id: "health", label: "Health Policy", data: sources.health_policy },
    { id: "urban", label: "Urban Policy", data: sources.urban_indian_policy },
    { id: "maps", label: "Maps", data: sources.maps },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-parchment-texture">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Sources Archive</DialogTitle>
          <DialogDescription>
            Historical documents, federal policies, and scholarly research informing the atlas.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="acts" className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="w-full flex flex-wrap h-auto p-1 bg-muted/50 rounded-lg justify-start gap-1">
            {categories.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="text-xs data-[state=active]:bg-background">
                {c.label} ({c.data?.length || 0})
              </TabsTrigger>
            ))}
          </TabsList>
          
          <ScrollArea className="flex-1 mt-4 border rounded-md bg-card/50">
            {categories.map(c => (
              <TabsContent key={c.id} value={c.id} className="p-4 m-0 space-y-4">
                {c.data?.map((item: any, i: number) => (
                  <div key={i} className="pb-4 border-b border-border/50 last:border-0 last:pb-0">
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 font-medium text-primary hover:underline text-lg font-serif mb-1"
                    >
                      {item.title}
                      <ExternalLink className="w-4 h-4 mt-1 opacity-50 group-hover:opacity-100 flex-shrink-0" />
                    </a>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground mb-2">
                      {item.year && <span>{item.year}</span>}
                      {item.years && <span>{item.years}</span>}
                      {item.citation && <span>{item.citation}</span>}
                      {item.author && <span>{item.author}</span>}
                      {item.status && <span className="uppercase text-accent">{item.status}</span>}
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl">
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
}
