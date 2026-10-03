import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRegisteredUser } from "../../auth/entra-guard";
import { recordListenerEvent } from "../../engines/document-association";
import { canReviewCanonicalDocument } from "../../security/canonical-document-access";

const router = Router();

async function resolveAuthorizedDocument(
  documentRef: string,
  userId: number,
  roles: string[],
) {
  const result = await db.execute(sql`
    SELECT id, document_ref, original_filename, classification,
           verification_state, sensitivity_level, created_by, created_at
    FROM document_registry
    WHERE document_ref = ${documentRef}
    LIMIT 1
  `);
  const document = result.rows[0] as Record<string, unknown> | undefined;
  if (!document) return { document: null, allowed: false };

  return {
    document,
    allowed: canReviewCanonicalDocument({
      requesterId: userId,
      documentCreatedBy: document.created_by == null ? null : Number(document.created_by),
      sensitivityLevel: document.sensitivity_level == null ? null : String(document.sensitivity_level),
      roles,
    }),
  };
}

router.get(
  "/:documentRef/associations",
  requireAuth,
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const userId = req.user!.dbId!;
      const roles = req.user!.roles ?? [];
      const documentRef = String(req.params.documentRef);
      const access = await resolveAuthorizedDocument(documentRef, userId, roles);

      if (!access.document) {
        res.status(404).json({ error: "Document not found." });
        return;
      }
      if (!access.allowed) {
        res.status(403).json({ error: "You are not authorized to review this document's associations." });
        return;
      }

      const documentId = Number(access.document.id);
      const [associations, events] = await Promise.all([
        db.execute(sql`
          SELECT id, entity_type, entity_id, relationship_type, confidence,
                 resolution_method, status, metadata, verified_by, verified_at, created_at
          FROM document_associations
          WHERE document_id = ${documentId}
          ORDER BY
            CASE status WHEN 'proposed' THEN 0 WHEN 'unresolved' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
            created_at ASC
        `),
        db.execute(sql`
          SELECT id, listener_name, event_type, action_state, payload, created_at
          FROM document_listener_events
          WHERE document_id = ${documentId}
          ORDER BY created_at DESC
          LIMIT 30
        `),
      ]);

      const summary = {
        total: associations.rows.length,
        active: associations.rows.filter((row) => (row as Record<string, unknown>).status === "active").length,
        proposed: associations.rows.filter((row) => (row as Record<string, unknown>).status === "proposed").length,
        unresolved: associations.rows.filter((row) => (row as Record<string, unknown>).status === "unresolved").length,
        rejected: associations.rows.filter((row) => (row as Record<string, unknown>).status === "rejected").length,
      };

      res.json({
        document: {
          documentRef: access.document.document_ref,
          originalFilename: access.document.original_filename,
          classification: access.document.classification,
          verificationState: access.document.verification_state,
          sensitivityLevel: access.document.sensitivity_level,
          createdAt: access.document.created_at,
        },
        summary: {
          ...summary,
          reviewRequired: summary.proposed > 0 || summary.unresolved > 0,
        },
        associations: associations.rows,
        listenerEvents: events.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:documentRef/associations/:associationId",
  requireAuth,
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const userId = req.user!.dbId!;
      const roles = req.user!.roles ?? [];
      const documentRef = String(req.params.documentRef);
      const associationId = Number(req.params.associationId);
      const decision = String((req.body as Record<string, unknown>)?.decision ?? "");

      if (!Number.isFinite(associationId)) {
        res.status(400).json({ error: "Invalid association ID." });
        return;
      }
      if (!["approve", "reject"].includes(decision)) {
        res.status(400).json({ error: "decision must be 'approve' or 'reject'." });
        return;
      }

      const access = await resolveAuthorizedDocument(documentRef, userId, roles);
      if (!access.document) {
        res.status(404).json({ error: "Document not found." });
        return;
      }
      if (!access.allowed) {
        res.status(403).json({ error: "You are not authorized to review this document's associations." });
        return;
      }

      const documentId = Number(access.document.id);
      const current = await db.execute(sql`
        SELECT *
        FROM document_associations
        WHERE id = ${associationId}
          AND document_id = ${documentId}
        LIMIT 1
      `);
      const association = current.rows[0] as Record<string, unknown> | undefined;
      if (!association) {
        res.status(404).json({ error: "Association not found." });
        return;
      }

      if (!["proposed", "unresolved"].includes(String(association.status))) {
        res.status(409).json({
          error: "Only proposed or unresolved associations may be reviewed.",
          currentStatus: association.status,
        });
        return;
      }

      const newStatus = decision === "approve" ? "active" : "rejected";
      const updated = await db.execute(sql`
        UPDATE document_associations
        SET status = ${newStatus},
            verified_by = ${userId},
            verified_at = NOW()
        WHERE id = ${associationId}
          AND document_id = ${documentId}
        RETURNING *
      `);

      await recordListenerEvent({
        documentId,
        listenerName: "association-review",
        eventType: decision === "approve"
          ? "DOCUMENT_ASSOCIATION_APPROVED"
          : "DOCUMENT_ASSOCIATION_REJECTED",
        actionState: newStatus,
        payload: {
          associationId,
          entityType: association.entity_type,
          entityId: association.entity_id,
          relationshipType: association.relationship_type,
          reviewedBy: userId,
        },
      });

      res.json({
        success: true,
        decision,
        association: updated.rows[0],
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
