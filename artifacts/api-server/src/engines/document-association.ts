import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  documentAssociationsTable,
  documentListenerEventsTable,
  documentRegistryTable,
} from "@workspace/db";
import { recomputeCanonicalObjectAcl } from "./canonical-object-acl";

export type AssociationConfidence = "exact" | "very_high" | "high" | "medium" | "low";
export type AssociationStatus = "active" | "proposed" | "unresolved" | "rejected";

export type ResolutionMethod =
  | "parcel_number"
  | "tribal_land_designation"
  | "member_id"
  | "tribal_id"
  | "verified_email"
  | "normalized_address"
  | "legal_description"
  | "listener"
  | "ai_extraction"
  | "manual"
  | "external_source_id"
  | "case_number"
  | "verified_alias"
  | "normalized_name"
  | "system_created";

const AUTO_LINK_METHODS = new Set<ResolutionMethod>([
  "parcel_number",
  "tribal_land_designation",
  "member_id",
  "tribal_id",
  "verified_email",
  "external_source_id",
  "case_number",
  "verified_alias",
  "system_created",
  "manual",
]);

export function associationStatusFor(
  confidence: AssociationConfidence,
  resolutionMethod: ResolutionMethod,
): AssociationStatus {
  // Deterministic identifiers may auto-link at high confidence. Fuzzy/AI
  // extraction remains reviewable even when the model is confident.
  if (
    AUTO_LINK_METHODS.has(resolutionMethod) &&
    (confidence === "exact" || confidence === "very_high" || confidence === "high")
  ) {
    return "active";
  }
  if (confidence === "low") return "unresolved";
  return "proposed";
}

