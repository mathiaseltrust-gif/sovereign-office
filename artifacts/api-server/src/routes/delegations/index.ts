import { Router } from "express";
import { db } from "@workspace/db";
import { delegationsTable, usersTable } from "@workspace/db";
import { eq, or, and, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

const VALID_SCOPES = [
  "welfare_actions",
  "trust_filings",
  "family_governance",
  "lineage_review",
  "elder_advisory",
  "court_review",
  "full_authority",
] as const;
type DelegationScope = (typeof VALID_SCOPES)[number];

const SCOPE_LABELS: Record<DelegationScope, string> = {
  welfare_actions: "Welfare Actions",
  trust_filings: "Trust Filings",
  family_governance: "Family Governance",
  lineage_review: "Lineage Review",
  elder_advisory: "Elder Advisory",
  court_review: "Court & NFR Review",
  full_authority: "Full Authority",
};

// GET /api/delegations — list delegations I granted and delegations granted to me
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user?.dbId;
    if (!dbId) {
      res.status(403).json({ error: "Registered user account required." });
      return;
    }

    const rows = await db
      .select({
        delegation: delegationsTable,
        delegator: { id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role },
      })
      .from(delegationsTable)
      .leftJoin(usersTable, eq(delegationsTable.delegatorId, usersTable.id))
      .where(or(eq(delegationsTable.delegatorId, dbId), eq(delegationsTable.delegateeId, dbId)));

    const delegateeIds = [...new Set(rows.map((r) => r.delegation.delegateeId))];
    const delegateeRows = delegateeIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role })
          .from(usersTable)
          .where(or(...delegateeIds.map((id) => eq(usersTable.id, id))))
      : [];
    const delegateeMap = new Map(delegateeRows.map((u) => [u.id, u]));

    const enriched = rows.map((r) => ({
      ...r.delegation,
      scopes: Array.isArray(r.delegation.scopes) ? r.delegation.scopes : [],
      scopeLabels: (Array.isArray(r.delegation.scopes) ? r.delegation.scopes as string[] : []).map(
        (s) => SCOPE_LABELS[s as DelegationScope] ?? s
      ),
      isActive: !r.delegation.revokedAt && (!r.delegation.expiresAt || new Date(r.delegation.expiresAt) > new Date()),
      delegator: r.delegator,
      delegatee: delegateeMap.get(r.delegation.delegateeId) ?? null,
      direction: r.delegation.delegatorId === dbId ? "granted" : "received",
    }));

    res.json({
      granted: enriched.filter((d) => d.direction === "granted"),
      received: enriched.filter((d) => d.direction === "received"),
      validScopes: VALID_SCOPES.map((s) => ({ scope: s, label: SCOPE_LABELS[s] })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/delegations — create a delegation (officer+ only)
router.post("/", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const dbId = req.user?.dbId;
    if (!dbId) {
      res.status(403).json({ error: "Registered user account required." });
      return;
    }

    const { delegateeEmail, scopes, reason, note, expiresAt } = req.body as {
      delegateeEmail?: string;
      scopes?: string[];
      reason?: string;
      note?: string;
      expiresAt?: string;
    };

    if (!delegateeEmail) {
      res.status(400).json({ error: "delegateeEmail is required." });
      return;
    }
    if (!Array.isArray(scopes) || scopes.length === 0) {
      res.status(400).json({ error: "scopes must be a non-empty array. Valid values: " + VALID_SCOPES.join(", ") });
      return;
    }

    const invalidScopes = scopes.filter((s) => !VALID_SCOPES.includes(s as DelegationScope));
    if (invalidScopes.length > 0) {
      res.status(400).json({ error: `Invalid scopes: ${invalidScopes.join(", ")}. Valid: ${VALID_SCOPES.join(", ")}` });
      return;
    }

    // Only chief_justice/admin can grant full_authority
    if (scopes.includes("full_authority") && !["chief_justice", "admin"].includes(req.user!.roles[0] ?? "")) {
      res.status(403).json({ error: "Only the Chief Justice or Admin may delegate full authority." });
      return;
    }

    const [delegatee] = await db.select().from(usersTable).where(eq(usersTable.email, delegateeEmail.toLowerCase())).limit(1);
    if (!delegatee) {
      res.status(404).json({ error: `No registered user found with email: ${delegateeEmail}` });
      return;
    }
    if (delegatee.id === dbId) {
      res.status(400).json({ error: "You cannot delegate authority to yourself." });
      return;
    }

    const [row] = await db
      .insert(delegationsTable)
      .values({
        delegatorId: dbId,
        delegateeId: delegatee.id,
        scopes,
        reason: reason ?? null,
        note: note ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    logger.info(
      { delegatorId: dbId, delegateeId: delegatee.id, scopes },
      "Authority delegation created"
    );

    res.status(201).json({
      ...row,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      scopeLabels: (Array.isArray(row.scopes) ? row.scopes as string[] : []).map(
        (s) => SCOPE_LABELS[s as DelegationScope] ?? s
      ),
      delegatee: { id: delegatee.id, name: delegatee.name, email: delegatee.email, role: delegatee.role },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/delegations/:id — revoke a delegation (delegator only)
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user?.dbId;
    if (!dbId) {
      res.status(403).json({ error: "Registered user account required." });
      return;
    }

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid delegation ID." });
      return;
    }

    const [existing] = await db
      .select()
      .from(delegationsTable)
      .where(and(eq(delegationsTable.id, id), eq(delegationsTable.delegatorId, dbId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Delegation not found or you are not the delegator." });
      return;
    }
    if (existing.revokedAt) {
      res.status(409).json({ error: "Delegation is already revoked." });
      return;
    }

    const { revokedReason } = req.body as { revokedReason?: string };

    const [updated] = await db
      .update(delegationsTable)
      .set({ revokedAt: new Date(), revokedReason: revokedReason ?? null, updatedAt: new Date() })
      .where(eq(delegationsTable.id, id))
      .returning();

    logger.info({ delegationId: id, delegatorId: dbId }, "Authority delegation revoked");

    res.json({ ...updated, revoked: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/delegations/users — list registered users for the delegatee picker
router.get("/users", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const rows = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role })
      .from(usersTable)
      .limit(200);
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
