import { Router } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable, importantDatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATE_TYPE_EMOJI: Record<string, string> = {
  birthday:    "🎂",
  wedding:     "💍",
  adoption:    "🤝",
  anniversary: "🌹",
  memorial:    "🕯️",
  custom:      "⭐",
};

function getDateTypeLabel(dateType: string, customLabel?: string | null): string {
  if (dateType === "custom" && customLabel) return customLabel;
  const labels: Record<string, string> = {
    birthday:    "Birthday",
    wedding:     "Wedding Anniversary",
    adoption:    "Adoption Day",
    anniversary: "Anniversary",
    memorial:    "Memorial Day",
    custom:      "Important Date",
  };
  return labels[dateType] ?? dateType;
}

// ── GET /calendar — merged regular events + recurring important dates ──────────
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const [events, importantDates] = await Promise.all([
      db.select().from(calendarEventsTable).orderBy(calendarEventsTable.date),
      db.select().from(importantDatesTable).orderBy(importantDatesTable.personName),
    ]);

    const now = new Date();
    const syntheticEvents = importantDates.flatMap(d => {
      const emoji = DATE_TYPE_EMOJI[d.dateType] ?? "⭐";
      const label = getDateTypeLabel(d.dateType, d.customLabel);
      const title = `${emoji} ${d.personName}${d.relation ? ` (${d.relation})` : ""} — ${label}`;
      const desc = d.year ? `Since ${d.year}${d.notes ? " · " + d.notes : ""}` : (d.notes ?? null);

      return [
        {
          id: 100000 + d.id,
          title,
          description: desc,
          date: new Date(now.getFullYear(), d.month - 1, d.day),
          type: "important_date",
          relatedId: d.id,
          relatedType: d.dateType,
          createdAt: d.createdAt,
        },
        {
          id: 200000 + d.id,
          title,
          description: desc,
          date: new Date(now.getFullYear() + 1, d.month - 1, d.day),
          type: "important_date",
          relatedId: d.id,
          relatedType: d.dateType,
          createdAt: d.createdAt,
        },
      ];
    });

    res.json([...events, ...syntheticEvents]);
  } catch (err) {
    next(err);
  }
});

// ── GET /calendar/important-dates — raw list ──────────────────────────────────
router.get("/important-dates", requireAuth, async (_req, res, next) => {
  try {
    const dates = await db.select().from(importantDatesTable).orderBy(importantDatesTable.personName);
    res.json(dates);
  } catch (err) {
    next(err);
  }
});

// ── POST /calendar/important-dates — save immediately to DB ───────────────────
router.post("/important-dates", requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    const { personName, relation, dateType, month, day, year, customLabel, notes } = req.body as {
      personName: string;
      relation?: string;
      dateType?: string;
      month: number;
      day: number;
      year?: number;
      customLabel?: string;
      notes?: string;
    };

    if (!personName || !month || !day) {
      res.status(400).json({ error: "personName, month, and day are required" });
      return;
    }

    const [created] = await db
      .insert(importantDatesTable)
      .values({
        personName,
        relation: relation ?? null,
        dateType: dateType ?? "birthday",
        month,
        day,
        year: year ?? null,
        customLabel: customLabel ?? null,
        notes: notes ?? null,
        addedByUserId: user?.dbId ?? null,
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /calendar/important-dates/:id ──────────────────────────────────────
router.delete("/important-dates/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(importantDatesTable).where(eq(importantDatesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /calendar/:id ─────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "Calendar event not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

// ── POST /calendar ─────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, description, date, type, relatedId, relatedType } = req.body as {
      title: string;
      description?: string;
      date: string;
      type?: string;
      relatedId?: number;
      relatedType?: string;
    };

    if (!title || !date) {
      res.status(400).json({ error: "title and date are required" });
      return;
    }

    const [created] = await db
      .insert(calendarEventsTable)
      .values({
        title,
        description,
        date: new Date(date),
        type: type ?? "general",
        relatedId,
        relatedType,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── PUT /calendar/:id ─────────────────────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, description, date, type } = req.body as Partial<{
      title: string;
      description: string;
      date: string;
      type: string;
    }>;

    const existing = await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Calendar event not found" });
      return;
    }
    const updated = await db
      .update(calendarEventsTable)
      .set({
        title: title ?? existing[0].title,
        description: description ?? existing[0].description,
        date: date ? new Date(date) : existing[0].date,
        type: type ?? existing[0].type,
      })
      .where(eq(calendarEventsTable.id, id))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /calendar/:id ──────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
