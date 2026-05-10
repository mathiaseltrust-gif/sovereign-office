import { Router } from "express";
import { requireAuth, requireRegisteredUser } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { profilesTable, identityNarrativesTable, familyLineageTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeDelegatedAuthorities, checkMedicalNoteAuthority, buildWhatNextInstructions } from "../../sovereign/delegated-authority";
import { getLineageForUser } from "../../sovereign/family-tree-engine";
import { logger } from "../../lib/logger";

const router = Router();

const MEDICAL_CENTER = "Mathias El Tribe Medical Center";

router.post("/create", requireAuth, requireRegisteredUser, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId!;
    const tokenRoles = req.user!.roles ?? [];
    const role = tokenRoles[0] ?? "member";

    const {
      patientName,
      noteContent,
      noteType = "general",
      forDependent = false,
      dependentName,
      chiefComplaint,
      clinicalFindings,
      plan,
    } = req.body as {
      patientName?: string;
      noteContent?: string;
      noteType?: string;
      forDependent?: boolean;
      dependentName?: string;
      chiefComplaint?: string;
      clinicalFindings?: string;
      plan?: string;
    };

    if (!noteContent && !chiefComplaint) {
      res.status(400).json({ error: "noteContent or chiefComplaint is required" });
      return;
    }

    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
    const lineageData = await getLineageForUser(dbId);
    const [narrative] = await db.select().from(identityNarrativesTable).where(eq(identityNarrativesTable.userId, dbId)).limit(1);

    const lineageVerified = lineageData.lineage.length > 0;
    const icwaEligible = narrative?.icwaEligible ?? lineageData.lineage.some((l) => l.icwaEligible) ?? false;
    const trustInheritance = narrative?.trustInheritance ?? false;
    const hasChildren = lineageData.lineage.some((l) => {
      const childrenIds = Array.isArray(l.childrenIds) ? l.childrenIds : [];
      return childrenIds.length > 0;
    });

    const existingAuthorities = profile?.delegatedAuthorities as Record<string, unknown> | null;
    const authorities = existingAuthorities && Object.keys(existingAuthorities).length > 0
      ? (existingAuthorities as ReturnType<typeof computeDelegatedAuthorities>)
      : computeDelegatedAuthorities(role, {
          hasLineage: lineageVerified,
          hasChildren,
          icwaEligible,
          lineageVerified,
          membershipVerified: lineageVerified,
        });

    const authCheck = checkMedicalNoteAuthority(authorities, forDependent);
    if (!authCheck.allowed) {
      res.status(403).json({ error: authCheck.reason, delegatedAuthorities: authorities });
      return;
    }

    const protectionLevel =
      (narrative?.protectionLevel as string) ??
      (icwaEligible && trustInheritance ? "critical" : icwaEligible ? "elevated" : "standard");

    const identityTags: string[] = [
      ...((narrative?.identityTags as string[]) ?? []),
      ...((profile?.welfareTags as string[]) ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const lineageSummary = lineageData.lineage.length > 0
      ? `${lineageData.lineage.length} lineage record(s). ${icwaEligible ? "ICWA eligible. " : ""}${
          narrative?.welfareEligible ? "Welfare eligible. " : ""
        }${trustInheritance ? "Trust beneficiary." : ""}`.trim()
      : "No lineage records on file.";

    const legalName = profile?.legalName ?? req.user!.name;
    const tribalName = profile?.tribalName ?? "";
    const familyGroup = narrative?.familyGroup ?? profile?.familyGroup ?? "";
    const tribalNations = [...new Set(lineageData.lineage.flatMap((l) => l.tribalNation ? [l.tribalNation] : []))];

    const noteDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const noteTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const noteName = forDependent
      ? (dependentName ?? patientName ?? "Dependent")
      : (patientName ?? legalName);

    const noteText = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `${MEDICAL_CENTER.toUpperCase()}`,
      `Office of the Chief Justice & Trustee — Medical Records`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `DATE: ${noteDate}   TIME: ${noteTime}`,
      `NOTE TYPE: ${noteType.toUpperCase().replace(/_/g, " ")}`,
      `PATIENT: ${noteName}`,
      forDependent ? `GUARDIAN / RESPONSIBLE PARTY: ${legalName}` : "",
      tribalName ? `TRIBAL NAME: ${tribalName}` : "",
      familyGroup ? `FAMILY GROUP: ${familyGroup}` : "",
      ``,
      `IDENTITY & PROTECTION`,
      `─────────────────────`,
      `PROTECTION LEVEL: ${protectionLevel.toUpperCase()}`,
      `IDENTITY TAGS: ${identityTags.length > 0 ? identityTags.join(", ") : "None on record"}`,
      `TRIBAL NATIONS: ${tribalNations.length > 0 ? tribalNations.join(", ") : "None on record"}`,
      `LINEAGE: ${lineageSummary}`,
      icwaEligible ? `ICWA STATUS: ELIGIBLE — Indian Child Welfare Act protections apply` : "",
      ``,
      `CLINICAL RECORD`,
      `───────────────`,
      chiefComplaint ? `CHIEF COMPLAINT: ${chiefComplaint}` : "",
      clinicalFindings ? `CLINICAL FINDINGS: ${clinicalFindings}` : "",
      plan ? `PLAN: ${plan}` : "",
      noteContent ? `NOTES:\n${noteContent}` : "",
      ``,
      `AUTHORITY`,
      `─────────`,
      `Authorized by: ${legalName}`,
      `Authority Type: ${authorities.memberType.replace(/_/g, " ").toUpperCase()}`,
      `Medical Authority: ${authorities.medicalNotes.replace(/_/g, " ").toUpperCase()}`,
      `For Dependent: ${forDependent ? "YES" : "NO"}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `${MEDICAL_CENTER}`,
      `This note is an official record of the Sovereign Office of the Chief Justice & Trustee.`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ]
      .filter((l) => l !== "")
      .join("\n");

    const whatNext = buildWhatNextInstructions(authorities, {
      membershipVerified: lineageVerified,
      protectionLevel,
      icwaEligible,
      welfareEligible: narrative?.welfareEligible ?? false,
      trustInheritance,
      familyGroup,
    });

    logger.info({ dbId, noteType, forDependent, patientName: noteName, protectionLevel }, "Medical note generated");

    res.status(201).json({
      note: noteText,
      noteType,
      patientName: noteName,
      generatedBy: legalName,
      medicalCenter: MEDICAL_CENTER,
      forDependent,
      protectionLevel,
      identityTags,
      lineageSummary,
      icwaEligible,
      generatedAt: new Date().toISOString(),
      whatNext,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
