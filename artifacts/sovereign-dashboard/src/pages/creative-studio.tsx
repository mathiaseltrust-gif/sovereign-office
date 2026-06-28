import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  Image,
  Layers3,
  LibraryBig,
  Palette,
  PenLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";

function getCreatorContext(user: ReturnType<typeof useAuth>["user"], activeRole?: string | null) {
  const roles = user?.roles ?? [];
  const firstName = user?.name?.split(" ")[0] || "Creator";
  const normalized = roles.map(role => role.toLowerCase());

  if (normalized.some(role => ["sovereign_admin", "admin", "chief_justice"].includes(role))) {
    return {
      greeting: `Ready to create, Chief ${firstName}.`,
      authority: "Chief Authority",
      role: activeRole || "Trustee / Publisher / Educator",
    };
  }

  if (normalized.includes("trustee")) {
    return {
      greeting: `Ready to build, Trustee ${firstName}.`,
      authority: "Trustee Authority",
      role: activeRole || "Trustee / Creator",
    };
  }

  if (normalized.includes("teacher") || normalized.includes("educator")) {
    return {
      greeting: `Ready to build lessons, ${firstName}.`,
      authority: "Educator Access",
      role: activeRole || "Educator / Creator",
    };
  }

  return {
    greeting: `Ready to create, ${firstName}.`,
    authority: "Member Creator Access",
    role: activeRole || "Creator",
  };
}

const createOptions = [
  {
    title: "Comic",
    description: "Create issues, scenes, pages, panels, dialogue, and publishing-ready comic packages.",
    icon: Palette,
    href: "/creative-studio/projects/new?type=comic",
    status: "MVP",
  },
  {
    title: "SDU Course",
    description: "Build modules, lessons, readings, activities, reflections, and course materials.",
    icon: GraduationCap,
    href: "/creative-studio/projects/new?type=course",
    status: "Planned",
  },
  {
    title: "Book / Handbook",
    description: "Draft books, handbooks, guides, source notes, editions, and publication records.",
    icon: BookOpen,
    href: "/creative-studio/projects/new?type=book",
    status: "Planned",
  },
  {
    title: "Business Canvas",
    description: "Create businesses, programs, initiatives, organizations, and project plans.",
    icon: BriefcaseBusiness,
    href: "/business-canvas",
    status: "Available",
  },
  {
    title: "Document",
    description: "Create structured documents, drafts, packets, worksheets, and public-facing materials.",
    icon: FileText,
    href: "/drafts",
    status: "Available",
  },
  {
    title: "Universe / Story Bible",
    description: "Define universes, canons, characters, organizations, institutions, timelines, and story rules.",
    icon: Layers3,
    href: "/creative-studio/projects/new?type=universe",
    status: "Planned",
  },
];

const continueProjects = [
  {
    title: "McCaster Issue #1",
    type: "Comic Project",
    status: "Draft setup",
    description: "Start the first flagship comic project with story, scenes, pages, characters, assets, and publishing preview.",
    href: "/creative-studio/projects/mccaster-issue-001",
  },
  {
    title: "Reclaiming Personal Sovereignty",
    type: "Book / SDU Material",
    status: "Backlog",
    description: "Prepare book, course, and archive structure for the publishing core and SDU reuse.",
    href: "/creative-studio/projects/reclaiming-personal-sovereignty",
  },
  {
    title: "Knowledge of Self Lesson",
    type: "SDU Lesson",
    status: "Backlog",
    description: "Convert identity restoration and remembrance material into a teachable SDU lesson module.",
    href: "/creative-studio/projects/knowledge-of-self-lesson-001",
  },
];

const libraryItems = [
  "Stories",
  "Scenes",
  "Characters",
  "Universes",
  "Assets",
  "Templates",
  "Canons",
  "Publications",
];

export default function CreativeStudioPage() {
  const { user, activeRole } = useAuth();
  const [, navigate] = useLocation();
  const context = getCreatorContext(user, activeRole);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-4 md:p-8">
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-primary/10 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Creative Studio
              </Badge>
              <Badge variant="outline">{context.authority}</Badge>
              <Badge variant="outline">{context.role}</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{context.greeting}</h1>
              <p className="mt-3 max-w-3xl text-muted-foreground md:text-lg">
                Turn ideas into comics, books, lessons, businesses, publications, and reusable creative projects.
                Companion supplies context. Creative Studio turns that context into structured creation.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate("/creative-studio/projects/mccaster-issue-001")}>
                Open McCaster Issue #1 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/business-canvas")}>
                Open Business Canvas
              </Button>
            </div>
          </div>
          <Card className="w-full max-w-md bg-background/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wand2 className="h-4 w-4" /> AI Director
              </CardTitle>
              <CardDescription>
                The AI Director assists with story, course, business, publishing, and canon decisions while the creator remains in control.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Expand a story beat into scenes.</p>
              <p>• Convert a comic into an SDU lesson.</p>
              <p>• Check continuity and publishing readiness.</p>
              <p>• Help decide what should be archived.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Continue Creating</CardTitle>
            <CardDescription>Active creative projects and proof-of-use workspaces.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {continueProjects.map(project => (
              <Link key={project.title} href={project.href}>
                <Card className="cursor-pointer transition-colors hover:border-primary">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{project.title}</h3>
                        <Badge variant="outline">{project.type}</Badge>
                        <Badge variant="secondary">{project.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                    </div>
                    <ArrowRight className="hidden h-5 w-5 text-muted-foreground md:block" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Creative Library</CardTitle>
            <CardDescription>Reusable registries that power every project.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {libraryItems.map(item => (
              <Button key={item} variant="outline" className="justify-start" onClick={() => navigate(`/creative-studio/library/${item.toLowerCase()}`)}>
                <LibraryBig className="mr-2 h-4 w-4" /> {item}
              </Button>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Create Something New</h2>
            <p className="text-sm text-muted-foreground">Choose a project type. The workspace adapts to what you are creating.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {createOptions.map(option => {
            const Icon = option.icon;
            return (
              <Link key={option.title} href={option.href}>
                <Card className="h-full cursor-pointer transition-colors hover:border-primary">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <Badge variant={option.status === "Available" ? "default" : option.status === "MVP" ? "secondary" : "outline"}>
                        {option.status}
                      </Badge>
                    </div>
                    <CardTitle>{option.title}</CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><PenLine className="h-4 w-4" /> Develop</CardTitle>
            <CardDescription>Stories, scenes, lessons, organizations, and project plans.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Image className="h-4 w-4" /> Produce</CardTitle>
            <CardDescription>Pages, layouts, artwork, assets, source files, and media packages.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><LibraryBig className="h-4 w-4" /> Publish & Archive</CardTitle>
            <CardDescription>Soft publish, release, document archive, reader library, and SDU reuse.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
