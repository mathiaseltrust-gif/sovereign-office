import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { familyLineageTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { analyzeAncestralAffiliation, analyzeAncestors, type AncestorInput } from "../../lib/tribal-affiliation-engine";
import { logger } from "../../lib/logger";

const router = Router();

// ── GET /api/ancestors/affiliations ────────────────────────────────────────
// Batch: run the tribal affiliation logic engine on all historical/deceased
// ancestor records in the system. Sovereign-auth required — the chief sees
// the full lineage, not just records they personally added.
router.get("/affiliations", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "User must be registered" });
      return;
    }

    const rows = await db
      .select({
        id: familyLineageTable.id,
        fullName: familyLineageTable.fullName,
        birthYear: familyLineageTable.birthYear,
        deathYear: familyLineageTable.deathYear,
        tribalNation: familyLineageTable.tribalNation,
        birthPlace: familyLineageTable.birthPlace,
        deathPlace: familyLineageTable.deathPlace,
        locationAddress: familyLineageTable.locationAddress,
        locationLat: familyLineageTable.locationLat,
        locationLng: familyLineageTable.locationLng,
        notes: familyLineageTable.notes,
        generationalPosition: familyLineageTable.generationalPosition,
      })
      .from(familyLineageTable)
      .where(or(
        eq(familyLineageTable.isDeceased, true),
        eq(familyLineageTable.isAncestor, true),
      ))
      .orderBy(familyLineageTable.generationalPosition, familyLineageTable.fullName);

    const inputs: AncestorInput[] = await Promise.all(
      rows.map(async r => ({
        id: r.id,
        fullName: r.fullName,
        birthYear: r.birthYear,
        deathYear: r.deathYear,
        tribalNation: r.tribalNation,
        birthPlace: r.birthPlace,
        deathPlace: r.deathPlace,
        locationAddress: r.locationAddress,
        locationLat: r.locationLat,
        locationLng: r.locationLng,
        notes: r.notes,
        generationalPosition: r.generationalPosition,
        descendantLocations: await fetchDescendantLocations(r.id),
      }))
    );

    const results = analyzeAncestors(inputs);

    logger.info({ userId, count: results.length }, "Batch ancestral affiliation analysis complete");
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ancestors/:id/affiliation ─────────────────────────────────────
// Single ancestor (sovereign-auth): run the tribal affiliation logic engine
// on one record owned by the authenticated user.
router.get("/:id/affiliation", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    const id = Number(req.params.id);

    if (!userId) {
      res.status(400).json({ error: "User must be registered" });
      return;
    }
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid ancestor id" });
      return;
    }

    const [row] = await db
      .select({
        id: familyLineageTable.id,
        fullName: familyLineageTable.fullName,
        birthYear: familyLineageTable.birthYear,
        deathYear: familyLineageTable.deathYear,
        tribalNation: familyLineageTable.tribalNation,
        birthPlace: familyLineageTable.birthPlace,
        deathPlace: familyLineageTable.deathPlace,
        locationAddress: familyLineageTable.locationAddress,
        locationLat: familyLineageTable.locationLat,
        locationLng: familyLineageTable.locationLng,
        notes: familyLineageTable.notes,
        generationalPosition: familyLineageTable.generationalPosition,
        addedByMemberId: familyLineageTable.addedByMemberId,
        isDeceased: familyLineageTable.isDeceased,
        parentIds: familyLineageTable.parentIds,
      })
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, id));

    if (!row) {
      res.status(404).json({ error: "Ancestor not found" });
      return;
    }

    if (row.addedByMemberId !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const input: AncestorInput = {
      id: row.id,
      fullName: row.fullName,
      birthYear: row.birthYear,
      deathYear: row.deathYear,
      tribalNation: row.tribalNation,
      birthPlace: row.birthPlace,
      deathPlace: row.deathPlace,
      locationAddress: row.locationAddress,
      locationLat: row.locationLat,
      locationLng: row.locationLng,
      notes: row.notes,
      generationalPosition: row.generationalPosition,
      descendantLocations: await fetchDescendantLocations(id),
    };

    const result = analyzeAncestralAffiliation(input);

    logger.info({ userId, ancestorId: id, confidence: result.confidence, affiliations: result.affiliations.length }, "Ancestral affiliation analysis complete");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ancestors/:id/affiliation-public ───────────────────────────────
// Public (no auth required) — used by the community dashboard profile page.
// Runs the tribal affiliation logic engine on any ancestor record, including
// descendant-continuity analysis. Historical research data — not personal.
router.get("/:id/affiliation-public", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid ancestor id" });
      return;
    }

    const [row] = await db
      .select({
        id: familyLineageTable.id,
        fullName: familyLineageTable.fullName,
        birthYear: familyLineageTable.birthYear,
        deathYear: familyLineageTable.deathYear,
        tribalNation: familyLineageTable.tribalNation,
        birthPlace: familyLineageTable.birthPlace,
        deathPlace: familyLineageTable.deathPlace,
        locationAddress: familyLineageTable.locationAddress,
        locationLat: familyLineageTable.locationLat,
        locationLng: familyLineageTable.locationLng,
        notes: familyLineageTable.notes,
        generationalPosition: familyLineageTable.generationalPosition,
        isDeceased: familyLineageTable.isDeceased,
        isAncestor: familyLineageTable.isAncestor,
        parentIds: familyLineageTable.parentIds,
      })
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, id));

    if (!row) {
      res.status(404).json({ error: "Ancestor not found" });
      return;
    }

    // Only serve historical records publicly — living members require sovereign auth
    if (!row.isDeceased && !row.isAncestor) {
      res.status(403).json({ error: "Affiliation analysis is only available for historical ancestor records" });
      return;
    }

    const descendantLocations = await fetchDescendantLocations(id);

    const input: AncestorInput = {
      id: row.id,
      fullName: row.fullName,
      birthYear: row.birthYear,
      deathYear: row.deathYear,
      tribalNation: row.tribalNation,
      birthPlace: row.birthPlace,
      deathPlace: row.deathPlace,
      locationAddress: row.locationAddress,
      locationLat: row.locationLat,
      locationLng: row.locationLng,
      notes: row.notes,
      generationalPosition: row.generationalPosition,
      descendantLocations,
    };

    const result = analyzeAncestralAffiliation(input);

    logger.info({ ancestorId: id, confidence: result.confidence, affiliations: result.affiliations.length, descendantCount: descendantLocations.length }, "Public ancestral affiliation analysis complete");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Helper: fetch all descendant location strings ──────────────────────────
