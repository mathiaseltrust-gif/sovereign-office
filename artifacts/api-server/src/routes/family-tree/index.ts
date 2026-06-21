import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../auth/entra-guard";
import {
  parseLineageCsv,
  buildLineageGraph,
  storeLineage,
  getLineageForUser,
  getAncestorById,
  updateAncestor,
  linkAncestorToProfile,
  getKnowledgeOfSelfLinks,
  detectEligibility,
  buildLineageSummaryForIntake,
} from "../../engines/family-tree-engine";
import { db } from "@workspace/db";
import { ancestorLifeEventsTable, familyLineageTable, familyUnitsTable, identityNarrativesTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

async function getAncestorHistoricalContext(userId: number) {
  const result = await db.execute(sql`
    SELECT
      fl.id                AS ancestor_id,
      fl.full_name,
      fl.birth_year,
      fl.death_year,
      fl.tribal_nation,
      fl.birth_place,
      fl.death_place,
      fl.location_address,
      ae.event_id,
      ae.title,
      ae.year,
      ae.era,
      ae.event_type,
      ae.policy_area,
      ae.severity_level,
      ae.affected_regions,
      ae.identity_impact,
      ae.reclassification_impact,
      ae.ancestor_relevance_note,
      ae.plain_language_summary,
      ae.coordinate_lat,
      ae.coordinate_lng,
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
      CASE
        WHEN fl.tribal_nation IS NULL THEN false
        WHEN ae.affected_regions::text ILIKE '%' || SPLIT_PART(fl.tribal_nation, ' ', 1) || '%'
          THEN true
        WHEN (
          fl.tribal_nation ILIKE ANY(ARRAY['%cherokee%','%choctaw%','%chickasaw%','%creek%','%muscogee%','%seminole%','%osage%'])
          AND 'OK' = ANY(ae.states_affected)
        ) THEN true
        WHEN (
          fl.tribal_nation ILIKE ANY(ARRAY['%navajo%','%diné%','%apache%','%pueblo%','%hopi%','%zuni%'])
          AND ('AZ' = ANY(ae.states_affected) OR 'NM' = ANY(ae.states_affected))
        ) THEN true
        WHEN (
          fl.tribal_nation ILIKE ANY(ARRAY['%lakota%','%sioux%','%cheyenne%','%blackfeet%','%crow%'])
          AND ('SD' = ANY(ae.states_affected) OR 'ND' = ANY(ae.states_affected) OR 'MT' = ANY(ae.states_affected))
        ) THEN true
        WHEN (
          fl.tribal_nation ILIKE ANY(ARRAY['%lumbee%','%catawba%','%eastern band%','%coharie%','%tuscarora%'])
          AND ('NC' = ANY(ae.states_affected) OR 'SC' = ANY(ae.states_affected))
        ) THEN true
        WHEN (
          fl.tribal_nation ILIKE ANY(ARRAY['%ojibwe%','%chippewa%','%menominee%','%potawatomi%','%oneida%'])
          AND ('MN' = ANY(ae.states_affected) OR 'WI' = ANY(ae.states_affected) OR 'MI' = ANY(ae.states_affected))
        ) THEN true
        ELSE false
      END AS location_match
    FROM family_lineage fl
    CROSS JOIN atlas_events ae
    WHERE
      (fl.linked_profile_user_id = ${userId} OR fl.added_by_member_id = ${userId})
      AND (fl.birth_year IS NOT NULL OR fl.death_year IS NOT NULL)
      AND (
        (fl.birth_year IS NULL OR fl.birth_year <= ae.year + 30)
        AND (fl.death_year IS NULL OR fl.death_year >= ae.year - 30)
      )
    ORDER BY
      fl.full_name,
      CASE ae.severity_level WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
      ae.year
  `);

  type Row = {
    ancestor_id: number; full_name: string; birth_year: number | null;
    death_year: number | null; tribal_nation: string | null;
    birth_place: string | null; death_place: string | null; location_address: string | null;
    event_id: string; title: string; year: number; era: string;
    event_type: string | null; policy_area: string | null; severity_level: string;
    affected_regions: string | null; identity_impact: string | null;
    reclassification_impact: string | null; ancestor_relevance_note: string | null;
    plain_language_summary: string | null; coordinate_lat: number | null;
    coordinate_lng: number | null; relationship_type: string;
    confidence_level: string; location_match: boolean;
  };

  const byAncestor = new Map<number, {
    ancestorId: number; fullName: string; birthYear: number | null;
    deathYear: number | null; tribalNation: string | null;
    birthPlace: string | null; deathPlace: string | null; locationAddress: string | null;
    events: object[];
  }>();

  for (const r of result.rows as Row[]) {
    if (!byAncestor.has(r.ancestor_id)) {
      byAncestor.set(r.ancestor_id, {
        ancestorId: r.ancestor_id,
        fullName: r.full_name,
        birthYear: r.birth_year,
        deathYear: r.death_year,
        tribalNation: r.tribal_nation,
        birthPlace: r.birth_place,
        deathPlace: r.death_place,
        locationAddress: r.location_address,
        events: [],
      });
    }
    byAncestor.get(r.ancestor_id)!.events.push({
      eventId: r.event_id,
      title: r.title,
      year: r.year,
      era: r.era,
      eventType: r.event_type,
      policyArea: r.policy_area,
      severityLevel: r.severity_level,
      affectedRegions: r.affected_regions,
      identityImpact: r.identity_impact,
      reclassificationImpact: r.reclassification_impact,
      ancestorRelevanceNote: r.ancestor_relevance_note,
      plainLanguageSummary: r.plain_language_summary,
      coordinateLat: r.coordinate_lat,
      coordinateLng: r.coordinate_lng,
      relationshipType: r.relationship_type,
      confidenceLevel: r.confidence_level,
      locationMatch: r.location_match,
    });
  }

  return Array.from(byAncestor.values());
}

const router = Router();

const LIFE_EVENT_PRIORITY: Record<string, number> = {
  birth: 0,
  residence: 1,
  marriage: 2,
  death: 3,
  burial: 4,
};

type LifeEventApi = {
  event_type: string;
  event_date: string | null;
  event_year: number | null;
  event_place: string | null;
  latitude: number | null;
  longitude: number | null;
  place_normalized: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  source_type: string | null;
  source_reference: string | null;
  source_confidence: string | null;
  raw_payload: unknown | null;
};

function sortLifeEvents(events: LifeEventApi[]): LifeEventApi[] {
  return [...events].sort((a, b) => {
    const priorityA = LIFE_EVENT_PRIORITY[a.event_type] ?? 99;
    const priorityB = LIFE_EVENT_PRIORITY[b.event_type] ?? 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return (a.event_year ?? 9999) - (b.event_year ?? 9999);
  });
}

async function loadLifeEventsForPeople(personIds: number[]): Promise<Map<number, LifeEventApi[]>> {
  const ids = [...new Set(personIds.filter((id) => Number.isFinite(id) && id > 0))];
  const byPerson = new Map<number, LifeEventApi[]>();
  if (ids.length === 0) return byPerson;

  const rows = await db
    .select({
      personId: ancestorLifeEventsTable.personId,
      eventType: ancestorLifeEventsTable.eventType,
      eventDate: ancestorLifeEventsTable.eventDate,
      eventYear: ancestorLifeEventsTable.eventYear,
      eventPlace: ancestorLifeEventsTable.eventPlace,
      eventPlaceConfidence: ancestorLifeEventsTable.eventPlaceConfidence,
      eventSource: ancestorLifeEventsTable.eventSource,
      sourceType: ancestorLifeEventsTable.sourceType,
    })
    .from(ancestorLifeEventsTable)
    .where(inArray(ancestorLifeEventsTable.personId, ids));

  for (const row of rows) {
    const events = byPerson.get(row.personId) ?? [];
    events.push({
      event_type: row.eventType,
      event_date: row.eventDate ?? null,
      event_year: row.eventYear ?? null,
      event_place: row.eventPlace ?? null,
      latitude: null,
      longitude: null,
      place_normalized: null,
      county: null,
      state: null,
      country: null,
      source_type: row.sourceType ?? null,
      source_reference: row.eventSource ?? null,
      source_confidence: row.eventPlaceConfidence ?? null,
      raw_payload: null,
    });
    byPerson.set(row.personId, events);
  }

  for (const [personId, events] of byPerson.entries()) {
    byPerson.set(personId, sortLifeEvents(events));
  }

  return byPerson;
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];
}

