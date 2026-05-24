import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable, familyUnitsTable, profilesTable, usersTable } from "@workspace/db";
import { eq, desc, ne, or, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { hasRole, canReviewPendingLineage } from "../../engines/authority";
import { logger } from "../../lib/logger";
import { createNotification } from "../../engines/notification-engine";

const CHIEF_ROLES = new Set(["trustee", "sovereign_admin", "admin", "elder", "officer", "chief_justice", "chief_justice_trustee"]);

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const rawLimit = Math.max(1, parseInt(String(req.query.limit ?? "100"), 10));
    const isChief = (req.user?.roles ?? []).some((r) => CHIEF_ROLES.has(r));
    // Chiefs/admins need all ~1000+ nodes to render the full tree; regular members see far fewer
    const limit = Math.min(isChief ? 5000 : 500, rawLimit);
    const offset = (page - 1) * limit;

    const currentUserId = req.user?.dbId ?? null;

    const baseSelect = {
      id: familyLineageTable.id,
      fullName: familyLineageTable.fullName,
      firstName: familyLineageTable.firstName,
      lastName: familyLineageTable.lastName,
      birthYear: familyLineageTable.birthYear,
      deathYear: familyLineageTable.deathYear,
      gender: familyLineageTable.gender,
      tribalNation: familyLineageTable.tribalNation,
      isDeceased: familyLineageTable.isDeceased,
      isAncestor: familyLineageTable.isAncestor,
      generationalPosition: familyLineageTable.generationalPosition,
      parentIds: familyLineageTable.parentIds,
      childrenIds: familyLineageTable.childrenIds,
      spouseIds: familyLineageTable.spouseIds,
      protectionLevel: familyLineageTable.protectionLevel,
      membershipStatus: familyLineageTable.membershipStatus,
      nameVariants: familyLineageTable.nameVariants,
      entraObjectId: familyLineageTable.entraObjectId,
      icwaEligible: familyLineageTable.icwaEligible,
      welfareEligible: familyLineageTable.welfareEligible,
      trustBeneficiary: familyLineageTable.trustBeneficiary,
      sourceType: familyLineageTable.sourceType,
      linkedProfileUserId: familyLineageTable.linkedProfileUserId,
      lineageTags: familyLineageTable.lineageTags,
      notes: familyLineageTable.notes,
      pendingReview: familyLineageTable.pendingReview,
      addedByMemberId: familyLineageTable.addedByMemberId,
      supportingDocumentName: familyLineageTable.supportingDocumentName,
      visibility: familyLineageTable.visibility,
      photoUrl: familyLineageTable.photoUrl,
      birthPlace: familyLineageTable.birthPlace,
      birthDate: familyLineageTable.birthDate,
      deathPlace: familyLineageTable.deathPlace,
      deathDate: familyLineageTable.deathDate,
      burialPlace: familyLineageTable.burialPlace,
      createdAt: familyLineageTable.createdAt,
    };

    // Sort: highest generational position first, NULLs last (isolated GEDCOM nodes go to end)
    const ORDER_BY = [
      sql`generational_position DESC NULLS LAST`,
      desc(familyLineageTable.createdAt),
    ] as const;

    let nodes;
    if (isChief) {
      // Chief / admin sees everything
      nodes = await db.select(baseSelect).from(familyLineageTable)
        .orderBy(...ORDER_BY)
        .limit(limit).offset(offset);
    } else {
      // Regular member: see official nodes + own nodes + tribal nodes from others
      nodes = await db.select(baseSelect).from(familyLineageTable)
        .where(
          or(
            eq(familyLineageTable.sourceType, "manual"),
            ...(currentUserId ? [eq(familyLineageTable.addedByMemberId, currentUserId)] : []),
            eq(familyLineageTable.visibility, "tribal"),
          )
        )
        .orderBy(...ORDER_BY)
        .limit(limit).offset(offset);

      // Strip sensitive fields from tribal nodes that belong to other members
      nodes = nodes.map((n) => {
        const isOwnNode = currentUserId && n.addedByMemberId === currentUserId;
        const isOfficial = n.sourceType === "manual";
        if (!isChief && !isOwnNode && !isOfficial) {
          return { ...n, notes: null, supportingDocumentName: null, lineageTags: [], entraObjectId: null };
        }
        return n;
      });
    }

    res.json({ nodes, page, limit, count: nodes.length });
  } catch (err) {
    next(err);
  }
});

