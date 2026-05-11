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
import { runAiEngine } from "../../sovereign/ai-engine";

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

    const {
      title, description, structure, status,
      aiSummary, suggestedStructures, protections, agenciesToContact,
      planOutline, modelCanvas, provisions, whatNextSteps,
    } = req.body as {
      title: string;
      description?: string;
      structure?: string;
      status?: string;
      aiSummary?: string;
      suggestedStructures?: unknown[];
      protections?: string[];
      agenciesToContact?: unknown[];
      planOutline?: Record<string, string>;
      modelCanvas?: Record<string, string>;
      provisions?: string[];
      whatNextSteps?: unknown[];
    };

    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const [concept] = await db
      .insert(businessConceptsTable)
      .values({
        ownerId: userId,
        title,
        description: description ?? "",
        structure: structure ?? "",
        status: status ?? "draft",
        aiSummary: aiSummary ?? null,
        suggestedStructures: suggestedStructures ?? [],
        protections: protections ?? [],
        agenciesToContact: agenciesToContact ?? [],
        planOutline: planOutline ?? {},
        modelCanvas: modelCanvas ?? {},
        provisions: provisions ?? [],
        whatNextSteps: whatNextSteps ?? [],
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

    const allowedFields = [
      "title", "description", "structure", "status",
      "aiSummary", "suggestedStructures", "protections", "agenciesToContact",
      "planOutline", "modelCanvas", "provisions", "whatNextSteps",
    ];

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (field in req.body) updates[field] = req.body[field];
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

    if (!await checkConceptAccess(conceptId, req)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const { memberName, memberRole, startDate } = req.body as {
      memberName: string;
      memberRole: string;
      startDate?: string;
    };

    if (!memberName || !memberRole) {
      res.status(400).json({ error: "memberName and memberRole are required" });
      return;
    }

    const [member] = await db
      .insert(businessBoardMembersTable)
      .values({ conceptId, memberName, memberRole, startDate: startDate ?? null })
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

    const { filename, fileKey } = req.body as { filename: string; fileKey?: string };
    if (!filename) { res.status(400).json({ error: "filename is required" }); return; }

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

    const report = await runAiEngine({
      text: intakeText,
      userId: req.user?.dbId,
      context: { caseType: "business_formation", role: req.user?.roles?.[0] ?? "member" },
    });

    await db
      .update(businessConceptsTable)
      .set({ status: "submitted", updatedAt: new Date() })
      .where(eq(businessConceptsTable.id, id));

    logger.info({ conceptId: id, userId: req.user?.dbId }, "Business concept submitted for validation");
    res.json({ ok: true, validation: report });
  } catch (err) {
    next(err);
  }
});

export default router;
