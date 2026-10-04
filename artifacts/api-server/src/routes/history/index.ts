import { randomUUID } from "crypto";
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRegisteredUser } from "../../auth/entra-guard";
import { associateDocument, recordListenerEvent } from "../../engines/document-association";
import { canManageHouseholdPerson, hasHouseholdElevatedRole } from "../../engines/household-authority";

const router = Router();
const RECORD_STATUSES = new Set(["asserted", "documented", "verified", "disputed", "superseded"]);
const DATE_PRECISIONS = new Set(["exact", "day", "month", "year", "approximate", "range", "unknown"]);

function eventRef() {
  const year = new Date().getUTCFullYear();
  return `HIST-${year}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

async function canAccessHistoryEntity(userId: number, roles: string[], entityType: string | null, entityId: string | null) {
  if (hasHouseholdElevatedRole(roles)) return true;
  if (entityType !== "person" || !entityId || !/^\d+$/.test(entityId)) return false;
  return canManageHouseholdPerson({ userId, roles, lineageId: Number(entityId) });
}

function asDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

router.get(
  "/events",
  requireAuth,
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const userId = req.user!.dbId!;
      const roles = req.user?.roles ?? [];
      const entityType = req.query.entityType ? String(req.query.entityType) : null;
      const entityId = req.query.entityId ? String(req.query.entityId) : null;
      const limit = Math.max(1, Math.min(250, Number(req.query.limit ?? 100) || 100));

      if (!(await canAccessHistoryEntity(userId, roles, entityType, entityId))) {
        res.status(403).json({ error: "This history is outside your authorized household scope." });
        return;
      }

      const result = await db.execute(sql`
        SELECT DISTINCT
          e.id, e.event_ref, e.title, e.summary, e.event_type,
          e.occurred_at, e.occurred_end_at, e.date_label, e.date_precision,
          e.record_status, e.source_type, e.source_summary,
          e.sensitivity_level, e.metadata, e.created_by, e.verified_by,
          e.verified_at, e.created_at, e.updated_at
        FROM sovereign_history_events e
        LEFT JOIN sovereign_history_event_entities ee ON ee.event_id = e.id
        WHERE (${entityType}::text IS NULL OR ee.entity_type = ${entityType})
          AND (${entityId}::text IS NULL OR ee.entity_id = ${entityId})
        ORDER BY COALESCE(e.occurred_at, e.created_at) DESC, e.id DESC
        LIMIT ${limit}
      `);

      const eventIds = (result.rows as Record<string, unknown>[]).map((row) => Number(row.id));
      if (eventIds.length === 0) {
        res.json({ events: [] });
        return;
      }

      const [entityLinks, documentLinks] = await Promise.all([
        db.execute(sql`
          SELECT event_id, entity_type, entity_id, relationship_type, metadata
          FROM sovereign_history_event_entities
          WHERE event_id = ANY(${eventIds}::int[])
          ORDER BY id ASC
        `),
        db.execute(sql`
          SELECT hd.event_id, hd.relationship_type, dr.document_ref,
                 dr.title, dr.original_filename, dr.classification, dr.verification_state
          FROM sovereign_history_event_documents hd
          JOIN document_registry dr ON dr.id = hd.document_id
          WHERE hd.event_id = ANY(${eventIds}::int[])
          ORDER BY hd.id ASC
        `),
      ]);

      res.json({
        events: (result.rows as Record<string, unknown>[]).map((row) => ({
          ...row,
          entities: entityLinks.rows.filter((link) => Number((link as Record<string, unknown>).event_id) === Number(row.id)),
          documents: documentLinks.rows.filter((link) => Number((link as Record<string, unknown>).event_id) === Number(row.id)),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/events",
  requireAuth,
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const userId = req.user!.dbId!;
      const roles = req.user?.roles ?? [];
      const body = (req.body ?? {}) as Record<string, unknown>;
      const title = String(body.title ?? "").trim();
      if (!title) {
        res.status(400).json({ error: "title is required." });
        return;
      }

      let status = String(body.recordStatus ?? "asserted");
      if (!RECORD_STATUSES.has(status)) {
        res.status(400).json({ error: "Invalid recordStatus." });
        return;
      }
      const precision = String(body.datePrecision ?? "exact");
      if (!DATE_PRECISIONS.has(precision)) {
        res.status(400).json({ error: "Invalid datePrecision." });
        return;
      }

      const entities = Array.isArray(body.entities) ? body.entities : [];
      if (!hasHouseholdElevatedRole(roles)) {
        if (entities.length === 0) {
          res.status(400).json({ error: "A household history entry must identify the person it belongs to." });
          return;
        }
        for (const raw of entities) {
          const entity = raw as Record<string, unknown>;
          const entityType = String(entity.entityType ?? "");
          const entityId = String(entity.entityId ?? "");
          if (!(await canAccessHistoryEntity(userId, roles, entityType, entityId))) {
            res.status(403).json({ error: "You may only add history within your own household scope." });
            return;
          }
        }
        if (status === "verified") status = "documented";
        if (status === "superseded") status = "asserted";
      }

      const occurredAt = asDate(body.occurredAt);
      const occurredEndAt = asDate(body.occurredEndAt);
      const ref = eventRef();
      const verified = status === "verified";

      const inserted = await db.execute(sql`
        INSERT INTO sovereign_history_events (
          event_ref, title, summary, event_type, occurred_at, occurred_end_at,
          date_label, date_precision, record_status, source_type, source_summary,
          sensitivity_level, metadata, created_by, verified_by, verified_at
        ) VALUES (
          ${ref},
          ${title},
          ${body.summary ? String(body.summary) : null},
          ${String(body.eventType ?? "historical_event")},
          ${occurredAt},
          ${occurredEndAt},
          ${body.dateLabel ? String(body.dateLabel) : null},
          ${precision},
          ${status},
          ${String(body.sourceType ?? "manual")},
          ${body.sourceSummary ? String(body.sourceSummary) : null},
          ${String(body.sensitivityLevel ?? "internal")},
          ${JSON.stringify((body.metadata && typeof body.metadata === "object") ? body.metadata : {})}::jsonb,
          ${userId},
          ${verified ? userId : null},
          ${verified ? new Date() : null}
        )
        RETURNING *
      `);
      const event = inserted.rows[0] as Record<string, unknown>;
      const eventId = Number(event.id);

      for (const raw of entities) {
        const entity = raw as Record<string, unknown>;
        const entityType = String(entity.entityType ?? "").trim();
        const entityId = String(entity.entityId ?? "").trim();
        if (!entityType || !entityId) continue;
        await db.execute(sql`
          INSERT INTO sovereign_history_event_entities (
            event_id, entity_type, entity_id, relationship_type, metadata
          ) VALUES (
            ${eventId}, ${entityType}, ${entityId},
            ${String(entity.relationshipType ?? "subject")},
            ${JSON.stringify((entity.metadata && typeof entity.metadata === "object") ? entity.metadata : {})}::jsonb
          )
          ON CONFLICT DO NOTHING
        `);
      }

      const documentRefs = Array.isArray(body.documentRefs) ? body.documentRefs.map(String) : [];
      for (const documentRef of documentRefs) {
        const docResult = await db.execute(sql`
          SELECT id FROM document_registry WHERE document_ref = ${documentRef} LIMIT 1
        `);
        const doc = docResult.rows[0] as Record<string, unknown> | undefined;
        if (!doc) continue;
        const documentId = Number(doc.id);

        await db.execute(sql`
          INSERT INTO sovereign_history_event_documents (
            event_id, document_id, relationship_type, created_by
          ) VALUES (
            ${eventId}, ${documentId}, 'supporting_evidence', ${userId}
          )
          ON CONFLICT DO NOTHING
        `);

        await associateDocument({
          documentId,
          entityType: "history_event",
          entityId: String(eventId),
          relationshipType: "supporting_evidence",
          confidence: "exact",
          resolutionMethod: "manual",
          verifiedBy: userId,
          metadata: { eventRef: ref },
        });

        await recordListenerEvent({
          documentId,
          listenerName: "history-ledger",
          eventType: "DOCUMENT_LINKED_TO_HISTORY_EVENT",
          actionState: "active",
          payload: { eventId, eventRef: ref },
        });
      }

      res.status(201).json({ event });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
