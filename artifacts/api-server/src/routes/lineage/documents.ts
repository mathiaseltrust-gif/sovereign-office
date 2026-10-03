import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRegisteredUser } from "../../auth/entra-guard";
import { canViewLineageDocuments } from "../../security/lineage-document-access";

const router = Router();

router.get(
  "/:lineageId/documents",
  requireAuth,
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const lineageId = Number(req.params.lineageId);
      if (!Number.isFinite(lineageId) || lineageId <= 0) {
        res.status(400).json({ error: "Invalid lineage record ID." });
        return;
      }

      const targetResult = await db.execute(sql`
        SELECT
          id,
          full_name,
          linked_profile_user_id,
          user_id,
          protection_level,
          visibility
        FROM family_lineage
        WHERE id = ${lineageId}
        LIMIT 1
      `);
      const target = targetResult.rows[0] as Record<string, unknown> | undefined;
      if (!target) {
        res.status(404).json({ error: "Lineage record not found." });
        return;
      }

      const requesterId = req.user!.dbId!;
      const roles = req.user!.roles ?? [];
      const allowed = canViewLineageDocuments({
        requesterId,
        targetLinkedProfileUserId: target.linked_profile_user_id == null
          ? null
          : Number(target.linked_profile_user_id),
        targetUserId: target.user_id == null ? null : Number(target.user_id),
        roles,
      });

      if (!allowed) {
        res.status(403).json({
          error: "You are not authorized to view supporting documents for this lineage record.",
        });
        return;
      }

      const documents = await db.execute(sql`
        SELECT
          da.id AS association_id,
          da.relationship_type,
          da.confidence,
          da.resolution_method,
          da.created_at AS linked_at,
          dr.id AS registry_id,
          dr.document_ref,
          dr.title,
          dr.original_filename,
          dr.classification,
          dr.verification_state,
          dr.sensitivity_level,
          dr.storage_provider,
          dr.source_channel,
          dr.created_at
        FROM document_associations da
        JOIN document_registry dr
          ON dr.id = da.document_id
        WHERE da.entity_type IN ('person', 'member')
          AND da.entity_id = ${String(lineageId)}
          AND da.status = 'active'
        ORDER BY da.created_at DESC
      `);

      res.json({
        lineage: {
          id: lineageId,
          fullName: target.full_name,
          protectionLevel: target.protection_level,
          visibility: target.visibility,
        },
        documents: documents.rows,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
