import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { hasRole } from "../../engines/authority";
import { harmonizeCanonicalProfile } from "../../engines/canonical-profile-harmonizer";

const router = Router();

const PRIVILEGED_ROLES = ["sovereign_admin", "admin", "officer", "trustee", "chief_justice", "chief_justice_trustee"] as const;

/**
 * GET /api/harmonization/profile/me
 *
 * Returns the canonical operational profile context for the current user.
 */
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId ?? null;
    if (!userId) {
      res.status(401).json({ error: "User must be authenticated and resolved to a database profile" });
      return;
    }

    const context = await harmonizeCanonicalProfile({ userId });
    res.json(context);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/harmonization/profile/:userId
 *
 * Officer/admin-facing lookup route.
 * Access allowed only to:
 *   1. The user themselves (self-access), OR
 *   2. A privileged role (sovereign_admin, admin, officer, trustee, chief_justice, chief_justice_trustee)
 */
router.get("/:userId", requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const isSelf = req.user?.dbId === userId;
    const isPrivileged = PRIVILEGED_ROLES.some(r => hasRole(req.user!.roles, r));

    if (!isSelf && !isPrivileged) {
      res.status(403).json({ error: "Insufficient privileges. This endpoint requires an officer, admin, or trustee role." });
      return;
    }

    const context = await harmonizeCanonicalProfile({ userId });
    res.json(context);
  } catch (err) {
    next(err);
  }
});

export default router;