// ── Self-linked node + immediate family ── always load the caller's own node ──
router.get("/self", requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user?.dbId ?? null;
    if (!currentUserId) { res.json({ nodes: [] }); return; }

    // Find the node linked to the current user's account
    const [selfNode] = await db
      .select()
      .from(familyLineageTable)
      .where(eq(familyLineageTable.linkedProfileUserId, currentUserId))
      .limit(1);

    if (!selfNode) { res.json({ nodes: [] }); return; }

    // Collect immediate family IDs (level 1: parents, children, spouses)
    const parentIds   = Array.isArray(selfNode.parentIds)   ? (selfNode.parentIds   as number[]) : [];
    const childrenIds = Array.isArray(selfNode.childrenIds) ? (selfNode.childrenIds as number[]) : [];
    const spouseIds   = Array.isArray(selfNode.spouseIds)   ? (selfNode.spouseIds   as number[]) : [];
    const level1Ids   = [...new Set([selfNode.id, ...parentIds, ...childrenIds, ...spouseIds])];

    // Fetch level 1 nodes so we can look up their parents (grandparents) and children
    const level1Nodes = level1Ids.length > 0
      ? await db.select().from(familyLineageTable).where(inArray(familyLineageTable.id, level1Ids))
      : [selfNode];

    // Level 2: grandparents (parents' parents + parents' spouses) + grandchildren
    const level2Ids: number[] = [];
    for (const n of level1Nodes) {
      const nParents   = Array.isArray(n.parentIds)   ? (n.parentIds   as number[]) : [];
      const nChildren  = Array.isArray(n.childrenIds) ? (n.childrenIds as number[]) : [];
      const nSpouses   = Array.isArray(n.spouseIds)   ? (n.spouseIds   as number[]) : [];
      level2Ids.push(...nParents, ...nChildren, ...nSpouses);
    }
    const uniqueLevel2 = [...new Set(level2Ids)].filter((id) => !level1Ids.includes(id));
    const level2Nodes = uniqueLevel2.length > 0
      ? await db.select().from(familyLineageTable).where(inArray(familyLineageTable.id, uniqueLevel2))
      : [];

    const allNodes = [...level1Nodes, ...level2Nodes];
    const seen = new Set<number>();
    const deduped = allNodes.filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });

    res.json({ nodes: deduped });
  } catch (err) {
    next(err);
  }
});

// ── My submissions — all nodes added by the current user ─────────────────
router.get("/my", requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user?.dbId ?? null;
    if (!currentUserId) {
      res.json({ nodes: [] });
      return;
    }

    const nodes = await db
      .select({
        id: familyLineageTable.id,
        fullName: familyLineageTable.fullName,
        firstName: familyLineageTable.firstName,
        lastName: familyLineageTable.lastName,
        birthYear: familyLineageTable.birthYear,
        gender: familyLineageTable.gender,
        tribalNation: familyLineageTable.tribalNation,
        notes: familyLineageTable.notes,
        generationalPosition: familyLineageTable.generationalPosition,
        membershipStatus: familyLineageTable.membershipStatus,
        pendingReview: familyLineageTable.pendingReview,
        visibility: familyLineageTable.visibility,
        sourceType: familyLineageTable.sourceType,
        addedByMemberId: familyLineageTable.addedByMemberId,
        supportingDocumentName: familyLineageTable.supportingDocumentName,
        createdAt: familyLineageTable.createdAt,
      })
      .from(familyLineageTable)
      .where(eq(familyLineageTable.addedByMemberId, currentUserId))
      .orderBy(desc(familyLineageTable.createdAt));

    res.json({ nodes });
  } catch (err) {
    next(err);
  }
});

router.get("/pending-reviews", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const pending = await db
      .select()
      .from(familyLineageTable)
      .where(eq(familyLineageTable.membershipStatus, "pending"))
      .orderBy(desc(familyLineageTable.createdAt))
      .limit(50);
    res.json(pending);
  } catch (err) {
    next(err);
  }
});

// ── Add a lineage node to the current officer's household ────────────────
// Appends the targetNodeId to the officer's own linked family_lineage record's
// spouseIds or childrenIds array (used by the Atlas to classify household_member).
router.post("/household/add", requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user?.dbId ?? null;
    if (!currentUserId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const roles = req.user?.roles ?? [];
    const canManageHousehold = roles.some((r) => ["trustee", "sovereign_admin", "admin", "elder", "officer"].includes(r));
    if (!canManageHousehold) {
      res.status(403).json({ error: "Officer or trustee role required to manage household" });
      return;
    }

    const { targetNodeId, relationship } = req.body as { targetNodeId?: number; relationship?: string };
    if (!targetNodeId || !["spouse", "child", "dependent"].includes(relationship ?? "")) {
      res.status(400).json({ error: "targetNodeId and relationship (spouse | child | dependent) are required" });
      return;
    }

    // Find the current user's linked lineage node
    const [userNode] = await db
      .select()
      .from(familyLineageTable)
      .where(eq(familyLineageTable.linkedProfileUserId, currentUserId))
      .limit(1);

    if (!userNode) {
      res.status(404).json({ error: "No lineage node is linked to your profile. Use 'This is me' on your node first." });
      return;
    }
    if (userNode.id === targetNodeId) {
      res.status(400).json({ error: "You cannot add yourself to your own household." });
      return;
    }

    // Verify target exists
    const [targetNode] = await db
      .select({ id: familyLineageTable.id, fullName: familyLineageTable.fullName })
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, targetNodeId))
      .limit(1);
    if (!targetNode) { res.status(404).json({ error: "Target lineage node not found" }); return; }

    const isSpouse = relationship === "spouse";
    const currentArray: number[] = isSpouse
      ? (Array.isArray(userNode.spouseIds)   ? (userNode.spouseIds   as number[]) : [])
      : (Array.isArray(userNode.childrenIds) ? (userNode.childrenIds as number[]) : []);

    if (currentArray.includes(targetNodeId)) {
      res.json({ success: true, alreadyAdded: true, message: `${targetNode.fullName} is already in your household.` });
      return;
    }

    const newArray = [...currentArray, targetNodeId];
    if (isSpouse) {
      await db.update(familyLineageTable)
        .set({ spouseIds: newArray, updatedAt: new Date() })
        .where(eq(familyLineageTable.id, userNode.id));
    } else {
      await db.update(familyLineageTable)
        .set({ childrenIds: newArray, updatedAt: new Date() })
        .where(eq(familyLineageTable.id, userNode.id));
    }

    logger.info({ userNodeId: userNode.id, targetNodeId, relationship, userId: currentUserId }, "Added lineage node to household");
    res.json({ success: true, alreadyAdded: false, message: `${targetNode.fullName} added to your household as ${relationship}.` });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/lineage/nodes/household/status ───────────────────────────────────
