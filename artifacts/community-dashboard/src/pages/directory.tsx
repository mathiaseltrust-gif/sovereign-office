import React, { useState } from "react";
import { Link } from "wouter";
import { Search, Filter, Shield, User as UserIcon, Users } from "lucide-react";
import { 
  useListCommunityMembers, 
  getListCommunityMembersQueryKey 
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce"; // We'll implement a simple one or just use standard react patterns
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Basic debounce hook inline for simplicity
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function Directory() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounceValue(search, 300);
  const [filter, setFilter] = useState("all");

  const queryParams = {
    ...(debouncedSearch ? { q: debouncedSearch } : {}),
    ...(filter === "pending" ? { pendingReview: true } : {}),
    ...(filter === "deceased" ? { isDeceased: true } : {}),
  };

  const { data: members, isLoading } = useListCommunityMembers(queryParams);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Family Directory</h1>
          <p className="text-muted-foreground mt-1">
            Search and connect with members of the Mathias El Tribe.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, tribal nation, or enrollment..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="deceased">Deceased Ancestors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : members && members.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member) => (
            <Link key={member.id} href={`/directory/${member.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group h-full flex flex-col">
                <CardHeader className="flex flex-row items-center gap-4 pb-4 border-b bg-muted/20">
                  <Avatar className="h-16 w-16 border-2 border-background shadow-sm group-hover:border-primary/20 transition-colors">
                    <AvatarImage src={`/assets/${member.photoFilename || ""}`} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {member.firstName?.charAt(0) || ""}{member.lastName?.charAt(0) || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                      {member.fullName}
                    </h3>
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      {member.isDeceased ? (
                        <span>{member.birthYear || "?"} - {member.deathYear || "?"}</span>
                      ) : (
                        <span>Born {member.birthYear || "Unknown"}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex-1 space-y-3">
                  {member.tribalNation && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Users className="h-3 w-3" /> Nation
                      </span>
                      <span className="font-medium text-foreground">{member.tribalNation}</span>
                    </div>
                  )}
                  {member.tribalEnrollmentNumber && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <FileText className="h-3 w-3" /> ID
                      </span>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{member.tribalEnrollmentNumber}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-4 pt-2">
                    {member.isAncestor && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                        Ancestor
                      </Badge>
                    )}
                    {member.icwaEligible && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                        ICWA Eligible
                      </Badge>
                    )}
                    {member.trustBeneficiary && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                        Trust Beneficiary
                      </Badge>
                    )}
                    {member.pendingReview && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50">
                        Pending Review
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-lg border border-dashed">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No members found</h3>
          <p className="text-muted-foreground mt-1 max-w-md">
            We couldn't find any family members matching your current search and filter criteria.
          </p>
          {(search || filter !== "all") && (
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FileText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}
