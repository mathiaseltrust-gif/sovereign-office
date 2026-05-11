import React, { useState } from "react";
import { Search, Book, Scale, Landmark, ChevronDown, ChevronUp } from "lucide-react";
import { 
  useListLawResources,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function Legal() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Debounce search manually for simplicity
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const queryParams = {
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
    ...(activeTab !== "all" ? { type: activeTab as "tribal" | "federal" | "doctrine" } : {}),
  };

  const { data: resources, isLoading } = useListLawResources(queryParams);

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'tribal': return <Book className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'federal': return <Landmark className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'doctrine': return <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      default: return <Book className="h-4 w-4" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch(type) {
      case 'tribal': return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50";
      case 'federal': return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50";
      case 'doctrine': return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50";
      default: return "";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Legal Resources</h1>
        <p className="text-muted-foreground text-lg">
          Explore tribal codes, federal Indian law, and foundational doctrines protecting our sovereignty.
        </p>
      </div>

      <div className="bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search resources by title, citation, or keyword..." 
            className="pl-10 text-base py-6"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-muted/50 p-1">
          <TabsTrigger value="all">All Resources</TabsTrigger>
          <TabsTrigger value="tribal" className="data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400">Tribal Code</TabsTrigger>
          <TabsTrigger value="federal" className="data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400">Federal Law</TabsTrigger>
          <TabsTrigger value="doctrine" className="data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400">Doctrine</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 w-2/3">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : resources && resources.length > 0 ? (
        <div className="space-y-4">
          {resources.map((resource) => {
            const isExpanded = expandedId === resource.id;
            return (
              <Card 
                key={resource.id} 
                className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'border-primary/40 shadow-md' : 'hover:border-primary/20 hover:shadow-sm'}`}
              >
                <div 
                  className="p-6 cursor-pointer flex flex-col sm:flex-row gap-4 justify-between items-start"
                  onClick={() => setExpandedId(isExpanded ? null : resource.id)}
                >
                  <div className="space-y-2 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(resource.type)}
                      <h3 className="font-semibold text-lg leading-tight text-foreground/90">{resource.title}</h3>
                    </div>
                    <div className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                      <span className="bg-muted px-2 py-0.5 rounded">{resource.citation}</span>
                      {resource.caseName && <span className="italic">"{resource.caseName}"</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 mt-2 sm:mt-0">
                    <Badge variant="outline" className={`capitalize ${getBadgeColor(resource.type)}`}>
                      {resource.type}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t bg-muted/10 animate-in slide-in-from-top-2">
                    {resource.summary && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-primary mb-1">Summary</h4>
                        <p className="text-sm text-foreground/80 leading-relaxed">{resource.summary}</p>
                      </div>
                    )}
                    
                    {resource.body && (
                      <div className="prose prose-sm dark:prose-invert max-w-none mb-4 whitespace-pre-wrap font-serif text-foreground/90 leading-relaxed">
                        {resource.body}
                      </div>
                    )}

                    {resource.tags && resource.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                        {resource.tags.map((tag, idx) => (
                          <span key={idx} className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card/50 rounded-lg border border-dashed">
          <Book className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-medium">No resources found</h3>
          <p className="text-muted-foreground mt-2 max-w-md">
            We couldn't find any legal resources matching your search.
          </p>
          {(search) && (
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={() => setSearch("")}
            >
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
