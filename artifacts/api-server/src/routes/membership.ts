import { Router } from "express";
import { requireAuth } from "../auth/entra-guard";
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  familyLineageTable,
  identityNarrativesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeDelegatedAuthorities, buildWhatNextInstructions } from "../sovereign/delegated-authority";
import { getLineageForUser } from "../sovereign/family-tree-engine";
import { logger } from "../lib/logger";

const router = Router();

router.get("/verify", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    const tokenRoles = req.user!.roles ?? [];
    const role = tokenRoles[0] ?? "member";

    if (!dbId) {
      const authorities = computeDelegatedAuthorities(role, {
        hasLineage: false,
        hasChildren: false,
        icwaEligible: false,
        lineageVerified: false,
        membershipVerified: false,
      });
      const instructions = buildWhatNextInstructions(authorities, {
        membershipVerified: false,
        protectionLevel: "standard",
        icwaEligible: false,
        welfareEligible: false,
        trustInheritance: false,
        familyGroup: "",
      });
      res.json({
        membershipVerified: false,
        entraVerified: false,
        lineageVerified: false,
        identityTags: [],
        familyGroup: "",
        protectionLevel: "standard",
        benefitEligibility: { icwa: false, tribalWelfare: false, trustBeneficiary: false, membershipBenefits: false, ancestralLandRights: false },
        delegatedAuthorities: authorities,
        whatNext: instructions,
        lineageSummary: "No lineage records on file.",
        ancestorChain: [],
        tribalNations: [],
        memberType: authorities.memberType,
        message: "Register in the system first to complete membership verification.",
      });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, dbId)).limit(1);
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
    const lineageData = await getLineageForUser(dbId);
    const [narrative] = await db
      .select()
      .from(identityNarrativesTable)
      .where(eq(identityNarrativesTable.userId, dbId))
      .limit(1);

    const entraVerified = !!(user?.entraId);
    const lineageVerified = lineageData.lineage.length > 0;

    const familyGroup =
      narrative?.familyGroup ??
      profile?.familyGroup ??
      (lineageData.lineage[0]?.lineageTags as string[] | undefined)?.[0] ??
      "";

    const identityTags: string[] = [
      ...((narrative?.identityTags as string[]) ?? []),
      ...((profile?.welfareTags as string[]) ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const hasFamilyGroupInTags = identityTags.some((t) =>
      t.toLowerCase().includes("family") || t.toLowerCase().includes("tribal")
    ) || !!familyGroup;

    const membershipVerified = lineageVerified && hasFamilyGroupInTags;

    const icwaEligible = narrative?.icwaEligible ?? lineageData.lineage.some((l) => l.icwaEligible) ?? false;
    const welfareEligible = narrative?.welfareEligible ?? lineageData.lineage.some((l) => l.welfareEligible) ?? false;
    const trustInheritance = narrative?.trustInheritance ?? lineageData.lineage.some((l) => l.trustBeneficiary) ?? false;

    const hasChildren = lineageData.lineage.some((l) => {
      const childrenIds = Array.isArray(l.childrenIds) ? l.childrenIds : [];
      return childrenIds.length > 0;
    });

    const protectionLevel =
      (narrative?.protectionLevel as "standard" | "elevated" | "critical") ??
      (icwaEligible && trustInheritance ? "critical" : icwaEligible ? "elevated" : "standard");

    const benefitEligibility = {
      icwa: icwaEligible,
      tribalWelfare: welfareEligible,
      trustBeneficiary: trustInheritance,
      membershipBenefits: membershipVerified,
      ancestralLandRights: icwaEligible && trustInheritance,
      ...((narrative?.benefitEligibility as Record<string, boolean>) ?? {}),
    };

    const ctx = { hasLineage: lineageVerified, hasChildren, icwaEligible, lineageVerified, membershipVerified };
    const dbRole = user?.role ?? role;
    const authorities = computeDelegatedAuthorities(dbRole, ctx);

    const whatNext = buildWhatNextInstructions(authorities, {
      membershipVerified,
      protectionLevel,
      icwaEligible,
      welfareEligible,
      trustInheritance,
      familyGroup,
    });

    const existingProfile = profile;
    if (existingProfile) {
      await db.update(profilesTable).set({
        membershipVerified,
        entraVerified,
        lineageVerified,
        delegatedAuthorities: authorities,
        updatedAt: new Date(),
      }).where(eq(profilesTable.userId, dbId));
    }

    logger.info({ dbId, membershipVerified, entraVerified, lineageVerified, role: dbRole, protectionLevel }, "Membership verification completed");

    res.json({
      membershipVerified,
      entraVerified,
      lineageVerified,
      identityTags,
      familyGroup,
      protectionLevel,
      benefitEligibility,
      delegatedAuthorities: authorities,
      whatNext,
      lineageSummary: lineageData.lineage.length > 0
        ? `${lineageData.lineage.length} lineage record(s). ${icwaEligible ? "ICWA eligible. " : ""}${welfareEligible ? "Welfare eligible. " : ""}${trustInheritance ? "Trust beneficiary." : ""}`
        : "No lineage records on file.",
      ancestorChain: Array.isArray(narrative?.ancestorChain) ? narrative.ancestorChain : [],
      tribalNations: [...new Set(lineageData.lineage.flatMap((l) => l.tribalNation ? [l.tribalNation] : []))],
      memberType: authorities.memberType,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
