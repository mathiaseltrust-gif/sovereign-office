import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

type FLRow = typeof familyLineageTable.$inferSelect;

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").replace(/[.,\-']/g, "").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function richness(row: FLRow): number {
  let score = 0;
  if (row.birthYear) score += 3;
  if (row.deathYear) score += 2;
  if (row.gender) score++;
  if (row.tribalNation) score += 2;
  if (row.notes) score++;
  if (row.linkedProfileUserId) score += 5;
  if ((row.parentIds as number[])?.length) score += 2;
  if ((row.childrenIds as number[])?.length) score += 2;
  if ((row.spouseIds as number[])?.length) score++;
  if ((row.nameVariants as string[])?.length) score++;
  return score;
}

function mergeRecord(keep: FLRow, remove: FLRow): Partial<FLRow> {
  const parentIds = [...new Set([...(keep.parentIds as number[] ?? []), ...(remove.parentIds as number[] ?? [])])];
  const childrenIds = [...new Set([...(keep.childrenIds as number[] ?? []), ...(remove.childrenIds as number[] ?? [])])];
  const spouseIds = [...new Set([...(keep.spouseIds as number[] ?? []), ...(remove.spouseIds as number[] ?? [])])];
  const nameVariants = [...new Set([...(keep.nameVariants as string[] ?? []), ...(remove.nameVariants as string[] ?? []), keep.fullName, remove.fullName])];
  const lineageTags = [...new Set([...(keep.lineageTags as string[] ?? []), ...(remove.lineageTags as string[] ?? [])])];
  return {
    parentIds,
    childrenIds,
    spouseIds,
    nameVariants,
    lineageTags,
    birthYear: keep.birthYear ?? remove.birthYear ?? undefined,
    deathYear: keep.deathYear ?? remove.deathYear ?? undefined,
    gender: keep.gender ?? remove.gender ?? undefined,
    tribalNation: keep.tribalNation ?? remove.tribalNation ?? undefined,
    notes: [keep.notes, remove.notes].filter(Boolean).join(" | ") || undefined,
    isDeceased: keep.isDeceased || remove.isDeceased,
    icwaEligible: keep.icwaEligible || remove.icwaEligible,
    welfareEligible: keep.welfareEligible || remove.welfareEligible,
    trustBeneficiary: keep.trustBeneficiary || remove.trustBeneficiary,
    linkedProfileUserId: keep.linkedProfileUserId ?? remove.linkedProfileUserId ?? undefined,
    updatedAt: new Date(),
  };
}

async function rewriteRelationshipRefs(removedId: number, keptId: number): Promise<void> {
  const allNodes = await db.select({ id: familyLineageTable.id, parentIds: familyLineageTable.parentIds, childrenIds: familyLineageTable.childrenIds, spouseIds: familyLineageTable.spouseIds }).from(familyLineageTable);
  for (const node of allNodes) {
    const pids = (node.parentIds as number[] ?? []);
    const cids = (node.childrenIds as number[] ?? []);
    const sids = (node.spouseIds as number[] ?? []);
    const pHit = pids.includes(removedId);
    const cHit = cids.includes(removedId);
    const sHit = sids.includes(removedId);
    if (!pHit && !cHit && !sHit) continue;
    await db.update(familyLineageTable).set({
      parentIds: pHit ? [...new Set(pids.map(id => id === removedId ? keptId : id))] : pids,
      childrenIds: cHit ? [...new Set(cids.map(id => id === removedId ? keptId : id))] : cids,
      spouseIds: sHit ? [...new Set(sids.map(id => id === removedId ? keptId : id))] : sids,
    }).where(eq(familyLineageTable.id, node.id));
  }
}

