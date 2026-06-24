import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { gedcomImportBatchesTable, gedcomStagingTable, familyLineageTable, familyUnitsTable, ancestorLifeEventsTable, ancestorMediaTable } from "@workspace/db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { parseGedcom, resolveRelationships, type GedcomLifeEvent, type GedcomMediaRef } from "../../lib/gedcom-parser";
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
            lifeEvents: indi.lifeEvents,
            mediaRefs: indi.mediaRefs,
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

    const conditions = [];
    if (batchId) conditions.push(eq(gedcomStagingTable.batchId, batchId));
    if (matchType) conditions.push(eq(gedcomStagingTable.matchType, matchType));
    if (status) conditions.push(eq(gedcomStagingTable.status, status));

    const orderBy = [
      sql`CASE match_type WHEN 'exact' THEN 0 WHEN 'probable' THEN 1 WHEN 'possible' THEN 2 ELSE 3 END`,
      gedcomStagingTable.fullName,
    ] as const;

    const rows = conditions.length > 0
      ? await db.select().from(gedcomStagingTable).where(and(...conditions)).orderBy(...orderBy)
      : await db.select().from(gedcomStagingTable).orderBy(...orderBy);

    res.json(rows);
  } catch (err) { next(err); }
});

// ── Life-event & media writer ─────────────────────────────────────────────────
// After a staging row is approved and we have a real lineage person_id, write
// the extracted life events and media references to their dedicated tables.

