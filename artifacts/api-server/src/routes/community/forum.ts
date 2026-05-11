import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { forumPostsTable, forumRepliesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const category = req.query.category as string | undefined;
    const pinned = req.query.pinned === "true" ? true : req.query.pinned === "false" ? false : undefined;

    let rows = await db.select().from(forumPostsTable).orderBy(desc(forumPostsTable.pinned), desc(forumPostsTable.createdAt));

    if (category) {
      rows = rows.filter((r) => r.category === category);
    }
    if (pinned !== undefined) {
      rows = rows.filter((r) => r.pinned === pinned);
    }

    res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        category: r.category,
        authorId: r.authorId,
        authorName: r.authorName,
        pinned: r.pinned,
        replyCount: r.replyCount,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, body, category } = req.body as { title?: string; body?: string; category?: string };
    if (!title || !body) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    const authorName = req.user?.name ?? "Community Member";
    const authorId = req.user?.dbId ?? null;

    const [post] = await db
      .insert(forumPostsTable)
      .values({ title, body, category: category ?? null, authorId, authorName, pinned: false, replyCount: 0 })
      .returning();

    res.status(201).json({
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      authorId: post.authorId,
      authorName: post.authorName,
      pinned: post.pinned,
      replyCount: post.replyCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [post] = await db.select().from(forumPostsTable).where(eq(forumPostsTable.id, id)).limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const replies = await db
      .select()
      .from(forumRepliesTable)
      .where(eq(forumRepliesTable.postId, id))
      .orderBy(forumRepliesTable.createdAt);

    res.json({
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      authorId: post.authorId,
      authorName: post.authorName,
      pinned: post.pinned,
      replyCount: post.replyCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      replies: replies.map((r) => ({
        id: r.id,
        postId: r.postId,
        body: r.body,
        authorId: r.authorId,
        authorName: r.authorName,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/replies", requireAuth, async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      res.status(400).json({ error: "Invalid post ID" });
      return;
    }

    const { body } = req.body as { body?: string };
    if (!body) {
      res.status(400).json({ error: "body is required" });
      return;
    }

    const [post] = await db.select().from(forumPostsTable).where(eq(forumPostsTable.id, postId)).limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const authorName = req.user?.name ?? "Community Member";
    const authorId = req.user?.dbId ?? null;

    const [reply] = await db
      .insert(forumRepliesTable)
      .values({ postId, body, authorId, authorName })
      .returning();

    await db
      .update(forumPostsTable)
      .set({ replyCount: sql`${forumPostsTable.replyCount} + 1`, updatedAt: new Date() })
      .where(eq(forumPostsTable.id, postId));

    res.status(201).json({
      id: reply.id,
      postId: reply.postId,
      body: reply.body,
      authorId: reply.authorId,
      authorName: reply.authorName,
      createdAt: reply.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/pin", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { pinned } = req.body as { pinned?: boolean };
    if (typeof pinned !== "boolean") {
      res.status(400).json({ error: "pinned (boolean) is required" });
      return;
    }

    const [post] = await db
      .update(forumPostsTable)
      .set({ pinned, updatedAt: new Date() })
      .where(eq(forumPostsTable.id, id))
      .returning();

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json({
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      authorId: post.authorId,
      authorName: post.authorName,
      pinned: post.pinned,
      replyCount: post.replyCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
