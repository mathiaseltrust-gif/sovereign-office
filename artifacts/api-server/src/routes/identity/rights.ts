import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { resolveSovereignIdentityGateway } from "../../engines/identity-gateway";
import { computeMemberRights, computeInheritedRights } from "../../engines/rights-engine";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/rights", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId ?? 0;
    const tokenUser = {
      email: req.user!.email,
      name: req.user!.name ?? req.user!.email,
      roles: req.user!.roles ?? [],
    };

    const [gateway, profileRows, inheritedResult] = await Promise.all([
      resolveSovereignIdentityGateway(dbId, tokenUser),
      db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1),
      computeInheritedRights(dbId),
    ]);

    const profile = profileRows[0] ?? null;

    const rightsProfile = computeMemberRights({
      protectionLevel: gateway.protectionLevel,
      icwaEligible: gateway.icwaEligible,
      trustInheritance: gateway.trustInheritance,
      welfareEligible: gateway.welfareEligible,
      membershipVerified: gateway.membershipVerified,
      lineageVerified: gateway.lineageVerified,
      benefitEligibility: gateway.benefitEligibility,
      identity: {
        legalName: gateway.identity.legalName,
        tribalName: gateway.identity.tribalName,
        courtCaption: gateway.identity.courtCaption,
        tribalEnrollmentNumber: gateway.identity.tribalEnrollmentNumber,
        tribalIdNumber: gateway.identity.tribalIdNumber,
        identityTags: gateway.identity.identityTags,
        role: gateway.identity.role,
        title: gateway.identity.title,
      },
      lineageSummary: gateway.lineageSummary,
      ancestorChain: gateway.ancestorChain,
      tribalNations: gateway.tribalNations,
      elderStatus: gateway.elderStatus,
      isElder: gateway.isElder,
      profile: profile ? {
        apn: (profile as any).apn ?? null,
        landStatus: (profile as any).landStatus ?? null,
        hasRecordedInstrument: (profile as any).hasRecordedInstrument ?? false,
        tribalLandCode: (profile as any).tribalLandCode ?? null,
        docNumbers: (profile as any).docNumbers ?? null,
        landRestrictionBasis: (profile as any).landRestrictionBasis ?? null,
        landClassification: (profile as any).landClassification ?? null,
        selfExecuting: (profile as any).selfExecuting ?? false,
      } : null,
    });

    res.json({
      ...rightsProfile,
      inheritedRights: inheritedResult.inheritedRights,
      ancestorTribalNations: inheritedResult.ancestorTribalNations,
      inheritanceSummary: inheritedResult.inheritanceSummary,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
