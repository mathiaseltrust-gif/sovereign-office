import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { atlasEventsTable, type InsertAtlasEvent } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { callAzureOpenAI } from "../../lib/azure-openai";
import { enrichLifeEventPlace } from "../../lib/place-normalization";

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
// Auth-required. Returns all family records visible to the requesting user:
//   • Deceased ancestors (is_deceased = true, is_ancestor = true OR added by user)
//   • Living immediate household (those in the user's own family record's
//     spouse_ids / children_ids, or the user's own linked record)
//   • Living extended family added by the user (is_deceased = false)
//
// Each row includes a record_status field:
//   "ancestor"         — deceased ancestor
//   "household_member" — living immediate household
//   "extended_family"  — living family outside immediate household
//
// Only non-sensitive fields are returned (no notes, no gender, no membershipStatus).
// Location resolution priority is enforced on the frontend — no location is
// defaulted to the user's current city/address for non-household records.
router.get("/ancestors", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "User must be registered in the system." });
      return;
    }

    // record_status classification uses a correlated EXISTS subquery to detect
    // household membership from the user's own family_lineage record's spouse_ids
    // and children_ids — no client-side array parameter binding needed.
    //
    // Location priority is enforced on the frontend:
    //   1. Verified lat/lng on family_lineage
    //   2. location_text from ancestral_timeline_events
    //   3. Tribal nation keyword geocoded to historical territory centroid
    //   4. null → "Location unknown" — never defaults to user's current city
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
        fl.location_address,
        fl.photo_url,
        fl.birth_place,
        fl.birth_date,
        fl.death_place,
        fl.death_date,
        fl.burial_place,
        tl.location        AS location_text,
        (tl.location IS NOT NULL) AS has_timeline_location,
        CASE
          WHEN fl.is_deceased = true THEN 'ancestor'
          WHEN EXISTS (
            SELECT 1 FROM family_lineage uf
            WHERE (uf.linked_profile_user_id = ${userId} OR uf.user_id = ${userId})
              AND (
                fl.id = uf.id
                OR (uf.spouse_ids IS NOT NULL AND uf.spouse_ids @> jsonb_build_array(fl.id))
                OR (uf.children_ids IS NOT NULL AND uf.children_ids @> jsonb_build_array(fl.id))
              )
          ) THEN 'household_member'
          ELSE 'extended_family'
        END AS record_status
      FROM family_lineage fl
      LEFT JOIN LATERAL (
        SELECT location
        FROM ancestral_timeline_events
        WHERE ancestor_id = fl.id AND location IS NOT NULL AND location != ''
        ORDER BY created_at DESC
        LIMIT 1
      ) tl ON true
      WHERE
        -- Deceased ancestors (system-wide or added by this user)
        (fl.is_deceased = true AND (fl.is_ancestor = true OR fl.added_by_member_id = ${userId}))
        -- Living family added by this user (household + extended)
        OR (fl.is_deceased = false AND fl.added_by_member_id = ${userId})
        -- Living household members from the user's own spouse_ids / children_ids
        OR EXISTS (
          SELECT 1 FROM family_lineage uf
          WHERE (uf.linked_profile_user_id = ${userId} OR uf.user_id = ${userId})
            AND (
              fl.id = uf.id
              OR (uf.spouse_ids IS NOT NULL AND uf.spouse_ids @> jsonb_build_array(fl.id))
              OR (uf.children_ids IS NOT NULL AND uf.children_ids @> jsonb_build_array(fl.id))
            )
        )
      ORDER BY
        CASE WHEN fl.is_deceased = true THEN 0 ELSE 1 END,
        fl.generational_position NULLS LAST,
        fl.full_name NULLS LAST
    `);

    const ancestorRows = result.rows as Array<{ id: number; [key: string]: unknown }>;
    const ids = ancestorRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
    const lifeEventsByPerson = new Map<number, unknown[]>();

    if (ids.length > 0) {
      const lifeEventRows = await db.execute(sql`
        SELECT
          person_id AS "personId",
          event_type AS "eventType",
          event_date AS "eventDate",
          event_year AS "eventYear",
          event_place AS "eventPlace",
          place_normalized AS "placeNormalized",
          county,
          state,
          country,
          source_type AS "sourceType",
          source_reference AS "sourceReference"
        FROM ancestor_life_events
        WHERE person_id IN (${sql.raw(ids.join(","))})
        ORDER BY COALESCE(event_year, 9999), event_type
      `);

      for (const row of lifeEventRows.rows as Array<{
        personId: number;
        eventType: string | null;
        eventDate: string | null;
        eventYear: number | null;
        eventPlace: string | null;
        placeNormalized: string | null;
        county: string | null;
        state: string | null;
        country: string | null;
        sourceType: string | null;
        sourceReference: string | null;
      }>) {
        const existing = lifeEventsByPerson.get(row.personId) ?? [];
        existing.push(enrichLifeEventPlace({
          eventType: row.eventType,
          eventDate: row.eventDate,
          eventYear: row.eventYear,
          eventPlace: row.eventPlace,
          placeNormalized: row.placeNormalized,
          county: row.county,
          state: row.state,
          country: row.country,
          sourceType: row.sourceType,
          sourceReference: row.sourceReference,
        }));
        lifeEventsByPerson.set(row.personId, existing);
      }
    }

    res.json(ancestorRows.map((row) => ({
      ...row,
      life_events: lifeEventsByPerson.get(Number(row.id)) ?? [],
    })));
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

// ── POST /api/atlas/ai-query ────────────────────────────────────────────────
// No auth required. Accepts a natural language query + optional compact
// ancestor summary. Returns map filters, a direct answer (if computable from
// the ancestor data), and suggested follow-up queries.
router.post("/ai-query", async (req, res, next) => {
  try {
    const { query, ancestorSummary } = req.body as {
      query?: string;
      ancestorSummary?: Array<{
        name: string;
        birthYear: number | null;
        deathYear: number | null;
        tribalNation: string | null;
        location: string | null;
      }>;
    };
    if (!query || typeof query !== "string" || !query.trim()) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const hasAncestors = Array.isArray(ancestorSummary) && ancestorSummary.length > 0;

    const ancestorBlock = hasAncestors
      ? `\nFAMILY ANCESTOR DATA (${ancestorSummary!.length} records):\n${ancestorSummary!
          .map((a, i) => {
            const years = (a.birthYear || a.deathYear)
              ? ` (b.${a.birthYear ?? "?"} – d.${a.deathYear ?? "?"})`
              : "";
            const nation = a.tribalNation ? `, ${a.tribalNation}` : "";
            const loc = a.location ? `, ${a.location}` : "";
            return `${i + 1}. ${a.name}${years}${nation}${loc}`;
          })
          .join("\n")}\n`
      : "\nNo ancestor data provided — user has not activated the Family Layer or is not signed in.\n";

    const systemPrompt = `You are an AI assistant for the Urban Indian Continuity Atlas — a historical map overlaying a family's Native ancestors onto US federal policies affecting tribal identity, land, and survival.