// Returns the household head's address + land status and computes inherited
// protections for every member (spouse, children, dependents).
// Logic: household membership confers Indian Country jurisdiction, IHS/Urban
// Indian health eligibility, and ICWA protections to all qualifying members —
// no separate address entry required. Basis: Snyder Act, IHCIA § 201,
// Worcester v. Georgia, 25 U.S.C. § 1903 (ICWA).
router.get("/household/status", requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user?.dbId ?? null;
    if (!currentUserId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [profile] = await db
      .select({
        apn:               profilesTable.apn,
        mailingAddress:    profilesTable.mailingAddress,
        landStatus:        profilesTable.landStatus,
        tribalLandCode:    profilesTable.tribalLandCode,
        landClassification: profilesTable.landClassification,
      })
      .from(profilesTable)
      .where(eq(profilesTable.userId, currentUserId))
      .limit(1);

    const [headNode] = await db
      .select({
        id:           familyLineageTable.id,
        fullName:     familyLineageTable.fullName,
        tribalNation: familyLineageTable.tribalNation,
        spouseIds:    familyLineageTable.spouseIds,
        childrenIds:  familyLineageTable.childrenIds,
      })
      .from(familyLineageTable)
      .where(eq(familyLineageTable.linkedProfileUserId, currentUserId))
      .limit(1);

    const apn            = profile?.apn ?? null;
    const address        = profile?.mailingAddress ?? null;
    const mailingAddress = profile?.mailingAddress ?? null;
    const landStatus     = profile?.landStatus ?? null;
    const tribalLandCode = profile?.tribalLandCode ?? null;

    const INDIAN_COUNTRY_STATUSES = new Set([
      "trust", "allotment", "tribal_government_land", "tribal_trust_stewardship",
      "protected_tribal_land", "sacred_cultural_land", "restricted_fee",
    ]);
    const isIndianCountry = !!((landStatus && INDIAN_COUNTRY_STATUSES.has(landStatus)) || tribalLandCode);

    const headTribalNation = headNode?.tribalNation ?? null;
    const ihsEligible        = !!headTribalNation && !!address;
    const urbanIndianEligible = !!headTribalNation;

    if (!headNode) {
      res.json({
        hasLinkedNode: false,
        apn, address, mailingAddress, landStatus, tribalLandCode, isIndianCountry,
        ihsEligible, urbanIndianEligible,
        members: [], memberCount: 0,
      });
      return;
    }

    const spouseIds: number[]   = Array.isArray(headNode.spouseIds)   ? (headNode.spouseIds   as number[]) : [];
    const childIds: number[]    = Array.isArray(headNode.childrenIds) ? (headNode.childrenIds as number[]) : [];
    const allMemberIds = [...spouseIds, ...childIds];

    type HouseholdMember = {
      id: number; fullName: string;
      relationship: "spouse" | "child_dependent";
      birthYear: number | null; tribalNation: string | null;
      inheritedAddress: string | null;
      inheritedLandStatus: string | null; inheritedTribalLandCode: string | null;
      isIndianCountry: boolean; ihsEligible: boolean;
      urbanIndianEligible: boolean; icwaProtected: boolean;
      protections: string[];
    };

    let members: HouseholdMember[] = [];

    if (allMemberIds.length > 0) {
      const memberNodes = await db
        .select({
          id: familyLineageTable.id, fullName: familyLineageTable.fullName,
          birthYear: familyLineageTable.birthYear, deathYear: familyLineageTable.deathYear,
          tribalNation: familyLineageTable.tribalNation,
        })
        .from(familyLineageTable)
        .where(inArray(familyLineageTable.id, allMemberIds));

      const currentYear = new Date().getFullYear();

      members = memberNodes.map(m => {
        const isSpouse    = spouseIds.includes(m.id);
        const relationship = isSpouse ? "spouse" : "child_dependent";
        const isMinor = !m.deathYear && m.birthYear != null && (currentYear - m.birthYear) < 18;
        const icwaProtected = !isSpouse && isMinor;

        const memberIhsEligible      = ihsEligible || (isIndianCountry && !!(m.tribalNation || headTribalNation));
        const memberUrbanIndianEligible = urbanIndianEligible || !!m.tribalNation;

        const protections: string[] = [];
        if (isIndianCountry)                 protections.push("Indian Country Jurisdiction");
        if (memberIhsEligible)               protections.push("IHS Eligible");
        if (memberUrbanIndianEligible)       protections.push("Urban Indian Health");
        if (icwaProtected)                   protections.push("ICWA Protected");
        if (isSpouse)                        protections.push("Sovereign Spousal Rights");

        return {
          id: m.id, fullName: m.fullName,
          relationship: relationship as "spouse" | "child_dependent",
          birthYear: m.birthYear ?? null, tribalNation: m.tribalNation ?? null,
          inheritedAddress: address,
          inheritedLandStatus: landStatus, inheritedTribalLandCode: tribalLandCode,
          isIndianCountry, ihsEligible: memberIhsEligible,
          urbanIndianEligible: memberUrbanIndianEligible, icwaProtected,
          protections,
        };
      });
    }

    res.json({
      hasLinkedNode: true,
      headName: headNode.fullName,
      headTribalNation,
      apn, address, mailingAddress, landStatus, tribalLandCode,
      isIndianCountry, ihsEligible, urbanIndianEligible,
      members, memberCount: members.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!node) {
      res.status(404).json({ error: "Lineage node not found" });
      return;
    }

    const parentIds = Array.isArray(node.parentIds) ? (node.parentIds as number[]) : [];
    const childrenIds = Array.isArray(node.childrenIds) ? (node.childrenIds as number[]) : [];
    const spouseIds = Array.isArray(node.spouseIds) ? (node.spouseIds as number[]) : [];

    const resolveNames = async (ids: number[]) => {
      if (ids.length === 0) return [];
      const rows = await Promise.all(
        ids.map((pid) =>
          db.select({ id: familyLineageTable.id, fullName: familyLineageTable.fullName, birthYear: familyLineageTable.birthYear, photoUrl: familyLineageTable.photoUrl })
            .from(familyLineageTable).where(eq(familyLineageTable.id, pid)).limit(1)
            .then((r) => r[0] ?? null)
        )
      );
      return rows.filter(Boolean);
    };

    // If the node is linked to a user profile, fetch enriched profile fields
    let profileData: {
      legalName: string | null;
      preferredName: string | null;
      tribalName: string | null;
      nickname: string | null;
      mailingAddress: string | null;
      lineageVerified: boolean | null;
      membershipVerified: boolean | null;
    } | null = null;

    if (node.linkedProfileUserId) {
      const [profile] = await db
        .select({
          legalName: profilesTable.legalName,
          preferredName: profilesTable.preferredName,
          tribalName: profilesTable.tribalName,
          nickname: profilesTable.nickname,
          mailingAddress: profilesTable.mailingAddress,
          lineageVerified: profilesTable.lineageVerified,
          membershipVerified: profilesTable.membershipVerified,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, node.linkedProfileUserId))
        .limit(1);
      profileData = profile ?? null;
    }

    const [parents, children, spouses] = await Promise.all([
      resolveNames(parentIds),
      resolveNames(childrenIds),
      resolveNames(spouseIds),
    ]);

    res.json({ ...node, _parents: parents, _children: children, _spouses: spouses, _profile: profileData });
  } catch (err) {
    next(err);
  }
});