async function writeLifeEventsAndMedia(personId: number, staged: StagedRow): Promise<void> {
  const lifeEvents = (staged.lifeEvents as GedcomLifeEvent[] | null) ?? [];
  const mediaRefs  = (staged.mediaRefs  as GedcomMediaRef[]  | null) ?? [];

  if (lifeEvents.length > 0) {
    const rows = lifeEvents.map(ev => ({
      personId,
      eventType: ev.type,
      eventDate: ev.date ?? undefined,
      eventYear: ev.year ?? undefined,
      eventPlace: ev.place ?? undefined,
      eventPlaceConfidence: "documented" as const,
      atlasVisible: true,
      sourceType: "gedcom" as const,
    }));
    // Insert in batches of 50 to stay within parameter limits
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(ancestorLifeEventsTable).values(rows.slice(i, i + 50));
    }
  }

  if (mediaRefs.length > 0) {
    const rows = mediaRefs.map(m => ({
      personId,
      mediaFileRef: m.fileRef ?? undefined,
      mediaType: m.mediaForm ?? undefined,
      mediaTitle: m.title ?? undefined,
      isProfilePhoto: m.isProfilePhoto,
      sourceSystem: "gedcom" as const,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(ancestorMediaTable).values(rows.slice(i, i + 50));
    }
  }
}

// ── Merge helper ──────────────────────────────────────────────────────────────
// Enriches an existing family_lineage record with missing fields from a staged
// GEDCOM record. Only overwrites NULL / empty fields — never destroys existing data.

type StagedRow = typeof gedcomStagingTable.$inferSelect;

async function mergeIntoExisting(staged: StagedRow, ancestorId: number): Promise<{ id: number; fullName: string }> {
  const [existing] = await db.select().from(familyLineageTable)
    .where(eq(familyLineageTable.id, ancestorId)).limit(1);

  if (!existing) throw new Error(`Ancestor ${ancestorId} not found`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updatedAt: new Date() };

  if (!existing.firstName && staged.givenName)  updates.firstName = staged.givenName;
  if (!existing.lastName  && staged.surname)    updates.lastName  = staged.surname;
  if (!existing.birthYear && staged.birthYear)  updates.birthYear = staged.birthYear;
  if (!existing.deathYear && staged.deathYear)  updates.deathYear = staged.deathYear;
  if (!existing.gender    && staged.gender)     updates.gender    = staged.gender;
  if (!existing.isDeceased && (staged.deathYear || staged.deathDate)) updates.isDeceased = true;

  // Write dedicated place columns — never overwrite existing data
  if (!existing.birthPlace && staged.birthPlace)  updates.birthPlace = staged.birthPlace;
  if (!existing.birthDate  && staged.birthDate)   updates.birthDate  = staged.birthDate;
  if (!existing.deathPlace && staged.deathPlace)  updates.deathPlace = staged.deathPlace;
  if (!existing.deathDate  && staged.deathDate)   updates.deathDate  = staged.deathDate;

  // Burial place comes from life events (BURI tag)
  const lifeEvents = (staged.lifeEvents as GedcomLifeEvent[] | null) ?? [];
  const burialEvent = lifeEvents.find(e => e.type === "burial");
  if (!existing.burialPlace && burialEvent?.place) updates.burialPlace = burialEvent.place;

  // Profile photo reference (OBJE.FILE) → photoFilename if empty
  const mediaRefs = (staged.mediaRefs as GedcomMediaRef[] | null) ?? [];
  const profilePhoto = mediaRefs.find(m => m.isProfilePhoto) ?? mediaRefs[0];
  if (!existing.photoFilename && profilePhoto?.fileRef) updates.photoFilename = profilePhoto.fileRef;

  // Write location_address from GEDCOM place data if the record has none.
  // Atlas priority order: residence → birth → death/burial.
  if (!existing.locationAddress) {
    const residencePlace = lifeEvents.find(e => e.type === "residence")?.place;
    updates.locationAddress = residencePlace ?? staged.birthPlace ?? staged.deathPlace ?? undefined;
  }

  // Merge notes — only biographical notes and source citations, NOT place data
  // (places now live in their dedicated columns above)
  const gedcomNote = [
    staged.notes       ? staged.notes : null,
    (staged.sourceRecords as string[])?.length
      ? `GEDCOM sources: ${(staged.sourceRecords as string[]).join("; ")}`
      : null,
  ].filter(Boolean).join("\n");

  if (gedcomNote) {
    updates.notes = existing.notes
      ? `${existing.notes}\n\n[GEDCOM enrichment]\n${gedcomNote}`
      : gedcomNote;
  }

  // Merge lineage tags (deduplicated union)
  const existingTags = (existing.lineageTags as string[]) ?? [];
  const incomingTags = (staged.censusLabels as string[]) ?? [];
  updates.lineageTags = [...new Set([...existingTags, ...incomingTags, "gedcom-enriched"])];

  await db.update(familyLineageTable).set(updates).where(eq(familyLineageTable.id, ancestorId));

  return { id: existing.id, fullName: existing.fullName };
}

// ── Relationship-linking pass ─────────────────────────────────────────────────
// After records are approved we know each staging row's matchedAncestorId.
// Walk every approved row in the batch and resolve GEDCOM IDs → lineage IDs,
// then write parentIds / childrenIds / spouseIds back to family_lineage.
// This is what makes GEDCOM-imported nodes appear connected in the family tree.
async function linkRelationshipsForBatch(batchId: number): Promise<void> {
  const staged = await db.select().from(gedcomStagingTable).where(
    and(eq(gedcomStagingTable.batchId, batchId), eq(gedcomStagingTable.status, "approved")),
  );

  // gedcomId → lineage row id
  const gToL = new Map<string, number>();
  for (const r of staged) {
    if (r.gedcomId && r.matchedAncestorId) gToL.set(r.gedcomId, r.matchedAncestorId);
  }
  if (gToL.size === 0) return;

  for (const r of staged) {
    if (!r.matchedAncestorId) continue;

    const parentIds: number[] = [];
    if (r.fatherGedcomId) { const id = gToL.get(r.fatherGedcomId); if (id) parentIds.push(id); }
    if (r.motherGedcomId) { const id = gToL.get(r.motherGedcomId); if (id) parentIds.push(id); }

    const spouseIds: number[] = (Array.isArray(r.spouseGedcomIds) ? r.spouseGedcomIds as string[] : [])
      .map(g => gToL.get(g)).filter((id): id is number => id !== undefined);

    const childrenIds: number[] = (Array.isArray(r.childrenGedcomIds) ? r.childrenGedcomIds as string[] : [])
      .map(g => gToL.get(g)).filter((id): id is number => id !== undefined);

    if (parentIds.length === 0 && spouseIds.length === 0 && childrenIds.length === 0) continue;

    const [existing] = await db.select({
      parentIds: familyLineageTable.parentIds,
      childrenIds: familyLineageTable.childrenIds,
      spouseIds: familyLineageTable.spouseIds,
    }).from(familyLineageTable).where(eq(familyLineageTable.id, r.matchedAncestorId)).limit(1);
    if (!existing) continue;

    const exP = Array.isArray(existing.parentIds)   ? existing.parentIds   as number[] : [];
    const exC = Array.isArray(existing.childrenIds) ? existing.childrenIds as number[] : [];
    const exS = Array.isArray(existing.spouseIds)   ? existing.spouseIds   as number[] : [];

    await db.update(familyLineageTable).set({
      parentIds:   [...new Set([...exP, ...parentIds])],
      childrenIds: [...new Set([...exC, ...childrenIds])],
      spouseIds:   [...new Set([...exS, ...spouseIds])],
    }).where(eq(familyLineageTable.id, r.matchedAncestorId));
  }

  logger.info({ batchId, linked: staged.length }, "GEDCOM relationship linking complete");
}


type SkippedFamilyGroup = {
  key: string;
  reason: string;
  husbandId: number | null;
  wifeId: number | null;
  childIds: number[];
  missingIds: number[];
};

type BatchRelationshipSyncResult = {
  familyUnitsCreated: number;
  familyUnitsUpdated: number;
  siblingGroupsUpdated: number;
  skippedGroups: SkippedFamilyGroup[];
  errors: Array<{ key: string; message: string }>;
};

type ExistingFamilyUnit = typeof familyUnitsTable.$inferSelect;
type BatchFamilyGroup = { key: string; husbandId: number | null; wifeId: number | null; childIds: Set<number> };

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter((id) => Number.isFinite(id) && id > 0)
    : [];
}

