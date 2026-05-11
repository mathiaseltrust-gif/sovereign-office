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
  ArrowRight,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetCommunityDirectoryStats } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/activity-feed";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetCommunityDirectoryStats();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-primary">Community Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Welcome to the Mathias El Tribe community portal. Connect with family, access resources, and join discussions.
        </p>
      </div>

      {/* Stats row */}
      {isLoading || !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
              <CardTitle className="text-xs font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="text-2xl md:text-3xl font-bold text-primary">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.activeMembers} active</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
              <CardTitle className="text-xs font-medium">Pending Review</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="text-2xl md:text-3xl font-bold text-primary">{stats.pendingReview}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting verification</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
              <CardTitle className="text-xs font-medium">ICWA Eligible</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="text-2xl md:text-3xl font-bold text-primary">{stats.icwaEligible}</div>
              <p className="text-xs text-muted-foreground mt-1">Children protected</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-4">
              <CardTitle className="text-xs font-medium">Trust Beneficiaries</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="text-2xl md:text-3xl font-bold text-primary">{stats.trustBeneficiaries}</div>
              <p className="text-xs text-muted-foreground mt-1">Active trust status</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section cards — left column (2/3 width) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="flex flex-col border-primary/10 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <CardTitle className="text-base">Family Directory</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Explore the tribal lineage, connect with relatives, and view membership statuses.
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto pt-4">
              <Link href="/directory" className="w-full">
                <Button className="w-full justify-between group" variant="default" size="sm">
                  <span>Browse Directory</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/10 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                </div>
                <CardTitle className="text-base">Legal Resources</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Access the tribal law library, federal Indian law, and sovereignty doctrines.
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto pt-4">
              <Link href="/legal" className="w-full">
                <Button className="w-full justify-between group" variant="default" size="sm">
                  <span>View Resources</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/10 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <CardTitle className="text-base">Community Forum</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Join discussions, ask questions, and share announcements with tribal members.
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto pt-4">
              <Link href="/forum" className="w-full">
                <Button className="w-full justify-between group" variant="default" size="sm">
                  <span>Join the Conversation</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/10 bg-gradient-to-br from-primary/10 to-card border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                  <Activity className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <CardTitle className="text-base">AI Legal Guidance</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Ask about your tribal rights, ICWA protections, or trust status. Get cited answers.
              </CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto pt-4">
              <Link href="/guidance" className="w-full">
                <Button className="w-full justify-between group" variant="secondary" size="sm">
                  <span>Ask the AI Assistant</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Admin card */}
          <Card className="sm:col-span-2 flex flex-col border-dashed border-primary/20 bg-muted/20">
            <CardContent className="flex items-center justify-between gap-4 py-4 px-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Admin Panel</p>
                  <p className="text-xs text-muted-foreground">Add members, post announcements, manage law library</p>
                </div>
              </div>
              <Link href="/admin">
                <Button variant="outline" size="sm" className="shrink-0">Open Admin</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Activity feed — right column (1/3 width) */}
        <div className="lg:col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
