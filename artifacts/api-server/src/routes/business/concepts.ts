import { Router, type Request } from "express";
import { db } from "@workspace/db";
import {
  businessConceptsTable,
  businessBoardMembersTable,
  businessDocumentsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";
import { processIntake } from "../../sovereign/intake-pipeline";
import { claimUpload } from "../../lib/pendingUploads";
import { z } from "zod";

const ConceptCreateBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  structure: z.string().max(100).optional().default(""),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).optional().default("draft"),
  aiSummary: z.string().max(5000).nullable().optional(),
  suggestedStructures: z.array(z.unknown()).optional().default([]),
  protections: z.array(z.string()).optional().default([]),
  agenciesToContact: z.array(z.unknown()).optional().default([]),
  planOutline: z.record(z.string()).optional().default({}),
  modelCanvas: z.record(z.string()).optional().default({}),
  provisions: z.array(z.string()).optional().default([]),
  whatNextSteps: z.array(z.unknown()).optional().default([]),
});

const ConceptPatchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  structure: z.string().max(100).optional(),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
  aiSummary: z.string().max(5000).nullable().optional(),
  suggestedStructures: z.array(z.unknown()).optional(),
  protections: z.array(z.string()).optional(),
  agenciesToContact: z.array(z.unknown()).optional(),
  planOutline: z.record(z.string()).optional(),
  modelCanvas: z.record(z.string()).optional(),
  provisions: z.array(z.string()).optional(),
  whatNextSteps: z.array(z.unknown()).optional(),
});

const BoardMemberBody = z.object({
  memberName: z.string().min(1).max(200),
  memberRole: z.string().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  directoryMemberId: z.number().int().positive().optional(),
});

const DocumentBody = z.object({
  filename: z.string().min(1).max(500),
  fileKey: z.string().max(500).optional(),
});

const router = Router();

const ELEVATED_ROLES = ["trustee", "officer", "sovereign_admin"];

