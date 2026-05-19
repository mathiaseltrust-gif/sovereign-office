/**
 * Case Files API
 *
 * GET  /api/case-files                     — list all case files (with optional filters)
 * GET  /api/case-files/:caseNumber/detail  — enriched detail: base record + linked entities
 * GET  /api/case-files/:caseNumber         — get a single case file by its case number
 * POST /api/case-files                     — manually open a new case file
 * PATCH /api/case-files/:id/status         — update status
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { caseFilesTable } from "@workspace/db";
import { eq, desc, and, like, or, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { openCaseFile, updateCaseFileStatus } from "../../lib/case-file-service";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { caseType, jurisdictionLevel, status, matterType, q } = req.query as Record<string, string | undefined>;

    let query = db.select().from(caseFilesTable).$dynamic();

    const conditions = [];
    if (caseType)         conditions.push(eq(caseFilesTable.caseType, caseType));
    if (jurisdictionLevel) conditions.push(eq(caseFilesTable.jurisdictionLevel, jurisdictionLevel));
    if (status)           conditions.push(eq(caseFilesTable.status, status));
    if (matterType)       conditions.push(eq(caseFilesTable.matterType, matterType));
    if (q)                conditions.push(like(caseFilesTable.caseNumber, `%${q}%`));

    if (conditions.length) {
      query = query.where(and(...conditions));
    }

    const rows = await query.orderBy(desc(caseFilesTable.createdAt)).limit(200);
    res.json({ total: rows.length, cases: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:caseNumber/detail", requireAuth, async (req, res, next) => {
  try {
    const caseNumber = req.params.caseNumber as string;

    const rows = await db
      .select()
      .from(caseFilesTable)
      .where(eq(caseFilesTable.caseNumber, caseNumber))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "Case file not found" });
      return;
    }

    const cf = rows[0];

    const [
      protectiveOrders,
      nfrDocuments,
      complaints,
      nfrInvCount,
      relatedCaseFiles,
      linkedMemberRows,
      linkedPipelineRows,
    ] = await Promise.all([
      db.execute<{
        id: number; case_number: string; title: string; status: string;
        named_respondents: unknown; legal_bases: unknown;
        issued_date: string; expires_date: string; court: string; summary: string;
      }>(sql`
        SELECT id, case_number, title, status, named_respondents, legal_bases,
               issued_date, expires_date, court, summary
        FROM protective_orders
        WHERE case_number = ${caseNumber}
           OR case_number = ${cf.linkedDocumentRef ?? "__none__"}
        ORDER BY id
      `),

      db.execute<{
        id: number; tribal_ref: string; triggering_entity: string;
        urgency_score: number; status: string; protection_category: string; created_at: string;
      }>(sql`
        SELECT id, tribal_ref, triggering_entity, urgency_score, status, protection_category, created_at
        FROM nfr_documents
        WHERE tribal_ref = ${caseNumber}
        ORDER BY id
      `),

      db.execute<{
        id: number; text: string; classification: string; status: string;
        tribal_ref: string; created_at: string;
      }>(sql`
        SELECT id, text, classification, status, tribal_ref, created_at
        FROM complaints
        WHERE tribal_ref = ${caseNumber}
        ORDER BY id
      `),

      db.execute<{ cnt: string }>(sql`
        SELECT COUNT(*)::text AS cnt
        FROM nfr_investigations
        WHERE affected_user_id = ${cf.assignedOfficerId ?? -1}
           OR triggering_event_id::text = ${String(cf.linkedDocumentId ?? -1)}
      `),

      db.execute<{
        id: number; case_number: string; case_type: string; jurisdiction_level: string;
        matter_type: string; title: string; status: string;
        linked_document_type: string; linked_document_id: number; linked_document_ref: string;
        assigned_officer_id: number; opened_at: string; closed_at: string;
        notes: string; metadata: unknown; created_at: string; updated_at: string;
      }>(sql`
        SELECT id, case_number, case_type, jurisdiction_level, matter_type, title, status,
               linked_document_type, linked_document_id, linked_document_ref,
               assigned_officer_id, opened_at, closed_at, notes, metadata, created_at, updated_at
        FROM case_files
        WHERE id != ${cf.id}
          AND (
            (linked_document_id IS NOT NULL AND linked_document_id = ${cf.linkedDocumentId ?? -1})
            OR matter_type = ${cf.matterType ?? "__none__"}
          )
        ORDER BY created_at DESC
        LIMIT 5
      `),

      cf.linkedDocumentType === "family_lineage" && cf.linkedDocumentId
        ? db.execute<{
            id: number; full_name: string; first_name: string; last_name: string;
            birth_year: number; location_address: string; membership_status: string;
            tribal_enrollment_number: string; is_deceased: boolean; contact_email: string;
          }>(sql`
            SELECT id, full_name, first_name, last_name, birth_year, location_address,
                   membership_status, tribal_enrollment_number, is_deceased, contact_email
            FROM family_lineage
            WHERE id = ${cf.linkedDocumentId}
            LIMIT 1
          `)
        : Promise.resolve({ rows: [] }),

      cf.linkedDocumentType === "sovereign_pipeline" && cf.linkedDocumentId
        ? db.execute<{
            id: number; file_number: string; matter_type: string; risk_level: string;
            status: string; generated_summary: string; template_title: string; created_at: string;
          }>(sql`
            SELECT id, file_number, matter_type, risk_level, status,
                   generated_summary, template_title, created_at
            FROM sovereign_pipeline_records
            WHERE id = ${cf.linkedDocumentId}
            LIMIT 1
          `)
        : Promise.resolve({ rows: [] }),
    ]);

    const memberRow = linkedMemberRows.rows[0] ?? null;
    const pipelineRow = linkedPipelineRows.rows[0] ?? null;

    res.json({
      caseFile: cf,
      linkedMember: memberRow
        ? {
            id: memberRow.id,
            fullName: memberRow.full_name,
            firstName: memberRow.first_name,
            lastName: memberRow.last_name,
            birthYear: memberRow.birth_year,
            locationAddress: memberRow.location_address,
            membershipStatus: memberRow.membership_status,
            tribalEnrollmentNumber: memberRow.tribal_enrollment_number,
            isDeceased: memberRow.is_deceased,
            contactEmail: memberRow.contact_email,
          }
        : null,
      linkedPipelineRecord: pipelineRow
        ? {
            id: pipelineRow.id,
            fileNumber: pipelineRow.file_number,
            matterType: pipelineRow.matter_type,
            riskLevel: pipelineRow.risk_level,
            status: pipelineRow.status,
            generatedSummary: pipelineRow.generated_summary,
            templateTitle: pipelineRow.template_title,
            createdAt: pipelineRow.created_at,
          }
        : null,
      protectiveOrders: protectiveOrders.rows.map((po) => ({
        id: po.id,
        caseNumber: po.case_number,
        title: po.title,
        status: po.status,
        namedRespondents: Array.isArray(po.named_respondents) ? po.named_respondents : [],
        legalBases: Array.isArray(po.legal_bases) ? po.legal_bases : [],
        issuedDate: po.issued_date,
        expiresDate: po.expires_date,
        court: po.court,
        summary: po.summary,
      })),
      nfrDocuments: nfrDocuments.rows.map((d) => ({
        id: d.id,
        tribalRef: d.tribal_ref,
        triggeringEntity: d.triggering_entity,
        urgencyScore: d.urgency_score,
        status: d.status,
        protectionCategory: d.protection_category,
        createdAt: d.created_at,
      })),
      complaints: complaints.rows.map((c) => ({
        id: c.id,
        text: c.text,
        classification: c.classification,
        status: c.status,
        tribalRef: c.tribal_ref,
        createdAt: c.created_at,
      })),
      nfrInvestigationCount: parseInt(nfrInvCount.rows[0]?.cnt ?? "0", 10),
      relatedCaseFiles: relatedCaseFiles.rows.map((r) => ({
        id: r.id,
        caseNumber: r.case_number,
        caseType: r.case_type,
        jurisdictionLevel: r.jurisdiction_level,
        matterType: r.matter_type,
        title: r.title,
        status: r.status,
        linkedDocumentType: r.linked_document_type,
        linkedDocumentId: r.linked_document_id,
        linkedDocumentRef: r.linked_document_ref,
        assignedOfficerId: r.assigned_officer_id,
        openedAt: r.opened_at,
        closedAt: r.closed_at,
        notes: r.notes,
        metadata: r.metadata as Record<string, unknown>,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:caseNumber", requireAuth, async (req, res, next) => {
  try {
    const caseNumber = req.params.caseNumber as string;
    const rows = await db
      .select()
      .from(caseFilesTable)
      .where(eq(caseFilesTable.caseNumber, caseNumber))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Case file not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const {
      caseType,
      jurisdictionLevel,
      matterType,
      title,
      linkedDocumentType,
      linkedDocumentId,
      linkedDocumentRef,
      notes,
      metadata,
    } = req.body as {
      caseType?: string;
      jurisdictionLevel?: "federal" | "state" | "tribal" | "private";
      matterType?: string;
      title?: string;
      linkedDocumentType?: string;
      linkedDocumentId?: number;
      linkedDocumentRef?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    };

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const assignedOfficerId = req.user?.dbId ?? undefined;
    const record = await openCaseFile({
      caseType:          caseType ?? "general",
      jurisdictionLevel: jurisdictionLevel ?? "federal",
      matterType,
      title,
      linkedDocumentType,
      linkedDocumentId,
      linkedDocumentRef,
      assignedOfficerId,
      notes,
      metadata,
    });

    logger.info({ caseNumber: record.caseNumber, userId: req.user?.dbId }, "Case file manually opened via API");
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body as { status?: string; notes?: string };

    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }

    const allowed = ["open", "active", "pending_review", "closed", "archived"];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      return;
    }

    await updateCaseFileStatus(id, status, notes);

    const updated = await db.select().from(caseFilesTable).where(eq(caseFilesTable.id, id)).limit(1);
    res.json(updated[0] ?? { id, status });
  } catch (err) {
    next(err);
  }
});

export default router;
