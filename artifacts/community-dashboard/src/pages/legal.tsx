import React, { useState } from "react";
import { Search, Book, Scale, Landmark, ChevronDown, ChevronUp } from "lucide-react";
import { useListLawResources } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const TABS = [
  { value: "all", label: "All" },
  { value: "tribal", label: "Tribal" },
  { value: "federal", label: "Federal" },
  { value: "doctrine", label: "Doctrine" },
];

export default function Legal() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
    switch (type) {
      case "tribal": return <Book className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "federal": return <Landmark className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "doctrine": return <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      default: return <Book className="h-4 w-4" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "tribal": return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50";
      case "federal": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50";
      case "doctrine": return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50";
      default: return "";
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Legal Resources</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Explore tribal codes, federal Indian law, and foundational doctrines protecting our sovereignty.
        </p>
      </div>

      <div className="bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, citation, or keyword…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Responsive tab bar — pill buttons that scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
              activeTab === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 w-2/3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : resources && resources.length > 0 ? (
        <div className="space-y-3">
          {resources.map((resource) => {
            const isExpanded = expandedId === resource.id;
            return (
              <Card
                key={resource.id}
                className={`overflow-hidden transition-all duration-200 ${isExpanded ? "border-primary/40 shadow-md" : "hover:border-primary/20 hover:shadow-sm"}`}
              >
                <div
                  className="p-4 md:p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : resource.id)}
                >
                  <div className="flex items-start gap-3 justify-between">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(resource.type)}
                        <h3 className="font-semibold text-sm md:text-base leading-tight text-foreground/90 line-clamp-2">
                          {resource.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {resource.citation}
                        </span>
                        {resource.caseName && (
                          <span className="text-xs italic text-muted-foreground hidden sm:inline">"{resource.caseName}"</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`capitalize text-xs hidden sm:flex ${getBadgeColor(resource.type)}`}>
                        {resource.type}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 md:px-5 pb-5 pt-2 border-t bg-muted/10 animate-in slide-in-from-top-2">
                    {resource.summary && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-primary mb-1.5 uppercase tracking-wider">Summary</h4>
                        <p className="text-sm text-foreground/80 leading-relaxed">{resource.summary}</p>
                      </div>
                    )}
                    {resource.body && (
                      <div className="prose prose-sm dark:prose-invert max-w-none mb-4 whitespace-pre-wrap font-serif text-foreground/90 leading-relaxed text-sm">
                        {resource.body}
                      </div>
                    )}
                    {resource.tags && resource.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/50">
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
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card/50 rounded-lg border border-dashed">
          <Book className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No resources found</h3>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            We couldn't find any legal resources matching your search.
          </p>
          {search && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