function mergeIds(existing: unknown, additions: Array<number | null | undefined>): number[] {
  return [...new Set([...numberArray(existing), ...additions.filter((id): id is number => Number.isFinite(id) && !!id)])];
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp", "text/csv", "application/csv", "text/plain", "application/octet-stream"];
    if (allowed.some((t) => file.mimetype.startsWith(t.split("/")[0]) || file.mimetype === t)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}. Use JPG, PNG, or CSV.`));
    }
  },
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    if (!dbId) {
      res.json({ lineage: [], narratives: [], message: "No profile registered — lineage is session-only" });
      return;
    }
    const data = await getLineageForUser(dbId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/full", requireAuth, async (_req, res, next) => {
  try {
    const [lineageRows, familyUnits] = await Promise.all([
      db
        .select({
          id: familyLineageTable.id,
          fullName: familyLineageTable.fullName,
          firstName: familyLineageTable.firstName,
          lastName: familyLineageTable.lastName,
          birthYear: familyLineageTable.birthYear,
          deathYear: familyLineageTable.deathYear,
          birthDate: familyLineageTable.birthDate,
          deathDate: familyLineageTable.deathDate,
          birthPlace: familyLineageTable.birthPlace,
          deathPlace: familyLineageTable.deathPlace,
          burialPlace: familyLineageTable.burialPlace,
          gender: familyLineageTable.gender,
          tribalNation: familyLineageTable.tribalNation,
          parentIds: familyLineageTable.parentIds,
          childrenIds: familyLineageTable.childrenIds,
          spouseIds: familyLineageTable.spouseIds,
          siblingIds: familyLineageTable.siblingIds,
          sourceType: familyLineageTable.sourceType,
          linkedProfileUserId: familyLineageTable.linkedProfileUserId,
          generationalPosition: familyLineageTable.generationalPosition,
          protectionLevel: familyLineageTable.protectionLevel,
          membershipStatus: familyLineageTable.membershipStatus,
          pendingReview: familyLineageTable.pendingReview,
          photoUrl: familyLineageTable.photoUrl,
          visibility: familyLineageTable.visibility,
          isDeceased: familyLineageTable.isDeceased,
          isAncestor: familyLineageTable.isAncestor,
          locationLat: familyLineageTable.locationLat,
          locationLng: familyLineageTable.locationLng,
          locationAddress: familyLineageTable.locationAddress,
          createdAt: familyLineageTable.createdAt,
        })
        .from(familyLineageTable)
        .where(sql`COALESCE(${familyLineageTable.pendingReview}, false) = false AND COALESCE(${familyLineageTable.membershipStatus}, '') <> 'rejected'`)
        .orderBy(sql`${familyLineageTable.generationalPosition} DESC NULLS LAST`, familyLineageTable.id),
      db
        .select({
          id: familyUnitsTable.id,
          gedcomFamId: familyUnitsTable.gedcomFamId,
          husbandId: familyUnitsTable.husbandId,
          wifeId: familyUnitsTable.wifeId,
          spouseIds: familyUnitsTable.spouseIds,
          childIds: familyUnitsTable.childIds,
          relationshipType: familyUnitsTable.relationshipType,
          sourceType: familyUnitsTable.sourceType,
        })
        .from(familyUnitsTable),
    ]);

    const nodeById = new Map(lineageRows.map((node) => [node.id, { ...node }]));
    for (const familyUnit of familyUnits) {
      const husbandId = familyUnit.husbandId ?? null;
      const wifeId = familyUnit.wifeId ?? null;
      const childIds = numberArray(familyUnit.childIds).filter((id) => nodeById.has(id));
      const spouseIds = mergeIds(familyUnit.spouseIds, [husbandId, wifeId]).filter((id) => nodeById.has(id));
      const parentIds = [husbandId, wifeId].filter((id): id is number => Number.isFinite(id) && !!id && nodeById.has(id));

      for (const parentId of parentIds) {
        const parent = nodeById.get(parentId);
        if (!parent) continue;
        parent.childrenIds = mergeIds(parent.childrenIds, childIds);
        parent.spouseIds = mergeIds(parent.spouseIds, spouseIds.filter((id) => id !== parentId));
      }

      for (const childId of childIds) {
        const child = nodeById.get(childId);
        if (!child) continue;
        child.parentIds = mergeIds(child.parentIds, parentIds);
        child.siblingIds = mergeIds(child.siblingIds, childIds.filter((id) => id !== childId));
      }
    }

    const lifeEventsByPerson = await loadLifeEventsForPeople([...nodeById.keys()]);
    const nodes = [...nodeById.values()].map((node) => ({
      ...node,
      parentIds: numberArray(node.parentIds),
      childrenIds: numberArray(node.childrenIds),
      spouseIds: numberArray(node.spouseIds),
      siblingIds: numberArray(node.siblingIds),
      lifeEvents: lifeEventsByPerson.get(node.id) ?? [],
    }));

    res.json({
      nodes,
      familyUnits,
      page: 1,
      limit: nodes.length,
      count: nodes.length,
      source: "family_lineage",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/verification", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    if (!dbId) {
      res.json({
        lineageSummary: "No registered profile — lineage verification requires system registration.",
        ancestorChain: [],
        familyGroup: "",
        generationalPosition: 0,
        protectionLevel: "standard",
        benefitEligibility: {},
        icwaEligible: false,
        welfareEligible: false,
        trustInheritance: false,
        membershipVerified: false,
        identityTags: [],
      });
      return;
    }

    const data = await getLineageForUser(dbId);
    const links = await getKnowledgeOfSelfLinks(dbId);
    const narrative = links.narratives[0] ?? null;
    const lineageSummary = buildLineageSummaryForIntake(data);
    const ancestorChain = narrative
      ? (Array.isArray(narrative.ancestorChain) ? narrative.ancestorChain as string[] : [])
      : data.lineage.filter((l) => l.isDeceased).map((l) => l.fullName);

    res.json({
      lineageSummary,
      ancestorChain,
      familyGroup: narrative?.familyGroup ?? "",
      generationalPosition: narrative?.generationalPosition ?? 0,
      generationalDepth: narrative?.generationalDepth ?? 0,
      protectionLevel: narrative?.protectionLevel ?? "standard",
      benefitEligibility: narrative?.benefitEligibility ?? {},
      icwaEligible: narrative?.icwaEligible ?? false,
      welfareEligible: narrative?.welfareEligible ?? false,
      trustInheritance: narrative?.trustInheritance ?? false,
      membershipVerified: narrative?.membershipVerified ?? false,
      identityTags: narrative ? (Array.isArray(narrative.identityTags) ? narrative.identityTags : []) : [],
      lineageCount: data.lineage.length,
      narrativeCount: data.narratives.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/knowledge-of-self", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    if (!dbId) {
      res.json({ narratives: [], linkedAncestors: [], records: [], ancestorContext: [] });
      return;
    }
    const [links, ancestorContext] = await Promise.all([
      getKnowledgeOfSelfLinks(dbId),
      getAncestorHistoricalContext(dbId),
    ]);
    res.json({ ...links, ancestorContext });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/upload-csv",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No CSV file uploaded. Include a 'file' field." });
        return;
      }

      const csvText = req.file.buffer.toString("utf-8");
      const people = parseLineageCsv(csvText);

      if (people.length === 0) {
        res.status(400).json({
          error: "No valid records found in CSV. Ensure headers include: name (or first_name + last_name), birth_year, parent_names (semicolon-separated), tribal_nation.",
        });
        return;
      }

      const graph = buildLineageGraph(people);
      const dbId = req.user!.dbId ?? null;
      const result = await storeLineage(graph, dbId, "csv");
      const eligibility = detectEligibility(graph);

      logger.info({ people: people.length, lineageIds: result.lineageIds.length, userId: dbId }, "CSV lineage imported");

      res.json({
        message: `Successfully imported ${people.length} family member(s) from CSV.`,
        summary: {
          totalPersons: people.length,
          generations: graph.totalGenerations,
          tribalNations: graph.tribalNations,
          familyGroups: graph.familyGroups,
          ancestorChain: graph.ancestorChain,
          lineageTags: graph.lineageTags,
          icwaEligible: eligibility.icwaEligible,
          welfareEligible: eligibility.welfareEligible,
          trustInheritance: eligibility.trustInheritance,
          protectionLevel: eligibility.protectionLevel,
          benefitEligibility: eligibility.benefitEligibility,
          reasons: eligibility.reasons,
        },
        lineageIds: result.lineageIds,
        narrativeId: result.narrativeId,
        identityTags: result.identityTags,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/upload-photo",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No photo uploaded. Include a 'file' field with a JPG or PNG image." });
        return;
      }

      const dbId = req.user!.dbId ?? null;
      const originalName = req.file.originalname ?? "family-tree.jpg";
      const mimeType = req.file.mimetype;
      const sizeKb = Math.round(req.file.size / 1024);
      const manualNote = (req.body as Record<string, string>).notes ?? "";

      const [placeholder] = await db
        .insert(familyLineageTable)
        .values({
          userId: dbId ?? undefined,
          fullName: `Photo Import: ${originalName}`,
          notes: manualNote || `Photo uploaded: ${originalName} (${sizeKb}kb, ${mimeType}). Manual extraction required — enter names, dates, and relationships via Edit Ancestors.`,
          sourceType: "photo",
          isAncestor: false,
          photoFilename: originalName,
          lineageTags: ["Photo Import", "Pending Extraction"],
          parentIds: [],
          childrenIds: [],
          spouseIds: [],
        })
        .returning();

      logger.info({ filename: originalName, sizeKb, userId: dbId }, "Photo family tree uploaded");

      res.json({
        message: "Photo received. Use the Edit Ancestors tab to manually enter names, birth/death years, and relationships from the photo.",
        photoRecordId: placeholder.id,
        filename: originalName,
        sizeKb,
        instructions: [
          "Go to the Edit Ancestors tab",
          "Click Add Ancestor for each person visible in the photo",
          "Enter their name, approximate birth/death years, and tribal nation if known",
          "Use the parent_names field to link parent-child relationships",
          "Save to build the lineage graph",
        ],
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const result = await getAncestorById(id);
    if (!result) {
      res.status(404).json({ error: "Ancestor record not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const updates = req.body as Parameters<typeof updateAncestor>[1];
    const updated = await updateAncestor(id, updates);
    if (!updated) {
      res.status(404).json({ error: "Ancestor record not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/manual", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId ?? null;
    const body = req.body as {
      fullName: string;
      firstName?: string;
      lastName?: string;
      birthYear?: number;
      deathYear?: number;
      gender?: string;
      tribalNation?: string;
      tribalEnrollmentNumber?: string;
      notes?: string;
      contactEmail?: string;
      parentIds?: number[];
      spouseIds?: number[];
      generationalPosition?: number;
      lineageTags?: string[];
    };

    if (!body.fullName) {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    const [row] = await db
      .insert(familyLineageTable)
      .values({
        userId: dbId ?? undefined,
        fullName: body.fullName,
        firstName: body.firstName ?? undefined,
        lastName: body.lastName ?? undefined,
        birthYear: body.birthYear ?? undefined,
        deathYear: body.deathYear ?? undefined,
        gender: body.gender ?? undefined,
        tribalNation: body.tribalNation ?? undefined,
        tribalEnrollmentNumber: body.tribalEnrollmentNumber ?? undefined,
        notes: body.notes ?? undefined,
        contactEmail: body.contactEmail ?? undefined,
        isDeceased: body.deathYear !== undefined,
        isAncestor: true,
        generationalPosition: body.generationalPosition ?? 0,
        sourceType: "manual",
        parentIds: body.parentIds ?? [],
        childrenIds: [],
        spouseIds: body.spouseIds ?? [],
        lineageTags: body.lineageTags ?? [],
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/link-identity", requireAuth, async (req, res, next) => {
  try {
    const lineageId = parseInt(String(req.params.id), 10);
    if (isNaN(lineageId)) {
      res.status(400).json({ error: "Invalid lineage ID" });
      return;
    }
    const { targetUserId } = req.body as { targetUserId?: number };
    const userId = targetUserId ?? req.user!.dbId;

    if (!userId) {
      res.status(400).json({ error: "targetUserId is required or user must be registered" });
      return;
    }

    const record = await linkAncestorToProfile(lineageId, userId);
    res.json({ message: "Ancestor linked to identity profile", record });
  } catch (err) {
    next(err);
  }
});

export default router;
