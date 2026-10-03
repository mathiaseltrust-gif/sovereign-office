import { Router } from "express";
import { Readable } from "stream";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRegisteredUser } from "../../auth/entra-guard";
import { canViewLineageDocuments } from "../../security/lineage-document-access";
import { resolveAuthorityContext } from "../../engines/authority-context";
import { ObjectNotFoundError, ObjectStorageService } from "../../lib/objectStorage";
import { ObjectPermission } from "../../lib/objectAcl";
import { recomputeCanonicalObjectAcl } from "../../engines/canonical-object-acl";

const router = Router();
const objectStorageService = new ObjectStorageService();

async function resolveLineageDocumentAccess(
  lineageId: number,
  requesterId: number,
  baseRoles: string[],
) {
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
  if (!target) return { target: null, allowed: false };

  const authority = await resolveAuthorityContext({
    userId: requesterId,
    baseRoles,
  });
  const allowed = canViewLineageDocuments({
    requesterId,
    targetLinkedProfileUserId: target.linked_profile_user_id == null
      ? null
      : Number(target.linked_profile_user_id),
    targetUserId: target.user_id == null ? null : Number(target.user_id),
    authorityKeys: authority.authorityKeys,
  });

  return { target, allowed };
}


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

      const requesterId = req.user!.dbId!;
      const access = await resolveLineageDocumentAccess(
        lineageId,
        requesterId,
        req.user!.roles ?? [],
      );
      if (!access.target) {
        res.status(404).json({ error: "Lineage record not found." });
        return;
      }
      const target = access.target;

      if (!access.allowed) {
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


router.get(
  "/:lineageId/documents/:documentRef/download",
  requireAuth,
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const lineageId = Number(req.params.lineageId);
      if (!Number.isFinite(lineageId) || lineageId <= 0) {
        res.status(400).json({ error: "Invalid lineage record ID." });
        return;
      }

      const requesterId = req.user!.dbId!;
      const access = await resolveLineageDocumentAccess(
        lineageId,
        requesterId,
        req.user!.roles ?? [],
      );
      if (!access.target) {
        res.status(404).json({ error: "Lineage record not found." });
        return;
      }
      if (!access.allowed) {
        res.status(403).json({ error: "You are not authorized to open supporting documents for this lineage record." });
        return;
      }

      const documentRef = String(req.params.documentRef);
      const result = await db.execute(sql`
        SELECT
          dr.id,
          dr.document_ref,
          dr.original_filename,
          dr.storage_provider,
          dr.storage_key
        FROM document_associations da
        JOIN document_registry dr ON dr.id = da.document_id
        WHERE da.entity_type IN ('person', 'member')
          AND da.entity_id = ${String(lineageId)}
          AND da.status = 'active'
          AND dr.document_ref = ${documentRef}
        LIMIT 1
      `);
      const document = result.rows[0] as Record<string, unknown> | undefined;
      if (!document) {
        res.status(404).json({ error: "Active linked document not found." });
        return;
      }

      if (String(document.storage_provider) !== "office_object_storage" || !document.storage_key) {
        res.status(409).json({
          error: "This document is stored through another repository provider and is not directly streamable from this route.",
          storageProvider: document.storage_provider,
        });
        return;
      }

      const documentId = Number(document.id);
      await recomputeCanonicalObjectAcl(documentId);

      const objectFile = await objectStorageService.getObjectEntityFile(String(document.storage_key));
      const allowedByAcl = await objectStorageService.canAccessObjectEntity({
        userId: String(requesterId),
        principalIds: [`lineage:${lineageId}`],
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });

      if (!allowedByAcl) {
        res.status(403).json({ error: "Object ACL denied access to this linked lineage document." });
        return;
      }

      const response = await objectStorageService.downloadObject(objectFile);
      const safeFilename = String(document.original_filename ?? documentRef).replace(/[\r\n"]/g, "_");
      res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.status(response.status);

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "File not found in object storage." });
        return;
      }
      next(err);
    }
  },
);

export default router;
