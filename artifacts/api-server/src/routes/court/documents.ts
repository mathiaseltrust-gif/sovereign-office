import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { generateCourtDocument, getCourtDocument, listCourtDocuments, listTemplates } from "../../sovereign/court-doc-generator";
import { buildCourtDocumentPdf } from "../../lib/pdf-builder";
import { db } from "@workspace/db";
import { courtDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/templates", requireAuth, async (_req, res, next) => {
  try {
    res.json(listTemplates());
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const docs = await listCourtDocuments();
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const doc = await getCourtDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Court document not found" });
      return;
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/pdf", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const doc = await getCourtDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Court document not found" });
      return;
    }
    const pdfResult = await buildCourtDocumentPdf({
      id: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      templateName: doc.templateName,
      parties: (doc.parties as Record<string, string>) ?? {},
      content: doc.content,
      signatureBlock: doc.signatureBlock ?? "",
      troSensitive: doc.troSensitive,
      emergencyOrder: doc.emergencyOrder,
      doctrinesApplied: (doc.doctrinesApplied as string[]) ?? [],
      lawRefs: (doc.lawRefs as Array<{ citation: string; title: string }>) ?? [],
      caseDetails: (doc.caseDetails as Record<string, string>) ?? {},
    });
    await db
      .update(courtDocumentsTable)
      .set({ pdfUrl: `/api/court/documents/${id}/pdf`, updatedAt: new Date() })
      .where(eq(courtDocumentsTable.id, id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="court-doc-${id}.pdf"`);
    res.send(pdfResult.buffer);
  } catch (err) {
    next(err);
  }
});

router.post("/generate", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const { templateId, vars, parties, caseDetails, runIntakeAnalysis } = req.body as {
      templateId: string;
      vars?: Record<string, string>;
      parties?: Record<string, string>;
      caseDetails?: Record<string, string>;
      runIntakeAnalysis?: boolean;
    };
    if (!templateId) {
      res.status(400).json({ error: "templateId is required" });
      return;
    }
    const userId = req.user?.dbId ?? undefined;
    const userRole = req.user?.roles?.[0];
    const userEmail = req.user?.email;
    const result = await generateCourtDocument({
      templateId,
      vars,
      parties,
      caseDetails,
      userId,
      userRole,
      userEmail,
      runIntakeAnalysis: runIntakeAnalysis !== false,
    });
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Unknown court document template")) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

router.put("/:id/issue", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const doc = await getCourtDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Court document not found" });
      return;
    }
    const auditLog = (doc.auditLog as unknown[]) ?? [];
    const [updated] = await db
      .update(courtDocumentsTable)
      .set({
        status: "issued",
        updatedAt: new Date(),
        auditLog: [...auditLog, {
          ts: new Date().toISOString(),
          action: "issued",
          userId: req.user?.id ?? null,
        }],
      })
      .where(eq(courtDocumentsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
