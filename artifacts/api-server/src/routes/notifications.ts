import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { requireAuth } from "../auth/entra-guard";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId ?? null;

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(userId ? eq(notificationsTable.userId, userId) : isNull(notificationsTable.userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    const broadcasts = await db
      .select()
      .from(notificationsTable)
      .where(isNull(notificationsTable.userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(20);

    const allNotifications = userId
      ? [...rows, ...broadcasts.filter((b) => !rows.find((r) => r.id === b.id))].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
      : rows;

    res.json(allNotifications);
  } catch (err) {
    next(err);
  }
});

router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId ?? null;

    const userUnread = userId
      ? await db
          .select()
          .from(notificationsTable)
          .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)))
      : [];

    const broadcastUnread = await db
      .select()
      .from(notificationsTable)
      .where(and(isNull(notificationsTable.userId), eq(notificationsTable.read, false)))
      .limit(100);

    res.json({ count: userUnread.length + broadcastUnread.length });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/read-all", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId ?? null;
    if (userId) {
      await db
        .update(notificationsTable)
        .set({ read: true })
        .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));
    }
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(isNull(notificationsTable.userId), eq(notificationsTable.read, false)));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const userRoles: string[] = req.user?.roles ?? [];
    const isAdmin = userRoles.includes("admin") || userRoles.includes("trustee");
    if (!isAdmin) {
      res.status(403).json({ error: "Only admin or trustee may create system notifications" });
      return;
    }

    const { title, message, category, severity, relatedId, relatedType, redFlag, troFlag } = req.body as {
      title: string;
      message: string;
      category: string;
      severity?: string;
      relatedId?: number;
      relatedType?: string;
      redFlag?: boolean;
      troFlag?: boolean;
    };

    if (!title || !message || !category) {
      res.status(400).json({ error: "title, message, and category are required" });
      return;
    }

    const [created] = await db
      .insert(notificationsTable)
      .values({
        userId: null,
        channel: "dashboard",
        category,
        title,
        message,
        severity: severity ?? "info",
        relatedId: relatedId ?? null,
        relatedType: relatedType ?? null,
        redFlag: redFlag ?? false,
        troFlag: troFlag ?? false,
        read: false,
        metadata: {},
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
