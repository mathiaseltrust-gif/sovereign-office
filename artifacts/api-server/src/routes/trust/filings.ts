import { Router } from "express";
import { db } from "@workspace/db";
import {
  trustFilingsTable,
  trustInstrumentsTable,
  searchIndexTable,
} from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";

const router = Router();

router.get("/stats", requireAuth, async (_req, res, next) => {
  try {
    const [totals] = await db
      .select({
        total: count(),
        submitted: sql<number>`sum(case when ${trustFilingsTable.filingStatus} = 'submitted' then 1 else 0 end)`,
        accepted: sql<number>`sum(case when ${trustFilingsTable.filingStatus} = 'accepted' then 1 else 0 end)`,
        rejected: sql<number>`sum(case when ${trustFilingsTable.filingStatus} = 'rejected' then 1 else 0 end)`,
      })
      .from(trustFilingsTable);
    res.json(totals);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const filings = await db
      .select()
      .from(trustFilingsTable)
      .orderBy(trustFilingsTable.createdAt);
    res.json(filings);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db
      .select()
      .from(trustFilingsTable)
      .where(eq(trustFilingsTable.id, id))
      .limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "Filing not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { instrumentId, county, state, documentType, notes } = req.body as {
      instrumentId?: number;
      county: string;
      state: string;
      documentType?: string;
      notes?: string;
    };

    if (!county || !state) {
      res.status(400).json({ error: "county and state are required" });
      return;
    }

    let landClassification = "Indian Trust Land";
    let instrumentType = documentType ?? "trust_instrument";

    if (instrumentId) {
      const inst = await db
        .select()
        .from(trustInstrumentsTable)
        .where(eq(trustInstrumentsTable.id, instrumentId))
        .limit(1);
      if (!inst[0]) {
        res.status(404).json({ error: "Instrument not found" });
        return;
      }
      landClassification = inst[0].landClassification ?? "Indian Trust Land";
      instrumentType = inst[0].instrumentType;
    }

    const [filing] = await db
      .insert(trustFilingsTable)
      .values({
        instrumentId: instrumentId ?? 0,
        county,
        state,
        filingStatus: "submitted",
        submittedAt: new Date(),
        documentType: instrumentType,
        trustStatus: "Federal Trust Land",
        landClassification,
        notes,
        instrumentType,
        filingReference: instrumentId ? `INST-${instrumentId}-${Date.now()}` : undefined,
      })
      .returning();

    if (!filing) {
      res.status(500).json({ error: "Failed to create filing" });
      return;
    }

    if (instrumentId) {
      await db
        .update(trustInstrumentsTable)
        .set({ status: "filed", updatedAt: new Date() })
        .where(eq(trustInstrumentsTable.id, instrumentId));
    }

    const filingSearchContent = [
      documentType ?? instrumentType ?? "trust filing",
      county,
      state,
      landClassification,
      notes ?? "",
      instrumentId ? `instrument:${instrumentId}` : "",
    ].filter(Boolean).join(" ");
    await db.insert(searchIndexTable).values({
      entityType: "filing",
      entityId: String(filing.id),
      content: filingSearchContent,
      metadata: {
        county,
        state,
        status: filing.filingStatus,
        instrumentId,
        documentType: documentType ?? instrumentType,
        landClassification,
      },
    });

    res.status(201).json(filing);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { filingStatus, filingNumber, recorderResponse, notes } = req.body as {
      filingStatus?: string;
      filingNumber?: string;
      recorderResponse?: object;
      notes?: string;
    };

    const existing = await db.select().from(trustFilingsTable).where(eq(trustFilingsTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Filing not found" });
      return;
    }

    const updates: Partial<typeof trustFilingsTable.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (filingStatus) updates.filingStatus = filingStatus;
    if (filingNumber) updates.filingNumber = filingNumber;
    if (recorderResponse) updates.recorderResponse = recorderResponse;
    if (notes) updates.notes = notes;
    if (filingStatus === "accepted") updates.acceptedAt = new Date();
    if (filingStatus === "rejected") updates.rejectedAt = new Date();

    const [updated] = await db
      .update(trustFilingsTable)
      .set(updates)
      .where(eq(trustFilingsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/accept", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { filingNumber } = req.body as { filingNumber?: string };
    const [updated] = await db
      .update(trustFilingsTable)
      .set({ filingStatus: "accepted", acceptedAt: new Date(), filingNumber, updatedAt: new Date() })
      .where(eq(trustFilingsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Filing not found" }); return; }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    const [updated] = await db
      .update(trustFilingsTable)
      .set({ filingStatus: "rejected", rejectedAt: new Date(), recorderResponse: { reason }, updatedAt: new Date() })
      .where(eq(trustFilingsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Filing not found" }); return; }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