function newDocumentRef(): string {
  const year = new Date().getUTCFullYear();
  return `DOC-${year}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export interface RegisterDocumentInput {
  originalFilename: string;
  title?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  storageProvider: string;
  storageKey?: string | null;
  externalId?: string | null;
  sourceChannel?: string;
  sourceUri?: string | null;
  classification?: string | null;
  verificationState?: string;
  sensitivityLevel?: string;
  metadata?: Record<string, unknown>;
  createdBy?: number | null;
}

export async function registerDocument(input: RegisterDocumentInput) {
  // Deduplicate only inside the same human ownership boundary. Never use a
  // content hash to silently join records belonging to different principals.
  if (input.sha256 && input.createdBy) {
    const existing = await db
      .select()
      .from(documentRegistryTable)
      .where(and(
        eq(documentRegistryTable.sha256, input.sha256),
        eq(documentRegistryTable.createdBy, input.createdBy),
      ))
      .limit(1);
    if (existing[0]) return { record: existing[0], reusedExisting: true };
  }

  const [record] = await db.insert(documentRegistryTable).values({
    documentRef: newDocumentRef(),
    title: input.title ?? input.originalFilename,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? null,
    sha256: input.sha256 ?? null,
    storageProvider: input.storageProvider,
    storageKey: input.storageKey ?? null,
    externalId: input.externalId ?? null,
    sourceChannel: input.sourceChannel ?? "manual_upload",
    sourceUri: input.sourceUri ?? null,
    classification: input.classification ?? null,
    verificationState: input.verificationState ?? "unverified",
    sensitivityLevel: input.sensitivityLevel ?? "internal",
    metadata: input.metadata ?? {},
    createdBy: input.createdBy ?? null,
  }).returning();

  return { record, reusedExisting: false };
}

export interface AssociateDocumentInput {
  documentId: number;
  entityType: string;
  entityId: string;
  relationshipType: string;
  confidence: AssociationConfidence;
  resolutionMethod: ResolutionMethod;
  metadata?: Record<string, unknown>;
  verifiedBy?: number | null;
}

export async function associateDocument(input: AssociateDocumentInput) {
  const status = associationStatusFor(input.confidence, input.resolutionMethod);
  const verified = status === "active" && input.resolutionMethod === "manual";

  const inserted = await db.insert(documentAssociationsTable).values({
    documentId: input.documentId,
    entityType: input.entityType,
    entityId: input.entityId,
    relationshipType: input.relationshipType,
    confidence: input.confidence,
    resolutionMethod: input.resolutionMethod,
    status,
    metadata: input.metadata ?? {},
    verifiedBy: verified ? (input.verifiedBy ?? null) : null,
    verifiedAt: verified ? new Date() : null,
  }).onConflictDoNothing().returning();

  if (status === "active") {
    await recomputeCanonicalObjectAcl(input.documentId).catch(() => null);
  }

  return inserted[0] ?? null;
}

export async function recordListenerEvent(input: {
  documentId: number;
  listenerName: string;
  eventType: string;
  actionState?: string;
  payload?: Record<string, unknown>;
}) {
  const [event] = await db.insert(documentListenerEventsTable).values({
    documentId: input.documentId,
    listenerName: input.listenerName,
    eventType: input.eventType,
    actionState: input.actionState ?? "observed",
    payload: input.payload ?? {},
  }).returning();

  return event;
}


/**
 * Project only relationships that are explicit in authoritative Office records.
 *
 * This intentionally does not infer household, trust, case, or property links
 * from resemblance, names, or AI output. Fuzzy matches remain reviewable.
 */
export async function propagateDeterministicDocumentAssociations(
  documentId: number,
  verifiedBy?: number | null,
) {
  const projected: Array<{
    fromEntityType: string;
    fromEntityId: string;
    entityType: string;
    entityId: string;
    relationshipType: string;
  }> = [];

  for (let pass = 0; pass < 4; pass++) {
    const active = await db.execute(sql`
      SELECT entity_type, entity_id
      FROM document_associations
      WHERE document_id = ${documentId}
        AND status = 'active'
      ORDER BY id ASC
    `);

    let insertedThisPass = 0;

    for (const row of active.rows as Record<string, unknown>[]) {
      const sourceType = String(row.entity_type ?? "");
      const sourceId = String(row.entity_id ?? "");
      const targets: Array<{
        entityType: string;
        entityId: string;
        relationshipType: string;
        metadata: Record<string, unknown>;
      }> = [];

      if (sourceType === "board_matter" && /^\d+$/.test(sourceId)) {
        const linked = await db.execute(sql`
          SELECT org_id
          FROM board_matters
          WHERE id = ${Number(sourceId)}
          LIMIT 1
        `);
        const orgId = (linked.rows[0] as Record<string, unknown> | undefined)?.org_id;
        if (orgId) {
          targets.push({
            entityType: "organization",
            entityId: String(orgId),
            relationshipType: "oversight_context",
            metadata: { derivedFrom: "board_matter", sourceEntityId: sourceId },
          });
        }
      }

      if (sourceType === "encumbrance" && /^\d+$/.test(sourceId)) {
        const linked = await db.execute(sql`
          SELECT parcel_id
          FROM land_encumbrances
          WHERE id = ${Number(sourceId)}
          LIMIT 1
        `);
        const parcelId = (linked.rows[0] as Record<string, unknown> | undefined)?.parcel_id;
        if (parcelId) {
          targets.push({
            entityType: "parcel",
            entityId: String(parcelId),
            relationshipType: "related_property",
            metadata: { derivedFrom: "encumbrance", sourceEntityId: sourceId },
          });
        }
      }

      if (sourceType === "court_document" && /^\d+$/.test(sourceId)) {
        const linked = await db.execute(sql`
          SELECT case_details ->> 'parcelLinked' AS parcel_id
          FROM court_documents
          WHERE id = ${Number(sourceId)}
          LIMIT 1
        `);
        const parcelId = (linked.rows[0] as Record<string, unknown> | undefined)?.parcel_id;
        if (parcelId && /^\d+$/.test(String(parcelId))) {
          targets.push({
            entityType: "parcel",
            entityId: String(parcelId),
            relationshipType: "related_property",
            metadata: { derivedFrom: "court_document", sourceEntityId: sourceId },
          });
        }
      }

      for (const target of targets) {
        const association = await associateDocument({
          documentId,
          entityType: target.entityType,
          entityId: target.entityId,
          relationshipType: target.relationshipType,
          confidence: "exact",
          resolutionMethod: "system_created",
          metadata: {
            ...target.metadata,
            propagation: "deterministic_listener",
          },
          verifiedBy: verifiedBy ?? null,
        });

        if (!association) continue;
        insertedThisPass += 1;
        projected.push({
          fromEntityType: sourceType,
          fromEntityId: sourceId,
          entityType: target.entityType,
          entityId: target.entityId,
          relationshipType: target.relationshipType,
        });

        await recordListenerEvent({
          documentId,
          listenerName: "relationship-projector",
          eventType: "DOCUMENT_ASSOCIATION_PROPAGATED",
          actionState: "active",
          payload: {
            fromEntityType: sourceType,
            fromEntityId: sourceId,
            entityType: target.entityType,
            entityId: target.entityId,
            relationshipType: target.relationshipType,
          },
        });
      }
    }

    if (insertedThisPass === 0) break;
  }

  if (projected.length > 0) {
    await recomputeCanonicalObjectAcl(documentId).catch(() => null);
  }

  await recordListenerEvent({
    documentId,
    listenerName: "relationship-projector",
    eventType: "DOCUMENT_LISTENER_PASS_COMPLETED",
    actionState: "complete",
    payload: { projectedCount: projected.length, projected },
  });

  return { projectedCount: projected.length, projected };
}
