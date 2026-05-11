import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { familyLineageTable } from "@workspace/db";
import { like, or, eq, and, sql } from "drizzle-orm";
import { ensureCommunitySeeded } from "./seed";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    await ensureCommunitySeeded();
    const q = req.query.q as string | undefined;
    const pendingReview = req.query.pendingReview === "true" ? true : req.query.pendingReview === "false" ? false : undefined;
    const isDeceased = req.query.isDeceased === "true" ? true : req.query.isDeceased === "false" ? false : undefined;

    const conditions: ReturnType<typeof eq>[] = [];

    if (pendingReview !== undefined) {
      conditions.push(eq(familyLineageTable.pendingReview, pendingReview));
    }
    if (isDeceased !== undefined) {
      conditions.push(eq(familyLineageTable.isDeceased, isDeceased));
    }
    if (q) {
      const searchTerm = `%${q}%`;
      conditions.push(
        or(
          like(familyLineageTable.fullName, searchTerm),
          like(familyLineageTable.firstName, searchTerm),
          like(familyLineageTable.lastName, searchTerm),
          like(familyLineageTable.tribalNation, searchTerm),
          like(familyLineageTable.tribalEnrollmentNumber, searchTerm),
        ) as ReturnType<typeof eq>
      );
    }

    const rows = conditions.length > 0
      ? await db.select().from(familyLineageTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : await db.select().from(familyLineageTable);

    const members = rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      firstName: r.firstName,
      lastName: r.lastName,
      birthYear: r.birthYear,
      deathYear: r.deathYear,
      gender: r.gender,
      tribalNation: r.tribalNation,
      tribalEnrollmentNumber: r.tribalEnrollmentNumber,
      membershipStatus: r.membershipStatus,
      protectionLevel: r.protectionLevel,
      isDeceased: r.isDeceased,
      isAncestor: r.isAncestor,
      icwaEligible: r.icwaEligible,
      trustBeneficiary: r.trustBeneficiary,
      pendingReview: r.pendingReview,
      parentIds: (r.parentIds as number[]) ?? [],
      childrenIds: (r.childrenIds as number[]) ?? [],
      spouseIds: (r.spouseIds as number[]) ?? [],
      photoFilename: r.photoFilename,
      generationalPosition: r.generationalPosition,
      createdAt: r.createdAt.toISOString(),
    }));

    res.json(members);
  } catch (err) {
    next(err);
  }
});

router.get("/stats", async (_req, res, next) => {
  try {
    await ensureCommunitySeeded();
    const all = await db.select().from(familyLineageTable);

    const totalMembers = all.length;
    const deceasedMembers = all.filter((r) => r.isDeceased).length;
    const activeMembers = totalMembers - deceasedMembers;
    const pendingReview = all.filter((r) => r.pendingReview).length;
    const icwaEligible = all.filter((r) => r.icwaEligible).length;
    const trustBeneficiaries = all.filter((r) => r.trustBeneficiary).length;
    const tribalNations = [...new Set(all.map((r) => r.tribalNation).filter(Boolean) as string[])];

    res.json({
      totalMembers,
      activeMembers,
      deceasedMembers,
      pendingReview,
      icwaEligible,
      trustBeneficiaries,
      tribalNations,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      firstName, lastName, fullName, birthYear, deathYear, gender,
      tribalNation, tribalEnrollmentNumber, notes,
      isDeceased, isAncestor, icwaEligible, trustBeneficiary,
      pendingReview, generationalPosition,
    } = req.body as Record<string, unknown>;

    if (!fullName) {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    const [member] = await db.insert(familyLineageTable).values({
      firstName: (firstName as string) || null,
      lastName: (lastName as string) || null,
      fullName: fullName as string,
      birthYear: birthYear ? Number(birthYear) : null,
      deathYear: deathYear ? Number(deathYear) : null,
      gender: (gender as string) || null,
      tribalNation: (tribalNation as string) || null,
      tribalEnrollmentNumber: (tribalEnrollmentNumber as string) || null,
      notes: (notes as string) || null,
      isDeceased: Boolean(isDeceased),
      isAncestor: isAncestor !== undefined ? Boolean(isAncestor) : true,
      icwaEligible: icwaEligible !== undefined ? Boolean(icwaEligible) : null,
      trustBeneficiary: trustBeneficiary !== undefined ? Boolean(trustBeneficiary) : null,
      pendingReview: pendingReview !== undefined ? Boolean(pendingReview) : false,
      generationalPosition: generationalPosition ? Number(generationalPosition) : 0,
      sourceType: "manual",
    }).returning();

    res.status(201).json({
      id: member.id,
      fullName: member.fullName,
      firstName: member.firstName,
      lastName: member.lastName,
      createdAt: member.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [member] = await db
      .select()
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, id))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const parentIds = (member.parentIds as number[]) ?? [];
    const childrenIds = (member.childrenIds as number[]) ?? [];
    const spouseIds = (member.spouseIds as number[]) ?? [];

    const allRelatedIds = [...new Set([...parentIds, ...childrenIds, ...spouseIds])];

    let relatedRows: typeof member[] = [];
    if (allRelatedIds.length > 0) {
      relatedRows = await db
        .select()
        .from(familyLineageTable)
        .where(sql`${familyLineageTable.id} = ANY(ARRAY[${sql.raw(allRelatedIds.join(","))}]::int[])`);
    }

    const toSummary = (r: typeof member) => ({
      id: r.id,
      fullName: r.fullName,
      firstName: r.firstName,
      lastName: r.lastName,
      birthYear: r.birthYear,
      deathYear: r.deathYear,
      gender: r.gender,
      tribalNation: r.tribalNation,
      tribalEnrollmentNumber: r.tribalEnrollmentNumber,
      membershipStatus: r.membershipStatus,
      protectionLevel: r.protectionLevel,
      isDeceased: r.isDeceased,
      isAncestor: r.isAncestor,
      icwaEligible: r.icwaEligible,
      trustBeneficiary: r.trustBeneficiary,
      pendingReview: r.pendingReview,
      parentIds: (r.parentIds as number[]) ?? [],
      childrenIds: (r.childrenIds as number[]) ?? [],
      spouseIds: (r.spouseIds as number[]) ?? [],
      photoFilename: r.photoFilename,
      generationalPosition: r.generationalPosition,
      createdAt: r.createdAt.toISOString(),
    });

    const byId = new Map(relatedRows.map((r) => [r.id, r]));

    res.json({
      ...toSummary(member),
      notes: member.notes,
      welfareEligible: member.welfareEligible,
      lineageTags: (member.lineageTags as string[]) ?? [],
      sourceType: member.sourceType,
      updatedAt: member.updatedAt.toISOString(),
      parents: parentIds.map((pid) => byId.get(pid)).filter(Boolean).map(toSummary),
      children: childrenIds.map((cid) => byId.get(cid)).filter(Boolean).map(toSummary),
      spouses: spouseIds.map((sid) => byId.get(sid)).filter(Boolean).map(toSummary),
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    await db.delete(familyLineageTable).where(eq(familyLineageTable.id, id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
