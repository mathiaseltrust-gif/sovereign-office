import { Router } from "express";
import { db } from "@workspace/db";
import { forumPostsTable, familyLineageTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const [recentPosts, recentMembers] = await Promise.all([
      db.select({
        id: forumPostsTable.id,
        title: forumPostsTable.title,
        category: forumPostsTable.category,
        authorName: forumPostsTable.authorName,
        pinned: forumPostsTable.pinned,
        replyCount: forumPostsTable.replyCount,
        createdAt: forumPostsTable.createdAt,
      }).from(forumPostsTable).orderBy(desc(forumPostsTable.createdAt)).limit(8),

      db.select({
        id: familyLineageTable.id,
        fullName: familyLineageTable.fullName,
        tribalNation: familyLineageTable.tribalNation,
        membershipStatus: familyLineageTable.membershipStatus,
        isAncestor: familyLineageTable.isAncestor,
        pendingReview: familyLineageTable.pendingReview,
        createdAt: familyLineageTable.createdAt,
      }).from(familyLineageTable).orderBy(desc(familyLineageTable.createdAt)).limit(5),
    ]);

    const events = [
      ...recentPosts.map((p) => ({
        type: "forum" as const,
        id: p.id,
        title: p.title,
        subtitle: p.category ?? "General",
        meta: p.authorName ?? "Community Member",
        pinned: p.pinned,
        replyCount: p.replyCount,
        createdAt: p.createdAt.toISOString(),
      })),
      ...recentMembers.map((m) => ({
        type: "member" as const,
        id: m.id,
        title: m.fullName,
        subtitle: m.isAncestor ? "Ancestor" : m.pendingReview ? "Pending Review" : "Active Member",
        meta: m.tribalNation ?? "Mathias El Tribe",
        pinned: false,
        replyCount: 0,
        createdAt: m.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    res.json(events);
  } catch (err) {
    next(err);
  }
});

export default router;