Your job has TWO parts:
1. DIRECTLY ANSWER the user's question using the family ancestor data below (when provided).
2. Set map FILTERS that visually highlight matching ancestors.
${ancestorBlock}
PART 1 — directAnswer:
- Scan each ancestor's birth/death years and tribal nation against the query's historical era.
- Name SPECIFIC ancestors (with birth/death years) who match. Give a count: "X of your Y ancestors match."
- If data is missing (no birth years), say what's missing and what you can still infer.
- If no ancestor data was provided, set canCompute: false and explain the Family Layer must be activated.
- Keep directAnswer to 2–4 sentences.

PART 2 — map filters:

exposureFilters (array of strings):
  Temporal: "alive_during","near_contemporary","born_before"
  Location: "location_match","has_tribal_nation"
  Policy era: "removal_era"[1830-1870],"allotment_era"[1887-1934],"boarding_school_era"[1875-1940],"census_era"[1880-1930],"jim_crow_era"[1900-1965],"urban_relocation_era"[1950-1975],"termination_era"[1945-1970]
  Impact: "reclassification_risk","health_access_impact","land_displacement","family_welfare_impact","urban_migration_impact","education_impact"
  Data quality: "has_location_data","has_dates","county_state_records"

activeEras (array): "colonial","early-republic","removal","reservation","post-civil-war","allotment","jim-crow","termination","wwii-migration","self-determination","modern"

yearRange (array of 2 ints: [startYear, endYear])

stateFilter (array of state name strings, e.g. ["Alabama","Mississippi"]):
  Set this WHENEVER the user mentions a US state by name. It filters the map to only show ancestors whose recorded location is in that state.
  Always combine with "location_match" in exposureFilters when a state is named.

message (string) — 1 sentence, second person, what the MAP now shows (distinct from directAnswer).

suggestedQueries (array of 2–3 {label, query} objects) — specific follow-up questions this Atlas CAN answer. Base them on what the user was trying to find. Always actionable and era-specific.

