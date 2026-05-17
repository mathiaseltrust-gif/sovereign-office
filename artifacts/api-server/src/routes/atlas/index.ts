import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { atlasEventsTable, type InsertAtlasEvent } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAzureOpenAI } from "../../lib/azure-openai";

const router = Router();

router.get("/events", async (_req, res, next) => {
  try {
    const events = await db
      .select()
      .from(atlasEventsTable)
      .orderBy(atlasEventsTable.year);
    res.json(events);
  } catch (err) {
    next(err);
  }
});

router.post("/events/intake", requireAuth, async (req, res, next) => {
  try {
    const { rawText } = req.body as { rawText: string };
    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 10) {
      res.status(400).json({ error: "rawText is required and must be meaningful legal text" });
      return;
    }

    const systemPrompt = `You are an expert in federal Indian law, Indigenous history, and US policy history as it relates to Native American / Urban Indian communities. 

Your task is to extract structured event data from raw legal text (statutes, cases, congressional acts, executive orders, or scholarly excerpts). Return ONLY valid JSON with no markdown fences or extra commentary.

Extract the following fields (use null for any field you cannot determine with reasonable confidence):
{
  "eventId": "evt-auto-XXXX (generate a short slug from title + year)",
  "title": "Full official title of the act, case, or event",
  "shortTitle": "Common abbreviated name if any",
  "year": 1234 (4-digit year, required),
  "dateStart": "YYYY-MM-DD or YYYY if only year known",
  "dateEnd": "YYYY-MM-DD or null",
  "era": "One of: Pre-Removal, Removal-Era, Reservation-Era, Allotment-Era, Reorganization-Era, Termination-Era, Self-Determination-Era, Modern-Era",
  "eventType": "One of: federal_legislation, supreme_court_case, executive_order, federal_policy, state_action, military_action, treaty, regulatory_change",
  "policyArea": "One of: land_rights, identity_classification, healthcare, education, family_welfare, urban_relocation, tribal_sovereignty, economic_policy, religious_freedom, environmental",
  "description": "2-4 sentence factual description of what this law/case/event did",
  "plainLanguageSummary": "1-2 sentence plain-language explanation of the impact on Native families",
  "severityLevel": "One of: catastrophic, severe, moderate, beneficial, mixed",
  "identityImpact": "How this affected tribal enrollment, identity documentation, or federal recognition (or null)",
  "reclassificationImpact": "Whether this reclassified tribes or individuals (or null)",
  "continuityImpact": "How this impacted cultural or community continuity (or null)",
  "continuitySurvivalNote": "Notes on how communities adapted or survived despite this (or null)",
  "familyImpact": "Impact on Native family structures or child welfare (or null)",
  "urbanizationImpact": "Impact on urban migration or urban Indian communities (or null)",
  "healthAccessImpact": "Impact on healthcare access (or null)",
  "publicSchoolImpact": "Impact on education or school systems (or null)",
  "landImpact": "Impact on land ownership or trust land (or null)",
  "jurisdictionImpact": "Impact on tribal sovereignty or jurisdiction (or null)",
  "housingImpact": "Impact on housing (or null)",
  "laborMigrationImpact": "Impact on labor, employment, or migration patterns (or null)",
  "modernEffect": "How effects persist today (or null)",
  "ancestorRelevanceNote": "Why ancestors or descendants may care about this (or null)",
  "affectedPeople": "Who was primarily affected (e.g., 'All federally recognized tribes', 'Urban Indians in California', etc.) or null",
  "affectedRegions": ["array", "of", "US regions or state names"],
  "statesAffected": ["array", "of", "two-letter US state abbreviations"],
  "coordinateLat": null (decimal latitude of primary location if known),
  "coordinateLng": null (decimal longitude of primary location if known),
  "sourceTitle": "Official title of source document",
  "sourceUrl": "",
  "sourceType": "One of: federal_statute, supreme_court_case, executive_order, agency_rule, treaty",
  "citation": "Legal citation if applicable (e.g., '25 U.S.C. § 461' or '411 U.S. 164')",
  "publicLawNumber": "Public Law number if applicable (e.g., 'Pub. L. 83-280') or null",
  "tags": ["array", "of", "2-5 relevant keyword tags"]
}`;

    const userPrompt = `Extract structured event data from the following legal/historical text:\n\n${rawText.substring(0, 8000)}`;

    const result = await callAzureOpenAI(systemPrompt, userPrompt, {
      maxTokens: 2000,
      temperature: 0.1,
    });

    let extracted: Record<string, unknown>;
    let confidence = "medium";
    let notes = "";

    try {
      const cleaned = result.content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      extracted = JSON.parse(cleaned) as Record<string, unknown>;

      const fieldsPresent = Object.values(extracted).filter(v => v !== null && v !== "" && v !== undefined).length;
      if (fieldsPresent > 25) confidence = "high";
      else if (fieldsPresent > 15) confidence = "medium";
      else confidence = "low";
    } catch {
      res.status(422).json({ error: "AI could not parse a structured event from this text. Try pasting a cleaner excerpt of the primary source." });
      return;
    }

    res.json({ extracted, confidence, notes });
  } catch (err) {
    next(err);
  }
});

