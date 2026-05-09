import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  tasksTable,
  calendarEventsTable,
  complaintsTable,
  nfrDocumentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { getPreferences, getRecommendations } from "../../sovereign/ai-learning";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.user!.id);
    const userResults = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = userResults[0];

    const profileResults = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
    const profile = profileResults[0] ?? null;

    const userTasks = await db.select().from(tasksTable).where(eq(tasksTable.assignedTo, userId)).limit(20);
    const userCalendar = await db.select().from(calendarEventsTable).limit(10);
    const userComplaints = await db.select().from(complaintsTable).where(eq(complaintsTable.officerId, userId)).limit(10);
    const userNfrs = await db.select().from(nfrDocumentsTable).limit(10);
    const aiPreferences = await getPreferences(userId);
    const recommendations = await getRecommendations(userId);

    res.json({
      user: user ?? { id: userId, ...req.user },
      profile,
      tasks: userTasks,
      calendarEvents: userCalendar,
      complaintHistory: userComplaints,
      nfrHistory: userNfrs,
      aiPreferences,
      recommendations,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/", requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.user!.id);
    const { bio, preferredJurisdiction, aiPreferences } = req.body as {
      bio?: string;
      preferredJurisdiction?: string;
      aiPreferences?: object;
    };

    const existing = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);

    let profile;
    if (existing[0]) {
      const [updated] = await db
        .update(profilesTable)
        .set({
          bio: bio ?? existing[0].bio,
          preferredJurisdiction: preferredJurisdiction ?? existing[0].preferredJurisdiction,
          aiPreferences: aiPreferences ?? existing[0].aiPreferences,
          updatedAt: new Date(),
        })
        .where(eq(profilesTable.userId, userId))
        .returning();
      profile = updated;
    } else {
      const [created] = await db
        .insert(profilesTable)
        .values({ userId, bio, preferredJurisdiction, aiPreferences })
        .returning();
      profile = created;
    }

    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.post("/learn", requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.user!.id);
    const { category, key, value } = req.body as { category: string; key: string; value: unknown };
    if (!category || !key) {
      res.status(400).json({ error: "category and key are required" });
      return;
    }
    const { learnPreference } = await import("../../sovereign/ai-learning");
    await learnPreference(userId, category, key, value);
    res.json({ success: true, message: "Preference recorded" });
  } catch (err) {
    next(err);
  }
});

export default router;
