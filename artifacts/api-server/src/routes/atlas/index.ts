import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { atlasEventsTable, type InsertAtlasEvent } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
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

// ── GET /api/atlas/ancestors ────────────────────────────────────────────────
// Auth-required. Returns ONLY the requesting user's own deceased lineage
// entries (filtered by addedByMemberId). Only non-sensitive fields are
// returned — no notes, no membershipStatus, no gender, no photoUrl.
// The ancestor/deceased flag and lack of living-member data is enforced here.
router.get("/ancestors", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "User must be registered in the system." });
      return;
    }

    // LEFT JOIN LATERAL to ancestral_timeline_events to get the most recently
    // recorded location string for each ancestor from actual user records.
    // This is the authoritative source for ancestor placement on the map — the
    // fallback (tribal nation keyword heuristic) is secondary.
    const result = await db.execute(sql`
      SELECT
        fl.id,
        fl.full_name,
        fl.first_name,
        fl.last_name,
        fl.birth_year,
        fl.death_year,
        fl.tribal_nation,
        fl.generational_position,
        fl.is_ancestor,
        fl.is_deceased,
        fl.lineage_tags,
        fl.location_lat,
        fl.location_lng,
        tl.location        AS location_text,
        (tl.location IS NOT NULL) AS has_timeline_location
      FROM family_lineage fl
      LEFT JOIN LATERAL (
        SELECT location
        FROM ancestral_timeline_events
        WHERE ancestor_id = fl.id AND location IS NOT NULL AND location != ''
        ORDER BY created_at DESC
        LIMIT 1
      ) tl ON true
      WHERE fl.is_deceased = true
        AND (fl.is_ancestor = true OR fl.added_by_member_id = ${userId})
      ORDER BY fl.generational_position NULLS LAST, fl.full_name NULLS LAST
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/atlas/ancestors/context ───────────────────────────────────────
// Auth-required. Returns temporal + location overlap matches between the
// requesting user's own deceased ancestors and historical atlas events.
//
// Match quality signals computed:
//   relationship_type — alive_during | born_before | near_contemporary | era_overlap
//   confidence_level  — high | moderate | low
//   location_match    — true if tribal nation keyword maps to event's affected states
//
// Only safe, non-PII fields are returned (no notes, no gender, etc.)
router.get("/ancestors/context", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "User must be registered in the system." });
      return;
    }

    const result = await db.execute(sql`
      SELECT
        fl.id                AS ancestor_id,
        fl.full_name,
        fl.first_name,
        fl.last_name,
        fl.birth_year,
        fl.death_year,
        fl.tribal_nation,
        fl.generational_position,
        fl.is_ancestor,
        ae.id                AS atlas_event_db_id,
        ae.event_id,
        ae.title,
        ae.year,
        ae.era,
        ae.event_type,
        ae.policy_area,
        ae.severity_level,
        ae.affected_regions,
        ae.states_affected,
        ae.coordinate_lat,
        ae.coordinate_lng,
        ae.identity_impact,
        ae.reclassification_impact,
        ae.ancestor_relevance_note,
        ae.tags,
        -- ── Relationship type ──────────────────────────────────────────────
        CASE
          WHEN fl.birth_year IS NOT NULL AND fl.death_year IS NOT NULL
            AND fl.birth_year <= ae.year AND fl.death_year >= ae.year
            THEN 'alive_during'
          WHEN fl.birth_year IS NOT NULL AND fl.death_year IS NULL
            AND fl.birth_year <= ae.year
            THEN 'alive_during'
          WHEN fl.birth_year IS NOT NULL AND fl.birth_year <= ae.year + 20
            AND (fl.death_year IS NULL OR fl.death_year >= ae.year - 20)
            THEN 'near_contemporary'
          WHEN fl.birth_year IS NOT NULL AND fl.birth_year < ae.year
            THEN 'born_before'
          ELSE 'era_overlap'
        END AS relationship_type,
        -- ── Confidence level ───────────────────────────────────────────────
        CASE
          WHEN fl.birth_year IS NOT NULL AND fl.death_year IS NOT NULL
            AND fl.birth_year <= ae.year AND fl.death_year >= ae.year
            THEN 'high'
          WHEN fl.birth_year IS NOT NULL AND fl.death_year IS NULL
            AND fl.birth_year <= ae.year
            THEN 'moderate'
          WHEN fl.birth_year IS NOT NULL
            AND ABS(fl.birth_year - ae.year) <= 20
            THEN 'moderate'
          ELSE 'low'
        END AS confidence_level,
        -- ── Location match: tribal nation keyword → event affected states ──
        -- Maps well-known tribal nation name keywords to their primary
        -- homeland states and checks against ae.states_affected.
        CASE
          WHEN fl.tribal_nation IS NULL THEN false
          -- First word of tribal nation appears in affected_regions text
          WHEN ae.affected_regions::text ILIKE '%' || SPLIT_PART(fl.tribal_nation, ' ', 1) || '%'
            THEN true
          -- Oklahoma nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%cherokee%','%choctaw%','%chickasaw%','%creek%','%muscogee%',
              '%seminole%','%osage%','%comanche%','%kiowa%','%pawnee%',
              '%quapaw%','%seneca-cayuga%','%modoc%','%miami%','%shawnee%',
              '%ponca%','%tonkawa%','%caddo%','%wichita%'
            ])
            AND 'OK' = ANY(ae.states_affected)
          ) THEN true
          -- Southwest nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%navajo%','%diné%','%apache%','%pueblo%','%hopi%',
              '%zuni%','%tohono%','%yavapai%','%havasupai%','%akimel%'
            ])
            AND ('AZ' = ANY(ae.states_affected) OR 'NM' = ANY(ae.states_affected))
          ) THEN true
          -- Northern Plains nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%lakota%','%sioux%','%cheyenne%','%blackfeet%','%blackfoot%',
              '%crow%','%arikara%','%mandan%','%hidatsa%','%assiniboine%'
            ])
            AND ('SD' = ANY(ae.states_affected) OR 'ND' = ANY(ae.states_affected)
                 OR 'MT' = ANY(ae.states_affected) OR 'WY' = ANY(ae.states_affected))
          ) THEN true
          -- Great Lakes / Midwest nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%ojibwe%','%chippewa%','%menominee%','%potawatomi%','%oneida%',
              '%ho-chunk%','%winnebago%','%sauk%','%fox%','%mesquaki%'
            ])
            AND ('MN' = ANY(ae.states_affected) OR 'WI' = ANY(ae.states_affected)
                 OR 'MI' = ANY(ae.states_affected) OR 'IL' = ANY(ae.states_affected))
          ) THEN true
          -- Southeast nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%lumbee%','%catawba%','%eastern band%','%coharie%','%waccamaw%',
              '%tuscarora%','%meherrin%','%haliwa%'
            ])
            AND ('NC' = ANY(ae.states_affected) OR 'SC' = ANY(ae.states_affected)
                 OR 'VA' = ANY(ae.states_affected))
          ) THEN true
          -- Southeast / Gulf states nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%mississippi choctaw%','%choctaw%','%muscogee%'
            ])
            AND ('MS' = ANY(ae.states_affected) OR 'AL' = ANY(ae.states_affected)
                 OR 'LA' = ANY(ae.states_affected))
          ) THEN true
          -- Northeast nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%haudenosaunee%','%iroquois%','%mohawk%','%seneca%','%onondaga%',
              '%cayuga%','%oneida%','%lenape%','%delaware%','%wampanoag%',
              '%penobscot%','%passamaquoddy%','%abenaki%','%pequot%','%mohegan%',
              '%narragansett%','%mashpee%'
            ])
            AND ('NY' = ANY(ae.states_affected) OR 'PA' = ANY(ae.states_affected)
                 OR 'MA' = ANY(ae.states_affected) OR 'ME' = ANY(ae.states_affected)
                 OR 'CT' = ANY(ae.states_affected) OR 'RI' = ANY(ae.states_affected))
          ) THEN true
          -- Pacific Northwest nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%nez perce%','%yakama%','%lummi%','%chinook%','%tulalip%',
              '%puyallup%','%suquamish%','%makah%','%quinault%'
            ])
            AND ('WA' = ANY(ae.states_affected) OR 'OR' = ANY(ae.states_affected)
                 OR 'ID' = ANY(ae.states_affected))
          ) THEN true
          -- California nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%yurok%','%karuk%','%hupa%','%pomo%','%miwok%','%ohlone%',
              '%chumash%','%kumeyaay%','%cahuilla%','%tongva%','%luiseño%'
            ])
            AND 'CA' = ANY(ae.states_affected)
          ) THEN true
          -- Great Basin nations
          WHEN (
            fl.tribal_nation ILIKE ANY(ARRAY[
              '%paiute%','%shoshone%','%ute%','%washoe%','%goshute%','%bannock%'
            ])
            AND ('NV' = ANY(ae.states_affected) OR 'UT' = ANY(ae.states_affected)
                 OR 'ID' = ANY(ae.states_affected) OR 'CO' = ANY(ae.states_affected))
          ) THEN true
          ELSE false
        END AS location_match
      FROM family_lineage fl
      CROSS JOIN atlas_events ae
      WHERE
        fl.is_deceased = true
        AND (fl.is_ancestor = true OR fl.added_by_member_id = ${userId})
        AND (fl.birth_year IS NOT NULL OR fl.death_year IS NOT NULL)
        AND (
          (fl.birth_year IS NULL OR fl.birth_year <= ae.year + 30)
          AND (fl.death_year IS NULL OR fl.death_year >= ae.year - 30)
        )
      ORDER BY
        fl.last_name NULLS LAST,
        fl.first_name NULLS LAST,
        CASE ae.severity_level
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          ELSE 2
        END,
        ae.year
    `);
    res.json(result.rows);
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
