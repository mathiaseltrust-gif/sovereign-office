import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, description, dueDate, assignedTo, complaintId, nfrId } = req.body as {
      title: string;
      description?: string;
      dueDate?: string;
      assignedTo?: number;
      complaintId?: number;
      nfrId?: number;
    };

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const [created] = await db
      .insert(tasksTable)
      .values({
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: "pending",
        assignedTo,
        complaintId,
        nfrId,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, description, status, dueDate, assignedTo } = req.body as Partial<{
      title: string;
      description: string;
      status: string;
      dueDate: string;
      assignedTo: number;
    }>;

    const existing = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const updated = await db
      .update(tasksTable)
      .set({
        title: title ?? existing[0].title,
        description: description ?? existing[0].description,
        status: status ?? existing[0].status,
        dueDate: dueDate ? new Date(dueDate) : existing[0].dueDate,
        assignedTo: assignedTo ?? existing[0].assignedTo,
        updatedAt: new Date(),
      })
      .where(eq(tasksTable.id, id))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
