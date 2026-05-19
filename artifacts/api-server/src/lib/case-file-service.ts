/**
 * Case File Service
 *
 * Central point for creating and querying case file records.
 * Every document or matter (NFR, court order, sovereign pipeline record,
 * trust filing, intake analysis) gets a case_files row and an auto-generated
 * case number on creation.
 *
 * Number format: {PREFIX}-{YEAR}-{SEQ:04d}
 * Examples: NFR-2026-0001 · COURT-2026-0003 · FED-2026-0001 · CIV-2026-0007
 */

import { db } from "@workspace/db";
import { caseFilesTable, type InsertCaseFile } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nextDocRef, caseTypeToDocType } from "./doc-ref";
import { logger } from "./logger";

export interface OpenCaseOptions {
  caseType: string;
  jurisdictionLevel?: "federal" | "state" | "tribal" | "private";
  matterType?: string;
  title: string;
  status?: string;
  linkedDocumentType?: string;
  linkedDocumentId?: number;
  linkedDocumentRef?: string;
  assignedOfficerId?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Opens (creates) a new case file record and returns the full row.
 * The caseNumber is auto-generated via the tribal_doc_sequences counter.
 */
export async function openCaseFile(opts: OpenCaseOptions): Promise<typeof caseFilesTable.$inferSelect> {
  const docType = caseTypeToDocType(opts.caseType);
  const caseNumber = await nextDocRef(docType);

  const insert: InsertCaseFile = {
    caseNumber,
    caseType:          opts.caseType,
    jurisdictionLevel: opts.jurisdictionLevel ?? "federal",
    matterType:        opts.matterType ?? null,
    title:             opts.title,
    status:            opts.status ?? "open",
    linkedDocumentType: opts.linkedDocumentType ?? null,
    linkedDocumentId:   opts.linkedDocumentId ?? null,
    linkedDocumentRef:  opts.linkedDocumentRef ?? null,
    assignedOfficerId:  opts.assignedOfficerId ?? null,
    notes:              opts.notes ?? null,
    metadata:           opts.metadata ?? {},
  };

  const [record] = await db.insert(caseFilesTable).values(insert).returning();
  if (!record) throw new Error("Case file insert did not return a record");

  logger.info({ caseNumber, caseType: opts.caseType, linkedDocumentType: opts.linkedDocumentType }, "Case file opened");
  return record;
}

/**
 * Looks up a case file by its auto-generated case number.
 */
export async function getCaseFileByNumber(caseNumber: string) {
  const rows = await db
    .select()
    .from(caseFilesTable)
    .where(eq(caseFilesTable.caseNumber, caseNumber))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Links an existing case file to a document after the document has been
 * persisted (useful when the document ID is not known at case-open time).
 */
export async function linkDocumentToCaseFile(
  caseNumber: string,
  linkedDocumentType: string,
  linkedDocumentId: number,
  linkedDocumentRef?: string,
): Promise<void> {
  await db
    .update(caseFilesTable)
    .set({
      linkedDocumentType,
      linkedDocumentId,
      linkedDocumentRef: linkedDocumentRef ?? null,
      updatedAt: new Date(),
    })
    .where(eq(caseFilesTable.caseNumber, caseNumber));
}

/**
 * Updates the status of a case file (open → active → closed → archived).
 */
export async function updateCaseFileStatus(
  id: number,
  status: string,
  notes?: string,
): Promise<void> {
  await db
    .update(caseFilesTable)
    .set({
      status,
      notes: notes ?? undefined,
      closedAt: status === "closed" || status === "archived" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(caseFilesTable.id, id));
}