// GET /api/lineage/duplicates — scan for exact and fuzzy duplicates
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const rows = await db.select().from(familyLineageTable).orderBy(familyLineageTable.fullName);

    // Group by normalized fullName
    const byName = new Map<string, FLRow[]>();
    for (const row of rows) {
      const key = normalize(row.fullName);
      const arr = byName.get(key) ?? [];
      arr.push(row);
      byName.set(key, arr);
    }

    const exact: { ids: number[]; name: string; birthYear: number | null; rows: { id: number; fullName: string; birthYear: number | null; deathYear: number | null; sourceType: string; createdAt: Date }[] }[] = [];
    const fuzzy: { ids: number[]; name: string; reason: string; rows: { id: number; fullName: string; birthYear: number | null; deathYear: number | null; sourceType: string; createdAt: Date }[] }[] = [];

    for (const [, group] of byName) {
      if (group.length < 2) continue;

      // Partition by birthYear — same name + same birthYear = exact duplicate
      const byBirth = new Map<string, FLRow[]>();
      for (const r of group) {
        const bk = r.birthYear != null ? String(r.birthYear) : "__null__";
        const arr = byBirth.get(bk) ?? [];
        arr.push(r);
        byBirth.set(bk, arr);
      }

      for (const [bk, bgroup] of byBirth) {
        if (bgroup.length < 2) continue;
        if (bk !== "__null__") {
          // Exact duplicate — same name + same birth year
          exact.push({
            ids: bgroup.map(r => r.id),
            name: bgroup[0].fullName,
            birthYear: bgroup[0].birthYear,
            rows: bgroup.map(r => ({ id: r.id, fullName: r.fullName, birthYear: r.birthYear, deathYear: r.deathYear, sourceType: r.sourceType, createdAt: r.createdAt })),
          });
        } else {
          // Same name, no birth year on either — fuzzy
          fuzzy.push({
            ids: bgroup.map(r => r.id),
            name: bgroup[0].fullName,
            reason: "Same name, birth year unknown on all — possible duplicate",
            rows: bgroup.map(r => ({ id: r.id, fullName: r.fullName, birthYear: r.birthYear, deathYear: r.deathYear, sourceType: r.sourceType, createdAt: r.createdAt })),
          });
        }
      }

      // Same name group but with different birth years — suggest manual review
      const differentYearGroup = group.filter(r => r.birthYear != null);
      const nullYearGroup = group.filter(r => r.birthYear == null);
      if (differentYearGroup.length >= 1 && nullYearGroup.length >= 1) {
        fuzzy.push({
          ids: group.map(r => r.id),
          name: group[0].fullName,
          reason: `Same name — ${differentYearGroup.length} with birth year, ${nullYearGroup.length} without — verify identity`,
          rows: group.map(r => ({ id: r.id, fullName: r.fullName, birthYear: r.birthYear, deathYear: r.deathYear, sourceType: r.sourceType, createdAt: r.createdAt })),
        });
      }
    }

    // Levenshtein fuzzy: check pairs with edit distance ≤ 2 and same birth year across different name groups
    const nameKeys = [...byName.keys()];
    for (let i = 0; i < nameKeys.length; i++) {
      for (let j = i + 1; j < nameKeys.length; j++) {
        const dist = levenshtein(nameKeys[i], nameKeys[j]);
        if (dist > 2) continue;
        const groupA = byName.get(nameKeys[i])!;
        const groupB = byName.get(nameKeys[j])!;
        for (const a of groupA) {
          for (const b of groupB) {
            if (a.birthYear != null && b.birthYear != null && a.birthYear === b.birthYear) {
              fuzzy.push({
                ids: [a.id, b.id],
                name: `${a.fullName} / ${b.fullName}`,
                reason: `Very similar names (${dist} character difference), same birth year ${a.birthYear} — likely same person`,
                rows: [a, b].map(r => ({ id: r.id, fullName: r.fullName, birthYear: r.birthYear, deathYear: r.deathYear, sourceType: r.sourceType, createdAt: r.createdAt })),
              });
            }
          }
        }
      }
    }

    logger.info({ exact: exact.length, fuzzy: fuzzy.length, total: rows.length }, "Duplicate scan complete");
    res.json({ total: rows.length, exact, fuzzy });
  } catch (err) {
    next(err);
  }
});

// POST /api/lineage/duplicates/auto-remove — remove all exact duplicates automatically
router.post("/auto-remove", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const rows = await db.select().from(familyLineageTable);

    const byKey = new Map<string, FLRow[]>();
    for (const row of rows) {
      if (row.birthYear == null) continue; // only auto-remove when birthYear is known
      const key = `${normalize(row.fullName)}::${row.birthYear}`;
      const arr = byKey.get(key) ?? [];
      arr.push(row);
      byKey.set(key, arr);
    }

    let removed = 0;
    let merged = 0;
    const removedIds: number[] = [];

    for (const [, group] of byKey) {
      if (group.length < 2) continue;
      // Keep the richest record; on tie, keep the oldest (lowest id)
      const sorted = group.sort((a, b) => richness(b) - richness(a) || a.id - b.id);
      const keep = sorted[0];
      const toRemove = sorted.slice(1);

      // Build merged data
      const mergedData = toRemove.reduce((acc, r) => {
        const temp = { ...keep, ...acc } as FLRow;
        return mergeRecord(temp, r) as Partial<FLRow>;
      }, mergeRecord(keep, toRemove[0]) as Partial<FLRow>);

      await db.update(familyLineageTable).set(mergedData).where(eq(familyLineageTable.id, keep.id));

      for (const r of toRemove) {
        await rewriteRelationshipRefs(r.id, keep.id);
        await db.delete(familyLineageTable).where(eq(familyLineageTable.id, r.id));
        removedIds.push(r.id);
        removed++;
      }
      merged++;
    }

    logger.info({ merged, removed }, "Auto-remove exact duplicates complete");
    res.json({ merged, removed, removedIds });
  } catch (err) {
    next(err);
  }
});

// POST /api/lineage/duplicates/merge — merge two specific records (keepId survives)
router.post("/merge", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const { keepId, removeId } = req.body as { keepId: number; removeId: number };
    if (!keepId || !removeId || keepId === removeId) {
      res.status(400).json({ error: "Provide distinct keepId and removeId" });
      return;
    }

    const [keep] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, keepId)).limit(1);
    const [remove] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, removeId)).limit(1);

    if (!keep || !remove) {
      res.status(404).json({ error: "One or both records not found" });
      return;
    }

    const mergedData = mergeRecord(keep, remove);
    await db.update(familyLineageTable).set(mergedData).where(eq(familyLineageTable.id, keepId));
    await rewriteRelationshipRefs(removeId, keepId);
    await db.delete(familyLineageTable).where(eq(familyLineageTable.id, removeId));

    logger.info({ keepId, removeId }, "Manual duplicate merge complete");
    res.json({ keepId, removedId: removeId, merged: mergedData });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lineage/duplicates/:id — hard delete a single record (no merge)
router.delete("/:id", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await rewriteRelationshipRefs(id, -1);
    await db.delete(familyLineageTable).where(eq(familyLineageTable.id, id));
    logger.info({ id }, "Hard-deleted lineage record");
    res.json({ deleted: id });
  } catch (err) {
    next(err);
  }
});

export default router;
