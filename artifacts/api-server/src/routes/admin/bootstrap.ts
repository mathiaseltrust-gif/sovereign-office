import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getBootstrapToken, consumeBootstrapToken } from "../../lib/bootstrap-token";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const activeToken = getBootstrapToken();
    if (!activeToken) {
      res.status(403).json({
        error:
          "Bootstrap is not available. An admin account already exists — use POST /api/admin/entra to manage users.",
      });
      return;
    }

    const providedToken =
      (req.headers["x-bootstrap-token"] as string | undefined) ?? req.body.bootstrapToken;

    if (!providedToken || providedToken !== activeToken) {
      res.status(401).json({ error: "Invalid or missing bootstrap token." });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);

    if (existing.length > 0) {
      consumeBootstrapToken();
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

    consumeBootstrapToken();

    res.status(201).json({
      message: "First admin account created. Bootstrap endpoint is now permanently locked.",
      user: admin,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
