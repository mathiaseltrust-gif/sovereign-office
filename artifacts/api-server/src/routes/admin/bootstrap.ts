import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
    if (!bootstrapSecret) {
      res.status(503).json({ error: "Bootstrap is not configured on this server." });
      return;
    }

    const providedSecret =
      (req.headers["x-bootstrap-secret"] as string | undefined) ?? req.body.bootstrapSecret;

    if (!providedSecret || providedSecret !== bootstrapSecret) {
      res.status(401).json({ error: "Invalid or missing bootstrap secret." });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);

    if (existing.length > 0) {
      res.status(403).json({
        error:
          "Bootstrap is disabled after the first admin account is created. Use POST /api/admin/entra to manage users.",
      });
      return;
    }

    const { email, name } = req.body as { email?: string; name?: string };
    if (!email || !name) {
      res.status(400).json({ error: "email and name are required" });
      return;
    }

    const [admin] = await db
      .insert(usersTable)
      .values({ email, name, role: "admin", entraRequired: false, trustPrivileges: true })
      .returning();

    res.status(201).json({
      message: "First admin account created. Bootstrap endpoint is now locked.",
      user: admin,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
