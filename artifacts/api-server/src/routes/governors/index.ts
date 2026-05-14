import { Router } from "express";
import { db } from "@workspace/db";
import { roleGovernorsTable, governorActivationLogTable, userGovernorSessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { seedDefaultGovernors, setSessionGovernor, getSessionGovernor } from "../../sovereign/role-governor";
import { logger } from "../../lib/logger";
import type { Request, Response, NextFunction } from "express";

const router = Router();

function requireSovereignAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const allowed = req.user.roles.some((r) =>
    ["chief_justice", "sovereign_admin"].includes(r)
  );
  if (!allowed) {
    res.status(403).json({ error: "Access denied. Role Governor management requires Chief Justice or Sovereign Admin access." });
    return;
  }
  next();
}

router.get("/", requireAuth, requireSovereignAdmin, async (_req, res, next) => {
  try {
    await seedDefaultGovernors();
    const governors = await db
      .select()
      .from(roleGovernorsTable)
      .orderBy(roleGovernorsTable.id);
    res.json({ governors });
  } catch (err) {
    next(err);
  }
});

router.get("/log", requireAuth, requireSovereignAdmin, async (_req, res, next) => {
  try {
    const log = await db
      .select()
      .from(governorActivationLogTable)
      .orderBy(desc(governorActivationLogTable.createdAt))
      .limit(100);
    res.json({ log });
  } catch (err) {
    next(err);
  }
});

router.get("/session", requireAuth, requireSovereignAdmin, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.json({ governor: null });
      return;
    }
    const governor = await getSessionGovernor(userId);
    res.json({ governor: governor ?? null });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, requireSovereignAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(roleGovernorsTable)
      .where(eq(roleGovernorsTable.id, id))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Governor not found" });
      return;
    }
    res.json({ governor: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireSovereignAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await db
      .select()
      .from(roleGovernorsTable)
      .where(eq(roleGovernorsTable.id, id))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Governor not found" });
      return;
    }

    const body = req.body as {
      displayName?: string;
      postureStatement?: string;
      jurisdictionalScope?: string;
      toneDirectives?: string;
      authorityCitation?: string;
      signatureBlockTemplate?: string;
      documentHeaderTemplate?: string;
    };

    const [updated] = await db
      .update(roleGovernorsTable)
      .set({
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.postureStatement !== undefined ? { postureStatement: body.postureStatement } : {}),
        ...(body.jurisdictionalScope !== undefined ? { jurisdictionalScope: body.jurisdictionalScope } : {}),
        ...(body.toneDirectives !== undefined ? { toneDirectives: body.toneDirectives } : {}),
        ...(body.authorityCitation !== undefined ? { authorityCitation: body.authorityCitation } : {}),
        ...(body.signatureBlockTemplate !== undefined ? { signatureBlockTemplate: body.signatureBlockTemplate } : {}),
        ...(body.documentHeaderTemplate !== undefined ? { documentHeaderTemplate: body.documentHeaderTemplate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(roleGovernorsTable.id, id))
      .returning();

    logger.info({ id, updatedBy: req.user?.email }, "Role governor updated");
    res.json({ governor: updated });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/activate", requireAuth, requireSovereignAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(roleGovernorsTable)
      .where(eq(roleGovernorsTable.id, id))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Governor not found" });
      return;
    }

    await db
      .update(roleGovernorsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(roleGovernorsTable.isActive, true));

    const [activated] = await db
      .update(roleGovernorsTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(roleGovernorsTable.id, id))
      .returning();

    const actingUserId = req.user?.dbId ?? null;
    if (actingUserId) {
      await setSessionGovernor(actingUserId, id);
    }

    await db.insert(governorActivationLogTable).values({
      governorId: id,
      roleKey: rows[0].roleKey,
      eventType: "activation",
      documentType: (req.body as { documentType?: string })?.documentType ?? null,
      actingUserId,
      actingUserEmail: req.user?.email ?? null,
    });

    logger.info({ id, roleKey: rows[0].roleKey, activatedBy: req.user?.email }, "Role governor activated");
    res.json({ governor: activated, message: `Governor "${activated.displayName}" is now active.` });
  } catch (err) {
    next(err);
  }
});

export default router;