// ── Member self-add route (any authenticated user) ───────────────────────
router.post("/member", requireAuth, async (req, res, next) => {
  try {
    const {
      fullName, firstName, lastName, birthYear, gender,
      tribalNation, relationshipType, parentIds, supportingDocumentName,
    } = req.body as Record<string, unknown>;

    if (!fullName || typeof fullName !== "string") {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    const validRelationships = [
      "child", "parent", "sibling", "half_sibling",
      "spouse", "grandchild", "aunt_uncle", "niece_nephew", "cousin",
    ];
    if (!relationshipType || !validRelationships.includes(String(relationshipType))) {
      res.status(400).json({ error: `relationshipType must be one of: ${validRelationships.join(", ")}` });
      return;
    }

    let callerId: number | null = req.user?.dbId ?? null;

    // Fallback: if dbId was not resolved during auth (transient DB error), look up by email now
    if (!callerId && req.user?.email) {
      try {
        const [dbUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, req.user.email)).limit(1);
        if (dbUser) callerId = dbUser.id;
      } catch { /* ignore — proceed without callerId */ }
    }

    // Look up the submitter's lineage node so we can auto-compute generation & parentIds
    let submitterNode: { id: number; generationalPosition: number | null; parentIds: unknown; spouseIds: unknown } | null = null;
    if (callerId) {
      const [found] = await db
        .select({
          id: familyLineageTable.id,
          generationalPosition: familyLineageTable.generationalPosition,
          parentIds: familyLineageTable.parentIds,
          spouseIds: familyLineageTable.spouseIds,
        })
        .from(familyLineageTable)
        .where(eq(familyLineageTable.linkedProfileUserId, callerId))
        .limit(1);
      submitterNode = found ?? null;
    }

    const submitterGen = submitterNode?.generationalPosition ?? 0;

    // Determine generationalPosition for the new node based on relationship
    const genByRelationship: Record<string, number> = {
      child: submitterGen - 1,
      grandchild: submitterGen - 2,
      niece_nephew: submitterGen - 1,
      sibling: submitterGen,
      half_sibling: submitterGen,
      spouse: submitterGen,
      cousin: submitterGen,
      parent: submitterGen + 1,
      aunt_uncle: submitterGen + 1,
    };
    const computedGen = genByRelationship[String(relationshipType)] ?? submitterGen;

    // Auto-resolve parentIds: merge caller-supplied IDs with relationship-inferred IDs
    const rawIds: unknown[] = Array.isArray(parentIds) ? parentIds : [];
    let pIds: number[] = rawIds
      .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
      .filter((v) => Number.isFinite(v) && v > 0);

    const submitterParentIds: number[] = Array.isArray(submitterNode?.parentIds)
      ? (submitterNode!.parentIds as unknown[]).map(Number).filter((v) => Number.isFinite(v) && v > 0)
      : [];

    // Auto-link: for child/grandchild, make the submitter's node a parent
    if ((relationshipType === "child" || relationshipType === "niece_nephew") && submitterNode) {
      if (!pIds.includes(submitterNode.id)) pIds = [submitterNode.id, ...pIds];
    }
    // For sibling/half_sibling, inherit the submitter's parents if none supplied
    if ((relationshipType === "sibling" || relationshipType === "half_sibling") && pIds.length === 0) {
      pIds = submitterParentIds;
    }

    pIds = [...new Set(pIds)].slice(0, 6);

    if (pIds.length > 0) {
      const existingNodes = await db.select({ id: familyLineageTable.id }).from(familyLineageTable);
      const validIds = new Set(existingNodes.map((r) => r.id));
      const invalid = pIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        res.status(400).json({ error: `Invalid parent node IDs: ${invalid.join(", ")}` });
        return;
      }
    }

    // Auto-resolve spouseIds for "spouse" relationship
    const newSpouseIds: number[] = [];
    if (relationshipType === "spouse" && submitterNode) {
      newSpouseIds.push(submitterNode.id);
    }

    const {
      visibility: visibilityRaw,
    } = req.body as Record<string, unknown>;
    const visibility = visibilityRaw === "tribal" ? "tribal" : "private";

    const [node] = await db
      .insert(familyLineageTable)
      .values({
        fullName,
        firstName: typeof firstName === "string" ? firstName : undefined,
        lastName: typeof lastName === "string" ? lastName : undefined,
        birthYear: typeof birthYear === "number" ? birthYear : undefined,
        gender: typeof gender === "string" ? gender : undefined,
        tribalNation: typeof tribalNation === "string" ? tribalNation : undefined,
        notes: `Relationship: ${relationshipType}`,
        parentIds: pIds,
        childrenIds: [],
        spouseIds: newSpouseIds,
        generationalPosition: computedGen,
        protectionLevel: "pending",
        membershipStatus: "pending",
        nameVariants: [],
        isDeceased: false,
        isAncestor: false,
        sourceType: "member_self",
        pendingReview: true,
        addedByMemberId: callerId,
        supportingDocumentName: typeof supportingDocumentName === "string" ? supportingDocumentName : undefined,
        visibility,
      })
      .returning();

    // Back-link: update parent nodes' childrenIds
    for (const parentId of pIds) {
      const [parent] = await db.select({ childrenIds: familyLineageTable.childrenIds }).from(familyLineageTable).where(eq(familyLineageTable.id, parentId)).limit(1);
      if (parent) {
        const existingChildren = Array.isArray(parent.childrenIds) ? (parent.childrenIds as number[]) : [];
        if (!existingChildren.includes(node.id)) {
          await db.update(familyLineageTable).set({ childrenIds: [...existingChildren, node.id] }).where(eq(familyLineageTable.id, parentId));
        }
      }
    }

    // Back-link: update submitter's spouseIds
    if (relationshipType === "spouse" && submitterNode) {
      const existingSpouses = Array.isArray(submitterNode.spouseIds) ? (submitterNode.spouseIds as number[]) : [];
      if (!existingSpouses.includes(node.id)) {
        await db.update(familyLineageTable).set({ spouseIds: [...existingSpouses, node.id] }).where(eq(familyLineageTable.id, submitterNode.id));
      }
    }

    // Back-link: for parent/aunt_uncle, add the new node to the submitter's parentIds
    if ((relationshipType === "parent" || relationshipType === "aunt_uncle") && submitterNode) {
      const [currentSubmitter] = await db
        .select({ parentIds: familyLineageTable.parentIds })
        .from(familyLineageTable)
        .where(eq(familyLineageTable.id, submitterNode.id))
        .limit(1);
      if (currentSubmitter) {
        const existingParentIds = Array.isArray(currentSubmitter.parentIds) ? (currentSubmitter.parentIds as number[]) : [];
        if (!existingParentIds.includes(node.id)) {
          await db.update(familyLineageTable)
            .set({ parentIds: [...existingParentIds, node.id], updatedAt: new Date() })
            .where(eq(familyLineageTable.id, submitterNode.id));
        }
      }
    }

    logger.info({ relationshipType, computedGen, submitterGen, newNodeId: node.id }, "Member self-add submitted");
    res.status(201).json(node);
  } catch (err) {
    next(err);
  }
});

