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
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { classifyText } from "../../lib/doctrine";
import { runIntakeFilter } from "../../sovereign/intake-filter";
import { notifyComplaintFiled, notifyRedFlag } from "../../sovereign/notification-engine";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function findAvailableOfficer(): Promise<number | null> {
  const officers = await db.select().from(usersTable).where(eq(usersTable.role, "officer")).limit(1);
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
    const intakeFilter = runIntakeFilter(text);
    const officerId = await findAvailableOfficer();

    const [complaint] = await db
      .insert(complaintsTable)
      .values({
        text: text.substring(0, 10000),
        pdfPath: req.file ? req.file.originalname : undefined,
        classification: {
          ...classification,
          intakeFilter: {
            indianStatusViolation: intakeFilter.indianStatusViolation,
            redFlag: intakeFilter.redFlag,
            troRecommended: intakeFilter.troRecommended,
            nfrRecommended: intakeFilter.nfrRecommended,
            violations: intakeFilter.violations,
            doctrinesTriggered: intakeFilter.doctrinesTriggered,
            canonicalPosture: intakeFilter.canonicalPosture,
          },
        },
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
        title: `Complaint Follow-up #${complaint.id}${intakeFilter.redFlag ? " — RED FLAG" : ""}`,
        description: `Follow up on complaint regarding: ${classification.actionType} (${classification.landStatus})${intakeFilter.redFlag ? " | RED FLAG: " + intakeFilter.violations.join("; ") : ""}`,
        date: dueDate,
        type: intakeFilter.troRecommended ? "tro_hearing" : "complaint_followup",
        relatedId: complaint.id,
        relatedType: "complaint",
      })
      .returning();

    const [task] = await db
      .insert(tasksTable)
      .values({
        title: `Handle Complaint #${complaint.id}${intakeFilter.redFlag ? " — RED FLAG" : ""}`,
        description: `Review and respond to complaint. Actor: ${classification.actorType}, Land: ${classification.landStatus}, Action: ${classification.actionType}${intakeFilter.redFlag ? `\n\nRED FLAG: ${intakeFilter.violations.join("; ")}\nPosture: ${intakeFilter.canonicalPosture}` : ""}`,
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
      metadata: { classification, officerId, status: complaint.status, redFlag: intakeFilter.redFlag },
    });

    await notifyComplaintFiled({
      complaintId: complaint.id,
      officerId: officerId ?? undefined,
      classification,
      redFlag: intakeFilter.redFlag,
    });

    if (intakeFilter.redFlag && intakeFilter.violations.length > 0) {
      await notifyRedFlag({
        violations: intakeFilter.violations,
        relatedId: complaint.id,
        relatedType: "complaint",
      });
    }

    res.status(201).json({
      complaint,
      task,
      calendarEvent: calEvent,
      classification,
      officerId,
      intakeFilter,
    });
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

export default router;
