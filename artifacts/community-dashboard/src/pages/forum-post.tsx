import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, MessageSquare, Pin } from "lucide-react";
import {
  useGetForumPost,
  getGetForumPostQueryKey,
  useCreateForumReply,
  usePinForumPost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function ForumPost() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const postId = parseInt(id ?? "0", 10);
  const [replyBody, setReplyBody] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useGetForumPost(postId, {
    query: { enabled: !!postId, queryKey: getGetForumPostQueryKey(postId) },
  });

  const createReply = useCreateForumReply({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetForumPostQueryKey(postId) });
        setReplyBody("");
        toast({ title: "Reply posted", description: "Your reply has been added to the thread." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to post reply.", variant: "destructive" });
      },
    },
  });

  const pinPost = usePinForumPost({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetForumPostQueryKey(postId) });
        toast({ title: "Updated", description: "Pin status updated." });
      },
    },
  });

  const handleReply = () => {
    if (!replyBody.trim()) return;
    createReply.mutate({ data: { body: replyBody }, params: { id: postId } });
  };

  const handlePin = () => {
    if (!post) return;
    pinPost.mutate({ data: { pinned: !post.pinned }, params: { id: postId } });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Thread not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/forum")} data-testid="button-back-to-forum">
          Back to Forum
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/forum")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Forum
        </Button>
      </div>

      {/* Main post */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {post.pinned && (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                )}
                {post.category && (
                  <Badge variant="outline" className="text-xs">{post.category}</Badge>
                )}
              </div>
              <CardTitle className="text-2xl font-bold leading-snug" data-testid="post-title">
                {post.title}
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePin}
              disabled={pinPost.isPending}
              data-testid="button-pin-post"
            >
              <Pin className="h-3.5 w-3.5 mr-1" />
              {post.pinned ? "Unpin" : "Pin"}
            </Button>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Posted by <span className="font-medium text-foreground">{post.authorName ?? "Community Member"}</span>
            {" · "}
            {formatDate(post.createdAt)}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap" data-testid="post-body">{post.body}</p>
        </CardContent>
      </Card>

      {/* Replies */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          {post.replyCount} {post.replyCount === 1 ? "Reply" : "Replies"}
        </h2>

        {post.replies && post.replies.length > 0 ? (
          post.replies.map((reply) => (
            <Card key={reply.id} className="border-border/60" data-testid={`card-reply-${reply.id}`}>
              <CardContent className="py-4 px-5">
                <div className="text-sm text-muted-foreground mb-2">
                  <span className="font-medium text-foreground">{reply.authorName ?? "Community Member"}</span>
                  {" · "}
                  {formatDate(reply.createdAt)}
                </div>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{reply.body}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="py-8 text-center border-dashed">
            <CardContent>
              <p className="text-sm text-muted-foreground">No replies yet. Be the first to respond.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reply form */}
      <Card className="border-primary/20">
        <CardContent className="pt-5 space-y-3">
          <h3 className="font-medium">Add a Reply</h3>
          <Textarea
            placeholder="Write your reply..."
            rows={4}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            data-testid="input-reply-body"
          />
          <Button
            onClick={handleReply}
            disabled={!replyBody.trim() || createReply.isPending}
            data-testid="button-submit-reply"
          >
            {createReply.isPending ? "Posting..." : "Post Reply"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
