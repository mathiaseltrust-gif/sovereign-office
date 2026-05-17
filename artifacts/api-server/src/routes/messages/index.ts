import { Router } from "express";
import { db } from "@workspace/db";
import {
  messageThreadsTable,
  directMessagesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";
import {
  setPresence,
  getOnlineMemberIds,
  publishMessageEvent,
} from "../../lib/redis-memory";
import { registerSseClient } from "../../lib/sse-manager";
import { notifyNewDirectMessage } from "../../lib/notify";

const router = Router();

async function getOrCreateThread(userAId: number, userBId: number) {
  const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
  const existing = await db
    .select()
    .from(messageThreadsTable)
    .where(
      and(
        eq(messageThreadsTable.participantAId, a),
        eq(messageThreadsTable.participantBId, b),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(messageThreadsTable)
    .values({ participantAId: a, participantBId: b })
    .returning();
  return created;
}

router.get("/presence", requireAuth, async (req, res, next) => {
  try {
    const onlineIds = await getOnlineMemberIds();
    res.json({ onlineIds });
  } catch (err) {
    next(err);
  }
});

router.post("/presence/heartbeat", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "No user session" });
      return;
    }
    await setPresence(userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/threads", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const threads = await db
      .select()
      .from(messageThreadsTable)
      .where(
        or(
          eq(messageThreadsTable.participantAId, userId),
          eq(messageThreadsTable.participantBId, userId),
        ),
      )
      .orderBy(desc(messageThreadsTable.lastMessageAt));

    const enriched = await Promise.all(
      threads.map(async (t) => {
        const otherId =
          t.participantAId === userId ? t.participantBId : t.participantAId;
        const [otherUser] = await db
          .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, otherId))
          .limit(1);

        const [lastMsg] = await db
          .select()
          .from(directMessagesTable)
          .where(
            and(
              eq(directMessagesTable.threadId, t.id),
              isNull(directMessagesTable.deletedAt),
            ),
          )
          .orderBy(desc(directMessagesTable.createdAt))
          .limit(1);

        const unreadCount = await db
          .select()
          .from(directMessagesTable)
          .where(
            and(
              eq(directMessagesTable.threadId, t.id),
              eq(directMessagesTable.recipientId, userId),
              isNull(directMessagesTable.readAt),
              isNull(directMessagesTable.deletedAt),
            ),
          );

        return {
          ...t,
          otherUser,
          lastMessage: lastMsg ?? null,
          unreadCount: unreadCount.length,
        };
      }),
    );

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.get("/threads/:threadId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const threadId = parseInt(String(req.params.threadId), 10);
    const [thread] = await db
      .select()
      .from(messageThreadsTable)
      .where(eq(messageThreadsTable.id, threadId))
      .limit(1);

    if (!thread || (thread.participantAId !== userId && thread.participantBId !== userId)) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);

    const messages = await db
      .select()
      .from(directMessagesTable)
      .where(
        and(
          eq(directMessagesTable.threadId, threadId),
          isNull(directMessagesTable.deletedAt),
        ),
      )
      .orderBy(desc(directMessagesTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(messages.reverse());
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const senderId = req.user?.dbId;
    if (!senderId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { recipientId, content } = req.body as {
      recipientId: number;
      content: string;
    };
    if (!recipientId || !content?.trim()) {
      res.status(400).json({ error: "recipientId and content are required" });
      return;
    }
    if (content.length > 2000) {
      res.status(400).json({ error: "Message too long (max 2000 chars)" });
      return;
    }

    const [recipient] = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, recipientId))
      .limit(1);

    if (!recipient) {
      res.status(404).json({ error: "Recipient not found" });
      return;
    }

    const thread = await getOrCreateThread(senderId, recipientId);

    const [message] = await db
      .insert(directMessagesTable)
      .values({
        threadId: thread.id,
        senderId,
        recipientId,
        content: content.trim(),
      })
      .returning();

    await db
      .update(messageThreadsTable)
      .set({ lastMessageAt: new Date() })
      .where(eq(messageThreadsTable.id, thread.id));

    const event = {
      type: "new_message",
      message,
      threadId: thread.id,
    };
    await publishMessageEvent(recipientId, event);
    await publishMessageEvent(senderId, event);

    const [senderUser] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, senderId))
      .limit(1);

    void notifyNewDirectMessage({
      senderId,
      senderName: senderUser?.name ?? req.user?.name ?? "A member",
      recipientId,
      messageId: message.id,
      threadId: thread.id,
      preview: content.trim(),
    });

    logger.info({ senderId, recipientId, messageId: message.id }, "Direct message sent");
    res.status(201).json({ message, thread });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const messageId = parseInt(String(req.params.id), 10);
    const { content } = req.body as { content: string };
    if (!content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const [msg] = await db
      .select()
      .from(directMessagesTable)
      .where(eq(directMessagesTable.id, messageId))
      .limit(1);

    if (!msg || msg.senderId !== userId) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (msg.readAt) {
      res.status(409).json({ error: "Cannot edit a message that has been read" });
      return;
    }
    if (msg.deletedAt) {
      res.status(409).json({ error: "Message has been deleted" });
      return;
    }

    const [updated] = await db
      .update(directMessagesTable)
      .set({ content: content.trim(), editedAt: new Date() })
      .where(eq(directMessagesTable.id, messageId))
      .returning();

    const event = { type: "message_edited", message: updated, threadId: msg.threadId };
    await publishMessageEvent(msg.recipientId, event);
    await publishMessageEvent(msg.senderId, event);

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const messageId = parseInt(String(req.params.id), 10);

    const [msg] = await db
      .select()
      .from(directMessagesTable)
      .where(eq(directMessagesTable.id, messageId))
      .limit(1);

    if (!msg || msg.senderId !== userId) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (msg.readAt) {
      res.status(409).json({ error: "Cannot unsend a message that has been read" });
      return;
    }

    const [deleted] = await db
      .update(directMessagesTable)
      .set({ deletedAt: new Date() })
      .where(eq(directMessagesTable.id, messageId))
      .returning();

    const event = { type: "message_deleted", messageId, threadId: msg.threadId };
    await publishMessageEvent(msg.recipientId, event);
    await publishMessageEvent(msg.senderId, event);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const messageId = parseInt(String(req.params.id), 10);

    const [msg] = await db
      .select()
      .from(directMessagesTable)
      .where(
        and(
          eq(directMessagesTable.id, messageId),
          eq(directMessagesTable.recipientId, userId),
        ),
      )
      .limit(1);

    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (msg.readAt) {
      res.json({ ok: true });
      return;
    }

    const [updated] = await db
      .update(directMessagesTable)
      .set({ readAt: new Date() })
      .where(eq(directMessagesTable.id, messageId))
      .returning();

    const event = { type: "message_read", messageId, threadId: msg.threadId };
    await publishMessageEvent(msg.senderId, event);

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/sse", (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch { clearInterval(heartbeat); }
    }, 20000);

    const unregister = registerSseClient(userId, res);

    req.on("close", () => {
      clearInterval(heartbeat);
      unregister();
    });
  } catch (err) {
    next(err);
  }
});

router.get("/members-with-accounts", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const users = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.role, "member"));
    res.json(users.filter((u) => u.id !== userId));
  } catch (err) {
    next(err);
  }
});

export default router;