// Looks for any lineage records whose parentIds array contains this ancestor's id.
// Also recursively fetches grandchildren (one generation deep is sufficient for
// the territorial continuity signal).
async function fetchDescendantLocations(ancestorId: number): Promise<string[]> {
  try {
    const childRows = await db
      .select({
        id: familyLineageTable.id,
        birthPlace: familyLineageTable.birthPlace,
        deathPlace: familyLineageTable.deathPlace,
        locationAddress: familyLineageTable.locationAddress,
        notes: familyLineageTable.notes,
      })
      .from(familyLineageTable)
      .where(sql`${familyLineageTable.parentIds} @> ${JSON.stringify([ancestorId])}::jsonb`);

    const locations: string[] = [];

    for (const child of childRows) {
      if (child.birthPlace) locations.push(child.birthPlace);
      if (child.deathPlace) locations.push(child.deathPlace);
      if (child.locationAddress) locations.push(child.locationAddress);
      if (child.notes) locations.push(child.notes);

      // One level of grandchildren
      const grandRows = await db
        .select({
          birthPlace: familyLineageTable.birthPlace,
          deathPlace: familyLineageTable.deathPlace,
          locationAddress: familyLineageTable.locationAddress,
        })
        .from(familyLineageTable)
        .where(sql`${familyLineageTable.parentIds} @> ${JSON.stringify([child.id])}::jsonb`);

      for (const g of grandRows) {
        if (g.birthPlace) locations.push(g.birthPlace);
        if (g.deathPlace) locations.push(g.deathPlace);
        if (g.locationAddress) locations.push(g.locationAddress);
      }
    }

    return locations;
  } catch {
    return [];
  }
}

export default router;
