import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { gedcomImportBatchesTable, gedcomStagingTable, familyLineageTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { parseGedcom, resolveRelationships } from "../../lib/gedcom-parser";
import { logger } from "../../lib/logger";

const router = Router();

// ── Auth helpers ──────────────────────────────────────────────────────────────
function requireAdminOrTrustee(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
): void {
  const roles: string[] = (req as { user?: { roles?: string[] } }).user?.roles ?? [];
  if (!roles.some(r => ["trustee", "sovereign_admin", "admin"].includes(r))) {
    res.status(403).json({ error: "Requires admin or trustee role." });
    return;
  }
  next();
}

// ── Multer — memory storage (buffer), 25 MB limit ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".ged") || file.mimetype === "text/plain") {
      cb(null, true);
    } else {
      cb(new Error("Only .ged GEDCOM files are accepted"));
    }
  },
});

// ── Deduplication against family_lineage ─────────────────────────────────────

function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (!na || !nb) return 0;
  const setA = new Set(na.split(" "));
  const setB = new Set(nb.split(" "));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

interface DedupeResult {
  matchType: "exact" | "probable" | "possible" | "new";
  matchedAncestorId: number | null;
  matchedAncestorName: string | null;
  confidenceScore: number;
  duplicateGroupId: string | null;
}

async function deduplicateAgainstLineage(
  fullName: string,
  birthYear: number | null,
): Promise<DedupeResult> {
  try {
    const rows = await db
      .select({ id: familyLineageTable.id, fullName: familyLineageTable.fullName, birthYear: familyLineageTable.birthYear })
      .from(familyLineageTable)
      .limit(500);

    let best: DedupeResult = { matchType: "new", matchedAncestorId: null, matchedAncestorName: null, confidenceScore: 1.0, duplicateGroupId: null };

    for (const row of rows) {
      const nameSim = nameSimilarity(fullName, row.fullName ?? "");
      if (nameSim < 0.3) continue;

      const yearMatch = birthYear && row.birthYear
        ? Math.abs(birthYear - row.birthYear) <= 2
        : null;
      const yearClose = birthYear && row.birthYear
        ? Math.abs(birthYear - row.birthYear) <= 5
        : null;

      let matchType: DedupeResult["matchType"] = "new";
      let confidence = nameSim;

      if (nameSim >= 0.95 && (yearMatch === true || (yearMatch === null && yearClose === null))) {
        matchType = "exact";
        confidence = 0.98;
      } else if (nameSim >= 0.80 && (yearMatch === true || yearClose === true)) {
        matchType = "probable";
        confidence = 0.80;
      } else if (nameSim >= 0.60 && (yearClose === true || yearClose === null)) {
        matchType = "possible";
        confidence = 0.60;
      } else if (nameSim >= 0.50) {
        matchType = "possible";
        confidence = 0.50;
      }

      if (matchType !== "new" && confidence > (1 - best.confidenceScore)) {
        best = {
          matchType,
          matchedAncestorId: row.id,
          matchedAncestorName: row.fullName,
          confidenceScore: confidence,
          duplicateGroupId: matchType === "exact" ? `dup-${row.id}` : null,
        };
      }
    }

    return best;
  } catch {
    return { matchType: "new", matchedAncestorId: null, matchedAncestorName: null, confidenceScore: 1.0, duplicateGroupId: null };
  }
}

