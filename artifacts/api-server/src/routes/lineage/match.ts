import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable, usersTable } from "@workspace/db";
import { eq, ne, and, inArray, notInArray } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";
import { createNotification } from "../../engines/notification-engine";

const router = Router();

type MatchType = "exact" | "family_name" | "parent_only" | "none";

interface MatchResult {
  matchType: MatchType;
  matchedNodeId: number | null;
  membershipStatus: "verified" | "pending";
  protectionLevel: "descendant" | "pending";
  inheritedFlags: {
    icwaEligible: boolean;
    welfareEligible: boolean;
    trustBeneficiary: boolean;
  };
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

async function traverseAncestorFlags(nodeId: number): Promise<{ icwaEligible: boolean; welfareEligible: boolean; trustBeneficiary: boolean }> {
  const visited = new Set<number>();
  const queue: number[] = [nodeId];
  let icwaEligible = false;
  let welfareEligible = false;
  let trustBeneficiary = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, current)).limit(1);
    if (!node) continue;

    if (node.icwaEligible) icwaEligible = true;
    if (node.welfareEligible) welfareEligible = true;
    if (node.trustBeneficiary) trustBeneficiary = true;

    const parentIds = (node.parentIds as number[] | null) ?? [];
    for (const pid of parentIds) {
      if (!visited.has(pid)) queue.push(pid);
    }
  }

  return { icwaEligible, welfareEligible, trustBeneficiary };
}

async function runLineageMatch(
  fullName: string,
  familyName: string,
  parentName: string | undefined
): Promise<{ matchType: MatchType; matchedNodeId: number | null }> {
  const normFull = normalize(fullName);
  const normFamily = normalize(familyName);
  const normParent = normalize(parentName);

  const allNodes = await db.select().from(familyLineageTable).where(
    and(
      ne(familyLineageTable.sourceType, "archived"),
      notInArray(familyLineageTable.sourceType, ["lineage_claim"]),
      notInArray(familyLineageTable.membershipStatus, ["pending", "rejected"]),
    )
  );

  for (const node of allNodes) {
    const nodeFull = normalize(node.fullName);
    const variants = ((node.nameVariants as string[] | null) ?? []).map(normalize);

    if (nodeFull === normFull || variants.includes(normFull)) {
      return { matchType: "exact", matchedNodeId: node.id };
    }
  }

  if (normFamily) {
    for (const node of allNodes) {
      const nodeLast = normalize(node.lastName);
      if (nodeLast !== normFamily) continue;

      if (normParent) {
        const parentIds = (node.parentIds as number[] | null) ?? [];
        for (const pid of parentIds) {
          const [parentNode] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, pid)).limit(1);
          if (!parentNode) continue;
          const parentFull = normalize(parentNode.fullName);
          const parentVariants = ((parentNode.nameVariants as string[] | null) ?? []).map(normalize);
          if (parentFull === normParent || parentVariants.includes(normParent)) {
            return { matchType: "family_name", matchedNodeId: node.id };
          }
        }
      }
    }
  }

  if (normParent) {
    for (const node of allNodes) {
      const nodeFull = normalize(node.fullName);
      const variants = ((node.nameVariants as string[] | null) ?? []).map(normalize);
      if (nodeFull === normParent || variants.includes(normParent)) {
        return { matchType: "parent_only", matchedNodeId: node.id };
      }
    }
  }

  return { matchType: "none", matchedNodeId: null };
}

async function notifyAdmins(pendingNodeId: number, submitterName: string, userId: number): Promise<void> {
  const adminUsers = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.role, ["admin", "chief_justice", "trustee"]));

  await Promise.all(
    adminUsers.map((admin) =>
      createNotification({
        userId: admin.id,
        category: "lineage_review",
        title: "Pending Lineage Review",
        message: `${submitterName} has submitted a lineage claim (node #${pendingNodeId}) that requires admin review.`,
        severity: "warning",
        relatedId: pendingNodeId,
        relatedType: "family_lineage",
        metadata: { submitterId: userId },
      }),
    ),
  );
}

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { fullName, familyName, parentName } = req.body as {
      fullName?: string;
      familyName?: string;
      parentName?: string;
    };

    if (!fullName || !familyName) {
      res.status(400).json({ error: "fullName and familyName are required." });
      return;
    }

    const userId = req.user?.dbId;
    const entraId = req.user?.entraId as string | undefined;

    if (!userId) {
      res.status(401).json({ error: "User not identified." });
      return;
    }

    const { matchType, matchedNodeId } = await runLineageMatch(fullName, familyName, parentName);

    const inheritedFlags = matchedNodeId !== null
      ? await traverseAncestorFlags(matchedNodeId)
      : { icwaEligible: false, welfareEligible: false, trustBeneficiary: false };

    const [existingClaim] = await db
      .select({ id: familyLineageTable.id })
      .from(familyLineageTable)
      .where(and(
        eq(familyLineageTable.linkedProfileUserId, userId),
        eq(familyLineageTable.membershipStatus, "pending"),
        eq(familyLineageTable.sourceType, "lineage_claim"),
      ))
      .limit(1);

    let pendingNodeId = existingClaim?.id ?? null;
    if (!pendingNodeId) {
      const candidateNote = matchedNodeId !== null
        ? `Automated lineage match candidate: ${matchType} to existing node #${matchedNodeId}. Human review is required before membership verification.`
        : "No automatic lineage match was found. Human review is required before membership verification.";

      const [pendingNode] = await db.insert(familyLineageTable).values({
        fullName,
        firstName: fullName.split(" ")[0] ?? fullName,
        lastName: familyName,
        entraObjectId: entraId ?? null,
        membershipStatus: "pending",
        protectionLevel: "pending",
        sourceType: "lineage_claim",
        isAncestor: false,
        linkedProfileUserId: userId,
        addedByMemberId: userId,
        pendingReview: true,
        parentIds: matchType === "parent_only" && matchedNodeId !== null ? [matchedNodeId] : [],
        notes: candidateNote,
      }).returning();

      pendingNodeId = pendingNode?.id ?? null;
      if (pendingNodeId) {
        await notifyAdmins(pendingNodeId, fullName, userId);
      }
    }

    const result: MatchResult = {
      matchType,
      matchedNodeId: pendingNodeId,
      membershipStatus: "pending",
      protectionLevel: "pending",
      inheritedFlags,
    };

    logger.info({ userId, matchType, matchedNodeId: result.matchedNodeId }, "Lineage match completed");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
