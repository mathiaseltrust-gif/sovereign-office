import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRegisteredUser } from "../../auth/entra-guard";
import { propagateDeterministicDocumentAssociations, recordListenerEvent } from "../../engines/document-association";
import { canReviewCanonicalDocument } from "../../security/canonical-document-access";
import { resolveAuthorityContext } from "../../engines/authority-context";
import { applyProtectedAssociationSensitivity } from "../../engines/entity-resolver";
import { recomputeCanonicalObjectAcl } from "../../engines/canonical-object-acl";

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

  const authority = await resolveAuthorityContext({ userId, baseRoles: roles });
  return {
    document,
    allowed: canReviewCanonicalDocument({
      requesterId: userId,
      documentCreatedBy: document.created_by == null ? null : Number(document.created_by),
      sensitivityLevel: document.sensitivity_level == null ? null : String(document.sensitivity_level),
      authorityKeys: authority.authorityKeys,
    }),
  };
}


router.get(
  "/review-queue",
  requireAuth,
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const userId = req.user!.dbId!;
      const roles = req.user!.roles ?? [];
      const authority = await resolveAuthorityContext({ userId, baseRoles: roles });

      const result = await db.execute(sql`
        SELECT
          da.id AS association_id,
          da.document_id,
          da.entity_type,
          da.entity_id,
          da.relationship_type,
          da.confidence,
          da.resolution_method,
          da.status,
          da.metadata,
          da.created_at AS association_created_at,
          dr.document_ref,
          dr.original_filename,
          dr.title,
          dr.classification,
          dr.verification_state,
          dr.sensitivity_level,
          dr.created_by,
          dr.created_at AS document_created_at
        FROM document_associations da
        JOIN document_registry dr ON dr.id = da.document_id
        WHERE da.status IN ('proposed', 'unresolved')
        ORDER BY
          CASE da.status WHEN 'proposed' THEN 0 ELSE 1 END,
          da.created_at ASC
        LIMIT 250
      `);

      const items = (result.rows as Record<string, unknown>[]).filter((row) =>
        canReviewCanonicalDocument({
          requesterId: userId,
          documentCreatedBy: row.created_by == null ? null : Number(row.created_by),
          sensitivityLevel: row.sensitivity_level == null ? null : String(row.sensitivity_level),
          authorityKeys: authority.authorityKeys,
        }),
      );

      const byDocument = new Map<string, {
        documentRef: string;
        title: string | null;
        originalFilename: string;
        classification: string | null;
        verificationState: string;
        sensitivityLevel: string;
        createdAt: unknown;
        associations: Record<string, unknown>[];
      }>();

      for (const row of items) {
        const documentRef = String(row.document_ref);
        if (!byDocument.has(documentRef)) {
          byDocument.set(documentRef, {
            documentRef,
            title: row.title == null ? null : String(row.title),
            originalFilename: String(row.original_filename ?? ""),
            classification: row.classification == null ? null : String(row.classification),
            verificationState: String(row.verification_state ?? "unverified"),
            sensitivityLevel: String(row.sensitivity_level ?? "internal"),
            createdAt: row.document_created_at,
            associations: [],
          });
        }

        byDocument.get(documentRef)!.associations.push({
          id: Number(row.association_id),
          entityType: String(row.entity_type),
          entityId: String(row.entity_id),
          relationshipType: String(row.relationship_type),
          confidence: String(row.confidence),
          resolutionMethod: String(row.resolution_method),
          status: String(row.status),
          metadata: row.metadata ?? {},
          createdAt: row.association_created_at,
        });
      }

      const documents = [...byDocument.values()];
      res.json({
        summary: {
          documents: documents.length,
          associations: items.length,
          proposed: items.filter((row) => row.status === "proposed").length,
          unresolved: items.filter((row) => row.status === "unresolved").length,
        },
        documents,
      });
    } catch (err) {
      next(err);
    }
  },
);

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

      const aclProjection = await recomputeCanonicalObjectAcl(documentId).catch(() => ({
        applied: false,
        reason: "acl_projection_failed",
      }));

      let protectionEscalation = null;
      let propagation: Awaited<ReturnType<typeof propagateDeterministicDocumentAssociations>> | null = null;
      if (decision === "approve") {
        protectionEscalation = await applyProtectedAssociationSensitivity({
          documentId,
          entityType: String(association.entity_type),
          entityId: String(association.entity_id),
          associationStatus: newStatus,
          listenerName: "association-review",
        });

        // Approval can unlock deterministic downstream relationships. Project
        // those relationships now; rejected candidates never propagate.
        propagation = await propagateDeterministicDocumentAssociations(documentId, userId);
      }

      res.json({
        success: true,
        decision,
        association: updated.rows[0],
        protectionEscalation,
        propagation,
        aclProjection,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
