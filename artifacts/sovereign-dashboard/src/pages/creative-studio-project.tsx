import { Link } from "wouter";
import {
  Archive,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronRight,
  FileText,
  Images,
  Layers3,
  MessageSquareText,
  PanelTop,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const project = {
  title: "McCaster Issue #1",
  type: "Comic Project",
  universe: "McCaster Universe",
  status: "Draft setup",
  purpose: "Create the first flagship comic issue inside Creative Studio and prove the workflow from story to publication.",
  nextAction: "Define the opening scene and generate the first page plan.",
};

const scenes = [
  {
    title: "Scene 1 — The Pressure",
    purpose: "Open the issue with the weight McCaster carries before stepping into conscious authorship.",
    status: "Ready to develop",
  },
  {
    title: "Scene 2 — The Question",
    purpose: "Introduce the question that begins the transformation: who am I, where do I come from, and what must I remember?",
    status: "Needs draft",
  },
  {
    title: "Scene 3 — The Counterspell",
    purpose: "Show knowledge of self as an active counter-force against confusion, erasure, and misdirection.",
    status: "Backlog",
  },
];

const pagePlan = [
  { page: "Page 1", layout: "Full-page pressure / opening splash", status: "Plan" },
  { page: "Page 2", layout: "3-panel transition into the question", status: "Draft" },
  { page: "Page 3", layout: "Teaching moment / memory flash", status: "Backlog" },
];

const projectNav = [
  { label: "Overview", icon: Layers3 },
  { label: "Story", icon: BookOpen },
  { label: "Scenes", icon: MessageSquareText },
  { label: "Pages", icon: PanelTop },
  { label: "Characters", icon: Users },
  { label: "Assets", icon: Images },
  { label: "AI Director", icon: Sparkles },
  { label: "Publish", icon: Archive },
];

export default function CreativeStudioProjectPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/creative-studio" className="hover:text-foreground">Creative Studio</Link>
            <ChevronRight className="h-4 w-4" />
            <span>{project.title}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{project.title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{project.purpose}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{project.type}</Badge>
          <Badge variant="outline">{project.universe}</Badge>
          <Badge>{project.status}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Project Navigator</CardTitle>
            <CardDescription>One workspace, many creation modes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {projectNav.map(item => {
              const Icon = item.icon;
              return (
                <Button key={item.label} variant="ghost" className="w-full justify-start">
                  <Icon className="mr-2 h-4 w-4" /> {item.label}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">Next creative action</p>
                <p className="text-sm text-muted-foreground">{project.nextAction}</p>
              </div>
              <Button>
                Start Scene 1 <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="story">Story</TabsTrigger>
              <TabsTrigger value="scenes">Scenes</TabsTrigger>
              <TabsTrigger value="pages">Pages</TabsTrigger>
              <TabsTrigger value="publish">Publish</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Story Core</CardTitle>
                  <CardDescription>Theme, purpose, takeaway, and issue arc.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Begin with the story before panels. The comic engine should never outrun the purpose of the issue.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4" /> Reusable Registries</CardTitle>
                  <CardDescription>Characters, assets, canon, scenes, and publications.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  This issue references registry objects instead of duplicating them.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4" /> Proof Target</CardTitle>
                  <CardDescription>Create, review, soft-publish, archive.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  McCaster Issue #1 proves Creative Studio, Publishing Core, and SDU reuse can work together.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="story">
              <Card>
                <CardHeader>
                  <CardTitle>Story Bible</CardTitle>
                  <CardDescription>Draft the issue-level story structure.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {[
                    ["Core Theme", "Knowledge of self as a counterspell."],
                    ["Reader Takeaway", "Remembering who you are changes what you can build."],
                    ["Opening", "Pressure, confusion, and the world trying to define McCaster."],
                    ["Resolution", "McCaster chooses conscious authorship and steps toward the next question."],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-2 text-sm">{value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scenes" className="space-y-3">
              {scenes.map(scene => (
                <Card key={scene.title}>
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{scene.title}</h3>
                        <Badge variant="outline">{scene.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{scene.purpose}</p>
                    </div>
                    <Button variant="outline">Open Scene</Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="pages" className="space-y-3">
              {pagePlan.map(page => (
                <Card key={page.page}>
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{page.page}</h3>
                        <Badge variant="secondary">{page.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{page.layout}</p>
                    </div>
                    <Button variant="outline">Open Page</Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="publish">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Publishing Path</CardTitle>
                  <CardDescription>Draft → soft publish → review → release → archive.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4">
                  {[
                    "Draft source",
                    "Soft preview",
                    "Publication record",
                    "Document archive",
                  ].map(item => (
                    <div key={item} className="rounded-xl border p-4 text-sm font-medium">{item}</div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