function sameMembers(a: number[], b: number[]): boolean {
  const aa = [...new Set(a)].sort((x, y) => x - y).join(",");
  const bb = [...new Set(b)].sort((x, y) => x - y).join(",");
  return aa === bb;
}

function familyGroupIds(group: BatchFamilyGroup): number[] {
  return [group.husbandId, group.wifeId, ...group.childIds]
    .filter((id): id is number => id != null && Number.isFinite(id) && id > 0);
}

async function loadExistingLineageIds(groups: Iterable<BatchFamilyGroup>): Promise<Set<number>> {
  const ids = [...new Set([...groups].flatMap(familyGroupIds))];
  return loadExistingLineageIdsByIds(ids);
}

async function loadExistingLineageIdsByIds(ids: number[]): Promise<Set<number>> {
  ids = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return new Set<number>();
  const rows = await db.select({ id: familyLineageTable.id }).from(familyLineageTable).where(inArray(familyLineageTable.id, ids));
  return new Set(rows.map((row: { id: number }) => row.id));
}

function validateFamilyGroup(group: BatchFamilyGroup, existingLineageIds: Set<number>): { reason: string; missingIds: number[] } | null {
  const childIds = [...group.childIds];
  if (!group.husbandId && !group.wifeId && childIds.length === 0) return { reason: "empty family group", missingIds: [] };
  const missingIds = familyGroupIds(group).filter((id) => !existingLineageIds.has(id));
  if (missingIds.length > 0) return { reason: `stale mapped lineage IDs: ${missingIds.join(",")}`, missingIds };
  return null;
}

function skippedFamilyGroup(group: BatchFamilyGroup, reason: string, missingIds: number[]): SkippedFamilyGroup {
  return { key: group.key, reason, husbandId: group.husbandId, wifeId: group.wifeId, childIds: [...group.childIds], missingIds };
}

async function loadApprovedStagedForBatch(batchId: number): Promise<{ staged: StagedRow[]; gToL: Map<string, number> }> {
  const staged: StagedRow[] = await db.select().from(gedcomStagingTable).where(
    and(eq(gedcomStagingTable.batchId, batchId), eq(gedcomStagingTable.status, "approved")),
  );

  const gToL = new Map<string, number>();
  for (const row of staged) {
    if (row.gedcomId && row.matchedAncestorId) gToL.set(row.gedcomId, row.matchedAncestorId);
  }

  return { staged, gToL };
}