async function checkConceptAccess(conceptId: number, req: Request): Promise<boolean> {
  const userId = req.user?.dbId;
  if (!userId) return false;
  const isElevated = req.user?.roles?.some((r) => ELEVATED_ROLES.includes(r)) ?? false;
  if (isElevated) return true;
  const [concept] = await db
    .select({ ownerId: businessConceptsTable.ownerId })
    .from(businessConceptsTable)
    .where(eq(businessConceptsTable.id, conceptId));
  if (!concept) return false;
  return concept.ownerId === userId;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) { res.status(403).json({ error: "Registered user account required." }); return; }
    const isElevated = req.user?.roles?.some((r) => ELEVATED_ROLES.includes(r)) ?? false;
    const concepts = await db
      .select()
      .from(businessConceptsTable)
      .where(isElevated ? undefined : eq(businessConceptsTable.ownerId, userId))
      .orderBy(desc(businessConceptsTable.updatedAt));
    res.json(concepts);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) { res.status(403).json({ error: "Registered user account required." }); return; }

    const parsed = ConceptCreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const {
      title, description, structure, status,
      aiSummary, suggestedStructures, protections, agenciesToContact,
      planOutline, modelCanvas, provisions, whatNextSteps,
    } = parsed.data;

    const [concept] = await db
      .insert(businessConceptsTable)
      .values({
        ownerId: userId,
        title,
        description,
        structure,
        status,
        aiSummary: aiSummary ?? null,
        suggestedStructures,
        protections,
        agenciesToContact,
        planOutline,
        modelCanvas,
        provisions,
        whatNextSteps,
      })
      .returning();

    logger.info({ conceptId: concept.id, userId }, "Business concept created");
    res.status(201).json(concept);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    if (!await checkConceptAccess(id, req)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const [concept] = await db
      .select()
      .from(businessConceptsTable)
      .where(eq(businessConceptsTable.id, id));

    if (!concept) { res.status(404).json({ error: "Not found" }); return; }

    const [boardMembers, documents] = await Promise.all([
      db.select().from(businessBoardMembersTable).where(eq(businessBoardMembersTable.conceptId, id)),
      db.select().from(businessDocumentsTable).where(eq(businessDocumentsTable.conceptId, id)),
    ]);

    res.json({ ...concept, boardMembers, documents });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    if (!await checkConceptAccess(id, req)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const parsed = ConceptPatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) updates[k] = v;
    }

    const [updated] = await db
      .update(businessConceptsTable)
      .set(updates)
      .where(eq(businessConceptsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/board", requireAuth, async (req, res, next) => {
  try {
    const conceptId = parseInt(String(req.params.id), 10);
    if (isNaN(conceptId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const canManageBoard = req.user?.roles?.some((r) => ELEVATED_ROLES.includes(r)) ?? false;
    if (!canManageBoard) {
      res.status(403).json({ error: "Only officers, trustees, and sovereign admins may assign board members." });
      return;
    }

    if (!await checkConceptAccess(conceptId, req)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const parsed = BoardMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { memberName, memberRole, startDate, directoryMemberId } = parsed.data;

    const [member] = await db
      .insert(businessBoardMembersTable)
      .values({
        conceptId,
        memberName,
        memberRole,
        startDate: startDate ?? null,
        directoryMemberId: directoryMemberId ?? null,
      })
      .returning();

    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/board/:memberId", requireAuth, async (req, res, next) => {
  try {
    const conceptId = parseInt(String(req.params.id), 10);
    const memberId = parseInt(String(req.params.memberId), 10);
    if (isNaN(conceptId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const canManageBoard = req.user?.roles?.some((r) => ELEVATED_ROLES.includes(r)) ?? false;
    if (!canManageBoard) {
      res.status(403).json({ error: "Only officers, trustees, and sovereign admins may manage board members." });
      return;
    }

    if (!await checkConceptAccess(conceptId, req)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    await db
      .delete(businessBoardMembersTable)
      .where(and(
        eq(businessBoardMembersTable.id, memberId),
        eq(businessBoardMembersTable.conceptId, conceptId),
      ));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/documents", requireAuth, async (req, res, next) => {
  try {
    const conceptId = parseInt(String(req.params.id), 10);
    if (isNaN(conceptId)) { res.status(400).json({ error: "Invalid id" }); return; }

    if (!await checkConceptAccess(conceptId, req)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const parsedDoc = DocumentBody.safeParse(req.body);
    if (!parsedDoc.success) {
      res.status(400).json({ error: "Invalid request", details: parsedDoc.error.flatten().fieldErrors });
      return;
    }
    const { filename, fileKey } = parsedDoc.data;

    if (fileKey !== undefined && fileKey !== null) {
      const userId = String(req.user?.dbId ?? "");
      const claimed = claimUpload(fileKey, userId);
      if (!claimed) {
        logger.warn({ userId, fileKey, conceptId }, "Document registration rejected: fileKey not in pending upload registry");
        res.status(400).json({ error: "Invalid fileKey — must be a server-issued upload path for your account." });
        return;
      }
    }

    const uploadedBy = req.user?.email ?? req.user?.name ?? "Unknown";

    const [doc] = await db
      .insert(businessDocumentsTable)
      .values({ conceptId, filename, fileKey: fileKey ?? null, uploadedBy })
      .returning();

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/submit-validation", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    if (!await checkConceptAccess(id, req)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const [concept] = await db
      .select()
      .from(businessConceptsTable)
      .where(eq(businessConceptsTable.id, id));

    if (!concept) { res.status(404).json({ error: "Not found" }); return; }

    const intakeText = [
      `BUSINESS CONCEPT VALIDATION REQUEST`,
      `Title: ${concept.title}`,
      `Structure: ${concept.structure}`,
      `Description: ${concept.description}`,
      `AI Summary: ${concept.aiSummary ?? "N/A"}`,
      `Sovereign Protections: ${(concept.protections as string[] ?? []).join("; ")}`,
      `Status: ${concept.status}`,
    ].join("\n");

    const userId = req.user?.dbId;
    // Uses the shared processIntake() pipeline — the same implementation backing
    // POST /api/intake/ai — to guarantee identical AI-engine behaviour, logging,
    // and _meta structure across both entry points without HTTP round-trip overhead.
    const { report, meta } = await processIntake({
      text: intakeText,
      userId,
      context: { caseType: "business_formation", role: req.user?.roles?.[0] ?? "member" },
      logContext: { conceptId: id, source: "submit-validation" },
    });

    await db
      .update(businessConceptsTable)
      .set({ status: "submitted", updatedAt: new Date() })
      .where(eq(businessConceptsTable.id, id));

    logger.info({ conceptId: id, userId }, "Business concept submitted for validation");
    res.json({ ok: true, validation: report, _meta: meta });
  } catch (err) {
    next(err);
  }
});

export default router;
