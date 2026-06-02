import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { harmonizeCanonicalProfile } from "../../engines/canonical-profile-harmonizer";

const router = Router();

/**
 * GET /api/harmonization/profile/me
 *
 * Returns the canonical operational profile context for the current user.
 * This is the stabilization endpoint for the Master Profile / Sovereign Nervous
 * System spine: identity, lineage, household, land, governance, TRACE, NFR,
 * protection flags, and recommended pathways.
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
 * Officer/admin-facing lookup route. Access control is currently enforced by
 * requireAuth; role/domain-gated access should be tightened when Delegated
 * Authority Configuration is wired into the Role Governor.
 */
router.get("/:userId", requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const context = await harmonizeCanonicalProfile({ userId });
    res.json(context);
  } catch (err) {
    next(err);
  }
});

export default router;
