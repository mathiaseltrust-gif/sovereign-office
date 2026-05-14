import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { runAiDraftingEngine, type DocumentKind } from "../../sovereign/ai-drafting-engine";
import { resolveIdentity, buildIdentityFromToken } from "../../sovereign/identity-engine";
import { computeDelegatedAuthorities } from "../../sovereign/delegated-authority";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/create", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    const tokenUser = { ...req.user!, name: req.user!.name ?? req.user!.email };

    let identity;
    if (dbId) {
      identity = await resolveIdentity(dbId) ?? buildIdentityFromToken(tokenUser);
    } else {
      identity = buildIdentityFromToken(tokenUser);
    }

    const role = tokenUser.roles?.[0] ?? "member";
    const delegatedAuthorities = computeDelegatedAuthorities(role, {
      hasLineage: identity.ancestorChain.length > 0,
      hasChildren: false,
      icwaEligible: identity.icwaEligible,
      lineageVerified: identity.membershipVerified,
      membershipVerified: identity.membershipVerified,
    });

    const result = await runAiDraftingEngine({
      identity,
      lineageSummary: identity.lineageSummary,
      membershipVerified: identity.membershipVerified,
      delegatedAuthorities,
      jurisdiction: (req.body?.jurisdiction as "tribal" | "county" | "state" | "federal") ?? "tribal",
      documentType: (req.body?.documentType as DocumentKind) ?? "court_document",
      userNotes: req.body?.userNotes as string | undefined,
      researchDatabaseContent: req.body?.researchDatabaseContent as string | undefined,
      doctrineDatabase: req.body?.doctrineDatabase as string[] | undefined,
      lawDatabase: req.body?.lawDatabase as string[] | undefined,
      profilePhotoUrl: req.body?.profilePhotoUrl as string | undefined,
      userRole: role,
      userId: dbId,
      userEmail: tokenUser.email,
    });

    logger.info({ tier: result.tier, documentType: req.body?.documentType }, "AI drafting engine result");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
