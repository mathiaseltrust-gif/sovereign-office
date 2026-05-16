import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { protectiveOrdersTable, sovereignDocumentsTable } from "@workspace/db";
import { eq, and, or, isNull } from "drizzle-orm";

const router = Router();

router.get("/protective-orders", requireAuth, async (_req, res, next) => {
  try {
    const orders = await db
      .select()
      .from(protectiveOrdersTable)
      .where(eq(protectiveOrdersTable.status, "active"))
      .orderBy(protectiveOrdersTable.issuedDate);

    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.get("/sovereign-documents", requireAuth, async (_req, res, next) => {
  try {
    const docs = await db
      .select()
      .from(sovereignDocumentsTable)
      .where(
        or(
          eq(sovereignDocumentsTable.status, "active"),
          isNull(sovereignDocumentsTable.status),
        ),
      )
      .orderBy(sovereignDocumentsTable.issuedDate);

    res.json(docs);
  } catch (err) {
    next(err);
  }
});

export default router;
