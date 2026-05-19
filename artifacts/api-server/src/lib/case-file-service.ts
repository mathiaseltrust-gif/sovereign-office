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
import { caseFilesTable, caseNumberHistoryTable, type InsertCaseFile } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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

export interface ReclassifyOptions {
  newCaseNumber: string;
  reason: string;
  amendmentType?: string;
  notes?: string;
  reclassifiedById?: number;
}

/**
 * Reclassifies a case file to a new case number.
 * Records the former number in case_number_history so documents
 * can render "formerly known as [old number]" on reprints and amendments.
 * The old number remains resolvable via getCaseFileByFormerNumber().
 */
export async function reclassifyCaseFile(
  currentCaseNumber: string,
  opts: ReclassifyOptions,
): Promise<typeof caseFilesTable.$inferSelect> {
  const rows = await db
    .select()
    .from(caseFilesTable)
    .where(eq(caseFilesTable.caseNumber, currentCaseNumber))
    .limit(1);

  if (!rows[0]) throw new Error(`Case file not found: ${currentCaseNumber}`);
  const cf = rows[0];

  // Guard: new number must not already be in use
  const conflict = await db
    .select({ id: caseFilesTable.id })
    .from(caseFilesTable)
    .where(eq(caseFilesTable.caseNumber, opts.newCaseNumber))
    .limit(1);
  if (conflict[0]) throw new Error(`Case number already in use: ${opts.newCaseNumber}`);

  // Write history first, then update the primary record
  await db.insert(caseNumberHistoryTable).values({
    caseFileId:       cf.id,
    formerCaseNumber: currentCaseNumber,
    newCaseNumber:    opts.newCaseNumber,
    reason:           opts.reason,
    amendmentType:    opts.amendmentType ?? "reclassification",
    notes:            opts.notes ?? null,
    reclassifiedById: opts.reclassifiedById ?? null,
  });

  const [updated] = await db
    .update(caseFilesTable)
    .set({ caseNumber: opts.newCaseNumber, updatedAt: new Date() })
    .where(eq(caseFilesTable.id, cf.id))
    .returning();

  if (!updated) throw new Error("Reclassification update did not return a record");

  logger.info(
    { formerCaseNumber: currentCaseNumber, newCaseNumber: opts.newCaseNumber, caseFileId: cf.id },
    "Case file reclassified",
  );
  return updated;
}

/**
 * Resolves a case file by either its current number OR any former number
 * stored in case_number_history. Returns { caseFile, redirected, formerNumber }.
 */
export async function resolveCaseFileByNumber(caseNumber: string): Promise<{
  caseFile: typeof caseFilesTable.$inferSelect;
  redirected: boolean;
  formerNumber: string | null;
} | null> {
  // Try current number first
  const direct = await db
    .select()
    .from(caseFilesTable)
    .where(eq(caseFilesTable.caseNumber, caseNumber))
    .limit(1);

  if (direct[0]) return { caseFile: direct[0], redirected: false, formerNumber: null };

  // Try as a former number
  const histRows = await db
    .select()
    .from(caseNumberHistoryTable)
    .where(eq(caseNumberHistoryTable.formerCaseNumber, caseNumber))
    .orderBy(desc(caseNumberHistoryTable.reclassifiedAt))
    .limit(1);

  if (!histRows[0]) return null;

  const current = await db
    .select()
    .from(caseFilesTable)
    .where(eq(caseFilesTable.caseNumber, histRows[0].newCaseNumber))
    .limit(1);

  if (!current[0]) return null;
  return { caseFile: current[0], redirected: true, formerNumber: caseNumber };
}

/**
 * Returns the full reclassification history for a case file (by DB id), newest first.
 */
export async function getCaseNumberHistory(
  caseFileId: number,
): Promise<typeof caseNumberHistoryTable.$inferSelect[]> {
  return db
    .select()
    .from(caseNumberHistoryTable)
    .where(eq(caseNumberHistoryTable.caseFileId, caseFileId))
    .orderBy(desc(caseNumberHistoryTable.reclassifiedAt));
}
