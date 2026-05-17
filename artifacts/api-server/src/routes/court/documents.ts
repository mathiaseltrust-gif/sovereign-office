import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { generateCourtDocument, getCourtDocument, listCourtDocuments, listTemplates } from "../../sovereign/court-doc-generator";
import { buildCourtDocumentPdf } from "../../lib/pdf-builder";
import { db } from "@workspace/db";
import { courtDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nextDocRef } from "../../lib/doc-ref";

const router = Router();

router.get("/templates", requireAuth, async (_req, res, next) => {
  try {
    res.json(listTemplates());
  } catch (err) {
    next(err);
  }
});

const ACTION_TEMPLATE_SUGGESTIONS: Record<string, Array<{ templateId: string; label: string; hint: string }>> = {
  ISSUE_NFR: [
    { templateId: "NFR", label: "Notice of Federal Review", hint: "Issue a formal NFR to compel federal review of unauthorized debt collection or encumbrance activity." },
  ],
  FILE_ICWA_NOTICE: [
    { templateId: "ICWA_NOTICE", label: "ICWA Notice of Proceeding", hint: "Mandatory federal filing — must be served on the tribe before any hearing affecting an Indian child." },
    { templateId: "TRO_ICWA", label: "TRO — ICWA Child Welfare", hint: "Emergency TRO under ICWA to halt unauthorized child removal or placement immediately." },
  ],
  FILE_JURISDICTIONAL_STATEMENT: [
    { templateId: "JURISDICTIONAL_STATEMENT", label: "Jurisdictional Statement", hint: "Assert federal and tribal jurisdiction over this matter and formally preempt any state authority." },
  ],
  ISSUE_CEASE_DESIST: [
    { templateId: "PROTECTIVE_ORDER", label: "Protective Order", hint: "Issue a sovereign protective order halting all unauthorized collection, reporting, or encumbrance activity." },
    { templateId: "NFR", label: "Notice of Federal Review", hint: "Formal NFR to accompany the cease and desist — places all adverse parties on federal notice." },
  ],
  ASSERT_SOVEREIGN_IDENTITY: [
    { templateId: "NFR", label: "Notice of Federal Review", hint: "Assert sovereign status through formal federal notice served on all active adverse parties simultaneously." },
    { templateId: "JURISDICTIONAL_STATEMENT", label: "Jurisdictional Statement", hint: "Formal jurisdictional assertion for any active proceeding — establishes the record." },
  ],
  GENERATE_STATUS_AFFIRMATION: [
    { templateId: "JURISDICTIONAL_STATEMENT", label: "Jurisdictional Statement", hint: "Formally assert and document sovereign status across all active matters of record." },
  ],
  FILE_TRUST_RESPONSIBILITY_COMPLAINT: [
    { templateId: "TRUST_DEED", label: "Trust Deed", hint: "Establish the trust instrument as the foundation for federal trust responsibility enforcement before the BIA." },
  ],
};

router.get("/suggested", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) { res.json([]); return; }

    const { getIntelligencePicture } = await import("../../sovereign/intelligence-accumulator");
    const picture = await getIntelligencePicture(userId);

    if (!picture || picture.actionQueue.length === 0) { res.json([]); return; }

    const seen = new Set<string>();
    const suggestions: Array<{
      templateId: string;
      label: string;
      hint: string;
      priority: string;
      actionLabel: string;
    }> = [];

    for (const action of picture.actionQueue) {
      const mappings = ACTION_TEMPLATE_SUGGESTIONS[action.action];
      if (!mappings) continue;
      for (const m of mappings) {
        if (seen.has(m.templateId)) continue;
        seen.add(m.templateId);
        suggestions.push({
          templateId: m.templateId,
          label: m.label,
          hint: m.hint,
          priority: action.priority,
          actionLabel: action.label,
        });
      }
    }

    res.json(suggestions);
  } catch (err) { next(err); }
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
    const rawMode = req.query.mode;
    const signingMode: "electronic" | "print" = rawMode === "print" ? "print" : "electronic";
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
      signingMode,
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

    // Assign a tribal reference number to the newly created court document
    let tribalRef: string | undefined;
    if (result && (result as { id?: number }).id) {
      try {
        tribalRef = await nextDocRef("court_document");
        await db
          .update(courtDocumentsTable)
          .set({ tribalRef })
          .where(eq(courtDocumentsTable.id, (result as { id: number }).id));
      } catch {
        // non-fatal — document is created, ref assignment failed
      }
    }

    res.status(201).json(tribalRef ? { ...result, tribalRef } : result);
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