// ── Approve a pending member-submitted node ───────────────────────────────
router.post("/:id/approve", requireAuth, async (req, res, next) => {
  try {
    if (!req.user || !canReviewPendingLineage(req.user.roles)) {
      res.status(403).json({ error: "Only officers, trustees, elders, and admins can approve submissions." });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Node not found" }); return; }
    if (!existing.pendingReview) { res.status(400).json({ error: "Node is not pending review" }); return; }

    // Determine protection level based on relationship stored in notes
    // Spouses and by-marriage members are NOT descendants — they are "member"
    const notesLower = (existing.notes ?? "").toLowerCase();
    const isSpouseRelation = notesLower.includes("relationship: spouse") || notesLower.includes("relationship: partner");
    const isAncestorRelation = notesLower.includes("relationship: parent") || notesLower.includes("relationship: grandparent");
    const approvedProtectionLevel = isSpouseRelation ? "member"
      : isAncestorRelation ? "ancestor"
      : "descendant";
    const approvedMembershipStatus = isSpouseRelation ? "confirmed" : "descendant";

    const [updated] = await db.update(familyLineageTable)
      .set({ pendingReview: false, membershipStatus: approvedMembershipStatus, protectionLevel: approvedProtectionLevel, updatedAt: new Date() })
      .where(eq(familyLineageTable.id, id))
      .returning();

    res.json({ approved: true, node: updated });
  } catch (err) {
    next(err);
  }
});

// ── Reject a pending member-submitted node ────────────────────────────────
router.post("/:id/reject", requireAuth, async (req, res, next) => {
  try {
    if (!req.user || !canReviewPendingLineage(req.user.roles)) {
      res.status(403).json({ error: "Only officers, trustees, elders, and admins can reject submissions." });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Node not found" }); return; }
    if (!existing.pendingReview) { res.status(400).json({ error: "Node is not pending review" }); return; }

    const body = req.body as Record<string, unknown>;
    const rejectionNote = typeof body.reason === "string" ? body.reason : "Rejected by administrator";

    const [updated] = await db.update(familyLineageTable)
      .set({
        sourceType: "archived",
        pendingReview: false,
        notes: `${existing.notes ?? ""}\n[Rejected: ${rejectionNote}]`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(familyLineageTable.id, id))
      .returning();

    res.json({ rejected: true, node: updated });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const {
      fullName, firstName, lastName, birthYear, deathYear, gender,
      tribalNation, tribalEnrollmentNumber, notes, generationalPosition,
      parentIds, icwaEligible, welfareEligible, trustBeneficiary,
      protectionLevel, nameVariants, isDeceased,
    } = req.body as Record<string, unknown>;

    if (!fullName || typeof fullName !== "string") {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    const pIds: number[] = Array.isArray(parentIds) ? (parentIds as number[]) : [];

    const [node] = await db
      .insert(familyLineageTable)
      .values({
        fullName,
        firstName: typeof firstName === "string" ? firstName : undefined,
        lastName: typeof lastName === "string" ? lastName : undefined,
        birthYear: typeof birthYear === "number" ? birthYear : undefined,
        deathYear: typeof deathYear === "number" ? deathYear : undefined,
        gender: typeof gender === "string" ? gender : undefined,
        tribalNation: typeof tribalNation === "string" ? tribalNation : undefined,
        tribalEnrollmentNumber: typeof tribalEnrollmentNumber === "string" ? tribalEnrollmentNumber : undefined,
        notes: typeof notes === "string" ? notes : undefined,
        generationalPosition: typeof generationalPosition === "number" ? generationalPosition : 0,
        parentIds: pIds,
        childrenIds: [],
        spouseIds: [],
        protectionLevel: typeof protectionLevel === "string" ? protectionLevel : "descendant",
        membershipStatus: typeof req.body.membershipStatus === "string" ? req.body.membershipStatus : "confirmed",
        nameVariants: Array.isArray(nameVariants) ? nameVariants : [],
        icwaEligible: typeof icwaEligible === "boolean" ? icwaEligible : undefined,
        welfareEligible: typeof welfareEligible === "boolean" ? welfareEligible : undefined,
        trustBeneficiary: typeof trustBeneficiary === "boolean" ? trustBeneficiary : undefined,
        isDeceased: typeof isDeceased === "boolean" ? isDeceased : false,
        isAncestor: true,
        sourceType: "manual",
      })
      .returning();

    for (const parentId of pIds) {
      const [parent] = await db.select({ childrenIds: familyLineageTable.childrenIds }).from(familyLineageTable).where(eq(familyLineageTable.id, parentId)).limit(1);
      if (parent) {
        const existing = Array.isArray(parent.childrenIds) ? (parent.childrenIds as number[]) : [];
        if (!existing.includes(node.id)) {
          await db.update(familyLineageTable).set({ childrenIds: [...existing, node.id] }).where(eq(familyLineageTable.id, parentId));
        }
      }
    }

    res.status(201).json(node);
  } catch (err) {
    next(err);
  }
});

// ── Member edits their own submission (pending fields) or visibility (any status) ──
router.patch("/member/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Node not found" }); return; }
    if (existing.addedByMemberId !== req.user.dbId) {
      res.status(403).json({ error: "You can only edit your own submissions." });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    // Visibility can always be changed by the owner (private ↔ tribal)
    if (body.visibility === "tribal" || body.visibility === "private") {
      updates.visibility = body.visibility;
    }

    // Other fields only editable while still pending review
    if (existing.pendingReview) {
      if (typeof body.fullName === "string" && body.fullName.trim()) updates.fullName = body.fullName.trim();
      if (typeof body.firstName === "string") updates.firstName = body.firstName || null;
      if (typeof body.lastName === "string") updates.lastName = body.lastName || null;
      if (typeof body.birthYear === "number") updates.birthYear = body.birthYear;
      if (body.birthYear === null) updates.birthYear = null;
      if (typeof body.gender === "string") updates.gender = body.gender || null;
      if (typeof body.tribalNation === "string") updates.tribalNation = body.tribalNation || null;
      if (typeof body.supportingDocumentName === "string") updates.supportingDocumentName = body.supportingDocumentName || null;
    }

    const [updated] = await db.update(familyLineageTable)
      .set(updates)
      .where(eq(familyLineageTable.id, id))
      .returning();

    res.json({ updated: true, node: updated });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Node not found" }); return; }

    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const allowed = ["fullName", "firstName", "lastName", "birthYear", "deathYear", "gender",
      "tribalNation", "tribalEnrollmentNumber", "notes", "generationalPosition",
      "icwaEligible", "welfareEligible", "trustBeneficiary", "protectionLevel",
      "nameVariants", "parentIds", "membershipStatus", "isDeceased", "isAncestor", "photoUrl",
      "birthPlace", "birthDate", "deathPlace", "deathDate", "burialPlace", "locationAddress"];

    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const [updated] = await db.update(familyLineageTable).set(updates).where(eq(familyLineageTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/link-self — any authenticated user may link their account to a node ──
// Rules:
// - The node must not already be linked to a DIFFERENT user
// - A user may only have one node linked to them (we clear any prior link first)
router.post("/:id/link-self", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const userId = req.user?.dbId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [node] = await db.select({
      id: familyLineageTable.id,
      fullName: familyLineageTable.fullName,
      linkedProfileUserId: familyLineageTable.linkedProfileUserId,
    }).from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);

    if (!node) { res.status(404).json({ error: "Node not found" }); return; }

    // Already linked to someone else → refuse
    if (node.linkedProfileUserId && node.linkedProfileUserId !== userId) {
      res.status(409).json({ error: "This node is already linked to another user's account." });
      return;
    }

    // Already linked to me → idempotent success
    if (node.linkedProfileUserId === userId) {
      res.json({ linked: true, nodeId: id, fullName: node.fullName, alreadyLinked: true });
      return;
    }

    // Clear any prior self-link for this user (only one "me" node allowed)
    await db.update(familyLineageTable)
      .set({ linkedProfileUserId: null, updatedAt: new Date() })
      .where(eq(familyLineageTable.linkedProfileUserId, userId));

    // Set the link
    await db.update(familyLineageTable)
      .set({ linkedProfileUserId: userId, updatedAt: new Date() })
      .where(eq(familyLineageTable.id, id));

    res.json({ linked: true, nodeId: id, fullName: node.fullName });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/verify", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!node) { res.status(404).json({ error: "Node not found" }); return; }
    if (node.membershipStatus !== "pending") {
      res.status(400).json({ error: "Node is not in pending status" });
      return;
    }

    await db.update(familyLineageTable).set({
      membershipStatus: "verified",
      protectionLevel: "descendant",
      updatedAt: new Date(),
    }).where(eq(familyLineageTable.id, id));

    if (node.linkedProfileUserId) {
      await db
        .insert(profilesTable)
        .values({ userId: node.linkedProfileUserId, lineageVerified: true, membershipVerified: true })
        .onConflictDoUpdate({
          target: profilesTable.userId,
          set: { lineageVerified: true, membershipVerified: true, updatedAt: new Date() },
        });

      await createNotification({
        userId: node.linkedProfileUserId,
        category: "lineage_approved",
        title: "Lineage Claim Approved",
        message: "Your lineage claim has been reviewed and approved. You now have verified descendant membership.",
        severity: "info",
        relatedId: id,
        relatedType: "family_lineage",
      });
    }

    logger.info({ nodeId: id, adminId: req.user?.dbId }, "Lineage node verified by admin");
    res.json({ verified: true, nodeId: id });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!node) { res.status(404).json({ error: "Node not found" }); return; }

    const reason = typeof (req.body as Record<string, unknown>).reason === "string"
      ? (req.body as Record<string, unknown>).reason as string
      : "Your lineage claim could not be verified at this time.";

    await db.update(familyLineageTable).set({
      membershipStatus: "rejected",
      protectionLevel: "pending",
      notes: `${node.notes ?? ""}\n[Rejected by admin: ${reason}]`.trim(),
      updatedAt: new Date(),
    }).where(eq(familyLineageTable.id, id));

    if (node.linkedProfileUserId) {
      await createNotification({
        userId: node.linkedProfileUserId,
        category: "lineage_rejected",
        title: "Lineage Claim Not Verified",
        message: `Your lineage claim was reviewed and could not be verified. Reason: ${reason}`,
        severity: "warning",
        relatedId: id,
        relatedType: "family_lineage",
      });
    }

    logger.info({ nodeId: id, adminId: req.user?.dbId }, "Lineage node rejected by admin");
    res.json({ rejected: true, nodeId: id });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/merge", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const sourceId = parseInt(String(req.params.id), 10);
    const targetId = parseInt(String((req.body as Record<string, unknown>).targetId), 10);

    if (isNaN(sourceId) || isNaN(targetId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
    if (sourceId === targetId) { res.status(400).json({ error: "Cannot merge a node into itself" }); return; }

    const [[source], [target]] = await Promise.all([
      db.select().from(familyLineageTable).where(eq(familyLineageTable.id, sourceId)).limit(1),
      db.select().from(familyLineageTable).where(eq(familyLineageTable.id, targetId)).limit(1),
    ]);

    if (!source) { res.status(404).json({ error: "Source node not found" }); return; }
    if (!target) { res.status(404).json({ error: "Target node not found" }); return; }

    const srcParentIds = Array.isArray(source.parentIds) ? (source.parentIds as number[]) : [];
    const srcChildrenIds = Array.isArray(source.childrenIds) ? (source.childrenIds as number[]) : [];
    const srcSpouseIds = Array.isArray(source.spouseIds) ? (source.spouseIds as number[]) : [];
    const srcNameVariants = Array.isArray(source.nameVariants) ? (source.nameVariants as string[]) : [];
    const tgtParentIds = Array.isArray(target.parentIds) ? (target.parentIds as number[]) : [];
    const tgtChildrenIds = Array.isArray(target.childrenIds) ? (target.childrenIds as number[]) : [];
    const tgtSpouseIds = Array.isArray(target.spouseIds) ? (target.spouseIds as number[]) : [];
    const tgtNameVariants = Array.isArray(target.nameVariants) ? (target.nameVariants as string[]) : [];

    const mergedParentIds = [...new Set([...tgtParentIds, ...srcParentIds.filter((id) => id !== targetId)])];
    const mergedChildrenIds = [...new Set([...tgtChildrenIds, ...srcChildrenIds.filter((id) => id !== targetId)])];
    const mergedSpouseIds = [...new Set([...tgtSpouseIds, ...srcSpouseIds.filter((id) => id !== targetId)])];
    const mergedNameVariants = [...new Set([...tgtNameVariants, source.fullName, ...srcNameVariants])];

    await db.update(familyLineageTable).set({
      parentIds: mergedParentIds,
      childrenIds: mergedChildrenIds,
      spouseIds: mergedSpouseIds,
      nameVariants: mergedNameVariants,
      updatedAt: new Date(),
    }).where(eq(familyLineageTable.id, targetId));

    await db.update(familyLineageTable).set({
      sourceType: "archived",
      parentIds: [],
      childrenIds: [],
      spouseIds: [],
      notes: `${source.notes ?? ""}\n[Merged into #${targetId} by admin]`.trim(),
      updatedAt: new Date(),
    }).where(eq(familyLineageTable.id, sourceId));

    const allOtherNodes = await db
      .select({ id: familyLineageTable.id, parentIds: familyLineageTable.parentIds, childrenIds: familyLineageTable.childrenIds, spouseIds: familyLineageTable.spouseIds })
      .from(familyLineageTable)
      .where(ne(familyLineageTable.id, sourceId));

    const replaceId = (arr: number[], fromId: number, toId: number) => {
      const replaced = arr.map((id) => (id === fromId ? toId : id));
      return [...new Set(replaced.filter((id) => id !== sourceId))];
    };

    for (const node of allOtherNodes) {
      const pIds = Array.isArray(node.parentIds) ? (node.parentIds as number[]) : [];
      const cIds = Array.isArray(node.childrenIds) ? (node.childrenIds as number[]) : [];
      const sIds = Array.isArray(node.spouseIds) ? (node.spouseIds as number[]) : [];

      const hasRef = pIds.includes(sourceId) || cIds.includes(sourceId) || sIds.includes(sourceId);
      if (!hasRef) continue;

      await db.update(familyLineageTable).set({
        parentIds: replaceId(pIds, sourceId, targetId),
        childrenIds: replaceId(cIds, sourceId, targetId),
        spouseIds: replaceId(sIds, sourceId, targetId),
        updatedAt: new Date(),
      }).where(eq(familyLineageTable.id, node.id));
    }

    const [updatedTarget] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, targetId)).limit(1);
    res.json({ merged: true, target: updatedTarget });
  } catch (err) {
    next(err);
  }
});

// ── Member deletes their own pending submission ────────────────────────────
router.delete("/member/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }

    if (!existing.pendingReview) {
      res.status(403).json({ error: "Only pending submissions can be deleted by the submitter. Contact a trustee to remove approved records." });
      return;
    }
    if (existing.addedByMemberId !== req.user.dbId) {
      res.status(403).json({ error: "You can only delete your own pending submissions." });
      return;
    }

    await db.delete(familyLineageTable).where(eq(familyLineageTable.id, id));
    logger.info({ id, userId: req.user.dbId }, "Member deleted own pending lineage submission");
    res.json({ deleted: id });
  } catch (err) {
    next(err);
  }
});