function buildFamilyGroupsFromStaged(staged: StagedRow[], gToL: Map<string, number>): Map<string, BatchFamilyGroup> {
  const familyGroups = new Map<string, BatchFamilyGroup>();

  for (const row of staged) {
    if (!row.matchedAncestorId) continue;
    const fatherId = row.fatherGedcomId ? gToL.get(row.fatherGedcomId) ?? null : null;
    const motherId = row.motherGedcomId ? gToL.get(row.motherGedcomId) ?? null : null;

    if (fatherId || motherId) {
      const key = `${fatherId ?? "none"}:${motherId ?? "none"}`;
      const group = familyGroups.get(key) ?? { key, husbandId: fatherId, wifeId: motherId, childIds: new Set<number>() };
      group.childIds.add(row.matchedAncestorId);
      familyGroups.set(key, group);
    }

    const spouseIds = (Array.isArray(row.spouseGedcomIds) ? row.spouseGedcomIds as string[] : [])
      .map((gid) => gToL.get(gid))
      .filter((id): id is number => id !== undefined);
    for (const spouseId of spouseIds) {
      const husbandId = row.gender === "female" ? spouseId : row.matchedAncestorId;
      const wifeId = row.gender === "female" ? row.matchedAncestorId : spouseId;
      const key = `${husbandId ?? "none"}:${wifeId ?? "none"}`;
      if (!familyGroups.has(key)) familyGroups.set(key, { key, husbandId, wifeId, childIds: new Set<number>() });
      if (!familyGroups.has(key)) familyGroups.set(key, { husbandId, wifeId, childIds: new Set<number>() });
    }
  }

  return familyGroups;
}

async function analyzeBatchRelationshipCoverage(batchId: number) {
  const { staged, gToL } = await loadApprovedStagedForBatch(batchId);
  const familyGroups = buildFamilyGroupsFromStaged(staged, gToL);
  const existingUnits: ExistingFamilyUnit[] = await db.select().from(familyUnitsTable);
  const existingLineageIds = await loadExistingLineageIds(familyGroups.values());
  const mappedLineageIds = [...new Set([...gToL.values()])];
  const existingMappedLineageIds = await loadExistingLineageIdsByIds(mappedLineageIds);
  const staleMappedLineageIds = mappedLineageIds.filter((id) => !existingMappedLineageIds.has(id));

  let existingFamilyUnits = 0;
  let missingFamilyUnits = 0;
  let siblingGroupsNeedingRepair = 0;
  const skippedGroups: SkippedFamilyGroup[] = [];

  for (const group of familyGroups.values()) {
    const invalidReason = validateFamilyGroup(group, existingLineageIds);
    if (invalidReason) {
      skippedGroups.push(skippedFamilyGroup(group, invalidReason.reason, invalidReason.missingIds));
      continue;
    }


    const childIds = [...group.childIds];
    const existing = existingUnits.find((unit: ExistingFamilyUnit) => {
      const sameParents = (unit.husbandId ?? null) === group.husbandId && (unit.wifeId ?? null) === group.wifeId;
      return sameParents && sameMembers(numberArray(unit.childIds), childIds);
    }) ?? existingUnits.find((unit: ExistingFamilyUnit) => {
      return (unit.husbandId ?? null) === group.husbandId && (unit.wifeId ?? null) === group.wifeId;
    });

    if (existing) existingFamilyUnits++;
    else missingFamilyUnits++;

    if (childIds.length > 1) {
      for (const childId of childIds) {
        const [child] = await db.select({ siblingIds: familyLineageTable.siblingIds }).from(familyLineageTable).where(eq(familyLineageTable.id, childId)).limit(1);
        const currentSiblings = numberArray(child?.siblingIds);
        if (!sameMembers(currentSiblings, [...new Set([...currentSiblings, ...childIds.filter((id) => id !== childId)])])) {
          siblingGroupsNeedingRepair++;
          break;
        }
      }
    }
  }

  return {
    batchId,
    approvedRows: staged.length,
    mappedGedcomIds: gToL.size,
    staleMappedLineageIds: staleMappedLineageIds.length,
    sampleStaleMappedLineageIds: staleMappedLineageIds.slice(0, 20),
    familyGroups: familyGroups.size,
    existingFamilyUnits,
    missingFamilyUnits,
    siblingGroupsNeedingRepair,
    skippedGroups,
  };
}

