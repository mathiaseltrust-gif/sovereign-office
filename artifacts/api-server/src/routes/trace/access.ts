import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTraceAccess, requireRole } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/access", requireTraceAccess, requireRole("sovereign_admin"), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        userId: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        profileId: profilesTable.id,
        traceAccess: profilesTable.traceAccess,
      })
      .from(usersTable)
      .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
      .orderBy(usersTable.name);

    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/access/:userId", requireTraceAccess, requireRole("sovereign_admin"), async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const { grant } = req.body as { grant: boolean };

    if (typeof grant !== "boolean") {
      res.status(400).json({ error: "grant (boolean) is required" });
      return;
    }

    const [existing] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User profile not found" });
      return;
    }

    await db
      .update(profilesTable)
      .set({ traceAccess: grant, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId));

    logger.info({ targetUserId: userId, grant, adminId: req.user?.dbId }, "TRACE access updated");
    res.json({ success: true, userId, traceAccess: grant });
  } catch (err) {
    next(err);
  }
});

export default router;