// ── Trustee hard-deletes any node and cleans up all references ────────────
router.delete("/:id", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }

    // Remove this id from every other node's parentIds / childrenIds / spouseIds
    const allOthers = await db
      .select({ id: familyLineageTable.id, parentIds: familyLineageTable.parentIds, childrenIds: familyLineageTable.childrenIds, spouseIds: familyLineageTable.spouseIds })
      .from(familyLineageTable)
      .where(ne(familyLineageTable.id, id));

    for (const node of allOthers) {
      const pIds = Array.isArray(node.parentIds) ? (node.parentIds as number[]) : [];
      const cIds = Array.isArray(node.childrenIds) ? (node.childrenIds as number[]) : [];
      const sIds = Array.isArray(node.spouseIds) ? (node.spouseIds as number[]) : [];
      if (!pIds.includes(id) && !cIds.includes(id) && !sIds.includes(id)) continue;
      await db.update(familyLineageTable).set({
        parentIds: pIds.filter((x) => x !== id),
        childrenIds: cIds.filter((x) => x !== id),
        spouseIds: sIds.filter((x) => x !== id),
        updatedAt: new Date(),
      }).where(eq(familyLineageTable.id, node.id));
    }

    await db.delete(familyLineageTable).where(eq(familyLineageTable.id, id));
    logger.info({ id, adminId: req.user?.dbId }, "Trustee hard-deleted lineage node");
    res.json({ deleted: id });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/lineage/family-units — all FAM records ─────────────────────────
router.get("/family-units", requireAuth, async (req, res, next) => {
  try {
    const familyUnits = await db
      .select({
        id:               familyUnitsTable.id,
        gedcomFamId:      familyUnitsTable.gedcomFamId,
        husbandId:        familyUnitsTable.husbandId,
        wifeId:           familyUnitsTable.wifeId,
        spouseIds:        familyUnitsTable.spouseIds,
        childIds:         familyUnitsTable.childIds,
        relationshipType: familyUnitsTable.relationshipType,
        sourceType:       familyUnitsTable.sourceType,
      })
      .from(familyUnitsTable);
    res.json({ familyUnits });
  } catch (err) {
    next(err);
  }
});

export default router;