canCompute (boolean) — true if you answered from ancestor data, false if data was missing or question is unanswerable.

SOUTHEASTERN TRIBAL REMNANT HISTORY — use this when user asks about Alabama, Mississippi, Georgia, Florida, or "remnant groups":
  "Tribal nations still existing as remnant groups" = the post-Removal period (1830–1900) in the Southeast.
  After the Indian Removal Act (1830), most Southeastern nations were forcibly removed west, but remnant groups stayed:
    - Poarch Band of Creek Indians (Muscogee) — remained in Alabama
    - Eastern Band of Cherokee — remained in NC/TN mountains
    - Mississippi Band of Choctaw — remained in Mississippi
    - Seminole — some remained in Florida swamps
  Map this concept to: activeEras: ["removal","reservation","post-civil-war"], yearRange: [1830,1900]
  Key policies that affected Alabama remnant groups during this period:
    - Indian Removal Act 1830, Treaty of Dancing Rabbit Creek (Choctaw, 1830), Treaty of New Echota (Cherokee, 1835)
    - End of treaty-making era (1871) — remnant groups lost federal recognition pathways
    - Post-Reconstruction Jim Crow reclassification (1880s–1930s): Alabama/Mississippi states reclassified Native people as "colored" on census and vital records, erasing tribal identity
    - Walter Plecker's "paper genocide" circular letters reached Alabama county offices (1930s)
    - U.S. Census racial misclassification (1890–1930) directly targeted Southeastern remnant communities
  exposureFilters for this query type: ["removal_era","alive_during","land_displacement","reclassification_risk","county_state_records","location_match"]

RULES:
- Return ONLY valid JSON. No markdown, no text outside the JSON object.
- Combine filters — "reclassified" → jim_crow_era + reclassification_risk
- yearRange should match the most relevant policy window
- When a US state is named, always set stateFilter to that state's name(s)
- If unclear, return empty filters + helpful message + 3 suggested queries

Example (Alabama remnant tribes query with ancestors):
{"directAnswer":"3 of your 18 ancestors were alive in Alabama during the post-Removal remnant period: Sarah Creek (b.1841–d.1903, Muscogee), James Doe (b.1858, Alabama), and Ruth Hill (b.1872–d.1951). They would have faced land dispossession, census reclassification, and loss of federal recognition as remnant Creek families in Alabama.","canCompute":true,"exposureFilters":["removal_era","alive_during","land_displacement","reclassification_risk","location_match"],"activeEras":["removal","reservation","post-civil-war"],"yearRange":[1830,1900],"stateFilter":["Alabama"],"message":"Showing ancestors in Alabama during the tribal remnant period (1830–1900) and the policies that targeted them.","suggestedQueries":[{"label":"Jim Crow reclassification","query":"Show ancestors in Alabama who may have been reclassified from Native to colored on census records"},{"label":"Land records","query":"Show ancestors who may appear in Alabama county land deed or probate records"},{"label":"Creek removal","query":"Show ancestors connected to the Muscogee Creek nation who survived the 1832 removal"}]}`;

    const result = await callAzureOpenAI(
      systemPrompt,
      query.trim(),
      { maxTokens: 700, temperature: 0.1, timeoutMs: 25000 }
    );

    let parsed: {
      directAnswer?: string;
      canCompute?: boolean;
      exposureFilters?: string[];
      activeEras?: string[];
      yearRange?: [number, number];
      message?: string;
      suggestedQueries?: Array<{ label: string; query: string }>;
      stateFilter?: string[];
    } = {};

    try {
      const cleaned = result.content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      res.json({
        message: result.content.slice(0, 300),
        directAnswer: null,
        canCompute: false,
        exposureFilters: [],
        activeEras: [],
        yearRange: null,
        suggestedQueries: [],
      });
      return;
    }

    res.json({
      message: parsed.message ?? "Filters applied based on your query.",
      directAnswer: parsed.directAnswer ?? null,
      canCompute: parsed.canCompute ?? false,
      exposureFilters: Array.isArray(parsed.exposureFilters) ? parsed.exposureFilters : [],
      activeEras: Array.isArray(parsed.activeEras) ? parsed.activeEras : [],
      yearRange: Array.isArray(parsed.yearRange) && parsed.yearRange.length === 2 ? parsed.yearRange : null,
      suggestedQueries: Array.isArray(parsed.suggestedQueries) ? parsed.suggestedQueries : [],
      stateFilter: Array.isArray(parsed.stateFilter) ? parsed.stateFilter : [],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
