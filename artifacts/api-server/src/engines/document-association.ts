import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  documentAssociationsTable,
  documentListenerEventsTable,
  documentRegistryTable,
} from "@workspace/db";

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
  | "external_source_id";

const AUTO_LINK_METHODS = new Set<ResolutionMethod>([
  "parcel_number",
  "tribal_land_designation",
  "member_id",
  "tribal_id",
  "verified_email",
  "external_source_id",
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
