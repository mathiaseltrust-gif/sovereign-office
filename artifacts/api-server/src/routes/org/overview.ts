import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { SOVEREIGN_ORGS, computeOrgAccess } from "../../sovereign/organizations";
import { db } from "@workspace/db";
import { profilesTable, familyLineageTable, identityNarrativesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    const tokenRoles = req.user!.roles ?? [];
    const role = tokenRoles[0] ?? "member";

    const orgAccess = computeOrgAccess(role);

    let membershipVerified = false;
    let lineageVerified = false;
    let icwaEligible = false;
    let protectionLevel = "standard";
    let familyGroup = "";

    if (dbId) {
      const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
      const [narrative] = await db.select().from(identityNarrativesTable).where(eq(identityNarrativesTable.userId, dbId)).limit(1);
      const lineage = await db.select().from(familyLineageTable).where(eq(familyLineageTable.userId, dbId));

      membershipVerified = profile?.membershipVerified ?? false;
      lineageVerified = lineage.length > 0;
      icwaEligible = narrative?.icwaEligible ?? false;
      familyGroup = narrative?.familyGroup ?? profile?.familyGroup ?? "";
      protectionLevel = (narrative?.protectionLevel as string) ??
        (icwaEligible ? "elevated" : "standard");
    }

    res.json({
      orgs: SOVEREIGN_ORGS.map((org) => ({
        ...org,
        accessLevel: orgAccess[org.id] ?? "none",
      })),
      summary: {
        membershipVerified,
        lineageVerified,
        icwaEligible,
        protectionLevel,
        familyGroup,
        role,
        totalOrgs: SOVEREIGN_ORGS.length,
        accessibleOrgs: Object.values(orgAccess).filter((a) => a !== "none").length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:orgId", requireAuth, (req, res, next) => {
  try {
    const { orgId } = req.params;
    const tokenRoles = req.user!.roles ?? [];
    const role = tokenRoles[0] ?? "member";
    const orgAccess = computeOrgAccess(role);

    const org = SOVEREIGN_ORGS.find((o) => o.id === orgId);
    if (!org) {
      res.status(404).json({ error: `Organization '${orgId}' not found` });
      return;
    }

    res.json({
      org,
      accessLevel: (orgAccess as Record<string, string>)[String(orgId)] ?? "none",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
