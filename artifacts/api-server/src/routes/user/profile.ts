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
import { getPreferences, getRecommendations, learnPreference } from "../../sovereign/ai-learning";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;

    let user: Record<string, unknown> = { id: req.user!.id, email: req.user!.email, roles: req.user!.roles };
    let profile: Record<string, unknown> | null = null;
    let userTasks: unknown[] = [];
    let userCalendar: unknown[] = [];
    let userComplaints: unknown[] = [];
    let userNfrs: unknown[] = [];
    let searchHistory: string[] = [];
    let aiPreferences: unknown[] = [];
    let recommendations: string[] = ["Begin using the system to receive personalized recommendations"];

    if (dbId) {
      const userResults = await db.select().from(usersTable).where(eq(usersTable.id, dbId)).limit(1);
      if (userResults[0]) {
        const u = userResults[0];
        user = { id: u.id, email: u.email, name: u.name, role: u.role, entraRequired: u.entraRequired, trustPrivileges: u.trustPrivileges, createdAt: u.createdAt };
      }

      const profileResults = await db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
      if (profileResults[0]) {
        profile = profileResults[0] as unknown as Record<string, unknown>;
        searchHistory = Array.isArray(profileResults[0].searchHistory) ? (profileResults[0].searchHistory as string[]) : [];
      }

      userTasks = await db.select().from(tasksTable).where(eq(tasksTable.assignedTo, dbId)).limit(20);
      userCalendar = await db.select().from(calendarEventsTable).limit(10);
      userComplaints = await db.select().from(complaintsTable).where(eq(complaintsTable.officerId, dbId)).limit(10);
      userNfrs = await db.select().from(nfrDocumentsTable).limit(10);
      aiPreferences = await getPreferences(dbId);
      recommendations = await getRecommendations(dbId);
    }

    res.json({
      user,
      profile,
      tasks: userTasks,
      calendarEvents: userCalendar,
      complaintHistory: userComplaints,
      nfrHistory: userNfrs,
      searchHistory,
      aiPreferences,
      recommendations,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    if (!dbId) {
      res.status(400).json({ error: "User must be registered in the system to update profile" });
      return;
    }
    const { bio, preferredJurisdiction, aiPreferences } = req.body as {
      bio?: string;
      preferredJurisdiction?: string;
      aiPreferences?: object;
    };

    const existing = await db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);

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
        .where(eq(profilesTable.userId, dbId))
        .returning();
      profile = updated;
    } else {
      const [created] = await db
        .insert(profilesTable)
        .values({ userId: dbId, bio, preferredJurisdiction, aiPreferences })
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
    const dbId = req.user!.dbId;
    if (!dbId) {
      res.status(400).json({ error: "User must be registered in the system to record preferences" });
      return;
    }
    const { category, key, value } = req.body as { category: string; key: string; value: unknown };
    if (!category || !key) {
      res.status(400).json({ error: "category and key are required" });
      return;
    }
    await learnPreference(dbId, category, key, value);
    res.json({ success: true, message: "Preference recorded" });
  } catch (err) {
    next(err);
  }
});

export default router;
