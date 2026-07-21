import { Router } from "express";
import { db } from "@workspace/db";
import {
  nfrDocumentsTable,
  classificationsTable,
  nfrInvestigationsTable,
  nfrReviewSignalsTable,
} from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { buildNfrRecorderPdf } from "../../lib/pdf-builder";
import { auditLog, triggerReviewEngine, type ReviewSignalType, type TriggeringEventType } from "../../engines/nfr-review-engine";

const router = Router();

type AdminFollowthrough = { step?: number; item?: string; action?: string; status?: string };
type NfrInvestigationRow = typeof nfrInvestigationsTable.$inferSelect;
type NfrDocumentRow = typeof nfrDocumentsTable.$inferSelect;
type NfrSignalRow = typeof nfrReviewSignalsTable.$inferSelect;

function pretty(value?: string | null): string {
  return value ? value.replace(/_/g, " ") : "—";
}

function asFollowthroughItems(value: unknown): AdminFollowthrough[] {
  return Array.isArray(value) ? value as AdminFollowthrough[] : [];
}

function buildAdministrativeRecord(
  investigations: NfrInvestigationRow[],
  documents: NfrDocumentRow[],
  recentSignals: NfrSignalRow[],
) {
  const entityMap = new Map<string, { name: string; count: number; investigationIds: number[] }>();
  const interestMap = new Map<string, { label: string; kind: string; investigationIds: number[] }>();
  const evidenceMap = new Map<string, { source: string; investigationIds: number[] }>();

  for (const inv of investigations) {
    if (inv.triggeringEntity) {
      const current = entityMap.get(inv.triggeringEntity) ?? { name: inv.triggeringEntity, count: 0, investigationIds: [] };
      current.count += 1;
      current.investigationIds.push(inv.id);
      entityMap.set(inv.triggeringEntity, current);
    }

    if (inv.affectedParcelId != null) {
      const key = `parcel:${inv.affectedParcelId}`;
      const current = interestMap.get(key) ?? { label: `Parcel #${inv.affectedParcelId}`, kind: "land_parcel", investigationIds: [] };
      current.investigationIds.push(inv.id);
      interestMap.set(key, current);
    }

    if (inv.affectedInstrumentId != null) {
      const key = `instrument:${inv.affectedInstrumentId}`;
      const current = interestMap.get(key) ?? { label: `Instrument #${inv.affectedInstrumentId}`, kind: "instrument", investigationIds: [] };
      current.investigationIds.push(inv.id);
      interestMap.set(key, current);
    }

    if (inv.evidenceSource) {
      const current = evidenceMap.get(inv.evidenceSource) ?? { source: inv.evidenceSource, investigationIds: [] };
      current.investigationIds.push(inv.id);
      evidenceMap.set(inv.evidenceSource, current);
    }
  }

  const deadlines = investigations.flatMap((inv) => {
    const followthrough = asFollowthroughItems(inv.requiredFollowthrough);
    return followthrough.map((item, index) => ({
      id: `${inv.id}-${item.step ?? index + 1}`,
      investigationId: inv.id,
      label: item.item ?? item.action ?? `Follow-up step ${item.step ?? index + 1}`,
      status: item.status ?? "pending",
      source: pretty(inv.signalType),
    }));
  });

  const notices = documents.map((doc) => ({
    id: doc.id,
    noticeNo: doc.tribalRef ?? `NFR-${doc.id}`,
    investigationId: doc.investigationId ?? null,
    status: doc.status,
    pdfUrl: doc.pdfUrl,
    triggeringEntity: doc.triggeringEntity,
    createdAt: doc.createdAt,
  }));

  const outcomes = investigations
    .filter((inv) => ["resolved", "dismissed", "escalated"].includes(inv.status))
    .map((inv) => ({
      id: inv.id,
      investigationId: inv.id,
      status: inv.status,
      summary: inv.summary,
      updatedAt: inv.updatedAt,
    }));

  return {
    model: "Incident → Entity → Notice → Evidence → Protected Interest → Deadline → Outcome",
    incidents: investigations.map((inv) => ({
      id: inv.id,
      incidentNo: `NFR-IR-${String(inv.id).padStart(6, "0")}`,
      signalType: inv.signalType,
      status: inv.status,
      urgencyScore: inv.urgencyScore,
      affectedMatter: inv.affectedMatter,
      createdAt: inv.createdAt,
    })),
    entities: [...entityMap.values()],
    notices,
    evidenceFiles: [...evidenceMap.values()],
    protectedInterests: [...interestMap.values()],
    deadlines,
    outcomes,
    recentSignals: recentSignals.map((signal) => ({
      id: signal.id,
      investigationId: signal.investigationId,
      signalType: signal.signalType,
      source: signal.source,
      detectedAt: signal.detectedAt,
    })),
  };
}

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const docs = await db
      .select()
      .from(nfrDocumentsTable)
      .orderBy(desc(nfrDocumentsTable.createdAt));
    res.setHeader("Cache-Control", "no-store");
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// Unified NFR dashboard feed. Keeps the legacy /court/nfr document list intact,
// while exposing the active investigation layer that the NFR engine already writes.
router.get("/overview", requireAuth, async (_req, res, next) => {
  try {
    const [documents, investigations, activeMatters, recentSignals] = await Promise.all([
      db.select().from(nfrDocumentsTable).orderBy(desc(nfrDocumentsTable.createdAt)).limit(100),
      db.select().from(nfrInvestigationsTable).orderBy(desc(nfrInvestigationsTable.createdAt)).limit(100),
      db
        .select()
        .from(nfrInvestigationsTable)
        .where(inArray(nfrInvestigationsTable.status, ["open", "under_review", "escalated"]))
        .orderBy(desc(nfrInvestigationsTable.urgencyScore), desc(nfrInvestigationsTable.createdAt))
        .limit(50),
      db.select().from(nfrReviewSignalsTable).orderBy(desc(nfrReviewSignalsTable.detectedAt)).limit(50),
    ]);

    const administrativeRecord = buildAdministrativeRecord(investigations, documents, recentSignals);

    res.setHeader("Cache-Control", "no-store");
    res.json({ documents, investigations, activeMatters, recentSignals, administrativeRecord });
  } catch (err) {
    next(err);
  }
});

