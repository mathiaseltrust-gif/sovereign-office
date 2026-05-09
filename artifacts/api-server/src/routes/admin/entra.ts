import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, requireRegisteredUser } from "../../auth/entra-guard";

const router = Router();

const VALID_ROLES = ["admin", "trustee", "officer", "member", "guest"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

router.post(
  "/",
  requireAuth,
  requireRegisteredUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { action, userId, entraRequired, role } = req.body as {
        action: string;
        userId?: number;
        entraRequired?: boolean;
        role?: string;
      };

      if (!action) {
        res.status(400).json({
          error: "action is required",
          validActions: ["toggle_entra", "override_role", "revoke_trust", "grant_trust", "list_users"],
        });
        return;
      }

      switch (action) {
        case "list_users": {
          const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
          res.json({ action, users });
          return;
        }

        case "toggle_entra": {
          if (userId === undefined || entraRequired === undefined) {
            res.status(400).json({ error: "userId and entraRequired are required for toggle_entra" });
            return;
          }
          const updated = await db
            .update(usersTable)
            .set({ entraRequired, updatedAt: new Date() })
            .where(eq(usersTable.id, userId))
            .returning();
          if (!updated[0]) {
            res.status(404).json({ error: "User not found" });
            return;
          }
          res.json({ action, success: true, user: updated[0] });
          return;
        }

        case "override_role": {
          if (!userId || !role) {
            res.status(400).json({ error: "userId and role are required for override_role" });
            return;
          }
          if (!VALID_ROLES.includes(role as ValidRole)) {
            res.status(400).json({ error: `Invalid role. Valid roles: ${VALID_ROLES.join(", ")}` });
            return;
          }
          const updated = await db
            .update(usersTable)
            .set({ role, updatedAt: new Date() })
            .where(eq(usersTable.id, userId))
            .returning();
          if (!updated[0]) {
            res.status(404).json({ error: "User not found" });
            return;
          }
          res.json({ action, success: true, user: updated[0], message: `Role overridden to '${role}'` });
          return;
        }

        case "revoke_trust": {
          if (!userId) {
            res.status(400).json({ error: "userId is required for revoke_trust" });
            return;
          }
          const updated = await db
            .update(usersTable)
            .set({ trustPrivileges: false, updatedAt: new Date() })
            .where(eq(usersTable.id, userId))
            .returning();
          if (!updated[0]) {
            res.status(404).json({ error: "User not found" });
            return;
          }
          res.json({ action, success: true, user: updated[0], message: "Trust privileges revoked" });
          return;
        }

        case "grant_trust": {
          if (!userId) {
            res.status(400).json({ error: "userId is required for grant_trust" });
            return;
          }
          const updated = await db
            .update(usersTable)
            .set({ trustPrivileges: true, updatedAt: new Date() })
            .where(eq(usersTable.id, userId))
            .returning();
          if (!updated[0]) {
            res.status(404).json({ error: "User not found" });
            return;
          }
          res.json({ action, success: true, user: updated[0], message: "Trust privileges granted" });
          return;
        }

        default:
          res.status(400).json({
            error: `Unknown action: ${action}`,
            validActions: ["toggle_entra", "override_role", "revoke_trust", "grant_trust", "list_users"],
          });
      }
    } catch (err) {
      next(err);
    }
  },
);

router.get("/users", requireAuth, requireRegisteredUser, requireAdmin, async (_req, res, next) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post("/toggle", requireAuth, requireRegisteredUser, requireAdmin, async (req, res, next) => {
  try {
    const { userId, entraRequired } = req.body as { userId: number; entraRequired: boolean };
    if (userId === undefined || entraRequired === undefined) {
      res.status(400).json({ error: "userId and entraRequired are required" });
      return;
    }
    const updated = await db
      .update(usersTable)
      .set({ entraRequired, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, user: updated[0] });
  } catch (err) {
    next(err);
  }
});

router.post("/override-role", requireAuth, requireRegisteredUser, requireAdmin, async (req, res, next) => {
  try {
    const { userId, role } = req.body as { userId: number; role: string };
    if (!userId || !role) {
      res.status(400).json({ error: "userId and role are required" });
      return;
    }
    if (!VALID_ROLES.includes(role as ValidRole)) {
      res.status(400).json({ error: `Invalid role. Valid roles: ${VALID_ROLES.join(", ")}` });
      return;
    }
    const updated = await db
      .update(usersTable)
      .set({ role, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, user: updated[0], message: `Role updated to '${role}'` });
  } catch (err) {
    next(err);
  }
});

router.post("/revoke-trust", requireAuth, requireRegisteredUser, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.body as { userId: number };
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const updated = await db
      .update(usersTable)
      .set({ trustPrivileges: false, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, user: updated[0], message: "Trust privileges revoked" });
  } catch (err) {
    next(err);
  }
});

router.post("/grant-trust", requireAuth, requireRegisteredUser, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.body as { userId: number };
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const updated = await db
      .update(usersTable)
      .set({ trustPrivileges: true, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, user: updated[0], message: "Trust privileges granted" });
  } catch (err) {
    next(err);
  }
});

router.post("/create-user", requireAuth, requireRegisteredUser, requireAdmin, async (req, res, next) => {
  try {
    const { email, name, role, entraId } = req.body as {
      email: string;
      name: string;
      role?: string;
      entraId?: string;
    };
    if (!email || !name) {
      res.status(400).json({ error: "email and name are required" });
      return;
    }
    const [created] = await db
      .insert(usersTable)
      .values({ email, name, role: role ?? "member", entraId })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
