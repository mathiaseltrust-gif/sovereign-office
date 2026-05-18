import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { familyLineageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { analyzeAncestralAffiliation, analyzeAncestors, type AncestorInput } from "../../lib/tribal-affiliation-engine";
import { logger } from "../../lib/logger";

const router = Router();

// ── GET /api/ancestors/affiliations ────────────────────────────────────────
// Batch: run the tribal affiliation logic engine on all of the
// current user's deceased ancestors. Returns one result per ancestor.
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
        locationAddress: familyLineageTable.locationAddress,
        locationLat: familyLineageTable.locationLat,
        locationLng: familyLineageTable.locationLng,
        notes: familyLineageTable.notes,
        generationalPosition: familyLineageTable.generationalPosition,
      })
      .from(familyLineageTable)
      .where(
        and(
          eq(familyLineageTable.addedByMemberId, userId),
          eq(familyLineageTable.isDeceased, true),
        )
      )
      .orderBy(familyLineageTable.generationalPosition, familyLineageTable.fullName);

    const inputs: AncestorInput[] = rows.map(r => ({
      id: r.id,
      fullName: r.fullName,
      birthYear: r.birthYear,
      deathYear: r.deathYear,
      tribalNation: r.tribalNation,
      locationAddress: r.locationAddress,
      locationLat: r.locationLat,
      locationLng: r.locationLng,
      notes: r.notes,
      generationalPosition: r.generationalPosition,
    }));

    const results = analyzeAncestors(inputs);

    logger.info({ userId, count: results.length }, "Batch ancestral affiliation analysis complete");
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ancestors/:id/affiliation ─────────────────────────────────────
// Single ancestor: run the tribal affiliation logic engine on one record.
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
        locationAddress: familyLineageTable.locationAddress,
        locationLat: familyLineageTable.locationLat,
        locationLng: familyLineageTable.locationLng,
        notes: familyLineageTable.notes,
        generationalPosition: familyLineageTable.generationalPosition,
        addedByMemberId: familyLineageTable.addedByMemberId,
        isDeceased: familyLineageTable.isDeceased,
      })
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, id));

    if (!row) {
      res.status(404).json({ error: "Ancestor not found" });
      return;
    }

    // Allow if this is a tribal-visible ancestor OR user added it
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
      locationAddress: row.locationAddress,
      locationLat: row.locationLat,
      locationLng: row.locationLng,
      notes: row.notes,
      generationalPosition: row.generationalPosition,
    };

    const result = analyzeAncestralAffiliation(input);

    logger.info({ userId, ancestorId: id, confidence: result.confidence, affiliations: result.affiliations.length }, "Ancestral affiliation analysis complete");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