// Alias the review-engine manual trigger under the NFR route so the NFR page can
// open a review without knowing the lower-level engine path.
router.post("/trigger", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const userId = req.user?.dbId ?? null;
    const {
      signalType,
      eventType,
      eventId,
      affectedUserId,
      affectedParcelId,
      affectedInstrumentId,
      affectedMatter,
      triggeringEntity,
      evidenceSource,
      context,
    } = req.body as {
      signalType: ReviewSignalType;
      eventType?: TriggeringEventType;
      eventId?: number;
      affectedUserId?: number;
      affectedParcelId?: number;
      affectedInstrumentId?: number;
      affectedMatter?: string;
      triggeringEntity?: string;
      evidenceSource?: string;
      context?: string;
    };

    if (!signalType) {
      res.status(400).json({ error: "signalType is required" });
      return;
    }

    await auditLog({
      userId,
      action: "NFR_MANUAL_TRIGGER",
      resourceType: "nfr_document",
      metadata: { signalType, eventType, affectedParcelId, affectedUserId, triggeringEntity },
    });

    const result = await triggerReviewEngine({
      eventType: eventType ?? "manual_trigger",
      eventId,
      signalType,
      affectedUserId,
      affectedParcelId,
      affectedInstrumentId,
      affectedMatter,
      triggeringEntity,
      evidenceSource,
      context,
      triggeredByUserId: userId ?? undefined,
    });

    if (!result) {
      res.status(500).json({ error: "NFR review engine could not process the trigger" });
      return;
    }

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(nfrDocumentsTable).where(eq(nfrDocumentsTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/pdf", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db
      .select({ id: nfrDocumentsTable.id, content: nfrDocumentsTable.content, classificationId: nfrDocumentsTable.classificationId })
      .from(nfrDocumentsTable)
      .where(eq(nfrDocumentsTable.id, id))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }

    let classData: Record<string, string> = {};
    try {
      const cls = await db
        .select()
        .from(classificationsTable)
        .where(eq(classificationsTable.id, results[0].classificationId))
        .limit(1);
      if (cls[0]) {
        classData = {
          actorType: cls[0].actorType,
          landStatus: cls[0].landStatus,
          actionType: cls[0].actionType,
          rawText: cls[0].rawText,
        };
      }
    } catch {
      // non-fatal
    }

    const pdfResult = await buildNfrRecorderPdf(id, results[0].content, classData);

    await db
      .update(nfrDocumentsTable)
      .set({ pdfUrl: `/api/court/nfr/${id}/pdf`, updatedAt: new Date() })
      .where(eq(nfrDocumentsTable.id, id));

    const filename = `nfr-${id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfResult.buffer);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user?.dbId ?? null;
    const { content, status } = req.body as { content?: string; status?: string };
    const existing = await db.select().from(nfrDocumentsTable).where(eq(nfrDocumentsTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }
    const updated = await db
      .update(nfrDocumentsTable)
      .set({
        content: content ?? existing[0].content,
        status: status ?? existing[0].status,
        pdfUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(nfrDocumentsTable.id, id))
      .returning();

    await auditLog({
      userId,
      action: "NFR_UPDATED",
      resourceType: "nfr_document",
      resourceId: id,
      resourceRef: existing[0].tribalRef ?? undefined,
      beforeValue: { status: existing[0].status },
      afterValue: { status: updated[0]?.status },
      metadata: { fieldsChanged: [content !== undefined && "content", status !== undefined && "status"].filter(Boolean) },
    });

    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/export-pdf", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(nfrDocumentsTable).where(eq(nfrDocumentsTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }

    let classData: Record<string, string> = {};
    try {
      const cls = await db
        .select()
        .from(classificationsTable)
        .where(eq(classificationsTable.id, results[0].classificationId))
        .limit(1);
      if (cls[0]) classData = { actorType: cls[0].actorType, landStatus: cls[0].landStatus, actionType: cls[0].actionType, rawText: cls[0].rawText };
    } catch { /* non-fatal */ }

    const pdfResult = await buildNfrRecorderPdf(id, results[0].content, classData);
    const pdfUrl = `/api/court/nfr/${id}/pdf`;

    await db
      .update(nfrDocumentsTable)
      .set({ pdfUrl, updatedAt: new Date() })
      .where(eq(nfrDocumentsTable.id, id));

    res.json({
      success: true,
      pdfUrl,
      downloadUrl: pdfUrl,
      pages: pdfResult.pageCount,
      checksum: pdfResult.checksum,
      generatedAt: pdfResult.generatedAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
