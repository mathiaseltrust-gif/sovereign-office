import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../auth/entra-guard";
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
} from "../sovereign/family-tree-engine";
import { db } from "@workspace/db";
import { familyLineageTable, identityNarrativesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

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
      res.json({ narratives: [], linkedAncestors: [], records: [] });
      return;
    }
    const links = await getKnowledgeOfSelfLinks(dbId);
    res.json(links);
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
    const id = parseInt(req.params.id, 10);
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
    const id = parseInt(req.params.id, 10);
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
      parentIds?: number[];
      spouseIds?: number[];
      generationalPosition?: number;
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
        isDeceased: body.deathYear !== undefined,
        isAncestor: true,
        generationalPosition: body.generationalPosition ?? 0,
        sourceType: "manual",
        parentIds: body.parentIds ?? [],
        childrenIds: [],
        spouseIds: body.spouseIds ?? [],
        lineageTags: [],
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/link-identity", requireAuth, async (req, res, next) => {
  try {
    const lineageId = parseInt(req.params.id, 10);
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