// ── POST /api/ancestry/gedcom/import ─────────────────────────────────────────
// Upload a .ged file, parse it, stage all individuals with dedup analysis.
router.post(
  "/import",
  requireAuth,
  requireAdminOrTrustee,
  upload.single("gedcom"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded. Send a .ged file as 'gedcom' field." });
        return;
      }

      const userId: number = (req as { user?: { id?: number } }).user?.id ?? 0;
      const filename = req.file.originalname;

      // Parse
      const parsed = parseGedcom(req.file.buffer);
      const relationships = resolveRelationships(parsed);

      logger.info({ filename, individuals: parsed.individuals.length, families: parsed.families.length, encoding: parsed.encoding }, "GEDCOM parsed");

      // Create batch record
      const [batch] = await db.insert(gedcomImportBatchesTable).values({
        filename,
        importedBy: userId,
        recordCount: parsed.individuals.length,
        pendingCount: parsed.individuals.length,
        status: "pending",
        notes: `Encoding: ${parsed.encoding}. Families: ${parsed.families.length}.`,
      }).returning();

      // Stage all individuals with dedup analysis
      let exactCount = 0, probableCount = 0, possibleCount = 0, newCount = 0;

      const stagingRows = await Promise.all(
        parsed.individuals.map(async (indi) => {
          const rel = relationships.get(indi.gedcomId);
          const dedup = await deduplicateAgainstLineage(indi.fullName, indi.birthYear);

          if (dedup.matchType === "exact") exactCount++;
          else if (dedup.matchType === "probable") probableCount++;
          else if (dedup.matchType === "possible") possibleCount++;
          else newCount++;

          return {
            batchId: batch.id,
            gedcomId: indi.gedcomId,
            fullName: indi.fullName || "(Unknown)",
            givenName: indi.givenName || null,
            surname: indi.surname || null,
            birthDate: indi.birthDate,
            birthYear: indi.birthYear,
            birthPlace: indi.birthPlace,
            deathDate: indi.deathDate,
            deathYear: indi.deathYear,
            deathPlace: indi.deathPlace,
            gender: indi.gender,
            fatherGedcomId: rel?.fatherGedcomId ?? null,
            motherGedcomId: rel?.motherGedcomId ?? null,
            spouseGedcomIds: rel?.spouseGedcomIds ?? [],
            childrenGedcomIds: rel?.childrenGedcomIds ?? [],
            censusLabels: indi.censusLabels,
            sourceRecords: indi.sources,
            notes: indi.notes.join("\n\n") || null,
            confidenceScore: dedup.confidenceScore,
            matchType: dedup.matchType,
            matchedAncestorId: dedup.matchedAncestorId,
            matchedAncestorName: dedup.matchedAncestorName,
            duplicateGroupId: dedup.duplicateGroupId,
            status: "pending",
          };
        })
      );

      if (stagingRows.length > 0) {
        // Insert in batches of 50
        for (let i = 0; i < stagingRows.length; i += 50) {
          await db.insert(gedcomStagingTable).values(stagingRows.slice(i, i + 50));
        }
      }

      // Update batch counts
      await db.update(gedcomImportBatchesTable).set({
        pendingCount: stagingRows.length,
      }).where(eq(gedcomImportBatchesTable.id, batch.id));

      logger.info({ batchId: batch.id, new: newCount, possible: possibleCount, probable: probableCount, exact: exactCount }, "GEDCOM staging complete");

      res.status(201).json({
        batchId: batch.id,
        filename,
        encoding: parsed.encoding,
        totalIndividuals: parsed.individuals.length,
        totalFamilies: parsed.families.length,
        matchSummary: { exact: exactCount, probable: probableCount, possible: possibleCount, new: newCount },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/ancestry/gedcom/batches ─────────────────────────────────────────
router.get("/batches", requireAuth, requireAdminOrTrustee, async (_req, res, next) => {
  try {
    const batches = await db.select().from(gedcomImportBatchesTable).orderBy(desc(gedcomImportBatchesTable.createdAt));
    res.json(batches);
  } catch (err) { next(err); }
});

// ── GET /api/ancestry/gedcom/staging ─────────────────────────────────────────
router.get("/staging", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const batchId = req.query.batchId ? Number(req.query.batchId) : null;
    const matchType = req.query.matchType as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions: ReturnType<typeof eq>[] = [];
    if (batchId) conditions.push(eq(gedcomStagingTable.batchId, batchId));
    if (matchType) conditions.push(eq(gedcomStagingTable.matchType, matchType));
    if (status) conditions.push(eq(gedcomStagingTable.status, status));

    let query = db.select().from(gedcomStagingTable).orderBy(
      sql`CASE match_type WHEN 'exact' THEN 0 WHEN 'probable' THEN 1 WHEN 'possible' THEN 2 ELSE 3 END`,
      gedcomStagingTable.fullName
    );

    if (conditions.length > 0) {
      const rows = await db.select().from(gedcomStagingTable)
        .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]}`)
        .orderBy(
          sql`CASE match_type WHEN 'exact' THEN 0 WHEN 'probable' THEN 1 WHEN 'possible' THEN 2 ELSE 3 END`,
          gedcomStagingTable.fullName,
        );
      res.json(rows);
      return;
    }

    const rows = await query;
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /api/ancestry/gedcom/staging/:id/approve ────────────────────────────
// Move a staged individual to official family_lineage table.
router.post("/staging/:id/approve", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [staged] = await db.select().from(gedcomStagingTable).where(eq(gedcomStagingTable.id, id)).limit(1);
    if (!staged) { res.status(404).json({ error: "Staged record not found" }); return; }
    if (staged.status === "approved") { res.status(409).json({ error: "Already approved" }); return; }

    const isDeceased = !!staged.deathYear || !!staged.deathDate;

    const [created] = await db.insert(familyLineageTable).values({
      firstName: staged.givenName ?? undefined,
      lastName: staged.surname ?? undefined,
      fullName: staged.fullName,
      birthYear: staged.birthYear ?? undefined,
      deathYear: staged.deathYear ?? undefined,
      gender: staged.gender ?? undefined,
      notes: [staged.notes, (staged.sourceRecords as string[])?.length ? `Sources: ${(staged.sourceRecords as string[]).join("; ")}` : ""].filter(Boolean).join("\n\n") || undefined,
      lineageTags: [...(staged.censusLabels as string[] ?? []), "gedcom-import"],
      sourceType: "gedcom",
      isDeceased,
      isAncestor: isDeceased || true,
      pendingReview: staged.matchType !== "new",
    }).returning();

    await db.update(gedcomStagingTable).set({
      status: "approved",
      matchedAncestorId: created.id,
      matchedAncestorName: created.fullName,
    }).where(eq(gedcomStagingTable.id, id));

    // Update batch approved count
    if (staged.batchId) {
      await db.execute(sql`
        UPDATE gedcom_import_batches
        SET approved_count = approved_count + 1, pending_count = GREATEST(pending_count - 1, 0)
        WHERE id = ${staged.batchId}
      `);
    }

    res.json({ approved: true, ancestorId: created.id, fullName: created.fullName });
  } catch (err) { next(err); }
});

// ── POST /api/ancestry/gedcom/staging/:id/reject ─────────────────────────────
router.post("/staging/:id/reject", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [staged] = await db.select().from(gedcomStagingTable).where(eq(gedcomStagingTable.id, id)).limit(1);
    if (!staged) { res.status(404).json({ error: "Staged record not found" }); return; }

    await db.update(gedcomStagingTable).set({ status: "rejected" }).where(eq(gedcomStagingTable.id, id));

    if (staged.batchId) {
      await db.execute(sql`
        UPDATE gedcom_import_batches
        SET rejected_count = rejected_count + 1, pending_count = GREATEST(pending_count - 1, 0)
        WHERE id = ${staged.batchId}
      `);
    }

    res.json({ rejected: true });
  } catch (err) { next(err); }
});

// ── POST /api/ancestry/gedcom/staging/bulk-approve ───────────────────────────
// Approve all pending "new" records in a batch
router.post("/staging/bulk-approve", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const { batchId, matchTypes } = req.body as { batchId?: number; matchTypes?: string[] };
    const types = matchTypes ?? ["new"];

    const pending = await db.select().from(gedcomStagingTable).where(
      sql`batch_id = ${batchId ?? null} AND status = 'pending' AND match_type = ANY(${sql`ARRAY[${sql.raw(types.map(t => `'${t}'`).join(","))}]::text[]`})`
    );

    if (pending.length === 0) {
      res.json({ approved: 0, message: "No matching pending records found" });
      return;
    }

    let approved = 0;
    for (const staged of pending) {
      try {
        const isDeceased = !!staged.deathYear || !!staged.deathDate;
        await db.insert(familyLineageTable).values({
          firstName: staged.givenName ?? undefined,
          lastName: staged.surname ?? undefined,
          fullName: staged.fullName,
          birthYear: staged.birthYear ?? undefined,
          deathYear: staged.deathYear ?? undefined,
          gender: staged.gender ?? undefined,
          notes: staged.notes ?? undefined,
          lineageTags: [...(staged.censusLabels as string[] ?? []), "gedcom-import"],
          sourceType: "gedcom",
          isDeceased,
          isAncestor: true,
          pendingReview: false,
        });
        await db.update(gedcomStagingTable).set({ status: "approved" }).where(eq(gedcomStagingTable.id, staged.id));
        approved++;
      } catch {
        // skip individual errors
      }
    }

    if (batchId) {
      await db.execute(sql`
        UPDATE gedcom_import_batches
        SET approved_count = approved_count + ${approved},
            pending_count = GREATEST(pending_count - ${approved}, 0)
        WHERE id = ${batchId}
      `);
    }

    res.json({ approved, total: pending.length });
  } catch (err) { next(err); }
});

// ── DELETE /api/ancestry/gedcom/staging/:id ───────────────────────────────────
router.delete("/staging/:id", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(gedcomStagingTable).where(eq(gedcomStagingTable.id, id));
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/ancestry/gedcom/batches/:id ───────────────────────────────────
router.delete("/batches/:id", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(gedcomImportBatchesTable).where(eq(gedcomImportBatchesTable.id, id));
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
