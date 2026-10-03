import { eq } from "drizzle-orm";
import {
  db,
  documentAssociationsTable,
  documentRegistryTable,
} from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { getObjectAclPolicy } from "../lib/objectAcl";

const objectStorageService = new ObjectStorageService();

export function associationPrincipal(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "organization":
      return `org:${entityId}`;
    case "person":
    case "member":
      return `lineage:${entityId}`;
    case "household":
      return `household:${entityId}`;
    case "parcel":
      return `parcel:${entityId}`;
    case "case":
      return `case:${entityId}`;
    default:
      return null;
  }
}

export async function recomputeCanonicalObjectAcl(documentId: number): Promise<{
  applied: boolean;
  owner?: string;
  readers?: string[];
  reason?: string;
}> {
  const [document] = await db
    .select({
      storageProvider: documentRegistryTable.storageProvider,
      storageKey: documentRegistryTable.storageKey,
      createdBy: documentRegistryTable.createdBy,
    })
    .from(documentRegistryTable)
    .where(eq(documentRegistryTable.id, documentId))
    .limit(1);

  if (!document) return { applied: false, reason: "document_not_found" };
  if (
    document.storageProvider !== "office_object_storage" ||
    !document.storageKey ||
    !document.storageKey.startsWith("/objects/")
  ) {
    return { applied: false, reason: "non_object_storage" };
  }

  const associations = await db
    .select({
      entityType: documentAssociationsTable.entityType,
      entityId: documentAssociationsTable.entityId,
      status: documentAssociationsTable.status,
    })
    .from(documentAssociationsTable)
    .where(eq(documentAssociationsTable.documentId, documentId));

  const principals = [...new Set(
    associations
      .filter((row) => row.status === "active")
      .map((row) => associationPrincipal(row.entityType, row.entityId))
      .filter((value): value is string => Boolean(value)),
  )].sort();

  const objectFile = await objectStorageService.getObjectEntityFile(document.storageKey);
  const existing = await getObjectAclPolicy(objectFile);

  // The authenticated creator remains the primary owner when present.
  // Institutional uploads with no human creator derive an owner from active
  // relationship principals. No active relationship means an orphan principal,
  // which is intentionally unusable by ordinary request paths.
  const owner =
    document.createdBy != null
      ? String(document.createdBy)
      : principals[0] ?? existing?.owner ?? "canonical:orphaned";

  const readers = principals.filter((principal) => principal !== owner);

  await objectStorageService.trySetObjectEntityAclPolicy(document.storageKey, {
    owner,
    readers,
    visibility: "private",
  });

  return { applied: true, owner, readers };
}
