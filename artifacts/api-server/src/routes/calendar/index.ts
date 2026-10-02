import { Router } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable, importantDatesTable, familyLineageTable, profileVaultTable } from "@workspace/db";
import { eq, isNotNull, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { hasRole } from "../../engines/authority";

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
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId ?? null;
    const canSeeInstitutionalCalendar = hasRole(req.user?.roles ?? [], "officer");
    const [events, importantDates] = await Promise.all([
      canSeeInstitutionalCalendar
        ? db.select().from(calendarEventsTable).orderBy(calendarEventsTable.date)
        : Promise.resolve([]),
      userId
        ? db.select().from(importantDatesTable)
            .where(eq(importantDatesTable.addedByUserId, userId))
            .orderBy(importantDatesTable.personName)
        : Promise.resolve([]),
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
router.get("/important-dates", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) { res.json([]); return; }
    const dates = await db.select().from(importantDatesTable)
      .where(eq(importantDatesTable.addedByUserId, userId))
      .orderBy(importantDatesTable.personName);
    res.json(dates);
  } catch (err) {
    next(err);
  }
});

// ── GET /calendar/suggested-dates — auto-extracted from profile + family tree ──
router.get("/suggested-dates", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const suggestions: Array<{
      sourceKey: string;
      type: string;
      personName: string;
      relation: string | null;
      year: number | null;
      month: number | null;
      day: number | null;
      partial: boolean;
      source: string;
    }> = [];

    const [vault, lineageRows, existingDates] = await Promise.all([
      db.select().from(profileVaultTable).where(eq(profileVaultTable.userId, userId)).limit(1),
      db.select({
        id: familyLineageTable.id,
        fullName: familyLineageTable.fullName,
        birthYear: familyLineageTable.birthYear,
        deathYear: familyLineageTable.deathYear,
        isDeceased: familyLineageTable.isDeceased,
        notes: familyLineageTable.notes,
      }).from(familyLineageTable).where(eq(familyLineageTable.addedByMemberId, userId)),
      db.select({ sourceKey: importantDatesTable.sourceKey })
        .from(importantDatesTable)
        .where(and(
          isNotNull(importantDatesTable.sourceKey),
          eq(importantDatesTable.addedByUserId, userId),
        )),
    ]);

    const addedKeys = new Set(existingDates.map(e => e.sourceKey).filter(Boolean) as string[]);

    // ── Own birthday from profile vault ──
    const dob = vault[0]?.dateOfBirth;
    if (dob) {
      const parts = dob.split("-");
      const dobKey = `profile_vault:${userId}:birthday`;
      if (parts.length >= 3 && !addedKeys.has(dobKey)) {
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10);
        const dy = parseInt(parts[2], 10);
        if (!isNaN(yr) && !isNaN(mo) && !isNaN(dy)) {
          suggestions.push({ sourceKey: dobKey, type: "birthday", personName: "Yourself", relation: "Self", year: yr, month: mo, day: dy, partial: false, source: "profile_vault" });
        }
      }
    }

    // ── Family lineage entries ──
    for (const row of lineageRows) {
      // Infer relationship from notes field "Relationship: child" pattern
      let relation: string | null = null;
      if (row.notes) {
        const m = row.notes.match(/Relationship:\s*(\w+)/i);
        if (m) relation = m[1];
      }

      if (row.birthYear) {
        const bdKey = `lineage:${row.id}:birthday`;
        if (!addedKeys.has(bdKey)) {
          suggestions.push({ sourceKey: bdKey, type: "birthday", personName: row.fullName, relation, year: row.birthYear, month: null, day: null, partial: true, source: "lineage" });
        }
      }
      if (row.deathYear && row.isDeceased) {
        const memKey = `lineage:${row.id}:memorial`;
        if (!addedKeys.has(memKey)) {
          suggestions.push({ sourceKey: memKey, type: "memorial", personName: row.fullName, relation, year: row.deathYear, month: null, day: null, partial: true, source: "lineage" });
        }
      }
    }

    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

// ── POST /calendar/important-dates — save immediately to DB ───────────────────
router.post("/important-dates", requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    if (!user?.dbId) {
      res.status(403).json({ error: "Registered user account required." });
      return;
    }
    const { personName, relation, dateType, month, day, year, customLabel, notes, sourceKey } = req.body as {
      personName: string;
      relation?: string;
      dateType?: string;
      month: number;
      day: number;
      year?: number;
      customLabel?: string;
      notes?: string;
      sourceKey?: string;
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
        addedByUserId: user.dbId,
        sourceKey: sourceKey ?? null,
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
    const userId = req.user?.dbId;
    if (!userId) { res.status(403).json({ error: "Registered user account required." }); return; }
    const deleted = await db.delete(importantDatesTable)
      .where(and(eq(importantDatesTable.id, id), eq(importantDatesTable.addedByUserId, userId)))
      .returning({ id: importantDatesTable.id });
    if (!deleted[0]) { res.status(404).json({ error: "Important date not found." }); return; }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /calendar/:id ─────────────────────────────────────────────────────────
router.get("/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
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
router.post("/", requireAuth, requireRole("officer"), async (req, res, next) => {
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
router.put("/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
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
router.delete("/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
