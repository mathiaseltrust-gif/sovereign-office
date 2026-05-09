import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import {
  complaintsTable,
  tasksTable,
  calendarEventsTable,
  usersTable,
  searchIndexTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { classifyText } from "../../lib/doctrine";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function findAvailableOfficer(): Promise<number | null> {
  const officers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "officer"))
    .limit(1);
  return officers[0]?.id ?? null;
}

router.post("/", requireAuth, upload.single("pdf"), async (req, res, next) => {
  try {
    const text: string =
      req.body.text ?? (req.file ? `[PDF: ${req.file.originalname}]` : "");

    if (!text.trim()) {
      res.status(400).json({ error: "Provide complaint text or a PDF file" });
      return;
    }

    const classification = classifyText(text);
    const officerId = await findAvailableOfficer();

    const [complaint] = await db
      .insert(complaintsTable)
      .values({
        text: text.substring(0, 10000),
        pdfPath: req.file ? req.file.originalname : undefined,
        classification,
        officerId: officerId ?? undefined,
        status: "open",
      })
      .returning();

    if (!complaint) {
      res.status(500).json({ error: "Failed to create complaint" });
      return;
    }

    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [calEvent] = await db
      .insert(calendarEventsTable)
      .values({
        title: `Complaint Follow-up #${complaint.id}`,
        description: `Follow up on complaint regarding: ${classification.actionType} (${classification.landStatus})`,
        date: dueDate,
        type: "complaint_followup",
        relatedId: complaint.id,
        relatedType: "complaint",
      })
      .returning();

    const [task] = await db
      .insert(tasksTable)
      .values({
        title: `Handle Complaint #${complaint.id}`,
        description: `Review and respond to complaint. Actor: ${classification.actorType}, Land: ${classification.landStatus}, Action: ${classification.actionType}`,
        dueDate,
        status: "pending",
        assignedTo: officerId ?? undefined,
        complaintId: complaint.id,
        calendarEventId: calEvent?.id,
      })
      .returning();

    await db.insert(searchIndexTable).values({
      entityType: "complaint",
      entityId: String(complaint.id),
      content: `${text.substring(0, 500)} ${classification.actorType} ${classification.landStatus} ${classification.actionType}`,
      metadata: { classification, officerId, status: complaint.status },
    });

    res.status(201).json({ complaint, task, calendarEvent: calEvent, classification, officerId });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, requireRole("officer"), async (_req, res, next) => {
  try {
    const complaints = await db.select().from(complaintsTable).orderBy(complaintsTable.createdAt);
    res.json(complaints);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, officerId } = req.body as { status?: string; officerId?: number };
    const updates: Partial<{ status: string; officerId: number; updatedAt: Date }> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (officerId) updates.officerId = officerId;
    const updated = await db.update(complaintsTable).set(updates).where(eq(complaintsTable.id, id)).returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

void and;

export default router;
