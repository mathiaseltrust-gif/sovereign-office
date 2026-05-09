import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../../auth/entra-guard";

const router = Router();

router.get("/users", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post("/toggle", requireAuth, requireAdmin, async (req, res, next) => {
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

router.post("/override-role", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId, role } = req.body as { userId: number; role: string };
    if (!userId || !role) {
      res.status(400).json({ error: "userId and role are required" });
      return;
    }
    const validRoles = ["admin", "trustee", "officer", "member", "guest"];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `Invalid role. Valid roles: ${validRoles.join(", ")}` });
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

router.post("/revoke-trust", requireAuth, requireAdmin, async (req, res, next) => {
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

router.post("/grant-trust", requireAuth, requireAdmin, async (req, res, next) => {
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

router.post("/create-user", requireAuth, requireAdmin, async (req, res, next) => {
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