router.post("/events", requireAuth, async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;

    if (!body.eventId || !body.title || !body.year || !body.era || !body.eventType || !body.policyArea || !body.description || !body.plainLanguageSummary) {
      res.status(400).json({ error: "Required fields: eventId, title, year, era, eventType, policyArea, description, plainLanguageSummary" });
      return;
    }

    const [created] = await db
      .insert(atlasEventsTable)
      .values({
        eventId: String(body.eventId),
        title: String(body.title),
        shortTitle: body.shortTitle ? String(body.shortTitle) : null,
        year: Number(body.year),
        dateStart: body.dateStart ? String(body.dateStart) : null,
        dateEnd: body.dateEnd ? String(body.dateEnd) : null,
        era: String(body.era),
        eventType: String(body.eventType),
        policyArea: String(body.policyArea),
        description: String(body.description),
        plainLanguageSummary: String(body.plainLanguageSummary),
        severityLevel: body.severityLevel ? String(body.severityLevel) : "moderate",
        status: body.status ? String(body.status) : "active",
        identityImpact: body.identityImpact ? String(body.identityImpact) : null,
        reclassificationImpact: body.reclassificationImpact ? String(body.reclassificationImpact) : null,
        continuityImpact: body.continuityImpact ? String(body.continuityImpact) : null,
        continuitySurvivalNote: body.continuitySurvivalNote ? String(body.continuitySurvivalNote) : null,
        familyImpact: body.familyImpact ? String(body.familyImpact) : null,
        urbanizationImpact: body.urbanizationImpact ? String(body.urbanizationImpact) : null,
        healthAccessImpact: body.healthAccessImpact ? String(body.healthAccessImpact) : null,
        publicSchoolImpact: body.publicSchoolImpact ? String(body.publicSchoolImpact) : null,
        landImpact: body.landImpact ? String(body.landImpact) : null,
        jurisdictionImpact: body.jurisdictionImpact ? String(body.jurisdictionImpact) : null,
        housingImpact: body.housingImpact ? String(body.housingImpact) : null,
        laborMigrationImpact: body.laborMigrationImpact ? String(body.laborMigrationImpact) : null,
        modernEffect: body.modernEffect ? String(body.modernEffect) : null,
        ancestorRelevanceNote: body.ancestorRelevanceNote ? String(body.ancestorRelevanceNote) : null,
        affectedPeople: body.affectedPeople ? String(body.affectedPeople) : null,
        affectedRegions: Array.isArray(body.affectedRegions) ? (body.affectedRegions as string[]) : [],
        statesAffected: Array.isArray(body.statesAffected) ? (body.statesAffected as string[]) : [],
        coordinateLat: body.coordinateLat != null ? Number(body.coordinateLat) : null,
        coordinateLng: body.coordinateLng != null ? Number(body.coordinateLng) : null,
        sourceTitle: body.sourceTitle ? String(body.sourceTitle) : "",
        sourceUrl: body.sourceUrl ? String(body.sourceUrl) : "",
        sourceType: body.sourceType ? String(body.sourceType) : null,
        citation: body.citation ? String(body.citation) : null,
        publicLawNumber: body.publicLawNumber ? String(body.publicLawNumber) : null,
        tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
      })
      .returning();

    res.status(201).json(created);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "An event with this eventId already exists." });
      return;
    }
    next(err);
  }
});

router.patch("/events/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params["id"]), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid event id" });
      return;
    }

    const body = req.body as Record<string, unknown>;

    const patch: Partial<InsertAtlasEvent> = {};

    const strFields: (keyof InsertAtlasEvent)[] = ["title", "shortTitle", "dateStart", "dateEnd", "era", "eventType", "policyArea", "description", "plainLanguageSummary", "severityLevel", "status", "identityImpact", "reclassificationImpact", "continuityImpact", "continuitySurvivalNote", "familyImpact", "urbanizationImpact", "healthAccessImpact", "publicSchoolImpact", "landImpact", "jurisdictionImpact", "housingImpact", "laborMigrationImpact", "modernEffect", "ancestorRelevanceNote", "affectedPeople", "sourceTitle", "sourceUrl", "sourceType", "citation", "publicLawNumber"];
    for (const f of strFields) {
      if (f in body) (patch as Record<string, unknown>)[f] = body[f] != null ? String(body[f]) : null;
    }
    if ("year" in body) patch.year = Number(body.year);
    if ("coordinateLat" in body) patch.coordinateLat = body.coordinateLat != null ? Number(body.coordinateLat) : null;
    if ("coordinateLng" in body) patch.coordinateLng = body.coordinateLng != null ? Number(body.coordinateLng) : null;
    if ("affectedRegions" in body) patch.affectedRegions = Array.isArray(body.affectedRegions) ? (body.affectedRegions as string[]) : [];
    if ("statesAffected" in body) patch.statesAffected = Array.isArray(body.statesAffected) ? (body.statesAffected as string[]) : [];
    if ("tags" in body) patch.tags = Array.isArray(body.tags) ? (body.tags as string[]) : [];

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const [updated] = await db
      .update(atlasEventsTable)
      .set(patch)
      .where(eq(atlasEventsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
