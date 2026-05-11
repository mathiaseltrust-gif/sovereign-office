import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable, profilesTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, ne, and, inArray, notInArray } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

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

  const inserts = adminUsers.map((admin) => ({
    userId: admin.id,
    channel: "dashboard" as const,
    category: "lineage_review",
    title: "Pending Lineage Review",
    message: `${submitterName} has submitted a lineage claim (node #${pendingNodeId}) that requires admin review.`,
    severity: "warning" as const,
    relatedId: pendingNodeId,
    relatedType: "family_lineage",
    redFlag: false,
    troFlag: false,
    read: false,
    metadata: { submitterId: userId },
  }));

  if (inserts.length > 0) {
    await db.insert(notificationsTable).values(inserts);
  }
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

    let result: MatchResult;

    if (matchType === "exact" || matchType === "family_name") {
      if (matchedNodeId !== null) {
        const [existingNode] = await db.select({
            entraObjectId: familyLineageTable.entraObjectId,
            membershipStatus: familyLineageTable.membershipStatus,
          })
          .from(familyLineageTable)
          .where(eq(familyLineageTable.id, matchedNodeId))
          .limit(1);

        if (existingNode?.membershipStatus === "pending" || existingNode?.membershipStatus === "rejected") {
          result = {
            matchType: "none",
            matchedNodeId: null,
            membershipStatus: "pending",
            protectionLevel: "pending",
            inheritedFlags: { icwaEligible: false, welfareEligible: false, trustBeneficiary: false },
          };
        } else if (existingNode?.entraObjectId && existingNode.entraObjectId !== entraId) {
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
            notes: `Conflict: matched node #${matchedNodeId} is already linked to another account.`,
          }).returning();

          if (pendingNode) {
            await notifyAdmins(pendingNode.id, fullName, userId);
          }

          result = {
            matchType: "none",
            matchedNodeId: pendingNode?.id ?? null,
            membershipStatus: "pending",
            protectionLevel: "pending",
            inheritedFlags: { icwaEligible: false, welfareEligible: false, trustBeneficiary: false },
          };
        } else {
          const flags = await traverseAncestorFlags(matchedNodeId);

          await db.update(familyLineageTable)
            .set({
              entraObjectId: entraId ?? null,
              membershipStatus: "verified",
              protectionLevel: "descendant",
              ...(flags.icwaEligible !== false ? { icwaEligible: true } : {}),
              ...(flags.welfareEligible !== false ? { welfareEligible: true } : {}),
              ...(flags.trustBeneficiary !== false ? { trustBeneficiary: true } : {}),
              updatedAt: new Date(),
            })
            .where(eq(familyLineageTable.id, matchedNodeId));

          await db
            .insert(profilesTable)
            .values({ userId, lineageVerified: true, membershipVerified: true })
            .onConflictDoUpdate({
              target: profilesTable.userId,
              set: { lineageVerified: true, membershipVerified: true, updatedAt: new Date() },
            });

          result = {
            matchType,
            matchedNodeId,
            membershipStatus: "verified",
            protectionLevel: "descendant",
            inheritedFlags: flags,
          };
        }
      } else {
        result = { matchType: "none", matchedNodeId: null, membershipStatus: "pending", protectionLevel: "pending", inheritedFlags: { icwaEligible: false, welfareEligible: false, trustBeneficiary: false } };
      }
    } else if (matchType === "parent_only" && matchedNodeId !== null) {
      const parentNode = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, matchedNodeId)).limit(1).then(r => r[0]);
      const existingChildren = (parentNode?.childrenIds as number[] | null) ?? [];

      const flags = await traverseAncestorFlags(matchedNodeId);

      const [newNode] = await db.insert(familyLineageTable).values({
        fullName,
        firstName: fullName.split(" ")[0] ?? fullName,
        lastName: familyName,
        entraObjectId: entraId ?? null,
        membershipStatus: "verified",
        protectionLevel: "descendant",
        parentIds: [matchedNodeId],
        sourceType: "lineage_match",
        isAncestor: false,
        linkedProfileUserId: userId,
        ...(flags.icwaEligible ? { icwaEligible: true } : {}),
        ...(flags.welfareEligible ? { welfareEligible: true } : {}),
        ...(flags.trustBeneficiary ? { trustBeneficiary: true } : {}),
      }).returning();

      if (parentNode && newNode) {
        await db.update(familyLineageTable)
          .set({ childrenIds: [...existingChildren, newNode.id], updatedAt: new Date() })
          .where(eq(familyLineageTable.id, matchedNodeId));
      }

      await db
        .insert(profilesTable)
        .values({ userId, lineageVerified: true, membershipVerified: true })
        .onConflictDoUpdate({
          target: profilesTable.userId,
          set: { lineageVerified: true, membershipVerified: true, updatedAt: new Date() },
        });

      result = {
        matchType: "parent_only",
        matchedNodeId: newNode?.id ?? null,
        membershipStatus: "verified",
        protectionLevel: "descendant",
        inheritedFlags: flags,
      };
    } else {
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
      }).returning();

      if (pendingNode) {
        await notifyAdmins(pendingNode.id, fullName, userId);
      }

      result = {
        matchType: "none",
        matchedNodeId: pendingNode?.id ?? null,
        membershipStatus: "pending",
        protectionLevel: "pending",
        inheritedFlags: { icwaEligible: false, welfareEligible: false, trustBeneficiary: false },
      };
    }

    logger.info({ userId, matchType, matchedNodeId: result.matchedNodeId }, "Lineage match completed");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
