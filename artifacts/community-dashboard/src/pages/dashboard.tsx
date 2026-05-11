import React from "react";
import { Link } from "wouter";
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  UserPlus, 
  AlertCircle,
  FileText,
  Activity,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetCommunityDirectoryStats } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetCommunityDirectoryStats();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Community Dashboard</h1>
        <p className="text-muted-foreground text-lg">
          Welcome to the Mathias El Tribe community portal. Connect with family, access resources, and join discussions.
        </p>
      </div>

      {isLoading || !stats ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/3 mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeMembers} active members
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.pendingReview}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting membership verification
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">ICWA Eligible</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.icwaEligible}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Children requiring protection
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Trust Beneficiaries</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.trustBeneficiaries}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Members with active trust status
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col border-primary/10 bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <CardTitle>Family Directory</CardTitle>
            </div>
            <CardDescription className="text-base">
              Explore the tribal lineage, connect with relatives, and view membership statuses across our community.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto pt-6">
            <Link href="/directory" className="w-full">
              <Button className="w-full justify-between group" variant="default">
                <span>Browse Directory</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col border-primary/10 bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <CardTitle>Legal Resources</CardTitle>
            </div>
            <CardDescription className="text-base">
              Access the tribal law library, federal Indian law resources, and foundational doctrines protecting our sovereignty.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto pt-6">
            <Link href="/legal" className="w-full">
              <Button className="w-full justify-between group" variant="default">
                <span>View Legal Resources</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col border-primary/10 bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <CardTitle>Community Forum</CardTitle>
            </div>
            <CardDescription className="text-base">
              Join discussions, ask questions, and share announcements with other tribal members.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto pt-6">
            <Link href="/forum" className="w-full">
              <Button className="w-full justify-between group" variant="default">
                <span>Join the Conversation</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col border-primary/10 bg-gradient-to-br from-primary/10 to-card border">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <CardTitle>AI Legal Guidance</CardTitle>
            </div>
            <CardDescription className="text-base">
              Ask questions about your tribal rights, ICWA protections, or trust status. Receive structured answers with citations.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto pt-6">
            <Link href="/guidance" className="w-full">
              <Button className="w-full justify-between group" variant="secondary">
                <span>Ask the AI Assistant</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