async function syncFamilyUnitsAndSiblingsForBatch(batchId: number): Promise<BatchRelationshipSyncResult> {
  const { staged, gToL } = await loadApprovedStagedForBatch(batchId);
  if (gToL.size === 0) return { familyUnitsCreated: 0, familyUnitsUpdated: 0, siblingGroupsUpdated: 0, skippedGroups: [], errors: [] };

  const familyGroups = buildFamilyGroupsFromStaged(staged, gToL);
  const existingUnits: ExistingFamilyUnit[] = await db.select().from(familyUnitsTable);
  const existingLineageIds = await loadExistingLineageIds(familyGroups.values());
  let familyUnitsCreated = 0;
  let familyUnitsUpdated = 0;
  let siblingGroupsUpdated = 0;
  const skippedGroups: SkippedFamilyGroup[] = [];
  const errors: Array<{ key: string; message: string }> = [];

  for (const group of familyGroups.values()) {
    const invalidReason = validateFamilyGroup(group, existingLineageIds);
    if (invalidReason) {
      skippedGroups.push(skippedFamilyGroup(group, invalidReason.reason, invalidReason.missingIds));
      continue;
    }

    const childIds = [...group.childIds];
    try {
      const existing = existingUnits.find((unit: ExistingFamilyUnit) => {
        const sameParents = (unit.husbandId ?? null) === group.husbandId && (unit.wifeId ?? null) === group.wifeId;
        return sameParents && sameMembers(numberArray(unit.childIds), childIds);
      }) ?? existingUnits.find((unit: ExistingFamilyUnit) => {
        return (unit.husbandId ?? null) === group.husbandId && (unit.wifeId ?? null) === group.wifeId;
      });

      if (existing) {
      const mergedChildIds = [...new Set([...numberArray(existing.childIds), ...childIds])];
      if (!sameMembers(numberArray(existing.childIds), mergedChildIds)) {
        await db.update(familyUnitsTable).set({ childIds: mergedChildIds, updatedAt: new Date() }).where(eq(familyUnitsTable.id, existing.id));
        familyUnitsUpdated++;
      }
    } else {
      const [created] = await db.insert(familyUnitsTable).values({
        husbandId: group.husbandId ?? undefined,
        wifeId: group.wifeId ?? undefined,
        spouseIds: [],
        childIds,
        relationshipType: "biological",
        sourceType: "gedcom",
      }).returning();
      existingUnits.push(created);
      familyUnitsCreated++;
    }

      if (childIds.length > 1) {
        for (const childId of childIds) {
          const [child] = await db.select({ siblingIds: familyLineageTable.siblingIds }).from(familyLineageTable).where(eq(familyLineageTable.id, childId)).limit(1);
          if (!child) continue;
          const currentSiblings = numberArray(child.siblingIds);
          const mergedSiblings = [...new Set([...currentSiblings, ...childIds.filter((id) => id !== childId)])];
          if (!sameMembers(currentSiblings, mergedSiblings)) {
            await db.update(familyLineageTable).set({ siblingIds: mergedSiblings, updatedAt: new Date() }).where(eq(familyLineageTable.id, childId));
            siblingGroupsUpdated++;
          }
        }
      }
    } catch (err) {
      errors.push({ key: group.key, message: err instanceof Error ? err.message : String(err) });
    }
  }

  logger.info({ batchId, familyUnitsCreated, familyUnitsUpdated, siblingGroupsUpdated, skippedGroups: skippedGroups.length, errors: errors.length }, "GEDCOM family units and siblings synchronized");
  return { familyUnitsCreated, familyUnitsUpdated, siblingGroupsUpdated, skippedGroups, errors };
}

