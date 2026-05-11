import { useState } from "react";
import { Link } from "wouter";
import { MessageSquare, Pin, Plus, ChevronRight, Tag } from "lucide-react";
import {
  useListForumPosts,
  useCreateForumPost,
  getListForumPostsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["General", "Announcements", "ICWA", "Legal", "Health", "Land", "Culture", "Youth"];

interface NewPostForm {
  title: string;
  body: string;
  category: string;
}

export default function Forum() {
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useListForumPosts(
    categoryFilter ? { category: categoryFilter } : undefined
  );

  const createPost = useCreateForumPost({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListForumPostsQueryKey() });
        setOpen(false);
        toast({ title: "Thread posted", description: "Your discussion thread has been created." });
        reset();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create thread. Please try again.", variant: "destructive" });
      },
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewPostForm>({
    defaultValues: { title: "", body: "", category: "General" },
  });

  const onSubmit = (data: NewPostForm) => {
    createPost.mutate({ data: { title: data.title, body: data.body, category: data.category } });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-primary">Community Forum</h1>
          <p className="text-muted-foreground mt-1">Discussions, announcements, and community voices.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-new-thread">
              <Plus className="h-4 w-4" />
              New Thread
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Start a New Discussion</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Title</label>
                <Input
                  data-testid="input-post-title"
                  placeholder="What would you like to discuss?"
                  {...register("title", { required: "Title is required" })}
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <label key={cat} className="cursor-pointer">
                      <input type="radio" value={cat} className="sr-only" {...register("category")} />
                    </label>
                  ))}
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    data-testid="select-post-category"
                    {...register("category")}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  data-testid="input-post-body"
                  placeholder="Share your thoughts, questions, or announcements..."
                  rows={5}
                  {...register("body", { required: "Message is required" })}
                />
                {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={createPost.isPending} data-testid="button-submit-post">
                {createPost.isPending ? "Posting..." : "Post Thread"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2" data-testid="forum-category-filters">
        <button
          onClick={() => setCategoryFilter(undefined)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
            !categoryFilter
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:border-primary/50"
          }`}
          data-testid="filter-all"
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? undefined : cat)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
              categoryFilter === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
            data-testid={`filter-${cat.toLowerCase()}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent>
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">No threads yet.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Be the first to start a conversation.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/forum/${post.id}`}>
              <Card
                className="cursor-pointer hover:border-primary/40 transition-all hover:shadow-sm group"
                data-testid={`card-post-${post.id}`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {post.pinned && (
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <Pin className="h-3 w-3" /> Pinned
                          </span>
                        )}
                        {post.category && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 py-0">
                            <Tag className="h-2.5 w-2.5" />
                            {post.category}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.body}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span>by {post.authorName ?? "Community Member"}</span>
                    <span>{formatDate(post.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
