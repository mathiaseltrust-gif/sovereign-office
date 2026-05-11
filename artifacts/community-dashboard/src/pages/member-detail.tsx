import React from "react";
import { useParams, Link } from "wouter";
import { 
  useGetCommunityMember, 
  getGetCommunityMemberQueryKey 
} from "@workspace/api-client-react";
import { 
  ArrowLeft, 
  Calendar, 
  Shield, 
  FileText, 
  Users, 
  Network,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export default function MemberDetail() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : 0;

  const { data: member, isLoading, error } = useGetCommunityMember(id, {
    query: {
      enabled: !!id,
      queryKey: getGetCommunityMemberQueryKey(id)
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              <Skeleton className="h-32 w-32 rounded-full" />
              <div className="space-y-4 flex-1">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-destructive">Member Not Found</h2>
        <p className="text-muted-foreground mt-2 mb-6">The family member you're looking for doesn't exist or you don't have access.</p>
        <Link href="/directory">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Link href="/directory">
          <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Card */}
        <Card className="lg:col-span-2 overflow-hidden border-primary/20">
          <div className="h-32 bg-gradient-to-r from-primary/80 to-primary/40"></div>
          <CardContent className="p-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-12 mb-6">
              <Avatar className="h-24 w-24 border-4 border-card shadow-lg bg-card">
                <AvatarImage src={`/assets/${member.photoFilename || ""}`} />
                <AvatarFallback className="text-3xl font-bold text-primary bg-primary/10">
                  {member.firstName?.charAt(0) || ""}{member.lastName?.charAt(0) || ""}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1 mt-4 sm:mt-0 sm:pt-14">
                <h1 className="text-3xl font-bold">{member.fullName}</h1>
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm mt-1">
                  {member.birthYear && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {member.birthYear} {member.deathYear ? `- ${member.deathYear}` : '(Living)'}
                    </span>
                  )}
                  {member.tribalNation && (
                    <span className="flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      {member.tribalNation}
                    </span>
                  )}
                  {member.tribalEnrollmentNumber && (
                    <span className="flex items-center gap-1 font-mono">
                      <FileText className="h-4 w-4" />
                      ID: {member.tribalEnrollmentNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {member.membershipStatus && (
                <Badge variant="default" className="text-sm px-3 py-1">
                  {member.membershipStatus}
                </Badge>
              )}
              {member.isAncestor && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 text-sm px-3 py-1">
                  Ancestor
                </Badge>
              )}
              {member.icwaEligible && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 text-sm px-3 py-1">
                  ICWA Eligible
                </Badge>
              )}
              {member.trustBeneficiary && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 text-sm px-3 py-1">
                  Trust Beneficiary
                </Badge>
              )}
              {member.pendingReview && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 text-sm px-3 py-1">
                  Pending Review
                </Badge>
              )}
            </div>

            {member.notes && (
              <div className="mt-8 space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" /> Biographical Notes
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 border">
                  {member.notes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Family Connections sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Network className="h-5 w-5 text-primary" /> Family Connections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Parents */}
              {member.parents && member.parents.length > 0 && (
                <div className="p-4 border-b">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parents</h4>
                  <div className="space-y-3">
                    {member.parents.map(parent => (
                      <Link key={parent.id} href={`/directory/${parent.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`/assets/${parent.photoFilename || ""}`} />
                            <AvatarFallback className="text-xs bg-primary/10">{parent.firstName?.charAt(0) || ""}{parent.lastName?.charAt(0) || ""}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">{parent.fullName}</span>
                            <span className="text-xs text-muted-foreground">{parent.birthYear ? `b. ${parent.birthYear}` : ''}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Spouses */}
              {member.spouses && member.spouses.length > 0 && (
                <div className="p-4 border-b">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Spouses</h4>
                  <div className="space-y-3">
                    {member.spouses.map(spouse => (
                      <Link key={spouse.id} href={`/directory/${spouse.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`/assets/${spouse.photoFilename || ""}`} />
                            <AvatarFallback className="text-xs bg-primary/10">{spouse.firstName?.charAt(0) || ""}{spouse.lastName?.charAt(0) || ""}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">{spouse.fullName}</span>
                            <span className="text-xs text-muted-foreground">{spouse.birthYear ? `b. ${spouse.birthYear}` : ''}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Children */}
              {member.children && member.children.length > 0 && (
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Children</h4>
                  <div className="space-y-3">
                    {member.children.map(child => (
                      <Link key={child.id} href={`/directory/${child.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`/assets/${child.photoFilename || ""}`} />
                            <AvatarFallback className="text-xs bg-primary/10">{child.firstName?.charAt(0) || ""}{child.lastName?.charAt(0) || ""}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">{child.fullName}</span>
                            <span className="text-xs text-muted-foreground">{child.birthYear ? `b. ${child.birthYear}` : ''}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {(!member.parents?.length && !member.children?.length && !member.spouses?.length) && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No family connections recorded in the directory.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags / Metadata */}
          {member.lineageTags && member.lineageTags.length > 0 && (
            <Card>
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Lineage Tags</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {member.lineageTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="bg-secondary/50 font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