// ── POST /api/ancestry/gedcom/staging/:id/approve ────────────────────────────
// For match_type === "new" (or ?force=new): inserts a new family_lineage record.
// For exact / probable / possible with a matchedAncestorId: merges missing fields
// into the existing record rather than creating a duplicate.
router.post("/staging/:id/approve", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const forceNew = req.query.force === "new";

    const [staged] = await db.select().from(gedcomStagingTable).where(eq(gedcomStagingTable.id, id)).limit(1);
    if (!staged) { res.status(404).json({ error: "Staged record not found" }); return; }
    if (staged.status === "approved") { res.status(409).json({ error: "Already approved" }); return; }

    const shouldMerge = !forceNew && staged.matchType !== "new" && !!staged.matchedAncestorId;
    let resultId: number;
    let resultName: string;

    if (shouldMerge) {
      // ── Merge path: enrich existing record with missing GEDCOM data ──────────
      const merged = await mergeIntoExisting(staged, staged.matchedAncestorId!);
      resultId   = merged.id;
      resultName = merged.fullName;
    } else {
      // ── Insert path: create a new lineage record ──────────────────────────────
      const isDeceased = !!staged.deathYear || !!staged.deathDate;

      // Notes only get biographical text and source citations — place data goes in dedicated columns
      const noteText = [
        staged.notes,
        (staged.sourceRecords as string[])?.length
          ? `Sources: ${(staged.sourceRecords as string[]).join("; ")}` : null,
      ].filter(Boolean).join("\n\n") || undefined;

      // Atlas priority order: residence → birth → death/burial
      const stagedLifeEvents = (staged.lifeEvents as GedcomLifeEvent[] | null) ?? [];
      const residencePlaceNew = stagedLifeEvents.find(e => e.type === "residence")?.place;
      const locationAddress = residencePlaceNew ?? staged.birthPlace ?? staged.deathPlace ?? undefined;

      // Burial place from BURI life event
      const burialEventNew = stagedLifeEvents.find(e => e.type === "burial");

      // Profile photo reference from OBJE.FILE
      const stagedMediaRefs = (staged.mediaRefs as GedcomMediaRef[] | null) ?? [];
      const profilePhotoNew = stagedMediaRefs.find(m => m.isProfilePhoto) ?? stagedMediaRefs[0];

      const [created] = await db.insert(familyLineageTable).values({
        firstName:       staged.givenName ?? undefined,
        lastName:        staged.surname   ?? undefined,
        fullName:        staged.fullName,
        birthYear:       staged.birthYear ?? undefined,
        birthDate:       staged.birthDate ?? undefined,
        birthPlace:      staged.birthPlace ?? undefined,
        deathYear:       staged.deathYear ?? undefined,
        deathDate:       staged.deathDate ?? undefined,
        deathPlace:      staged.deathPlace ?? undefined,
        burialPlace:     burialEventNew?.place ?? undefined,
        gender:          staged.gender    ?? undefined,
        notes:           noteText,
        locationAddress,
        photoFilename:   profilePhotoNew?.fileRef ?? undefined,
        lineageTags:     [...(staged.censusLabels as string[] ?? []), "gedcom-import"],
        sourceType:      "gedcom",
        isDeceased,
        isAncestor:    true,
        pendingReview: staged.matchType !== "new",
      }).returning();

      resultId   = created.id;
      resultName = created.fullName;
    }

    await db.update(gedcomStagingTable).set({
      status:              "approved",
      matchedAncestorId:   resultId,
      matchedAncestorName: resultName,
    }).where(eq(gedcomStagingTable.id, id));

    // Write extracted life events and media references to their dedicated tables
    await writeLifeEventsAndMedia(resultId, staged).catch(() => {});

    if (staged.batchId) {
      await db.execute(sql`
        UPDATE gedcom_import_batches
        SET approved_count = approved_count + 1, pending_count = GREATEST(pending_count - 1, 0)
        WHERE id = ${staged.batchId}
      `);
      // Re-run the full relationship pass for the batch so this node and any
      // previously-approved siblings now see each other's IDs.
      await linkRelationshipsForBatch(staged.batchId).catch(() => {});
      await syncFamilyUnitsAndSiblingsForBatch(staged.batchId).catch(() => {});
    }

    res.json({ approved: true, merged: shouldMerge, ancestorId: resultId, fullName: resultName });
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

// ── GET  /api/ancestry/gedcom/cleanup-unknown  → count only (no delete) ───────
// ── POST /api/ancestry/gedcom/cleanup-unknown  → delete and return count ──────
// Targets family_lineage records imported via GEDCOM with no name (fullName = "(Unknown)").

router.get("/cleanup-unknown", requireAuth, requireAdminOrTrustee, async (_req, res, next) => {
  try {
    const rows = await db.select({ id: familyLineageTable.id })
      .from(familyLineageTable)
      .where(
        and(
          eq(familyLineageTable.sourceType, "gedcom"),
          eq(familyLineageTable.fullName, "(Unknown)"),
        )
      );
    res.json({ count: rows.length });
  } catch (err) { next(err); }
});

router.post("/cleanup-unknown", requireAuth, requireAdminOrTrustee, async (_req, res, next) => {
  try {
    const deleted = await db.delete(familyLineageTable)
      .where(
        and(
          eq(familyLineageTable.sourceType, "gedcom"),
          eq(familyLineageTable.fullName, "(Unknown)"),
        )
      )
      .returning({ id: familyLineageTable.id });

    logger.info({ deleted: deleted.length }, "Cleaned up unknown GEDCOM records from family_lineage");
    res.json({ deleted: deleted.length });
  } catch (err) { next(err); }
});

// ── POST /api/ancestry/gedcom/staging/bulk-approve ───────────────────────────
// Bulk action for pending records in a batch.
// - matchTypes "new"                  → inserts new family_lineage records
// - matchTypes "exact"/"probable"/"possible" → merges missing fields into existing
// Pass matchTypes=["new"] to approve new-only; ["exact","probable","possible"] to merge all duplicates.
// NOTE: Records with no name data (fullName "(Unknown)") are automatically skipped
// and marked rejected so they never enter the lineage database.
router.post("/staging/bulk-approve", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const { batchId, matchTypes } = req.body as { batchId?: number; matchTypes?: string[] };
    const types = matchTypes ?? ["new"];

    const conditions = [
      eq(gedcomStagingTable.status, "pending"),
      inArray(gedcomStagingTable.matchType, types),
      ...(batchId ? [eq(gedcomStagingTable.batchId, batchId)] : []),
    ];

    const pending: StagedRow[] = await db.select().from(gedcomStagingTable).where(and(...conditions));

    // Auto-reject nameless records — never let "(Unknown)" into family_lineage
    const nameless = pending.filter((r: StagedRow) => !r.givenName && !r.surname && r.fullName === "(Unknown)");
    if (nameless.length > 0) {
      const namelessIds = nameless.map((r: StagedRow) => r.id);
      await db.update(gedcomStagingTable)
        .set({ status: "rejected" })
        .where(inArray(gedcomStagingTable.id, namelessIds));
      if (batchId) {
        await db.execute(sql`
          UPDATE gedcom_import_batches
          SET rejected_count = rejected_count + ${nameless.length},
              pending_count  = GREATEST(pending_count - ${nameless.length}, 0)
          WHERE id = ${batchId}
        `);
      }
    }

    // Only process records that actually have name data
    const toProcess = pending.filter((r: StagedRow) => r.givenName || r.surname || r.fullName !== "(Unknown)");

    if (toProcess.length === 0) {
      res.json({ approved: 0, merged: 0, skipped: nameless.length, message: "No valid named records found to approve" });
      return;
    }

    let approved = 0;
    let merged = 0;

    for (const staged of toProcess) {
      try {
        const shouldMerge = staged.matchType !== "new" && !!staged.matchedAncestorId;

        if (shouldMerge) {
          const mergedResult = await mergeIntoExisting(staged, staged.matchedAncestorId!);
          await db.update(gedcomStagingTable).set({
            status: "approved",
          }).where(eq(gedcomStagingTable.id, staged.id));
          await writeLifeEventsAndMedia(mergedResult.id, staged).catch(() => {});
          merged++;
        } else {
          const isDeceased = !!staged.deathYear || !!staged.deathDate;
          const noteText = [
            staged.notes,
            staged.birthPlace  ? `Birth place: ${staged.birthPlace}`  : null,
            staged.deathPlace  ? `Death place: ${staged.deathPlace}`  : null,
            (staged.sourceRecords as string[])?.length
              ? `Sources: ${(staged.sourceRecords as string[]).join("; ")}` : null,
          ].filter(Boolean).join("\n\n") || undefined;

          // Atlas priority order: residence → birth → death/burial
          const bulkLifeEvents = (staged.lifeEvents as GedcomLifeEvent[] | null) ?? [];
          const bulkResidencePlace = bulkLifeEvents.find(e => e.type === "residence")?.place;
          const bulkLocationAddress = bulkResidencePlace ?? staged.birthPlace ?? staged.deathPlace ?? undefined;
          const bulkBurialEvent = bulkLifeEvents.find(e => e.type === "burial");
          const bulkMediaRefs = (staged.mediaRefs as GedcomMediaRef[] | null) ?? [];
          const bulkProfilePhoto = bulkMediaRefs.find(m => m.isProfilePhoto) ?? bulkMediaRefs[0];

          const [bulkCreated] = await db.insert(familyLineageTable).values({
            firstName:       staged.givenName ?? undefined,
            lastName:        staged.surname   ?? undefined,
            fullName:        staged.fullName,
            birthYear:       staged.birthYear ?? undefined,
            birthDate:       staged.birthDate ?? undefined,
            birthPlace:      staged.birthPlace ?? undefined,
            deathYear:       staged.deathYear ?? undefined,
            deathDate:       staged.deathDate ?? undefined,
            deathPlace:      staged.deathPlace ?? undefined,
            burialPlace:     bulkBurialEvent?.place ?? undefined,
            gender:          staged.gender    ?? undefined,
            notes:           noteText,
            locationAddress: bulkLocationAddress,
            photoFilename:   bulkProfilePhoto?.fileRef ?? undefined,
            lineageTags:     [...(staged.censusLabels as string[] ?? []), "gedcom-import"],
            sourceType:      "gedcom",
            isDeceased,
            isAncestor:    true,
            pendingReview: false,
          }).returning();
          await db.update(gedcomStagingTable).set({
            status: "approved",
            matchedAncestorId:   bulkCreated.id,
            matchedAncestorName: bulkCreated.fullName,
          }).where(eq(gedcomStagingTable.id, staged.id));
          await writeLifeEventsAndMedia(bulkCreated.id, staged).catch(() => {});
          approved++;
        }
      } catch {
        // skip individual failures so one bad record doesn't block the rest
      }
    }

    const total = approved + merged;
    if (batchId && total > 0) {
      await db.execute(sql`
        UPDATE gedcom_import_batches
        SET approved_count = approved_count + ${total},
            pending_count  = GREATEST(pending_count - ${total}, 0)
        WHERE id = ${batchId}
      `);
    }

    // Wire up parentIds / childrenIds / spouseIds and rebuild family units/siblings for every approved record in the batch
    let relationshipSync: BatchRelationshipSyncResult | null = null;
    if (batchId) {
      await linkRelationshipsForBatch(batchId).catch(() => {});
      relationshipSync = await syncFamilyUnitsAndSiblingsForBatch(batchId).catch(() => null);
    }

    res.json({ approved, merged, total, matchTypes: types, relationshipSync });
  } catch (err) { next(err); }
});

// ── GET /api/ancestry/gedcom/batches/:id/relationship-audit ──────────────────
// Read-only coverage check for existing approved GEDCOM batches.
router.get("/batches/:id/relationship-audit", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const batchId = Number(req.params.id);
    if (!batchId) { res.status(400).json({ error: "Invalid batch ID" }); return; }
    const audit = await analyzeBatchRelationshipCoverage(batchId);
    res.json(audit);
  } catch (err) { next(err); }
});

// ── POST /api/ancestry/gedcom/batches/:id/link-relationships ─────────────────
// Re-run the relationship-linking pass for an already-approved batch.
// Useful to repair batches approved before this fix was deployed.
router.post("/batches/:id/link-relationships", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const batchId = Number(req.params.id);
    if (!batchId) { res.status(400).json({ error: "Invalid batch ID" }); return; }
    await linkRelationshipsForBatch(batchId);
    const relationshipSync = await syncFamilyUnitsAndSiblingsForBatch(batchId);
    res.json({ ok: true, batchId, relationshipSync });
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
